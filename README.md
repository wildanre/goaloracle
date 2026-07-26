# ⚽ GoalOracle

**World Cup 2026 live data for AI agents — free MCP tools + premium analytics behind an x402 USDC paywall settled on Injective EVM testnet.**

GoalOracle gives any AI agent (Claude, Cursor, custom frameworks) live 2026 World Cup data — scores, fixtures, standings, head-to-head — for free, with no API key and no signup. Premium AI-grade analytics (form indices, Poisson expected goals, win probabilities, predictions) sit behind an **x402 micropayment paywall**: the agent gets an HTTP 402 quote, signs a gasless EIP-3009 USDC authorization, and the payment settles on **Injective EVM testnet** — pay-per-call, no account, no subscription.

Humans use the same stack through a bundled dashboard and a plain HTTP API; agents use the MCP server and the shipped Agent Skills, which teach them when to call which tool, how to check their wallet, and how to fund it cross-chain with **Circle CCTP**. Analytics are deterministic statistical estimates — never betting advice.

## Architecture

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
│  ├─ FootballDataProvider (football-data.org, free tier) │
│  └─ MockProvider (bundled realistic WC2026 fixtures —   │
│      used when no API token; keeps the demo alive)      │
├─────────────────────────────────────────────────────────┤
│  packages/analysis                                      │
│  Deterministic analytics engine (no LLM dependency):    │
│  form index, goal expectancy (Poisson), win probability,│
│  H2H trends → structured JSON verdict                   │
├─────────────────────────────────────────────────────────┤
│  skills/  (Agent Skills, SKILL.md format)               │
│    world-cup-analyst · match-predictor · x402-payer     │
├─────────────────────────────────────────────────────────┤
│  scripts/                                               │
│    fund-wallet-cctp.ts  (CCTP v2: Sepolia → Injective)  │
│    demo-x402-client.ts  (402 → pay → 200 demo)          │
└─────────────────────────────────────────────────────────┘
```

## How Injective technologies are used

### x402

Premium endpoints are mounted behind `injectivePaymentMiddleware` from the official [`@injectivelabs/x402`](https://docs.injective.network/developers-ai/x402) package ([`packages/api/src/app.ts`](packages/api/src/app.ts)). An unpaid request returns **HTTP 402** with x402 v2 payment requirements (network `eip155:1439`, testnet USDC, exact price). The client side ([`scripts/demo-x402-client.ts`](scripts/demo-x402-client.ts) and the paid MCP tools) uses `createInjectiveClient` to auto-handle 402 → EIP-3009 sign → retry; settlement happens on Injective EVM testnet and the tx hash is returned in the `PAYMENT-RESPONSE` receipt header. Mainnet values are **refused at startup** ([`packages/api/src/config.ts`](packages/api/src/config.ts)) — this project moves testnet USDC only.

### USDC CCTP

[`scripts/fund-wallet-cctp.ts`](scripts/fund-wallet-cctp.ts) funds the agent wallet cross-chain with Circle CCTP v2: `depositForBurn` on Ethereum Sepolia (destination domain **29** = Injective), poll Circle's attestation API, then `receiveMessage` on Injective testnet to mint native USDC to the agent wallet. `pnpm cctp --dry-run` prints the full step plan without sending anything; the live mode logs burn tx, attestation status, and mint tx.

### MCP Server

`packages/mcp-server` is a stdio MCP server exposing eight tools: **free** — `get_live_matches`, `get_todays_fixtures`, `get_match_detail`, `get_standings`, `get_head_to_head`, `get_wallet_status`; **paid via x402, the agent pays autonomously** — `get_match_analysis` ($0.01), `get_match_prediction` ($0.02). Install (Claude Code `.mcp.json` — the repo ships one — or Claude Desktop `claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "goaloracle": {
      "command": "npx",
      "args": ["tsx", "packages/mcp-server/src/index.ts"],
      "env": { "API_BASE_URL": "http://localhost:3000", "AGENT_PRIVATE_KEY": "0x…optional testnet key" }
    }
  }
}
```

### Agent Skills

Three skills in [`skills/`](skills/) (SKILL.md format, YAML frontmatter) teach agents the product: [`world-cup-analyst`](skills/world-cup-analyst/SKILL.md) (tool routing + match briefings), [`match-predictor`](skills/match-predictor/SKILL.md) (check wallet → buy prediction → explain probabilities honestly), [`x402-payer`](skills/x402-payer/SKILL.md) (funding via faucet/CCTP + x402 troubleshooting). Install by copying a skill folder into your agent's skills directory (e.g. `~/.claude/skills/`) — Claude Code users opening this repo get them automatically via `.claude/skills/`. A test pins every tool name mentioned in the skills to the real MCP registrations, and the workflow is verified end-to-end: a headless agent session following `match-predictor` checked its wallet, bought a prediction via a real x402 settlement (tx on Injective testnet), and presented the probabilities with the required statistical-estimate framing.

## Quickstart

```bash
pnpm i && pnpm demo
```

Zero env vars, zero accounts: the demo starts the API with bundled WC2026 mock data, shows the free tier, runs the x402 client against the live 402 challenge (dry mode without a key), and prints the MCP install snippet. Dashboard at http://localhost:3900 while it runs (`pnpm api` serves it on :3000 permanently).

## Full setup

```bash
cp .env.example .env   # then fill in what you need
```

| Env var | Purpose |
|---|---|
| `FOOTBALL_DATA_TOKEN` | Live data from [football-data.org](https://www.football-data.org/documentation/quickstart) (free tier). Without it: bundled mock data. |
| `AGENT_PRIVATE_KEY` | Demo agent wallet that pays premium calls. Fund with testnet USDC via the [Circle faucet](https://faucet.circle.com) (network “Injective testnet”) or `pnpm cctp`. |
| `FACILITATOR_PRIVATE_KEY` | Wallet that settles x402 payments on-chain (needs INJ gas: [Injective faucet](https://testnet.faucet.injective.network)). Without it: ephemeral key — 402 challenges work, settlement stays dry. |
| `PAY_TO_ADDRESS` | Where premium USDC revenue goes (defaults to the facilitator address). |
| `INJECTIVE_EVM_RPC`, `USDC_ADDRESS`, `PORT`, `X402_FACILITATOR_URL`, `API_BASE_URL`, `SEPOLIA_RPC` | Overrides; sane testnet defaults built in. Mainnet values are refused. |

Run pieces individually: `pnpm api` · `pnpm mcp` · `pnpm demo:client` · `pnpm cctp --dry-run` · `pnpm test` · `pnpm typecheck`.

## API reference

| Endpoint | Price | Description |
|---|---|---|
| `GET /matches/live` | free | Live matches with minute + score |
| `GET /matches/today?date=YYYY-MM-DD` | free | Fixtures for today / a date |
| `GET /matches/:id` | free | One match |
| `GET /standings` | free | Group tables |
| `GET /teams/:id/fixtures` | free | A team's matches |
| `GET /premium/match/:id/analysis` | **$0.01 USDC** | Form, Poisson xG, win probabilities, key factors, verdict |
| `GET /premium/match/:id/prediction` | **$0.02 USDC** | Analysis + most likely score |
| `GET /premium/team/:id/deep-stats` | **$0.01 USDC** | Team stats + recent matches |
| `GET /demo/analyze/:id` | free | Dashboard proxy: pays the premium price with the demo wallet (dry-run without a key) |

Premium prices are quoted in the 402 response in USDC smallest units (6 decimals) on `eip155:1439`.

## Demo video & screenshots

📹 *Demo video: coming with submission — script in [DEMO.md](DEMO.md).*

*Screenshots: dashboard (live matches + standings + paid analysis panel) — see DEMO.md for the capture flow.*

---

MIT — see [LICENSE](LICENSE). Analytics output is statistical estimation for information only, not betting advice.
