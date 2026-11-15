"""Precompute the national overview: trend verdicts for every PH land cell.

Run offline by the team after build_places.py:

    cd api && uv run python ../tools/build_ph_overview.py

For each NASA POWER cell in tools/ph_cells.json it fetches monthly T2M and
PRECTOTCORR (one call per cell, both parameters), then runs the exact same
analysis and verdict code the API uses, so the map and a case page always
agree. Raw POWER payloads are memoised in tools/.cache/power/ keyed on
(parameters, cell, years); rerunning never re-spends a call.

Because ~180 cells are tested at once, a handful would look "significant" by
chance alone. We add Benjamini-Hochberg q-values per variable and report how
many cells still hold up after that correction (shown in the map legend).
"""
from __future__ import annotations

import json
import sys
import time
from concurrent.futures import ThreadPoolExecutor
from datetime import date
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "api"))
from case_closed.app import FIRST_YEAR, LAST_YEAR  # noqa: E402
from case_closed.power import clean_power_response, fetch_power  # noqa: E402
from case_closed.stats import analyze  # noqa: E402
from case_closed.variables import get_variable  # noqa: E402
from case_closed.verdict import build_verdict  # noqa: E402

VARS = ("T2M", "PRECTOTCORR")
CACHE = ROOT / "tools" / ".cache" / "power"
OUT = ROOT / "web" / "public" / "data" / "ph_overview.json"


def payload_for(lat: float, lon: float) -> dict:
    CACHE.mkdir(parents=True, exist_ok=True)
    key = CACHE / f"{'-'.join(VARS)}_{lat:.4f}_{lon:.4f}_{FIRST_YEAR}_{LAST_YEAR}.json"
    if key.exists():
        return json.loads(key.read_text())
    for attempt in range(4):
        try:
            payload = fetch_power(",".join(VARS), lat, lon, FIRST_YEAR, LAST_YEAR, timeout=90)
            key.write_text(json.dumps(payload))
            return payload
        except Exception:  # noqa: BLE001 - retry transient POWER errors
            time.sleep(2 * (attempt + 1))
    raise RuntimeError(f"POWER failed for {lat},{lon}")


def bh_qvalues(p: np.ndarray) -> np.ndarray:
    """Benjamini-Hochberg adjusted p-values (q-values)."""
    n = len(p)
    order = np.argsort(p)
    ranked = p[order] * n / np.arange(1, n + 1)
    q = np.minimum.accumulate(ranked[::-1])[::-1]
    out = np.empty(n)
    out[order] = np.minimum(q, 1.0)
    return out


def analyse_cell(cell: dict) -> dict:
    payload = payload_for(cell["lat"], cell["lon"])
    out = {"lat": cell["lat"], "lon": cell["lon"]}
    for code in VARS:
        series = clean_power_response(payload, code, cell["lat"], cell["lon"])
        first = get_variable(code).first_year
        pts = [p for p in series.points if f"{first}-01" <= p.t <= f"{LAST_YEAR}-12"]
        values = np.array([p.value for p in pts], dtype=float)
        start_year, start_month = int(pts[0].t[:4]), int(pts[0].t[5:7])
        trend, _ = analyze(values, start_month=start_month, start_year=start_year)
        verdict = build_verdict(trend, get_variable(code), start_year, n_months=len(pts))
        annual = values[: len(values) // 12 * 12].reshape(-1, 12).mean(axis=1)
        cp = trend.changepoint or {}
        out[code] = {
            "sen": trend.sen_slope_per_decade,
            "p": trend.p_honest,
            "state": verdict["state"],
            "text": verdict["text"],
            "cp": cp.get("year") if cp.get("step_dominated") else None,
            "mean": round(float(values.mean()), 2),
            "first_year": first,
            "annual": [round(float(a), 2) for a in annual],
        }
    # Full 1981+ rainfall annual means, kept only to explain the 1999 break.
    full = clean_power_response(payload, "PRECTOTCORR", cell["lat"], cell["lon"])
    vals = np.array([p.value for p in full.points if f"{FIRST_YEAR}-01" <= p.t <= f"{LAST_YEAR}-12"])
    out["_rain_full"] = vals[: len(vals) // 12 * 12].reshape(-1, 12).mean(axis=1)
    return out


def main() -> None:
    cells = json.loads((ROOT / "tools" / "ph_cells.json").read_text())["cells"]
    t0 = time.time()
    with ThreadPoolExecutor(max_workers=4) as pool:  # be polite to POWER
        results = list(pool.map(analyse_cell, cells))

    summary = {}
    for code in VARS:
        p = np.array([r[code]["p"] for r in results])
        q = bh_qvalues(p)
        for r, qv in zip(results, q):
            r[code]["q"] = round(float(qv), 5)
            r[code]["p"] = round(float(r[code]["p"]), 6)
        sig = [r for r in results if r[code]["state"] in ("confirmed", "step")]
        summary[code] = {
            "cells": len(results),
            "clear": len(sig),
            "clear_after_correction": int(sum(1 for r in results if r[code]["q"] < 0.05)),
            "step": sum(1 for r in results if r[code]["state"] == "step"),
            "median_sen": round(float(np.median([r[code]["sen"] for r in results])), 4),
        }

    # National mean rainfall 1981+ for the "1999 break" explainer.
    rain_full = np.mean([r.pop("_rain_full") for r in results], axis=0)
    summary["rain_national_annual"] = {
        "first_year": FIRST_YEAR,
        "values": [round(float(v), 2) for v in rain_full],
    }

    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps({
        "built": date.today().isoformat(),
        "source": "NASA POWER monthly point API, MERRA-2 reanalysis (T2M, PRECTOTCORR)",
        "window": {c: [get_variable(c).first_year, LAST_YEAR] for c in VARS},
        "grid": {"dlat": 0.5, "dlon": 0.625},
        "summary": summary,
        "cells": results,
    }, separators=(",", ":")))
    print(f"{len(results)} cells in {time.time() - t0:.0f}s -> {OUT} ({OUT.stat().st_size // 1024} KB)")
    print(json.dumps(summary, indent=1))


if __name__ == "__main__":
    main()
