import { useEffect, useState, useCallback } from "react";
import {
  Trophy,
  Activity,
  Target,
  TrendingUp,
} from "lucide-react";
import StatsCard from "../components/StatsCard";
import InsightsPanel from "../components/InsightsPanel";
import LineChart from "../components/Charts/LineChart";
import BarChart from "../components/Charts/BarChart";
import LoadingSpinner from "../components/LoadingSpinner";
import ErrorMessage from "../components/ErrorMessage";
import DateRangePicker from "../components/DateRangePicker";
import { fetchDashboard, fetchInsights } from "../utils/api";
import type { DashboardData } from "../types";

function formatAvg(val: number): string {
  if (!val && val !== 0) return ".000";
  return "." + Math.round(val * 1000).toString().padStart(3, "0");
}

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [insights, setInsights] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const load = useCallback(async (start?: string, end?: string) => {
    setLoading(true);
    setError(null);
    try {
      const [dashData, insightData] = await Promise.all([
        fetchDashboard(start || undefined, end || undefined),
        fetchInsights(),
      ]);
      setData(dashData);
      setInsights(insightData);
    } catch (e: unknown) {
      const msg =
        e instanceof Error ? e.message : "Failed to connect to backend API.";
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleDateChange = (start: string, end: string) => {
    setStartDate(start);
    setEndDate(end);
    load(start, end);
  };

  if (loading) return <LoadingSpinner />;
  if (error || !data) return <ErrorMessage message={error || "No data"} onRetry={() => load(startDate, endDate)} />;

  const top5ChartData = (data.top5_batters || []).map((p) => ({
    player_name: p.player_name.split(" ")[1] || p.player_name,
    batting_avg: p.batting_avg,
    home_runs: p.home_runs,
    rbi: p.rbi,
  }));

  const trendData = (data.recent_trend || []).map((t) => ({
    ...t,
    game_date: t.game_date.slice(5),
  }));

  return (
    <div>
      <h1 className="page-title">Dashboard</h1>
      <p className="page-subtitle">League overview and performance summary</p>

      {/* Date Range Picker */}
      <div className="mb-5">
        <DateRangePicker onChange={handleDateChange} />
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatsCard
          title="Total Games"
          value={data.total_games}
          subtitle="Across all teams"
          icon={Activity}
          color="blue"
        />
        <StatsCard
          title="Total Runs"
          value={data.total_runs}
          subtitle="Season total"
          icon={TrendingUp}
          color="green"
          trend="up"
        />
        <StatsCard
          title="League AVG"
          value={formatAvg(data.league_batting_avg)}
          subtitle="Combined batting average"
          icon={Target}
          color="amber"
        />
        <StatsCard
          title="Top Performer"
          value={
            data.top_performer
              ? formatAvg(data.top_performer.batting_avg)
              : "N/A"
          }
          subtitle={
            data.top_performer
              ? `${data.top_performer.player_name} (${data.top_performer.team})`
              : "No data"
          }
          icon={Trophy}
          color="purple"
          trend="up"
        />
      </div>

      {/* Insights */}
      {insights.length > 0 && (
        <div className="mb-6">
          <InsightsPanel insights={insights} />
        </div>
      )}

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <LineChart
          data={trendData}
          xKey="game_date"
          lines={[
            { key: "total_runs", color: "#3b82f6", name: "Runs" },
            { key: "total_hits", color: "#10b981", name: "Hits" },
          ]}
          title="Recent Performance Trend (Runs & Hits by Date)"
          height={280}
        />
        <BarChart
          data={top5ChartData}
          xKey="player_name"
          bars={[
            { key: "batting_avg", color: "#3b82f6", name: "Batting AVG" },
            { key: "home_runs", color: "#f59e0b", name: "Home Runs" },
          ]}
          title="Top 5 Batters"
          height={280}
        />
      </div>

      {/* Top Pitcher Card */}
      {data.top_pitcher && (
        <div className="mt-4 bg-white dark:bg-slate-800 rounded-xl border border-gray-100 dark:border-slate-700 shadow-card p-5">
          <h3 className="font-semibold text-gray-800 dark:text-slate-200 text-sm mb-3">
            Top Pitcher
          </h3>
          <div className="flex flex-wrap gap-6">
            <div>
              <p className="text-xs text-gray-500 dark:text-slate-400 mb-0.5">Player</p>
              <p className="font-bold text-gray-900 dark:text-slate-100">
                {data.top_pitcher.player_name}
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-500 dark:text-slate-400 mb-0.5">Team</p>
              <p className="font-semibold text-gray-700 dark:text-slate-300">
                {data.top_pitcher.team}
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-500 dark:text-slate-400 mb-0.5">ERA</p>
              <p className="font-bold text-blue-700 dark:text-blue-400">
                {data.top_pitcher.era.toFixed(2)}
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-500 dark:text-slate-400 mb-0.5">WHIP</p>
              <p className="font-bold text-gray-800 dark:text-slate-200">
                {data.top_pitcher.whip.toFixed(2)}
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-500 dark:text-slate-400 mb-0.5">Strikeouts</p>
              <p className="font-bold text-gray-800 dark:text-slate-200">
                {data.top_pitcher.strikeouts_pitched}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
