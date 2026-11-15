"""Trend-detective statistics: the seven-step method as pure functions.

Given a monthly series, compute anomalies, Sen's slope, naive and
autocorrelation-corrected Mann-Kendall p-values, a least-squares slope with a
confidence interval that uses the effective sample size, and the number of
additional years of data a non-significant trend would need (Weatherhead et
al. 1998).

All functions are pure: they take arrays or lists and return numbers, with no
network or file access.
"""
from __future__ import annotations

import math
from dataclasses import asdict, dataclass

import numpy as np
import pymannkendall as mk

MIN_MONTHS = 120
MONTHS_PER_YEAR = 12
MONTHS_PER_DECADE = 120


@dataclass
class TrendResult:
    sen_slope_per_decade: float
    ols_slope_per_decade: float
    ci95: float
    p_naive: float
    p_honest: float
    lag1: float
    n_eff: int
    years_needed: int | None
    # Pettitt change point on annual means: {"year", "p", "mean_before",
    # "mean_after"}, or None when the record is too short to test.
    changepoint: dict | None = None

    def as_dict(self) -> dict:
        return asdict(self)


def monthly_anomalies(values: np.ndarray, start_month: int = 1) -> np.ndarray:
    """Subtract each calendar month's mean (step 2).

    ``start_month`` is the calendar month (1-12) of the first value so that the
    climatology groups align to real calendar months.
    """
    values = np.asarray(values, dtype=float)
    n = len(values)
    month_index = (np.arange(n) + (start_month - 1)) % MONTHS_PER_YEAR
    clim = np.array([values[month_index == m].mean() for m in range(MONTHS_PER_YEAR)])
    return values - clim[month_index]


def lag1_autocorr(x: np.ndarray) -> float:
    """Lag-1 autocorrelation of a mean-centered series."""
    x = np.asarray(x, dtype=float)
    x = x - x.mean()
    denom = np.dot(x, x)
    if denom == 0:
        return 0.0
    return float(np.dot(x[:-1], x[1:]) / denom)


def sen_slope_per_decade(anomalies: np.ndarray) -> float:
    """Sen's slope on monthly anomalies, converted to per decade (step 3)."""
    result = mk.original_test(np.asarray(anomalies, dtype=float))
    # mk slope is per time step (per month here). Convert to per decade.
    return float(result.slope * MONTHS_PER_DECADE)


def naive_p(anomalies: np.ndarray) -> float:
    """Plain Mann-Kendall p-value (step 4)."""
    return float(mk.original_test(np.asarray(anomalies, dtype=float)).p)


def honest_p(anomalies: np.ndarray) -> float:
    """Hamed-Rao modified Mann-Kendall p-value (step 5)."""
    return float(mk.hamed_rao_modification_test(np.asarray(anomalies, dtype=float)).p)


def ols_slope_ci(anomalies: np.ndarray) -> tuple[float, float, int, float]:
    """Least-squares slope with a 95% CI using the effective sample size (step 6).

    Returns (slope_per_decade, ci95_per_decade, n_eff, lag1_of_residuals).
    The CI is widened by ``sqrt(n / n_eff)`` where
    ``n_eff = n * (1 - r1) / (1 + r1)`` and ``r1`` is the lag-1 autocorrelation
    of the regression residuals.
    """
    y = np.asarray(anomalies, dtype=float)
    n = len(y)
    t = np.arange(n, dtype=float)

    # Ordinary least squares slope (per month) and residuals.
    t_mean = t.mean()
    sxx = np.dot(t - t_mean, t - t_mean)
    slope = float(np.dot(t - t_mean, y - y.mean()) / sxx)
    intercept = y.mean() - slope * t_mean
    resid = y - (intercept + slope * t)

    r1 = lag1_autocorr(resid)
    r1_clamped = min(max(r1, 0.0), 0.99)
    n_eff = n * (1 - r1_clamped) / (1 + r1_clamped)
    n_eff = max(n_eff, 3.0)

    # Residual variance and the standard error of the slope, inflated for
    # autocorrelation by the ratio of real to effective sample size.
    dof = max(n - 2, 1)
    resid_var = float(np.dot(resid, resid) / dof)
    se_slope = math.sqrt(resid_var / sxx)
    se_slope *= math.sqrt(n / n_eff)
    ci95 = 1.96 * se_slope

    return (
        slope * MONTHS_PER_DECADE,
        ci95 * MONTHS_PER_DECADE,
        int(round(n_eff)),
        r1,
    )


def years_needed(anomalies: np.ndarray, slope_per_decade: float) -> int | None:
    """Years of data needed to detect the trend (Weatherhead et al. 1998, step 7).

    ``n = ((3.3 * sigma / |w|) * sqrt((1 + phi) / (1 - phi))) ** (2/3)`` where
    ``sigma`` is the standard deviation of the monthly noise, ``w`` the trend
    per year, and ``phi`` the lag-1 autocorrelation of that noise. Returns None
    when the slope is effectively zero.
    """
    y = np.asarray(anomalies, dtype=float)
    n = len(y)
    t = np.arange(n, dtype=float)

    # Detrend to isolate the noise, then measure its sigma and phi.
    t_mean = t.mean()
    sxx = np.dot(t - t_mean, t - t_mean)
    slope = np.dot(t - t_mean, y - y.mean()) / sxx
    intercept = y.mean() - slope * t_mean
    noise = y - (intercept + slope * t)

    sigma = float(noise.std(ddof=1))
    phi = min(max(lag1_autocorr(noise), 0.0), 0.99)

    w = slope_per_decade / 10.0  # per year
    if abs(w) < 1e-9 or sigma == 0:
        return None

    n_years = ((3.3 * sigma / abs(w)) * math.sqrt((1 + phi) / (1 - phi))) ** (2.0 / 3.0)
    return int(round(n_years))


PETTITT_MIN_YEARS = 10
STEP_MIN_AFTER_YEARS = 8
STEP_LEVEL_RATIO = 0.25


def pettitt(x: np.ndarray) -> tuple[int, float]:
    """Pettitt (1979) test for a single shift in the mean.

    Returns ``(k, p)`` where ``k`` is the index of the first value *after* the
    most likely change and ``p`` the approximate two-sided p-value
    ``2 * exp(-6 K^2 / (n^3 + n^2))``.
    """
    x = np.asarray(x, dtype=float)
    n = len(x)
    sgn = np.sign(x[:, None] - x[None, :])  # sgn[i, j] = sign(x_i - x_j)
    # U_t = sum_{i<=t} sum_{j>t} sign(x_i - x_j), for t = 0..n-2
    u = np.array([sgn[: t + 1, t + 1 :].sum() for t in range(n - 1)])
    t_best = int(np.argmax(np.abs(u)))
    k_stat = float(abs(u[t_best]))
    p = min(1.0, 2.0 * math.exp(-6.0 * k_stat**2 / (n**3 + n**2)))
    return t_best + 1, p


def annual_changepoint(values: np.ndarray, start_year: int, start_month: int = 1) -> dict | None:
    """Pettitt test on calendar-year means of complete years.

    Monthly values are too autocorrelated for Pettitt's independence
    assumption; annual means are much closer to independent.
    """
    values = np.asarray(values, dtype=float)
    skip = (13 - start_month) % 12  # months until the first January
    full = values[skip:]
    n_years = len(full) // 12
    if n_years < PETTITT_MIN_YEARS:
        return None
    annual = full[: n_years * 12].reshape(n_years, 12).mean(axis=1)
    first_year = start_year + (1 if skip else 0)
    k, p = pettitt(annual)

    # Pettitt also fires on a smooth trend, so "significant" alone doesn't mean
    # "a jump". Call it step-dominated only when the series is roughly level
    # after the change: post-change slope under a quarter of the overall slope.
    t = np.arange(n_years, dtype=float)
    slope_all = float(np.polyfit(t, annual, 1)[0]) * 10
    slope_after = (
        float(np.polyfit(t[k:], annual[k:], 1)[0]) * 10
        if n_years - k >= STEP_MIN_AFTER_YEARS
        else None
    )
    step_dominated = bool(
        p < 0.05
        and slope_after is not None
        and abs(slope_all) > 0
        and abs(slope_after) < STEP_LEVEL_RATIO * abs(slope_all)
    )
    return {
        "year": first_year + k,
        "p": p,
        "mean_before": round(float(annual[:k].mean()), 4),
        "mean_after": round(float(annual[k:].mean()), 4),
        "slope_after_per_decade": None if slope_after is None else round(slope_after, 4),
        "step_dominated": step_dominated,
    }


def analyze(
    values: np.ndarray, start_month: int = 1, start_year: int | None = None
) -> tuple[TrendResult, list[str]]:
    """Run the full seven-step method on a monthly series.

    Returns the trend result and a list of warnings (e.g. short record).
    """
    values = np.asarray(values, dtype=float)
    warnings: list[str] = []
    if len(values) < MIN_MONTHS:
        warnings.append(
            f"Only {len(values)} months of data; results below {MIN_MONTHS} "
            "months are less reliable."
        )

    anomalies = monthly_anomalies(values, start_month=start_month)
    sen = sen_slope_per_decade(anomalies)
    # A (near-)constant series makes Mann-Kendall's variance zero and its
    # p-value NaN; that means "no evidence of a trend", so report p = 1.
    p_n = naive_p(anomalies)
    p_h = honest_p(anomalies)
    p_n = 1.0 if not math.isfinite(p_n) else p_n
    p_h = 1.0 if not math.isfinite(p_h) else p_h
    ols, ci95, n_eff, lag1 = ols_slope_ci(anomalies)
    needed = years_needed(anomalies, sen)

    result = TrendResult(
        sen_slope_per_decade=round(sen, 4),
        ols_slope_per_decade=round(ols, 4),
        ci95=round(ci95, 4),
        p_naive=p_n,
        p_honest=p_h,
        lag1=round(lag1, 4),
        n_eff=n_eff,
        years_needed=needed,
        changepoint=(
            annual_changepoint(values, start_year, start_month)
            if start_year is not None
            else None
        ),
    )
    return result, warnings
