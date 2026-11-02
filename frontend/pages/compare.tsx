import { useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  PolarAngleAxis,
  PolarGrid,
  Radar,
  RadarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { SharedDateRange } from "../components/Filters";
import { PageHeader, Spinner } from "../components/ui";
import { useChartTheme } from "../components/Charts/chartTheme";
import { useData } from "../context/DataContext";
import { useToast } from "../context/ToastContext";
import { fetchComparePlayers, getErrorMessage } from "../utils/api";
import { formatAvg, formatIP, formatPct, formatRate, lastName } from "../utils/format";
import type { BattingStats, ComparePlayer, PitchingStats } from "../types";

const COLORS = ["#3b82f6", "#f59e0b", "#10b981"];

type Row<T> = { key: keyof T; label: string; fmt: (v: number | null) => string; lowerIsBetter?: boolean };

const BATTING_ROWS: Row<BattingStats>[] = [
  { key: "batting_avg", label: "AVG", fmt: formatAvg },
  { key: "obp", label: "OBP", fmt: formatAvg },
  { key: "slg", label: "SLG", fmt: formatAvg },
  { key: "ops", label: "OPS", fmt: formatAvg },
  { key: "woba", label: "wOBA", fmt: formatAvg },
  { key: "iso", label: "ISO", fmt: formatAvg },
  { key: "babip", label: "BABIP", fmt: formatAvg },
  { key: "k_pct", label: "K%", fmt: formatPct, lowerIsBetter: true },
  { key: "bb_pct", label: "BB%", fmt: formatPct },
  { key: "home_runs", label: "Home runs", fmt: String },
  { key: "rbi", label: "RBI", fmt: String },
  { key: "runs", label: "Runs", fmt: String },
  { key: "hits", label: "Hits", fmt: String },
  { key: "plate_appearances", label: "Plate appearances", fmt: String },
  { key: "games_played", label: "Games", fmt: String },
];

const PITCHING_ROWS: Row<PitchingStats>[] = [
  { key: "era", label: "ERA", fmt: (v) => formatRate(v), lowerIsBetter: true },
  { key: "fip", label: "FIP", fmt: (v) => formatRate(v), lowerIsBetter: true },
  { key: "whip", label: "WHIP", fmt: (v) => formatRate(v), lowerIsBetter: true },
  { key: "k_per_9", label: "K/9", fmt: (v) => formatRate(v, 1) },
  { key: "bb_per_9", label: "BB/9", fmt: (v) => formatRate(v, 1), lowerIsBetter: true },
  { key: "k_bb", label: "K/BB", fmt: (v) => formatRate(v) },
  { key: "innings_pitched", label: "Innings", fmt: formatIP },
  { key: "strikeouts_pitched", label: "Strikeouts", fmt: String },
];

function best(values: (number | null)[], lowerIsBetter?: boolean): number | null {
  const nums = values.filter((v): v is number => v != null);
  if (nums.length < 2) return null;
  return lowerIsBetter ? Math.min(...nums) : Math.max(...nums);
}

function CompareRows<T>({ title, rows, players, pick, tone }: {
  title: string;
  rows: Row<T>[];
  players: ComparePlayer[];
  pick: (p: ComparePlayer) => T | null;
  tone: string;
}) {
  return (
    <>
      <tr>
        <td colSpan={players.length + 1} className={`${tone} px-4 py-2`}>
          <span className="text-xs font-bold uppercase tracking-wider">{title}</span>
        </td>
      </tr>
      {rows.map((row) => {
        const values = players.map((p) => {
          const s = pick(p);
          return s ? ((s[row.key] as unknown as number | null) ?? null) : null;
        });
        const top = best(values, row.lowerIsBetter);
        return (
          <tr key={String(row.key)}>
            <td className="font-medium text-gray-700 dark:text-slate-300">{row.label}</td>
            {values.map((v, i) => {
              const isBest = v != null && v === top;
              return (
                <td key={players[i].player_id} className={`num ${isBest ? "font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20" : ""}`}>
                  {v == null ? "—" : row.fmt(v)}
                </td>
              );
            })}
          </tr>
        );
      })}
    </>
  );
}

export default function ComparePage() {
  const { meta, range } = useData();
  const { addToast } = useToast();
  const t = useChartTheme();
  const [selected, setSelected] = useState<string[]>(["", "", ""]);
  const [players, setPlayers] = useState<ComparePlayer[]>([]);
  const [loading, setLoading] = useState(false);

  const handleCompare = async () => {
    const ids = selected.filter(Boolean).map(Number);
    if (new Set(ids).size < 2) {
      addToast("Pick at least 2 different players.", "info");
      return;
    }
    setLoading(true);
    try {
      setPlayers(await fetchComparePlayers([...new Set(ids)], range));
    } catch (e) {
      addToast(getErrorMessage(e), "error");
    } finally {
      setLoading(false);
    }
  };

  const hitters = players.filter((p) => p.batting);
  const radar = ["batting_avg", "obp", "slg", "woba", "iso"].map((key) => {
    const point: Record<string, string | number> = { stat: { batting_avg: "AVG", obp: "OBP", slg: "SLG", woba: "wOBA", iso: "ISO" }[key]! };
    hitters.forEach((p) => (point[p.player_name] = (p.batting?.[key as keyof BattingStats] as number) ?? 0));
    return point;
  });
  const counting = (["home_runs", "rbi", "runs", "hits"] as const).map((key) => {
    const point: Record<string, string | number> = { stat: { home_runs: "HR", rbi: "RBI", runs: "R", hits: "H" }[key] };
    hitters.forEach((p) => (point[p.player_name] = p.batting?.[key] ?? 0));
    return point;
  });

  return (
    <div>
      <PageHeader title="Compare Players" subtitle="Pick 2-3 players. The best value in each row is highlighted." actions={<SharedDateRange />} />

      <div className="card p-5 mb-6">
        <div className="flex flex-wrap gap-4 items-end">
          {[0, 1, 2].map((idx) => (
            <label key={idx} className="flex-1 min-w-[180px]">
              <span className="field-label">
                Player {idx + 1} {idx === 2 && <span className="font-normal text-gray-400">(optional)</span>}
              </span>
              <select
                className="input-field w-full"
                value={selected[idx]}
                onChange={(e) => setSelected((prev) => prev.map((v, i) => (i === idx ? e.target.value : v)))}
              >
                <option value="">Select a player</option>
                {(meta?.players ?? []).map((p) => (
                  <option key={p.player_id} value={p.player_id}>
                    {p.player_name} ({p.team}, {p.position})
                  </option>
                ))}
              </select>
            </label>
          ))}
          <button onClick={handleCompare} disabled={loading} className="btn-primary">
            {loading && <Spinner />}
            Compare
          </button>
        </div>
      </div>

      {players.length >= 2 && (
        <>
          <div className="card overflow-x-auto mb-6">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Stat</th>
                  {players.map((p, i) => (
                    <th key={p.player_id} className="num" style={{ color: COLORS[i] }}>
                      {p.player_name}
                      <span className="block text-xs font-normal text-gray-400">
                        {p.team} · {p.position}
                      </span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {players.some((p) => p.batting) && (
                  <CompareRows title="Batting" rows={BATTING_ROWS} players={players} pick={(p) => p.batting} tone="bg-blue-50 dark:bg-slate-700 text-blue-700 dark:text-blue-300" />
                )}
                {players.some((p) => p.pitching) && (
                  <CompareRows title="Pitching" rows={PITCHING_ROWS} players={players} pick={(p) => p.pitching} tone="bg-purple-50 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300" />
                )}
              </tbody>
            </table>
          </div>

          {hitters.length >= 2 && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div className="chart-container">
                <h3 className="card-title mb-4">Rate stats</h3>
                <ResponsiveContainer width="100%" height={280}>
                  <RadarChart data={radar}>
                    <PolarGrid stroke={t.grid} />
                    <PolarAngleAxis dataKey="stat" tick={{ fontSize: 11, fill: t.axis }} />
                    {hitters.map((p) => (
                      <Radar key={p.player_id} name={p.player_name} dataKey={p.player_name} stroke={COLORS[players.indexOf(p)]} fill={COLORS[players.indexOf(p)]} fillOpacity={0.15} />
                    ))}
                    <Legend />
                    <Tooltip contentStyle={t.tooltip} formatter={(v) => formatAvg(Number(v))} />
                  </RadarChart>
                </ResponsiveContainer>
              </div>
              <div className="chart-container">
                <h3 className="card-title mb-4">Counting stats</h3>
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={counting} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={t.grid} />
                    <XAxis dataKey="stat" tick={{ fontSize: 11, fill: t.axis }} />
                    <YAxis tick={{ fontSize: 11, fill: t.axis }} />
                    <Tooltip contentStyle={t.tooltip} cursor={{ fill: t.grid, opacity: 0.4 }} />
                    <Legend formatter={(v: string) => lastName(v)} />
                    {hitters.map((p) => (
                      <Bar key={p.player_id} dataKey={p.player_name} fill={COLORS[players.indexOf(p)]} radius={[3, 3, 0, 0]} />
                    ))}
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
