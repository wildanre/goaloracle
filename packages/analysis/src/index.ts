/**
 * Deterministic match analytics — pure functions, no I/O, no randomness.
 * Same inputs always produce the same output. All numbers are statistical
 * estimates derived from recent results; nothing here is betting advice.
 */
import type { Match } from "@goaloracle/data";

export interface TeamStats {
  teamId: number;
  played: number;
  goalsForAvg: number;
  goalsAgainstAvg: number;
  /** Recency-weighted points-per-match scaled to 0..10 */
  formIndex: number;
  recentResults: string[]; // e.g. ["W 2-0 vs Mexico", ...] newest first
}

export interface WinProbability {
  a: number;
  draw: number;
  b: number;
}

export interface AnalysisResult {
  formIndexA: number;
  formIndexB: number;
  expectedGoals: { a: number; b: number };
  winProbability: WinProbability;
  keyFactors: string[];
  verdict: string;
}

export interface PredictionResult extends AnalysisResult {
  mostLikelyScore: { a: number; b: number; probability: number };
  disclaimer: string;
}

const FORM_WINDOW = 5;
/** Tournament-level scoring baseline (goals per team per match). */
const BASELINE_GOALS = 1.35;
const MAX_GOALS_GRID = 10;

function finishedFor(teamId: number, matches: Match[]): Match[] {
  return matches
    .filter((m) => m.status === "FINISHED" && (m.homeTeam.id === teamId || m.awayTeam.id === teamId))
    .filter((m) => m.score.home !== null && m.score.away !== null)
    .sort((a, b) => b.utcDate.localeCompare(a.utcDate));
}

export function computeTeamStats(teamId: number, matches: Match[]): TeamStats {
  const recent = finishedFor(teamId, matches).slice(0, FORM_WINDOW);
  if (recent.length === 0) {
    return { teamId, played: 0, goalsForAvg: BASELINE_GOALS, goalsAgainstAvg: BASELINE_GOALS, formIndex: 5, recentResults: [] };
  }
  let gf = 0;
  let ga = 0;
  let weightedPoints = 0;
  let weightSum = 0;
  const recentResults: string[] = [];
  recent.forEach((m, i) => {
    const home = m.homeTeam.id === teamId;
    const us = home ? m.score.home! : m.score.away!;
    const them = home ? m.score.away! : m.score.home!;
    gf += us;
    ga += them;
    const points = us > them ? 3 : us === them ? 1 : 0;
    const weight = FORM_WINDOW - i; // newest match weighs most
    weightedPoints += points * weight;
    weightSum += weight;
    const letter = points === 3 ? "W" : points === 1 ? "D" : "L";
    const opponent = home ? m.awayTeam.name : m.homeTeam.name;
    recentResults.push(`${letter} ${us}-${them} vs ${opponent}`);
  });
  return {
    teamId,
    played: recent.length,
    goalsForAvg: gf / recent.length,
    goalsAgainstAvg: ga / recent.length,
    formIndex: round2(((weightedPoints / weightSum) / 3) * 10),
    recentResults,
  };
}

export function poissonPmf(k: number, lambda: number): number {
  let logP = -lambda + k * Math.log(lambda);
  for (let i = 2; i <= k; i++) logP -= Math.log(i);
  return Math.exp(logP);
}

/** Expected goals for A vs B: A's attack blended with B's defence, vs baseline. */
export function expectedGoals(a: TeamStats, b: TeamStats): { a: number; b: number } {
  const xg = (attack: TeamStats, defence: TeamStats) =>
    Math.max(0.1, ((attack.goalsForAvg / BASELINE_GOALS) * (defence.goalsAgainstAvg / BASELINE_GOALS)) * BASELINE_GOALS);
  return { a: round2(xg(a, b)), b: round2(xg(b, a)) };
}

/** Independent-Poisson scoreline grid → outcome probabilities. */
export function winProbability(xgA: number, xgB: number): WinProbability {
  let a = 0;
  let draw = 0;
  let b = 0;
  for (let i = 0; i <= MAX_GOALS_GRID; i++) {
    for (let j = 0; j <= MAX_GOALS_GRID; j++) {
      const p = poissonPmf(i, xgA) * poissonPmf(j, xgB);
      if (i > j) a += p;
      else if (i === j) draw += p;
      else b += p;
    }
  }
  const total = a + draw + b;
  return { a: round3(a / total), draw: round3(draw / total), b: round3(b / total) };
}

export function mostLikelyScore(xgA: number, xgB: number): { a: number; b: number; probability: number } {
  let best = { a: 0, b: 0, probability: 0 };
  for (let i = 0; i <= MAX_GOALS_GRID; i++) {
    for (let j = 0; j <= MAX_GOALS_GRID; j++) {
      const p = poissonPmf(i, xgA) * poissonPmf(j, xgB);
      if (p > best.probability) best = { a: i, b: j, probability: round3(p) };
    }
  }
  return best;
}

/** H2H record from teamA's perspective over the given finished meetings. */
export function h2hRecord(teamA: number, h2h: Match[]): { played: number; winsA: number; draws: number; winsB: number } {
  let winsA = 0;
  let draws = 0;
  let winsB = 0;
  for (const m of h2h) {
    if (m.score.home === null || m.score.away === null) continue;
    const aGoals = m.homeTeam.id === teamA ? m.score.home : m.score.away;
    const bGoals = m.homeTeam.id === teamA ? m.score.away : m.score.home;
    if (aGoals > bGoals) winsA++;
    else if (aGoals < bGoals) winsB++;
    else draws++;
  }
  return { played: winsA + draws + winsB, winsA, draws, winsB };
}

export function analyzeMatch(match: Match, matchesA: Match[], matchesB: Match[], h2h: Match[]): AnalysisResult {
  const a = computeTeamStats(match.homeTeam.id, matchesA);
  const b = computeTeamStats(match.awayTeam.id, matchesB);
  const xg = expectedGoals(a, b);

  // Nudge expected goals by H2H dominance (bounded ±10%).
  const record = h2hRecord(match.homeTeam.id, h2h);
  if (record.played > 0) {
    const edge = (record.winsA - record.winsB) / record.played; // -1..1
    xg.a = round2(xg.a * (1 + 0.1 * edge));
    xg.b = round2(xg.b * (1 - 0.1 * edge));
  }

  const prob = winProbability(xg.a, xg.b);

  const nameA = match.homeTeam.name;
  const nameB = match.awayTeam.name;
  const keyFactors: string[] = [
    `${nameA} form index ${a.formIndex}/10 over last ${a.played || 0} matches (avg ${round2(a.goalsForAvg)} scored, ${round2(a.goalsAgainstAvg)} conceded)`,
    `${nameB} form index ${b.formIndex}/10 over last ${b.played || 0} matches (avg ${round2(b.goalsForAvg)} scored, ${round2(b.goalsAgainstAvg)} conceded)`,
    record.played > 0
      ? `Head-to-head: ${record.played} meetings — ${nameA} ${record.winsA}W, ${record.draws}D, ${nameB} ${record.winsB}W`
      : "No prior head-to-head data available",
    `Poisson expected goals: ${nameA} ${xg.a} — ${nameB} ${xg.b}`,
  ];

  const leader = prob.a > prob.b ? nameA : nameB;
  const lead = Math.max(prob.a, prob.b);
  const verdict =
    Math.abs(prob.a - prob.b) < 0.08
      ? `Statistically even contest: ${nameA} ${pct(prob.a)}, draw ${pct(prob.draw)}, ${nameB} ${pct(prob.b)}.`
      : `${leader} are statistical favourites at ${pct(lead)} (draw ${pct(prob.draw)}). Estimate from recent form and Poisson goal model.`;

  return { formIndexA: a.formIndex, formIndexB: b.formIndex, expectedGoals: xg, winProbability: prob, keyFactors, verdict };
}

export function predictMatch(match: Match, matchesA: Match[], matchesB: Match[], h2h: Match[]): PredictionResult {
  const analysis = analyzeMatch(match, matchesA, matchesB, h2h);
  return {
    ...analysis,
    mostLikelyScore: mostLikelyScore(analysis.expectedGoals.a, analysis.expectedGoals.b),
    disclaimer: "Statistical estimate from a deterministic Poisson model over recent results. Not betting advice.",
  };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
function round3(n: number): number {
  return Math.round(n * 1000) / 1000;
}
function pct(p: number): string {
  return `${Math.round(p * 100)}%`;
}
