# PRD: GoalOracle — World Cup Live Data MCP Server with x402 Micropayments

> **Hackathon:** Injective Global Cup (deadline: July 26, 2026)
> **Purpose of this document:** Feed this entire file to Claude Code as the build spec. Build in the phase order given. Phase 1–3 are mandatory; Phase 4–5 only if time remains.

---

## 1. One-liner

GoalOracle is an open MCP server + paid HTTP API that gives any AI agent live 2026 World Cup data (scores, fixtures, standings, stats) for free, and premium AI-grade match analytics behind an **x402 USDC paywall settled on Injective EVM** — with **CCTP** to fund agent wallets cross-chain and **Agent Skills** that teach agents how to use it all.

## 2. Problem

AI agents and fan-facing apps need reliable, real-time World Cup data, but sports data APIs require API keys, subscriptions, and manual signup — impossible for autonomous agents. There is no agent-native way to *pay per request* for exactly the data you need. GoalOracle solves this: free tier for basic data, x402 pay-per-call (no API key, no account) for premium analytics, payable in USDC on Injective by humans or agents.

## 3. Why this wins (judging criteria mapping)

| Criterion | How GoalOracle scores |
|---|---|
| Utilization of Injective new tech | Uses ALL FOUR: x402 (paywall), CCTP (funding flow), MCP Server (core product), Agent Skills (shipped in repo) |
| World Cup data integration | Live scores/fixtures/standings are the core dataset |
| Usefulness & clarity | Any agent framework (Claude, Cursor, custom) can consume it today |
| Simplicity & usability | One `npx` command to run the MCP server; one curl to hit the paid API |
| Code structure & docs | Monorepo with clear packages + README per hackathon requirements |
| Future contributions | Generic "x402-gated sports oracle" pattern extends beyond the World Cup |

## 4. Architecture

```
┌─────────────────────────────────────────────────────────┐
│  packages/api  (Express, Node 20, TypeScript)           │
│  ├─ FREE endpoints: /matches/live, /matches/today,      │
│  │   /standings, /teams/:id/fixtures                    │
│  └─ PREMIUM endpoints (x402 middleware, USDC on         │
│      Injective EVM testnet):                            │
│      /premium/match/:id/analysis   ($0.01)              │
│      /premium/match/:id/prediction ($0.02)              │
│      /premium/team/:id/deep-stats  ($0.01)              │
├─────────────────────────────────────────────────────────┤
│  packages/mcp-server  (@modelcontextprotocol/sdk)       │
│  Tools (free, call api internally):                     │
│    get_live_matches, get_todays_fixtures,               │
│    get_match_detail, get_standings, get_head_to_head    │
│  Tools (paid, agent wallet pays via x402):              │
│    get_match_analysis, get_match_prediction             │
│  Tool: get_wallet_status (USDC balance on Injective)    │
├─────────────────────────────────────────────────────────┤
│  packages/data  (provider layer)                        │
│  ├─ FootballDataProvider (football-data.org, free tier, │
│  │   FIFA World Cup competition endpoint)               │
│  └─ MockProvider (bundled realistic WC2026 fixture      │
│      JSON — used when no API token; keeps demo alive)   │
├─────────────────────────────────────────────────────────┤
│  packages/analysis                                      │
│  Deterministic analytics engine (no LLM dependency):    │
│  form index, goal expectancy (Poisson), win probability,│
│  H2H trends, key-player stats → structured JSON verdict │
├─────────────────────────────────────────────────────────┤
│  skills/  (Agent Skills, Anthropic SKILL.md format)     │
│    world-cup-analyst/SKILL.md                           │
│    match-predictor/SKILL.md                             │
│    x402-payer/SKILL.md  (how to fund + pay via          │
│      CCTP → Injective USDC → x402)                      │
├─────────────────────────────────────────────────────────┤
│  scripts/                                               │
│    fund-wallet-cctp.ts  (CCTP v2: burn USDC on ETH      │
│      Sepolia → mint native USDC on Injective testnet)   │
│    demo-x402-client.ts  (client that hits a premium     │
│      endpoint, auto-pays 402 challenge, prints result)  │
└─────────────────────────────────────────────────────────┘
```

## 5. Tech stack (fixed — do not substitute)

- Node.js 20+, TypeScript, pnpm workspaces (monorepo)
- Express 4 for the API
- `@modelcontextprotocol/sdk` for the MCP server (stdio transport)
- x402: follow **https://docs.injective.network/developers-ai/x402** — use the Injective payment middleware (`injectivePaymentMiddleware` or current equivalent from docs) on Express; network = Injective EVM **testnet**; asset = USDC (testnet USDC contract per Injective docs, faucet from Circle)
- x402 client side: official x402 fetch client/axios interceptor per the same docs (auto-handles the 402 → sign → retry flow)
- CCTP: Circle CCTP v2 contracts, script only (no UI) — Sepolia → Injective testnet path per Circle/Injective docs
- Data: football-data.org v4 (`FOOTBALL_DATA_TOKEN` env, free tier) with MockProvider fallback
- viem/ethers for Injective EVM wallet ops
- Zod for input validation everywhere
- Vitest for tests

**Env vars (.env.example must list all):** `FOOTBALL_DATA_TOKEN` (optional), `PAY_TO_ADDRESS`, `AGENT_PRIVATE_KEY` (demo client wallet), `INJECTIVE_EVM_RPC`, `USDC_ADDRESS`, `PORT`.

## 6. Build phases

### Phase 1 — Data core + free API (build first)
1. Scaffold pnpm monorepo with packages above, strict TS, shared tsconfig.
2. `packages/data`: provider interface `{ getLiveMatches(), getFixtures(date), getMatch(id), getStandings(), getH2H(a,b) }`; implement FootballDataProvider + MockProvider (mock JSON: ≥8 realistic WC2026 matches incl. 2 "live" with minute + score, group standings, H2H). Auto-select mock when token missing.
3. `packages/api`: free endpoints listed in §4, JSON responses, zod-validated params, error middleware, 60s in-memory cache.
4. Vitest: provider selection, cache, one endpoint smoke test.

### Phase 2 — Analytics + x402 paywall (the differentiator)
5. `packages/analysis`: pure functions producing `{ formIndexA, formIndexB, expectedGoals: {a,b}, winProbability: {a, draw, b}, keyFactors: string[], verdict: string }`. Poisson model on goals scored/conceded; H2H weighting; deterministic given same input.
6. Mount premium endpoints behind the Injective x402 middleware exactly per the Injective docs (prices in §4, USDC, Injective EVM testnet, payTo = `PAY_TO_ADDRESS`). Unauthenticated request MUST return HTTP 402 with the x402 payment-requirements JSON.
7. `scripts/demo-x402-client.ts`: reads `AGENT_PRIVATE_KEY`, calls a premium endpoint with the x402 client, logs: 402 challenge → payment → 200 body → tx reference. This is the demo-video centerpiece.

### Phase 3 — MCP server + Agent Skills
8. `packages/mcp-server`: stdio MCP server registering the tools in §4. Free tools proxy the free API. Paid tools use the x402 client internally with `AGENT_PRIVATE_KEY` — i.e., **the agent autonomously pays for premium data**. `get_wallet_status` returns USDC balance via RPC.
9. Include a `claude_desktop_config.json` / `.mcp.json` snippet in the README for one-line install.
10. `skills/`: three Agent Skills with proper YAML frontmatter (name, description) + instructions:
    - `world-cup-analyst`: when/how to call GoalOracle tools, how to present a match briefing
    - `match-predictor`: workflow — check wallet → buy prediction via `get_match_prediction` → explain probabilities honestly (no gambling advice framing)
    - `x402-payer`: how to fund the wallet (CCTP script) and how x402 payment flow works, with troubleshooting
11. `scripts/fund-wallet-cctp.ts`: CCTP v2 depositForBurn on Sepolia → receive native USDC on Injective testnet; clear console logging of burn tx, attestation, mint. If the full flow can't run in CI, it must still be complete, documented code with a `--dry-run` mode.

### Phase 4 — Dashboard (only if time remains)
12. Single-file `public/index.html` (vanilla JS + fetch, dark theme): live matches auto-refresh 30s, standings table, a "Buy analysis with USDC" button that calls the demo client via a small `/demo/analyze/:id` proxy endpoint. Screenshot-friendly — this feeds the X-post bonus points.

### Phase 5 — Polish
13. README.md per §7. LICENSE (MIT). `pnpm demo` script that: starts API (mock mode) → runs demo client → prints MCP config snippet.
14. Record demo flow doc `DEMO.md`: exact commands for a 90-second video.

## 7. README requirements (hackathon hard requirement 🔴)

README.md MUST contain, in this order:
1. What GoalOracle does, the World Cup problem it solves, and how users/agents interact with it (2 short paragraphs + architecture diagram from §4)
2. **"How Injective technologies are used"** section with four explicit subsections: **x402** (paywall on premium endpoints, settle on Injective EVM, code pointer), **USDC CCTP** (funding flow, script pointer), **MCP Server** (tool list, install snippet), **Agent Skills** (the three skills, how to install)
3. Quickstart: `pnpm i && pnpm demo` (works with zero external accounts via MockProvider)
4. Full setup: env vars, Circle faucet link, football-data.org token
5. API reference table (endpoint, price, free/paid)
6. Demo video placeholder + screenshots section

## 8. Acceptance criteria (Claude Code: verify each before done)

- [ ] `pnpm i && pnpm demo` runs end-to-end on a clean machine with no env vars (mock data, x402 in test/dry mode if chain unreachable)
- [ ] `GET /premium/match/:id/analysis` without payment returns HTTP **402** with valid x402 payment requirements
- [ ] Demo client completes 402 → pay → 200 against Injective EVM testnet when funded keys are provided
- [ ] MCP server connects from Claude Desktop/Claude Code config and all free tools return data
- [ ] Paid MCP tool triggers a real x402 payment and returns analysis JSON
- [ ] All three SKILL.md files are valid (frontmatter parses) and reference real tool names
- [ ] CCTP script compiles and `--dry-run` prints the full step plan
- [ ] All tests pass; `tsc --noEmit` clean
- [ ] README satisfies §7 completely

## 9. Non-goals

No mainnet money, no betting/odds-market framing (analytics only — present probabilities as statistical estimates, not gambling advice), no user accounts/database, no mobile app, no on-chain smart contract deployment of our own.

## 10. Reference links (use these while building)

- x402 on Injective: https://docs.injective.network/developers-ai/x402
- Injective EVM docs: https://docs.injective.network
- Injective MCP/agent-skills examples: https://github.com/InjectiveLabs
- Circle CCTP: https://developers.circle.com/stablecoins/cctp-getting-started
- Circle testnet faucet: https://faucet.circle.com
- football-data.org API: https://www.football-data.org/documentation/quickstart
- MCP SDK: https://github.com/modelcontextprotocol/typescript-sdk
- Agent Skills format: https://modelcontextprotocol.io/docs/develop/build-with-agent-skills
