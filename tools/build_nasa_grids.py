"""Turn cached Giovanni downloads into one monthly grid file per variable.

Run after tools/fetch_giovanni.py:

    cd api && uv run python ../tools/build_nasa_grids.py

Reads tools/.cache/giovanni/<KEY>/<lat>_<lon>_<y0>_<y1>.csv and writes
data/nasa/<CODE>.json:

    {"code", "dataset", "units_raw", "start": "YYYY-MM",
     "cells": {"lat,lon": [monthly raw value or null, ...]}}

Values stay in Giovanni's raw units; api/case_closed/variables.py holds the
scale/offset that converts them for display, so the API and the overview use
one conversion. Daily products (OMI) are averaged to months, needing at least
MIN_DAYS valid days; otherwise the month is null.
"""
from __future__ import annotations

import collections
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "tools"))
from fetch_giovanni import DATASETS, cache_path  # noqa: E402

OUT = ROOT / "data" / "nasa"
MIN_DAYS = 5
# Giovanni key -> app variable code (api/case_closed/variables.py).
CODES = {
    "IMERG": "IMERG",
    "GLDAS_EVAP": "GLDAS_EVAP",
    "GLDAS_ROOTMOIST": "GLDAS_ROOTMOIST",
    "GLDAS_RUNOFF": "GLDAS_RUNOFF",
    "OMI_NO2": "OMI_NO2",
    "AIRS_TSURF": "AIRS_TSURF",
}


def parse(text: str) -> tuple[dict, list[tuple[str, float | None]]]:
    head, _, body = text.partition("\n\n")
    meta = dict(line.split(",", 1) for line in head.splitlines() if "," in line)
    undef = float(meta.get("undef", "-9999.9"))
    rows = []
    for line in body.splitlines()[1:]:
        if not line.strip():
            continue
        t, _, v = line.partition(",")
        try:
            x = float(v)
        except ValueError:
            x = None
        if x is None or x == undef or abs(x) > 1e29:
            x = None
        rows.append((t[:10], x))
    return meta, rows


def monthly(rows: list[tuple[str, float | None]], y0: int, y1: int) -> list[float | None]:
    groups: dict[str, list[float]] = collections.defaultdict(list)
    counts: dict[str, int] = collections.Counter()
    for date, x in rows:
        ym = date[:7]
        counts[ym] += 1
        if x is not None:
            groups[ym].append(x)
    daily = max(counts.values(), default=1) > 1
    out = []
    for y in range(y0, y1 + 1):
        for m in range(1, 13):
            ym = f"{y:04d}-{m:02d}"
            vals = groups.get(ym, [])
            if not vals or (daily and len(vals) < MIN_DAYS):
                out.append(None)
            else:
                out.append(float(f"{sum(vals) / len(vals):.6g}"))
    return out


def main() -> None:
    cells = json.loads((ROOT / "tools" / "ph_cells.json").read_text())["cells"]
    OUT.mkdir(parents=True, exist_ok=True)
    for key, code in CODES.items():
        data_id, y0, y1 = DATASETS[key]
        grid, meta0, missing = {}, None, 0
        for c in cells:
            path = cache_path(key, c["lat"], c["lon"])
            if not path.exists():
                missing += 1
                continue
            meta, rows = parse(path.read_text())
            meta0 = meta0 or meta
            series = monthly(rows, y0, y1)
            # Trim trailing months the product hasn't published yet.
            grid[f"{c['lat']:.4f},{c['lon']:.4f}"] = series
        if not grid:
            print(f"{code}: no downloads yet, skipped")
            continue
        n = len(next(iter(grid.values())))
        last = max((i for s in grid.values() for i, v in enumerate(s) if v is not None), default=n - 1)
        for k in grid:
            grid[k] = grid[k][: last + 1]
        filled = sum(v is not None for s in grid.values() for v in s)
        total = sum(len(s) for s in grid.values())
        payload = {
            "code": code,
            "dataset": data_id,
            "product": (meta0 or {}).get("prod_name"),
            "units_raw": (meta0 or {}).get("unit"),
            "start": f"{y0}-01",
            "cells": grid,
        }
        (OUT / f"{code}.json").write_text(json.dumps(payload, separators=(",", ":")))
        end_y, end_m = y0 + last // 12, last % 12 + 1
        print(
            f"{code:16s} {len(grid)} squares (missing {missing}), {y0}-01..{end_y}-{end_m:02d}, "
            f"{filled / total:.0%} months with data, units {payload['units_raw']}"
        )


if __name__ == "__main__":
    main()
