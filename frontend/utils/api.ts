import axios, { AxiosError } from "axios";
import type {
  AuthResponse,
  AuthUser,
  BattingStats,
  ComparePlayer,
  DashboardData,
  DateRange,
  GameRecord,
  GameRecordInput,
  GameSessionSummary,
  GameState,
  ImportResult,
  ManagedUser,
  Meta,
  MlbTeam,
  NewUserInput,
  NewUserResult,
  PitchingStats,
  PlayResult,
  PlayerDetail,
  RecordPage,
  Side,
  Team,
  TeamDetail,
  TeamGame,
  TrendPoint,
} from "../types";

export const API_BASE = (process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000").replace(/\/$/, "");
export const TOKEN_KEY = "auth_token";
export const AUTH_EXPIRED_EVENT = "auth:expired";

const api = axios.create({ baseURL: API_BASE, timeout: 60000 });

api.interceptors.request.use((config) => {
  if (typeof window !== "undefined") {
    const token = window.localStorage.getItem(TOKEN_KEY);
    if (token) config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (error: AxiosError) => {
    // A stored token that the server rejects has expired: sign out everywhere.
    // (A failed sign-in also returns 401, but says nothing about the stored token.)
    if (
      error.response?.status === 401 &&
      error.config?.url !== "/auth/login" &&
      typeof window !== "undefined" &&
      window.localStorage.getItem(TOKEN_KEY)
    ) {
      window.localStorage.removeItem(TOKEN_KEY);
      window.dispatchEvent(new Event(AUTH_EXPIRED_EVENT));
    }
    return Promise.reject(error);
  }
);

/** A readable message from any API error (FastAPI `detail` in its various shapes). */
export function getErrorMessage(err: unknown, fallback = "Something went wrong."): string {
  if (axios.isAxiosError(err)) {
    if (!err.response) return "Can't reach the API. Is the backend running?";
    const detail = (err.response.data as { detail?: unknown } | undefined)?.detail;
    if (typeof detail === "string") return detail;
    if (Array.isArray(detail)) {
      // Pydantic validation errors
      return detail
        .map((d: { loc?: (string | number)[]; msg?: string }) => {
          const field = (d.loc || []).filter((p) => p !== "body").join(".");
          const msg = (d.msg || "").replace(/^Value error, /, "");
          return field ? `${field}: ${msg}` : msg;
        })
        .join("; ");
    }
    if (detail && typeof detail === "object" && "message" in detail) return String((detail as { message: string }).message);
    return err.message;
  }
  return err instanceof Error ? err.message : fallback;
}

/** Row-level errors from a rejected upload, if any. */
export function getErrorList(err: unknown): string[] {
  if (axios.isAxiosError(err)) {
    const detail = (err.response?.data as { detail?: { errors?: string[] } } | undefined)?.detail;
    if (detail && typeof detail === "object" && Array.isArray(detail.errors)) return detail.errors;
  }
  return [];
}

export function rangeParams(range?: Partial<DateRange>): Record<string, string> {
  const params: Record<string, string> = {};
  if (range?.start) params.start_date = range.start;
  if (range?.end) params.end_date = range.end;
  return params;
}

/** Absolute URL for download links (CSV/PDF exports). */
export function exportUrl(path: string, params: Record<string, string | boolean | undefined> = {}): string {
  const qs = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== "" && v !== false) qs.set(k, String(v));
  });
  const q = qs.toString();
  return `${API_BASE}${path}${q ? `?${q}` : ""}`;
}


const get = async <T>(url: string, params?: Record<string, unknown>) => (await api.get<T>(url, { params })).data;

// ---------------------------------------------------------------- reads

export const fetchHealth = () => get<{ status: string; version: string }>("/health");
export const fetchMeta = () => get<Meta>("/meta");
export const fetchDashboard = (range?: DateRange) => get<DashboardData>("/stats/dashboard", rangeParams(range));
export const fetchInsights = (range?: DateRange) => get<string[]>("/stats/insights", rangeParams(range));
export const fetchBattingStats = (range?: DateRange) => get<BattingStats[]>("/stats/batting", rangeParams(range));
export const fetchPitchingStats = (range?: DateRange) => get<PitchingStats[]>("/stats/pitching", rangeParams(range));
export const fetchPlayer = (id: number, range?: DateRange) => get<PlayerDetail>(`/players/${id}`, rangeParams(range));
export const fetchPlayerTrend = (id: number, stat: string, range?: DateRange) =>
  get<TrendPoint[]>(`/players/${id}/trend`, { stat, ...rangeParams(range) });
export const fetchTeams = (range?: DateRange) => get<Team[]>("/teams", rangeParams(range));
export const fetchTeam = (name: string, range?: DateRange) =>
  get<TeamDetail>(`/teams/${encodeURIComponent(name)}`, rangeParams(range));
export const fetchTeamGames = (name: string, range?: DateRange) =>
  get<TeamGame[]>(`/teams/${encodeURIComponent(name)}/games`, rangeParams(range));

export async function fetchComparePlayers(ids: number[], range?: DateRange): Promise<ComparePlayer[]> {
  const qs = new URLSearchParams(rangeParams(range));
  ids.forEach((id) => qs.append("ids", String(id)));
  return (await api.get<ComparePlayer[]>(`/players/compare?${qs}`)).data;
}

// ---------------------------------------------------------------- records

export interface RecordQuery {
  search?: string;
  team?: string;
  game_id?: string;
  start_date?: string;
  end_date?: string;
  page?: number;
  page_size?: number;
}

export const fetchRecords = (q: RecordQuery) => {
  const params = Object.fromEntries(Object.entries(q).filter(([, v]) => v !== "" && v !== undefined));
  return get<RecordPage>("/records", params);
};
export const createRecord = async (body: GameRecordInput) => (await api.post<GameRecord>("/records", body)).data;
export const updateRecord = async (id: number, body: GameRecordInput) =>
  (await api.put<GameRecord>(`/records/${id}`, body)).data;
export const deleteRecord = async (id: number) => {
  await api.delete(`/records/${id}`);
};

export async function uploadCSV(file: File, mode: "replace" | "append"): Promise<ImportResult> {
  const form = new FormData();
  form.append("file", file);
  form.append("mode", mode);
  return (await api.post<ImportResult>("/upload-csv", form)).data;
}

// ---------------------------------------------------------------- MLB import

export const fetchMlbTeams = (season: number) => get<MlbTeam[]>("/import/mlb/teams", { season });
export const importMlb = async (body: {
  start_date: string;
  end_date: string;
  team_id?: number;
  mode: "append" | "replace";
}) => (await api.post<ImportResult>("/import/mlb", body, { timeout: 180000 })).data;

// ---------------------------------------------------------------- Game Mode

export const startGame = async (home_team: string, away_team: string, game_date: string) =>
  (await api.post<GameState>("/game-mode/start", { home_team, away_team, game_date })).data;
export const fetchGameSessions = () => get<GameSessionSummary[]>("/game-mode/sessions");
export const fetchGame = (id: string) => get<GameState>(`/game-mode/${id}`);
export const setPitcher = async (id: string, side: Side, name: string) =>
  (await api.post<GameState>(`/game-mode/${id}/pitcher`, { side, name })).data;
export const logPlateAppearance = async (id: string, batter: string, result: PlayResult, position?: string) =>
  (await api.post<GameState>(`/game-mode/${id}/plate-appearance`, { batter, result, position: position || null }))
    .data;
export const undoPlay = async (id: string) => (await api.post<GameState>(`/game-mode/${id}/undo`)).data;
export const saveGame = async (id: string) =>
  (await api.post<GameState & { message: string; records_saved: number }>(`/game-mode/${id}/save`)).data;
export const discardGame = async (id: string) => {
  await api.delete(`/game-mode/${id}`);
};

// ---------------------------------------------------------------- auth

export const fetchAuthConfig = () => get<{ registration_open: boolean; has_users: boolean }>("/auth/config");
export const authLogin = async (username: string, password: string) =>
  (await api.post<AuthResponse>("/auth/login", { username, password })).data;
export const authRegister = async (username: string, email: string, password: string) =>
  (await api.post<AuthResponse>("/auth/register", { username, email, password })).data;
export const authMe = () => get<AuthUser>("/auth/me");
/** Returns a fresh token; every other session is signed out. */
export const authChangePassword = async (current_password: string, new_password: string) =>
  (await api.post<AuthResponse>("/auth/change-password", { current_password, new_password })).data;

// ---------------------------------------------------------------- users (admin)

export const fetchUsers = () => get<ManagedUser[]>("/users");
export const createUser = async (body: NewUserInput) => (await api.post<NewUserResult>("/users", body)).data;
export const updateUser = async (id: number, changes: { is_admin?: boolean; is_active?: boolean }) =>
  (await api.patch<ManagedUser>(`/users/${id}`, changes)).data;
export const resetUserPassword = async (id: number) =>
  (await api.post<{ temporary_password: string }>(`/users/${id}/reset-password`)).data;
export const deleteUser = async (id: number) => {
  await api.delete(`/users/${id}`);
};

export default api;
