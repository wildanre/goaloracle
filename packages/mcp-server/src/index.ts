/**
 * GoalOracle MCP server (stdio) — free World Cup data tools proxy the HTTP
 * API; paid tools autonomously pay the x402 USDC price on Injective EVM
 * testnet with the agent wallet (AGENT_PRIVATE_KEY).
 *
 * MCP SDK docs: https://github.com/modelcontextprotocol/typescript-sdk
 * x402 docs:    https://docs.injective.network/developers-ai/x402
 */
try { process.loadEnvFile(); } catch { /* no .env — defaults apply */ }
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createInjectiveClient, parsePaymentResponseHeader } from "@injectivelabs/x402/client";
import { INJECTIVE_TESTNET_CAIP2, getRpcUrl, getToken, getViemChain } from "@injectivelabs/x402/networks";
import { http, createPublicClient, erc20Abi, formatUnits } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { z } from "zod";

const API = process.env.API_BASE_URL ?? `http://localhost:${process.env.PORT ?? 3000}`;
const NETWORK = INJECTIVE_TESTNET_CAIP2;
// Default to the API's /rpc-shim: it proxies the public testnet RPC with
// retries and recovers receipts that the RPC's broken tx-hash index drops.
const RPC_URL = process.env.INJECTIVE_EVM_RPC ?? `${API}/rpc-shim`;
const agentKey = process.env.AGENT_PRIVATE_KEY as `0x${string}` | undefined;

if (RPC_URL.includes("sentry.evm-rpc.injective.network")) {
  throw new Error("Refusing to run against Injective MAINNET. Testnet only (PRD §9).");
}

type ToolResult = { content: Array<{ type: "text"; text: string }>; isError?: boolean };

const ok = (data: unknown): ToolResult => ({ content: [{ type: "text", text: JSON.stringify(data, null, 2) }] });
const fail = (msg: string): ToolResult => ({ content: [{ type: "text", text: msg }], isError: true });

async function apiGet(path: string): Promise<ToolResult> {
  const res = await fetch(`${API}${path}`);
  const body = await res.json();
  if (!res.ok) return fail(`GoalOracle API error ${res.status}: ${JSON.stringify(body)}`);
  return ok(body);
}

async function paidGet(path: string): Promise<ToolResult> {
  if (!agentKey) {
    const challenge = await fetch(`${API}${path}`);
    const body = await challenge.json();
    return fail(
      "This is a PAID tool but no AGENT_PRIVATE_KEY is configured, so the x402 payment cannot be signed.\n" +
        `The server quoted this x402 challenge (HTTP ${challenge.status}):\n${JSON.stringify(body, null, 2)}\n` +
        "Fund a testnet wallet (https://faucet.circle.com, network: Injective testnet) and set AGENT_PRIVATE_KEY to enable autonomous payment.",
    );
  }
  const client = createInjectiveClient({ privateKey: agentKey, rpcUrl: RPC_URL, preferredNetworks: [NETWORK] });
  const res = await client.fetch(`${API}${path}`);
  const body = await res.json();
  if (!res.ok) return fail(`x402 payment flow failed with HTTP ${res.status}: ${JSON.stringify(body)}`);
  const receipt = parsePaymentResponseHeader(res);
  return ok({ x402Payment: receipt ?? "settlement receipt pending", ...(body as object) });
}

const server = new McpServer({ name: "goaloracle", version: "0.1.0" });

server.registerTool(
  "get_live_matches",
  { description: "Get all currently live 2026 World Cup matches with scores and match minute. Free." },
  () => apiGet("/matches/live"),
);

server.registerTool(
  "get_todays_fixtures",
  {
    description: "Get World Cup fixtures for today, or for a given date. Free.",
    inputSchema: { date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().describe("UTC date YYYY-MM-DD; defaults to today") },
  },
  ({ date }) => apiGet(`/matches/today${date ? `?date=${date}` : ""}`),
);

server.registerTool(
  "get_match_detail",
  {
    description: "Get one World Cup match by id (teams, score, status, stage). Free.",
    inputSchema: { matchId: z.number().int().positive().describe("Match id, e.g. from get_live_matches") },
  },
  ({ matchId }) => apiGet(`/matches/${matchId}`),
);

server.registerTool(
  "get_standings",
  { description: "Get World Cup group standings (points, goal difference, position). Free." },
  () => apiGet("/standings"),
);

server.registerTool(
  "get_head_to_head",
  {
    description: "Get finished head-to-head matches between two teams by team id. Free.",
    inputSchema: {
      teamAId: z.number().int().positive(),
      teamBId: z.number().int().positive(),
    },
  },
  async ({ teamAId, teamBId }) => {
    // H2H = finished meetings of A that involve B, served by the team fixtures endpoint.
    const res = await fetch(`${API}/teams/${teamAId}/fixtures`);
    const body = (await res.json()) as { matches?: Array<{ status: string; homeTeam: { id: number }; awayTeam: { id: number } }> };
    if (!res.ok) return fail(`GoalOracle API error ${res.status}: ${JSON.stringify(body)}`);
    const h2h = (body.matches ?? []).filter(
      (m) => m.status === "FINISHED" && [m.homeTeam.id, m.awayTeam.id].includes(teamBId),
    );
    return ok({ matches: h2h });
  },
);

server.registerTool(
  "get_match_analysis",
  {
    description:
      "PAID ($0.01 USDC via x402 on Injective EVM testnet): statistical match analysis — form indices, Poisson expected goals, win/draw/win probabilities, key factors. The agent wallet pays autonomously.",
    inputSchema: { matchId: z.number().int().positive() },
  },
  ({ matchId }) => paidGet(`/premium/match/${matchId}/analysis`),
);

server.registerTool(
  "get_match_prediction",
  {
    description:
      "PAID ($0.02 USDC via x402 on Injective EVM testnet): match outcome prediction with most likely score and probabilities. Statistical estimate, not betting advice. The agent wallet pays autonomously.",
    inputSchema: { matchId: z.number().int().positive() },
  },
  ({ matchId }) => paidGet(`/premium/match/${matchId}/prediction`),
);

server.registerTool(
  "get_wallet_status",
  { description: "Get the agent wallet's USDC and INJ balance on Injective EVM testnet, plus its address. Free." },
  async () => {
    if (!agentKey) return fail("No AGENT_PRIVATE_KEY configured — no agent wallet to inspect.");
    const account = privateKeyToAccount(agentKey);
    const usdc = getToken(NETWORK, "USDC");
    if (!usdc) return fail("USDC not found in x402 token registry");
    const client = createPublicClient({ chain: getViemChain(NETWORK), transport: http(RPC_URL) });
    const [usdcBalance, injBalance] = await Promise.all([
      client.readContract({ address: usdc.address, abi: erc20Abi, functionName: "balanceOf", args: [account.address] }),
      client.getBalance({ address: account.address }),
    ]);
    return ok({
      address: account.address,
      network: NETWORK,
      usdc: `${formatUnits(usdcBalance, usdc.decimals)} USDC`,
      inj: `${formatUnits(injBalance, 18)} INJ`,
      faucets: { usdc: "https://faucet.circle.com", inj: "https://testnet.faucet.injective.network" },
    });
  },
);

const transport = new StdioServerTransport();
await server.connect(transport);
console.error(`[goaloracle-mcp] ready on stdio — API: ${API}, network: ${NETWORK}, agent wallet: ${agentKey ? "configured" : "not configured (paid tools will explain how to fund)"}`);
