# CLAUDE.md — GoalOracle Project Rules

Rules for Claude Code working in this repository. Read `PRD-GoalOracle.md` before any task — it is the single source of truth for scope, architecture, and acceptance criteria.

## 0. Prime directives

1. **PRD is law.** Build exactly what `PRD-GoalOracle.md` specifies, in phase order (1→5). Never skip ahead to optional phases while a mandatory phase is incomplete.
2. **Deadline mode.** This is a hackathon project due today. Prefer the simplest working implementation over the elegant one. Ship, then polish.
3. **Never fake completion.** A task is done only when its acceptance criterion (PRD §8) passes locally. If blocked, say so explicitly — do not stub and mark done silently.

## 1. Compound engineering (mandatory workflow)

Every unit of work must make the *next* unit of work easier. Apply this loop to every task:

**Plan → Delegate → Verify → Codify**

- **Plan first.** Before writing code, state a short plan (files touched, approach, risks). For anything non-trivial, write the plan into `docs/plans/<task>.md` first and follow it.
- **Verify with executable checks.** Every feature lands with at least one test or a runnable script that proves it works. "It should work" is not verification — run it.
- **Codify learnings immediately.** When you solve a tricky problem (x402 middleware quirk, CCTP attestation delay, football-data.org rate limit, MCP transport issue), append the lesson to `docs/LEARNINGS.md` in the same commit: *symptom → root cause → fix → rule for next time*. Then, if the lesson changes how future work should be done, add a rule to this file under §7.
- **Turn repetition into automation.** The second time you type a multi-step command sequence, wrap it in a pnpm script. The second time you explain a workflow, write it into a skill or doc.
- **Teach the agents.** Anything an AI agent consumer needs to know goes into the `skills/*/SKILL.md` files, not just the README. The skills are a product surface — keep them in sync with tool names and endpoints.

## 2. Use available skills and MCP servers — always check first

- **Before implementing anything from scratch, check whether an installed skill, MCP server, or existing package solves it.** Order of preference: existing repo code → installed skill → MCP tool → well-known npm package → hand-rolled code.
- Use the **Injective MCP server / InjectiveLabs agent-skills** (https://github.com/InjectiveLabs) as reference implementations for x402, wallet ops, and skill structure — mirror their patterns rather than inventing new ones.
- Use **web search/fetch for current docs** before integrating any external protocol (x402, CCTP, football-data.org, MCP SDK). APIs drift; do not code against memory. Record the doc URL you followed in a code comment.
- When a skill exists for a deliverable (docs, diagrams, spreadsheets), invoke it instead of free-handing the format.
- If an MCP server or skill errors or is unavailable, fall back gracefully and note it in `docs/LEARNINGS.md`.

## 3. Code standards

- TypeScript strict mode everywhere; `tsc --noEmit` must be clean before any commit.
- Zod-validate all external input: HTTP params, env vars (parse once at startup into a typed config object), third-party API responses.
- Small modules, pure functions in `packages/analysis` (deterministic, no I/O).
- No `any` unless annotated with a `// TODO(any):` reason.
- Errors: never swallow. API returns structured JSON errors `{ error, code }`; scripts exit non-zero with a readable message.
- Keep dependencies minimal — every new package must be justified in the commit message.

## 4. Security & money rules

- **Never commit secrets.** Private keys, tokens only via env; `.env` is gitignored; `.env.example` lists every var with a comment.
- Testnet only. Hardcode refusal to run payment flows against mainnet chain IDs.
- The demo agent wallet holds trivial testnet USDC only. Log tx hashes, never keys.
- Analytics output must be framed as statistical estimates — no betting advice language anywhere (code, docs, skills).

## 5. Testing & verification

- Vitest for units: analysis math, provider selection, cache, zod schemas.
- One integration smoke test per phase: free API returns data (mock mode), premium endpoint returns 402 unpaid, MCP server lists tools.
- `pnpm demo` is the canonical end-to-end check — it must pass on a clean clone with zero env vars before you declare any phase complete.
- Before finishing a session: run `pnpm test && tsc --noEmit && pnpm demo`, then re-check PRD §8 checklist and report status per item.

## 6. Git & docs discipline

- Small, atomic commits per completed sub-task; message format: `phase-N: <what> — <why>`.
- README is updated in the same commit as the feature it documents — never "docs later". README structure must always satisfy PRD §7 (hackathon hard requirement).
- Keep `DEMO.md` runnable at all times; it is the script for the submission video.
- Do not create files outside the structure in PRD §4 without noting the deviation and reason in the commit message.

## 7. Learned rules (append via compound engineering — newest first)

- Read official SDK/provider package sources (npm) for protocol constants (addresses, domains, chain ids) instead of scraping docs sites — see docs/LEARNINGS.md.
- Keep zod pinned to ^3.25 workspace-wide (`@injectivelabs/x402` requires ^3.23; MCP SDK accepts it).
- x402 demo with zero env: ephemeral inline facilitator key makes 402 challenges valid without chain access; settlement needs funded `FACILITATOR_PRIVATE_KEY` (INJ gas) + `AGENT_PRIVATE_KEY` (USDC).
- macOS has no `timeout` command — background the process and `kill` it in scripts/tests.

<!-- When a LEARNINGS.md entry yields a durable rule, add it here. Example:
- (2026-07-26) football-data.org free tier: max 10 req/min — always go through the cached provider, never call it directly from handlers.
-->

## 8. Communication style

- Be concise. Report progress as: current phase, what passed verification, what's next, blockers.
- When trade-offs arise (time vs. completeness), choose the option that keeps `pnpm demo` working and say which corner was cut.
- Never claim an Injective technology is "integrated" in README/skills unless it actually executes in the demo path — judges will check.
