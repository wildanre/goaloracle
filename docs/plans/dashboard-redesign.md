# Plan: Dashboard redesign (impeccable)

Anchor: PRODUCT.md (register: product; single-file vanilla HTML; screenshot-friendly 1280×800; 30s refresh without jank).

## Process

1. Build 3 direction probes as **standalone static HTML mockups** in `docs/design/` with identical realistic content (ARG–FRA live 67' 1–1, ENG–MEX 0–0 23', groups A/B standings, bought-analysis panel with probabilities + tx receipt). danu picks in the browser (per memory: never chat menus).
2. Winner gets implemented into `public/index.html` (real fetch logic from current version + new visual system), verified in the browser against the live API, then deployed.
3. Codify: final tokens/decisions appended to this plan; lessons to docs/LEARNINGS.md.

## Directions

- **A — Broadcast Scorebug** (dark, committed color): TV football graphics; giant tabular numerals, pulsing LIVE, pitch-undertone near-black + one hot signal accent. Anchors: ESPN scorebug, Sky Sports, stadium LED.
- **B — Oracle Terminal** (dark, restrained+phosphor): the agent's-eye console; monospace everything, x402 flow rendered as a payment log, dense data rows. Anchors: Bloomberg Terminal, htop.
- **C — Match-day Editorial** (light, restrained+ink red): newspaper sports front page; serif display headlines, chroma-0 white, hairline-ruled tables. Anchors: The Athletic, L'Équipe.

## Guardrails (impeccable)

- Contrast ≥4.5:1 body; no gradient text, no side-stripe accents, no glassmorphism, no eyebrow-caps-on-every-section, no cream default.
- Product register: one type family per direction ok; motion 150–250ms state-only; tabular-nums for scores; `prefers-reduced-motion` honored.
- Mockups share content but differ in hierarchy/topology/typography, not palette alone.

## Outcome (codified 2026-07-26)

Winner: none of the three probes — danu redirected to a strict brief: shadcn dark, near-monochrome, no gradients/alpha. Shipped system:

- Tokens: shadcn new-york zinc dark, solid hex only (`#09090b` bg / `#131316` card / `#18181b` surface / `#27272a` border / `#fafafa` fg / `#a1a1aa` muted). Primary = white-on-dark. Zero accent hues.
- Type: Geist (UI) + Geist Mono (every numeral: scores, minutes, prices, tx, timestamps). Verdict 17px is the only display moment.
- Signature: inline x402 payment trace — buy button expands into a mono step log (GET → 402 quote → EIP-3009 → settling → settled·tx) before the analysis card renders. Product story as UI.
- Layout: match ROWS (not card grids), Recent results backfill, right rail standings tables, sticky footer, skeleton + designed empty/error states, full mobile stack ≤640px.
- Verified via Playwright: desktop, real on-chain buy (tx 0x446c…0d9d settled during test), mobile 390px.
- Rules honored: no gradient, no alpha colors, no layout-property animation (scaleX bars), reduced-motion fallbacks, focus-visible rings.
