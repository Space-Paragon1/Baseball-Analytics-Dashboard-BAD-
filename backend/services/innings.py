"""Convert between baseball innings notation and outs.

In box scores "6.1" means 6 and 1/3 innings (19 outs), not 6.1 innings.
The database stores outs so innings add up correctly.
"""

from typing import Union

Number = Union[int, float, str]


def innings_to_outs(value: Number) -> int:
    """Parse innings pitched into outs.

    Accepts baseball notation (6.0, 6.1, 6.2) and thirds written as decimals
    (6.33, 6.333, 6.67). Raises ValueError for anything else, such as 6.5.
    """
    if value is None or (isinstance(value, str) and not value.strip()):
        return 0
    try:
        ip = float(value)
    except (TypeError, ValueError):
        raise ValueError(f"'{value}' is not a valid innings value") from None
    if ip < 0 or ip != ip:  # negative or NaN
        raise ValueError(f"'{value}' is not a valid innings value")

    whole = int(ip)
    frac = round(ip - whole, 3)
    if frac in (0.0,):
        thirds = 0
    elif abs(frac - 0.1) < 1e-6 or abs(frac - 1 / 3) < 0.005:
        thirds = 1
    elif abs(frac - 0.2) < 1e-6 or abs(frac - 2 / 3) < 0.01:
        thirds = 2
    else:
        raise ValueError(
            f"'{value}' is not valid innings notation. Use .1 for 1/3 and .2 for 2/3 of an inning (e.g. 6.2)."
        )
    return whole * 3 + thirds


def outs_to_innings(outs: int) -> float:
    """Format outs as baseball notation, e.g. 20 outs -> 6.2."""
    outs = int(outs or 0)
    return float(f"{outs // 3}.{outs % 3}")


def outs_to_decimal(outs: int) -> float:
    """True innings as a decimal (20 outs -> 6.667), for rate stats."""
    return (outs or 0) / 3
