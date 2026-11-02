import { FileText } from "lucide-react";
import LineChart from "./Charts/LineChart";
import BarChart from "./Charts/BarChart";
import ExportButton from "./ExportButton";
import { Spinner } from "./ui";
import { useAsync } from "../hooks/useAsync";
import { exportUrl, fetchPlayer, fetchPlayerTrend } from "../utils/api";
import { formatAvg, formatDate, formatIP, formatRate } from "../utils/format";
import type { DateRange } from "../types";

/** Expanded leaderboard row: trend charts and recent games for one player. */
export default function PlayerDetail({ playerId, kind, range }: { playerId: number; kind: "batting" | "pitching"; range: DateRange }) {
  const stat = kind === "batting" ? "ops" : "era";
  const { data, loading, error } = useAsync(
    () => Promise.all([fetchPlayer(playerId, range), fetchPlayerTrend(playerId, stat, range)]),
    [playerId, kind, range.start, range.end]
  );

  if (loading) {
    return (
      <div className="flex justify-center py-10 text-blue-600">
        <Spinner className="w-6 h-6" />
      </div>
    );
  }
  if (error || !data) return <p className="p-4 text-sm text-red-600">{error ?? "Couldn't load player."}</p>;
  const [player, trend] = data;

  const trendData = trend.map((t) => ({ date: formatDate(t.game_date, false), game: t.value, season: t.cumulative }));
  const logs = player.game_logs
    .filter((g) => (kind === "batting" ? g.at_bats + g.walks + g.hit_by_pitch + g.sacrifice_flies > 0 : g.innings_pitched > 0 || g.hits_allowed > 0))
    .slice(-10)
    .reverse();

  const pdf = exportUrl(`/export/player-pdf/${playerId}`, { start_date: range.start, end_date: range.end });

  return (
    <div className="p-4 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm muted">
          {player.player_name} · {player.team} · {player.position}
        </p>
        <ExportButton label="Player card (PDF)" href={pdf} icon={<FileText className="w-4 h-4" />} variant="primary" />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <LineChart
          data={trendData}
          xKey="date"
          lines={[
            { key: "season", color: "#3b82f6", name: `Season ${stat.toUpperCase()}` },
            { key: "game", color: "#94a3b8", name: "Single game", dashed: true },
          ]}
          title={`${stat.toUpperCase()} trend`}
          height={220}
          valueFormatter={kind === "batting" ? formatAvg : (v) => formatRate(v)}
        />
        {kind === "batting" ? (
          <BarChart
            data={logs
              .slice()
              .reverse()
              .map((g) => ({ date: formatDate(g.game_date, false), H: g.hits, HR: g.home_runs, RBI: g.rbi }))}
            xKey="date"
            bars={[
              { key: "H", color: "#3b82f6", name: "Hits" },
              { key: "HR", color: "#ef4444", name: "HR" },
              { key: "RBI", color: "#f59e0b", name: "RBI" },
            ]}
            title="Last 10 games"
            height={220}
          />
        ) : (
          <BarChart
            data={logs
              .slice()
              .reverse()
              .map((g) => ({ date: formatDate(g.game_date, false), SO: g.strikeouts_pitched, BB: g.walks_allowed, ER: g.earned_runs }))}
            xKey="date"
            bars={[
              { key: "SO", color: "#3b82f6", name: "Strikeouts" },
              { key: "BB", color: "#f59e0b", name: "Walks" },
              { key: "ER", color: "#ef4444", name: "Earned runs" },
            ]}
            title="Last 10 appearances"
            height={220}
          />
        )}
      </div>

      <div className="card overflow-x-auto">
        <table className="data-table">
          <thead>
            {kind === "batting" ? (
              <tr>
                <th>Date</th><th>Opp</th><th className="num">AB</th><th className="num">H</th><th className="num">2B</th>
                <th className="num">3B</th><th className="num">HR</th><th className="num">R</th><th className="num">RBI</th>
                <th className="num">BB</th><th className="num">SO</th>
              </tr>
            ) : (
              <tr>
                <th>Date</th><th>Opp</th><th className="num">IP</th><th className="num">H</th><th className="num">ER</th>
                <th className="num">BB</th><th className="num">SO</th><th className="num">HR</th>
              </tr>
            )}
          </thead>
          <tbody>
            {logs.map((g) =>
              kind === "batting" ? (
                <tr key={g.id}>
                  <td>{formatDate(g.game_date)}</td><td>{g.opponent}</td><td className="num">{g.at_bats}</td>
                  <td className="num">{g.hits}</td><td className="num">{g.doubles}</td><td className="num">{g.triples}</td>
                  <td className="num">{g.home_runs}</td><td className="num">{g.runs}</td><td className="num">{g.rbi}</td>
                  <td className="num">{g.walks}</td><td className="num">{g.strikeouts}</td>
                </tr>
              ) : (
                <tr key={g.id}>
                  <td>{formatDate(g.game_date)}</td><td>{g.opponent}</td><td className="num">{formatIP(g.innings_pitched)}</td>
                  <td className="num">{g.hits_allowed}</td><td className="num">{g.earned_runs}</td>
                  <td className="num">{g.walks_allowed}</td><td className="num">{g.strikeouts_pitched}</td>
                  <td className="num">{g.home_runs_allowed}</td>
                </tr>
              )
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
