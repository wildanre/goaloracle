import { linearTiming, TransitionSeries } from "@remotion/transitions";
import { fade } from "@remotion/transitions/fade";
import React from "react";
import { Composition } from "remotion";
import { AgentScene, CctpScene, DashboardScene, OutroScene, TerminalScene, TitleScene } from "./scenes";

const FPS = 30;
const TRANSITION = 15;

// Scene durations in seconds (sum + transitions ≈ 90s)
const D = { title: 11, terminal: 25, dashboard: 21, agents: 17, cctp: 10, outro: 9 } as const;

const Main: React.FC = () => (
  <TransitionSeries>
    <TransitionSeries.Sequence durationInFrames={D.title * FPS}>
      <TitleScene />
    </TransitionSeries.Sequence>
    <TransitionSeries.Transition presentation={fade()} timing={linearTiming({ durationInFrames: TRANSITION })} />
    <TransitionSeries.Sequence durationInFrames={D.terminal * FPS}>
      <TerminalScene />
    </TransitionSeries.Sequence>
    <TransitionSeries.Transition presentation={fade()} timing={linearTiming({ durationInFrames: TRANSITION })} />
    <TransitionSeries.Sequence durationInFrames={D.dashboard * FPS}>
      <DashboardScene shotSeconds={7} />
    </TransitionSeries.Sequence>
    <TransitionSeries.Transition presentation={fade()} timing={linearTiming({ durationInFrames: TRANSITION })} />
    <TransitionSeries.Sequence durationInFrames={D.agents * FPS}>
      <AgentScene />
    </TransitionSeries.Sequence>
    <TransitionSeries.Transition presentation={fade()} timing={linearTiming({ durationInFrames: TRANSITION })} />
    <TransitionSeries.Sequence durationInFrames={D.cctp * FPS}>
      <CctpScene />
    </TransitionSeries.Sequence>
    <TransitionSeries.Transition presentation={fade()} timing={linearTiming({ durationInFrames: TRANSITION })} />
    <TransitionSeries.Sequence durationInFrames={D.outro * FPS}>
      <OutroScene />
    </TransitionSeries.Sequence>
  </TransitionSeries>
);

const TOTAL_FRAMES = Object.values(D).reduce((a, b) => a + b, 0) * FPS - 5 * TRANSITION;

export const MyComposition: React.FC = () => (
  <Composition
    id="goaloracle-demo"
    component={Main}
    durationInFrames={TOTAL_FRAMES}
    fps={FPS}
    width={1920}
    height={1080}
  />
);
