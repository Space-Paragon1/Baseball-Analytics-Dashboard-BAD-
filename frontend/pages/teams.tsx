import { useEffect, useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import LoadingSpinner from "../components/LoadingSpinner";
import ErrorMessage from "../components/ErrorMessage";
import PieChart from "../components/Charts/PieChart";
import LineChart from "../components/Charts/LineChart";
import { fetchTeams, fetchTeam, fetchTeamGames } from "../utils/api";
import type { Team, TeamDetail, TeamGame } from "../types";

function formatAvg(val: number): string {
  if (!val && val !== 0) return ".000";
  return "." + Math.round(val * 1000).toString().padStart(3, "0");
}

export default function TeamsPage() {
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedTeam, setExpandedTeam] = useState<string | null>(null);
  const [teamDetail, setTeamDetail] = useState<TeamDetail | null>(null);
  const [teamGames, setTeamGames] = useState<TeamGame[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchTeams();
      setTeams(data);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to load team data.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const handleTeamClick = async (teamName: string) => {
    if (expandedTeam === teamName) {
      setExpandedTeam(null);
      setTeamDetail(null);
      setTeamGames([]);
      return;
    }
    setExpandedTeam(teamName);
    setDetailLoading(true);
    try {
      const [detail, games] = await Promise.all([
        fetchTeam(teamName),
        fetchTeamGames(teamName),
      ]);
      setTeamDetail(detail);
      setTeamGames(games);
    } catch {
      setTeamDetail(null);
      setTeamGames([]);
    } finally {
      setDetailLoading(false);
    }
  };

  if (loading) return <LoadingSpinner />;
  if (error) return <ErrorMessage message={error} onRetry={load} />;

  return (
    <div>
      <h1 className="page-title">Team Analytics</h1>
      <p className="page-subtitle">Team standings and performance overview</p>

      {/* Team Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 mb-6">
        {teams.map((team) => (
          <div key={team.team} className="stat-card cursor-pointer" onClick={() => handleTeamClick(team.team)}>
            <div className="flex items-start justify-between mb-4">
              <div>
                <h3 className="text-lg font-bold text-gray-900">{team.team}</h3>
                <p className="text-xs text-gray-500 mt-0.5">Season Stats</p>
              </div>
              <div className="flex items-center gap-1 text-gray-400">
                {expandedTeam === team.team ? (
                  <ChevronUp className="w-5 h-5 text-blue-500" />
                ) : (
                  <ChevronDown className="w-5 h-5" />
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="bg-blue-50 rounded-lg p-2.5">
                <p className="text-xs text-blue-600 font-medium">Team AVG</p>
                <p className="text-xl font-bold text-blue-800 mt-0.5">
                  {formatAvg(team.batting_avg)}
                </p>
              </div>
              <div className="bg-emerald-50 rounded-lg p-2.5">
                <p className="text-xs text-emerald-600 font-medium">Runs Scored</p>
                <p className="text-xl font-bold text-emerald-800 mt-0.5">
                  {team.total_runs}
                </p>
              </div>
              <div className="bg-amber-50 rounded-lg p-2.5">
                <p className="text-xs text-amber-600 font-medium">Home Runs</p>
                <p className="text-xl font-bold text-amber-800 mt-0.5">
                  {team.total_home_runs}
                </p>
              </div>
              <div className="bg-purple-50 rounded-lg p-2.5">
                <p className="text-xs text-purple-600 font-medium">Team ERA</p>
                <p className="text-xl font-bold text-purple-800 mt-0.5">
                  {team.team_era ? team.team_era.toFixed(2) : "N/A"}
                </p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Expanded Team Detail */}
      {expandedTeam && (
        <div className="bg-white rounded-xl shadow-card border border-gray-100 p-5">
          <h2 className="text-lg font-bold text-gray-900 mb-4">
            {expandedTeam} — Detailed View
          </h2>

          {detailLoading ? (
            <div className="flex justify-center py-10">
              <div className="w-8 h-8 border-2 border-blue-200 border-t-blue-700 rounded-full animate-spin" />
            </div>
          ) : (
            <>
              {/* Roster Table */}
              {teamDetail && teamDetail.roster_batting.length > 0 && (
                <div className="mb-6">
                  <h3 className="font-semibold text-gray-700 text-sm mb-3">
                    Batting Roster
                  </h3>
                  <div className="overflow-x-auto rounded-lg border border-gray-100">
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th>Player</th>
                          <th>Pos</th>
                          <th>GP</th>
                          <th>AVG</th>
                          <th>OPS</th>
                          <th>HR</th>
                          <th>RBI</th>
                          <th>H</th>
                        </tr>
                      </thead>
                      <tbody>
                        {teamDetail.roster_batting.map((p) => (
                          <tr key={p.player_name}>
                            <td className="font-semibold">{p.player_name}</td>
                            <td className="text-gray-500">{p.position}</td>
                            <td>{p.games_played}</td>
                            <td className="font-bold text-blue-700">
                              {formatAvg(p.batting_avg)}
                            </td>
                            <td>{p.ops.toFixed(3)}</td>
                            <td>{p.home_runs}</td>
                            <td>{p.rbi}</td>
                            <td>{p.hits}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Charts */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {teamDetail && teamDetail.roster_batting.length > 0 && (
                  <PieChart
                    data={teamDetail.roster_batting.map((p) => ({
                      name: p.player_name.split(" ")[1] || p.player_name,
                      value: p.runs,
                    }))}
                    title={`${expandedTeam} — Run Contributions`}
                    height={260}
                  />
                )}

                {teamGames.length > 0 && (
                  <LineChart
                    data={teamGames.map((g) => ({
                      game_date: g.game_date.slice(5),
                      runs_scored: g.runs_scored,
                      hits_total: g.hits_total,
                    })) as Record<string, unknown>[]}
                    xKey="game_date"
                    lines={[
                      { key: "runs_scored", color: "#3b82f6", name: "Runs" },
                      { key: "hits_total", color: "#10b981", name: "Hits" },
                    ]}
                    title={`${expandedTeam} — Performance Over Time`}
                    height={260}
                  />
                )}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
