"""Serve gridded NASA variables precomputed from Giovanni (data/nasa/).

The deployed API never calls Giovanni (that needs an Earthdata token); the
team downloads once with tools/fetch_giovanni.py and tools/build_nasa_grids.py.
"""
from __future__ import annotations

import json
from functools import lru_cache

import numpy as np

from .grid import snap
from .power import DATA_DIR, MonthlyPoint, MonthlySeries


class OutsideGrid(ValueError):
    """No precomputed data for this square (outside the Philippines)."""


@lru_cache(maxsize=16)
def _load(grid_file: str) -> dict:
    return json.loads((DATA_DIR / "nasa" / grid_file).read_text())


def load_grid_series(
    code: str, grid_file: str, lat: float, lon: float, start: int, end: int,
    scale: float = 1.0, offset: float = 0.0,
) -> tuple[MonthlySeries, list[str]]:
    """Monthly series for the square containing (lat, lon), converted to
    display units. Gaps (e.g. cloudy months for OMI) are filled with that
    calendar month's average so the seasonal method still lines up; the
    returned warnings say how many."""
    payload = _load(grid_file)
    c = snap(lat, lon)
    raw = payload["cells"].get(f"{c.lat:.4f},{c.lon:.4f}")
    if raw is None:
        raise OutsideGrid(code)
    y0, m0 = (int(x) for x in payload["start"].split("-"))
    vals = np.array([np.nan if v is None else v * scale + offset for v in raw], dtype=float)
    labels = [f"{y0 + (m0 - 1 + i) // 12:04d}-{(m0 - 1 + i) % 12 + 1:02d}" for i in range(len(vals))]

    lo, hi = f"{start:04d}-01", f"{end:04d}-12"
    keep = [i for i, t in enumerate(labels) if lo <= t <= hi]
    vals, labels = vals[keep], [labels[i] for i in keep]
    # Drop leading/trailing empty months, then fill interior gaps.
    ok = np.where(~np.isnan(vals))[0]
    warnings: list[str] = []
    if len(ok) == 0:
        return MonthlySeries(variable=code, lat=c.lat, lon=c.lon, points=[]), warnings
    vals, labels = vals[ok[0] : ok[-1] + 1], labels[ok[0] : ok[-1] + 1]
    gaps = np.isnan(vals)
    if gaps.any():
        months = np.array([int(t[5:7]) for t in labels])
        for m in range(1, 13):
            sel = months == m
            mean = np.nanmean(vals[sel]) if np.any(sel & ~gaps) else np.nanmean(vals)
            vals[sel & gaps] = mean
        warnings.append(
            f"{int(gaps.sum())} of {len(vals)} months had no data and were filled with "
            "that month's usual value."
        )
    points = [MonthlyPoint(t=t, value=float(v)) for t, v in zip(labels, vals)]
    return MonthlySeries(variable=code, lat=c.lat, lon=c.lon, points=points), warnings
