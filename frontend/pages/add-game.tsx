import { useEffect, useState } from "react";
import { CheckCircle, AlertCircle } from "lucide-react";
import { fetchPlayers, addGameRecord } from "../utils/api";
import type { GameRecordInput } from "../types";
import { useToast } from "../context/ToastContext";

const TEAMS = ["Eagles", "Tigers", "Wolves"];
const POSITIONS = ["C", "1B", "2B", "3B", "SS", "LF", "CF", "RF", "OF", "DH", "P", "IF"];

function emptyForm(): GameRecordInput {
  return {
    player_name: "",
    team: "",
    position: "",
    game_date: "",
    at_bats: 0,
    hits: 0,
    doubles: 0,
    triples: 0,
    home_runs: 0,
    runs: 0,
    rbi: 0,
    strikeouts: 0,
    walks: 0,
    hit_by_pitch: 0,
    innings_pitched: 0,
    earned_runs: 0,
    hits_allowed: 0,
    walks_allowed: 0,
    strikeouts_pitched: 0,
    game_id: "",
    opponent: "",
  };
}

interface InputFieldProps {
  label: string;
  name: keyof GameRecordInput;
  type?: string;
  value: string | number;
  onChange: (name: keyof GameRecordInput, value: string | number) => void;
  required?: boolean;
  min?: number;
  step?: number;
}

function InputField({ label, name, type = "number", value, onChange, required, min = 0, step }: InputFieldProps) {
  return (
    <div>
      <label className="block text-xs font-semibold text-gray-600 dark:text-slate-400 mb-1">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      <input
        type={type}
        value={value}
        min={type === "number" ? min : undefined}
        step={step}
        required={required}
        onChange={(e) => {
          const v = type === "number" ? (e.target.value === "" ? 0 : parseFloat(e.target.value)) : e.target.value;
          onChange(name, v);
        }}
        className="border border-gray-200 dark:border-slate-600 rounded-lg px-3 py-2 w-full text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-slate-700 dark:text-slate-100"
      />
    </div>
  );
}

export default function AddGamePage() {
  const { addToast } = useToast();
  const [form, setForm] = useState<GameRecordInput>(emptyForm());
  const [playerNames, setPlayerNames] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchPlayers()
      .then((players) => setPlayerNames(players.map((p) => p.player_name)))
      .catch(() => {});
  }, []);

  const handleChange = (name: keyof GameRecordInput, value: string | number) => {
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    setSuccess(false);
    try {
      await addGameRecord(form);
      setSuccess(true);
      setForm(emptyForm());
      addToast("Game record added successfully!", "success");
      setTimeout(() => setSuccess(false), 4000);
    } catch (err: unknown) {
      const msg =
        err instanceof Error
          ? err.message
          : (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ?? "Failed to save record.";
      setError(msg);
      addToast("Failed to save record.", "error");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div>
      <h1 className="page-title">Add Game Record</h1>
      <p className="page-subtitle">Manually enter a game record for any player</p>

      {success && (
        <div className="flex items-center gap-3 bg-emerald-50 dark:bg-emerald-900/30 border border-emerald-200 dark:border-emerald-700 text-emerald-800 dark:text-emerald-300 rounded-xl px-5 py-3 mb-5">
          <CheckCircle className="w-5 h-5 flex-shrink-0" />
          <span className="font-medium text-sm">Game record saved successfully!</span>
        </div>
      )}

      {error && (
        <div className="flex items-center gap-3 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-700 text-red-800 dark:text-red-300 rounded-xl px-5 py-3 mb-5">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <span className="font-medium text-sm">{error}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Player Info */}
        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-card border border-gray-100 dark:border-slate-700 p-5">
          <h2 className="font-semibold text-gray-800 dark:text-slate-200 text-sm mb-4">Player Info</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-600 dark:text-slate-400 mb-1">
                Player Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                list="player-names"
                value={form.player_name}
                onChange={(e) => handleChange("player_name", e.target.value)}
                required
                placeholder="e.g. John Doe"
                className="border border-gray-200 dark:border-slate-600 rounded-lg px-3 py-2 w-full text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-slate-700 dark:text-slate-100"
              />
              <datalist id="player-names">
                {playerNames.map((name) => (
                  <option key={name} value={name} />
                ))}
              </datalist>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-600 dark:text-slate-400 mb-1">
                Team <span className="text-red-500">*</span>
              </label>
              <select
                value={form.team}
                onChange={(e) => handleChange("team", e.target.value)}
                required
                className="border border-gray-200 dark:border-slate-600 rounded-lg px-3 py-2 w-full text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-slate-700 dark:text-slate-100"
              >
                <option value="">-- Select team --</option>
                {TEAMS.map((t) => <option key={t}>{t}</option>)}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-600 dark:text-slate-400 mb-1">
                Position <span className="text-red-500">*</span>
              </label>
              <select
                value={form.position}
                onChange={(e) => handleChange("position", e.target.value)}
                required
                className="border border-gray-200 dark:border-slate-600 rounded-lg px-3 py-2 w-full text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-slate-700 dark:text-slate-100"
              >
                <option value="">-- Select position --</option>
                {POSITIONS.map((p) => <option key={p}>{p}</option>)}
              </select>
            </div>

            <InputField label="Game Date" name="game_date" type="date" value={form.game_date} onChange={handleChange} required />
            <InputField label="Game ID" name="game_id" type="text" value={form.game_id} onChange={handleChange} required />
            <InputField label="Opponent" name="opponent" type="text" value={form.opponent} onChange={handleChange} required />
          </div>
        </div>

        {/* Batting Stats */}
        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-card border border-gray-100 dark:border-slate-700 p-5">
          <h2 className="font-semibold text-gray-800 dark:text-slate-200 text-sm mb-4">Batting Stats</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
            <InputField label="At Bats" name="at_bats" value={form.at_bats} onChange={handleChange} />
            <InputField label="Hits" name="hits" value={form.hits} onChange={handleChange} />
            <InputField label="Doubles" name="doubles" value={form.doubles} onChange={handleChange} />
            <InputField label="Triples" name="triples" value={form.triples} onChange={handleChange} />
            <InputField label="Home Runs" name="home_runs" value={form.home_runs} onChange={handleChange} />
            <InputField label="Runs" name="runs" value={form.runs} onChange={handleChange} />
            <InputField label="RBI" name="rbi" value={form.rbi} onChange={handleChange} />
            <InputField label="Strikeouts" name="strikeouts" value={form.strikeouts} onChange={handleChange} />
            <InputField label="Walks" name="walks" value={form.walks} onChange={handleChange} />
            <InputField label="Hit by Pitch" name="hit_by_pitch" value={form.hit_by_pitch} onChange={handleChange} />
          </div>
        </div>

        {/* Pitching Stats */}
        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-card border border-gray-100 dark:border-slate-700 p-5">
          <h2 className="font-semibold text-gray-800 dark:text-slate-200 text-sm mb-4">Pitching Stats <span className="text-xs font-normal text-gray-400">(leave as 0 if not a pitcher)</span></h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
            <InputField label="Innings Pitched" name="innings_pitched" value={form.innings_pitched} onChange={handleChange} step={0.1} />
            <InputField label="Earned Runs" name="earned_runs" value={form.earned_runs} onChange={handleChange} />
            <InputField label="Hits Allowed" name="hits_allowed" value={form.hits_allowed} onChange={handleChange} />
            <InputField label="Walks Allowed" name="walks_allowed" value={form.walks_allowed} onChange={handleChange} />
            <InputField label="Strikeouts (P)" name="strikeouts_pitched" value={form.strikeouts_pitched} onChange={handleChange} />
          </div>
        </div>

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={submitting}
            className="btn-primary"
          >
            {submitting ? "Saving..." : "Save Game Record"}
          </button>
        </div>
      </form>
    </div>
  );
}
