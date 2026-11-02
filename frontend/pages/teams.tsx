import { useState } from "react";
import StatTable, { Column } from "../components/StatTable";
import PieChart from "../components/Charts/PieChart";
import LineChart from "../components/Charts/LineChart";
import LoadingSpinner from "../components/LoadingSpinner";
import ErrorMessage from "../components/ErrorMessage";
import { SharedDateRange } from "../components/Filters";
import { battingColumns, pitchingColumns } from "../components/columns";
import { EmptyState, PageHeader, Spinner } from "../components/ui";
import { useData } from "../context/DataContext";
import { useAsync } from "../hooks/useAsync";
import { fetchTeam, fetchTeamGames, fetchTeams } from "../utils/api";
import { formatAvg, formatDate, formatRate, formatSigned, lastName } from "../utils/format";
import type { DateRange, Team } from "../types";

const diffClass = (d: number | null) =>
  d == null ? "" : d > 0 ? "text-emerald-600 dark:text-emerald-400" : d < 0 ? "text-red-600 dark:text-red-400" : "";

const standingsColumns: Column<Team>[] = [
  { key: "team", label: "Team", render: (t) => <span className="font-semibold">{t.team}</span> },
  { key: "games", label: "G", numeric: true },
  { key: "wins", label: "W", numeric: true },
  { key: "losses", label: "L", numeric: true, lowerIsBetter: true },
  { key: "ties", label: "T", numeric: true },
  { key: "win_pct", label: "PCT", numeric: true, title: "Winning percentage (ties count as half)", render: (t) => formatAvg(t.win_pct) },
  { key: "total_runs", label: "RS", numeric: true, title: "Runs scored" },
  { key: "runs_allowed", label: "RA", numeric: true, lowerIsBetter: true, title: "Runs allowed", render: (t) => t.runs_allowed ?? "—" },
  {
    key: "run_diff",
    label: "DIFF",
    numeric: true,
    title: "Run differential",
    render: (t) => <span className={`font-semibold ${diffClass(t.run_diff)}`}>{formatSigned(t.run_diff)}</span>,
  },
  {
    key: "pythag_pct",
    label: "xPCT",
    numeric: true,
    title: "Pythagorean expected winning % from runs scored and allowed",
    render: (t) => formatAvg(t.pythag_pct),
  },
  { key: "batting_avg", label: "AVG", numeric: true, render: (t) => formatAvg(t.batting_avg) },
  { key: "ops", label: "OPS", numeric: true, render: (t) => formatAvg(t.ops) },
  { key: "total_home_runs", label: "HR", numeric: true },
  { key: "team_era", label: "ERA", numeric: true, lowerIsBetter: true, render: (t) => formatRate(t.team_era) },
  { key: "team_whip", label: "WHIP", numeric: true, lowerIsBetter: true, render: (t) => formatRate(t.team_whip) },
];

const rosterBatting = battingColumns.filter((c) =>
  ["player_name", "position", "games_played", "plate_appearances", "batting_avg", "obp", "slg", "ops", "home_runs", "rbi"].includes(c.key)
);
const rosterPitching = pitchingColumns.filter((c) =>
  ["player_name", "games", "innings_pitched", "era", "fip", "whip", "k_per_9", "strikeouts_pitched"].includes(c.key)
);

function TeamDetailPanel({ team, range }: { team: string; range: DateRange }) {
  const { data, loading, error } = useAsync(
    () => Promise.all([fetchTeam(team, range), fetchTeamGames(team, range)]),
    [team, range.start, range.end]
  );
  if (loading) {
    return (
      <div className="flex justify-center py-10 text-blue-600">
        <Spinner className="w-6 h-6" />
      </div>
    );
  }
  if (error || !data) return <p className="p-4 text-sm text-red-600">{error}</p>;
  const [detail, games] = data;
  const recent = games.slice(-10).reverse();

  return (
    <div className="p-4 space-y-4">
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <div className="card overflow-hidden">
          <h3 className="card-title px-4 pt-3 pb-2">Hitters</h3>
          <StatTable columns={rosterBatting} rows={detail.roster_batting} rowKey={(r) => r.player_id} initialSort={{ key: "ops", desc: true }} showRank={false} />
        </div>
        <div className="card overflow-hidden">
          <h3 className="card-title px-4 pt-3 pb-2">Pitchers</h3>
          <StatTable columns={rosterPitching} rows={detail.roster_pitching} rowKey={(r) => r.player_id} initialSort={{ key: "innings_pitched", desc: true }} showRank={false} />
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <div className="xl:col-span-2">
          <LineChart
            data={games.map((g) => ({ date: formatDate(g.game_date, false), scored: g.runs_scored, allowed: g.runs_allowed }))}
            xKey="date"
            lines={[
              { key: "scored", color: "#10b981", name: "Runs scored" },
              { key: "allowed", color: "#ef4444", name: "Runs allowed" },
            ]}
            title="Runs by game"
            height={240}
          />
        </div>
        <PieChart
          data={detail.roster_batting.filter((p) => p.runs > 0).map((p) => ({ name: lastName(p.player_name), value: p.runs }))}
          title="Who scores the runs"
          height={240}
        />
      </div>

      <div className="card overflow-x-auto">
        <h3 className="card-title px-4 pt-3 pb-2">Last 10 games</h3>
        <table className="data-table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Opponent</th>
              <th>Result</th>
              <th className="num">Score</th>
              <th className="num">H</th>
              <th className="num">HR</th>
            </tr>
          </thead>
          <tbody>
            {recent.map((g) => (
              <tr key={g.game_id}>
                <td>{formatDate(g.game_date)}</td>
                <td>{g.opponent}</td>
                <td>
                  <span className={g.result === "W" ? "badge bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300" : g.result === "L" ? "badge bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300" : "badge-gray"}>
                    {g.result ?? "?"}
                  </span>
                </td>
                <td className="num">
                  {g.runs_scored}-{g.runs_allowed ?? "?"}
                </td>
                <td className="num">{g.hits}</td>
                <td className="num">{g.home_runs}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function TeamsPage() {
  const { range, version } = useData();
  const { data, error, loading, reload } = useAsync(() => fetchTeams(range), [range.start, range.end, version]);
  const [expanded, setExpanded] = useState<string | null>(null);

  return (
    <div>
      <PageHeader title="Teams & Standings" subtitle="Click a team for its roster, game log and scoring breakdown." actions={<SharedDateRange />} />
      {loading && !data ? (
        <LoadingSpinner />
      ) : error ? (
        <ErrorMessage message={error} onRetry={reload} />
      ) : data && data.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="card overflow-hidden">
          <StatTable
            columns={standingsColumns}
            rows={data ?? []}
            rowKey={(t) => t.team}
            initialSort={{ key: "win_pct", desc: true }}
            onRowClick={(t) => setExpanded((cur) => (cur === t.team ? null : t.team))}
            expandedKey={expanded}
            renderExpanded={(t) => <TeamDetailPanel team={t.team} range={range} />}
          />
        </div>
      )}
      <p className="text-xs muted mt-2">
        Results come from runs scored by each side in a game. xPCT is the record a team “should” have from its run differential.
      </p>
    </div>
  );
}
