import React from "react";
import { Img, interpolate, staticFile, useCurrentFrame } from "remotion";
import { Headline, Pill, Rise, Scene, Sub, Terminal, type TermLine } from "./components";
import { T } from "./theme";

/* ───────────────────────── 1 · Title ───────────────────────── */

export const TitleScene: React.FC = () => (
  <Scene>
    <Rise>
      <div style={{ fontSize: 52, fontWeight: 600 }}>
        ⚽ GoalOracle<span style={{ color: T.muted, fontWeight: 400 }}> · World Cup 2026</span>
      </div>
    </Rise>
    <Headline from={14}>World Cup data for AI agents. No API keys — agents pay per call.</Headline>
    <Sub from={34}>
      Free live scores, fixtures and standings. Premium analytics behind an x402 USDC paywall, settled on Injective EVM
      testnet.
    </Sub>
    <Rise from={54}>
      <div style={{ display: "flex", gap: 24 }}>
        <Pill>x402</Pill>
        <Pill>USDC CCTP</Pill>
        <Pill>MCP Server</Pill>
        <Pill>Agent Skills</Pill>
      </div>
    </Rise>
  </Scene>
);

/* ───────────────────────── 2 · Terminal (pnpm demo, real output) ───────────────────────── */

const DEMO_LINES: TermLine[] = [
  { text: "pnpm demo", tone: "cmd" },
  { text: "1. FREE tier — live matches (no key, no payment)", tone: "dim" },
  { text: "LIVE 67'  Argentina 1 : 1 France", tone: "plain" },
  { text: "LIVE 23'  England 0 : 0 Mexico", tone: "plain" },
  { text: "2. PREMIUM — x402 payment flow (402 → sign → settle → 200)", tone: "dim" },
  { text: "GET /premium/match/2001/analysis", tone: "plain" },
  { text: "HTTP 402 Payment Required", tone: "ok" },
  { text: "  network eip155:1439 · asset USDC · amount 10000 (= $0.01)", tone: "plain" },
  { text: "Paying with agent wallet 0x4ac3…8e33 — signing EIP-3009…", tone: "plain" },
  { text: "✔ Payment settled — HTTP 200", tone: "ok" },
  { text: "  tx 0xe72f528b…c6465d on Injective EVM testnet", tone: "ok" },
  { text: '  verdict: "France are statistical favourites at 45% (draw 28%)"', tone: "plain" },
];

export const TerminalScene: React.FC = () => (
  <Scene>
    <Headline>One command. The agent pays for its own data.</Headline>
    <Rise from={16}>
      <Terminal lines={DEMO_LINES} from={30} framesPerLine={52} />
    </Rise>
  </Scene>
);

/* ───────────────────────── 3 · Dashboard (real screenshots) ───────────────────────── */

const SHOTS = ["shot-initial.png", "shot-trace.png", "shot-analysis.png"] as const;
const CAPTIONS = [
  "Live matches and standings — free for everyone",
  "Buy analysis: the x402 trace runs in the open",
  "Settled on-chain. Probabilities, form, expected goals.",
] as const;

export const DashboardScene: React.FC<{ shotSeconds: number }> = ({ shotSeconds }) => {
  const frame = useCurrentFrame();
  const per = shotSeconds * 30;
  const idx = Math.min(SHOTS.length - 1, Math.floor(frame / per));
  const local = frame - idx * per;
  // Per-shot crop: overview, then zoom into the payment trace, then the analysis.
  // translate is applied after scale (origin 0 0), values in final pixels.
  const crop = [
    { s: 1, tx: 0, ty: 0 },
    { s: 2, tx: -617, ty: -227 },
    { s: 2, tx: -617, ty: -471 },
  ][idx]!;
  return (
    <Scene>
      <Rise>
        <div
          style={{
            width: 1560,
            height: 760,
            border: `2px solid ${T.border}`,
            borderRadius: 16,
            overflow: "hidden",
            backgroundColor: T.surface,
            position: "relative",
          }}
        >
          <Img
            src={staticFile(SHOTS[idx])}
            style={{
              position: "absolute",
              width: 1560,
              left: 0,
              top: 0,
              transformOrigin: "0 0",
              scale: String(crop.s),
              translate: `${crop.tx}px ${crop.ty}px`,
              display: "block",
              opacity: interpolate(local, [0, 10], [0, 1], {
                extrapolateLeft: "clamp",
                extrapolateRight: "clamp",
              }),
            }}
          />
        </div>
      </Rise>
      <p
        key={idx}
        style={{
          fontSize: 44,
          fontWeight: 500,
          color: T.fg,
          margin: 0,
          textAlign: "center",
          opacity: interpolate(local, [0, 14], [0, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          }),
        }}
      >
        {CAPTIONS[idx]}
      </p>
    </Scene>
  );
};

/* ───────────────────────── 4 · Agents (MCP + Skills, real session) ───────────────────────── */

const AGENT_LINES: TermLine[] = [
  { text: 'claude -p "Buy me a prediction for the live Argentina match"', tone: "cmd" },
  { text: "→ get_wallet_status         19.9 USDC on eip155:1439", tone: "plain" },
  { text: "→ get_live_matches          match 2001 · ARG 1–1 FRA · 67'", tone: "plain" },
  { text: "→ get_match_prediction      paid 0.02 USDC autonomously", tone: "plain" },
  { text: "✔ settled · tx 0x862b0890…b57d71", tone: "ok" },
  { text: '"France 45%, draw 28% — a statistical estimate, not betting advice."', tone: "plain" },
];

export const AgentScene: React.FC = () => (
  <Scene>
    <Headline>8 MCP tools. 3 Agent Skills. Real autonomy.</Headline>
    <Sub from={12}>A headless agent followed the match-predictor skill: checked its wallet, paid, reported honestly.</Sub>
    <Rise from={24}>
      <Terminal lines={AGENT_LINES} from={40} framesPerLine={56} fontSize={32} />
    </Rise>
  </Scene>
);

/* ───────────────────────── 5 · CCTP ───────────────────────── */

const CCTP_LINES: TermLine[] = [
  { text: "pnpm cctp --dry-run", tone: "cmd" },
  { text: "1  approve USDC → TokenMessengerV2 on Sepolia", tone: "plain" },
  { text: "2  depositForBurn · destination domain 29 (Injective)", tone: "plain" },
  { text: "3  poll Circle attestation", tone: "plain" },
  { text: "4  receiveMessage → mints native USDC on Injective testnet", tone: "plain" },
  { text: "✔ agent wallet funded cross-chain", tone: "ok" },
];

export const CctpScene: React.FC = () => (
  <Scene>
    <Headline>Empty wallet? Bridge it with Circle CCTP.</Headline>
    <Rise from={14}>
      <Terminal lines={CCTP_LINES} from={26} framesPerLine={34} fontSize={32} width={1360} />
    </Rise>
  </Scene>
);

/* ───────────────────────── 6 · Outro ───────────────────────── */

export const OutroScene: React.FC = () => (
  <Scene>
    <Rise>
      <div style={{ fontSize: 110, fontWeight: 700, letterSpacing: "-0.02em" }}>⚽ GoalOracle</div>
    </Rise>
    <Sub from={14}>An x402-gated sports oracle any agent can use today.</Sub>
    <Rise from={28}>
      <div style={{ fontFamily: T.mono, fontSize: 40, color: T.fg, textAlign: "center", lineHeight: 2 }}>
        <div>github.com/wildanre/goaloracle</div>
        <div style={{ color: T.muted }}>goaloracle-kappa.vercel.app</div>
      </div>
    </Rise>
    <Rise from={40}>
      <p style={{ fontSize: 30, color: T.decor, margin: 0 }}>
        Statistical estimates, not betting advice · Injective EVM testnet
      </p>
    </Rise>
  </Scene>
);
