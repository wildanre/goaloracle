# LEARNINGS.md

Compound-engineering log: symptom → root cause → fix → rule. Newest first.

## x402 `settlementPolicy: "after-success"` emits malformed HTTP (v0.0.1)

- **Symptom:** paid requests died client-side with `HTTPParserError: Response does not match the HTTP/1.1 protocol`; only when `after-success` was enabled.
- **Root cause:** the middleware's write-buffering/replay of the Express response corrupts the wire format in `@injectivelabs/x402@0.0.1`.
- **Fix:** default `"before"` policy + a **preflight middleware** mounted before the paywall that resolves and caches all data (404s unpaid on bad ids), so the paid handler can no longer fail and charge-on-5xx cannot happen.
- **Rule:** on the money path, prefer making the handler infallible over relying on refund-style policies; pin the guarantee with a test (unpaid bad id → 404, not 402).

## Public Injective testnet RPC: broken per-hash tx index → settlement "fails" after money moved

- **Symptom:** settle submitted the tx, balances changed, Blockscout showed it — but `eth_getTransactionReceipt`/`eth_getTransactionByHash` returned `null` forever, so `waitForTransactionReceipt` timed out and the server reported `payment_settlement_failed` to a client that HAD paid.
- **Root cause:** `k8s.testnet.json-rpc.injective.network` serves blocks and `eth_getBlockReceipts` fine but its hash index is broken.
- **Fix:** `/rpc-shim` in the API: proxies JSON-RPC upstream (3 retries, 5s timeout — undici also hits transient IPv6 connect timeouts there) and recovers null receipt/tx lookups by scanning recent blocks via `eth_getBlockReceipts`. Facilitator, demo client, and MCP all point at the shim.
- **Rule:** verify money-path assumptions against the chain (balances/explorer), not just the RPC answer; when public infra is broken, shim it locally rather than patching the library.

## football-data.org free tier: 10 req/min kills naive discovery loops

- **Symptom:** 429 during the demo after a "walk back 45 days" fixture search.
- **Fix:** one-call `/matches/recent` endpoint (`competitions/WC/matches?status=FINISHED`, cached) + demo picks live → recent. Total demo upstream calls now ≤7/min.
- **Rule:** against rate-limited APIs, never iterate per-day/per-item — find the single bulk endpoint first.

## `.env` is not auto-loaded by Node/tsx

- **Symptom:** user filled `.env`; everything still ran in dry mode.
- **Fix:** `try { process.loadEnvFile(); } catch {}` (Node 20.12+ builtin, no dotenv dep) at every entrypoint.
- **Rule:** any entrypoint that documents `.env` support must load it explicitly — and test with a populated `.env`, not just a clean env.

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

## CSS sibling selectors silently die around JS-injected DOM

- **Symptom:** dashboard "spacing kacau": match-row separators never rendered and an injected section had zero top margin, despite correct-looking CSS.
- **Root cause:** `.match + .match` and `section + section` assume adjacency, but JS renders `<div class="match"><div id="slot-N">` pairs and injects sections as siblings of other divs — the combinators never match. Also `#71717a` text failed 4.5:1 at 12px everywhere it was used, and an invisible 1.07:1 table hover shipped unnoticed.
- **Fix:** `:not(:first-child)` / parent-scoped selectors instead of adjacency; contrast-check every text token against its actual background; impeccable layout audit (isolated sub-agent) caught 16 issues the eye glossed over.
- **Rule:** after any JS render-shape change, re-verify structural CSS selectors against the real DOM (screenshot or DevTools), not the stylesheet; and audit spacing against one 4pt scale — accumulated off-grid values (7px, 9px, 18px) are what "messy" feels like.
