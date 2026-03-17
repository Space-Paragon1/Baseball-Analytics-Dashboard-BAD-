export interface BattingStats {
  player_name: string;
  team: string;
  position: string;
  games_played: number;
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
  batting_avg: number;
  obp: number;
  slg: number;
  ops: number;
}

export interface PitchingStats {
  player_name: string;
  team: string;
  position: string;
  games_started: number;
  innings_pitched: number;
  earned_runs: number;
  hits_allowed: number;
  walks_allowed: number;
  strikeouts_pitched: number;
  era: number;
  whip: number;
  k_per_9: number;
  bb_per_9: number;
}

export interface PlayerCompare extends BattingStats {
  era?: number | null;
  whip?: number | null;
  k_per_9?: number | null;
  innings_pitched?: number;
  earned_runs?: number;
  hits_allowed?: number;
  walks_allowed?: number;
  strikeouts_pitched?: number;
}

export interface Player {
  player_name: string;
  team: string;
  position: string;
  batting?: BattingStats;
  pitching?: PitchingStats;
  game_logs?: GameRecord[];
}

export interface Team {
  team: string;
  total_at_bats: number;
  total_hits: number;
  total_runs: number;
  total_home_runs: number;
  total_rbi: number;
  total_walks: number;
  batting_avg: number;
  total_innings?: number;
  total_earned_runs?: number;
  total_strikeouts_pitched?: number;
  total_walks_allowed?: number;
  team_era?: number;
}

export interface GameRecord {
  player_id: number;
  player_name: string;
  team: string;
  position: string;
  game_date: string;
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
  innings_pitched: number;
  earned_runs: number;
  hits_allowed: number;
  walks_allowed: number;
  strikeouts_pitched: number;
  game_id: string;
  opponent: string;
}

export interface TrendData {
  game_date: string;
  game_id: string;
  opponent: string;
  value: number | null;
}

export interface DashboardData {
  total_games: number;
  total_runs: number;
  league_batting_avg: number;
  top_performer: {
    player_name: string;
    team: string;
    batting_avg: number;
    home_runs: number;
    rbi: number;
  } | null;
  top_pitcher: {
    player_name: string;
    team: string;
    era: number;
    strikeouts_pitched: number;
    whip: number;
  } | null;
  teams: Team[];
  recent_trend: {
    game_date: string;
    total_runs: number;
    total_hits: number;
  }[];
  top5_batters: {
    player_name: string;
    team: string;
    batting_avg: number;
    home_runs: number;
    rbi: number;
    hits: number;
  }[];
}

export interface Insight {
  text: string;
}

export interface TeamDetail {
  team: string;
  players: string[];
  roster_batting: BattingStats[];
  roster_pitching: PitchingStats[];
  stats: Team;
}

export interface TeamGame {
  game_id: string;
  game_date: string;
  opponent: string;
  runs_scored: number;
  hits_total: number;
  home_runs_total: number;
}

export interface GameRecordInput {
  player_name: string;
  team: string;
  position: string;
  game_date: string;
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
  innings_pitched: number;
  earned_runs: number;
  hits_allowed: number;
  walks_allowed: number;
  strikeouts_pitched: number;
  game_id: string;
  opponent: string;
}

export interface GameSession {
  game_id: string;
  home_team: string;
  away_team: string;
  game_date: string;
  inning: number;
  score: Record<string, number>;
  player_stats: LivePlayerStats[];
  pitcher_stats: LivePitcherStats[];
  saved: boolean;
}

export interface LivePlayerStats {
  player_name: string;
  team: string;
  at_bats: number;
  hits: number;
  doubles: number;
  triples: number;
  home_runs: number;
  runs: number;
  rbi: number;
  walks: number;
  strikeouts: number;
}

export interface LivePitcherStats {
  pitcher_name: string;
  team: string;
  innings_pitched: number;
  strikeouts_pitched: number;
  walks_allowed: number;
  hits_allowed: number;
  earned_runs: number;
}

export interface AuthUser {
  username: string;
  email: string;
}

export interface AuthResponse {
  access_token: string;
  token_type: string;
  username: string;
  email: string;
}
