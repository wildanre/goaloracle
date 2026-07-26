# GoalOracle

World Cup 2026 live data for AI agents — free tier + premium analytics behind an x402 USDC paywall settled on Injective EVM testnet.

## Register

product — the dashboard is a working tool (live scores, standings, paid analysis), but it doubles as the project's public face for hackathon judges and X-post screenshots. Design serves the data; one memorable visual signature is welcome.

## Platform

web — single-file vanilla HTML/CSS/JS dashboard (`public/index.html`), served by Express locally and by Vercel statically in production. No build step, no framework: keep it that way.

## Audience

- Hackathon judges skimming the live demo for ~60 seconds on a laptop
- Developers evaluating the API/MCP server before wiring their agent to it
- Football-fan devs watching live scores while their agent buys analytics

## Jobs

1. Show live matches (score, minute) and group standings at a glance, auto-refreshing.
2. Let a human trigger the x402 payment flow ("Buy analysis") and see the win-probability result plus the on-chain receipt — the product's money shot.
3. Communicate the free-vs-paid split and the Injective/USDC story without reading the README.

## Content truths

- 0–2 live matches typically; up to ~8 fixtures a day; 2+ standings groups of 4 rows.
- Analysis result: verdict sentence, 3 probabilities summing to 1, expected goals, 4 key factors, optional tx hash.
- Dry-run mode (no wallet) must look intentional, not broken.
- All analytics copy is statistical-estimate framing — never betting language.

## Constraints

- Single file, no external requests (fonts/CDNs allowed but keep total weight sane; page must work offline-ish against local API).
- Screenshot-friendly at 1280×800 and readable on a phone.
- Live region updates every 30s must not jank or reflow the page.
