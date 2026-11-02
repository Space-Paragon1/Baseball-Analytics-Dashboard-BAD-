import type { GameState, Side } from "../types";
import { ordinal } from "../utils/format";

/** Bases as a diamond; filled squares have runners. */
export function Diamond({ bases }: { bases: (string | null)[] }) {
  const base = (occupied: boolean, label: string, pos: string) => (
    <div
      className={`absolute w-5 h-5 rotate-45 border-2 ${pos} ${
        occupied ? "bg-amber-400 border-amber-500" : "bg-transparent border-gray-300 dark:border-slate-500"
      }`}
      title={label}
      data-testid={`base-${label.split(":")[0].toLowerCase().replace(/\s/g, "")}`}
      data-occupied={occupied}
    />
  );
  const [first, second, third] = bases;
  return (
    <div className="relative w-20 h-16" aria-label={`Runners: ${bases.map((b, i) => (b ? `${ordinal(i + 1)} ${b}` : null)).filter(Boolean).join(", ") || "none"}`}>
      {base(!!second, `Second: ${second ?? "empty"}`, "left-1/2 -translate-x-1/2 top-0")}
      {base(!!third, `Third: ${third ?? "empty"}`, "left-1.5 top-1/2 -translate-y-1/2")}
      {base(!!first, `First: ${first ?? "empty"}`, "right-1.5 top-1/2 -translate-y-1/2")}
    </div>
  );
}

export function Outs({ outs }: { outs: number }) {
  return (
    <div className="flex items-center gap-1.5" aria-label={`${outs} out${outs === 1 ? "" : "s"}`}>
      {[0, 1, 2].map((i) => (
        <span key={i} className={`w-3 h-3 rounded-full ${i < outs ? "bg-red-500" : "bg-gray-200 dark:bg-slate-600"}`} />
      ))}
      <span className="text-xs muted ml-1">out{outs === 1 ? "" : "s"}</span>
    </div>
  );
}

/** Classic inning-by-inning line score. */
export function LineScore({ game }: { game: GameState }) {
  const innings = Math.max(9, game.line_score.away.length, game.line_score.home.length);
  const hits = (side: Side) => game.batting[side].reduce((n, b) => n + b.hits, 0);
  const row = (side: Side) => (
    <tr key={side}>
      <td className="font-semibold">
        {game.teams[side]}
        {game.batting_side === side && !game.final && <span className="ml-1 text-blue-500" title="Batting">●</span>}
      </td>
      {Array.from({ length: innings }, (_, i) => (
        <td key={i} className="num">
          {game.line_score[side][i] ?? ""}
        </td>
      ))}
      <td className="num font-bold text-lg">{game.score[side]}</td>
      <td className="num">{hits(side)}</td>
    </tr>
  );
  return (
    <div className="overflow-x-auto">
      <table className="data-table">
        <thead>
          <tr>
            <th>Team</th>
            {Array.from({ length: innings }, (_, i) => (
              <th key={i} className="num">
                {i + 1}
              </th>
            ))}
            <th className="num">R</th>
            <th className="num">H</th>
          </tr>
        </thead>
        <tbody>{(["away", "home"] as Side[]).map(row)}</tbody>
      </table>
    </div>
  );
}

export function InningLabel({ game }: { game: GameState }) {
  if (game.final) return <span className="badge bg-gray-800 text-white dark:bg-slate-100 dark:text-slate-900">Final</span>;
  return (
    <span className="font-bold text-blue-700 dark:text-blue-400">
      {game.half === "top" ? "▲" : "▼"} {ordinal(game.inning)}
    </span>
  );
}
