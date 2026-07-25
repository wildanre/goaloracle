# LEARNINGS.md

Compound-engineering log: symptom → root cause → fix → rule. Newest first.

## Circle docs unreachable ≠ facts unavailable — npm packages are a better registry than web pages

- **Symptom:** `developers.circle.com` fetches failed (ECONNRESET/TLS), and no search result stated Injective's CCTP domain ID.
- **Root cause:** Docs sites flake; chain registries move faster than published tables.
- **Fix:** Installed `@circle-fin/provider-cctp-v2` and read its chain definitions: Injective testnet = domain **29**, chainId 1439, TokenMessengerV2/MessageTransmitterV2 addresses identical on Sepolia and Injective testnet.
- **Rule:** When integrating a protocol, prefer reading the official SDK/provider package source (`npm view`, install in scratch, read `.d.ts`/dist) over scraping docs pages. It is versioned, exact, and machine-checked.

## x402 with zero env vars: ephemeral inline facilitator

- **Symptom:** PRD demands `pnpm demo` (incl. a valid HTTP 402 challenge) on a clean clone with no env, but `injectivePaymentMiddleware` requires either `facilitatorUrl` or a facilitator private key.
- **Root cause:** The 402 challenge itself needs no chain access — only settlement does.
- **Fix:** Config generates an ephemeral facilitator key when `FACILITATOR_PRIVATE_KEY` is unset (`packages/api/src/config.ts`); `payTo` then defaults to that wallet. Challenges are fully valid; settlement requires real funded keys.
- **Rule:** Split "protocol handshake works" from "money moves" — demo the first with zero config, gate the second on env.

## Verifying the paid x402 path without funded keys

- **Symptom:** Can't fully test 402→pay→200 without testnet USDC.
- **Root cause:** Faucets need human interaction.
- **Fix:** Ran the demo client with a throwaway unfunded key: it signed EIP-3009, the inline facilitator verified against the live testnet RPC and rejected with protocol-standard `insufficient_funds`. Every link except final settlement is proven.
- **Rule:** An expected on-chain rejection is a strong integration test — assert the *reason code*, not just failure.

## zod major-version conflicts across SDKs

- **Symptom:** Risk of dual zod instances: `@injectivelabs/x402` wants `^3.23`, MCP SDK accepts `^3.25 || ^4`, latest zod is 4.x.
- **Fix:** Pinned workspace-wide `zod@^3.25.0` (satisfies both).
- **Rule:** In a monorepo mixing web3 + MCP SDKs, pick the intersection zod major explicitly in every package.json — don't let pnpm resolve two majors.

## MCP docs on `main` describe the unreleased 2.0 API

- **Symptom:** context7 docs for the MCP TypeScript SDK show `@modelcontextprotocol/server` + `serveStdio`, which doesn't match `@modelcontextprotocol/sdk@1.29`.
- **Root cause:** Repo `main` documents `2.0.0-beta`; stable is still `1.x` (`McpServer` + `StdioServerTransport`, `registerTool` with a zod raw shape).
- **Rule:** Cross-check fetched docs against `npm view <pkg> version` before coding; build against the published stable API.
