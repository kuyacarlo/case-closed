"""Export a monthly NO2 point time series from Google Earth Engine.

Pulls Sentinel-5P TROPOMI tropospheric NO2 column over a point, aggregates to
a monthly mean, and writes JSON in the same raw shape the POWER client cleans
(``properties.parameter.<VAR>`` keyed by ``YYYYMM``). The app serves it through
the existing /api/case contract (static-case loader, HANDOFF item 10).

This script runs offline by the team; the app never talks to GEE. Auth uses a
service-account key via GOOGLE_APPLICATION_CREDENTIALS or the --key flag.

Usage:
    python export_no2.py --lat 14.6 --lon 121.0 --start 2018 --end 2024 \
        --out ../../data/no2_manila.json
"""
from __future__ import annotations

import argparse
import json
from pathlib import Path

import ee

# Sentinel-5P TROPOMI offline NO2, tropospheric column (mol/m^2).
COLLECTION = "COPERNICUS/S5P/OFFL/L3_NO2"
BAND = "tropospheric_NO2_column_number_density"
SCALE_M = 1113  # native S5P grid ~0.01 deg


def monthly_series(lat: float, lon: float, start: int, end: int) -> dict[str, float]:
    point = ee.Geometry.Point([lon, lat])
    coll = ee.ImageCollection(COLLECTION).select(BAND)

    out: dict = {}
    for year in range(start, end + 1):
        for month in range(1, 13):
            lo = ee.Date.fromYMD(year, month, 1)
            hi = lo.advance(1, "month")
            month_coll = coll.filterDate(lo, hi)
            # Guard empty months: reduceRegion on an empty-mean image omits the
            # band key. Use a dict .get with a default so missing months are null.
            img = month_coll.mean()
            reduced = ee.Dictionary(img.reduceRegion(ee.Reducer.mean(), point, SCALE_M))
            val = ee.Algorithms.If(
                month_coll.size().gt(0),
                reduced.get(BAND, None),
                None,
            )
            out[f"{year:04d}{month:02d}"] = val
    # One server round-trip for the whole dict.
    return ee.Dictionary(out).getInfo()


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--lat", type=float, required=True)
    ap.add_argument("--lon", type=float, required=True)
    ap.add_argument("--start", type=int, required=True)
    ap.add_argument("--end", type=int, required=True)
    ap.add_argument("--project", default="gdg-compute")
    ap.add_argument("--service-account", default="gee-exporter@gdg-compute.iam.gserviceaccount.com")
    ap.add_argument("--key", required=True, help="path to service-account JSON key")
    ap.add_argument("--out", required=True)
    args = ap.parse_args()

    creds = ee.ServiceAccountCredentials(args.service_account, args.key)
    ee.Initialize(creds, project=args.project)

    raw = monthly_series(args.lat, args.lon, args.start, args.end)
    # Drop months with no scene (value None) so the fill logic has nothing to do.
    clean = {k: v for k, v in raw.items() if v is not None}

    payload = {
        "properties": {"parameter": {"NO2": clean}},
        "header": {
            "source": "Sentinel-5P TROPOMI (COPERNICUS/S5P/OFFL/L3_NO2)",
            "band": BAND,
            "lat": args.lat,
            "lon": args.lon,
        },
    }
    out = Path(args.out)
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(payload, indent=2))
    print(f"wrote {len(clean)} months to {out}")


if __name__ == "__main__":
    main()
