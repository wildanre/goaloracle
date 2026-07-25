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
        : { facilitator: { privateKey: config.facilitatorPrivateKey, rpcUrl: config.rpcUrl } },
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
    const url = `http://localhost:${config.port}/premium/match/${id}/analysis`;
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
    const client = createInjectiveClient({ privateKey: config.agentPrivateKey, rpcUrl: config.rpcUrl });
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
