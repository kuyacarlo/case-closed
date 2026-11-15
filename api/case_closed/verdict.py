"""Build the verdict state and plain-language text from a TrendResult.

Verdict states:
    too_short  record under MIN_MONTHS_FOR_VERDICT, whatever the p-value
    step       significant, but most of the change is one jump (Pettitt)
    confirmed  honest (Hamed-Rao) p < 0.05
    not_yet    honest p >= 0.05

The headline is written for the general public and carries no p-value; the
p-values live in ``trend`` and are explained on the "How sure are we?" panel.
"""
from __future__ import annotations

from .stats import TrendResult
from .variables import Variable

SIG_THRESHOLD = 0.05
# Under 20 years, natural swings (ENSO, a few hot years at the end) can make
# a short window look like a strong trend. Below this we refuse to call it.
MIN_MONTHS_FOR_VERDICT = 240
# "Years needed" beyond this is not a useful number to show the public.
MAX_YEARS_NEEDED_SHOWN = 150


def format_p(p: float) -> str:
    """Scientific notation below 0.001, otherwise three decimals."""
    if p < 0.001:
        return f"{p:.0e}".replace("e-0", "e-").replace("e+0", "e+")
    return f"{p:.3f}"


def direction_word(slope: float, variable: Variable | None = None) -> str:
    if variable is None:
        return "Rising" if slope >= 0 else "Falling"
    return variable.up_word if slope >= 0 else variable.down_word


def build_verdict(
    trend: TrendResult, variable: Variable, start_year: int, n_months: int | None = None
) -> dict:
    """Return {"state", "text", "detail"} for the verdict block."""
    units = variable.units
    slope = trend.sen_slope_per_decade
    rate = abs(slope)
    word = direction_word(slope, variable)
    years = None if n_months is None else n_months // 12

    if n_months is not None and n_months < MIN_MONTHS_FOR_VERDICT:
        return {
            "state": "too_short",
            "text": "Too short to call",
            "detail": (
                f"{years} years isn't enough to tell a real trend from natural ups "
                "and downs. Use at least 20 years."
            ),
        }

    if trend.p_honest < SIG_THRESHOLD:
        cp = trend.changepoint or {}
        if cp.get("step_dominated"):
            return {
                "state": "step",
                "text": f"{word} since about {cp['year']}",
                "detail": (
                    f"Most of the change came as a jump around {cp['year']} "
                    f"(average {cp['mean_before']:.2f} before, {cp['mean_after']:.2f} "
                    f"{units} after), and it has stayed roughly level since. A jump can "
                    "be a real shift or a change in how the data was made."
                ),
            }
        return {
            "state": "confirmed",
            "text": f"{word}: {rate:.2f} {units} per decade since {start_year}",
            "detail": (
                f"A clear trend: the honest test says a line this steep would be very "
                f"unlikely by chance (p = {format_p(trend.p_honest)})."
            ),
        }

    if trend.years_needed is not None and trend.years_needed <= MAX_YEARS_NEEDED_SHOWN:
        detail = (
            f"Any change is small next to the year-to-year swings. A trend this size "
            f"would need about {trend.years_needed} years of record to show up clearly."
        )
    else:
        detail = "Any change is too small to tell apart from year-to-year swings."
    return {"state": "not_yet", "text": f"No clear change since {start_year}", "detail": detail}
