export interface TeamRef {
  id: number;
  name: string;
}

export type MatchStatus = "SCHEDULED" | "LIVE" | "FINISHED";

export interface Match {
  id: number;
  stage: string;
  group: string | null;
  utcDate: string;
  status: MatchStatus;
  /** Current match minute, only set while LIVE */
  minute: number | null;
  homeTeam: TeamRef;
  awayTeam: TeamRef;
  score: { home: number | null; away: number | null };
}

export interface StandingRow {
  position: number;
  team: TeamRef;
  played: number;
  won: number;
  draw: number;
  lost: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDifference: number;
  points: number;
}

export interface GroupStanding {
  group: string;
  table: StandingRow[];
}

export interface Provider {
  readonly name: string;
  getLiveMatches(): Promise<Match[]>;
  /** date: YYYY-MM-DD (UTC). Defaults to today. */
  getFixtures(date?: string): Promise<Match[]>;
  getMatch(id: number): Promise<Match | null>;
  getStandings(): Promise<GroupStanding[]>;
  /** All finished meetings between the two teams, plus each team's recent matches. */
  getH2H(teamA: number, teamB: number): Promise<Match[]>;
  /** Recent matches (any status) involving one team — input for analytics. */
  getTeamMatches(teamId: number): Promise<Match[]>;
  /** Finished competition matches, newest first. */
  getRecentMatches(): Promise<Match[]>;
}
