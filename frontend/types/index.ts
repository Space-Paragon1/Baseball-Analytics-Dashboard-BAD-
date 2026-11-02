// Shapes returned by the FastAPI backend.

export interface DateRange {
  start: string; // YYYY-MM-DD or ""
  end: string;
}

export interface PlayerInfo {
  player_id: number;
  player_name: string;
  team: string;
  position: string;
}

export interface BattingStats extends PlayerInfo {
  games_played: number;
  plate_appearances: number;
  at_bats: number;
  hits: number;
  doubles: number;
  triples: number;
  home_runs: number;
  runs: number;
  rbi: number;
  strikeouts: number;
  walks: number;
  hit_by_pitch: number;
  sacrifice_flies: number;
  total_bases: number;
  batting_avg: number;
  obp: number;
  slg: number;
  ops: number;
  iso: number;
  babip: number;
  woba: number;
  k_pct: number;
  bb_pct: number;
  qualified: boolean;
}

export interface PitchingStats extends PlayerInfo {
  games: number;
  outs_pitched: number;
  innings_pitched: number; // baseball notation: 6.1 = 6 1/3
  earned_runs: number;
  hits_allowed: number;
  walks_allowed: number;
  strikeouts_pitched: number;
  home_runs_allowed: number;
  hit_batsmen: number;
  era: number | null;
  whip: number | null;
  k_per_9: number | null;
  bb_per_9: number | null;
  hr_per_9: number | null;
  k_bb: number | null;
  fip: number | null;
  qualified: boolean;
}

export interface GameRecord {
  id: number;
  player_id: number;
  player_name: string;
  team: string;
  position: string;
  game_date: string;
  game_id: string;
  opponent: string;
  at_bats: number;
  hits: number;
  doubles: number;
  triples: number;
  home_runs: number;
  runs: number;
  rbi: number;
  strikeouts: number;
  walks: number;
  hit_by_pitch: number;
  sacrifice_flies: number;
  innings_pitched: number;
  earned_runs: number;
  hits_allowed: number;
  walks_allowed: number;
  strikeouts_pitched: number;
  home_runs_allowed: number;
  hit_batsmen: number;
}

export type GameRecordInput = Omit<GameRecord, "id" | "player_id"> & { player_id?: number };

export interface RecordPage {
  items: GameRecord[];
  total: number;
  page: number;
  page_size: number;
}

export interface PlayerDetail extends PlayerInfo {
  batting: BattingStats | null;
  pitching: PitchingStats | null;
  game_logs: GameRecord[];
}

export interface ComparePlayer extends PlayerInfo {
  batting: BattingStats | null;
  pitching: PitchingStats | null;
}

export interface TrendPoint {
  game_date: string;
  game_id: string;
  opponent: string;
  value: number | null;
  cumulative: number | null;
}

export interface Team {
  team: string;
  games: number;
  wins: number;
  losses: number;
  ties: number;
  win_pct: number;
  run_diff: number | null;
  runs_allowed: number | null;
  pythag_pct: number | null;
  total_runs: number;
  total_hits: number;
  total_home_runs: number;
  total_rbi: number;
  batting_avg: number;
  obp: number;
  slg: number;
  ops: number;
  innings_pitched: number;
  team_era: number | null;
  team_whip: number | null;
}

export interface TeamDetail {
  team: string;
  stats: Team;
  roster_batting: BattingStats[];
  roster_pitching: PitchingStats[];
}

export interface TeamGame {
  game_id: string;
  game_date: string;
  team: string;
  opponent: string;
  runs_scored: number;
  runs_allowed: number | null;
  hits: number;
  home_runs: number;
  result: "W" | "L" | "T" | null;
}

export interface DashboardData {
  total_games: number;
  total_runs: number;
  league_batting_avg: number;
  league_ops: number;
  league_era: number | null;
  top_performer: (PlayerInfo & { batting_avg: number; ops: number; home_runs: number; rbi: number }) | null;
  top_pitcher:
    | (PlayerInfo & { era: number; fip: number | null; whip: number; strikeouts_pitched: number; innings_pitched: number })
    | null;
  teams: Team[];
  recent_trend: { game_date: string; games: number; total_runs: number; total_hits: number; runs_per_game: number }[];
  top5_batters: (PlayerInfo & {
    batting_avg: number;
    obp: number;
    slg: number;
    ops: number;
    home_runs: number;
    rbi: number;
    hits: number;
  })[];
}

export interface Meta {
  total_records: number;
  teams: string[];
  positions: string[];
  players: PlayerInfo[];
  date_range: { min: string | null; max: string | null };
}

export interface ImportResult {
  success: boolean;
  message: string;
  rows_loaded: number;
  mode: "replace" | "append";
  warnings?: string[];
  games?: number;
}

export interface MlbTeam {
  id: number;
  name: string;
  team_name: string;
  abbreviation: string;
}

// ---------------------------------------------------------------- Game Mode

export type Side = "home" | "away";
export type PlayResult =
  | "single"
  | "double"
  | "triple"
  | "home_run"
  | "walk"
  | "hit_by_pitch"
  | "strikeout"
  | "out"
  | "sac_fly";

export interface LiveBattingLine {
  name: string;
  position: string | null;
  plate_appearances: number;
  at_bats: number;
  hits: number;
  doubles: number;
  triples: number;
  home_runs: number;
  runs: number;
  rbi: number;
  walks: number;
  strikeouts: number;
  hit_by_pitch: number;
  sacrifice_flies: number;
}

export interface LivePitchingLine {
  name: string;
  outs_pitched: number;
  hits_allowed: number;
  runs_allowed: number;
  earned_runs: number;
  walks_allowed: number;
  strikeouts_pitched: number;
  home_runs_allowed: number;
  hit_batsmen: number;
}

export interface GameState {
  id: string;
  saved: boolean;
  can_undo: boolean;
  teams: Record<Side, string>;
  game_date: string;
  inning: number;
  half: "top" | "bottom";
  outs: number;
  bases: (string | null)[];
  score: Record<Side, number>;
  line_score: Record<Side, number[]>;
  pitchers: Record<Side, string | null>;
  batting_side: Side;
  batting: Record<Side, LiveBattingLine[]>;
  pitching: Record<Side, LivePitchingLine[]>;
  plays: { inning: number; half: "top" | "bottom"; side: Side; runs: number; text: string }[];
  final: boolean;
}

export interface GameSessionSummary {
  id: string;
  home_team: string;
  away_team: string;
  game_date: string;
  score: Record<Side, number>;
  inning: number;
  half: "top" | "bottom";
  final: boolean;
}

// ---------------------------------------------------------------- Auth

export interface AuthUser {
  id: number;
  username: string;
  email: string;
  is_admin: boolean;
}

export interface AuthResponse {
  access_token: string;
  token_type: string;
  user: AuthUser;
}
