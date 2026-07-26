/**
 * Voiceover narration per scene. Generate audio with:
 *   ELEVENLABS_API_KEY=... node generate-voiceover.mjs
 * which writes public/voiceover/<id>.mp3 and flips VO_READY to true.
 * Scene durations in the composition are fixed; each line is written to fit.
 */
export const VO_READY = true;

export const NARRATION = [
  {
    id: "title",
    text: "AI agents can't sign up for sports data APIs. GoalOracle gives any agent live World Cup data for free, and premium analytics it pays for by itself.",
  },
  {
    id: "terminal",
    text: "One command. The free tier needs no key. The premium endpoint answers with an HTTP 402 quote, the agent signs a gasless USDC authorization, and the payment settles on Injective, returning a real transaction hash.",
  },
  {
    id: "dashboard",
    text: "Humans get a dashboard. The buy button runs the same x402 flow in the open: quote, signature, settlement, then the analysis: win probabilities, form, and expected goals.",
  },
  {
    id: "agents",
    text: "For agents, it's an MCP server with eight tools and three skills. A headless agent checked its own wallet, paid two cents autonomously, and reported the probabilities honestly.",
  },
  {
    id: "cctp",
    text: "Empty wallet? Circle C C T P bridges USDC from Sepolia straight to Injective, domain twenty-nine.",
  },
  {
    id: "outro",
    text: "Free data. Paid analytics. Autonomous payments. GoalOracle, an x402 sports oracle any agent can use today.",
  },
] as const;
