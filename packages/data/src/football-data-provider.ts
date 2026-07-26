import { z } from "zod";
import { computeStandings } from "./standings.js";
import type { GroupStanding, Match, MatchStatus, Provider } from "./types.js";

// football-data.org v4 — https://www.football-data.org/documentation/quickstart
const API = "https://api.football-data.org/v4";
const COMPETITION = "WC"; // FIFA World Cup

const fdTeam = z.object({ id: z.number(), name: z.string() });

const fdMatch = z.object({
  id: z.number(),
  utcDate: z.string(),
  status: z.string(),
  minute: z.number().nullish(),
  stage: z.string(),
  group: z.string().nullish(),
  homeTeam: fdTeam,
  awayTeam: fdTeam,
  score: z.object({
    fullTime: z.object({ home: z.number().nullable(), away: z.number().nullable() }),
  }),
});

const fdMatchList = z.object({ matches: z.array(fdMatch) });

const fdStandings = z.object({
  standings: z.array(
    z.object({
      type: z.string(),
      group: z.string().nullish(),
      table: z.array(
        z.object({
          position: z.number(),
          team: fdTeam,
          playedGames: z.number(),
          won: z.number(),
          draw: z.number(),
          lost: z.number(),
          goalsFor: z.number(),
          goalsAgainst: z.number(),
          goalDifference: z.number(),
          points: z.number(),
        }),
      ),
    }),
  ),
});

function toStatus(s: string): MatchStatus {
  if (s === "IN_PLAY" || s === "PAUSED" || s === "LIVE") return "LIVE";
  if (s === "FINISHED" || s === "AWARDED") return "FINISHED";
  return "SCHEDULED";
}

function toMatch(m: z.infer<typeof fdMatch>): Match {
  return {
    id: m.id,
    stage: m.stage,
    group: m.group ?? null,
    utcDate: m.utcDate,
    status: toStatus(m.status),
    minute: m.minute ?? null,
    homeTeam: m.homeTeam,
    awayTeam: m.awayTeam,
    score: { home: m.score.fullTime.home, away: m.score.fullTime.away },
  };
}

export class FootballDataProvider implements Provider {
  readonly name = "football-data.org";

  constructor(private readonly token: string) {}

  private async get<T>(path: string, schema: z.ZodType<T>): Promise<T> {
    const res = await fetch(`${API}${path}`, { headers: { "X-Auth-Token": this.token } });
    if (!res.ok) {
      throw new Error(`football-data.org ${res.status} on ${path}: ${(await res.text()).slice(0, 200)}`);
    }
    return schema.parse(await res.json());
  }

  async getLiveMatches(): Promise<Match[]> {
    const data = await this.get(`/competitions/${COMPETITION}/matches?status=IN_PLAY`, fdMatchList);
    return data.matches.map(toMatch);
  }

  async getFixtures(date?: string): Promise<Match[]> {
    const day = date ?? new Date().toISOString().slice(0, 10);
    const data = await this.get(`/competitions/${COMPETITION}/matches?dateFrom=${day}&dateTo=${day}`, fdMatchList);
    return data.matches.map(toMatch);
  }

  async getMatch(id: number): Promise<Match | null> {
    const res = await fetch(`${API}/matches/${id}`, { headers: { "X-Auth-Token": this.token } });
    if (res.status === 404) return null;
    if (!res.ok) throw new Error(`football-data.org ${res.status} on /matches/${id}`);
    return toMatch(fdMatch.parse(await res.json()));
  }

  async getStandings(): Promise<GroupStanding[]> {
    const data = await this.get(`/competitions/${COMPETITION}/standings`, fdStandings);
    const groups = data.standings
      .filter((s) => s.type === "TOTAL")
      .map((s) => ({
        group: s.group ?? "TABLE",
        table: s.table.map((r) => ({
          position: r.position,
          team: r.team,
          played: r.playedGames,
          won: r.won,
          draw: r.draw,
          lost: r.lost,
          goalsFor: r.goalsFor,
          goalsAgainst: r.goalsAgainst,
          goalDifference: r.goalDifference,
          points: r.points,
        })),
      }));
    if (groups.length > 0) return groups;
    // Standings can be empty between stages — fall back to deriving from results.
    const all = await this.get(`/competitions/${COMPETITION}/matches`, fdMatchList);
    return computeStandings(all.matches.map(toMatch));
  }

  async getH2H(teamA: number, teamB: number): Promise<Match[]> {
    const matches = await this.getTeamMatches(teamA);
    return matches.filter(
      (m) => m.status === "FINISHED" && [m.homeTeam.id, m.awayTeam.id].includes(teamB),
    );
  }

  async getTeamMatches(teamId: number): Promise<Match[]> {
    const data = await this.get(`/teams/${teamId}/matches?limit=50`, fdMatchList);
    return data.matches.map(toMatch);
  }

  async getRecentMatches(): Promise<Match[]> {
    const data = await this.get(`/competitions/${COMPETITION}/matches?status=FINISHED`, fdMatchList);
    return data.matches.map(toMatch).sort((a, b) => b.utcDate.localeCompare(a.utcDate));
  }
}
