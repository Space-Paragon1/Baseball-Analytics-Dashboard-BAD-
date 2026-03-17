import { useEffect, useState } from "react";
import {
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  Radar,
  Legend,
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts";
import LoadingSpinner from "../components/LoadingSpinner";
import ErrorMessage from "../components/ErrorMessage";
import { fetchPlayers, fetchComparePlayers } from "../utils/api";
import type { BattingStats, PlayerCompare } from "../types";
import { useToast } from "../context/ToastContext";

function formatAvg(val: number | null | undefined): string {
  if (val == null) return "N/A";
  return "." + Math.round(val * 1000).toString().padStart(3, "0");
}

const COMPARE_COLORS = ["#3b82f6", "#f59e0b", "#10b981"];

const BATTING_STATS: { key: keyof PlayerCompare; label: string; format?: "avg" | "num" }[] = [
  { key: "batting_avg", label: "Batting AVG", format: "avg" },
  { key: "obp", label: "OBP", format: "avg" },
  { key: "slg", label: "SLG", format: "avg" },
  { key: "ops", label: "OPS" },
  { key: "home_runs", label: "Home Runs" },
  { key: "rbi", label: "RBI" },
  { key: "hits", label: "Hits" },
  { key: "at_bats", label: "At Bats" },
  { key: "doubles", label: "Doubles" },
  { key: "triples", label: "Triples" },
  { key: "runs", label: "Runs" },
  { key: "walks", label: "Walks" },
  { key: "strikeouts", label: "Strikeouts" },
  { key: "games_played", label: "Games Played" },
];

const PITCHING_STATS: { key: keyof PlayerCompare; label: string }[] = [
  { key: "era", label: "ERA" },
  { key: "whip", label: "WHIP" },
  { key: "k_per_9", label: "K/9" },
  { key: "innings_pitched", label: "IP" },
  { key: "strikeouts_pitched", label: "Strikeouts" },
  { key: "walks_allowed", label: "Walks Allowed" },
  { key: "hits_allowed", label: "Hits Allowed" },
  { key: "earned_runs", label: "Earned Runs" },
];

const RADAR_KEYS: (keyof PlayerCompare)[] = ["batting_avg", "obp", "slg", "ops"];
const RADAR_LABELS: Record<string, string> = {
  batting_avg: "AVG",
  obp: "OBP",
  slg: "SLG",
  ops: "OPS",
};

const BAR_KEYS: { key: keyof PlayerCompare; label: string; color: string }[] = [
  { key: "batting_avg", label: "Batting AVG", color: "#3b82f6" },
  { key: "obp", label: "OBP", color: "#10b981" },
  { key: "slg", label: "SLG", color: "#f59e0b" },
  { key: "ops", label: "OPS", color: "#8b5cf6" },
  { key: "home_runs", label: "HR", color: "#ef4444" },
  { key: "rbi", label: "RBI", color: "#f97316" },
];

function isBestValue(stat: keyof PlayerCompare, value: number | null | undefined, players: PlayerCompare[]): boolean {
  if (value == null) return false;
  const vals = players.map((p) => p[stat] as number | null | undefined).filter((v) => v != null) as number[];
  if (vals.length === 0) return false;
  // Lower is better for: era, whip, strikeouts (batter), walks_allowed
  const lowerBetter: (keyof PlayerCompare)[] = ["era", "whip", "walks_allowed", "strikeouts"];
  if (lowerBetter.includes(stat)) {
    return value === Math.min(...vals);
  }
  return value === Math.max(...vals);
}

export default function ComparePage() {
  const { addToast } = useToast();
  const [allPlayers, setAllPlayers] = useState<BattingStats[]>([]);
  const [selected, setSelected] = useState<string[]>(["", "", ""]);
  const [compareData, setCompareData] = useState<PlayerCompare[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingPlayers, setLoadingPlayers] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchPlayers()
      .then(setAllPlayers)
      .catch(() => setError("Failed to load player list."))
      .finally(() => setLoadingPlayers(false));
  }, []);

  const handleSelect = (idx: number, name: string) => {
    setSelected((prev) => {
      const next = [...prev];
      next[idx] = name;
      return next;
    });
  };

  const handleCompare = async () => {
    const names = selected.filter((n) => n.trim() !== "");
    if (names.length < 2) {
      setError("Please select at least 2 players to compare.");
      addToast("Select at least 2 players to compare.", "info");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const data = await fetchComparePlayers(names);
      setCompareData(data);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to compare players.");
    } finally {
      setLoading(false);
    }
  };

  // Radar chart data
  const radarData = RADAR_KEYS.map((key) => {
    const point: Record<string, string | number> = { stat: RADAR_LABELS[key] ?? key };
    compareData.forEach((p) => {
      point[p.player_name] = (p[key] as number) ?? 0;
    });
    return point;
  });

  // Grouped bar chart data
  const barData = BAR_KEYS.map(({ key, label }) => {
    const point: Record<string, string | number> = { stat: label };
    compareData.forEach((p) => {
      point[p.player_name] = (p[key] as number) ?? 0;
    });
    return point;
  });

  if (loadingPlayers) return <LoadingSpinner />;

  return (
    <div>
      <h1 className="page-title">Compare Players</h1>
      <p className="page-subtitle">Select 2-3 players to compare side by side</p>

      {/* Player Selection */}
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-card border border-gray-100 dark:border-slate-700 p-5 mb-6">
        <div className="flex flex-wrap gap-4 items-end">
          {[0, 1, 2].map((idx) => (
            <div key={idx} className="flex-1 min-w-[160px]">
              <label className="block text-xs font-semibold text-gray-600 dark:text-slate-400 mb-1.5">
                Player {idx + 1} {idx === 2 && <span className="text-gray-400">(optional)</span>}
              </label>
              <select
                className="input-field w-full dark:bg-slate-700 dark:border-slate-600 dark:text-slate-100"
                value={selected[idx]}
                onChange={(e) => handleSelect(idx, e.target.value)}
              >
                <option value="">-- Select player --</option>
                {allPlayers.map((p) => (
                  <option key={p.player_name} value={p.player_name}>
                    {p.player_name} ({p.team})
                  </option>
                ))}
              </select>
            </div>
          ))}
          <button
            onClick={handleCompare}
            disabled={loading}
            className="btn-primary"
          >
            {loading ? "Comparing..." : "Compare"}
          </button>
        </div>
        {error && (
          <p className="mt-3 text-sm text-red-600 dark:text-red-400">{error}</p>
        )}
      </div>

      {compareData.length >= 2 && (
        <>
          {/* Side-by-side stat table */}
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-card border border-gray-100 dark:border-slate-700 overflow-hidden mb-6">
            <div className="overflow-x-auto">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Stat</th>
                    {compareData.map((p, i) => (
                      <th key={p.player_name} style={{ color: COMPARE_COLORS[i] }}>
                        {p.player_name}
                        <span className="block text-xs font-normal text-gray-400">{p.team}</span>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td colSpan={compareData.length + 1} className="bg-blue-50 dark:bg-slate-700 px-4 py-2">
                      <span className="text-xs font-bold text-blue-700 dark:text-blue-400 uppercase tracking-wider">Batting</span>
                    </td>
                  </tr>
                  {BATTING_STATS.map(({ key, label, format }) => (
                    <tr key={key}>
                      <td className="font-medium text-gray-700 dark:text-slate-300">{label}</td>
                      {compareData.map((p) => {
                        const val = p[key] as number | null | undefined;
                        const best = isBestValue(key, val, compareData);
                        const displayVal = format === "avg"
                          ? formatAvg(val as number | null)
                          : val != null
                          ? typeof val === "number"
                            ? Number.isInteger(val) ? val : val.toFixed(3)
                            : val
                          : "N/A";
                        return (
                          <td
                            key={p.player_name}
                            className={best ? "font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20" : ""}
                          >
                            {displayVal}
                            {best && <span className="ml-1 text-xs text-emerald-500">&#9650;</span>}
                          </td>
                        );
                      })}
                    </tr>
                  ))}

                  {compareData.some((p) => p.era != null) && (
                    <>
                      <tr>
                        <td colSpan={compareData.length + 1} className="bg-purple-50 dark:bg-purple-900/30 px-4 py-2">
                          <span className="text-xs font-bold text-purple-700 dark:text-purple-400 uppercase tracking-wider">Pitching</span>
                        </td>
                      </tr>
                      {PITCHING_STATS.map(({ key, label }) => (
                        <tr key={key}>
                          <td className="font-medium text-gray-700 dark:text-slate-300">{label}</td>
                          {compareData.map((p) => {
                            const val = p[key] as number | null | undefined;
                            if (val == null) return <td key={p.player_name} className="text-gray-400">N/A</td>;
                            const best = isBestValue(key, val, compareData);
                            const display = typeof val === "number"
                              ? Number.isInteger(val) ? val : val.toFixed(2)
                              : val;
                            return (
                              <td
                                key={p.player_name}
                                className={best ? "font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20" : ""}
                              >
                                {display}
                                {best && <span className="ml-1 text-xs text-emerald-500">&#9650;</span>}
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Grouped Bar Chart */}
            <div className="bg-white dark:bg-slate-800 rounded-xl shadow-card border border-gray-100 dark:border-slate-700 p-5">
              <h3 className="text-sm font-semibold text-gray-700 dark:text-slate-300 mb-4">
                Key Stats Comparison
              </h3>
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={barData} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="stat" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Legend />
                  {compareData.map((p, i) => (
                    <Bar key={p.player_name} dataKey={p.player_name} fill={COMPARE_COLORS[i]} radius={[3, 3, 0, 0]} />
                  ))}
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Radar Chart */}
            <div className="bg-white dark:bg-slate-800 rounded-xl shadow-card border border-gray-100 dark:border-slate-700 p-5">
              <h3 className="text-sm font-semibold text-gray-700 dark:text-slate-300 mb-4">
                AVG / OBP / SLG / OPS Radar
              </h3>
              <ResponsiveContainer width="100%" height={280}>
                <RadarChart data={radarData}>
                  <PolarGrid />
                  <PolarAngleAxis dataKey="stat" tick={{ fontSize: 11 }} />
                  {compareData.map((p, i) => (
                    <Radar
                      key={p.player_name}
                      name={p.player_name}
                      dataKey={p.player_name}
                      stroke={COMPARE_COLORS[i]}
                      fill={COMPARE_COLORS[i]}
                      fillOpacity={0.15}
                    />
                  ))}
                  <Legend />
                  <Tooltip />
                </RadarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
