"""NASA POWER (MERRA-2) grid helpers.

POWER's meteorology comes from MERRA-2, whose cells are 0.5 deg latitude by
0.625 deg longitude. Cell centres sit at latitudes that are multiples of 0.5
and longitudes of -180 + 0.625 * k. Every point inside a cell returns the same
series (verified against the live API, 2026-11-15: 14.30,120.95 / 14.50,121.25
/ 14.70,121.55 all return the cell centred on 14.5, 121.25).

Snapping requests to the cell centre makes the cache key honest (one entry per
cell, not per click) and lets the UI draw the exact area a case covers.
``web/src/grid.ts`` mirrors this file; keep them in step.
"""
from __future__ import annotations

import math
from dataclasses import dataclass

DLAT = 0.5
DLON = 0.625


@dataclass(frozen=True)
class Cell:
    lat: float
    lon: float

    def as_dict(self) -> dict:
        return {"lat": self.lat, "lon": self.lon, "dlat": DLAT, "dlon": DLON}


def _round_half_up(x: float) -> int:
    return int(math.floor(x + 0.5))


def snap(lat: float, lon: float) -> Cell:
    """Return the centre of the POWER cell containing (lat, lon)."""
    lat_c = _round_half_up(lat / DLAT) * DLAT
    lat_c = max(-90.0, min(90.0, lat_c))
    k = _round_half_up((lon + 180.0) / DLON)
    lon_c = -180.0 + k * DLON
    if lon_c >= 180.0:
        lon_c -= 360.0
    return Cell(lat=round(lat_c, 4), lon=round(lon_c, 4))
