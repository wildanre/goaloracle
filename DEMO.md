# DEMO.md — 90-second video script

Every command works on a clean clone with zero env vars (mock data + x402 dry mode). With funded testnet keys, step 3 settles real USDC on Injective EVM testnet.

## 0:00 — 0:15 · The pitch

> "GoalOracle gives AI agents live World Cup data free, and premium analytics behind an x402 USDC paywall on Injective — no API keys, agents pay per call."

Screen: README architecture diagram.

## 0:15 — 0:35 · One command, whole product

```bash
pnpm i && pnpm demo
```

Narrate while it scrolls: free live scores print; then the x402 client hits the premium endpoint, shows the **HTTP 402** challenge (network `eip155:1439`, USDC asset, price), and the payment flow.

## 0:35 — 0:55 · The dashboard

Open http://localhost:3900 (while demo runs) or `pnpm api` → http://localhost:3000.

Click **“Buy analysis · $0.01”** on the live Argentina–France match → win-probability bar + key factors + payment/dry-run status render. Screenshot moment. 📸

## 0:55 — 1:15 · Agents use it via MCP + Skills

Show `.mcp.json` (in repo), then in Claude Code:

> "What's live in the World Cup right now?" → `get_live_matches`
> "Buy me an analysis of match 2001" → `get_match_analysis` pays $0.01 via x402 autonomously (with `AGENT_PRIVATE_KEY` set; otherwise it explains how to fund — that's the x402-payer skill).

Mention: three Agent Skills ship in `skills/`.

## 1:15 — 1:30 · Cross-chain funding + close

```bash
pnpm cctp --dry-run
```

> "Agents fund their own wallet cross-chain: Circle CCTP burns USDC on Sepolia, mints native USDC on Injective — domain 29. Free data, paid analytics, autonomous payments: an x402-gated sports oracle any agent can use today."

## Funded-keys variant (for the settlement shot)

```bash
export AGENT_PRIVATE_KEY=0x…      # holds testnet USDC (faucet.circle.com → Injective testnet)
export FACILITATOR_PRIVATE_KEY=0x… # holds INJ gas (testnet.faucet.injective.network)
pnpm demo                          # step 2 now settles on-chain and prints the tx + explorer link
```
