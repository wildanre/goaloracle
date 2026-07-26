import { loadFont as loadGeist } from "@remotion/google-fonts/Geist";
import { loadFont as loadGeistMono } from "@remotion/google-fonts/GeistMono";

const geist = loadGeist();
const geistMono = loadGeistMono();

/** Same token system as the GoalOracle dashboard — shadcn zinc dark, solid colors only. */
export const T = {
  bg: "#09090b",
  surface: "#18181b",
  secondary: "#27272a",
  border: "#27272a",
  fg: "#fafafa",
  muted: "#a1a1aa",
  decor: "#71717a",
  sans: geist.fontFamily,
  mono: geistMono.fontFamily,
} as const;

export const EASE_OUT = [0.16, 1, 0.3, 1] as const;
