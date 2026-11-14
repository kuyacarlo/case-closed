"""Build the verdict state and human text from a TrendResult.

Verdict states (HANDOFF):
    confirmed  honest p < 0.05
    not_yet    honest p >= 0.05

Direction is "Rising" or "Falling" from the sign of Sen's slope. P-values are
formatted scientific below 0.001, otherwise three decimals.
"""
from __future__ import annotations

from .stats import TrendResult
from .variables import Variable

SIG_THRESHOLD = 0.05


def format_p(p: float) -> str:
    """Scientific notation below 0.001, otherwise three decimals."""
    if p < 0.001:
        return f"{p:.0e}".replace("e-0", "e-").replace("e+0", "e+")
    return f"{p:.3f}"


def direction_word(slope: float) -> str:
    return "Rising" if slope >= 0 else "Falling"


def build_verdict(trend: TrendResult, variable: Variable, start_year: int) -> dict:
    """Return {"state", "text"} for the verdict block."""
    units = variable.units
    rate = abs(trend.sen_slope_per_decade)
    word = direction_word(trend.sen_slope_per_decade)

    if trend.p_honest < SIG_THRESHOLD:
        text = (
            f"{word} {rate:.2f} {units} per decade since {start_year}, "
            f"significant (p = {format_p(trend.p_honest)})"
        )
        return {"state": "confirmed", "text": text}

    if trend.years_needed is None:
        tail = "more data needed"
    else:
        tail = f"about {trend.years_needed} more years needed"
    text = f"No significant trend yet, {tail}"
    return {"state": "not_yet", "text": text}
