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
Giovanni only accepts single points, so each square is sampled at a point on
land inside it (tools/ph_cells.json "plat"/"plon"); a square's centre is often
sea, where land-only products such as GLDAS have no data.
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
    """Cache file for a square (keyed on the square's centre)."""
    _, y0, y1 = DATASETS[key]
    return CACHE / key / f"land_{lat:.4f}_{lon:.4f}_{y0}_{y1}.csv"


def fetch(key: str, lat: float, lon: float, plat: float, plon: float, tok: str) -> str:
    """Fetch the series for the square centred on (lat, lon), sampled at its
    land point (plat, plon)."""
    path = cache_path(key, lat, lon)
    if path.exists():
        return "cached"
    data_id, y0, y1 = DATASETS[key]
    q = urllib.parse.urlencode(
        {
            "data": data_id,
            "location": f"[{plat},{plon}]",
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


LAND_ONLY = ("GLDAS_EVAP", "GLDAS_ROOTMOIST", "GLDAS_RUNOFF")


def all_empty(path: Path) -> bool:
    body = path.read_text().partition("\n\n")[2].splitlines()[1:]
    for line in body:
        v = line.partition(",")[2].strip()
        try:
            x = float(v)
        except ValueError:
            continue
        if -9000 < x < 1e29:
            return False
    return True


def retry_empty(tok: str, cells: list[dict]) -> None:
    """GLDAS is land-only at 0.25 deg, so a land point on a small island or a
    narrow coast can still land on a GLDAS sea pixel. For squares that came
    back empty, try town points inside the square (nearest the centre first)
    and keep the first with data."""
    sys.path.insert(0, str(ROOT / "api"))
    from case_closed.grid import snap

    places = json.loads((ROOT / "web" / "public" / "data" / "ph_places.json").read_text())["places"]
    towns: dict[tuple, list] = {}
    for t in places:
        if t["k"] == "town":
            c = snap(t["lat"], t["lon"])
            towns.setdefault((c.lat, c.lon), []).append((t["lat"], t["lon"]))
    fixed = still = 0
    for key in LAND_ONLY:
        for c in cells:
            path = cache_path(key, c["lat"], c["lon"])
            if not path.exists() or not all_empty(path):
                continue
            cands = sorted(towns.get((c["lat"], c["lon"]), []),
                           key=lambda t: (t[0] - c["lat"]) ** 2 + (t[1] - c["lon"]) ** 2)[:4]
            ok = False
            for la, lo in cands:
                tmp = path.with_suffix(".try")
                path.rename(tmp)
                if fetch(key, c["lat"], c["lon"], la, lo, tok) == "fetched" and not all_empty(path):
                    tmp.unlink()
                    ok = True
                    break
                if path.exists():
                    path.unlink()
                tmp.rename(path)
            fixed += ok
            still += not ok
    print(f"retry-empty: filled {fixed}, still empty {still} (no GLDAS land pixel in the square)")


def main() -> None:
    tok = token()
    cells = json.loads((ROOT / "tools" / "ph_cells.json").read_text())["cells"]
    if sys.argv[1:] == ["--retry-empty"]:
        retry_empty(tok, cells)
        return
    keys = sys.argv[1:] or list(DATASETS)
    jobs = [(k, c["lat"], c["lon"], c.get("plat", c["lat"]), c.get("plon", c["lon"])) for k in keys for c in cells]
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
