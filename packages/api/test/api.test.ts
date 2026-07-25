import type { Server } from "node:http";
import { MockProvider } from "@goaloracle/data";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildApp } from "../src/app.js";
import { cached, clearCache } from "../src/cache.js";
import { loadConfig } from "../src/config.js";

let server: Server;
let base: string;

beforeAll(async () => {
  const app = buildApp(new MockProvider(), loadConfig({}));
  await new Promise<void>((resolve) => {
    server = app.listen(0, resolve);
  });
  const addr = server.address();
  if (addr === null || typeof addr === "string") throw new Error("no port");
  base = `http://localhost:${addr.port}`;
});

afterAll(() => new Promise<void>((resolve) => server.close(() => resolve())));

describe("config", () => {
  it("refuses mainnet RPC and mainnet USDC (testnet only)", () => {
    expect(() => loadConfig({ INJECTIVE_EVM_RPC: "https://sentry.evm-rpc.injective.network" })).toThrow(/MAINNET/i);
    expect(() => loadConfig({ USDC_ADDRESS: "0xa00C59fF5a080D2b954d0c75e46E22a0c371235a" })).toThrow(/MAINNET/i);
  });

  it("defaults to Injective EVM testnet", () => {
    const c = loadConfig({});
    expect(c.network).toBe("eip155:1439");
    expect(c.usdcAddress).toBe("0x0C382e685bbeeFE5d3d9C29e29E341fEE8E84C5d");
  });
});

describe("cache", () => {
  it("serves cached values within TTL and recomputes after expiry", async () => {
    clearCache();
    let calls = 0;
    const fn = async () => ++calls;
    expect(await cached("k", fn, 50)).toBe(1);
    expect(await cached("k", fn, 50)).toBe(1);
    await new Promise((r) => setTimeout(r, 60));
    expect(await cached("k", fn, 50)).toBe(2);
  });
});

describe("free endpoints", () => {
  it("GET /matches/live returns the live matches", async () => {
    const res = await fetch(`${base}/matches/live`);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { matches: Array<{ status: string }> };
    expect(body.matches).toHaveLength(2);
    expect(body.matches.every((m) => m.status === "LIVE")).toBe(true);
  });

  it("GET /standings returns group tables", async () => {
    const body = (await (await fetch(`${base}/standings`)).json()) as { standings: unknown[] };
    expect(body.standings).toHaveLength(2);
  });

  it("validates params with structured errors", async () => {
    const res = await fetch(`${base}/matches/not-a-number`);
    expect(res.status).toBe(400);
    expect(((await res.json()) as { code: string }).code).toBe("INVALID_ID");
  });

  it("404s unknown matches with a structured error", async () => {
    const res = await fetch(`${base}/matches/999999`);
    expect(res.status).toBe(404);
    expect(((await res.json()) as { code: string }).code).toBe("MATCH_NOT_FOUND");
  });
});

describe("x402 paywall", () => {
  it("returns HTTP 402 with valid payment requirements when unpaid", async () => {
    const res = await fetch(`${base}/premium/match/2001/analysis`);
    expect(res.status).toBe(402);
    expect(res.headers.get("payment-required")).toBeTruthy();
    const body = (await res.json()) as {
      x402Version: number;
      accepts: Array<{ network: string; asset: string; amount: string; payTo: string; scheme: string }>;
    };
    expect(body.x402Version).toBe(2);
    expect(body.accepts).toHaveLength(1);
    const req0 = body.accepts[0]!;
    expect(req0.scheme).toBe("exact");
    expect(req0.network).toBe("eip155:1439");
    expect(req0.asset.toLowerCase()).toBe("0x0c382e685bbeefe5d3d9c29e29e341fee8e84c5d");
    expect(req0.amount).toBe("10000");
    expect(req0.payTo).toMatch(/^0x[0-9a-fA-F]{40}$/);
  });

  it("prices the prediction endpoint at $0.02", async () => {
    const res = await fetch(`${base}/premium/match/2001/prediction`);
    expect(res.status).toBe(402);
    const body = (await res.json()) as { accepts: Array<{ amount: string }> };
    expect(body.accepts[0]!.amount).toBe("20000");
  });

  it("rejects a garbage payment header with 402", async () => {
    const res = await fetch(`${base}/premium/match/2001/analysis`, {
      headers: { "PAYMENT-SIGNATURE": "bm90LWEtcGF5bWVudA==" },
    });
    expect(res.status).toBe(402);
  });

  it("leaves free endpoints unprotected", async () => {
    expect((await fetch(`${base}/matches/live`)).status).toBe(200);
  });
});
