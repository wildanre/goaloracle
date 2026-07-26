import { Audio } from "@remotion/media";
import React from "react";
import { Sequence, staticFile } from "remotion";
import { VO_READY } from "./narration";

/** One-shot sound effect at a local frame. */
export const Sfx: React.FC<{ file: string; at?: number; volume?: number }> = ({ file, at = 0, volume = 0.4 }) => (
  <Sequence from={at} layout="none">
    <Audio src={staticFile(`sfx/${file}.wav`)} volume={volume} />
  </Sequence>
);

/** Scene voiceover — renders only after generate-voiceover.mjs has run. */
export const Voiceover: React.FC<{ id: string }> = ({ id }) => {
  if (!VO_READY) return null;
  return <Audio src={staticFile(`voiceover/${id}.mp3`)} volume={0.95} />;
};
