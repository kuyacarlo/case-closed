"""Verdict and API endpoint tests.

The endpoint test monkeypatches the POWER series fetch so no network call is
made; it uses the Manila-like fixture series.
"""
import numpy as np
import pytest
from fastapi.testclient import TestClient

from case_closed import app as app_module
from case_closed.power import MonthlyPoint, MonthlySeries
from case_closed.stats import TrendResult
from case_closed.variables import get_variable
from case_closed.verdict import build_verdict, format_p
from tests.fixtures.manila import manila_like_series


def test_format_p_scientific_below_threshold():
    assert "e-" in format_p(4e-12)


def test_format_p_three_decimals_above_threshold():
    assert format_p(0.001) == "0.001"
    assert format_p(0.0423) == "0.042"


def test_verdict_confirmed_text():
    trend = TrendResult(
        sen_slope_per_decade=0.15,
        ols_slope_per_decade=0.12,
        ci95=0.07,
        p_naive=4e-12,
        p_honest=0.001,
        lag1=0.52,
        n_eff=171,
        years_needed=44,
    )
    v = build_verdict(trend, get_variable("T2M"), 1981)
    assert v["state"] == "confirmed"
    assert "Rising" in v["text"]
    assert "0.15" in v["text"]
    assert "1981" in v["text"]


def test_verdict_not_yet_text():
    trend = TrendResult(
        sen_slope_per_decade=0.02,
        ols_slope_per_decade=0.01,
        ci95=0.10,
        p_naive=0.2,
        p_honest=0.3,
        lag1=0.5,
        n_eff=100,
        years_needed=60,
    )
    v = build_verdict(trend, get_variable("T2M"), 1981)
    assert v["state"] == "not_yet"
    assert "60 years of record" in v["text"]


def test_verdict_falling():
    trend = TrendResult(
        sen_slope_per_decade=-0.3,
        ols_slope_per_decade=-0.25,
        ci95=0.1,
        p_naive=1e-5,
        p_honest=0.01,
        lag1=0.4,
        n_eff=120,
        years_needed=None,
    )
    v = build_verdict(trend, get_variable("T2M"), 2000)
    assert v["state"] == "confirmed"
    assert "Falling" in v["text"]


@pytest.fixture
def client(monkeypatch):
    values = manila_like_series()
    points = []
    year, month = 1981, 1
    for val in values:
        points.append(MonthlyPoint(t=f"{year:04d}-{month:02d}", value=float(val)))
        month += 1
        if month > 12:
            month = 1
            year += 1

    def fake_get_series(variable, lat, lon, start, end, **kwargs):
        return MonthlySeries(variable=variable, lat=lat, lon=lon, points=list(points))

    monkeypatch.setattr(app_module, "get_series", fake_get_series)
    return TestClient(app_module.app)


def test_case_contract_shape(client):
    r = client.get("/api/case", params={"lat": 14.6, "lon": 121.0, "variable": "T2M"})
    assert r.status_code == 200
    body = r.json()
    assert set(body) == {"meta", "series", "trend", "verdict"}

    meta = body["meta"]
    for key in ("variable", "label", "definition", "units", "source", "lat",
                "lon", "start", "end", "n_months", "warnings"):
        assert key in meta
    assert meta["variable"] == "T2M"
    assert meta["n_months"] == 540

    trend = body["trend"]
    for key in ("sen_slope_per_decade", "ols_slope_per_decade", "ci95",
                "p_naive", "p_honest", "lag1", "n_eff", "years_needed"):
        assert key in trend

    assert body["series"][0].keys() == {"t", "value", "climatology", "anomaly"}
    assert body["verdict"]["state"] in {"confirmed", "not_yet"}


def test_case_verdict_confirmed(client):
    r = client.get("/api/case", params={"lat": 14.6, "lon": 121.0, "variable": "T2M"})
    assert r.json()["verdict"]["state"] == "confirmed"


def test_unknown_variable_400(client):
    r = client.get("/api/case", params={"lat": 14.6, "lon": 121.0, "variable": "NOPE"})
    assert r.status_code == 400


def test_variables_endpoint(client):
    r = client.get("/api/variables")
    assert r.status_code == 200
    codes = [v["code"] for v in r.json()["variables"]]
    assert "T2M" in codes and "PRECTOTCORR" in codes
