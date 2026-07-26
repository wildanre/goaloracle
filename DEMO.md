# DEMO.md — 90-second video script

> A rendered version of this video already exists: `cd video && npx remotion render goaloracle-demo out/goaloracle-demo.mp4` (Remotion project in `video/`, real terminal output + real dashboard captures + on-chain tx hashes). Re-render after any product change, or record live using the script below.

Two terminals + one browser tab. With `.env` filled (funded testnet keys) every payment in this script settles **for real** on Injective EVM testnet and prints a tx hash you can open in Blockscout.

> Tip for the dashboard shots: the 2026 tournament is over, so live data has no in-play matches. Run the API in mock mode (`FOOTBALL_DATA_TOKEN= pnpm api`) to get a live Argentina–France quarter-final at 67' — payments still settle for real; only the football data is the bundled fixture set.

## 0:00 — 0:12 · The pitch

**Narration:**
> "AI agents can't sign up for sports data APIs. GoalOracle gives any agent live World Cup data for free — and premium analytics it can *pay for by itself*: x402 micropayments in USDC, settled on Injective."

**Screen:** README architecture diagram.

## 0:12 — 0:40 · One command: free data + autonomous payment

```bash
pnpm demo
```

**Screen:** let it scroll. Point at, in order:
1. the free tier response (no key, no payment),
2. `HTTP 402 Payment Required` — network `eip155:1439`, USDC asset, price `$0.01`,
3. `Payment settled — HTTP 200` with the **tx hash**,
4. the analysis JSON of the **real 2026 final (Spain 1–0 Argentina)**.

**Narration:**
> "One request hits the paywall — HTTP 402 quotes the price. The agent signs a gasless USDC authorization, retries, and the server settles it on Injective testnet. There's the transaction hash — and the analysis it just bought, for one cent."

Click the explorer link → show the transfer on Blockscout. 📸

## 0:40 — 0:58 · The dashboard

```bash
FOOTBALL_DATA_TOKEN= pnpm api    # mock mode: live matches for the visuals
```

Open http://localhost:3000 → click **"Buy analysis · $0.01"** on Argentina–France (LIVE 67').

**Screen:** win-probability bar renders, `✔ paid — tx 0x…` underneath. 📸 (screenshot for README + X post)

**Narration:**
> "Humans get a dashboard; the buy button runs the same x402 flow with the demo wallet."

## 0:58 — 1:18 · Agents: MCP + Skills

**Screen:** show `.mcp.json`, then in Claude Code:

> *"What's live in the World Cup right now?"* → `get_live_matches`
> *"Buy me an analysis of that match"* → `get_match_analysis` pays $0.01 autonomously, answer includes the tx hash

**Narration:**
> "For agents it's an MCP server — five free tools, two paid ones. The agent checks its own wallet, pays, and explains the probabilities. Three Agent Skills in the repo teach any agent this workflow, including how to fund itself."

## 1:18 — 1:30 · Cross-chain funding + close

```bash
pnpm cctp --dry-run
```

**Screen:** the 5-step plan (burn on Sepolia → attest → mint on Injective, domain 29).

**Narration:**
> "Wallet empty? Circle CCTP bridges USDC from Sepolia to native USDC on Injective. Free data, paid analytics, autonomous payments — an x402 sports oracle any agent can use today. GoalOracle."

---

## Pre-flight checklist (before recording)

```bash
pnpm test && pnpm typecheck   # 36 green, clean
cat .env                      # AGENT_PRIVATE_KEY + FACILITATOR_PRIVATE_KEY + PAY_TO_ADDRESS set
```

- Agent wallet needs ≥ 0.05 USDC (https://faucet.circle.com → "Injective testnet")
- Facilitator wallet needs ≥ 0.1 INJ (https://testnet.faucet.injective.network)
- football-data.org free tier is 10 req/min — don't spam `pnpm demo` back-to-back; wait ~60s between takes
- Keep a Blockscout tab ready: https://testnet.blockscout.injective.network/address/<PAY_TO_ADDRESS> (shows every demo payment arriving)
