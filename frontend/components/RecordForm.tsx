import { FormEvent, useMemo, useState } from "react";
import { Alert, Spinner } from "./ui";
import { useData } from "../context/DataContext";
import { getErrorMessage } from "../utils/api";
import type { GameRecordInput } from "../types";

const POSITIONS = ["C", "1B", "2B", "3B", "SS", "LF", "CF", "RF", "OF", "IF", "DH", "P", "SP", "RP", "UT"];

const BATTING: [keyof GameRecordInput, string][] = [
  ["at_bats", "At bats"],
  ["hits", "Hits"],
  ["doubles", "Doubles"],
  ["triples", "Triples"],
  ["home_runs", "Home runs"],
  ["runs", "Runs"],
  ["rbi", "RBI"],
  ["walks", "Walks"],
  ["strikeouts", "Strikeouts"],
  ["hit_by_pitch", "Hit by pitch"],
  ["sacrifice_flies", "Sac flies"],
];

const PITCHING: [keyof GameRecordInput, string][] = [
  ["innings_pitched", "Innings pitched"],
  ["earned_runs", "Earned runs"],
  ["hits_allowed", "Hits allowed"],
  ["walks_allowed", "Walks allowed"],
  ["strikeouts_pitched", "Strikeouts"],
  ["home_runs_allowed", "HR allowed"],
  ["hit_batsmen", "Hit batters"],
];

const TEXT_FIELDS = ["player_name", "team", "position", "game_date", "game_id", "opponent"] as const;

export function emptyRecord(): GameRecordInput {
  return {
    player_name: "", team: "", position: "", game_date: "", game_id: "", opponent: "",
    at_bats: 0, hits: 0, doubles: 0, triples: 0, home_runs: 0, runs: 0, rbi: 0, strikeouts: 0, walks: 0,
    hit_by_pitch: 0, sacrifice_flies: 0, innings_pitched: 0, earned_runs: 0, hits_allowed: 0, walks_allowed: 0,
    strikeouts_pitched: 0, home_runs_allowed: 0, hit_batsmen: 0,
  };
}

type FormValues = Record<string, string>;

function toForm(r: GameRecordInput): FormValues {
  return Object.fromEntries(Object.entries(r).map(([k, v]) => [k, v == null ? "" : String(v)]));
}

/** Quick checks that mirror the server's rules, so mistakes show before submitting. */
export function validateRecord(v: FormValues): string | null {
  const n = (k: string) => Number(v[k] || 0);
  for (const k of TEXT_FIELDS) if (!v[k]?.trim()) return `Fill in ${k.replace("_", " ")}.`;
  if (v.team.trim().toLowerCase() === v.opponent.trim().toLowerCase()) return "Team and opponent must be different.";
  if (n("hits") > n("at_bats")) return "Hits can't be more than at bats.";
  if (n("doubles") + n("triples") + n("home_runs") > n("hits")) return "Doubles + triples + home runs can't be more than hits.";
  if (n("strikeouts") > n("at_bats")) return "Strikeouts can't be more than at bats.";
  if (n("home_runs_allowed") > n("hits_allowed")) return "Home runs allowed can't be more than hits allowed.";
  const frac = Math.round((n("innings_pitched") % 1) * 10);
  if (frac > 2) return "Innings use .1 and .2 for thirds of an inning (6.2 = 6 2/3).";
  return null;
}

interface RecordFormProps {
  initial?: GameRecordInput;
  submitLabel: string;
  onSubmit: (values: GameRecordInput) => Promise<void>;
  onCancel?: () => void;
  resetOnSuccess?: boolean;
}

export default function RecordForm({ initial, submitLabel, onSubmit, onCancel, resetOnSuccess = false }: RecordFormProps) {
  const { meta } = useData();
  const [values, setValues] = useState<FormValues>(() => toForm(initial ?? emptyRecord()));
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const playersByName = useMemo(
    () => new Map((meta?.players ?? []).map((p) => [p.player_name.toLowerCase(), p])),
    [meta]
  );
  const positions = useMemo(() => Array.from(new Set([...POSITIONS, ...(meta?.positions ?? [])])), [meta]);

  const set = (key: string, value: string) => setValues((v) => ({ ...v, [key]: value }));

  const onPlayerName = (name: string) => {
    const known = playersByName.get(name.trim().toLowerCase());
    setValues((v) => ({
      ...v,
      player_name: name,
      // Fill in team and position for a known player, without overwriting what's typed.
      team: v.team || known?.team || "",
      position: v.position || known?.position || "",
    }));
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const problem = validateRecord(values);
    if (problem) {
      setError(problem);
      return;
    }
    setBusy(true);
    setError(null);
    const body = Object.fromEntries(
      Object.entries(values)
        .filter(([k]) => k !== "id" && k !== "player_id")
        .map(([k, v]) => [k, (TEXT_FIELDS as readonly string[]).includes(k) ? v.trim() : Number(v || 0)])
    ) as unknown as GameRecordInput;
    try {
      await onSubmit(body);
      if (resetOnSuccess) {
        // Keep game details so several players from one game can be entered quickly.
        setValues({ ...toForm(emptyRecord()), game_date: values.game_date, game_id: values.game_id, team: values.team, opponent: values.opponent });
      }
    } catch (err) {
      setError(getErrorMessage(err, "Couldn't save the record."));
    } finally {
      setBusy(false);
    }
  };

  const numberInput = (key: string, label: string, step = 1) => (
    <label key={key}>
      <span className="field-label">{label}</span>
      <input
        type="number"
        min={0}
        step={step}
        inputMode={step === 1 ? "numeric" : "decimal"}
        value={values[key] ?? ""}
        onChange={(e) => set(key, e.target.value)}
        className="input-field w-full"
      />
    </label>
  );

  return (
    <form onSubmit={handleSubmit} className="space-y-5" noValidate>
      {error && <Alert kind="error">{error}</Alert>}

      <fieldset className="card p-5">
        <legend className="card-title float-left w-full mb-3">Player & game</legend>
        <div className="clear-both grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <label>
            <span className="field-label">Player name *</span>
            <input list="bad-player-names" value={values.player_name} onChange={(e) => onPlayerName(e.target.value)} className="input-field w-full" placeholder="e.g. Marcus Rivera" required />
          </label>
          <label>
            <span className="field-label">Team *</span>
            <input list="bad-teams" value={values.team} onChange={(e) => set("team", e.target.value)} className="input-field w-full" required />
          </label>
          <label>
            <span className="field-label">Position *</span>
            <select value={values.position} onChange={(e) => set("position", e.target.value)} className="input-field w-full" required>
              <option value="">Select</option>
              {positions.map((p) => (
                <option key={p}>{p}</option>
              ))}
            </select>
          </label>
          <label>
            <span className="field-label">Game date *</span>
            <input type="date" value={values.game_date} onChange={(e) => set("game_date", e.target.value)} className="input-field w-full" required />
          </label>
          <label>
            <span className="field-label">Game ID *</span>
            <input value={values.game_id} onChange={(e) => set("game_id", e.target.value)} className="input-field w-full" placeholder="e.g. G025" required />
          </label>
          <label>
            <span className="field-label">Opponent *</span>
            <input list="bad-teams" value={values.opponent} onChange={(e) => set("opponent", e.target.value)} className="input-field w-full" required />
          </label>
        </div>
        <datalist id="bad-player-names">
          {(meta?.players ?? []).map((p) => (
            <option key={p.player_id} value={p.player_name} />
          ))}
        </datalist>
        <datalist id="bad-teams">
          {(meta?.teams ?? []).map((t) => (
            <option key={t} value={t} />
          ))}
        </datalist>
      </fieldset>

      <fieldset className="card p-5">
        <legend className="card-title float-left w-full mb-3">Batting</legend>
        <div className="clear-both grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">{BATTING.map(([k, l]) => numberInput(k, l))}</div>
      </fieldset>

      <fieldset className="card p-5">
        <legend className="card-title float-left w-full mb-3">
          Pitching <span className="font-normal muted">(leave at 0 for non-pitchers)</span>
        </legend>
        <div className="clear-both grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-4">
          {PITCHING.map(([k, l]) => numberInput(k, l, k === "innings_pitched" ? 0.1 : 1))}
        </div>
        <p className="text-xs muted mt-3">Innings use box-score notation: 6.1 means 6⅓ innings and 6.2 means 6⅔.</p>
      </fieldset>

      <div className="flex justify-end gap-2">
        {onCancel && (
          <button type="button" className="btn-secondary" onClick={onCancel} disabled={busy}>
            Cancel
          </button>
        )}
        <button type="submit" className="btn-primary" disabled={busy}>
          {busy && <Spinner />}
          {submitLabel}
        </button>
      </div>
    </form>
  );
}
