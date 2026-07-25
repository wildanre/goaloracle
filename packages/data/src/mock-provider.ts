import { buildMockMatches } from "./mock-data.js";
import { computeStandings } from "./standings.js";
import type { GroupStanding, Match, Provider } from "./types.js";

export class MockProvider implements Provider {
  readonly name = "mock";

  private matches(): Match[] {
    return buildMockMatches();
  }

  async getLiveMatches(): Promise<Match[]> {
    return this.matches().filter((m) => m.status === "LIVE");
  }

  async getFixtures(date?: string): Promise<Match[]> {
    const day = date ?? new Date().toISOString().slice(0, 10);
    return this.matches().filter((m) => m.utcDate.slice(0, 10) === day);
  }

  async getMatch(id: number): Promise<Match | null> {
    return this.matches().find((m) => m.id === id) ?? null;
  }

  async getStandings(): Promise<GroupStanding[]> {
    return computeStandings(this.matches());
  }

  async getH2H(teamA: number, teamB: number): Promise<Match[]> {
    return this.matches().filter(
      (m) =>
        m.status === "FINISHED" &&
        [m.homeTeam.id, m.awayTeam.id].includes(teamA) &&
        [m.homeTeam.id, m.awayTeam.id].includes(teamB),
    );
  }

  async getTeamMatches(teamId: number): Promise<Match[]> {
    return this.matches().filter((m) => m.homeTeam.id === teamId || m.awayTeam.id === teamId);
  }
}
