import React from "react";
import { AbsoluteFill, Easing, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { EASE_OUT, T } from "./theme";

/** Animated backdrop: drifting dot grid + slowly rotating pitch circle. Solid colors only. */
export const Backdrop: React.FC<{ drift?: number }> = ({ drift = 1 }) => {
  const frame = useCurrentFrame();
  const dots: React.ReactNode[] = [];
  const GAP = 120;
  for (let x = 0; x <= 1920 + GAP; x += GAP) {
    for (let y = 0; y <= 1080 + GAP; y += GAP) {
      dots.push(
        <circle key={`${x}-${y}`} cx={x} cy={y} r={2.5} fill={T.secondary} />,
      );
    }
  }
  const shift = (frame * 0.1 * drift) % GAP;
  return (
    <AbsoluteFill style={{ overflow: "hidden" }}>
      <svg
        width={1920 + GAP}
        height={1080 + GAP}
        style={{ position: "absolute", left: -shift, top: -shift * 0.6, opacity: 0.55 }}
      >
        {dots}
      </svg>
      {/* pitch center-circle motif, slow rotation */}
      <svg
        width={900}
        height={900}
        viewBox="0 0 900 900"
        style={{
          position: "absolute",
          right: -260,
          top: -260,
          opacity: 0.5,
          rotate: `${frame * 0.03}deg`,
        }}
      >
        <circle cx={450} cy={450} r={340} fill="none" stroke={T.secondary} strokeWidth={3} />
        <circle cx={450} cy={450} r={220} fill="none" stroke={T.secondary} strokeWidth={2} strokeDasharray="14 18" />
        <circle cx={450} cy={450} r={8} fill={T.secondary} />
        <line x1={110} y1={450} x2={790} y2={450} stroke={T.secondary} strokeWidth={2} />
      </svg>
    </AbsoluteFill>
  );
};

/** Headline that reveals word by word: rise + un-blur, spring-settled. */
export const WordReveal: React.FC<{
  text: string;
  from?: number;
  perWord?: number;
  fontSize?: number;
  maxWidth?: number;
}> = ({ text, from = 0, perWord = 4, fontSize = 96, maxWidth = 1560 }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const words = text.split(" ");
  return (
    <h1
      style={{
        fontSize,
        fontWeight: 700,
        letterSpacing: "-0.02em",
        margin: 0,
        textAlign: "center",
        maxWidth,
        lineHeight: 1.1,
        display: "flex",
        flexWrap: "wrap",
        justifyContent: "center",
        columnGap: "0.28em",
        rowGap: "0.05em",
      }}
    >
      {words.map((w, i) => {
        const start = from + i * perWord;
        const s = spring({ frame: frame - start, fps, config: { damping: 16, mass: 0.6 } });
        return (
          <span
            key={i}
            style={{
              display: "inline-block",
              opacity: interpolate(s, [0, 0.4], [0, 1], { extrapolateRight: "clamp" }),
              translate: `0px ${(1 - s) * 46}px`,
              filter: `blur(${(1 - s) * 8}px)`,
            }}
          >
            {w}
          </span>
        );
      })}
    </h1>
  );
};

/** Spring pop-in for any element. */
export const Pop: React.FC<{
  from?: number;
  children: React.ReactNode;
  overshoot?: boolean;
  style?: React.CSSProperties;
}> = ({ from = 0, children, overshoot = true, style }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const s = spring({
    frame: frame - from,
    fps,
    config: overshoot ? { damping: 11, mass: 0.7 } : { damping: 20 },
  });
  return (
    <div style={{ opacity: Math.min(1, s * 2), scale: String(0.6 + 0.4 * s), ...style }}>
      {children}
    </div>
  );
};

/** Counter that ticks up to a value. */
export const CountUp: React.FC<{ to: number; from?: number; duration?: number; suffix?: string }> = ({
  to,
  from = 0,
  duration = 30,
  suffix = "%",
}) => {
  const frame = useCurrentFrame();
  const v = interpolate(frame, [from, from + duration], [0, to], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.bezier(...EASE_OUT),
  });
  return <span>{Math.round(v)}{suffix}</span>;
};

/** Fake pointer that glides to a target and clicks (ripple ring). */
export const Cursor: React.FC<{
  path: { x: number; y: number; at: number }[];
  clickAt?: number;
}> = ({ path, clickAt }) => {
  const frame = useCurrentFrame();
  const xs = path.map((p) => p.at);
  const x = interpolate(frame, xs, path.map((p) => p.x), {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.bezier(0.4, 0, 0.2, 1),
  });
  const y = interpolate(frame, xs, path.map((p) => p.y), {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.bezier(0.4, 0, 0.2, 1),
  });
  const clickS = clickAt === undefined ? 0 : interpolate(frame, [clickAt, clickAt + 18], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const press = clickAt === undefined ? 1 : interpolate(frame, [clickAt - 4, clickAt, clickAt + 6], [1, 0.82, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  return (
    <div style={{ position: "absolute", left: x, top: y, pointerEvents: "none" }}>
      {clickS > 0 && clickS < 1 ? (
        <div
          style={{
            position: "absolute",
            left: -28 * clickS,
            top: -28 * clickS,
            width: 56 * clickS,
            height: 56 * clickS,
            borderRadius: 999,
            border: `3px solid ${T.fg}`,
            opacity: 1 - clickS,
          }}
        />
      ) : null}
      <svg width={34} height={34} viewBox="0 0 24 24" style={{ scale: String(press), filter: "drop-shadow(0 2px 6px #000)" }}>
        <path d="M5 3l14 8-6.5 1.5L9 19z" fill={T.fg} stroke={T.bg} strokeWidth={1.5} />
      </svg>
    </div>
  );
};

/** Draws an SVG path over time (pathLength trick). */
export const DrawPath: React.FC<{
  d: string;
  from?: number;
  duration?: number;
  stroke?: string;
  strokeWidth?: number;
}> = ({ d, from = 0, duration = 40, stroke = T.muted, strokeWidth = 4 }) => {
  const frame = useCurrentFrame();
  const p = interpolate(frame, [from, from + duration], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.bezier(...EASE_OUT),
  });
  return (
    <path
      d={d}
      fill="none"
      stroke={stroke}
      strokeWidth={strokeWidth}
      pathLength={1}
      strokeDasharray={1}
      strokeDashoffset={1 - p}
      strokeLinecap="round"
    />
  );
};
