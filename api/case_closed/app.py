"""FastAPI app exposing the /api/case contract.

Wires the POWER client and the stats module, builds the verdict, and returns
the single-endpoint contract the frontend screens consume. CORS is open for
the frontend dev server and the deployed site.
"""
from __future__ import annotations

import numpy as np
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware

from .power import get_series
from .stats import analyze
from .variables import DEFAULT_VARIABLE, get_variable, variable_list
from .verdict import build_verdict

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
    return {"variables": variable_list()}


@app.get("/api/case")
def case(
    lat: float = Query(...),
    lon: float = Query(...),
    variable: str = Query(DEFAULT_VARIABLE),
    start: int = Query(1981),
    end: int = Query(2025),
) -> dict:
    try:
        var = get_variable(variable)
    except KeyError:
        raise HTTPException(status_code=400, detail=f"Unknown variable {variable!r}")

    if start > end:
        raise HTTPException(status_code=400, detail="start must be <= end")

    try:
        if var.static_file:
            from .static_cases import load_static_series

            series = load_static_series(
                var.code, var.static_file, lat, lon, start, end, scale=var.scale
            )
        else:
            series = get_series(var.code, lat, lon, start, end)
    except Exception as exc:  # noqa: BLE001 - surface upstream failure to client
        raise HTTPException(status_code=502, detail=f"Data fetch failed: {exc}")

    if not series.points:
        raise HTTPException(status_code=404, detail="No data for this point and window")

    values = np.array([p.value for p in series.points], dtype=float)
    start_month = int(series.points[0].t[5:7])
    trend, warnings = analyze(values, start_month=start_month)

    from .stats import monthly_anomalies, sen_slope_per_decade

    anomalies = monthly_anomalies(values, start_month=start_month)
    climatology = values - anomalies

    start_year = int(series.points[0].t[:4])
    verdict = build_verdict(trend, var, start_year)

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
            "start": series.points[0].t,
            "end": series.points[-1].t,
            "n_months": series.n_months,
            "warnings": warnings,
        },
        "series": series_out,
        "trend": trend.as_dict(),
        "verdict": verdict,
    }
