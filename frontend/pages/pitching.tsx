import { useEffect, useState } from "react";
import { Download } from "lucide-react";
import LoadingSpinner from "../components/LoadingSpinner";
import ErrorMessage from "../components/ErrorMessage";
import BarChart from "../components/Charts/BarChart";
import LineChart from "../components/Charts/LineChart";
import ExportButton from "../components/ExportButton";
import { fetchPitchingStats, fetchPlayerTrend } from "../utils/api";
import type { PitchingStats, TrendData } from "../types";

const API_BASE = "http://localhost:8000";

export default function PitchingPage() {
  const [pitchers, setPitchers] = useState<PitchingStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [topPitcherTrend, setTopPitcherTrend] = useState<TrendData[]>([]);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchPitchingStats();
      setPitchers(data);
      if (data.length > 0) {
        try {
          const trend = await fetchPlayerTrend(data[0].player_name, "era");
          setTopPitcherTrend(trend.filter((t) => t.value !== null));
        } catch {
          // ignore trend errors
        }
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to load pitching data.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  if (loading) return <LoadingSpinner />;
  if (error) return <ErrorMessage message={error} onRetry={load} />;

  const top6 = pitchers.slice(0, 6);

  const strikeoutBarData = top6.map((p) => ({
    pitcher: p.player_name.split(" ")[1] || p.player_name,
    strikeouts: p.strikeouts_pitched,
    walks: p.walks_allowed,
    era: p.era,
  }));

  const eraBarData = top6.map((p) => ({
    pitcher: p.player_name.split(" ")[1] || p.player_name,
    era: p.era,
    whip: p.whip,
  }));

  const topName = pitchers.length > 0 ? pitchers[0].player_name : "";
  const trendChartData = topPitcherTrend
    .filter((t) => t.value !== null)
    .map((t, i) => ({
      game: `G${i + 1}`,
      era: t.value,
    }));

  return (
    <div>
      <h1 className="page-title">Pitching Analytics</h1>
      <p className="page-subtitle">Pitching leaderboard sorted by ERA</p>

      {/* Export Button */}
      <div className="flex justify-end mb-4">
        <ExportButton
          label="Export CSV"
          href={`${API_BASE}/export/pitching-csv`}
          icon={<Download className="w-4 h-4" />}
        />
      </div>

      {/* Leaderboard Table */}
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-card border border-gray-100 dark:border-slate-700 overflow-hidden mb-6">
        <div className="overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th className="w-10">Rank</th>
                <th>Player</th>
                <th>Team</th>
                <th>ERA</th>
                <th>WHIP</th>
                <th>K/9</th>
                <th>BB/9</th>
                <th>IP</th>
                <th>SO</th>
                <th>BB</th>
                <th>GS</th>
              </tr>
            </thead>
            <tbody>
              {pitchers.length === 0 ? (
                <tr>
                  <td colSpan={11} className="text-center text-gray-400 py-8">
                    No pitching data.
                  </td>
                </tr>
              ) : (
                pitchers.map((p, i) => (
                  <tr key={p.player_name}>
                    <td className="text-gray-400 font-medium">{i + 1}</td>
                    <td className="font-semibold text-gray-900 dark:text-slate-100">
                      {p.player_name}
                    </td>
                    <td>
                      <span className="badge bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300">
                        {p.team}
                      </span>
                    </td>
                    <td
                      className={`font-bold ${
                        p.era < 3.0
                          ? "text-emerald-600"
                          : p.era < 4.5
                          ? "text-amber-600"
                          : "text-red-600"
                      }`}
                    >
                      {p.era.toFixed(2)}
                    </td>
                    <td>{p.whip.toFixed(2)}</td>
                    <td className="font-semibold text-blue-700 dark:text-blue-400">
                      {p.k_per_9.toFixed(1)}
                    </td>
                    <td>{p.bb_per_9.toFixed(1)}</td>
                    <td>{p.innings_pitched.toFixed(1)}</td>
                    <td>{p.strikeouts_pitched}</td>
                    <td>{p.walks_allowed}</td>
                    <td className="text-gray-500 dark:text-slate-400">{p.games_started}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
        <BarChart
          data={strikeoutBarData as Record<string, unknown>[]}
          xKey="pitcher"
          bars={[
            { key: "strikeouts", color: "#3b82f6", name: "Strikeouts" },
            { key: "walks", color: "#ef4444", name: "Walks Allowed" },
          ]}
          title="Strikeouts vs Walks — Top Pitchers"
          height={280}
        />
        <BarChart
          data={eraBarData as Record<string, unknown>[]}
          xKey="pitcher"
          bars={[
            { key: "era", color: "#8b5cf6", name: "ERA" },
            { key: "whip", color: "#f59e0b", name: "WHIP" },
          ]}
          title="ERA & WHIP Comparison"
          height={280}
        />
      </div>

      {trendChartData.length > 0 && (
        <LineChart
          data={trendChartData as Record<string, unknown>[]}
          xKey="game"
          lines={[{ key: "era", color: "#8b5cf6", name: "ERA per Game" }]}
          title={`${topName} — ERA Trend by Game`}
          height={260}
        />
      )}
    </div>
  );
}
