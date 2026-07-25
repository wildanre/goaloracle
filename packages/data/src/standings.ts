import type { GroupStanding, Match, StandingRow, TeamRef } from "./types.js";

/** Derive group tables from finished group-stage matches (single source of truth). */
export function computeStandings(matches: Match[]): GroupStanding[] {
  const groups = new Map<string, Map<number, StandingRow>>();

  const row = (group: string, team: TeamRef): StandingRow => {
    let table = groups.get(group);
    if (!table) groups.set(group, (table = new Map()));
    let r = table.get(team.id);
    if (!r) {
      r = { position: 0, team, played: 0, won: 0, draw: 0, lost: 0, goalsFor: 0, goalsAgainst: 0, goalDifference: 0, points: 0 };
      table.set(team.id, r);
    }
    return r;
  };

  for (const m of matches) {
    if (m.stage !== "GROUP_STAGE" || m.status !== "FINISHED" || m.group === null) continue;
    const { home, away } = m.score;
    if (home === null || away === null) continue;
    const h = row(m.group, m.homeTeam);
    const a = row(m.group, m.awayTeam);
    h.played++; a.played++;
    h.goalsFor += home; h.goalsAgainst += away;
    a.goalsFor += away; a.goalsAgainst += home;
    if (home > away) { h.won++; a.lost++; h.points += 3; }
    else if (home < away) { a.won++; h.lost++; a.points += 3; }
    else { h.draw++; a.draw++; h.points++; a.points++; }
  }

  return [...groups.entries()]
    .sort(([g1], [g2]) => g1.localeCompare(g2))
    .map(([group, table]) => {
      const rows = [...table.values()];
      for (const r of rows) r.goalDifference = r.goalsFor - r.goalsAgainst;
      rows.sort((x, y) => y.points - x.points || y.goalDifference - x.goalDifference || y.goalsFor - x.goalsFor || x.team.name.localeCompare(y.team.name));
      rows.forEach((r, i) => (r.position = i + 1));
      return { group, table: rows };
    });
}
