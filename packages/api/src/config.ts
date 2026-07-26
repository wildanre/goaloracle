import { INJECTIVE_TESTNET_CAIP2, getRpcUrl, getToken } from "@injectivelabs/x402/networks";
import { generatePrivateKey } from "viem/accounts";
import { z } from "zod";

/**
 * Testnet only — the whole config is pinned to Injective EVM testnet
 * (eip155:1439) and refuses mainnet values by design (see PRD §9).
 */
export const NETWORK = INJECTIVE_TESTNET_CAIP2;

const MAINNET_USDC = "0xa00c59ff5a080d2b954d0c75e46e22a0c371235a";
const MAINNET_RPC_HOST = "sentry.evm-rpc.injective.network";
const MAINNET_CHAIN_ID = "1776";

const hexKey = z.string().regex(/^0x[0-9a-fA-F]{64}$/, "must be a 0x-prefixed 32-byte hex private key");
const address = z.string().regex(/^0x[0-9a-fA-F]{40}$/, "must be a 0x-prefixed address");

const envSchema = z.object({
  FOOTBALL_DATA_TOKEN: z.string().min(1).optional(),
  PORT: z.coerce.number().int().positive().default(3000),
  PAY_TO_ADDRESS: address.optional(),
  AGENT_PRIVATE_KEY: hexKey.optional(),
  FACILITATOR_PRIVATE_KEY: hexKey.optional(),
  X402_FACILITATOR_URL: z.string().url().optional(),
  INJECTIVE_EVM_RPC: z.string().url().optional(),
  USDC_ADDRESS: address.optional(),
  // Set by Vercel at runtime — used to build self-referential URLs, since
  // serverless functions have no localhost listener.
  VERCEL_URL: z.string().optional(),
  VERCEL_PROJECT_PRODUCTION_URL: z.string().optional(),
});

export type Config = ReturnType<typeof loadConfig>;

export function loadConfig(env: NodeJS.ProcessEnv = process.env) {
  const cleaned = Object.fromEntries(Object.entries(env).filter(([, v]) => v !== "" && v !== undefined));
  const parsed = envSchema.safeParse(cleaned);
  if (!parsed.success) {
    throw new Error(`Invalid environment: ${parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ")}`);
  }
  const e = parsed.data;

  const rpcUrl = e.INJECTIVE_EVM_RPC ?? getRpcUrl(NETWORK);
  const usdc = getToken(NETWORK, "USDC");
  if (!usdc) throw new Error("Testnet USDC not found in x402 token registry");
  const usdcAddress = (e.USDC_ADDRESS ?? usdc.address) as `0x${string}`;

  // Hardcoded mainnet refusal — this project must never move real money.
  if (rpcUrl.includes(MAINNET_RPC_HOST) || rpcUrl.includes(MAINNET_CHAIN_ID)) {
    throw new Error(`Refusing to run against Injective MAINNET RPC (${rpcUrl}). Testnet only (PRD §9).`);
  }
  if (usdcAddress.toLowerCase() === MAINNET_USDC) {
    throw new Error("Refusing to use MAINNET USDC. Testnet only (PRD §9).");
  }

  // Without a configured facilitator key, generate an ephemeral one: the 402
  // challenge needs no chain access, so unpaid flows (and the mock demo) work
  // with zero env vars. Settlement then fails until real funded keys are set.
  const facilitatorPrivateKey = (e.FACILITATOR_PRIVATE_KEY ?? generatePrivateKey()) as `0x${string}`;
  const facilitatorIsEphemeral = !e.FACILITATOR_PRIVATE_KEY;

  // Prefer the stable production alias (public) over the per-deployment URL,
  // which may sit behind Vercel deployment protection.
  const vercelHost = e.VERCEL_PROJECT_PRODUCTION_URL ?? e.VERCEL_URL;

  return {
    footballDataToken: e.FOOTBALL_DATA_TOKEN,
    port: e.PORT,
    /** Base URL this app can reach itself on (self-calls: rpc-shim, demo proxy). */
    selfBaseUrl: vercelHost ? `https://${vercelHost}` : `http://localhost:${e.PORT}`,
    payToAddress: e.PAY_TO_ADDRESS as `0x${string}` | undefined,
    agentPrivateKey: e.AGENT_PRIVATE_KEY as `0x${string}` | undefined,
    facilitatorPrivateKey,
    facilitatorIsEphemeral,
    facilitatorUrl: e.X402_FACILITATOR_URL,
    rpcUrl,
    usdcAddress,
    network: NETWORK,
  };
}
