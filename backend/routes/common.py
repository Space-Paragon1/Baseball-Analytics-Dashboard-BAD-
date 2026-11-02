from dataclasses import dataclass
from datetime import date
from typing import Optional

from fastapi import HTTPException, Query


@dataclass
class DateRange:
    start_date: Optional[date]
    end_date: Optional[date]


def date_range(
    start_date: Optional[date] = Query(default=None, description="YYYY-MM-DD, inclusive"),
    end_date: Optional[date] = Query(default=None, description="YYYY-MM-DD, inclusive"),
) -> DateRange:
    if start_date and end_date and start_date > end_date:
        raise HTTPException(status_code=422, detail="start_date must be on or before end_date.")
    return DateRange(start_date, end_date)
