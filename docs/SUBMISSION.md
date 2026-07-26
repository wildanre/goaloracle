# GoalOracle — Submission

**World Cup data for AI agents. No API keys — agents pay per call.**

## Links

| | |
|---|---|
| 🔗 GitHub repository | https://github.com/wildanre/goaloracle |
| 🌐 Live product | https://goaloracle-kappa.vercel.app |
| 🎥 Demo video + announcement | https://x.com/danuste10/status/2081300064832803013 |
| 📄 Demo script | [DEMO.md](../DEMO.md) |

## Overview

AI agents can't sign up for sports data APIs — subscriptions, API keys, and manual onboarding all assume a human. GoalOracle solves this for the 2026 World Cup with an **agent-native data oracle**:

- **Free tier** — live scores, fixtures, and group standings for anyone: plain HTTP, an MCP server, or the dashboard. No key, no account.
- **Premium tier** — deterministic match analytics (Poisson win probabilities, expected goals, form indices, head-to-head) priced at $0.01–$0.02 per call behind an **x402 paywall**: the server answers HTTP 402 with a quote, the agent signs a gasless EIP-3009 USDC authorization, and the payment settles on **Injective EVM testnet** with a verifiable transaction hash.

Every analysis in our demo material was bought by a wallet, not an API key — the settlement tx is visible in each screenshot and in the video. Our model priced Spain at **79%** before the final (Spain won 1–0) and **84%** in their semifinal (won 2–0).

All analytics are framed as statistical estimates, never betting advice. Testnet only — mainnet values are refused at startup.

## How the four Injective technologies are used

1. **x402** — premium endpoints are mounted behind `injectivePaymentMiddleware` from the official `@injectivelabs/x402` package; the demo client, dashboard, and MCP paid tools use `createInjectiveClient` for the automatic 402 → sign → settle → 200 flow. A preflight layer guarantees a payer is never charged for a failing request, and a local JSON-RPC shim works around the public testnet RPC's broken tx-hash index.
2. **USDC CCTP** — `scripts/fund-wallet-cctp.ts` funds the agent wallet cross-chain: `depositForBurn` on Ethereum Sepolia → Circle attestation → `receiveMessage` mints native USDC on Injective (destination domain 29). `--dry-run` prints the full plan.
3. **MCP Server** — `packages/mcp-server` exposes 8 stdio tools (5 free, 2 paid via autonomous x402 payment, 1 wallet status). Verified end-to-end: a headless Claude session checked its own wallet, paid $0.02, and reported the probabilities honestly.
4. **Agent Skills** — three SKILL.md files (`world-cup-analyst`, `match-predictor`, `x402-payer`) teach any agent the tool routing, the check-wallet-then-buy workflow, and funding/troubleshooting. A test pins every tool name in the skills to the real MCP registrations, so they can't drift.

## Repository structure

```
packages/api         Express API — free endpoints + x402-gated premium, rpc-shim, preflight
packages/mcp-server  stdio MCP server (8 tools, autonomous payment)
packages/data        football-data.org provider + bundled mock (zero-config demo)
packages/analysis    pure deterministic Poisson analytics engine
skills/              3 Agent Skills (auto-loaded via .claude/skills for Claude Code users)
scripts/             demo orchestrator · x402 demo client · CCTP funding script
public/              single-file dashboard (shadcn zinc dark, live x402 payment trace)
video/               Remotion demo video project (motion graphics, ElevenLabs voiceover)
docs/                plans, learnings log, submission assets
```

## Try it

```bash
pnpm i && pnpm demo     # clean machine, zero env vars: mock data + x402 dry mode
```

With funded testnet keys in `.env`, the same command settles real USDC on Injective and prints the explorer link. Full setup, API reference, and MCP install snippet are in the [README](../README.md).

Quality gates: 36 tests, `tsc --noEmit` clean, verified real on-chain settlements through the API, dashboard, MCP tools, and the deployed Vercel instance.
