import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import { ChevronLeft, ChevronRight, Pencil, Plus, Trash2 } from "lucide-react";
import RecordForm from "../components/RecordForm";
import LoadingSpinner from "../components/LoadingSpinner";
import ErrorMessage from "../components/ErrorMessage";
import DateRangePicker from "../components/DateRangePicker";
import { SearchBox, TeamSelect } from "../components/Filters";
import { ConfirmDialog, EmptyState, Modal, PageHeader } from "../components/ui";
import { useAuth } from "../context/AuthContext";
import { useData } from "../context/DataContext";
import { useToast } from "../context/ToastContext";
import { useAsync } from "../hooks/useAsync";
import { deleteRecord, fetchRecords, getErrorMessage, updateRecord } from "../utils/api";
import { formatDate, formatIP } from "../utils/format";
import type { DateRange, GameRecord } from "../types";

const PAGE_SIZE = 25;

function useDebounced<T>(value: T, ms = 300): T {
  const [v, setV] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setV(value), ms);
    return () => clearTimeout(id);
  }, [value, ms]);
  return v;
}

function battingLine(r: GameRecord): string {
  const pa = r.at_bats + r.walks + r.hit_by_pitch + r.sacrifice_flies;
  if (!pa) return "—";
  const extras = [r.home_runs && `${r.home_runs} HR`, r.rbi && `${r.rbi} RBI`, r.walks && `${r.walks} BB`].filter(Boolean);
  return `${r.hits}-${r.at_bats}${extras.length ? `, ${extras.join(", ")}` : ""}`;
}

function pitchingLine(r: GameRecord): string {
  if (!r.innings_pitched && !r.hits_allowed && !r.walks_allowed) return "—";
  return `${formatIP(r.innings_pitched)} IP, ${r.earned_runs} ER, ${r.strikeouts_pitched} K`;
}

export default function RecordsPage() {
  const { user } = useAuth();
  const { meta, version, dataChanged } = useData();
  const { addToast } = useToast();
  const [typedSearch, setSearch] = useState<string | null>(null);
  const [team, setTeam] = useState("");
  const [range, setRange] = useState<DateRange>({ start: "", end: "" });
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState<GameRecord | null>(null);
  const [deleting, setDeleting] = useState<GameRecord | null>(null);
  const [busy, setBusy] = useState(false);
  const router = useRouter();
  // Links like /records?search=GM-1234 (from Game Mode) pre-fill the search box.
  const search = typedSearch ?? (typeof router.query.search === "string" ? router.query.search : "");
  const q = useDebounced(search);

  // Any filter change goes back to page 1.
  const filter =
    <T,>(setter: (v: T) => void) =>
    (v: T) => {
      setter(v);
      setPage(1);
    };

  const { data, error, loading, reload } = useAsync(
    () => fetchRecords({ search: q, team, start_date: range.start, end_date: range.end, page, page_size: PAGE_SIZE }),
    [q, team, range.start, range.end, page, version]
  );

  const pages = data ? Math.max(1, Math.ceil(data.total / PAGE_SIZE)) : 1;

  const confirmDelete = async () => {
    if (!deleting) return;
    setBusy(true);
    try {
      await deleteRecord(deleting.id);
      addToast(`Deleted ${deleting.player_name}'s record for ${deleting.game_id}.`, "success");
      setDeleting(null);
      dataChanged();
    } catch (e) {
      addToast(getErrorMessage(e), "error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <PageHeader
        title="Game Log"
        subtitle="Every box-score line in the database. Signed-in users can edit; admins can delete."
        actions={
          user && (
            <Link href="/add-game" className="btn-primary">
              <Plus className="w-4 h-4" /> Add record
            </Link>
          )
        }
      />

      <div className="flex flex-wrap gap-3 mb-4 items-center">
        <SearchBox value={search} onChange={filter(setSearch)} placeholder="Player, game ID or opponent" />
        <TeamSelect value={team} onChange={filter(setTeam)} />
        <DateRangePicker value={range} onChange={filter(setRange)} min={meta?.date_range.min} max={meta?.date_range.max} />
      </div>

      {loading && !data ? (
        <LoadingSpinner />
      ) : error ? (
        <ErrorMessage message={error} onRetry={reload} />
      ) : data && data.total === 0 && !q && !team && !range.start && !range.end ? (
        <EmptyState />
      ) : (
        <div className={`card overflow-hidden ${loading ? "opacity-60" : ""}`}>
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Game</th>
                  <th>Player</th>
                  <th>Team</th>
                  <th>Pos</th>
                  <th>vs</th>
                  <th>Batting</th>
                  <th>Pitching</th>
                  {user && <th className="num">Actions</th>}
                </tr>
              </thead>
              <tbody>
                {data?.items.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="text-center muted py-10">
                      No records match these filters.
                    </td>
                  </tr>
                ) : (
                  data?.items.map((r) => (
                    <tr key={r.id}>
                      <td>{formatDate(r.game_date)}</td>
                      <td className="muted font-mono text-xs">{r.game_id}</td>
                      <td className="font-semibold">{r.player_name}</td>
                      <td>
                        <span className="badge-blue">{r.team}</span>
                      </td>
                      <td className="muted">{r.position}</td>
                      <td>{r.opponent}</td>
                      <td className="tabular-nums">{battingLine(r)}</td>
                      <td className="tabular-nums">{pitchingLine(r)}</td>
                      {user && (
                        <td className="num">
                          <button className="btn-ghost" onClick={() => setEditing(r)} aria-label={`Edit ${r.player_name} ${r.game_id}`} title="Edit">
                            <Pencil className="w-4 h-4" />
                          </button>
                          {user.is_admin && (
                            <button
                              className="btn-ghost hover:text-red-600"
                              onClick={() => setDeleting(r)}
                              aria-label={`Delete ${r.player_name} ${r.game_id}`}
                              title="Delete"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </td>
                      )}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100 dark:border-slate-700 text-sm">
            <span className="muted">
              {data?.total.toLocaleString()} records · page {page} of {pages}
            </span>
            <div className="flex gap-2">
              <button className="btn-secondary" disabled={page <= 1} onClick={() => setPage((p) => p - 1)} aria-label="Previous page">
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button className="btn-secondary" disabled={page >= pages} onClick={() => setPage((p) => p + 1)} aria-label="Next page">
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      <Modal open={!!editing} title={editing ? `Edit ${editing.player_name} · ${editing.game_id}` : ""} onClose={() => setEditing(null)} wide>
        {editing && (
          <RecordForm
            key={editing.id}
            initial={editing}
            submitLabel="Save changes"
            onCancel={() => setEditing(null)}
            onSubmit={async (values) => {
              await updateRecord(editing.id, values);
              addToast("Record updated.", "success");
              setEditing(null);
              dataChanged();
            }}
          />
        )}
      </Modal>

      <ConfirmDialog
        open={!!deleting}
        title="Delete record?"
        message={
          deleting && (
            <>
              This removes <strong>{deleting.player_name}</strong>&apos;s line for game <strong>{deleting.game_id}</strong> (
              {formatDate(deleting.game_date)}). It can&apos;t be undone.
            </>
          )
        }
        confirmLabel="Delete"
        busy={busy}
        onConfirm={confirmDelete}
        onCancel={() => setDeleting(null)}
      />
    </div>
  );
}
