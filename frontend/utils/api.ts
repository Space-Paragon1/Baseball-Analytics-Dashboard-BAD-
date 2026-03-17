import axios from "axios";
import type {
  BattingStats,
  PitchingStats,
  Player,
  Team,
  DashboardData,
  TrendData,
  TeamDetail,
  TeamGame,
  PlayerCompare,
  GameRecordInput,
  GameSession,
  AuthResponse,
} from "../types";

const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000",
  headers: {
    "Content-Type": "application/json",
  },
  timeout: 15000,
});

export async function fetchDashboard(
  startDate?: string,
  endDate?: string
): Promise<DashboardData> {
  const params: Record<string, string> = {};
  if (startDate) params.start_date = startDate;
  if (endDate) params.end_date = endDate;
  const res = await api.get<DashboardData>("/stats/dashboard", { params });
  return res.data;
}

export async function fetchPlayers(): Promise<BattingStats[]> {
  const res = await api.get<BattingStats[]>("/players");
  return res.data;
}

export async function fetchPlayer(name: string): Promise<Player> {
  const res = await api.get<Player>(`/players/${encodeURIComponent(name)}`);
  return res.data;
}

export async function fetchPlayerTrend(
  name: string,
  stat: string = "batting_avg"
): Promise<TrendData[]> {
  const res = await api.get<TrendData[]>(
    `/players/${encodeURIComponent(name)}/trend?stat=${stat}`
  );
  return res.data;
}

export async function fetchComparePlayers(
  names: string[]
): Promise<PlayerCompare[]> {
  const params = names.map((n) => `players=${encodeURIComponent(n)}`).join("&");
  const res = await api.get<PlayerCompare[]>(`/players/compare?${params}`);
  return res.data;
}

export async function fetchTeams(): Promise<Team[]> {
  const res = await api.get<Team[]>("/teams");
  return res.data;
}

export async function fetchTeam(name: string): Promise<TeamDetail> {
  const res = await api.get<TeamDetail>(`/teams/${encodeURIComponent(name)}`);
  return res.data;
}

export async function fetchTeamGames(name: string): Promise<TeamGame[]> {
  const res = await api.get<TeamGame[]>(
    `/teams/${encodeURIComponent(name)}/games`
  );
  return res.data;
}

export async function fetchBattingStats(
  startDate?: string,
  endDate?: string
): Promise<BattingStats[]> {
  const params: Record<string, string> = {};
  if (startDate) params.start_date = startDate;
  if (endDate) params.end_date = endDate;
  const res = await api.get<BattingStats[]>("/stats/batting", { params });
  return res.data;
}

export async function fetchPitchingStats(
  startDate?: string,
  endDate?: string
): Promise<PitchingStats[]> {
  const params: Record<string, string> = {};
  if (startDate) params.start_date = startDate;
  if (endDate) params.end_date = endDate;
  const res = await api.get<PitchingStats[]>("/stats/pitching", { params });
  return res.data;
}

export async function fetchInsights(): Promise<string[]> {
  const res = await api.get<string[]>("/stats/insights");
  return res.data;
}

export async function uploadCSV(
  file: File
): Promise<{ success: boolean; message: string; rows_loaded: number }> {
  const formData = new FormData();
  formData.append("file", file);
  const res = await api.post("/upload-csv", formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return res.data;
}

export async function addGameRecord(
  data: GameRecordInput
): Promise<{ success: boolean; message: string; id: number }> {
  const res = await api.post("/add-game-record", data);
  return res.data;
}

// Game Mode API
export async function startGame(
  homeTeam: string,
  awayTeam: string,
  gameDate: string
): Promise<{ game_id: string; message: string; session: GameSession }> {
  const res = await api.post("/game-mode/start", {
    home_team: homeTeam,
    away_team: awayTeam,
    game_date: gameDate,
  });
  return res.data;
}

export async function logAtBat(
  gameId: string,
  playerName: string,
  team: string,
  result: string
): Promise<{ message: string; player_stats: unknown; score: Record<string, number> }> {
  const res = await api.post("/game-mode/at-bat", {
    game_id: gameId,
    player_name: playerName,
    team,
    result,
  });
  return res.data;
}

export async function logPitch(
  gameId: string,
  pitcherName: string,
  team: string,
  result: string
): Promise<{ message: string; pitcher_stats: unknown }> {
  const res = await api.post("/game-mode/pitch", {
    game_id: gameId,
    pitcher_name: pitcherName,
    team,
    result,
  });
  return res.data;
}

export async function fetchScoreboard(gameId: string): Promise<GameSession> {
  const res = await api.get<GameSession>(`/game-mode/${gameId}/scoreboard`);
  return res.data;
}

export async function saveGame(
  gameId: string
): Promise<{ success: boolean; message: string; records_saved: number }> {
  const res = await api.post(`/game-mode/${gameId}/save`);
  return res.data;
}

// Auth API
export async function authLogin(
  username: string,
  password: string
): Promise<AuthResponse> {
  const res = await api.post<AuthResponse>("/auth/login", { username, password });
  return res.data;
}

export async function authRegister(
  username: string,
  email: string,
  password: string
): Promise<AuthResponse> {
  const res = await api.post<AuthResponse>("/auth/register", {
    username,
    email,
    password,
  });
  return res.data;
}

export async function authMe(): Promise<{
  id: number;
  username: string;
  email: string;
  created_at: string;
}> {
  const res = await api.get("/auth/me");
  return res.data;
}

export default api;
