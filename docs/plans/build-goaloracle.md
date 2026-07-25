# Plan: Build GoalOracle (all phases)

Source of truth: PRD-GoalOracle.md. Deadline mode — simplest working implementation.

## Verified external facts (fetched 2026-07-26)

- x402: `@injectivelabs/x402@0.0.1` (official). Exports:
  - `/middleware` → `injectivePaymentMiddleware(routes, {facilitatorUrl | facilitator})`; unpaid → HTTP 402 + `accepts` JSON.
  - `/client` → `createInjectiveClient({privateKey})` → `.fetch()` auto-handles 402→sign(EIP-3009)→retry; `parsePaymentResponseHeader()` for receipt.
  - `/networks` → testnet CAIP-2 `eip155:1439`, RPC `https://k8s.testnet.json-rpc.injective.network`, USDC `0x0C382e685bbeeFE5d3d9C29e29E341fEE8E84C5d` (Circle FiatTokenV2_2, EIP-3009 ✓).
  - Docs: https://docs.injective.network/developers-ai/x402
- CCTP v2 (source: `@circle-fin/provider-cctp-v2` chain registry):
  - Injective testnet domain **29**; Sepolia domain **0**.
  - TokenMessengerV2 `0x8FE6B999Dc680CcFDD5Bf7EB0974218be2542DAA`, MessageTransmitterV2 `0xE737e5cEBEEBa77EFE34D4aa090756590b1CE275` (same on both testnets).
  - Sepolia USDC `0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238`. Attestation: `https://iris-api-sandbox.circle.com/v2/messages/{srcDomain}?transactionHash=`.
- MCP SDK `@modelcontextprotocol/sdk@1.29`. Express pinned to 4 (PRD). zod pinned to ^3.25 (x402 requires ^3.23).

## Approach

- pnpm workspaces; **no build step** — `tsx` runs TS directly; `tsc --noEmit` for type gate; vitest native TS.
- packages/data: `Provider` interface + FootballDataProvider (zod-validated football-data.org v4) + MockProvider (bundled WC2026 JSON). Auto-select mock when `FOOTBALL_DATA_TOKEN` missing.
- packages/analysis: pure deterministic fns (form index, Poisson xG, win prob grid, H2H weighting).
- packages/api: Express 4, free endpoints, 60s Map cache, zod params, error middleware, premium routes behind `injectivePaymentMiddleware`.
  - Facilitator strategy: `FACILITATOR_PRIVATE_KEY` → inline facilitator; else `X402_FACILITATOR_URL`; else **ephemeral generated key** so the 402 challenge (which needs no chain access) always works with zero env — settlement then requires funded keys, which is exactly PRD criterion "x402 in test/dry mode if chain unreachable".
  - Mainnet refusal hardcoded in config (chain 1776 / mainnet RPC rejected).
- packages/mcp-server: stdio, free tools proxy the HTTP API (`API_BASE_URL`), paid tools use x402 client with `AGENT_PRIVATE_KEY`, `get_wallet_status` via viem.
- scripts/: demo-x402-client.ts (dry mode without key), fund-wallet-cctp.ts (`--dry-run` prints full step plan), demo.ts (start API mock → client → MCP snippet).
- skills/: world-cup-analyst, match-predictor, x402-payer (YAML frontmatter).
- public/index.html single-file dashboard + `/demo/analyze/:id` proxy.

## Risks

- Facilitator settlement needs INJ gas on testnet — demo defaults to dry mode; full flow documented for funded keys.
- football-data.org 10 req/min free tier — 60s cache covers it.
- `@injectivelabs/x402` is v0.0.1 — pin exact version.

## Env deviation from PRD §5

Adds `FACILITATOR_PRIVATE_KEY`, `X402_FACILITATOR_URL`, `API_BASE_URL`, `SEPOLIA_RPC` (required by the real middleware/client APIs; noted in .env.example).
