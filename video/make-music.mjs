// Synthesizes a license-free ambient music bed (stereo WAV) for the demo video.
// Deterministic: layered detuned sines over a slow 4-chord progression.
//   node make-music.mjs  → public/music.wav
import { writeFileSync } from "node:fs";

const SR = 44100;
const DURATION = 94; // seconds
const N = SR * DURATION;

// A-minor ambient progression, 8s per chord (Hz)
const CHORDS = [
  [110.0, 164.81, 261.63, 329.63], // Am add9-ish
  [87.31, 174.61, 261.63, 349.23], // Fmaj7
  [130.81, 196.0, 261.63, 392.0], // C
  [98.0, 196.0, 293.66, 392.0], // G add9
];
const CHORD_SECONDS = 8;

const out = new Float32Array(N * 2);

const envAt = (tInChord) => {
  // slow swell per chord: attack 2s, release 2s
  const a = Math.min(1, tInChord / 2);
  const r = Math.min(1, (CHORD_SECONDS - tInChord) / 2);
  return Math.min(a, r);
};

for (let i = 0; i < N; i++) {
  const t = i / SR;
  const chordIdx = Math.floor(t / CHORD_SECONDS) % CHORDS.length;
  const tInChord = t % CHORD_SECONDS;
  const env = envAt(tInChord);
  let l = 0;
  let r = 0;
  const chord = CHORDS[chordIdx];
  for (let v = 0; v < chord.length; v++) {
    const f = chord[v];
    const det = 1 + 0.0012 * Math.sin(2 * Math.PI * 0.11 * t + v);
    const amp = (v === 0 ? 0.5 : 0.3) / chord.length;
    const s1 = Math.sin(2 * Math.PI * f * det * t);
    const s2 = Math.sin(2 * Math.PI * f * (2 - det) * t + 1.7);
    l += amp * (0.6 * s1 + 0.4 * s2);
    r += amp * (0.4 * s1 + 0.6 * s2);
  }
  // gentle global LFO shimmer + master fade in/out
  const lfo = 0.85 + 0.15 * Math.sin(2 * Math.PI * 0.05 * t);
  const master = Math.min(1, t / 3, (DURATION - t) / 4);
  out[i * 2] = l * env * lfo * master * 0.5;
  out[i * 2 + 1] = r * env * lfo * master * 0.5;
}

// encode 16-bit stereo WAV
const dataBytes = N * 2 * 2;
const buf = Buffer.alloc(44 + dataBytes);
buf.write("RIFF", 0);
buf.writeUInt32LE(36 + dataBytes, 4);
buf.write("WAVEfmt ", 8);
buf.writeUInt32LE(16, 16);
buf.writeUInt16LE(1, 20);
buf.writeUInt16LE(2, 22);
buf.writeUInt32LE(SR, 24);
buf.writeUInt32LE(SR * 4, 28);
buf.writeUInt16LE(4, 32);
buf.writeUInt16LE(16, 34);
buf.write("data", 36);
buf.writeUInt32LE(dataBytes, 40);
for (let i = 0; i < N * 2; i++) {
  buf.writeInt16LE(Math.max(-32768, Math.min(32767, Math.round(out[i] * 32767))), 44 + i * 2);
}
writeFileSync("public/music.wav", buf);
console.log(`public/music.wav written (${(buf.length / 1e6).toFixed(1)} MB, ${DURATION}s)`);
