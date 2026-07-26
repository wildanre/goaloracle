import path from "node:path";
import { fileURLToPath } from "node:url";
import { analyzeMatch, computeTeamStats, predictMatch } from "@goaloracle/analysis";
import type { Match, Provider } from "@goaloracle/data";
import { createInjectiveClient, parsePaymentResponseHeader } from "@injectivelabs/x402/client";
import { injectivePaymentMiddleware } from "@injectivelabs/x402/middleware";
import express, { type NextFunction, type Request, type RequestHandler, type Response } from "express";
import { z } from "zod";
import { cached } from "./cache.js";
import type { Config } from "./config.js";

export const PREMIUM_PRICES = {
  analysis: { path: "/premium/match/:id/analysis", usdc: "10000", label: "$0.01" },
  prediction: { path: "/premium/match/:id/prediction", usdc: "20000", label: "$0.02" },
  deepStats: { path: "/premium/team/:id/deep-stats", usdc: "10000", label: "$0.01" },
} as const;

const idParam = z.object({ id: z.coerce.number().int().positive() });
const dateQuery = z.object({ date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional() });

class HttpError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message);
  }
}

const wrap = (fn: (req: Request, res: Response) => Promise<void>): RequestHandler => (req, res, next) => {
  fn(req, res).catch(next);
};

function parseId(req: Request): number {
  const parsed = idParam.safeParse(req.params);
  if (!parsed.success) throw new HttpError(400, "INVALID_ID", "id must be a positive integer");
  return parsed.data.id;
}

async function loadMatchBundle(provider: Provider, id: number): Promise<{ match: Match; matchesA: Match[]; matchesB: Match[]; h2h: Match[] }> {
  const match = await cached(`match:${id}`, () => provider.getMatch(id));
  if (!match) throw new HttpError(404, "MATCH_NOT_FOUND", `No match with id ${id}`);
  const [matchesA, matchesB, h2h] = await Promise.all([
    cached(`team:${match.homeTeam.id}`, () => provider.getTeamMatches(match.homeTeam.id)),
    cached(`team:${match.awayTeam.id}`, () => provider.getTeamMatches(match.awayTeam.id)),
    cached(`h2h:${match.homeTeam.id}:${match.awayTeam.id}`, () => provider.getH2H(match.homeTeam.id, match.awayTeam.id)),
  ]);
  return { match, matchesA, matchesB, h2h };
}

export function buildApp(provider: Provider, config: Config): express.Express {
  const app = express();
  app.set("x-powered-by", false);

  // --- JSON-RPC shim for the inline facilitator ---
  // The public Injective testnet RPCs serve blocks/receipts via
  // eth_getBlockReceipts but their per-hash tx index is broken (returns null
  // for txs that are demonstrably on-chain), which makes viem's
  // waitForTransactionReceipt — and therefore x402 settlement — fail after the
  // money has already moved. The shim proxies everything upstream and, on a
  // null receipt/tx-by-hash, recovers the answer by scanning recent blocks.
  // ponytail: linear scan of last 60 blocks per poll (~40s window at 650ms
  // blocks); index/cache it if settlement volume ever matters.
  // Public testnet RPC connects are flaky (transient IPv6/connect timeouts) —
  // retry with a short per-attempt timeout instead of undici's 10s default.
  const upstreamRpc = async (payload: unknown): Promise<{ result?: unknown }> => {
    let lastErr: unknown;
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const res = await fetch(config.rpcUrl, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(payload),
          signal: AbortSignal.timeout(5000),
        });
        return (await res.json()) as { result?: unknown };
      } catch (err) {
        lastErr = err;
        await new Promise((r) => setTimeout(r, 500 * (attempt + 1)));
      }
    }
    throw lastErr;
  };

  app.post("/rpc-shim", express.json(), wrap(async (req, res) => {
    const body = req.body as { method?: string; params?: unknown[] };
    const out = await upstreamRpc(body);
    const method = body?.method;
    if ((method === "eth_getTransactionReceipt" || method === "eth_getTransactionByHash") && out.result === null) {
      const hash = String(body.params?.[0] ?? "").toLowerCase();
      const latest = await upstreamRpc({ jsonrpc: "2.0", id: 1, method: "eth_blockNumber", params: [] });
      const head = Number.parseInt(String(latest.result), 16);
      for (let b = head; b > head - 60 && b >= 0 && out.result === null; b--) {
        const blockTag = `0x${b.toString(16)}`;
        if (method === "eth_getTransactionReceipt") {
          const r = await upstreamRpc({ jsonrpc: "2.0", id: 1, method: "eth_getBlockReceipts", params: [blockTag] });
          const receipts = Array.isArray(r.result) ? (r.result as Array<{ transactionHash?: string }>) : [];
          out.result = receipts.find((x) => x.transactionHash?.toLowerCase() === hash) ?? null;
        } else {
          const r = await upstreamRpc({ jsonrpc: "2.0", id: 1, method: "eth_getBlockByNumber", params: [blockTag, true] });
          const txs = (r.result as { transactions?: Array<{ hash?: string }> } | null)?.transactions ?? [];
          out.result = txs.find((x) => x.hash?.toLowerCase() === hash) ?? null;
        }
      }
    }
    res.json(out);
  }));

  // --- Premium preflight: resolve the data BEFORE the paywall ---
  // Settlement uses the default "before" policy (the library's after-success
  // buffering emits malformed HTTP in v0.0.1 — see docs/LEARNINGS.md), so the
  // payer would be charged even if the handler failed. Preflight makes that
  // impossible: bad ids / upstream data errors are rejected unpaid, and the
  // fetched bundle is cached so the paid handler cannot fail on data.
  app.use("/premium/match/:id", (req, _res, next) => {
    loadMatchBundle(provider, Number(req.params.id)).then(() => next(), next);
  });
  app.use("/premium/team/:id", (req, _res, next) => {
    const id = Number(req.params.id);
    cached(`team:${id}`, () => provider.getTeamMatches(id)).then(
      (ms) => (ms.length > 0 ? next() : next(new HttpError(404, "TEAM_NOT_FOUND", `No matches found for team ${id}`))),
      next,
    );
  });

  // --- x402 paywall on premium routes (Injective EVM testnet, USDC) ---
  // Docs followed: https://docs.injective.network/developers-ai/x402
  const accepts = (amount: string) => [
    {
      network: config.network,
      asset: config.usdcAddress,
      amount,
      ...(config.payToAddress ? { payTo: config.payToAddress } : {}),
    },
  ];
  app.use(
    injectivePaymentMiddleware(
      {
        [`GET ${PREMIUM_PRICES.analysis.path}`]: {
          description: "AI-grade World Cup match analysis (form, Poisson xG, win probability)",
          accepts: accepts(PREMIUM_PRICES.analysis.usdc),
        },
        [`GET ${PREMIUM_PRICES.prediction.path}`]: {
          description: "World Cup match outcome prediction with most likely score",
          accepts: accepts(PREMIUM_PRICES.prediction.usdc),
        },
        [`GET ${PREMIUM_PRICES.deepStats.path}`]: {
          description: "Deep team statistics for a World Cup team",
          accepts: accepts(PREMIUM_PRICES.deepStats.usdc),
        },
      },
      config.facilitatorUrl
        ? { facilitatorUrl: config.facilitatorUrl }
        : { facilitator: { privateKey: config.facilitatorPrivateKey, rpcUrl: `${config.selfBaseUrl}/rpc-shim` } },
    ),
  );

  // --- Free endpoints ---
  app.get("/healthz", (_req, res) => {
    res.json({ ok: true, provider: provider.name, network: config.network });
  });

  app.get("/matches/live", wrap(async (_req, res) => {
    res.json({ matches: await cached("live", () => provider.getLiveMatches()) });
  }));

  app.get("/matches/today", wrap(async (req, res) => {
    const q = dateQuery.safeParse(req.query);
    if (!q.success) throw new HttpError(400, "INVALID_DATE", "date must be YYYY-MM-DD");
    const date = q.data.date;
    res.json({ matches: await cached(`fixtures:${date ?? "today"}`, () => provider.getFixtures(date)) });
  }));

  app.get("/matches/recent", wrap(async (_req, res) => {
    res.json({ matches: await cached("recent", () => provider.getRecentMatches()) });
  }));

  app.get("/matches/:id", wrap(async (req, res) => {
    const id = parseId(req);
    const match = await cached(`match:${id}`, () => provider.getMatch(id));
    if (!match) throw new HttpError(404, "MATCH_NOT_FOUND", `No match with id ${id}`);
    res.json({ match });
  }));

  app.get("/standings", wrap(async (_req, res) => {
    res.json({ standings: await cached("standings", () => provider.getStandings()) });
  }));

  app.get("/teams/:id/fixtures", wrap(async (req, res) => {
    const id = parseId(req);
    res.json({ matches: await cached(`team:${id}`, () => provider.getTeamMatches(id)) });
  }));

  // --- Premium handlers (only reachable after x402 payment above) ---
  app.get(PREMIUM_PRICES.analysis.path, wrap(async (req, res) => {
    const { match, matchesA, matchesB, h2h } = await loadMatchBundle(provider, parseId(req));
    res.json({ match, analysis: analyzeMatch(match, matchesA, matchesB, h2h) });
  }));

  app.get(PREMIUM_PRICES.prediction.path, wrap(async (req, res) => {
    const { match, matchesA, matchesB, h2h } = await loadMatchBundle(provider, parseId(req));
    res.json({ match, prediction: predictMatch(match, matchesA, matchesB, h2h) });
  }));

  app.get(PREMIUM_PRICES.deepStats.path, wrap(async (req, res) => {
    const id = parseId(req);
    const matches = await cached(`team:${id}`, () => provider.getTeamMatches(id));
    if (matches.length === 0) throw new HttpError(404, "TEAM_NOT_FOUND", `No matches found for team ${id}`);
    res.json({ teamId: id, stats: computeTeamStats(id, matches), matches });
  }));

  // --- Dashboard demo proxy: pays for the premium analysis with the demo
  // agent wallet when configured; otherwise returns a dry-run so the
  // dashboard works on a clean clone. ---
  app.get("/demo/analyze/:id", wrap(async (req, res) => {
    const id = parseId(req);
    const url = `${config.selfBaseUrl}/premium/match/${id}/analysis`;
    if (!config.agentPrivateKey) {
      const challenge = await fetch(url);
      const body = (await challenge.json()) as Record<string, unknown>;
      const { match, matchesA, matchesB, h2h } = await loadMatchBundle(provider, id);
      res.json({
        paid: false,
        mode: "dry-run (set AGENT_PRIVATE_KEY to pay with USDC on Injective testnet)",
        x402Challenge: { status: challenge.status, accepts: body.accepts },
        analysis: analyzeMatch(match, matchesA, matchesB, h2h),
      });
      return;
    }
    const client = createInjectiveClient({ privateKey: config.agentPrivateKey, rpcUrl: `${config.selfBaseUrl}/rpc-shim` });
    const paidRes = await client.fetch(url);
    if (!paidRes.ok) {
      throw new HttpError(502, "X402_PAYMENT_FAILED", `Premium call failed with ${paidRes.status}: ${(await paidRes.text()).slice(0, 300)}`);
    }
    const receipt = parsePaymentResponseHeader(paidRes);
    res.json({ paid: true, receipt, ...(await paidRes.json() as object) });
  }));

  // --- Dashboard static files ---
  app.use(express.static(path.join(path.dirname(fileURLToPath(import.meta.url)), "../../../public")));

  app.use((_req, res) => {
    res.status(404).json({ error: "Not found", code: "NOT_FOUND" });
  });

  // Express error middleware signature requires 4 args.
  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    if (err instanceof HttpError) {
      res.status(err.status).json({ error: err.message, code: err.code });
      return;
    }
    console.error("[api] unhandled error:", err);
    res.status(500).json({ error: err instanceof Error ? err.message : "Internal error", code: "INTERNAL" });
  });

  return app;
}
