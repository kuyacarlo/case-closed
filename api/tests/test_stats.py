"""Stats module tests.

Regression test against a Metro-Manila-like 540-month series. Per the HANDOFF,
assert order of magnitude for p-values and two decimals for slopes, plus the
qualitative properties the method must have (naive overconfident vs honest,
positive trend confirmed).
"""
import math

import numpy as np
import pytest

from case_closed.stats import (
    analyze,
    lag1_autocorr,
    monthly_anomalies,
    years_needed,
)
from tests.fixtures.manila import manila_like_series


@pytest.fixture(scope="module")
def result():
    res, warnings = analyze(manila_like_series(), start_month=1)
    return res, warnings


def test_sen_slope_two_decimals(result):
    res, _ = result
    # Expected 0.15 degC/decade, assert to two decimals.
    assert round(res.sen_slope_per_decade, 2) == 0.15


def test_ols_slope_order(result):
    res, _ = result
    # Expected ~0.12; same tenths-scale positive slope.
    assert 0.08 <= res.ols_slope_per_decade <= 0.18
    assert res.ci95 > 0


def test_naive_p_is_very_small(result):
    res, _ = result
    # Naive MK should be strongly significant (<< 0.001).
    assert res.p_naive < 1e-3


def test_honest_p_order_of_magnitude(result):
    res, _ = result
    # Expected ~0.001; within an order of magnitude and still significant.
    assert 1e-4 <= res.p_honest <= 1e-2
    assert res.p_honest < 0.05


def test_naive_more_confident_than_honest(result):
    res, _ = result
    # The whole point: the autocorrelation correction raises the p-value.
    assert res.p_honest > res.p_naive


def test_lag1_near_half(result):
    res, _ = result
    assert 0.45 <= res.lag1 <= 0.60


def test_n_eff_reduced(result):
    res, _ = result
    # Effective sample size must be well below the 540 real months.
    assert 100 <= res.n_eff <= 300


def test_years_needed_positive_magnitude(result):
    res, _ = result
    assert res.years_needed is not None
    assert 20 <= res.years_needed <= 90


def test_no_warning_for_full_record(result):
    _, warnings = result
    assert warnings == []


def test_short_record_warns():
    _, warnings = analyze(manila_like_series()[:60], start_month=1)
    assert any("months" in w for w in warnings)


def test_anomalies_remove_seasonality():
    values = manila_like_series()
    anom = monthly_anomalies(values, start_month=1)
    # Each calendar month's anomaly mean should be ~0.
    for m in range(12):
        assert abs(anom[m::12].mean()) < 1e-9


def test_lag1_of_white_noise_near_zero():
    rng = np.random.default_rng(0)
    white = rng.normal(0, 1, 2000)
    assert abs(lag1_autocorr(white)) < 0.1


def test_years_needed_none_for_flat_series():
    flat = np.zeros(200)
    assert years_needed(flat, 0.0) is None


def test_falling_trend_negative_slope():
    values = manila_like_series()
    res, _ = analyze(values[::-1], start_month=1)
    assert res.sen_slope_per_decade < 0


def test_pettitt_finds_a_step():
    import numpy as np
    from case_closed.stats import annual_changepoint, pettitt
    rng = np.random.default_rng(0)
    x = np.r_[rng.normal(0, 1, 20), rng.normal(2, 1, 20)]
    k, p = pettitt(x)
    assert k == 20 and p < 0.001

    # Monthly series: flat at 5 for 18 years, then flat at 8.5 for 26 years.
    months = np.r_[np.full(18 * 12, 5.0), np.full(26 * 12, 8.5)] + rng.normal(0, 0.3, 44 * 12)
    cp = annual_changepoint(months, 1981, 1)
    assert cp["year"] == 1999
    assert cp["step_dominated"] is True


def test_steady_trend_is_not_step_dominated():
    import numpy as np
    from case_closed.stats import annual_changepoint
    rng = np.random.default_rng(1)
    months = np.linspace(0, 2, 44 * 12) + rng.normal(0, 0.2, 44 * 12)
    cp = annual_changepoint(months, 1981, 1)
    assert cp["step_dominated"] is False
