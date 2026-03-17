import pandas as pd
from typing import List, Dict, Any


class AnalyticsService:

    def calculate_batting_stats(self, df: pd.DataFrame) -> pd.DataFrame:
        """Calculate batting stats per player from raw game records."""
        if df.empty or "at_bats" not in df.columns:
            return pd.DataFrame()
        batters = df[df["at_bats"] > 0].copy()
        if batters.empty:
            return pd.DataFrame()

        grouped = batters.groupby(["player_name", "team", "position"]).agg(
            games_played=("game_id", "nunique"),
            at_bats=("at_bats", "sum"),
            hits=("hits", "sum"),
            doubles=("doubles", "sum"),
            triples=("triples", "sum"),
            home_runs=("home_runs", "sum"),
            runs=("runs", "sum"),
            rbi=("rbi", "sum"),
            strikeouts=("strikeouts", "sum"),
            walks=("walks", "sum"),
            hit_by_pitch=("hit_by_pitch", "sum"),
        ).reset_index()

        grouped["batting_avg"] = grouped.apply(
            lambda r: round(r["hits"] / r["at_bats"], 3) if r["at_bats"] > 0 else 0.0,
            axis=1
        )

        grouped["obp"] = grouped.apply(
            lambda r: round(
                (r["hits"] + r["walks"] + r["hit_by_pitch"]) /
                (r["at_bats"] + r["walks"] + r["hit_by_pitch"])
                if (r["at_bats"] + r["walks"] + r["hit_by_pitch"]) > 0 else 0.0,
                3
            ),
            axis=1
        )

        grouped["slg"] = grouped.apply(
            lambda r: round(
                (
                    (r["hits"] - r["doubles"] - r["triples"] - r["home_runs"])
                    + 2 * r["doubles"]
                    + 3 * r["triples"]
                    + 4 * r["home_runs"]
                ) / r["at_bats"]
                if r["at_bats"] > 0 else 0.0,
                3
            ),
            axis=1
        )

        grouped["ops"] = grouped.apply(
            lambda r: round(r["obp"] + r["slg"], 3),
            axis=1
        )

        return grouped.sort_values("batting_avg", ascending=False)

    def calculate_pitching_stats(self, df: pd.DataFrame) -> pd.DataFrame:
        """Calculate pitching stats per player from raw game records."""
        if df.empty or "innings_pitched" not in df.columns:
            return pd.DataFrame()
        pitchers = df[df["innings_pitched"] > 0].copy()
        if pitchers.empty:
            return pd.DataFrame()

        grouped = pitchers.groupby(["player_name", "team", "position"]).agg(
            games_started=("game_id", "nunique"),
            innings_pitched=("innings_pitched", "sum"),
            earned_runs=("earned_runs", "sum"),
            hits_allowed=("hits_allowed", "sum"),
            walks_allowed=("walks_allowed", "sum"),
            strikeouts_pitched=("strikeouts_pitched", "sum"),
        ).reset_index()

        grouped["era"] = grouped.apply(
            lambda r: round((r["earned_runs"] * 9) / r["innings_pitched"], 2)
            if r["innings_pitched"] > 0 else 0.0,
            axis=1
        )

        grouped["whip"] = grouped.apply(
            lambda r: round(
                (r["walks_allowed"] + r["hits_allowed"]) / r["innings_pitched"], 2
            )
            if r["innings_pitched"] > 0 else 0.0,
            axis=1
        )

        grouped["k_per_9"] = grouped.apply(
            lambda r: round((r["strikeouts_pitched"] * 9) / r["innings_pitched"], 2)
            if r["innings_pitched"] > 0 else 0.0,
            axis=1
        )

        grouped["bb_per_9"] = grouped.apply(
            lambda r: round((r["walks_allowed"] * 9) / r["innings_pitched"], 2)
            if r["innings_pitched"] > 0 else 0.0,
            axis=1
        )

        return grouped.sort_values("era", ascending=True)

    def calculate_team_stats(self, df: pd.DataFrame) -> pd.DataFrame:
        """Calculate team-level aggregated stats."""
        team_batting = df[df["at_bats"] > 0].groupby("team").agg(
            total_at_bats=("at_bats", "sum"),
            total_hits=("hits", "sum"),
            total_runs=("runs", "sum"),
            total_home_runs=("home_runs", "sum"),
            total_rbi=("rbi", "sum"),
            total_walks=("walks", "sum"),
        ).reset_index()

        team_batting["batting_avg"] = team_batting.apply(
            lambda r: round(r["total_hits"] / r["total_at_bats"], 3)
            if r["total_at_bats"] > 0 else 0.0,
            axis=1
        )

        team_pitching = df[df["innings_pitched"] > 0].groupby("team").agg(
            total_innings=("innings_pitched", "sum"),
            total_earned_runs=("earned_runs", "sum"),
            total_strikeouts_pitched=("strikeouts_pitched", "sum"),
            total_walks_allowed=("walks_allowed", "sum"),
        ).reset_index()

        team_pitching["team_era"] = team_pitching.apply(
            lambda r: round((r["total_earned_runs"] * 9) / r["total_innings"], 2)
            if r["total_innings"] > 0 else 0.0,
            axis=1
        )

        result = pd.merge(team_batting, team_pitching, on="team", how="left")
        return result

    def generate_insights(
        self,
        batting_df: pd.DataFrame,
        pitching_df: pd.DataFrame,
        team_df: pd.DataFrame
    ) -> List[str]:
        """Generate auto-insights from the analytics data."""
        insights = []

        if not batting_df.empty:
            top_batter = batting_df.iloc[0]
            insights.append(
                f"{top_batter['player_name']} leads all batters with a "
                f".{int(top_batter['batting_avg'] * 1000):03d} batting average."
            )

            top_hr = batting_df.sort_values("home_runs", ascending=False).iloc[0]
            insights.append(
                f"{top_hr['player_name']} leads the league with "
                f"{int(top_hr['home_runs'])} home runs."
            )

            top_rbi = batting_df.sort_values("rbi", ascending=False).iloc[0]
            insights.append(
                f"{top_rbi['player_name']} tops the RBI chart with "
                f"{int(top_rbi['rbi'])} runs batted in."
            )

            top_ops = batting_df.sort_values("ops", ascending=False).iloc[0]
            insights.append(
                f"{top_ops['player_name']} has the highest OPS at "
                f"{top_ops['ops']:.3f}."
            )

        if not pitching_df.empty:
            top_pitcher = pitching_df.iloc[0]
            insights.append(
                f"{top_pitcher['player_name']} leads all pitchers with a "
                f"{top_pitcher['era']:.2f} ERA."
            )

            top_k = pitching_df.sort_values("strikeouts_pitched", ascending=False).iloc[0]
            insights.append(
                f"{top_k['player_name']} leads in strikeouts with "
                f"{int(top_k['strikeouts_pitched'])} Ks."
            )

        if not team_df.empty:
            top_team_avg = team_df.sort_values("batting_avg", ascending=False).iloc[0]
            insights.append(
                f"The {top_team_avg['team']} have the best team batting average at "
                f".{int(top_team_avg['batting_avg'] * 1000):03d}."
            )

            top_run_team = team_df.sort_values("total_runs", ascending=False).iloc[0]
            insights.append(
                f"The {top_run_team['team']} lead the league with "
                f"{int(top_run_team['total_runs'])} total runs scored."
            )

        return insights

    def get_performance_trend(
        self,
        df: pd.DataFrame,
        player_name: str,
        stat: str = "batting_avg"
    ) -> List[Dict[str, Any]]:
        """Get time series performance data for a player."""
        player_data = df[df["player_name"] == player_name].copy()
        if player_data.empty:
            return []

        player_data = player_data.sort_values("game_date")
        trend = []

        for _, row in player_data.iterrows():
            point: Dict[str, Any] = {
                "game_date": str(row["game_date"]),
                "game_id": row["game_id"],
                "opponent": row["opponent"],
            }

            if stat == "batting_avg":
                point["value"] = round(row["hits"] / row["at_bats"], 3) if row["at_bats"] > 0 else 0.0
            elif stat == "hits":
                point["value"] = int(row["hits"])
            elif stat == "home_runs":
                point["value"] = int(row["home_runs"])
            elif stat == "rbi":
                point["value"] = int(row["rbi"])
            elif stat == "era":
                point["value"] = round((row["earned_runs"] * 9) / row["innings_pitched"], 2) if row["innings_pitched"] > 0 else None
            else:
                point["value"] = float(row.get(stat, 0))

            trend.append(point)

        return trend
