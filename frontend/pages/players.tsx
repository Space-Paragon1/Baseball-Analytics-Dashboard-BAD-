import { useMemo, useState } from "react";
import { Download } from "lucide-react";
import StatTable from "../components/StatTable";
import PlayerDetail from "../components/PlayerDetail";
import ExportButton from "../components/ExportButton";
import LoadingSpinner from "../components/LoadingSpinner";
import ErrorMessage from "../components/ErrorMessage";
import { QualifiedToggle, SearchBox, SharedDateRange, TeamSelect } from "../components/Filters";
import { battingColumns } from "../components/columns";
import { EmptyState, PageHeader } from "../components/ui";
import { useData } from "../context/DataContext";
import { useAsync } from "../hooks/useAsync";
import { exportUrl, fetchBattingStats } from "../utils/api";

export default function PlayersPage() {
  const { range, version } = useData();
  const { data, error, loading, reload } = useAsync(() => fetchBattingStats(range), [range.start, range.end, version]);
  const [search, setSearch] = useState("");
  const [team, setTeam] = useState("");
  const [qualifiedOnly, setQualifiedOnly] = useState(true);
  const [expanded, setExpanded] = useState<number | null>(null);

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (data ?? []).filter(
      (p) =>
        (!q || p.player_name.toLowerCase().includes(q)) &&
        (!team || p.team === team) &&
        (!qualifiedOnly || p.qualified)
    );
  }, [data, search, team, qualifiedOnly]);

  const csv = exportUrl("/export/batting-csv", {
    start_date: range.start,
    end_date: range.end,
    team,
    qualified_only: qualifiedOnly,
  });

  return (
    <div>
      <PageHeader
        title="Batting Leaders"
        subtitle="Click a column to sort, or a row for trends and game log. Hover a header to see how it's calculated."
        actions={<SharedDateRange />}
      />

      <div className="flex flex-wrap gap-3 mb-4 items-center">
        <SearchBox value={search} onChange={setSearch} />
        <TeamSelect value={team} onChange={setTeam} />
        <QualifiedToggle
          checked={qualifiedOnly}
          onChange={setQualifiedOnly}
          hint="At least 3.1 plate appearances per team game (the MLB batting title rule), and 20 minimum"
        />
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
        <div className={`card overflow-hidden ${loading ? "opacity-60" : ""}`}>
          <StatTable
            columns={battingColumns}
            rows={rows}
            rowKey={(r) => r.player_id}
            initialSort={{ key: "batting_avg", desc: true }}
            onRowClick={(r) => setExpanded((cur) => (cur === r.player_id ? null : r.player_id))}
            expandedKey={expanded}
            renderExpanded={(r) => <PlayerDetail playerId={r.player_id} kind="batting" range={range} />}
            emptyMessage={qualifiedOnly ? "No qualified batters match. Try turning off “Qualified only”." : "No players match."}
          />
        </div>
      )}
      {!qualifiedOnly && <p className="text-xs muted mt-2">† Below the qualifying minimum: 3.1 plate appearances per team game, and at least 20.</p>}
    </div>
  );
}
