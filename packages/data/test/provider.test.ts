import { describe, expect, it } from "vitest";
import { FootballDataProvider, MockProvider, TEAMS, computeStandings, buildMockMatches, selectProvider } from "../src/index.js";

describe("selectProvider", () => {
  it("uses MockProvider when no token is configured", () => {
    expect(selectProvider(undefined)).toBeInstanceOf(MockProvider);
  });

  it("uses FootballDataProvider when a token is configured", () => {
    expect(selectProvider("some-token")).toBeInstanceOf(FootballDataProvider);
  });
});

describe("MockProvider", () => {
  const provider = new MockProvider();

  it("bundles at least 8 realistic matches including 2 live ones", async () => {
    const all = buildMockMatches();
    expect(all.length).toBeGreaterThanOrEqual(8);
    const live = await provider.getLiveMatches();
    expect(live).toHaveLength(2);
    for (const m of live) {
      expect(m.status).toBe("LIVE");
      expect(m.minute).toBeGreaterThan(0);
      expect(m.score.home).not.toBeNull();
    }
  });

  it("returns today's fixtures including the live matches", async () => {
    const today = await provider.getFixtures();
    expect(today.some((m) => m.status === "LIVE")).toBe(true);
  });

  it("returns group standings derived from results", async () => {
    const standings = await provider.getStandings();
    expect(standings.map((g) => g.group)).toEqual(["A", "B"]);
    const groupA = standings[0]!;
    expect(groupA.table).toHaveLength(4);
    // Argentina won 2, drew 1 → 7 points, top of group A
    expect(groupA.table[0]!.team.name).toBe("Argentina");
    expect(groupA.table[0]!.points).toBe(7);
    // Every team played 3 group games
    for (const row of groupA.table) expect(row.played).toBe(3);
  });

  it("returns head-to-head history for Argentina vs France", async () => {
    const h2h = await provider.getH2H(TEAMS.ARG.id, TEAMS.FRA.id);
    expect(h2h.length).toBeGreaterThanOrEqual(3);
    for (const m of h2h) {
      expect(m.status).toBe("FINISHED");
      const ids = [m.homeTeam.id, m.awayTeam.id];
      expect(ids).toContain(TEAMS.ARG.id);
      expect(ids).toContain(TEAMS.FRA.id);
    }
  });

  it("finds a match by id and returns null for unknown ids", async () => {
    expect((await provider.getMatch(2001))?.homeTeam.name).toBe("Argentina");
    expect(await provider.getMatch(999999)).toBeNull();
  });
});

describe("computeStandings", () => {
  it("awards 3/1/0 points and sorts by points then goal difference", () => {
    const standings = computeStandings(buildMockMatches());
    for (const group of standings) {
      const pts = group.table.map((r) => r.points);
      expect(pts).toEqual([...pts].sort((a, b) => b - a));
      for (const row of group.table) {
        expect(row.points).toBe(row.won * 3 + row.draw);
        expect(row.goalDifference).toBe(row.goalsFor - row.goalsAgainst);
      }
    }
  });
});
