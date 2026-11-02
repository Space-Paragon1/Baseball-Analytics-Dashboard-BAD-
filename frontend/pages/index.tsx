import Link from "next/link";
import { Activity, Target, TrendingUp, Trophy } from "lucide-react";
import StatsCard from "../components/StatsCard";
import InsightsPanel from "../components/InsightsPanel";
import LineChart from "../components/Charts/LineChart";
import BarChart from "../components/Charts/BarChart";
import LoadingSpinner from "../components/LoadingSpinner";
import ErrorMessage from "../components/ErrorMessage";
import { SharedDateRange } from "../components/Filters";
import { EmptyState, PageHeader } from "../components/ui";
import { useData } from "../context/DataContext";
import { useAsync } from "../hooks/useAsync";
import { fetchDashboard, fetchInsights } from "../utils/api";
import { formatAvg, formatDate, formatIP, formatRate, formatSigned, lastName } from "../utils/format";

export default function DashboardPage() {
  const { range, version } = useData();
  const { data, error, loading, reload } = useAsync(
    () => Promise.all([fetchDashboard(range), fetchInsights(range)]),
    [range.start, range.end, version]
  );

  const header = <PageHeader title="Dashboard" subtitle="League overview and performance summary" actions={<SharedDateRange />} />;

  if (loading && !data) return (<>{header}<LoadingSpinner /></>);
  if (error) return (<>{header}<ErrorMessage message={error} onRetry={reload} /></>);
  if (!data) return null;
  const [dash, insights] = data;

  if (dash.total_games === 0) {
    return (
      <>
        {header}
        <EmptyState title={range.start || range.end ? "No games in this date range" : "No data yet"} />
      </>
    );
  }

  const games = dash.total_games;
  const top5 = dash.top5_batters.map((p) => ({ name: lastName(p.player_name), AVG: p.batting_avg, OBP: p.obp, SLG: p.slg }));
  const trend = dash.recent_trend.map((t) => ({ date: formatDate(t.game_date, false), runs: t.runs_per_game, hits: +(t.total_hits / t.games).toFixed(2) }));

  return (
    <div className={loading ? "opacity-60 transition-opacity" : ""}>
      {header}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatsCard title="Games" value={games} subtitle={`${(dash.total_runs / games).toFixed(1)} runs per game`} icon={Activity} color="blue" />
        <StatsCard title="League AVG" value={formatAvg(dash.league_batting_avg)} subtitle={`${formatAvg(dash.league_ops)} OPS`} icon={TrendingUp} color="green" />
        <StatsCard title="League ERA" value={formatRate(dash.league_era)} subtitle={`${dash.total_runs} total runs`} icon={Target} color="amber" />
        <StatsCard
          title="Batting Leader"
          value={dash.top_performer ? formatAvg(dash.top_performer.batting_avg) : "—"}
          subtitle={dash.top_performer ? `${dash.top_performer.player_name} (${dash.top_performer.team})` : "No qualified batters"}
          icon={Trophy}
          color="purple"
        />
      </div>

      {insights.length > 0 && (
        <div className="mb-6">
          <InsightsPanel insights={insights} />
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
        <LineChart
          data={trend}
          xKey="date"
          lines={[
            { key: "runs", color: "#3b82f6", name: "Runs per game" },
            { key: "hits", color: "#10b981", name: "Hits per game" },
          ]}
          title="Scoring Trend (per game, both teams)"
          height={280}
        />
        <BarChart
          data={top5}
          xKey="name"
          bars={[
            { key: "AVG", color: "#3b82f6", name: "AVG" },
            { key: "OBP", color: "#10b981", name: "OBP" },
            { key: "SLG", color: "#f59e0b", name: "SLG" },
          ]}
          title="Top 5 Hitters by OPS"
          height={280}
          valueFormatter={formatAvg}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="card overflow-hidden lg:col-span-2">
          <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100 dark:border-slate-700">
            <h3 className="card-title">Standings</h3>
            <Link href="/teams" className="text-xs text-blue-600 dark:text-blue-400 hover:underline">
              Team details
            </Link>
          </div>
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Team</th>
                  <th className="num">W</th>
                  <th className="num">L</th>
                  <th className="num" title="Winning percentage (ties count as half)">PCT</th>
                  <th className="num" title="Run differential">DIFF</th>
                  <th className="num">OPS</th>
                  <th className="num">ERA</th>
                </tr>
              </thead>
              <tbody>
                {dash.teams.map((t) => (
                  <tr key={t.team}>
                    <td className="font-semibold">{t.team}</td>
                    <td className="num">{t.wins}</td>
                    <td className="num">{t.losses}</td>
                    <td className="num">{formatAvg(t.win_pct)}</td>
                    <td className={`num ${t.run_diff != null && t.run_diff > 0 ? "text-emerald-600 dark:text-emerald-400" : t.run_diff != null && t.run_diff < 0 ? "text-red-600 dark:text-red-400" : ""}`}>
                      {formatSigned(t.run_diff)}
                    </td>
                    <td className="num">{formatAvg(t.ops)}</td>
                    <td className="num">{formatRate(t.team_era)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {dash.top_pitcher && (
          <div className="card p-5">
            <h3 className="card-title mb-3">Top Pitcher (ERA)</h3>
            <p className="text-lg font-bold text-gray-900 dark:text-slate-100">{dash.top_pitcher.player_name}</p>
            <p className="text-sm muted mb-4">{dash.top_pitcher.team}</p>
            <dl className="grid grid-cols-3 gap-3 text-center">
              {[
                ["ERA", formatRate(dash.top_pitcher.era)],
                ["FIP", formatRate(dash.top_pitcher.fip)],
                ["WHIP", formatRate(dash.top_pitcher.whip)],
                ["IP", formatIP(dash.top_pitcher.innings_pitched)],
                ["SO", String(dash.top_pitcher.strikeouts_pitched)],
              ].map(([label, value]) => (
                <div key={label} className="bg-gray-50 dark:bg-slate-900/50 rounded-lg py-2">
                  <dt className="text-xs muted">{label}</dt>
                  <dd className="font-bold text-gray-900 dark:text-slate-100 tabular-nums">{value}</dd>
                </div>
              ))}
            </dl>
          </div>
        )}
      </div>
    </div>
  );
}
