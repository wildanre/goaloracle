---
name: x402-payer
description: Use when the agent wallet needs funding, an x402 payment fails, or the user asks how GoalOracle's pay-per-call USDC payments work on Injective. Covers CCTP funding (fund-wallet-cctp.ts), the x402 402→pay→200 flow, and troubleshooting.
---

# x402 Payer — funding and payment flow

GoalOracle premium endpoints are paid per-call in USDC on **Injective EVM testnet** (chain id 1439) using the x402 protocol. No API keys, no accounts — a wallet with USDC is the only credential.

## How an x402 payment works

1. Client requests a premium endpoint → server replies **HTTP 402** with payment requirements (network `eip155:1439`, USDC asset `0x0C382e685bbeeFE5d3d9C29e29E341fEE8E84C5d`, amount, payTo).
2. Client signs an **EIP-3009 transferWithAuthorization** for exactly that amount (off-chain signature — the wallet needs no gas).
3. Client retries with the `PAYMENT-SIGNATURE` header; the server verifies, settles the transfer on Injective, and returns **200** plus a `PAYMENT-RESPONSE` receipt header containing the tx hash.

The GoalOracle MCP paid tools and `pnpm demo:client` do all three steps automatically using `AGENT_PRIVATE_KEY`.

## Funding the agent wallet

The wallet needs **USDC on Injective EVM testnet** (payer needs no INJ — the signature is gasless; the API's facilitator pays gas).

Option A — Circle faucet (fastest): https://faucet.circle.com → pick “Injective testnet” → paste the wallet address (see `get_wallet_status`).

Option B — bridge from Ethereum Sepolia via CCTP v2:

```bash
pnpm cctp --dry-run        # print the plan first
pnpm cctp --amount 1       # burn 1 Sepolia USDC → mint on Injective testnet
```

Needs: `AGENT_PRIVATE_KEY` holding Sepolia USDC (same faucet) + a little Sepolia ETH; INJ on Injective testnet for the mint step (https://testnet.faucet.injective.network). The script logs the burn tx, Circle attestation polling, and the mint tx.

## Troubleshooting

| Symptom | Cause → fix |
|---|---|
| Paid tool says "no AGENT_PRIVATE_KEY" | Set `AGENT_PRIVATE_KEY` in the environment of the MCP server / API |
| 402 with `insufficient_funds` | Wallet has < the quoted USDC amount → fund it (above) |
| 402 with `invalid_signature` | Wrong network or USDC address override — the defaults are correct; remove custom `INJECTIVE_EVM_RPC`/`USDC_ADDRESS` |
| Settlement fails / no receipt | The API's facilitator wallet has no INJ gas → fund `FACILITATOR_PRIVATE_KEY`'s address at https://testnet.faucet.injective.network |
| CCTP attestation stuck "pending" | Standard finality takes ~10–20 min on Sepolia — keep polling; the script retries every 15s |
| Anything mentioning mainnet | Refused by design — this project is testnet-only |
