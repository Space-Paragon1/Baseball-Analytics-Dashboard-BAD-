import { useMemo, useState } from "react";
import { CloudDownload } from "lucide-react";
import { Alert, AuthGate, ConfirmDialog, PageHeader, Spinner } from "../components/ui";
import { useData } from "../context/DataContext";
import { useToast } from "../context/ToastContext";
import { useAsync } from "../hooks/useAsync";
import { fetchMlbTeams, getErrorMessage, importMlb } from "../utils/api";
import type { ImportResult } from "../types";

const iso = (d: Date) => d.toISOString().slice(0, 10);
const THIS_YEAR = new Date().getFullYear();
const SEASONS = Array.from({ length: 12 }, (_, i) => THIS_YEAR - i);

export default function ImportPage() {
  const { addToast } = useToast();
  const { dataChanged } = useData();
  const [season, setSeason] = useState(THIS_YEAR);
  const [teamId, setTeamId] = useState("");
  const [start, setStart] = useState(() => iso(new Date(Date.now() - 7 * 864e5)));
  const [end, setEnd] = useState(() => iso(new Date()));
  const [mode, setMode] = useState<"append" | "replace">("append");
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const teams = useAsync(() => fetchMlbTeams(season), [season]);
  const teamName = useMemo(() => teams.data?.find((t) => String(t.id) === teamId)?.name, [teams.data, teamId]);

  const setPreset = (preset: "week" | "month" | "season") => {
    const year = season;
    const today = new Date();
    const seasonEnd = year === THIS_YEAR ? today : new Date(`${year}-11-15T00:00:00`);
    if (preset === "season") {
      setStart(`${year}-03-15`);
      setEnd(iso(seasonEnd));
      return;
    }
    const days = preset === "week" ? 7 : 30;
    setEnd(iso(seasonEnd));
    setStart(iso(new Date(seasonEnd.getTime() - days * 864e5)));
  };

  const run = async () => {
    setConfirming(false);
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const res = await importMlb({ start_date: start, end_date: end, team_id: teamId ? Number(teamId) : undefined, mode });
      setResult(res);
      addToast(res.message, "success");
      dataChanged();
    } catch (e) {
      setError(getErrorMessage(e, "Import failed."));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <PageHeader
        title="Import MLB Data"
        subtitle="Pull real box scores from MLB's public Stats API. Regular season and postseason games only."
      />
      <AuthGate admin action="import MLB data">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 card p-5 space-y-5">
            <div className="grid sm:grid-cols-2 gap-4">
              <label>
                <span className="field-label">Season (for the team list)</span>
                <select className="input-field w-full" value={season} onChange={(e) => setSeason(Number(e.target.value))}>
                  {SEASONS.map((y) => (
                    <option key={y}>{y}</option>
                  ))}
                </select>
              </label>
              <label>
                <span className="field-label">Team</span>
                <select className="input-field w-full" value={teamId} onChange={(e) => setTeamId(e.target.value)} disabled={teams.loading}>
                  <option value="">All teams</option>
                  {(teams.data ?? []).map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
                {teams.error && <span className="text-xs text-red-600 mt-1 block">{teams.error}</span>}
              </label>
              <label>
                <span className="field-label">From</span>
                <input type="date" className="input-field w-full" value={start} max={end} onChange={(e) => setStart(e.target.value)} />
              </label>
              <label>
                <span className="field-label">To</span>
                <input type="date" className="input-field w-full" value={end} min={start} onChange={(e) => setEnd(e.target.value)} />
              </label>
            </div>

            <div className="flex flex-wrap gap-2 items-center">
              <span className="text-xs muted">Quick ranges for {season}:</span>
              <button type="button" className="btn-secondary text-xs py-1" onClick={() => setPreset("week")}>
                Last week
              </button>
              <button type="button" className="btn-secondary text-xs py-1" onClick={() => setPreset("month")}>
                Last 30 days
              </button>
              <button type="button" className="btn-secondary text-xs py-1" onClick={() => setPreset("season")}>
                Full season
              </button>
            </div>

            <fieldset>
              <legend className="field-label">Existing data</legend>
              <div className="flex flex-wrap gap-4 text-sm">
                <label className="flex items-center gap-2">
                  <input type="radio" checked={mode === "append"} onChange={() => setMode("append")} />
                  Add to it (re-importing a game updates it)
                </label>
                <label className="flex items-center gap-2">
                  <input type="radio" checked={mode === "replace"} onChange={() => setMode("replace")} />
                  Replace all of it
                </label>
              </div>
            </fieldset>

            <button
              className="btn-primary"
              disabled={busy || !start || !end}
              onClick={() => (mode === "replace" ? setConfirming(true) : run())}
            >
              {busy ? <Spinner /> : <CloudDownload className="w-4 h-4" />}
              {busy ? "Importing (this can take a minute)..." : "Import games"}
            </button>

            {result && (
              <Alert kind="success">
                <p className="font-semibold">{result.message}</p>
              </Alert>
            )}
            {error && <Alert kind="error">{error}</Alert>}
          </div>

          <div className="card p-5 text-sm space-y-3 h-fit">
            <h3 className="card-title">Good to know</h3>
            <p className="muted">Up to 250 games per import. A full season for one team fits; for all teams, pick a few weeks at a time.</p>
            <p className="muted">
              Players keep their MLB ids, so the same player is matched across imports and trades. Team names use the
              club name, like &ldquo;Cardinals&rdquo;.
            </p>
            <p className="muted">
              Data comes from MLB Advanced Media and is for personal, non-commercial use under{" "}
              <a className="text-blue-600 dark:text-blue-400 hover:underline" href="http://gdx.mlb.com/components/copyright.txt" target="_blank" rel="noreferrer">
                MLB&apos;s terms
              </a>
              .
            </p>
          </div>
        </div>

        <ConfirmDialog
          open={confirming}
          title="Replace all data?"
          message={`Every existing record will be deleted and replaced with MLB games from ${start} to ${end}${teamName ? ` for the ${teamName}` : ""}.`}
          confirmLabel="Replace and import"
          onConfirm={run}
          onCancel={() => setConfirming(false)}
        />
      </AuthGate>
    </div>
  );
}
