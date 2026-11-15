"""Precompute the national overview: trend verdicts for every PH land square.

Run offline by the team after build_places.py:

    cd api && uv run python ../tools/build_ph_overview.py

For each NASA POWER square in tools/ph_cells.json it fetches every overview
variable in one call, then runs exactly the same analysis and verdict code the
API uses, so the map and a case page always agree. Raw POWER payloads are
memoised in tools/.cache/power/ keyed on (parameters, square, years); rerunning
never re-spends a call.

Outputs (web/public/data/overview/):
  <CODE>.json  per-variable map layer: every square's verdict + yearly means
  cells.json   compact per-square summary of all variables ("What's changing here?")
  index.json   per-variable summaries, island-group counts, data-break flags

Two honesty checks run here:
- Benjamini-Hochberg q-values per variable: with ~180 squares tested at once,
  a few would look significant by luck alone.
- A data-break detector: if many squares jump in the same year at once, that
  points to a change in how the dataset was made (as found for rainfall in
  1999). Flags are printed and saved; first_year is changed by hand only.
"""
from __future__ import annotations

import collections
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
from case_closed.grid import snap  # noqa: E402
from case_closed.power import clean_power_response, fetch_power  # noqa: E402
from case_closed.stats import analyze, annual_changepoint  # noqa: E402
from case_closed.variables import OVERVIEW_CODES, get_variable  # noqa: E402
from case_closed.verdict import build_verdict  # noqa: E402

CACHE = ROOT / "tools" / ".cache" / "power"
OUT = ROOT / "web" / "public" / "data" / "overview"
# A probable dataset break: this share of squares jumping within +/-1 year.
BREAK_SHARE = 0.20


def payload_for(lat: float, lon: float) -> dict:
    CACHE.mkdir(parents=True, exist_ok=True)
    key = CACHE / f"all{len(OVERVIEW_CODES)}_{lat:.4f}_{lon:.4f}_{FIRST_YEAR}_{LAST_YEAR}.json"
    if key.exists():
        return json.loads(key.read_text())
    for attempt in range(5):
        try:
            payload = fetch_power(",".join(OVERVIEW_CODES), lat, lon, FIRST_YEAR, LAST_YEAR, timeout=120)
            key.write_text(json.dumps(payload))
            return payload
        except Exception:  # noqa: BLE001 - retry transient POWER errors
            time.sleep(3 * (attempt + 1))
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


def monthly(payload: dict, code: str, lat: float, lon: float, first: int) -> np.ndarray:
    var = get_variable(code)
    series = clean_power_response(payload, code, lat, lon)
    pts = [p for p in series.points if f"{first}-01" <= p.t <= f"{LAST_YEAR}-12"]
    return pts, np.array([p.value * var.scale for p in pts], dtype=float)


def analyse_cell(cell: dict) -> dict:
    payload = payload_for(cell["lat"], cell["lon"])
    out = {"lat": cell["lat"], "lon": cell["lon"], "g": cell["g"], "vars": {}, "full_cp": {}}
    for code in OVERVIEW_CODES:
        var = get_variable(code)
        pts, values = monthly(payload, code, cell["lat"], cell["lon"], var.first_year)
        if len(pts) < 240:
            # e.g. land-only variables (evaporation, soil moisture) over a square
            # MERRA-2 treats as ocean, such as parts of the Kalayaan Islands.
            out["vars"][code] = None
            out["full_cp"][code] = None
            continue
        start_year, start_month = int(pts[0].t[:4]), int(pts[0].t[5:7])
        trend, _ = analyze(values, start_month=start_month, start_year=start_year)
        v = build_verdict(trend, var, start_year, n_months=len(pts))
        annual = values[: len(values) // 12 * 12].reshape(-1, 12).mean(axis=1)
        cp = trend.changepoint or {}
        out["vars"][code] = {
            "sen": trend.sen_slope_per_decade,
            "p": trend.p_honest,
            "state": v["state"],
            "sig": v["significant"],
            "dir": v["direction"],
            "total": v["total_change"],
            "text": v["headline"],
            "cp": cp.get("year") if cp.get("step_dominated") else None,
            "mean": round(float(values.mean()), 3),
            "first_year": start_year,
            "annual": [round(float(a), 3) for a in annual],
        }
        # Data-break detector: change point on the *whole* record, independent
        # of first_year, so known breaks (rainfall 1999) are still detected.
        full_pts, full_vals = monthly(payload, code, cell["lat"], cell["lon"], FIRST_YEAR)
        fcp = annual_changepoint(full_vals, int(full_pts[0].t[:4]), int(full_pts[0].t[5:7]))
        out["full_cp"][code] = fcp["year"] if fcp and fcp["step_dominated"] else None
        if code == "PRECTOTCORR":
            out["_rain_full"] = full_vals[: len(full_vals) // 12 * 12].reshape(-1, 12).mean(axis=1)
    return out


def detect_break(results: list[dict], code: str) -> dict | None:
    years = collections.Counter(r["full_cp"][code] for r in results if r["full_cp"][code])
    if not years:
        return None
    best_year, best_n = max(
        ((y, sum(years.get(k, 0) for k in (y - 1, y, y + 1))) for y in years), key=lambda t: t[1]
    )
    share = best_n / max(len(results), 1)
    if share < BREAK_SHARE:
        return None
    return {"year": best_year, "squares": best_n, "share": round(share, 3)}


def island_groups() -> dict[tuple, str]:
    """Majority island group of the towns inside each square."""
    places = json.loads((ROOT / "web" / "public" / "data" / "ph_places.json").read_text())["places"]
    votes: dict[tuple, collections.Counter] = collections.defaultdict(collections.Counter)
    for p in places:
        if p["k"] == "town":
            c = snap(p["lat"], p["lon"])
            votes[(c.lat, c.lon)][p["g"]] += 1
    return {k: v.most_common(1)[0][0] for k, v in votes.items()}


def main() -> None:
    groups = island_groups()
    cells = json.loads((ROOT / "tools" / "ph_cells.json").read_text())["cells"]
    for c in cells:
        # Squares with land but no town point: borrow the nearest grouped square.
        c["g"] = groups.get((c["lat"], c["lon"])) or min(
            groups.items(), key=lambda kv: (kv[0][0] - c["lat"]) ** 2 + (kv[0][1] - c["lon"]) ** 2
        )[1]

    t0 = time.time()
    with ThreadPoolExecutor(max_workers=4) as pool:  # be polite to POWER
        results = list(pool.map(analyse_cell, cells))

    OUT.mkdir(parents=True, exist_ok=True)
    index = {
        "built": date.today().isoformat(),
        "source": "NASA POWER monthly point API (MERRA-2 reanalysis; CERES SYN1deg for sunlight and cloud)",
        "last_year": LAST_YEAR,
        "vars": {},
    }
    for code in OVERVIEW_CODES:
        have = [r for r in results if r["vars"][code] is not None]
        p = np.array([r["vars"][code]["p"] for r in have])
        q = bh_qvalues(p)
        for r, qv in zip(have, q):
            r["vars"][code]["q"] = round(float(qv), 5)
            r["vars"][code]["p"] = round(float(r["vars"][code]["p"]), 6)
        by_group: dict[str, dict] = {}
        for g in ("Luzon", "Visayas", "Mindanao"):
            rs = [r["vars"][code] for r in have if r["g"] == g]
            by_group[g] = {
                "rising": sum(1 for v in rs if v["sig"] and v["dir"] == "rising"),
                "falling": sum(1 for v in rs if v["sig"] and v["dir"] == "falling"),
                "not_sig": sum(1 for v in rs if not v["sig"]),
            }
        vs = [r["vars"][code] for r in have]
        brk = detect_break(have, code)
        var = get_variable(code)
        index["vars"][code] = {
            "window": [var.first_year, LAST_YEAR],
            "squares": len(have),
            "significant": sum(1 for v in vs if v["sig"]),
            "significant_after_correction": int(sum(1 for v in vs if v["q"] < 0.05)),
            "rising": sum(1 for v in vs if v["sig"] and v["dir"] == "rising"),
            "falling": sum(1 for v in vs if v["sig"] and v["dir"] == "falling"),
            "step": sum(1 for v in vs if v["state"] == "step"),
            "median_sen": round(float(np.median([v["sen"] for v in vs])), 4),
            "by_group": by_group,
            "data_break": brk,
        }
        layer = {
            "code": code,
            "window": [var.first_year, LAST_YEAR],
            "cells": [{"lat": r["lat"], "lon": r["lon"], "g": r["g"], **r["vars"][code]} for r in have],
        }
        (OUT / f"{code}.json").write_text(json.dumps(layer, ensure_ascii=False, separators=(",", ":")))

    rain_full = np.mean([r["_rain_full"] for r in results], axis=0)
    index["rain_national_annual"] = {
        "first_year": FIRST_YEAR,
        "values": [round(float(v), 2) for v in rain_full],
    }
    (OUT / "index.json").write_text(json.dumps(index, ensure_ascii=False, separators=(",", ":")))

    # Compact summary of all variables per square: [sen, significant, direction, state].
    compact = {
        "codes": OVERVIEW_CODES,
        "cells": [
            {
                "lat": r["lat"],
                "lon": r["lon"],
                "v": {
                    c: [r["vars"][c]["sen"], int(r["vars"][c]["sig"]), r["vars"][c]["dir"][0], r["vars"][c]["state"]]
                    for c in OVERVIEW_CODES
                    if r["vars"][c] is not None
                },
            }
            for r in results
        ],
    }
    (OUT / "cells.json").write_text(json.dumps(compact, separators=(",", ":")))

    size = sum(f.stat().st_size for f in OUT.iterdir()) // 1024
    print(f"{len(results)} squares x {len(OVERVIEW_CODES)} variables in {time.time() - t0:.0f}s -> {OUT} ({size} KB)")
    for code, s in index["vars"].items():
        flag = f"  DATA BREAK? {s['data_break']}" if s["data_break"] else ""
        print(
            f"{code:18s} window {s['window']}  significant {s['significant']:3d} "
            f"(after BH {s['significant_after_correction']:3d})  rising {s['rising']:3d} falling {s['falling']:3d} "
            f"step {s['step']:3d}  median {s['median_sen']:+.3f}{flag}"
        )


if __name__ == "__main__":
    main()
