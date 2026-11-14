"""NASA POWER monthly point client.

Fetches a monthly time series for a single point and variable from the NASA
POWER API (https://power.larc.nasa.gov), cleans the response, and caches it to
``data/``. POWER is built on MERRA-2 and CERES; values are model-based.

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
    """Return a cleaned monthly series, caching the raw payload to ``data/``.

    On a live-call failure, falls back to the cached payload when present.
    """
    cache = _cache_path(variable, lat, lon)
    try:
        payload = fetch_power(variable, lat, lon, start, end, client=client)
        # Write-back is best-effort: on a read-only filesystem (e.g. a
        # serverless runtime) the live fetch still succeeds; we just skip the
        # cache. The committed demo JSON under data/ remains readable.
        try:
            DATA_DIR.mkdir(parents=True, exist_ok=True)
            cache.write_text(json.dumps(payload))
        except OSError:
            pass
    except httpx.HTTPError:
        if use_cache and cache.exists():
            payload = json.loads(cache.read_text())
        else:
            raise

    series = clean_power_response(payload, variable, lat, lon)
    # Honor the requested window even when the cache holds a wider range.
    lo, hi = f"{start:04d}-01", f"{end:04d}-12"
    series.points = [p for p in series.points if lo <= p.t <= hi]
    return series
