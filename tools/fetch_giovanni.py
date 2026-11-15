"""Download NASA time series for every PH square through Giovanni.

These are the datasets the 2026 Space Apps challenge lists: GPM IMERG
rainfall, GLDAS land water (evaporation, root-zone soil moisture, surface
runoff), OMI nitrogen dioxide and AIRS surface air temperature. Giovanni is
the challenge's first listed NASA resource.

Run offline by the team (needs a free NASA Earthdata Login token):

    # api/.env (git-ignored):  EARTHDATA_TOKEN=...
    cd api && uv run python ../tools/fetch_giovanni.py

Every response is cached raw in tools/.cache/giovanni/ keyed on
(dataset, square, years), so a rerun never repeats a request. The token is
read from the environment or api/.env and never printed or written anywhere.
Giovanni only accepts single points, so each square is sampled at its centre.
"""
from __future__ import annotations

import json
import os
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
CACHE = ROOT / "tools" / ".cache" / "giovanni"
API = "https://api.giovanni.earthdata.nasa.gov/timeseries"

# Giovanni data ids (checked against the live API on 2026-11-15) and the
# years requested. Start years are each product's first full year.
DATASETS = {
    "IMERG": ("GPM_3IMERGM_07_precipitation", 2001, 2025),
    "GLDAS_EVAP": ("GLDAS_NOAH025_M_2_1_Evap_tavg", 2000, 2025),
    "GLDAS_ROOTMOIST": ("GLDAS_NOAH025_M_2_1_RootMoist_inst", 2000, 2025),
    "GLDAS_RUNOFF": ("GLDAS_NOAH025_M_2_1_Qs_acc", 2000, 2025),
    "OMI_NO2": ("OMNO2d_003_ColumnAmountNO2TropCloudScreened", 2005, 2025),
    "AIRS_TSURF": ("AIRS3STM_7_0_SurfAirTemp_A", 2003, 2025),
}


def token() -> str:
    tok = os.environ.get("EARTHDATA_TOKEN", "")
    env = ROOT / "api" / ".env"
    if not tok and env.exists():
        for line in env.read_text().splitlines():
            if line.startswith("EARTHDATA_TOKEN="):
                tok = line.split("=", 1)[1].strip()
    if not tok:
        sys.exit("EARTHDATA_TOKEN is not set (see api/.env).")
    return tok


def cache_path(key: str, lat: float, lon: float) -> Path:
    _, y0, y1 = DATASETS[key]
    return CACHE / key / f"{lat:.4f}_{lon:.4f}_{y0}_{y1}.csv"


def fetch(key: str, lat: float, lon: float, tok: str) -> str:
    path = cache_path(key, lat, lon)
    if path.exists():
        return "cached"
    data_id, y0, y1 = DATASETS[key]
    q = urllib.parse.urlencode(
        {
            "data": data_id,
            "location": f"[{lat},{lon}]",
            "time": f"{y0}-01-01T00:00:00/{y1}-12-31T23:59:59",
        }
    )
    req = urllib.request.Request(f"{API}?{q}", headers={"Authorization": f"Bearer {tok}"})
    for attempt in range(5):
        try:
            with urllib.request.urlopen(req, timeout=600) as r:
                text = r.read().decode("utf-8")
            if "Timestamp" not in text:
                raise ValueError("unexpected response")
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_text(text)
            return "fetched"
        except (urllib.error.URLError, ValueError, TimeoutError):
            time.sleep(5 * (attempt + 1))
    return "failed"


def main() -> None:
    tok = token()
    cells = json.loads((ROOT / "tools" / "ph_cells.json").read_text())["cells"]
    keys = sys.argv[1:] or list(DATASETS)
    jobs = [(k, c["lat"], c["lon"]) for k in keys for c in cells]
    t0 = time.time()
    counts = {"cached": 0, "fetched": 0, "failed": 0}
    with ThreadPoolExecutor(max_workers=3) as pool:  # be polite to Giovanni
        for i, status in enumerate(pool.map(lambda j: fetch(*j, tok), jobs), 1):
            counts[status] += 1
            if i % 50 == 0 or i == len(jobs):
                print(f"{i}/{len(jobs)} {counts} {time.time() - t0:.0f}s", flush=True)
    failed = [j for j in jobs if not cache_path(j[0], j[1], j[2]).exists()]
    if failed:
        print("FAILED:", failed[:20], "..." if len(failed) > 20 else "")


if __name__ == "__main__":
    main()
