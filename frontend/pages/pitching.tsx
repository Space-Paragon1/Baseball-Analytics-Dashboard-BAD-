import { useMemo, useState } from "react";
import { Download } from "lucide-react";
import StatTable from "../components/StatTable";
import PlayerDetail from "../components/PlayerDetail";
import BarChart from "../components/Charts/BarChart";
import ExportButton from "../components/ExportButton";
import LoadingSpinner from "../components/LoadingSpinner";
import ErrorMessage from "../components/ErrorMessage";
import { QualifiedToggle, SearchBox, SharedDateRange, TeamSelect } from "../components/Filters";
import { pitchingColumns } from "../components/columns";
import { EmptyState, PageHeader } from "../components/ui";
import { useData } from "../context/DataContext";
import { useAsync } from "../hooks/useAsync";
import { exportUrl, fetchPitchingStats } from "../utils/api";
import { formatRate, lastName } from "../utils/format";

export default function PitchingPage() {
  const { range, version } = useData();
  const { data, error, loading, reload } = useAsync(() => fetchPitchingStats(range), [range.start, range.end, version]);
  const [search, setSearch] = useState("");
  const [team, setTeam] = useState("");
  const [qualifiedOnly, setQualifiedOnly] = useState(true);
  const [expanded, setExpanded] = useState<number | null>(null);

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (data ?? []).filter(
      (p) => (!q || p.player_name.toLowerCase().includes(q)) && (!team || p.team === team) && (!qualifiedOnly || p.qualified)
    );
  }, [data, search, team, qualifiedOnly]);

  // Charts show the pitchers with the most innings among the current rows.
  const workhorses = useMemo(() => [...rows].sort((a, b) => b.outs_pitched - a.outs_pitched).slice(0, 8), [rows]);

  const csv = exportUrl("/export/pitching-csv", {
    start_date: range.start,
    end_date: range.end,
    team,
    qualified_only: qualifiedOnly,
  });

  return (
    <div>
      <PageHeader
        title="Pitching Leaders"
        subtitle="ERA shows results; FIP strips out defense and luck using only strikeouts, walks and home runs."
        actions={<SharedDateRange />}
      />

      <div className="flex flex-wrap gap-3 mb-4 items-center">
        <SearchBox value={search} onChange={setSearch} />
        <TeamSelect value={team} onChange={setTeam} />
        <QualifiedToggle checked={qualifiedOnly} onChange={setQualifiedOnly} hint="At least 1 inning pitched per team game, and 10 minimum" />
        <div className="ml-auto">
          <ExportButton label="Export CSV" href={csv} icon={<Download className="w-4 h-4" />} />
        </div>
      </div>

      {loading && !data ? (
        <LoadingSpinner />
      ) : error ? (
        <ErrorMessage message={error} onRetry={reload} />
      ) : data && data.length === 0 ? (
        <EmptyState />
      ) : (
        <>
          <div className={`card overflow-hidden mb-6 ${loading ? "opacity-60" : ""}`}>
            <StatTable
              columns={pitchingColumns}
              rows={rows}
              rowKey={(r) => r.player_id}
              initialSort={{ key: "era", desc: false }}
              onRowClick={(r) => setExpanded((cur) => (cur === r.player_id ? null : r.player_id))}
              expandedKey={expanded}
              renderExpanded={(r) => <PlayerDetail playerId={r.player_id} kind="pitching" range={range} />}
              emptyMessage={qualifiedOnly ? "No qualified pitchers match. Try turning off “Qualified only”." : "No pitchers match."}
            />
          </div>
          {!qualifiedOnly && <p className="text-xs muted -mt-4 mb-4">† Below the qualifying minimum: 1 inning per team game, and at least 10.</p>}

          {workhorses.length > 0 && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <BarChart
                data={workhorses.map((p) => ({ name: lastName(p.player_name), SO: p.strikeouts_pitched, BB: p.walks_allowed }))}
                xKey="name"
                bars={[
                  { key: "SO", color: "#3b82f6", name: "Strikeouts" },
                  { key: "BB", color: "#ef4444", name: "Walks" },
                ]}
                title="Strikeouts vs Walks (most innings)"
                height={280}
              />
              <BarChart
                data={workhorses.map((p) => ({ name: lastName(p.player_name), ERA: p.era ?? 0, FIP: p.fip ?? 0 }))}
                xKey="name"
                bars={[
                  { key: "ERA", color: "#8b5cf6", name: "ERA" },
                  { key: "FIP", color: "#f59e0b", name: "FIP" },
                ]}
                title="ERA vs FIP: a big gap hints at luck"
                height={280}
                valueFormatter={(v) => formatRate(v)}
              />
            </div>
          )}
        </>
      )}
    </div>
  );
}
