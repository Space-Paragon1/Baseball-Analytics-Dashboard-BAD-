import { useEffect, useState } from "react";
import { Search, ChevronDown, ChevronUp, Download, FileText } from "lucide-react";
import LoadingSpinner from "../components/LoadingSpinner";
import ErrorMessage from "../components/ErrorMessage";
import LineChart from "../components/Charts/LineChart";
import BarChart from "../components/Charts/BarChart";
import ExportButton from "../components/ExportButton";
import { fetchBattingStats, fetchPlayer, fetchPlayerTrend } from "../utils/api";
import type { BattingStats, TrendData, GameRecord } from "../types";

function formatAvg(val: number): string {
  if (!val && val !== 0) return ".000";
  return "." + Math.round(val * 1000).toString().padStart(3, "0");
}

const TEAMS = ["All Teams", "Eagles", "Tigers", "Wolves"];
const API_BASE = "http://localhost:8000";

export default function PlayersPage() {
  const [players, setPlayers] = useState<BattingStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [teamFilter, setTeamFilter] = useState("All Teams");
  const [expandedPlayer, setExpandedPlayer] = useState<string | null>(null);
  const [trendData, setTrendData] = useState<TrendData[]>([]);
  const [gameLogs, setGameLogs] = useState<GameRecord[]>([]);
  const [trendLoading, setTrendLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchBattingStats();
      setPlayers(data);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to load player data.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const handleRowClick = async (playerName: string) => {
    if (expandedPlayer === playerName) {
      setExpandedPlayer(null);
      setTrendData([]);
      setGameLogs([]);
      return;
    }
    setExpandedPlayer(playerName);
    setTrendLoading(true);
    try {
      const [trend, detail] = await Promise.all([
        fetchPlayerTrend(playerName, "batting_avg"),
        fetchPlayer(playerName),
      ]);
      setTrendData(trend);
      setGameLogs(
        (detail.game_logs || []).filter((g) => g.at_bats > 0)
      );
    } catch {
      setTrendData([]);
      setGameLogs([]);
    } finally {
      setTrendLoading(false);
    }
  };

  const filtered = players.filter((p) => {
    const matchesSearch = p.player_name
      .toLowerCase()
      .includes(search.toLowerCase());
    const matchesTeam =
      teamFilter === "All Teams" || p.team === teamFilter;
    return matchesSearch && matchesTeam;
  });

  if (loading) return <LoadingSpinner />;
  if (error) return <ErrorMessage message={error} onRetry={load} />;

  const trendChartData = trendData
    .filter((t) => t.value !== null)
    .map((t) => ({
      game_date: t.game_date.slice(5),
      batting_avg: t.value,
    }));

  const gameLogChartData = gameLogs.map((g, i) => ({
    game: `G${i + 1}`,
    hits: g.hits,
    doubles: g.doubles,
    triples: g.triples,
    home_runs: g.home_runs,
  }));

  return (
    <div>
      <h1 className="page-title">Player Analytics</h1>
      <p className="page-subtitle">
        Batting leaderboard — click a row to expand player details
      </p>

      {/* Filters + Export */}
      <div className="flex flex-col sm:flex-row gap-3 mb-5 items-start sm:items-center">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            className="input-field w-full pl-9"
            placeholder="Search players..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <select
          className="input-field"
          value={teamFilter}
          onChange={(e) => setTeamFilter(e.target.value)}
        >
          {TEAMS.map((t) => (
            <option key={t}>{t}</option>
          ))}
        </select>
        <ExportButton
          label="Export CSV"
          href={`${API_BASE}/export/batting-csv`}
          icon={<Download className="w-4 h-4" />}
        />
      </div>

      {/* Leaderboard Table */}
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-card border border-gray-100 dark:border-slate-700 overflow-hidden mb-4">
        <div className="overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th className="w-10">Rank</th>
                <th>Player</th>
                <th>Team</th>
                <th>Pos</th>
                <th>AVG</th>
                <th>OBP</th>
                <th>SLG</th>
                <th>OPS</th>
                <th>HR</th>
                <th>RBI</th>
                <th>R</th>
                <th>H</th>
                <th>AB</th>
                <th className="w-8"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={14} className="text-center text-gray-400 py-8">
                    No players found.
                  </td>
                </tr>
              ) : (
                filtered.map((p, i) => (
                  <>
                    <tr
                      key={p.player_name}
                      onClick={() => handleRowClick(p.player_name)}
                      className={
                        expandedPlayer === p.player_name ? "bg-blue-50 dark:bg-slate-700" : ""
                      }
                    >
                      <td className="text-gray-400 font-medium">{i + 1}</td>
                      <td className="font-semibold text-gray-900 dark:text-slate-100">
                        {p.player_name}
                      </td>
                      <td>
                        <span className="badge bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300">
                          {p.team}
                        </span>
                      </td>
                      <td className="text-gray-500 dark:text-slate-400">{p.position}</td>
                      <td className="font-bold text-blue-700 dark:text-blue-400">
                        {formatAvg(p.batting_avg)}
                      </td>
                      <td>{formatAvg(p.obp)}</td>
                      <td>{formatAvg(p.slg)}</td>
                      <td className="font-semibold">{p.ops.toFixed(3)}</td>
                      <td>{p.home_runs}</td>
                      <td>{p.rbi}</td>
                      <td>{p.runs}</td>
                      <td>{p.hits}</td>
                      <td className="text-gray-500 dark:text-slate-400">{p.at_bats}</td>
                      <td>
                        {expandedPlayer === p.player_name ? (
                          <ChevronUp className="w-4 h-4 text-blue-500" />
                        ) : (
                          <ChevronDown className="w-4 h-4 text-gray-400" />
                        )}
                      </td>
                    </tr>

                    {/* Expanded row */}
                    {expandedPlayer === p.player_name && (
                      <tr key={`${p.player_name}-expanded`}>
                        <td colSpan={14} className="p-0 bg-blue-50 dark:bg-slate-700">
                          <div className="p-4">
                            {/* Export PDF button */}
                            <div className="flex justify-end mb-3">
                              <ExportButton
                                label="Export PDF"
                                href={`${API_BASE}/export/player-pdf/${encodeURIComponent(p.player_name)}`}
                                icon={<FileText className="w-4 h-4" />}
                                variant="primary"
                              />
                            </div>
                            {trendLoading ? (
                              <div className="flex justify-center py-8">
                                <div className="w-6 h-6 border-2 border-blue-300 border-t-blue-700 rounded-full animate-spin" />
                              </div>
                            ) : (
                              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                                <LineChart
                                  data={trendChartData as Record<string, unknown>[]}
                                  xKey="game_date"
                                  lines={[
                                    {
                                      key: "batting_avg",
                                      color: "#3b82f6",
                                      name: "Batting AVG (per game)",
                                    },
                                  ]}
                                  title={`${p.player_name} — Batting AVG Trend`}
                                  height={220}
                                />
                                <BarChart
                                  data={gameLogChartData as Record<string, unknown>[]}
                                  xKey="game"
                                  bars={[
                                    { key: "hits", color: "#3b82f6", name: "Hits" },
                                    { key: "doubles", color: "#10b981", name: "2B" },
                                    { key: "triples", color: "#f59e0b", name: "3B" },
                                    { key: "home_runs", color: "#ef4444", name: "HR" },
                                  ]}
                                  title={`${p.player_name} — Hits by Type per Game`}
                                  height={220}
                                />
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                  </>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
