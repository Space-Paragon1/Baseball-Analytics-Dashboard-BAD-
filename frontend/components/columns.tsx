import type { Column } from "./StatTable";
import type { BattingStats, PitchingStats } from "../types";
import { formatAvg, formatIP, formatPct, formatRate } from "../utils/format";

function PlayerName({ name, qualified }: { name: string; qualified?: boolean }) {
  return (
    <span className="font-semibold text-gray-900 dark:text-slate-100">
      {name}
      {qualified === false && (
        <span className="ml-1 text-gray-400 font-normal" title="Below the qualifying minimum (small sample)">
          †
        </span>
      )}
    </span>
  );
}

const team = <T extends { team: string }>(): Column<T> => ({
  key: "team",
  label: "Team",
  render: (r) => <span className="badge-blue">{r.team}</span>,
});

export function eraClass(era: number | null): string {
  if (era == null) return "muted";
  if (era < 3) return "text-emerald-600 dark:text-emerald-400";
  if (era < 4.5) return "text-amber-600 dark:text-amber-400";
  return "text-red-600 dark:text-red-400";
}

export const battingColumns: Column<BattingStats>[] = [
  { key: "player_name", label: "Player", render: (r) => <PlayerName name={r.player_name} qualified={r.qualified} /> },
  team<BattingStats>(),
  { key: "position", label: "Pos", render: (r) => <span className="muted">{r.position}</span> },
  { key: "games_played", label: "G", numeric: true, title: "Games" },
  { key: "plate_appearances", label: "PA", numeric: true, title: "Plate appearances" },
  {
    key: "batting_avg",
    label: "AVG",
    numeric: true,
    title: "Batting average: H / AB",
    render: (r) => <span className="font-bold text-blue-700 dark:text-blue-400">{formatAvg(r.batting_avg)}</span>,
  },
  { key: "obp", label: "OBP", numeric: true, title: "On-base %: (H+BB+HBP) / (AB+BB+HBP+SF)", render: (r) => formatAvg(r.obp) },
  { key: "slg", label: "SLG", numeric: true, title: "Slugging: total bases / AB", render: (r) => formatAvg(r.slg) },
  {
    key: "ops",
    label: "OPS",
    numeric: true,
    title: "On-base plus slugging",
    render: (r) => <span className="font-semibold">{formatAvg(r.ops)}</span>,
  },
  {
    key: "woba",
    label: "wOBA",
    numeric: true,
    title: "Weighted on-base average: credits each way of reaching base by its run value",
    render: (r) => formatAvg(r.woba),
  },
  { key: "iso", label: "ISO", numeric: true, title: "Isolated power: SLG - AVG", render: (r) => formatAvg(r.iso) },
  {
    key: "babip",
    label: "BABIP",
    numeric: true,
    title: "Batting average on balls in play: (H-HR) / (AB-K-HR+SF)",
    render: (r) => formatAvg(r.babip),
  },
  { key: "k_pct", label: "K%", numeric: true, lowerIsBetter: true, title: "Strikeouts per plate appearance", render: (r) => formatPct(r.k_pct) },
  { key: "bb_pct", label: "BB%", numeric: true, title: "Walks per plate appearance", render: (r) => formatPct(r.bb_pct) },
  { key: "hits", label: "H", numeric: true, title: "Hits" },
  { key: "home_runs", label: "HR", numeric: true, title: "Home runs" },
  { key: "runs", label: "R", numeric: true, title: "Runs" },
  { key: "rbi", label: "RBI", numeric: true, title: "Runs batted in" },
];

export const pitchingColumns: Column<PitchingStats>[] = [
  { key: "player_name", label: "Player", render: (r) => <PlayerName name={r.player_name} qualified={r.qualified} /> },
  team<PitchingStats>(),
  { key: "games", label: "G", numeric: true, title: "Games pitched" },
  {
    key: "innings_pitched",
    label: "IP",
    numeric: true,
    title: "Innings pitched (6.1 = 6 1/3)",
    sortValue: (r) => r.outs_pitched,
    render: (r) => formatIP(r.innings_pitched),
  },
  {
    key: "era",
    label: "ERA",
    numeric: true,
    lowerIsBetter: true,
    title: "Earned run average: ER x 9 / IP",
    render: (r) => <span className={`font-bold ${eraClass(r.era)}`}>{formatRate(r.era)}</span>,
  },
  {
    key: "fip",
    label: "FIP",
    numeric: true,
    lowerIsBetter: true,
    title: "Fielding independent pitching: ERA-scaled, from strikeouts, walks, HBP and home runs only",
    render: (r) => formatRate(r.fip),
  },
  {
    key: "whip",
    label: "WHIP",
    numeric: true,
    lowerIsBetter: true,
    title: "Walks + hits per inning",
    render: (r) => formatRate(r.whip),
  },
  {
    key: "k_per_9",
    label: "K/9",
    numeric: true,
    title: "Strikeouts per 9 innings",
    render: (r) => <span className="font-semibold text-blue-700 dark:text-blue-400">{formatRate(r.k_per_9, 1)}</span>,
  },
  { key: "bb_per_9", label: "BB/9", numeric: true, lowerIsBetter: true, title: "Walks per 9 innings", render: (r) => formatRate(r.bb_per_9, 1) },
  { key: "hr_per_9", label: "HR/9", numeric: true, lowerIsBetter: true, title: "Home runs per 9 innings", render: (r) => formatRate(r.hr_per_9, 1) },
  { key: "k_bb", label: "K/BB", numeric: true, title: "Strikeout-to-walk ratio", render: (r) => formatRate(r.k_bb) },
  { key: "strikeouts_pitched", label: "SO", numeric: true, title: "Strikeouts" },
  { key: "walks_allowed", label: "BB", numeric: true, lowerIsBetter: true, title: "Walks" },
  { key: "hits_allowed", label: "H", numeric: true, lowerIsBetter: true, title: "Hits allowed" },
  { key: "earned_runs", label: "ER", numeric: true, lowerIsBetter: true, title: "Earned runs" },
];
