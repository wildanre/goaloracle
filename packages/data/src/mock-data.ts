import type { Match, MatchStatus, TeamRef } from "./types.js";

/**
 * Bundled WC2026 fixture data used when FOOTBALL_DATA_TOKEN is absent.
 * Dates are stored as day offsets from "today" so the demo always has
 * live matches now, finished group-stage matches behind it, and upcoming
 * fixtures ahead — regardless of when it is run.
 */

export const TEAMS = {
  ARG: { id: 762, name: "Argentina" },
  FRA: { id: 773, name: "France" },
  ENG: { id: 770, name: "England" },
  MEX: { id: 769, name: "Mexico" },
  POL: { id: 794, name: "Poland" },
  DEN: { id: 782, name: "Denmark" },
  JPN: { id: 766, name: "Japan" },
  SEN: { id: 792, name: "Senegal" },
} as const satisfies Record<string, TeamRef>;

interface MockMatchSpec {
  id: number;
  stage: string;
  group: string | null;
  dayOffset: number;
  kickoffHourUtc: number;
  status: MatchStatus;
  minute: number | null;
  home: TeamRef;
  away: TeamRef;
  score: { home: number | null; away: number | null };
}

const T = TEAMS;

const SPECS: MockMatchSpec[] = [
  // --- Historical meetings (previous tournaments/friendlies) → H2H depth ---
  { id: 501, stage: "INTERNATIONAL", group: null, dayOffset: -750, kickoffHourUtc: 18, status: "FINISHED", minute: null, home: T.ARG, away: T.FRA, score: { home: 2, away: 1 } },
  { id: 502, stage: "INTERNATIONAL", group: null, dayOffset: -400, kickoffHourUtc: 18, status: "FINISHED", minute: null, home: T.FRA, away: T.ARG, score: { home: 1, away: 0 } },
  { id: 503, stage: "INTERNATIONAL", group: null, dayOffset: -120, kickoffHourUtc: 18, status: "FINISHED", minute: null, home: T.ARG, away: T.FRA, score: { home: 2, away: 2 } },
  { id: 504, stage: "INTERNATIONAL", group: null, dayOffset: -200, kickoffHourUtc: 18, status: "FINISHED", minute: null, home: T.ENG, away: T.MEX, score: { home: 3, away: 1 } },

  // --- Group A (finished) ---
  { id: 1001, stage: "GROUP_STAGE", group: "A", dayOffset: -14, kickoffHourUtc: 16, status: "FINISHED", minute: null, home: T.ARG, away: T.MEX, score: { home: 2, away: 0 } },
  { id: 1002, stage: "GROUP_STAGE", group: "A", dayOffset: -14, kickoffHourUtc: 19, status: "FINISHED", minute: null, home: T.POL, away: T.DEN, score: { home: 1, away: 0 } },
  { id: 1003, stage: "GROUP_STAGE", group: "A", dayOffset: -11, kickoffHourUtc: 16, status: "FINISHED", minute: null, home: T.ARG, away: T.POL, score: { home: 3, away: 1 } },
  { id: 1004, stage: "GROUP_STAGE", group: "A", dayOffset: -11, kickoffHourUtc: 19, status: "FINISHED", minute: null, home: T.MEX, away: T.DEN, score: { home: 2, away: 2 } },
  { id: 1005, stage: "GROUP_STAGE", group: "A", dayOffset: -8, kickoffHourUtc: 20, status: "FINISHED", minute: null, home: T.ARG, away: T.DEN, score: { home: 1, away: 1 } },
  { id: 1006, stage: "GROUP_STAGE", group: "A", dayOffset: -8, kickoffHourUtc: 20, status: "FINISHED", minute: null, home: T.MEX, away: T.POL, score: { home: 1, away: 0 } },

  // --- Group B (finished) ---
  { id: 1007, stage: "GROUP_STAGE", group: "B", dayOffset: -13, kickoffHourUtc: 16, status: "FINISHED", minute: null, home: T.FRA, away: T.ENG, score: { home: 2, away: 1 } },
  { id: 1008, stage: "GROUP_STAGE", group: "B", dayOffset: -13, kickoffHourUtc: 19, status: "FINISHED", minute: null, home: T.JPN, away: T.SEN, score: { home: 1, away: 1 } },
  { id: 1009, stage: "GROUP_STAGE", group: "B", dayOffset: -10, kickoffHourUtc: 16, status: "FINISHED", minute: null, home: T.FRA, away: T.JPN, score: { home: 3, away: 0 } },
  { id: 1010, stage: "GROUP_STAGE", group: "B", dayOffset: -10, kickoffHourUtc: 19, status: "FINISHED", minute: null, home: T.ENG, away: T.SEN, score: { home: 1, away: 0 } },
  { id: 1011, stage: "GROUP_STAGE", group: "B", dayOffset: -7, kickoffHourUtc: 20, status: "FINISHED", minute: null, home: T.FRA, away: T.SEN, score: { home: 1, away: 1 } },
  { id: 1012, stage: "GROUP_STAGE", group: "B", dayOffset: -7, kickoffHourUtc: 20, status: "FINISHED", minute: null, home: T.ENG, away: T.JPN, score: { home: 2, away: 0 } },

  // --- Quarter-finals: two LIVE right now, two upcoming ---
  { id: 2001, stage: "QUARTER_FINALS", group: null, dayOffset: 0, kickoffHourUtc: 0, status: "LIVE", minute: 67, home: T.ARG, away: T.FRA, score: { home: 1, away: 1 } },
  { id: 2002, stage: "QUARTER_FINALS", group: null, dayOffset: 0, kickoffHourUtc: 0, status: "LIVE", minute: 23, home: T.ENG, away: T.MEX, score: { home: 0, away: 0 } },
  { id: 2003, stage: "QUARTER_FINALS", group: null, dayOffset: 1, kickoffHourUtc: 16, status: "SCHEDULED", minute: null, home: T.POL, away: T.JPN, score: { home: null, away: null } },
  { id: 2004, stage: "QUARTER_FINALS", group: null, dayOffset: 1, kickoffHourUtc: 19, status: "SCHEDULED", minute: null, home: T.DEN, away: T.SEN, score: { home: null, away: null } },
];

function materializeDate(spec: MockMatchSpec, now: Date): string {
  if (spec.status === "LIVE") {
    // Kickoff = minute-in-play minutes ago, so timestamps stay coherent.
    return new Date(now.getTime() - (spec.minute ?? 0) * 60_000).toISOString();
  }
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + spec.dayOffset, spec.kickoffHourUtc));
  return d.toISOString();
}

export function buildMockMatches(now: Date = new Date()): Match[] {
  return SPECS.map(({ dayOffset: _d, kickoffHourUtc: _k, home, away, ...rest }) => ({
    ...rest,
    homeTeam: home,
    awayTeam: away,
    utcDate: materializeDate({ dayOffset: _d, kickoffHourUtc: _k, home, away, ...rest }, now),
  }));
}
