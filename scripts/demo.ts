/**
 * `pnpm demo` — canonical end-to-end check. Works on a clean clone with zero
 * env vars: starts the API (mock data + x402 paywall), exercises the free
 * endpoints, runs the x402 demo client (dry mode without AGENT_PRIVATE_KEY,
 * real USDC payment with it), then prints the MCP install snippet.
 */
try { process.loadEnvFile(); } catch { /* no .env — defaults apply */ }
import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const PORT = process.env.PORT ?? "3900";
const API = `http://localhost:${PORT}`;

const banner = (msg: string) => console.log(`\n${"═".repeat(70)}\n  ${msg}\n${"═".repeat(70)}`);

function run(cmd: string, args: string[], env: NodeJS.ProcessEnv): Promise<number> {
  return new Promise((resolve) => {
    const child = spawn(cmd, args, { cwd: root, env, stdio: "inherit" });
    child.on("exit", (code) => resolve(code ?? 1));
  });
}

async function main(): Promise<void> {
  banner("GoalOracle demo — World Cup data + x402 micropayments on Injective");

  console.log(`\nStarting API on :${PORT} (provider auto-selects: mock without FOOTBALL_DATA_TOKEN)…`);
  const api = spawn("npx", ["tsx", "packages/api/src/server.ts"], {
    cwd: root,
    env: { ...process.env, PORT },
    stdio: "inherit",
  });
  const stop = () => { if (api.exitCode === null) api.kill(); };
  process.on("exit", stop);

  // Wait for readiness
  let ready = false;
  for (let i = 0; i < 40 && !ready; i++) {
    try {
      ready = (await fetch(`${API}/healthz`)).ok;
    } catch {
      await new Promise((r) => setTimeout(r, 250));
    }
  }
  if (!ready) throw new Error("API did not become ready");

  banner("1. FREE tier — live matches (no key, no payment)");
  const liveBody = (await (await fetch(`${API}/matches/live`)).json()) as { matches?: Array<{ id: number; homeTeam: { name: string }; awayTeam: { name: string }; score: { home: number; away: number }; minute: number }> };
  const liveMatches = liveBody.matches ?? [];
  for (const m of liveMatches) {
    console.log(`  LIVE ${m.minute}'  ${m.homeTeam.name} ${m.score.home} : ${m.score.away} ${m.awayTeam.name}`);
  }
  if (liveMatches.length === 0) console.log("  (no live matches right now — tournament schedule)");

  // Pick a real match id for the premium demo: a live one, else the most
  // recently finished (works with the real provider after the tournament).
  let demoMatchId = liveMatches[0]?.id;
  if (demoMatchId === undefined) {
    const recent = (await (await fetch(`${API}/matches/recent`)).json()) as { matches?: Array<{ id: number }> };
    demoMatchId = recent.matches?.[0]?.id;
  }
  if (demoMatchId === undefined) throw new Error("No match found to demo against");

  banner("2. PREMIUM tier — x402 payment flow (402 → sign → settle → 200)");
  const clientExit = await run("npx", ["tsx", "scripts/demo-x402-client.ts"], {
    ...process.env,
    API_BASE_URL: API,
    DEMO_MATCH_ID: process.env.DEMO_MATCH_ID ?? String(demoMatchId),
  });
  if (clientExit !== 0) throw new Error("demo x402 client failed");

  banner("3. Use it from Claude (MCP server) — add to .mcp.json / claude_desktop_config.json");
  console.log(JSON.stringify({
    mcpServers: {
      goaloracle: {
        command: "npx",
        args: ["tsx", path.join(root, "packages/mcp-server/src/index.ts")],
        env: { API_BASE_URL: API, AGENT_PRIVATE_KEY: "<optional: 0x… testnet key to enable paid tools>" },
      },
    },
  }, null, 2));
  console.log(`\nDashboard: ${API}  ·  Fund a wallet: pnpm cctp --dry-run  ·  Docs: README.md`);

  banner("Demo complete ✔");
  stop();
  process.exit(0);
}

main().catch((err) => {
  console.error(`\n[demo] FAILED: ${err instanceof Error ? err.message : err}`);
  process.exit(1);
});
