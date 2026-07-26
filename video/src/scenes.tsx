import React from "react";
import {
  Easing,
  Img,
  interpolate,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { Sfx, Voiceover } from "./audio";
import { Pill, Rise, Scene, Sub, Terminal, type TermLine } from "./components";
import { Backdrop, Cursor, DrawPath, Pop, WordReveal } from "./motion";
import { EASE_OUT, T } from "./theme";

/* ───────────────────────── 1 · Title ───────────────────────── */

export const TitleScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const drop = spring({ frame, fps, config: { damping: 9, mass: 0.8 } });
  return (
    <Scene>
      <Backdrop />
      <Voiceover id="title" />
      <Sfx file="whip" at={2} volume={0.35} />
      <Sfx file="switch" at={64} volume={0.3} />
      <Sfx file="switch" at={72} volume={0.3} />
      <Sfx file="switch" at={80} volume={0.3} />
      <Sfx file="switch" at={88} volume={0.3} />
      <div
        style={{
          fontSize: 56,
          fontWeight: 600,
          display: "flex",
          alignItems: "center",
          gap: 20,
          translate: `0px ${(1 - drop) * -220}px`,
        }}
      >
        <span style={{ display: "inline-block", scale: `${1 + (1 - drop) * 0.3} ${0.8 + drop * 0.2}` }}>⚽</span>
        GoalOracle<span style={{ color: T.muted, fontWeight: 400 }}> · World Cup 2026</span>
      </div>
      <WordReveal text="World Cup data for AI agents. No API keys — agents pay per call." from={12} />
      <Sub from={44}>
        Free live scores, fixtures and standings. Premium analytics behind an x402 USDC paywall, settled on Injective
        EVM testnet.
      </Sub>
      <div style={{ display: "flex", gap: 24 }}>
        {["x402", "USDC CCTP", "MCP Server", "Agent Skills"].map((p, i) => (
          <Pop key={p} from={64 + i * 8}>
            <Pill>{p}</Pill>
          </Pop>
        ))}
      </div>
    </Scene>
  );
};

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
const LINE_START = 40;
const PER_LINE = 42;
const SETTLED_AT = LINE_START + 9 * PER_LINE;

export const TerminalScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const enter = spring({ frame: frame - 10, fps, config: { damping: 16 } });
  // border flashes white when the payment settles
  const flash = interpolate(frame, [SETTLED_AT, SETTLED_AT + 6, SETTLED_AT + 40], [0, 1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  return (
    <Scene>
      <Backdrop drift={1.6} />
      <Voiceover id="terminal" />
      <Sfx file="mouse-click" at={LINE_START} volume={0.45} />
      <Sfx file="switch" at={LINE_START + 6 * PER_LINE} volume={0.4} />
      <Sfx file="ding" at={SETTLED_AT} volume={0.5} />
      <WordReveal text="One command. The agent pays for its own data." fontSize={84} maxWidth={1600} />
      <div
        style={{
          transform: `perspective(1400px) rotateX(${(1 - enter) * 14}deg)`,
          opacity: enter,
          outline: flash > 0.02 ? `${Math.round(3 * flash)}px solid ${T.fg}` : "none",
          outlineOffset: 6,
          borderRadius: 16,
        }}
      >
        <Terminal lines={DEMO_LINES} from={LINE_START} framesPerLine={PER_LINE} fontSize={29} />
      </div>
    </Scene>
  );
};

/* ───────────────────────── 3 · Dashboard (continuous camera over real captures) ───────────────────────── */

const SHOTS = ["shot-initial.png", "shot-trace.png", "shot-analysis.png"] as const;
const CAPTIONS = [
  "Live matches and standings — free for everyone",
  "The x402 trace runs in the open",
  "Settled on-chain — probabilities, form, expected goals",
] as const;
// Image swaps happen mid-camera-move so the crossfade is masked by motion.
const SWAP_1 = 140;
const SWAP_2 = 352;

export const DashboardScene: React.FC = () => {
  const frame = useCurrentFrame();
  const idx = frame < SWAP_1 ? 0 : frame < SWAP_2 ? 1 : 2;
  const local = frame - [0, SWAP_1, SWAP_2][idx]!;
  const ease = Easing.bezier(...EASE_OUT);
  // one continuous camera: overview → dive into the trace → pan down to the analysis
  const s = interpolate(frame, [120, 190], [1, 2], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: ease });
  const tx = interpolate(frame, [120, 190], [0, -617], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: ease });
  const ty = interpolate(frame, [120, 190, 320, 380], [0, -227, -227, -471], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: ease,
  });
  return (
    <Scene>
      <Backdrop drift={0.7} />
      <Voiceover id="dashboard" />
      <Sfx file="mouse-click" at={100} volume={0.5} />
      <Sfx file="whoosh" at={120} volume={0.4} />
      <Sfx file="ding" at={358} volume={0.45} />
      <Rise>
        <div
          style={{
            width: 1560,
            height: 780,
            border: `2px solid ${T.border}`,
            borderRadius: 16,
            overflow: "hidden",
            backgroundColor: T.surface,
            position: "relative",
          }}
        >
          {SHOTS.map((shot, i) => (
            <Img
              key={shot}
              src={staticFile(shot)}
              style={{
                position: "absolute",
                width: 1560,
                left: 0,
                top: 0,
                transformOrigin: "0 0",
                scale: String(s),
                translate: `${tx}px ${ty}px`,
                display: "block",
                opacity:
                  i === 0
                    ? 1
                    : interpolate(frame, [(i === 1 ? SWAP_1 : SWAP_2) - 6, (i === 1 ? SWAP_1 : SWAP_2) + 6], [0, 1], {
                        extrapolateLeft: "clamp",
                        extrapolateRight: "clamp",
                      }),
              }}
            />
          ))}
          {frame < 134 ? (
            <Cursor
              path={[
                { x: 1250, y: 640, at: 26 },
                { x: 1005, y: 120, at: 86 },
              ]}
              clickAt={100}
            />
          ) : null}
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
          opacity: interpolate(local, [0, 14], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }),
        }}
      >
        {CAPTIONS[idx]}
      </p>
    </Scene>
  );
};

/* ───────────────────────── 4 · Agents (MCP + Skills, real session) ───────────────────────── */

const TOOL_CALLS = [
  { name: "get_wallet_status", result: "19.9 USDC on eip155:1439" },
  { name: "get_live_matches", result: "match 2001 · ARG 1–1 FRA · 67'" },
  { name: "get_match_prediction", result: "paid 0.02 USDC autonomously" },
] as const;

export const AgentScene: React.FC = () => {
  const frame = useCurrentFrame();
  return (
    <Scene>
      <Backdrop drift={1.2} />
      <Voiceover id="agents" />
      <WordReveal text="8 MCP tools. 3 Agent Skills. Real autonomy." fontSize={84} maxWidth={1500} />
      <Pop from={26} overshoot={false}>
        <div
          style={{
            backgroundColor: T.fg,
            color: T.bg,
            borderRadius: 20,
            padding: "24px 36px",
            fontSize: 36,
            fontWeight: 500,
            maxWidth: 1200,
          }}
        >
          “Buy me a prediction for the live Argentina match”
        </div>
      </Pop>
      <div style={{ display: "flex", flexDirection: "column", gap: 18, width: 1200 }}>
        {TOOL_CALLS.map((t, i) => {
          const at = 50 + i * 30;
          return (
            <React.Fragment key={t.name}>
              <Sfx file="switch" at={at} volume={0.3} />
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 20,
                  opacity: interpolate(frame, [at, at + 16], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }),
                  translate: `${interpolate(frame, [at, at + 16], [-60, 0], {
                    extrapolateLeft: "clamp",
                    extrapolateRight: "clamp",
                    easing: Easing.bezier(...EASE_OUT),
                  })}px 0px`,
                }}
              >
                <span
                  style={{
                    fontFamily: T.mono,
                    fontSize: 30,
                    fontWeight: 600,
                    backgroundColor: T.surface,
                    border: `2px solid ${T.border}`,
                    borderRadius: 10,
                    padding: "12px 20px",
                  }}
                >
                  {t.name}
                </span>
                <span style={{ fontFamily: T.mono, fontSize: 30, color: T.muted }}>{t.result}</span>
              </div>
            </React.Fragment>
          );
        })}
        <Sfx file="ding" at={146} volume={0.45} />
        <div
          style={{
            fontFamily: T.mono,
            fontSize: 32,
            fontWeight: 600,
            opacity: interpolate(frame, [146, 162], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }),
          }}
        >
          ✔ settled · tx 0x862b0890…b57d71
        </div>
      </div>
      <Rise from={178}>
        <p style={{ fontSize: 40, color: T.muted, fontStyle: "italic", margin: 0, textAlign: "center", maxWidth: 1400 }}>
          “France 45%, draw 28% — a statistical estimate, not betting advice.”
        </p>
      </Rise>
    </Scene>
  );
};

/* ───────────────────────── 5 · CCTP (animated bridge diagram) ───────────────────────── */

const BRIDGE = "M 260 340 C 560 80, 1360 80, 1660 340";

const bridgePoint = (t: number) => {
  const p0 = { x: 260, y: 340 };
  const p1 = { x: 560, y: 80 };
  const p2 = { x: 1360, y: 80 };
  const p3 = { x: 1660, y: 340 };
  const u = 1 - t;
  return {
    x: u * u * u * p0.x + 3 * u * u * t * p1.x + 3 * u * t * t * p2.x + t * t * t * p3.x,
    y: u * u * u * p0.y + 3 * u * u * t * p1.y + 3 * u * t * t * p2.y + t * t * t * p3.y,
  };
};

export const CctpScene: React.FC = () => {
  const frame = useCurrentFrame();
  const coinT = interpolate(frame, [70, 190], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.bezier(0.45, 0, 0.25, 1),
  });
  const coin = bridgePoint(coinT);
  const STEPS = ["depositForBurn on Sepolia", "Circle attestation", "mint on Injective · domain 29"];
  return (
    <Scene>
      <Backdrop drift={0.8} />
      <Voiceover id="cctp" />
      <Sfx file="whoosh" at={70} volume={0.4} />
      <Sfx file="ding" at={192} volume={0.5} />
      <WordReveal text="Empty wallet? Bridge it with Circle CCTP." fontSize={84} maxWidth={1500} />
      <div style={{ position: "relative", width: 1920, height: 470 }}>
        <svg width={1920} height={470} style={{ position: "absolute", inset: 0 }}>
          <DrawPath d={BRIDGE} from={30} duration={45} stroke={T.decor} strokeWidth={5} />
          {coinT > 0 && coinT < 1 ? (
            <g style={{ translate: `${coin.x}px ${coin.y}px` }}>
              <circle r={34} fill={T.fg} />
              <text textAnchor="middle" dy={12} fontSize={34} fontWeight={700} fill={T.bg} fontFamily={T.sans}>
                $
              </text>
            </g>
          ) : null}
        </svg>
        {[
          { label: "Ethereum Sepolia", sub: "USDC burned", x: 260 },
          { label: "Injective testnet", sub: "native USDC minted", x: 1660 },
        ].map((n, i) => (
          <Pop
            key={n.label}
            from={16 + i * 10}
            overshoot={false}
            style={{ position: "absolute", left: n.x - 210, top: 320, width: 420 }}
          >
            <div
              style={{
                backgroundColor: T.surface,
                border: `2px solid ${i === 1 && coinT >= 1 ? T.fg : T.border}`,
                borderRadius: 16,
                padding: "28px 24px",
                textAlign: "center",
              }}
            >
              <div style={{ fontSize: 36, fontWeight: 600 }}>{n.label}</div>
              <div style={{ fontSize: 26, color: T.muted, marginTop: 6 }}>{n.sub}</div>
            </div>
          </Pop>
        ))}
        <div style={{ position: "absolute", left: 0, right: 0, top: 120, display: "flex", justifyContent: "center", gap: 20 }}>
          {STEPS.map((s, i) => {
            const at = 60 + i * 44;
            return (
              <span
                key={s}
                style={{
                  fontFamily: T.mono,
                  fontSize: 27,
                  color: T.muted,
                  border: `2px solid ${T.border}`,
                  borderRadius: 999,
                  padding: "12px 24px",
                  backgroundColor: T.bg,
                  opacity: interpolate(frame, [at, at + 14], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }),
                }}
              >
                {i + 1} · {s}
              </span>
            );
          })}
        </div>
      </div>
    </Scene>
  );
};

/* ───────────────────────── 6 · Outro ───────────────────────── */

export const OutroScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const logo = spring({ frame: frame - 4, fps, config: { damping: 10, mass: 0.8 } });
  const ring = interpolate(frame, [10, 60], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  return (
    <Scene>
      <Backdrop drift={0.5} />
      <Voiceover id="outro" />
      <Sfx file="whip" at={4} volume={0.35} />
      <div style={{ position: "relative", display: "flex", alignItems: "center", justifyContent: "center" }}>
        {ring > 0 && ring < 1 ? (
          <div
            style={{
              position: "absolute",
              width: 700 * ring,
              height: 700 * ring,
              borderRadius: 999,
              border: `3px solid ${T.secondary}`,
              opacity: 1 - ring,
            }}
          />
        ) : null}
        <div
          style={{
            fontSize: 120,
            fontWeight: 700,
            letterSpacing: "-0.02em",
            scale: String(0.5 + 0.5 * logo),
            opacity: logo,
          }}
        >
          ⚽ GoalOracle
        </div>
      </div>
      <Sub from={20}>An x402-gated sports oracle any agent can use today.</Sub>
      <Pop from={40} overshoot={false}>
        <div style={{ fontFamily: T.mono, fontSize: 42, color: T.fg, textAlign: "center", lineHeight: 2 }}>
          <div>github.com/wildanre/goaloracle</div>
          <div style={{ color: T.muted }}>goaloracle-kappa.vercel.app</div>
        </div>
      </Pop>
      <Rise from={62}>
        <p style={{ fontSize: 30, color: T.muted, margin: 0 }}>
          Statistical estimates, not betting advice · Injective EVM testnet
        </p>
      </Rise>
    </Scene>
  );
};
