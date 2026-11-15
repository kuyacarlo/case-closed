"""FastAPI app exposing the /api/case contract.

Wires the POWER client and the stats module, builds the verdict, and returns
the single-endpoint contract the frontend screens consume. CORS is open for
the frontend dev server and the deployed site.
"""
from __future__ import annotations

import numpy as np
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware

from .grid import snap
from .area_cases import NoAreaData, UnknownArea, load_area_series
from .grid_cases import OutsideGrid, load_grid_series
from .power import CacheMiss, MonthlyPoint, MonthlySeries, get_series
from .static_cases import OutsideStaticArea, load_static_series
from .stats import analyze, monthly_anomalies
from .variables import DEFAULT_VARIABLE, SET_ASIDE, THEMES, get_variable, variable_list
from .verdict import build_verdict

# NASA POWER monthly data starts in 1981; 2025 is the last complete year
# (checked against the live API on 2026-11-15).
FIRST_YEAR = 1981
LAST_YEAR = 2025

app = FastAPI(title="Case Closed API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/api/health")
def health() -> dict:
    return {"ok": True}


@app.get("/api/variables")
def variables() -> dict:
    return {
        "variables": variable_list(),
        "themes": THEMES,
        "set_aside": SET_ASIDE,
        "first_year": FIRST_YEAR,
        "last_year": LAST_YEAR,
    }


@app.get("/api/case")
def case(
    lat: float | None = Query(None),
    lon: float | None = Query(None),
    area: str | None = Query(None),
    variable: str = Query(DEFAULT_VARIABLE),
    start: int | None = Query(None),
    end: int = Query(LAST_YEAR),
) -> dict:
    try:
        var = get_variable(variable)
    except KeyError:
        raise HTTPException(status_code=400, detail=f"Unknown variable {variable!r}")

    if start is None:
        start = var.first_year
    if area is None and (lat is None or lon is None):
        raise HTTPException(status_code=400, detail="Give a place (lat and lon) or an area.")
    if area is not None and (lat is None or lon is None):
        lat, lon = 0.0, 0.0
    if not (-90 <= lat <= 90) or not (-180 <= lon <= 180):
        raise HTTPException(
            status_code=400, detail="Latitude must be -90 to 90 and longitude -180 to 180."
        )
    if start > end:
        raise HTTPException(status_code=400, detail="Start year must be before end year.")
    if start < FIRST_YEAR or end > LAST_YEAR:
        raise HTTPException(
            status_code=400,
            detail=f"Years must be between {FIRST_YEAR} and {LAST_YEAR}.",
        )

    if start < var.first_year:
        raise HTTPException(
            status_code=400,
            detail=var.first_year_note or f"{var.label} starts in {var.first_year}.",
        )

    cell = snap(lat, lon)

    grid_warnings: list[str] = []
    area_meta: dict | None = None
    try:
        if area is not None:
            if var.static_file:
                raise HTTPException(
                    status_code=404,
                    detail=f"{var.label} is only available for {var.static_place}, not as a region average.",
                )
            series, area_meta = load_area_series(var.code, area, start, end)
        elif var.grid_file:
            series, grid_warnings = load_grid_series(
                var.code, var.grid_file, lat, lon, start, end, scale=var.scale, offset=var.offset
            )
        elif var.static_file:
            series = load_static_series(
                var.code, var.static_file, lat, lon, start, end, scale=var.scale
            )
        else:
            series = get_series(var.code, cell.lat, cell.lon, start, end)
            if var.scale != 1.0:
                series = MonthlySeries(
                    variable=series.variable,
                    lat=series.lat,
                    lon=series.lon,
                    points=[MonthlyPoint(t=p.t, value=p.value * var.scale) for p in series.points],
                    from_cache=series.from_cache,
                )
    except UnknownArea:
        raise HTTPException(status_code=400, detail=f"Unknown region {area!r}.")
    except NoAreaData:
        raise HTTPException(status_code=404, detail=f"{var.label} isn't averaged for this region.")
    except HTTPException:
        raise
    except OutsideGrid:
        raise HTTPException(
            status_code=404,
            detail=f"{var.label} is only prepared for squares covering the Philippines.",
        )
    except OutsideStaticArea:
        raise HTTPException(
            status_code=404,
            detail=f"{var.label} is only available for {var.static_place}.",
        )
    except CacheMiss as exc:
        raise HTTPException(status_code=503, detail=str(exc))
    except Exception:  # noqa: BLE001 - don't echo upstream URLs or internals
        raise HTTPException(
            status_code=502,
            detail="NASA POWER didn't respond. Try again in a minute.",
        )

    if not series.points:
        raise HTTPException(status_code=404, detail="No data for this place and years.")

    values = np.array([p.value for p in series.points], dtype=float)
    start_month = int(series.points[0].t[5:7])
    start_year = int(series.points[0].t[:4])
    trend, warnings = analyze(values, start_month=start_month, start_year=start_year)
    warnings = grid_warnings + warnings
    if series.from_cache:
        warnings.append("Live data was unavailable, so this uses a saved copy from NASA POWER.")

    anomalies = monthly_anomalies(values, start_month=start_month)
    climatology = values - anomalies

    verdict = build_verdict(trend, var, start_year, n_months=series.n_months)

    series_out = [
        {
            "t": p.t,
            "value": round(float(p.value), 4),
            "climatology": round(float(climatology[i]), 4),
            "anomaly": round(float(anomalies[i]), 4),
        }
        for i, p in enumerate(series.points)
    ]

    return {
        "meta": {
            "variable": var.code,
            "label": var.label,
            "definition": var.definition,
            "units": var.units,
            "source": var.source,
            "lat": lat,
            "lon": lon,
            # Static variables are point exports, not grid squares.
            "cell": None if (var.static_file or area_meta) else cell.as_dict(),
            "area": area_meta,
            "witness": var.witness,
            "start": series.points[0].t,
            "end": series.points[-1].t,
            "n_months": series.n_months,
            "baseline": f"{series.points[0].t[:4]}-{series.points[-1].t[:4]}",
            "from_cache": series.from_cache,
            "warnings": warnings,
        },
        "series": series_out,
        "trend": trend.as_dict(),
        "verdict": verdict,
    }
