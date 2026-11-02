import io
import re
from typing import Optional
from xml.sax.saxutils import escape

import pandas as pd
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from backend.database import get_db
from backend.routes.common import DateRange, date_range
from backend.services import analytics
from backend.services.records import load_df

router = APIRouter(prefix="/export", tags=["Export"])


def _csv_safe(df: pd.DataFrame) -> pd.DataFrame:
    """Stop spreadsheet apps from running text cells as formulas."""
    out = df.copy()
    for col in out.columns:
        if out[col].dtype == object or pd.api.types.is_string_dtype(out[col]):
            out[col] = out[col].map(lambda v: f"'{v}" if isinstance(v, str) and v[:1] in ("=", "+", "-", "@") else v)
    return out


def _csv_response(df: pd.DataFrame, filename: str) -> StreamingResponse:
    buf = io.StringIO()
    _csv_safe(df).to_csv(buf, index=False)
    return StreamingResponse(
        iter([buf.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


def _filtered(df: pd.DataFrame, team: Optional[str], qualified_only: bool) -> pd.DataFrame:
    if team:
        df = df[df["team"].str.lower() == team.lower()]
    if qualified_only:
        df = df[df["qualified"]]
    return df


@router.get("/batting-csv")
def export_batting_csv(
    dates: DateRange = Depends(date_range),
    team: Optional[str] = None,
    qualified_only: bool = False,
    db: Session = Depends(get_db),
):
    stats = analytics.calculate_batting_stats(load_df(db, dates.start_date, dates.end_date))
    if stats.empty:
        raise HTTPException(status_code=404, detail="No batting data available.")
    return _csv_response(_filtered(stats, team, qualified_only), "batting_leaderboard.csv")


@router.get("/pitching-csv")
def export_pitching_csv(
    dates: DateRange = Depends(date_range),
    team: Optional[str] = None,
    qualified_only: bool = False,
    db: Session = Depends(get_db),
):
    stats = analytics.calculate_pitching_stats(load_df(db, dates.start_date, dates.end_date))
    if stats.empty:
        raise HTTPException(status_code=404, detail="No pitching data available.")
    return _csv_response(_filtered(stats, team, qualified_only), "pitching_leaderboard.csv")


def _fmt3(v) -> str:
    return analytics.fmt_avg(v) if v is not None else "-"


def _fmt2(v) -> str:
    return f"{v:.2f}" if v is not None else "-"


@router.get("/player-pdf/{player_id}")
def export_player_pdf(player_id: int, dates: DateRange = Depends(date_range), db: Session = Depends(get_db)):
    from reportlab.lib import colors
    from reportlab.lib.pagesizes import letter
    from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
    from reportlab.lib.units import inch
    from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle

    df = load_df(db, dates.start_date, dates.end_date)
    if df.empty or not (df["player_id"] == player_id).any():
        raise HTTPException(status_code=404, detail="Player not found.")

    info = analytics.player_identity(df[df["player_id"] == player_id]).iloc[0]
    batting = analytics.calculate_batting_stats(df)
    pitching = analytics.calculate_pitching_stats(df)
    b = analytics.to_records(batting[batting["player_id"] == player_id]) if not batting.empty else []
    p = analytics.to_records(pitching[pitching["player_id"] == player_id]) if not pitching.empty else []

    name = escape(str(info["player_name"]))
    buf = io.BytesIO()
    doc = SimpleDocTemplate(
        buf,
        pagesize=letter,
        leftMargin=0.75 * inch,
        rightMargin=0.75 * inch,
        topMargin=0.75 * inch,
        bottomMargin=0.75 * inch,
        title=f"Player Card: {info['player_name']}",
    )
    styles = getSampleStyleSheet()
    info_style = ParagraphStyle("info", parent=styles["Normal"], fontSize=11)
    story = [
        Paragraph(
            f"Player Card: {name}",
            ParagraphStyle("t", parent=styles["Title"], fontSize=22, textColor=colors.HexColor("#1e40af")),
        ),
        Spacer(1, 0.15 * inch),
        Paragraph(
            f"<b>Team:</b> {escape(str(info['team']))} &nbsp;|&nbsp; <b>Position:</b> {escape(str(info['position']))}",
            info_style,
        ),
    ]
    if dates.start_date or dates.end_date:
        span = f"{dates.start_date or 'start'} to {dates.end_date or 'latest'}"
        story.append(Paragraph(f"<b>Dates:</b> {span}", info_style))
    story.append(Spacer(1, 0.2 * inch))

    def table(rows, header_color, stripe):
        t = Table([["Stat", "Value"], *rows], colWidths=[3 * inch, 3 * inch])
        t.setStyle(
            TableStyle(
                [
                    ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor(header_color)),
                    ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
                    ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
                    ("FONTSIZE", (0, 0), (-1, -1), 10),
                    ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.HexColor(stripe), colors.white]),
                    ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#e2e8f0")),
                    ("ALIGN", (1, 0), (1, -1), "CENTER"),
                    ("TOPPADDING", (0, 0), (-1, -1), 5),
                    ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
                ]
            )
        )
        return t

    if b:
        s = b[0]
        story += [
            Paragraph("<b>Batting</b>", styles["Heading2"]),
            Spacer(1, 0.1 * inch),
            table(
                [
                    ["Games", s["games_played"]],
                    ["Plate Appearances", s["plate_appearances"]],
                    ["At Bats", s["at_bats"]],
                    ["Hits", s["hits"]],
                    ["Doubles", s["doubles"]],
                    ["Triples", s["triples"]],
                    ["Home Runs", s["home_runs"]],
                    ["Runs", s["runs"]],
                    ["RBI", s["rbi"]],
                    ["Walks", s["walks"]],
                    ["Strikeouts", s["strikeouts"]],
                    ["AVG / OBP / SLG", f"{_fmt3(s['batting_avg'])} / {_fmt3(s['obp'])} / {_fmt3(s['slg'])}"],
                    ["OPS", f"{s['ops']:.3f}"],
                    ["ISO", _fmt3(s["iso"])],
                    ["BABIP", _fmt3(s["babip"])],
                    ["wOBA", _fmt3(s["woba"])],
                    ["K% / BB%", f"{s['k_pct'] * 100:.1f}% / {s['bb_pct'] * 100:.1f}%"],
                ],
                "#1e40af",
                "#f8fafc",
            ),
            Spacer(1, 0.2 * inch),
            Paragraph(
                f"<i>{name} hit {_fmt3(s['batting_avg'])} with {s['home_runs']} home runs and {s['rbi']} RBI, "
                f"an OPS of {s['ops']:.3f} over {s['games_played']} games.</i>",
                info_style,
            ),
            Spacer(1, 0.25 * inch),
        ]

    if p:
        s = p[0]
        story += [
            Paragraph("<b>Pitching</b>", styles["Heading2"]),
            Spacer(1, 0.1 * inch),
            table(
                [
                    ["Games", s["games"]],
                    ["Innings Pitched", f"{s['innings_pitched']:.1f}"],
                    ["Earned Runs", s["earned_runs"]],
                    ["Hits Allowed", s["hits_allowed"]],
                    ["Walks Allowed", s["walks_allowed"]],
                    ["Strikeouts", s["strikeouts_pitched"]],
                    ["Home Runs Allowed", s["home_runs_allowed"]],
                    ["ERA", _fmt2(s["era"])],
                    ["FIP", _fmt2(s["fip"])],
                    ["WHIP", _fmt2(s["whip"])],
                    ["K/9", _fmt2(s["k_per_9"])],
                    ["BB/9", _fmt2(s["bb_per_9"])],
                    ["K/BB", _fmt2(s["k_bb"])],
                ],
                "#7c3aed",
                "#faf5ff",
            ),
            Spacer(1, 0.2 * inch),
        ]

    story.append(
        Paragraph(
            "<font size='8' color='#94a3b8'>Generated by Baseball Analytics Dashboard (BAD)</font>", styles["Normal"]
        )
    )
    doc.build(story)
    buf.seek(0)

    safe = re.sub(r"[^A-Za-z0-9_-]+", "_", str(info["player_name"])).strip("_") or f"player_{player_id}"
    return StreamingResponse(
        buf,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{safe}_player_card.pdf"'},
    )
