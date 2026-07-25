/**
 * Demo x402 client — the payment-flow centerpiece.
 *
 * With AGENT_PRIVATE_KEY set:  calls a premium endpoint, auto-handles the
 *   402 → EIP-3009 sign → retry flow via @injectivelabs/x402, prints the
 *   settlement receipt (tx hash on Injective EVM testnet) and the analysis.
 * Without a key (dry mode):    shows the real 402 challenge and explains
 *   each step that would happen, so `pnpm demo` works on a clean clone.
 *
 * Docs followed: https://docs.injective.network/developers-ai/x402
 */
import { createInjectiveClient, parsePaymentResponseHeader } from "@injectivelabs/x402/client";
import { getRpcUrl, INJECTIVE_TESTNET_CAIP2 } from "@injectivelabs/x402/networks";
import { privateKeyToAccount } from "viem/accounts";

const API = process.env.API_BASE_URL ?? `http://localhost:${process.env.PORT ?? 3000}`;
const MATCH_ID = process.env.DEMO_MATCH_ID ?? "2001";
const url = `${API}/premium/match/${MATCH_ID}/analysis`;
const agentKey = process.env.AGENT_PRIVATE_KEY;

const log = (step: string, msg: string) => console.log(`\n[${step}] ${msg}`);

async function main(): Promise<void> {
  console.log("GoalOracle x402 demo client — premium World Cup analysis, paid in USDC on Injective EVM testnet");
  console.log(`Endpoint: GET ${url}`);

  log("1/4", "Requesting WITHOUT payment — expecting an HTTP 402 challenge…");
  const challenge = await fetch(url);
  const challengeBody = await challenge.json() as { accepts?: Array<{ network: string; asset: string; amount: string; payTo: string }> };
  if (challenge.status !== 402) {
    throw new Error(`Expected 402, got ${challenge.status} — is the API running with x402 enabled?`);
  }
  const req0 = challengeBody.accepts?.[0];
  if (!req0) throw new Error("402 response missing payment requirements");
  console.log(`    HTTP 402 Payment Required`);
  console.log(`    network : ${req0.network} (Injective EVM testnet)`);
  console.log(`    asset   : ${req0.asset} (USDC)`);
  console.log(`    amount  : ${req0.amount} (= $${Number(req0.amount) / 1e6} USDC)`);
  console.log(`    payTo   : ${req0.payTo}`);

  if (!agentKey) {
    log("2/4", "DRY MODE — no AGENT_PRIVATE_KEY configured.");
    console.log("    With a funded key the client would now:");
    console.log("      a. sign an EIP-3009 transferWithAuthorization for the quoted USDC amount");
    console.log("      b. retry the request with the PAYMENT-SIGNATURE header");
    console.log("      c. the server verifies + settles on Injective EVM testnet and returns 200 + receipt");
    log("3/4", "Fund a wallet: set AGENT_PRIVATE_KEY, get USDC at https://faucet.circle.com (Injective testnet)");
    console.log("    or bridge from Sepolia via CCTP: pnpm cctp --dry-run");
    log("4/4", "Dry run complete — the 402 challenge above is live x402 protocol output. ✔");
    return;
  }

  const account = privateKeyToAccount(agentKey as `0x${string}`);
  log("2/4", `Paying with agent wallet ${account.address} — signing EIP-3009 authorization and retrying…`);
  const client = createInjectiveClient({
    privateKey: agentKey as `0x${string}`,
    rpcUrl: process.env.INJECTIVE_EVM_RPC ?? getRpcUrl(INJECTIVE_TESTNET_CAIP2),
    preferredNetworks: [INJECTIVE_TESTNET_CAIP2],
  });
  const paid = await client.fetch(url);
  if (!paid.ok) {
    throw new Error(`Payment flow failed: HTTP ${paid.status} — ${(await paid.text()).slice(0, 400)}`);
  }

  log("3/4", "Payment settled — HTTP 200. Settlement receipt:");
  const receipt = parsePaymentResponseHeader(paid);
  if (receipt) {
    console.log(`    success : ${receipt.success}`);
    console.log(`    payer   : ${receipt.payer}`);
    console.log(`    network : ${receipt.network}`);
    console.log(`    tx      : ${receipt.transaction}`);
    console.log(`    explorer: https://testnet.blockscout.injective.network/tx/${receipt.transaction}`);
  } else {
    console.log("    (no PAYMENT-RESPONSE header — settlement may still be confirming; check the chain)");
  }

  log("4/4", "Premium analysis JSON:");
  console.log(JSON.stringify(await paid.json(), null, 2));
}

main().catch((err) => {
  console.error(`\n[demo-x402-client] FAILED: ${err instanceof Error ? err.message : err}`);
  process.exit(1);
});
