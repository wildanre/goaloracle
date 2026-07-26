import { Audio } from "@remotion/media";
import { springTiming, TransitionSeries, type TransitionPresentation } from "@remotion/transitions";
import { fade } from "@remotion/transitions/fade";
import { slide } from "@remotion/transitions/slide";
import { wipe } from "@remotion/transitions/wipe";
import React from "react";
import { Composition, Sequence, staticFile } from "remotion";
import { AgentScene, CctpScene, DashboardScene, OutroScene, TerminalScene, TitleScene } from "./scenes";

const FPS = 30;

// Scene durations (frames) and the transition that FOLLOWS each scene.
const SCENES = [
  { comp: TitleScene, frames: 11 * FPS, transition: slide({ direction: "from-bottom" }), t: 18 },
  { comp: TerminalScene, frames: 25 * FPS, transition: wipe({ direction: "from-left" }), t: 20 },
  { comp: DashboardScene, frames: 21 * FPS, transition: slide({ direction: "from-right" }), t: 18 },
  { comp: AgentScene, frames: 17 * FPS, transition: fade(), t: 15 },
  { comp: CctpScene, frames: 10 * FPS, transition: slide({ direction: "from-top" }), t: 18 },
  { comp: OutroScene, frames: 9 * FPS, transition: null, t: 0 },
] as const;

const TOTAL_FRAMES =
  SCENES.reduce((sum, s) => sum + s.frames, 0) - SCENES.reduce((sum, s) => sum + s.t, 0);

// Absolute output frame where each transition begins (for the whoosh SFX).
const transitionStarts: number[] = [];
{
  let cursor = 0;
  for (const s of SCENES) {
    cursor += s.frames - s.t;
    if (s.transition) transitionStarts.push(cursor);
  }
}

const Main: React.FC = () => (
  <>
    <TransitionSeries>
      {SCENES.flatMap((s, i) => {
        const seq = (
          <TransitionSeries.Sequence key={`s${i}`} durationInFrames={s.frames}>
            <s.comp />
          </TransitionSeries.Sequence>
        );
        if (!s.transition) return [seq];
        return [
          seq,
          <TransitionSeries.Transition
            key={`t${i}`}
            presentation={s.transition as TransitionPresentation<Record<string, unknown>>}
            timing={springTiming({ config: { damping: 18 }, durationInFrames: s.t })}
          />,
        ];
      })}
    </TransitionSeries>
    <Audio src={staticFile("music.wav")} volume={0.2} />
    {transitionStarts.map((f, i) => (
      <Sequence key={`w${i}`} from={f - 4} layout="none">
        <Audio src={staticFile("sfx/whoosh.wav")} volume={0.5} />
      </Sequence>
    ))}
  </>
);

export const MyComposition: React.FC = () => (
  <Composition id="goaloracle-demo" component={Main} durationInFrames={TOTAL_FRAMES} fps={FPS} width={1920} height={1080} />
);
