import { FormEvent, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import { CheckCircle, Play, RotateCcw, Save, Trash2 } from "lucide-react";
import { Diamond, InningLabel, LineScore, Outs } from "../components/GameBoard";
import LoadingSpinner from "../components/LoadingSpinner";
import { Alert, AuthGate, ConfirmDialog, PageHeader, Spinner } from "../components/ui";
import { useData } from "../context/DataContext";
import { useToast } from "../context/ToastContext";
import { useAsync } from "../hooks/useAsync";
import {
  discardGame,
  fetchGame,
  fetchGameSessions,
  getErrorMessage,
  logPlateAppearance,
  saveGame,
  setPitcher,
  startGame,
  undoPlay,
} from "../utils/api";
import { formatDate, ordinal, outsToIP } from "../utils/format";
import type { GameState, PlayResult, Side } from "../types";

const RESULTS: { value: PlayResult; label: string; tone: string }[] = [
  { value: "single", label: "Single", tone: "bg-emerald-600 hover:bg-emerald-700" },
  { value: "double", label: "Double", tone: "bg-emerald-600 hover:bg-emerald-700" },
  { value: "triple", label: "Triple", tone: "bg-emerald-600 hover:bg-emerald-700" },
  { value: "home_run", label: "Home run", tone: "bg-emerald-700 hover:bg-emerald-800" },
  { value: "walk", label: "Walk", tone: "bg-blue-600 hover:bg-blue-700" },
  { value: "hit_by_pitch", label: "Hit by pitch", tone: "bg-blue-600 hover:bg-blue-700" },
  { value: "strikeout", label: "Strikeout", tone: "bg-red-600 hover:bg-red-700" },
  { value: "out", label: "Out in play", tone: "bg-red-600 hover:bg-red-700" },
  { value: "sac_fly", label: "Sac fly", tone: "bg-amber-600 hover:bg-amber-700" },
];

const today = () => new Date().toISOString().slice(0, 10);

function Setup({ onStarted }: { onStarted: (g: GameState) => void }) {
  const { meta } = useData();
  const { addToast } = useToast();
  const [home, setHome] = useState(meta?.teams[0] ?? "");
  const [away, setAway] = useState(meta?.teams[1] ?? "");
  const [date, setDate] = useState(today);
  const [busy, setBusy] = useState(false);
  const sessions = useAsync(() => fetchGameSessions(), []);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!home.trim() || !away.trim() || home.trim().toLowerCase() === away.trim().toLowerCase()) {
      addToast("Pick two different teams.", "info");
      return;
    }
    setBusy(true);
    try {
      onStarted(await startGame(home.trim(), away.trim(), date));
    } catch (err) {
      addToast(getErrorMessage(err), "error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <form onSubmit={submit} className="card p-6">
        <h2 className="card-title mb-4">New game</h2>
        <div className="grid sm:grid-cols-2 gap-4 mb-4">
          <label>
            <span className="field-label">Away team (bats first)</span>
            <input list="gm-teams" className="input-field w-full" value={away} onChange={(e) => setAway(e.target.value)} required />
          </label>
          <label>
            <span className="field-label">Home team</span>
            <input list="gm-teams" className="input-field w-full" value={home} onChange={(e) => setHome(e.target.value)} required />
          </label>
          <label>
            <span className="field-label">Game date</span>
            <input type="date" className="input-field w-full" value={date} onChange={(e) => setDate(e.target.value)} required />
          </label>
        </div>
        <datalist id="gm-teams">
          {(meta?.teams ?? []).map((t) => (
            <option key={t} value={t} />
          ))}
        </datalist>
        <button type="submit" className="btn-primary" disabled={busy}>
          {busy ? <Spinner /> : <Play className="w-4 h-4" />}
          Start game
        </button>
      </form>

      <div className="card p-6">
        <h2 className="card-title mb-4">Resume a game</h2>
        {sessions.loading ? (
          <Spinner />
        ) : !sessions.data?.length ? (
          <p className="text-sm muted">No unfinished games. Games are saved as you go, so you can close the page and come back.</p>
        ) : (
          <ul className="divide-y divide-gray-100 dark:divide-slate-700">
            {sessions.data.map((s) => (
              <li key={s.id} className="py-2 flex items-center justify-between gap-3">
                <div className="text-sm">
                  <p className="font-semibold">
                    {s.away_team} {s.score.away}, {s.home_team} {s.score.home}
                  </p>
                  <p className="muted text-xs">
                    {formatDate(s.game_date)} · {s.final ? "Final" : `${s.half === "top" ? "Top" : "Bottom"} ${ordinal(s.inning)}`}
                  </p>
                </div>
                <button className="btn-secondary" onClick={async () => onStarted(await fetchGame(s.id))}>
                  Resume
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function PitcherInput({ game, side, onChange }: { game: GameState; side: Side; onChange: (g: GameState) => void }) {
  const { addToast } = useToast();
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setBusy(true);
    try {
      onChange(await setPitcher(game.id, side, name.trim()));
      setName("");
    } catch (err) {
      addToast(getErrorMessage(err), "error");
    } finally {
      setBusy(false);
    }
  };
  return (
    <form onSubmit={submit} className="flex items-end gap-2">
      <label className="flex-1">
        <span className="field-label">
          {game.teams[side]} pitcher:{" "}
          <span className="font-bold text-gray-900 dark:text-slate-100">{game.pitchers[side] ?? "not set"}</span>
        </span>
        <input
          list={`gm-roster-${side}`}
          className="input-field w-full"
          placeholder={game.pitchers[side] ? "Pitching change..." : "Starting pitcher"}
          value={name}
          onChange={(e) => setName(e.target.value)}
          disabled={game.saved}
        />
      </label>
      <button className="btn-secondary" disabled={busy || !name.trim() || game.saved}>
        Set
      </button>
    </form>
  );
}

function BoxScore({ game, side }: { game: GameState; side: Side }) {
  const batters = game.batting[side];
  const pitchers = game.pitching[side];
  if (!batters.length && !pitchers.length) return null;
  return (
    <div className="card overflow-hidden">
      <h3 className="card-title px-4 pt-3 pb-2">{game.teams[side]}</h3>
      {batters.length > 0 && (
        <div className="overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th>Batter</th>
                {["AB", "R", "H", "2B", "3B", "HR", "RBI", "BB", "SO"].map((h) => (
                  <th key={h} className="num">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {batters.map((b) => (
                <tr key={b.name}>
                  <td className="font-semibold">{b.name}</td>
                  {[b.at_bats, b.runs, b.hits, b.doubles, b.triples, b.home_runs, b.rbi, b.walks, b.strikeouts].map((v, i) => (
                    <td key={i} className="num">{v}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {pitchers.length > 0 && (
        <div className="overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th>Pitcher</th>
                {["IP", "H", "R", "ER", "BB", "SO", "HR"].map((h) => (
                  <th key={h} className="num">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {pitchers.map((p) => (
                <tr key={p.name}>
                  <td className="font-semibold">{p.name}</td>
                  {[outsToIP(p.outs_pitched), p.hits_allowed, p.runs_allowed, p.earned_runs, p.walks_allowed, p.strikeouts_pitched, p.home_runs_allowed].map(
                    (v, i) => (
                      <td key={i} className="num">{v}</td>
                    )
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function LiveGame({ game, onChange, onExit }: { game: GameState; onChange: (g: GameState) => void; onExit: () => void }) {
  const { meta, dataChanged } = useData();
  const { addToast } = useToast();
  const [batter, setBatter] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<"save" | "discard" | null>(null);

  const battingSide = game.batting_side;
  const fieldingSide: Side = battingSide === "home" ? "away" : "home";

  // Suggest names already in this game plus each team's roster from the data.
  const roster = useMemo(() => {
    const names = (side: Side) => {
      const team = game.teams[side].toLowerCase();
      const fromData = (meta?.players ?? []).filter((p) => p.team.toLowerCase() === team).map((p) => p.player_name);
      return Array.from(new Set([...game.batting[side].map((b) => b.name), ...game.pitching[side].map((p) => p.name), ...fromData]));
    };
    return { home: names("home"), away: names("away") };
  }, [game, meta]);

  const act = async (label: string, fn: () => Promise<GameState>) => {
    setBusy(label);
    setError(null);
    try {
      onChange(await fn());
      return true;
    } catch (err) {
      setError(getErrorMessage(err));
      return false;
    } finally {
      setBusy(null);
    }
  };

  const logResult = async (result: PlayResult) => {
    if (!batter.trim()) {
      setError("Enter the batter's name first.");
      return;
    }
    if (await act(result, () => logPlateAppearance(game.id, batter.trim(), result))) setBatter("");
  };

  const save = async () => {
    setConfirm(null);
    setBusy("save");
    try {
      const res = await saveGame(game.id);
      onChange(res);
      addToast(res.message, "success");
      dataChanged();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setBusy(null);
    }
  };

  const discard = async () => {
    setConfirm(null);
    try {
      await discardGame(game.id);
      addToast("Game discarded.", "info");
      onExit();
    } catch (err) {
      setError(getErrorMessage(err));
    }
  };

  const needsPitcher = !game.pitchers[fieldingSide];
  const locked = game.saved || game.final;

  return (
    <div className="space-y-5">
      {game.saved && (
        <Alert kind="success">
          Game saved to the database.{" "}
          <Link href={`/records?search=${game.id}`} className="underline font-medium">
            View its records
          </Link>{" "}
          or{" "}
          <button className="underline font-medium" onClick={onExit}>
            start another game
          </button>
          .
        </Alert>
      )}
      {error && <Alert kind="error">{error}</Alert>}

      <div className="card p-5">
        <div className="flex flex-wrap items-center gap-6 mb-4">
          <div className="text-2xl">
            <InningLabel game={game} />
          </div>
          <Outs outs={game.outs} />
          <Diamond bases={game.bases} />
          <p className="text-xs muted ml-auto">
            {formatDate(game.game_date)} · <span className="font-mono">{game.id}</span>
          </p>
        </div>
        <LineScore game={game} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="card p-5 lg:col-span-2">
          <h2 className="card-title mb-1">
            {game.final ? "Game over" : `${game.teams[battingSide]} batting`}
          </h2>
          <p className="text-xs muted mb-4">
            {game.final
              ? "Save the game to add it to the stats, or undo the last play."
              : `Facing ${game.pitchers[fieldingSide] ?? "— set the pitcher first"}. Runners move up as many bases as the hit.`}
          </p>
          <label className="block mb-4">
            <span className="field-label">Batter</span>
            <input
              list={`gm-roster-${battingSide}`}
              className="input-field w-full"
              placeholder="Type or pick a name, then choose the result"
              value={batter}
              onChange={(e) => setBatter(e.target.value)}
              disabled={locked}
              autoFocus
            />
          </label>
          <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
            {RESULTS.map((r) => (
              <button
                key={r.value}
                type="button"
                onClick={() => logResult(r.value)}
                disabled={!!busy || locked || needsPitcher}
                className={`btn text-white ${r.tone}`}
              >
                {busy === r.value && <Spinner />}
                {r.label}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap gap-2 mt-5 pt-4 border-t border-gray-100 dark:border-slate-700">
            <button className="btn-secondary" onClick={() => act("undo", () => undoPlay(game.id))} disabled={!game.can_undo || !!busy}>
              <RotateCcw className="w-4 h-4" /> Undo last
            </button>
            <div className="ml-auto flex gap-2">
              {!game.saved && (
                <>
                  <button className="btn-secondary hover:text-red-600" onClick={() => setConfirm("discard")} disabled={!!busy}>
                    <Trash2 className="w-4 h-4" /> Discard
                  </button>
                  <button className="btn-primary" onClick={() => setConfirm("save")} disabled={!!busy}>
                    {busy === "save" ? <Spinner /> : <Save className="w-4 h-4" />} End & save
                  </button>
                </>
              )}
              {game.saved && (
                <span className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 font-semibold text-sm">
                  <CheckCircle className="w-4 h-4" /> Saved
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="card p-5 space-y-4">
          <h2 className="card-title">Pitchers</h2>
          <PitcherInput game={game} side="home" onChange={onChange} />
          <PitcherInput game={game} side="away" onChange={onChange} />
        </div>
      </div>

      {(["away", "home"] as Side[]).map((side) => (
        <datalist key={side} id={`gm-roster-${side}`}>
          {roster[side].map((n) => (
            <option key={n} value={n} />
          ))}
        </datalist>
      ))}

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
        <BoxScore game={game} side="away" />
        <BoxScore game={game} side="home" />
      </div>

      {game.plays.length > 0 && (
        <div className="card p-5">
          <h2 className="card-title mb-3">Play-by-play</h2>
          <ol className="space-y-1.5 text-sm max-h-80 overflow-y-auto">
            {game.plays.map((p, i) => (
              <li key={game.plays.length - i} className="flex gap-3">
                <span className="muted w-14 flex-shrink-0 tabular-nums">
                  {p.half === "top" ? "▲" : "▼"} {p.inning}
                </span>
                <span className={p.runs ? "font-semibold" : ""}>{p.text}</span>
              </li>
            ))}
          </ol>
        </div>
      )}

      <ConfirmDialog
        open={confirm === "save"}
        title="End and save this game?"
        message={`This adds every player's line to the database as game ${game.id}. You can still edit records later in the Game Log.`}
        confirmLabel="Save game"
        danger={false}
        onConfirm={save}
        onCancel={() => setConfirm(null)}
      />
      <ConfirmDialog
        open={confirm === "discard"}
        title="Discard this game?"
        message="Every play logged so far will be deleted. Nothing is saved to the stats."
        confirmLabel="Discard"
        onConfirm={discard}
        onCancel={() => setConfirm(null)}
      />
    </div>
  );
}

export default function GameModePage() {
  const router = useRouter();
  const gameId = typeof router.query.game === "string" ? router.query.game : null;
  const [game, setGame] = useState<GameState | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Keep the game id in the URL so a refresh picks up where you left off.
  useEffect(() => {
    if (!router.isReady || !gameId || game?.id === gameId) return;
    fetchGame(gameId)
      .then(setGame)
      .catch((e) => setLoadError(getErrorMessage(e)));
  }, [router.isReady, gameId, game?.id]);

  const open = (g: GameState) => {
    setGame(g);
    setLoadError(null);
    router.replace({ pathname: "/game-mode", query: { game: g.id } }, undefined, { shallow: true });
  };
  const exit = () => {
    setGame(null);
    router.replace("/game-mode", undefined, { shallow: true });
  };

  return (
    <div>
      <PageHeader
        title="Game Mode"
        subtitle="Score a game live, one plate appearance at a time. Every play is saved as you go."
        actions={
          game && (
            <button className="btn-secondary" onClick={exit}>
              All games
            </button>
          )
        }
      />
      <AuthGate action="score games">
        {loadError ? (
          <Alert kind="error">
            {loadError}{" "}
            <button className="underline" onClick={exit}>
              Back
            </button>
          </Alert>
        ) : gameId && !game ? (
          <LoadingSpinner label="Loading game..." />
        ) : game ? (
          <LiveGame game={game} onChange={setGame} onExit={exit} />
        ) : (
          <Setup onStarted={open} />
        )}
      </AuthGate>
    </div>
  );
}
