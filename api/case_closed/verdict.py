"""Build the trend-first verdict from a TrendResult.

Every verdict answers four questions, whether or not the trend is significant
(the challenge brief: "finding a trend is interesting even if it doesn't reach
the level of significance"):

    Is there a trend?      direction: rising | falling | flat
    How much?              rate_per_decade, total_change over the record
    Is it significant?     significant (honest Hamed-Rao p < 0.05, >= 20 years)
    How sure?              p_honest, plus the explanation line

``state`` is kept for the UI's colour-coding:
    too_short  record under MIN_MONTHS_FOR_VERDICT, whatever the p-value
    step       significant, but most of the change is one jump (Pettitt)
    confirmed  significant trend
    not_yet    not significant
"""
from __future__ import annotations

from .stats import TrendResult
from .variables import Variable

SIG_THRESHOLD = 0.05
# Under 20 years, natural swings (ENSO, a few hot years at the end) can make
# a short window look like a strong trend. Below this we refuse to call it.
MIN_MONTHS_FOR_VERDICT = 240
# "Years needed" beyond this is not a useful number to show.
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


def _signed(x: float, digits: int) -> str:
    s = f"{abs(x):.{digits}f}"
    return f"+{s}" if x >= 0 else f"−{s}"


def build_verdict(
    trend: TrendResult, variable: Variable, start_year: int, n_months: int | None = None
) -> dict:
    """Return the verdict block: state, the four answers, headline and detail."""
    units = variable.units
    d = variable.digits
    slope = trend.sen_slope_per_decade
    years = (n_months or 0) / 12
    total = slope * years / 10
    # "Flat" only when the whole-record change rounds to zero at display precision.
    flat = round(abs(total), d) == 0 and round(abs(slope), d) == 0
    direction = "flat" if flat else ("rising" if slope > 0 else "falling")
    noun = {"rising": "rise", "falling": "fall", "flat": "change"}[direction]
    rate_txt = f"{_signed(slope, d)} {units} per decade"
    total_txt = f"about {_signed(total, d)} {units} since {start_year}"
    too_short = n_months is not None and n_months < MIN_MONTHS_FOR_VERDICT
    significant = (not too_short) and trend.p_honest < SIG_THRESHOLD
    cp = trend.changepoint or {}

    base = {
        "direction": direction,
        "rate_per_decade": round(slope, 4),
        "total_change": round(total, 4),
        "years": round(years, 1),
        "significant": significant,
        "p": trend.p_honest,
    }

    if too_short:
        state = "too_short"
        headline = (
            f"{direction.capitalize()} {rate_txt} over {int(years)} years, too short to judge"
            if not flat
            else f"Flat over {int(years)} years, too short to judge"
        )
        detail = (
            f"{int(years)} years isn't enough to tell a real trend from natural ups and "
            "downs. Use at least 20 years."
        )
    elif significant and cp.get("step_dominated"):
        state = "step"
        headline = f"{direction_word(slope, variable)} since about {cp['year']}, mostly one jump"
        detail = (
            f"Significant (p = {format_p(trend.p_honest)}), but most of the change came as a "
            f"jump around {cp['year']} (average {cp['mean_before']:.{d}f} before, "
            f"{cp['mean_after']:.{d}f} {units} after) and it has stayed roughly level since. "
            "A jump can be a real shift or a change in how the data was made."
        )
    elif significant:
        state = "confirmed"
        headline = f"{direction_word(slope, variable)}: {rate_txt}"
        detail = (
            f"Yes, a significant trend: {total_txt}. A trend this strong would turn up by "
            f"chance less than 5 times in 100 (p = {format_p(trend.p_honest)}), even after "
            "allowing for similar neighbouring months."
        )
    else:
        state = "not_yet"
        headline = (
            f"Essentially flat since {start_year}"
            if flat
            else f"A slight {noun} of {rate_txt}, not significant yet"
        )
        if trend.years_needed is not None and trend.years_needed <= MAX_YEARS_NEEDED_SHOWN:
            longer = (
                f" A trend this size would need about {trend.years_needed} years of "
                "record to show up clearly."
            )
        else:
            longer = ""
        detail = (
            f"The record shows {total_txt}, but natural ups and downs could produce a line "
            f"like this by chance (p = {format_p(trend.p_honest)}).{longer}"
        )

    return {**base, "state": state, "text": headline, "headline": headline, "detail": detail}
