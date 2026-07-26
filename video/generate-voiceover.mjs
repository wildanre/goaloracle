// Generates ElevenLabs voiceover for each scene → public/voiceover/<id>.mp3
//   ELEVENLABS_API_KEY=... node generate-voiceover.mjs [voiceId]
// Then flips VO_READY to true in src/narration.ts and you re-render.
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";

const key = process.env.ELEVENLABS_API_KEY;
if (!key) {
  console.error("ELEVENLABS_API_KEY is required");
  process.exit(1);
}
const voiceId = process.argv[2] ?? "JBFqnCBsd6RMkjVDRZzb"; // "George" — calm narrator

const src = readFileSync("src/narration.ts", "utf8");
const narration = [...src.matchAll(/id: "([a-z]+)",\s*\n\s*text: "([^"]+)"/g)].map((m) => ({ id: m[1], text: m[2] }));
if (narration.length === 0) throw new Error("No narration entries parsed from src/narration.ts");

mkdirSync("public/voiceover", { recursive: true });
for (const scene of narration) {
  const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
    method: "POST",
    headers: { "xi-api-key": key, "Content-Type": "application/json", Accept: "audio/mpeg" },
    body: JSON.stringify({
      text: scene.text,
      model_id: "eleven_multilingual_v2",
      voice_settings: { stability: 0.5, similarity_boost: 0.75, style: 0.3 },
    }),
  });
  if (!res.ok) throw new Error(`ElevenLabs ${res.status} for ${scene.id}: ${(await res.text()).slice(0, 200)}`);
  writeFileSync(`public/voiceover/${scene.id}.mp3`, Buffer.from(await res.arrayBuffer()));
  console.log(`✔ public/voiceover/${scene.id}.mp3`);
}
writeFileSync("src/narration.ts", src.replace("export const VO_READY = false;", "export const VO_READY = true;"));
console.log("VO_READY → true. Re-render: npx remotion render goaloracle-demo out/goaloracle-demo.mp4");
