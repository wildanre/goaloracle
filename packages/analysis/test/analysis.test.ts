import { MockProvider, TEAMS } from "@goaloracle/data";
import { describe, expect, it } from "vitest";
import { analyzeMatch, computeTeamStats, poissonPmf, predictMatch, winProbability } from "../src/index.js";

const provider = new MockProvider();

async function bundle(matchId: number) {
  const match = (await provider.getMatch(matchId))!;
  return {
    match,
    matchesA: await provider.getTeamMatches(match.homeTeam.id),
    matchesB: await provider.getTeamMatches(match.awayTeam.id),
    h2h: await provider.getH2H(match.homeTeam.id, match.awayTeam.id),
  };
}

describe("poissonPmf", () => {
  it("is a valid pmf", () => {
    const total = Array.from({ length: 30 }, (_, k) => poissonPmf(k, 1.5)).reduce((a, b) => a + b);
    expect(total).toBeCloseTo(1, 6);
    expect(poissonPmf(0, 1.5)).toBeCloseTo(Math.exp(-1.5), 10);
  });
});

describe("winProbability", () => {
  it("sums to 1 and favours the stronger attack", () => {
    const p = winProbability(2.2, 0.8);
    // components are rounded to 3dp individually, so the sum can be off by ≤0.002
    expect(p.a + p.draw + p.b).toBeCloseTo(1, 2);
    expect(p.a).toBeGreaterThan(p.b);
  });

  it("is symmetric for equal teams", () => {
    const p = winProbability(1.3, 1.3);
    expect(p.a).toBeCloseTo(p.b, 3);
  });
});

describe("computeTeamStats", () => {
  it("computes form from recent finished matches", async () => {
    const stats = computeTeamStats(TEAMS.ARG.id, await provider.getTeamMatches(TEAMS.ARG.id));
    expect(stats.played).toBeGreaterThan(0);
    expect(stats.formIndex).toBeGreaterThan(5); // Argentina unbeaten in mock data
    expect(stats.formIndex).toBeLessThanOrEqual(10);
    expect(stats.recentResults.length).toBe(stats.played);
  });

  it("returns neutral baseline when there is no data", () => {
    const stats = computeTeamStats(123456, []);
    expect(stats.formIndex).toBe(5);
    expect(stats.played).toBe(0);
  });
});

describe("analyzeMatch / predictMatch", () => {
  it("produces the PRD result shape with probabilities summing to 1", async () => {
    const { match, matchesA, matchesB, h2h } = await bundle(2001);
    const a = analyzeMatch(match, matchesA, matchesB, h2h);
    expect(a.winProbability.a + a.winProbability.draw + a.winProbability.b).toBeCloseTo(1, 2);
    expect(a.keyFactors.length).toBeGreaterThanOrEqual(3);
    expect(a.verdict).toBeTruthy();
    expect(a.expectedGoals.a).toBeGreaterThan(0);
  });

  it("is deterministic — same input, same output", async () => {
    const { match, matchesA, matchesB, h2h } = await bundle(2001);
    expect(analyzeMatch(match, matchesA, matchesB, h2h)).toEqual(analyzeMatch(match, matchesA, matchesB, h2h));
  });

  it("prediction includes a most likely score and a non-betting disclaimer", async () => {
    const { match, matchesA, matchesB, h2h } = await bundle(2001);
    const p = predictMatch(match, matchesA, matchesB, h2h);
    expect(p.mostLikelyScore.probability).toBeGreaterThan(0);
    expect(p.disclaimer).toMatch(/not betting advice/i);
  });
});
