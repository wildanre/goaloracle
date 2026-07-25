---
name: match-predictor
description: Use when the user wants a prediction, expected score, or win probability for a 2026 World Cup match. Buys a prediction from the GoalOracle paid MCP tool (get_match_prediction) after checking the agent wallet can afford it.
---

# Match Predictor

Workflow for producing a match prediction with GoalOracle.

## Workflow

1. **Identify the match.** Use `get_live_matches` or `get_todays_fixtures` to find the `matchId`. Never guess ids.
2. **Check the wallet.** Call `get_wallet_status`. The prediction costs **$0.02 USDC** on Injective EVM testnet, paid automatically via x402.
   - If USDC balance < 0.02 or no wallet is configured: tell the user, and point them to funding options — Circle faucet (https://faucet.circle.com, network “Injective testnet”) or the CCTP bridge script (`pnpm cctp`, see the x402-payer skill). Do not retry until funded.
3. **Buy the prediction.** Call `get_match_prediction` with the `matchId`. The x402 payment (402 → sign → settle on Injective) happens automatically; the result includes the settlement receipt with a tx hash.
4. **Explain honestly.** Report:
   - Win/draw/win probabilities as percentages ("Argentina 48%, draw 27%, France 25%").
   - The most likely score and its (usually small) probability — make clear even the single most likely score is unlikely in absolute terms.
   - The drivers: form indices and expected goals from the result's `keyFactors`.
   - The payment: mention the USDC amount paid and the tx hash from `x402Payment`.

## Rules

- These are **statistical estimates from a deterministic Poisson model over recent results** — say so. Never frame output as betting advice, tips, or guaranteed outcomes.
- Do not spend more than the quoted price; the x402 client only signs the exact quoted amount.
- One purchase per match per conversation — results are deterministic, so buying twice wastes USDC.
