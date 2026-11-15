"""Serve region averages (province / region / island group / country).

Built offline by tools/build_areas.py into data/areas/<id>.json: each
variable's monthly series averaged over the area's NASA squares, weighted by
land area. Values are already in display units.
"""
from __future__ import annotations

import json
import re
from functools import lru_cache

from .power import DATA_DIR, MonthlyPoint, MonthlySeries

AREA_ID = re.compile(r"^[a-z]-[a-z0-9-]{1,80}$")


class UnknownArea(KeyError):
    """No such area id."""


class NoAreaData(ValueError):
    """The area exists but this variable isn't averaged for it."""


@lru_cache(maxsize=32)
def load_area(area_id: str) -> dict:
    if not AREA_ID.match(area_id):
        raise UnknownArea(area_id)
    path = DATA_DIR / "areas" / f"{area_id}.json"
    if not path.exists():
        raise UnknownArea(area_id)
    return json.loads(path.read_text())


def load_area_series(code: str, area_id: str, start: int, end: int) -> tuple[MonthlySeries, dict]:
    area = load_area(area_id)
    v = area["vars"].get(code)
    if v is None:
        raise NoAreaData(code)
    y0, m0 = (int(x) for x in v["start"].split("-"))
    lo, hi = f"{start:04d}-01", f"{end:04d}-12"
    points = []
    for i, x in enumerate(v["values"]):
        t = f"{y0 + (m0 - 1 + i) // 12:04d}-{(m0 - 1 + i) % 12 + 1:02d}"
        if lo <= t <= hi:
            points.append(MonthlyPoint(t=t, value=float(x)))
    meta = {"id": area["id"], "name": area["name"], "kind": area["kind"], "squares": area["n_squares"]}
    return MonthlySeries(variable=code, lat=0.0, lon=0.0, points=points), meta
