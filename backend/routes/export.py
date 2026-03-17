import io
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
import pandas as pd
from typing import Dict, Any

from backend.database import get_db
from backend.models.game_record import GameRecord
from backend.services.analytics import AnalyticsService

router = APIRouter()
analytics = AnalyticsService()


def records_to_df(db: Session) -> pd.DataFrame:
    records = db.query(GameRecord).all()
    if not records:
        return pd.DataFrame()
    data = [
        {
            "player_id": r.player_id,
            "player_name": r.player_name,
            "team": r.team,
            "position": r.position,
            "game_date": r.game_date,
            "at_bats": r.at_bats,
            "hits": r.hits,
            "doubles": r.doubles,
            "triples": r.triples,
            "home_runs": r.home_runs,
            "runs": r.runs,
            "rbi": r.rbi,
            "strikeouts": r.strikeouts,
            "walks": r.walks,
            "hit_by_pitch": r.hit_by_pitch,
            "innings_pitched": r.innings_pitched,
            "earned_runs": r.earned_runs,
            "hits_allowed": r.hits_allowed,
            "walks_allowed": r.walks_allowed,
            "strikeouts_pitched": r.strikeouts_pitched,
            "game_id": r.game_id,
            "opponent": r.opponent,
        }
        for r in records
    ]
    return pd.DataFrame(data)


@router.get("/export/batting-csv")
def export_batting_csv(db: Session = Depends(get_db)):
    df = records_to_df(db)
    if df.empty:
        raise HTTPException(status_code=404, detail="No data available")

    batting_df = analytics.calculate_batting_stats(df)
    batting_df = batting_df.sort_values("batting_avg", ascending=False)

    output = io.StringIO()
    batting_df.to_csv(output, index=False)
    output.seek(0)

    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=batting_leaderboard.csv"},
    )


@router.get("/export/pitching-csv")
def export_pitching_csv(db: Session = Depends(get_db)):
    df = records_to_df(db)
    if df.empty:
        raise HTTPException(status_code=404, detail="No data available")

    pitching_df = analytics.calculate_pitching_stats(df)
    if pitching_df.empty:
        raise HTTPException(status_code=404, detail="No pitching data available")
    pitching_df = pitching_df.sort_values("era", ascending=True)

    output = io.StringIO()
    pitching_df.to_csv(output, index=False)
    output.seek(0)

    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=pitching_leaderboard.csv"},
    )


@router.get("/export/player-pdf/{player_name}")
def export_player_pdf(player_name: str, db: Session = Depends(get_db)):
    try:
        from reportlab.lib.pagesizes import letter
        from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
        from reportlab.lib.units import inch
        from reportlab.lib import colors
        from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle
    except ImportError:
        raise HTTPException(status_code=500, detail="reportlab is not installed.")

    df = records_to_df(db)
    if df.empty:
        raise HTTPException(status_code=404, detail="No data found")

    player_df = df[df["player_name"].str.lower() == player_name.lower()]
    if player_df.empty:
        raise HTTPException(status_code=404, detail=f"Player '{player_name}' not found.")

    actual_name = player_df.iloc[0]["player_name"]
    team = player_df.iloc[0]["team"]
    position = player_df.iloc[0]["position"]

    batting_df = analytics.calculate_batting_stats(df)
    pitching_df = analytics.calculate_pitching_stats(df)

    batting_row = batting_df[batting_df["player_name"].str.lower() == player_name.lower()]
    pitching_row = pitching_df[pitching_df["player_name"].str.lower() == player_name.lower()]

    buf = io.BytesIO()
    doc = SimpleDocTemplate(buf, pagesize=letter, leftMargin=0.75 * inch, rightMargin=0.75 * inch,
                            topMargin=0.75 * inch, bottomMargin=0.75 * inch)
    styles = getSampleStyleSheet()
    story = []

    # Title
    title_style = ParagraphStyle("title", parent=styles["Title"], fontSize=22, textColor=colors.HexColor("#1e40af"))
    story.append(Paragraph(f"Player Card: {actual_name}", title_style))
    story.append(Spacer(1, 0.15 * inch))

    # Player info
    info_style = ParagraphStyle("info", parent=styles["Normal"], fontSize=11)
    story.append(Paragraph(f"<b>Team:</b> {team}  |  <b>Position:</b> {position}", info_style))
    story.append(Spacer(1, 0.2 * inch))

    # Batting stats table
    if not batting_row.empty:
        b = batting_row.iloc[0]
        story.append(Paragraph("<b>Batting Statistics</b>", styles["Heading2"]))
        story.append(Spacer(1, 0.1 * inch))
        batting_data = [
            ["Stat", "Value"],
            ["Games Played", str(int(b["games_played"]))],
            ["At Bats", str(int(b["at_bats"]))],
            ["Hits", str(int(b["hits"]))],
            ["Doubles", str(int(b["doubles"]))],
            ["Triples", str(int(b["triples"]))],
            ["Home Runs", str(int(b["home_runs"]))],
            ["Runs", str(int(b["runs"]))],
            ["RBI", str(int(b["rbi"]))],
            ["Walks", str(int(b["walks"]))],
            ["Strikeouts", str(int(b["strikeouts"]))],
            ["Batting AVG", f".{int(b['batting_avg'] * 1000):03d}"],
            ["OBP", f".{int(b['obp'] * 1000):03d}"],
            ["SLG", f".{int(b['slg'] * 1000):03d}"],
            ["OPS", f"{b['ops']:.3f}"],
        ]
        t = Table(batting_data, colWidths=[3 * inch, 3 * inch])
        t.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#1e40af")),
            ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
            ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
            ("FONTSIZE", (0, 0), (-1, -1), 10),
            ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.HexColor("#f8fafc"), colors.white]),
            ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#e2e8f0")),
            ("ALIGN", (1, 0), (1, -1), "CENTER"),
            ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
            ("TOPPADDING", (0, 0), (-1, -1), 5),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
        ]))
        story.append(t)
        story.append(Spacer(1, 0.25 * inch))

        # Summary line
        summary = (
            f"{actual_name} batted .{int(b['batting_avg'] * 1000):03d} with "
            f"{int(b['home_runs'])} home runs and {int(b['rbi'])} RBI, "
            f"posting an OPS of {b['ops']:.3f} over {int(b['games_played'])} games."
        )
        story.append(Paragraph(f"<i>{summary}</i>", info_style))
        story.append(Spacer(1, 0.2 * inch))

    # Pitching stats table
    if not pitching_row.empty:
        p = pitching_row.iloc[0]
        story.append(Paragraph("<b>Pitching Statistics</b>", styles["Heading2"]))
        story.append(Spacer(1, 0.1 * inch))
        pitching_data = [
            ["Stat", "Value"],
            ["Games Started", str(int(p["games_started"]))],
            ["Innings Pitched", f"{p['innings_pitched']:.1f}"],
            ["Earned Runs", str(int(p["earned_runs"]))],
            ["Hits Allowed", str(int(p["hits_allowed"]))],
            ["Walks Allowed", str(int(p["walks_allowed"]))],
            ["Strikeouts", str(int(p["strikeouts_pitched"]))],
            ["ERA", f"{p['era']:.2f}"],
            ["WHIP", f"{p['whip']:.2f}"],
            ["K/9", f"{p['k_per_9']:.2f}"],
            ["BB/9", f"{p['bb_per_9']:.2f}"],
        ]
        t2 = Table(pitching_data, colWidths=[3 * inch, 3 * inch])
        t2.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#7c3aed")),
            ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
            ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
            ("FONTSIZE", (0, 0), (-1, -1), 10),
            ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.HexColor("#faf5ff"), colors.white]),
            ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#e2e8f0")),
            ("ALIGN", (1, 0), (1, -1), "CENTER"),
            ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
            ("TOPPADDING", (0, 0), (-1, -1), 5),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
        ]))
        story.append(t2)
        story.append(Spacer(1, 0.2 * inch))

    # Footer
    story.append(Paragraph("<font size='8' color='#94a3b8'>Generated by Baseball Analytics Dashboard (BAD)</font>",
                            styles["Normal"]))

    doc.build(story)
    buf.seek(0)

    safe_name = actual_name.replace(" ", "_")
    return StreamingResponse(
        buf,
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename={safe_name}_player_card.pdf"},
    )
