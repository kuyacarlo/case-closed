"""Static-case loader (HANDOFF item 10).

Serves a bundled monthly series (e.g. Sentinel-5P NO2 exported offline from
Google Earth Engine) through the same cleaning path and contract as the live
POWER cases. The app never talks to Earth Engine; it only reads the JSON a
teammate exported into ``data/``.
"""
from __future__ import annotations

import json

from .grid import snap
from .power import DATA_DIR, MonthlyPoint, MonthlySeries, clean_power_response


class OutsideStaticArea(ValueError):
    """The requested point is not where the static file was exported."""


def load_static_series(
    variable_code: str,
    static_file: str,
    lat: float,
    lon: float,
    start: int,
    end: int,
    scale: float = 1.0,
) -> MonthlySeries:
    """Load a bundled JSON case and return a cleaned, windowed, scaled series.

    The file uses the same ``properties.parameter.<code>`` shape as POWER, so
    the POWER cleaner handles the annual-average and fill-value rules too.
    """
    path = DATA_DIR / static_file
    payload = json.loads(path.read_text())

    # A static file holds one exported location. Only answer for points in the
    # same POWER grid cell, so other places never receive this place's data.
    header = payload.get("header", {})
    if "lat" in header and "lon" in header:
        if snap(lat, lon) != snap(float(header["lat"]), float(header["lon"])):
            raise OutsideStaticArea(variable_code)
    series = clean_power_response(payload, variable_code, lat, lon)

    if scale != 1.0:
        series.points = [MonthlyPoint(t=p.t, value=p.value * scale) for p in series.points]

    lo, hi = f"{start:04d}-01", f"{end:04d}-12"
    series.points = [p for p in series.points if lo <= p.t <= hi]
    return series
