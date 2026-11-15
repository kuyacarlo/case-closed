"""NASA POWER monthly point client.

Fetches a monthly time series for a single point and variable from the NASA
POWER API (https://power.larc.nasa.gov), cleans the response, and caches it to
``data/``. Temperature and rainfall come from the MERRA-2 reanalysis (model-based).

Response shape handled here (verified against the monthly point endpoint):

    {
      "properties": {
        "parameter": {
          "T2M": {"198101": 26.1, ..., "198113": 26.4, "198201": ...}
        }
      }
    }

Keys are ``YYYYMM`` for the twelve months plus one ``YYYY13`` annual-average
entry per year. Missing values use the ``-999`` fill. Both are handled.
"""
from __future__ import annotations

import json
from collections import OrderedDict
from dataclasses import dataclass, field
from pathlib import Path

import httpx

POWER_URL = "https://power.larc.nasa.gov/api/temporal/monthly/point"
FILL_VALUE = -999.0
ANNUAL_MONTH_KEY = "13"
# Repo-root data/ holds cached demo-case payloads (api/case_closed/power.py -> ../../data).
DATA_DIR = Path(__file__).resolve().parent.parent.parent / "data"


@dataclass
class MonthlyPoint:
    """One cleaned month: ISO month label ``YYYY-MM`` and its value."""

    t: str
    value: float


@dataclass
class MonthlySeries:
    """A cleaned monthly series for one point and variable."""

    variable: str
    lat: float
    lon: float
    points: list[MonthlyPoint] = field(default_factory=list)
    # True when served from the on-disk cache after a failed live call.
    from_cache: bool = False

    @property
    def n_months(self) -> int:
        return len(self.points)


def _cache_path(variable: str, lat: float, lon: float) -> Path:
    key = f"power_{variable}_{lat:.4f}_{lon:.4f}.json"
    return DATA_DIR / key


def clean_power_response(payload: dict, variable: str, lat: float, lon: float) -> MonthlySeries:
    """Turn a raw POWER JSON payload into a sorted, gap-free MonthlySeries.

    Drops the annual-average (``YYYY13``) entries and the ``-999`` fill values,
    and returns months sorted ascending by time.
    """
    try:
        raw = payload["properties"]["parameter"][variable]
    except (KeyError, TypeError) as exc:  # pragma: no cover - defensive
        raise ValueError(f"POWER payload missing parameter {variable!r}") from exc

    points: list[MonthlyPoint] = []
    for key, value in raw.items():
        # Keys look like YYYYMM. The annual average is month "13".
        month = key[4:]
        if month == ANNUAL_MONTH_KEY:
            continue
        if value is None or float(value) <= FILL_VALUE:
            continue
        year = key[:4]
        points.append(MonthlyPoint(t=f"{year}-{month}", value=float(value)))

    points.sort(key=lambda p: p.t)
    return MonthlySeries(variable=variable, lat=lat, lon=lon, points=points)


def fetch_power(
    variable: str,
    lat: float,
    lon: float,
    start: int,
    end: int,
    *,
    community: str = "AG",
    client: httpx.Client | None = None,
    timeout: float = 30.0,
) -> dict:
    """Fetch the raw POWER monthly payload for a point. Returns parsed JSON."""
    params = {
        "parameters": variable,
        "community": community,
        "latitude": lat,
        "longitude": lon,
        "start": start,
        "end": end,
        "format": "JSON",
    }
    owned = client is None
    client = client or httpx.Client(timeout=timeout)
    try:
        resp = client.get(POWER_URL, params=params)
        resp.raise_for_status()
        return resp.json()
    finally:
        if owned:
            client.close()


class CacheMiss(Exception):
    """Raised when the live fetch failed and no cached copy covers the window."""


# Small in-process memo for warm serverless instances: one entry per
# (variable, cell, window). Keyed on the snapped cell so repeat clicks on the
# same area never re-spend a POWER call.
_MEMO: "OrderedDict[tuple, MonthlySeries]" = OrderedDict()
_MEMO_MAX = 256


def _window(series: MonthlySeries, start: int, end: int) -> MonthlySeries:
    lo, hi = f"{start:04d}-01", f"{end:04d}-12"
    pts = [p for p in series.points if lo <= p.t <= hi]
    return MonthlySeries(variable=series.variable, lat=series.lat, lon=series.lon,
                         points=pts, from_cache=series.from_cache)


def _covers(series: MonthlySeries, start: int, end: int) -> bool:
    if not series.points:
        return False
    return series.points[0].t <= f"{start:04d}-01" and series.points[-1].t >= f"{end:04d}-12"


def get_series(
    variable: str,
    lat: float,
    lon: float,
    start: int,
    end: int,
    *,
    use_cache: bool = True,
    client: httpx.Client | None = None,
) -> MonthlySeries:
    """Return a cleaned monthly series for the requested window.

    Order: in-process memo, then the live POWER call (written back to
    ``data/`` when the filesystem allows), then the on-disk cache. The disk
    cache is only used when it covers the *whole* requested window, and the
    result is flagged ``from_cache`` so the API can say so. It never silently
    serves a different window.
    """
    key = (variable, round(lat, 4), round(lon, 4), start, end)
    if key in _MEMO:
        _MEMO.move_to_end(key)
        return _MEMO[key]

    cache = _cache_path(variable, lat, lon)
    try:
        payload = fetch_power(variable, lat, lon, start, end, client=client)
        try:
            DATA_DIR.mkdir(parents=True, exist_ok=True)
            cache.write_text(json.dumps(payload))
        except OSError:
            pass
        series = _window(clean_power_response(payload, variable, lat, lon), start, end)
    except httpx.HTTPError:
        if not (use_cache and cache.exists()):
            raise
        cached = clean_power_response(json.loads(cache.read_text()), variable, lat, lon)
        if not _covers(cached, start, end):
            raise CacheMiss(
                f"Live data is unavailable and the saved copy doesn't cover {start}-{end}."
            )
        cached.from_cache = True
        series = _window(cached, start, end)

    if not series.from_cache:
        _MEMO[key] = series
        if len(_MEMO) > _MEMO_MAX:
            _MEMO.popitem(last=False)
    return series
