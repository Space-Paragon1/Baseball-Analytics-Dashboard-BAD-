import { useState } from "react";
import { CheckCircle, AlertCircle, Play, Square } from "lucide-react";
import { startGame, logAtBat, logPitch, fetchScoreboard, saveGame } from "../utils/api";
import type { GameSession, LivePlayerStats, LivePitcherStats } from "../types";
import { useToast } from "../context/ToastContext";

const AT_BAT_RESULTS = ["single", "double", "triple", "hr", "walk", "strikeout", "out"];
const PITCH_RESULTS = ["strikeout", "ball", "hit", "walk"];
const TEAMS = ["Eagles", "Tigers", "Wolves"];

export default function GameModePage() {
  const { addToast } = useToast();

  // Step 1: Setup
  const [homeTeam, setHomeTeam] = useState("Eagles");
  const [awayTeam, setAwayTeam] = useState("Tigers");
  const [gameDate, setGameDate] = useState(new Date().toISOString().slice(0, 10));
  const [starting, setStarting] = useState(false);

  // Step 2: Active game
  const [session, setSession] = useState<GameSession | null>(null);
  const [gameId, setGameId] = useState<string | null>(null);

  // At-bat form
  const [abPlayer, setAbPlayer] = useState("");
  const [abTeam, setAbTeam] = useState("");
  const [abResult, setAbResult] = useState("single");
  const [abLoading, setAbLoading] = useState(false);

  // Pitch form
  const [pitcherName, setPitcherName] = useState("");
  const [pitcherTeam, setPitcherTeam] = useState("");
  const [pitchResult, setPitchResult] = useState("strikeout");
  const [pitchLoading, setPitchLoading] = useState(false);

  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const showSuccess = (msg: string) => {
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(null), 3000);
  };

  const refreshScoreboard = async (gid: string) => {
    const s = await fetchScoreboard(gid);
    setSession(s);
  };

  const handleStartGame = async () => {
    if (!homeTeam || !awayTeam || homeTeam === awayTeam) {
      setError("Please select two different teams.");
      return;
    }
    setStarting(true);
    setError(null);
    try {
      const res = await startGame(homeTeam, awayTeam, gameDate);
      setGameId(res.game_id);
      setSession(res.session);
      setAbTeam(homeTeam);
      setPitcherTeam(homeTeam);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to start game.");
    } finally {
      setStarting(false);
    }
  };

  const handleLogAtBat = async () => {
    if (!gameId || !abPlayer.trim()) {
      setError("Enter player name.");
      return;
    }
    setAbLoading(true);
    setError(null);
    try {
      await logAtBat(gameId, abPlayer.trim(), abTeam, abResult);
      await refreshScoreboard(gameId);
      showSuccess(`At-bat logged: ${abPlayer} — ${abResult}`);
      addToast("At-bat logged.", "success");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to log at-bat.");
    } finally {
      setAbLoading(false);
    }
  };

  const handleLogPitch = async () => {
    if (!gameId || !pitcherName.trim()) {
      setError("Enter pitcher name.");
      return;
    }
    setPitchLoading(true);
    setError(null);
    try {
      await logPitch(gameId, pitcherName.trim(), pitcherTeam, pitchResult);
      await refreshScoreboard(gameId);
      showSuccess(`Pitch logged: ${pitcherName} — ${pitchResult}`);
      addToast("Pitch logged.", "success");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to log pitch.");
    } finally {
      setPitchLoading(false);
    }
  };

  const handleSaveGame = async () => {
    if (!gameId) return;
    setSaving(true);
    setError(null);
    try {
      const res = await saveGame(gameId);
      setSaved(true);
      showSuccess(res.message);
      addToast("Game saved to database!", "success");
      await refreshScoreboard(gameId);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to save game.");
      addToast("Failed to save game.", "error");
    } finally {
      setSaving(false);
    }
  };

  const inputCls = "border border-gray-200 dark:border-slate-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-slate-700 dark:text-slate-100 w-full";

  return (
    <div>
      <h1 className="page-title">Game Mode</h1>
      <p className="page-subtitle">Live game entry — log at-bats and pitches in real time</p>

      {successMsg && (
        <div className="flex items-center gap-3 bg-emerald-50 dark:bg-emerald-900/30 border border-emerald-200 dark:border-emerald-700 text-emerald-800 dark:text-emerald-300 rounded-xl px-5 py-3 mb-4">
          <CheckCircle className="w-5 h-5 flex-shrink-0" />
          <span className="text-sm font-medium">{successMsg}</span>
        </div>
      )}

      {error && (
        <div className="flex items-center gap-3 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-700 text-red-700 dark:text-red-300 rounded-xl px-5 py-3 mb-4">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <span className="text-sm">{error}</span>
        </div>
      )}

      {/* Step 1: Setup */}
      {!session && (
        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-card border border-gray-100 dark:border-slate-700 p-6 max-w-xl">
          <h2 className="font-semibold text-gray-800 dark:text-slate-200 mb-4">Game Setup</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-xs font-semibold text-gray-600 dark:text-slate-400 mb-1">Home Team</label>
              <select value={homeTeam} onChange={(e) => setHomeTeam(e.target.value)} className={inputCls}>
                {TEAMS.map((t) => <option key={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 dark:text-slate-400 mb-1">Away Team</label>
              <select value={awayTeam} onChange={(e) => setAwayTeam(e.target.value)} className={inputCls}>
                {TEAMS.map((t) => <option key={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 dark:text-slate-400 mb-1">Game Date</label>
              <input type="date" value={gameDate} onChange={(e) => setGameDate(e.target.value)} className={inputCls} />
            </div>
          </div>
          <button onClick={handleStartGame} disabled={starting} className="btn-primary">
            <Play className="w-4 h-4" />
            {starting ? "Starting..." : "Start Game"}
          </button>
        </div>
      )}

      {/* Step 2: Live game */}
      {session && (
        <div className="space-y-5">
          {/* Scoreboard */}
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-card border border-gray-100 dark:border-slate-700 p-5">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-semibold text-gray-800 dark:text-slate-200">Scoreboard</h2>
              <span className="text-xs text-gray-400 dark:text-slate-500">ID: {session.game_id}</span>
            </div>
            <div className="flex gap-8 mb-3">
              {Object.entries(session.score).map(([team, score]) => (
                <div key={team} className="text-center">
                  <p className="text-xs text-gray-500 dark:text-slate-400">{team}</p>
                  <p className="text-3xl font-bold text-gray-900 dark:text-slate-100">{score}</p>
                </div>
              ))}
              <div className="text-center">
                <p className="text-xs text-gray-500 dark:text-slate-400">Inning</p>
                <p className="text-3xl font-bold text-blue-700 dark:text-blue-400">{session.inning}</p>
              </div>
            </div>
            <p className="text-xs text-gray-400 dark:text-slate-500">{session.game_date} | {session.home_team} vs {session.away_team}</p>
          </div>

          {/* Log At-Bat */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="bg-white dark:bg-slate-800 rounded-xl shadow-card border border-gray-100 dark:border-slate-700 p-5">
              <h2 className="font-semibold text-gray-800 dark:text-slate-200 mb-3">Log At-Bat</h2>
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 dark:text-slate-400 mb-1">Player Name</label>
                  <input type="text" value={abPlayer} onChange={(e) => setAbPlayer(e.target.value)} placeholder="e.g. John Doe" className={inputCls} />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 dark:text-slate-400 mb-1">Team</label>
                  <select value={abTeam} onChange={(e) => setAbTeam(e.target.value)} className={inputCls}>
                    {[session.home_team, session.away_team].map((t) => <option key={t}>{t}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 dark:text-slate-400 mb-1">Result</label>
                  <select value={abResult} onChange={(e) => setAbResult(e.target.value)} className={inputCls}>
                    {AT_BAT_RESULTS.map((r) => <option key={r} value={r}>{r.charAt(0).toUpperCase() + r.slice(1)}</option>)}
                  </select>
                </div>
                <button onClick={handleLogAtBat} disabled={abLoading || saved} className="btn-primary w-full justify-center">
                  {abLoading ? "Logging..." : "Log At-Bat"}
                </button>
              </div>
            </div>

            {/* Log Pitch */}
            <div className="bg-white dark:bg-slate-800 rounded-xl shadow-card border border-gray-100 dark:border-slate-700 p-5">
              <h2 className="font-semibold text-gray-800 dark:text-slate-200 mb-3">Log Pitch</h2>
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 dark:text-slate-400 mb-1">Pitcher Name</label>
                  <input type="text" value={pitcherName} onChange={(e) => setPitcherName(e.target.value)} placeholder="e.g. Jane Smith" className={inputCls} />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 dark:text-slate-400 mb-1">Team</label>
                  <select value={pitcherTeam} onChange={(e) => setPitcherTeam(e.target.value)} className={inputCls}>
                    {[session.home_team, session.away_team].map((t) => <option key={t}>{t}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 dark:text-slate-400 mb-1">Result</label>
                  <select value={pitchResult} onChange={(e) => setPitchResult(e.target.value)} className={inputCls}>
                    {PITCH_RESULTS.map((r) => <option key={r} value={r}>{r.charAt(0).toUpperCase() + r.slice(1)}</option>)}
                  </select>
                </div>
                <button onClick={handleLogPitch} disabled={pitchLoading || saved} className="btn-primary w-full justify-center">
                  {pitchLoading ? "Logging..." : "Log Pitch"}
                </button>
              </div>
            </div>
          </div>

          {/* Running Stats */}
          {session.player_stats.length > 0 && (
            <div className="bg-white dark:bg-slate-800 rounded-xl shadow-card border border-gray-100 dark:border-slate-700 overflow-hidden">
              <div className="px-5 py-3 border-b border-gray-100 dark:border-slate-700">
                <h2 className="font-semibold text-gray-800 dark:text-slate-200 text-sm">Running Batting Stats</h2>
              </div>
              <div className="overflow-x-auto">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Player</th>
                      <th>Team</th>
                      <th>AB</th>
                      <th>H</th>
                      <th>2B</th>
                      <th>3B</th>
                      <th>HR</th>
                      <th>R</th>
                      <th>BB</th>
                      <th>K</th>
                    </tr>
                  </thead>
                  <tbody>
                    {session.player_stats.map((p: LivePlayerStats) => (
                      <tr key={`${p.player_name}-${p.team}`}>
                        <td className="font-semibold dark:text-slate-100">{p.player_name}</td>
                        <td><span className="badge bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300">{p.team}</span></td>
                        <td>{p.at_bats}</td>
                        <td>{p.hits}</td>
                        <td>{p.doubles}</td>
                        <td>{p.triples}</td>
                        <td>{p.home_runs}</td>
                        <td>{p.runs}</td>
                        <td>{p.walks}</td>
                        <td>{p.strikeouts}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {session.pitcher_stats.length > 0 && (
            <div className="bg-white dark:bg-slate-800 rounded-xl shadow-card border border-gray-100 dark:border-slate-700 overflow-hidden">
              <div className="px-5 py-3 border-b border-gray-100 dark:border-slate-700">
                <h2 className="font-semibold text-gray-800 dark:text-slate-200 text-sm">Running Pitching Stats</h2>
              </div>
              <div className="overflow-x-auto">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Pitcher</th>
                      <th>Team</th>
                      <th>IP</th>
                      <th>K</th>
                      <th>BB</th>
                      <th>H</th>
                      <th>ER</th>
                    </tr>
                  </thead>
                  <tbody>
                    {session.pitcher_stats.map((p: LivePitcherStats) => (
                      <tr key={`${p.pitcher_name}-${p.team}`}>
                        <td className="font-semibold dark:text-slate-100">{p.pitcher_name}</td>
                        <td><span className="badge bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300">{p.team}</span></td>
                        <td>{p.innings_pitched.toFixed(1)}</td>
                        <td>{p.strikeouts_pitched}</td>
                        <td>{p.walks_allowed}</td>
                        <td>{p.hits_allowed}</td>
                        <td>{p.earned_runs}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* End Game */}
          <div className="flex justify-end">
            {saved ? (
              <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 font-semibold">
                <CheckCircle className="w-5 h-5" />
                Game saved to database
              </div>
            ) : (
              <button
                onClick={handleSaveGame}
                disabled={saving}
                className="flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white font-semibold px-5 py-2.5 rounded-lg transition-colors"
              >
                <Square className="w-4 h-4" />
                {saving ? "Saving..." : "End Game & Save"}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
