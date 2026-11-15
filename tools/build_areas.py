"""Region averages: one monthly series per area per variable.

Run after build_places.py, fetch_giovanni.py and build_nasa_grids.py
(the POWER payloads come from the overview builder's cache):

    cd api && uv run python ../tools/build_areas.py

For every province, region, island group and the whole country
(tools/ph_areas.json), each variable's monthly series is the weighted average
of its squares, weighted by how much of the area's land falls in each square.
Months where some squares have no data use the remaining squares' weights.

Outputs:
  data/areas/<id>.json            monthly series per variable (served by the API)
  web/public/data/areas/<id>.json full-record verdict per variable (quick answer)
  web/public/data/areas/index.json list of areas
"""
from __future__ import annotations

import json
import sys
import time
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "api"))
sys.path.insert(0, str(ROOT / "tools"))
from build_ph_overview import monthly, payload_for  # noqa: E402
from case_closed.app import LAST_YEAR  # noqa: E402
from case_closed.stats import analyze  # noqa: E402
from case_closed.variables import OVERVIEW_CODES, get_variable  # noqa: E402
from case_closed.verdict import build_verdict  # noqa: E402

OUT_API = ROOT / "data" / "areas"
OUT_WEB = ROOT / "web" / "public" / "data" / "areas"


def month_labels(first: int) -> list[str]:
    return [f"{y:04d}-{m:02d}" for y in range(first, LAST_YEAR + 1) for m in range(1, 13)]


def main() -> None:
    areas = json.loads((ROOT / "tools" / "ph_areas.json").read_text())["areas"]
    t0 = time.time()
    # Every square's monthly series per variable, aligned to full calendars.
    squares = {(la, lo) for a in areas for la, lo, _ in a["squares"]}
    series: dict[str, dict[tuple, dict[str, float]]] = {c: {} for c in OVERVIEW_CODES}
    for la, lo in squares:
        payload = payload_for(la, lo)
        for code in OVERVIEW_CODES:
            pts, vals = monthly(payload, code, la, lo, get_variable(code).first_year)
            if len(pts):
                series[code][(la, lo)] = {p.t: float(v) for p, v in zip(pts, vals)}

    OUT_API.mkdir(parents=True, exist_ok=True)
    OUT_WEB.mkdir(parents=True, exist_ok=True)
    index = []
    for a in areas:
        api_vars, web_vars = {}, {}
        for code in OVERVIEW_CODES:
            var = get_variable(code)
            labels = month_labels(var.first_year)
            vals = []
            for t in labels:
                num = den = 0.0
                for la, lo, w in a["squares"]:
                    v = series[code].get((la, lo), {}).get(t)
                    if v is not None and np.isfinite(v):
                        num += w * v
                        den += w
                vals.append(num / den if den > 0 else None)
            # Trim months with no data at either end (e.g. IMERG after 2025-09).
            ok = [i for i, v in enumerate(vals) if v is not None]
            if len(ok) < 240:
                continue
            vals, labels = vals[ok[0] : ok[-1] + 1], labels[ok[0] : ok[-1] + 1]
            if any(v is None for v in vals):
                continue
            arr = np.array(vals)
            start_year, start_month = int(labels[0][:4]), int(labels[0][5:7])
            trend, _ = analyze(arr, start_month=start_month, start_year=start_year)
            v = build_verdict(trend, var, start_year, n_months=len(arr))
            cp = trend.changepoint or {}
            annual = arr[: len(arr) // 12 * 12].reshape(-1, 12).mean(axis=1)
            api_vars[code] = {"start": labels[0], "values": [round(x, 5) for x in vals]}
            web_vars[code] = {
                "sen": trend.sen_slope_per_decade,
                "p": round(trend.p_honest, 6),
                "q": round(trend.p_honest, 6),
                "state": v["state"],
                "sig": v["significant"],
                "dir": v["direction"],
                "total": v["total_change"],
                "text": v["headline"],
                "cp": cp.get("year") if cp.get("step_dominated") else None,
                "mean": round(float(arr.mean()), 3),
                "first_year": start_year,
                "annual": [round(float(x), 3) for x in annual],
            }
        meta = {"id": a["id"], "name": a["name"], "kind": a["kind"], "n_squares": len(a["squares"])}
        (OUT_API / f"{a['id']}.json").write_text(json.dumps({**meta, "vars": api_vars}, separators=(",", ":")))
        (OUT_WEB / f"{a['id']}.json").write_text(
            json.dumps(
                {**meta, "squares": [[la, lo] for la, lo, _ in a["squares"]], "vars": web_vars},
                ensure_ascii=False,
                separators=(",", ":"),
            )
        )
        index.append(meta)
    (OUT_WEB / "index.json").write_text(json.dumps({"areas": index}, ensure_ascii=False, separators=(",", ":")))
    print(f"{len(index)} areas x {len(OVERVIEW_CODES)} variables in {time.time() - t0:.0f}s")
    for name in ("Philippines", "Luzon", "Mindanao", "Cebu", "City of Manila"):
        a = next((x for x in areas if x["name"] == name), None)
        if a:
            d = json.loads((OUT_WEB / f"{a['id']}.json").read_text())["vars"]
            print(f"  {name:15s} T2M: {d['T2M']['text']}  |  IMERG: {d.get('IMERG', {}).get('text')}")


if __name__ == "__main__":
    main()
