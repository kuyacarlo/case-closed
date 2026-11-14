"""A deterministic synthetic monthly series calibrated to the HANDOFF's Metro
Manila regression fixture (540 months, 1981-2025, ~0.15 degC/decade, lag-1
autocorrelation around 0.5).

This is a test fixture, not real POWER data. It lets the stats tests assert the
method's behaviour without a live network call. Per the HANDOFF: assert order
of magnitude for p-values and two decimals for slopes.
"""
from __future__ import annotations

import numpy as np

N_MONTHS = 540
TRUE_SLOPE_PER_DECADE = 0.15


def manila_like_series(seed: int = 22) -> np.ndarray:
    """Return a 540-month temperature-like series with a known trend.

    Components: a seasonal cycle (so the anomaly step has work to do), a linear
    warming trend of 0.15 degC/decade, and AR(1) noise. The seed and noise
    parameters are tuned so the method lands close to the HANDOFF fixture:
    Sen's slope ~0.15 degC/decade, lag-1 autocorrelation ~0.5, honest p ~1e-3.
    """
    rng = np.random.default_rng(seed)
    t = np.arange(N_MONTHS, dtype=float)

    # Seasonal cycle, ~2 degC peak-to-trough, Manila has a mild season.
    month = t % 12
    season = 1.0 * np.sin(2 * np.pi * month / 12) + 0.5 * np.cos(2 * np.pi * month / 12)

    # Linear trend: 0.15 degC per decade = per 120 months.
    trend = TRUE_SLOPE_PER_DECADE * (t / 120.0)

    # AR(1) noise; phi and sigma tuned for lag-1 ~ 0.5 on the anomalies.
    phi = 0.42
    sigma_innov = 1.0
    noise = np.zeros(N_MONTHS)
    for i in range(1, N_MONTHS):
        noise[i] = phi * noise[i - 1] + rng.normal(0, sigma_innov)

    baseline = 27.0
    return baseline + season + trend + noise
