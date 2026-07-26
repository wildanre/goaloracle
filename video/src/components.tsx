import React from "react";
import { AbsoluteFill, Easing, interpolate, useCurrentFrame } from "remotion";
import { EASE_OUT, T } from "./theme";

export const Scene: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <AbsoluteFill
    style={{
      backgroundColor: T.bg,
      fontFamily: T.sans,
      color: T.fg,
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      padding: 120,
      gap: 56,
    }}
  >
    {children}
  </AbsoluteFill>
);

/** Fades and rises into its layout slot. */
export const Rise: React.FC<{
  from?: number;
  children: React.ReactNode;
  style?: React.CSSProperties;
}> = ({ from = 0, children, style }) => {
  const frame = useCurrentFrame();
  return (
    <div
      style={{
        opacity: interpolate(frame, [from, from + 24], [0, 1], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
          easing: Easing.bezier(...EASE_OUT),
        }),
        translate: `0px ${interpolate(frame, [from, from + 24], [24, 0], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
          easing: Easing.bezier(...EASE_OUT),
        })}px`,
        ...style,
      }}
    >
      {children}
    </div>
  );
};

export const Headline: React.FC<{ from?: number; children: React.ReactNode }> = ({ from, children }) => (
  <Rise from={from}>
    <h1
      style={{
        fontSize: 96,
        fontWeight: 700,
        letterSpacing: "-0.02em",
        margin: 0,
        textAlign: "center",
        textWrap: "balance",
        maxWidth: 1500,
        lineHeight: 1.08,
      }}
    >
      {children}
    </h1>
  </Rise>
);

export const Sub: React.FC<{ from?: number; children: React.ReactNode }> = ({ from, children }) => (
  <Rise from={from}>
    <p
      style={{
        fontSize: 44,
        fontWeight: 400,
        color: T.muted,
        margin: 0,
        textAlign: "center",
        textWrap: "balance",
        maxWidth: 1400,
        lineHeight: 1.4,
      }}
    >
      {children}
    </p>
  </Rise>
);

export interface TermLine {
  text: string;
  tone?: "cmd" | "dim" | "ok" | "plain";
}

/** Terminal card that reveals lines one at a time. */
export const Terminal: React.FC<{
  lines: TermLine[];
  from?: number;
  framesPerLine?: number;
  width?: number;
  fontSize?: number;
}> = ({ lines, from = 0, framesPerLine = 14, width = 1480, fontSize = 30 }) => {
  const frame = useCurrentFrame();
  const shown = Math.max(0, Math.floor((frame - from) / framesPerLine) + 1);
  const color = (tone?: TermLine["tone"]) =>
    tone === "ok" ? T.fg : tone === "dim" ? T.decor : tone === "cmd" ? T.fg : T.muted;
  return (
    <div
      style={{
        width,
        backgroundColor: T.surface,
        border: `2px solid ${T.border}`,
        borderRadius: 16,
        overflow: "hidden",
      }}
    >
      <div
        style={{
          display: "flex",
          gap: 12,
          padding: "20px 24px",
          borderBottom: `2px solid ${T.border}`,
        }}
      >
        {[0, 1, 2].map((i) => (
          <div key={i} style={{ width: 16, height: 16, borderRadius: 8, backgroundColor: T.secondary }} />
        ))}
      </div>
      <div style={{ padding: 36, fontFamily: T.mono, fontSize, lineHeight: 1.75 }}>
        {lines.slice(0, shown).map((l, i) => (
          <div key={i} style={{ color: color(l.tone), fontWeight: l.tone === "ok" || l.tone === "cmd" ? 600 : 400, whiteSpace: "pre-wrap" }}>
            {l.tone === "cmd" ? <span style={{ color: T.decor }}>$ </span> : null}
            {l.text}
          </div>
        ))}
      </div>
    </div>
  );
};

export const Pill: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <span
    style={{
      border: `2px solid ${T.border}`,
      borderRadius: 999,
      padding: "12px 28px",
      fontSize: 32,
      fontWeight: 500,
      color: T.muted,
      whiteSpace: "nowrap",
    }}
  >
    {children}
  </span>
);
