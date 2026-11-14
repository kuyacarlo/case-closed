"""Tests for the static-case loader (NO2) and its endpoint wiring."""
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from case_closed.app import app
from case_closed.variables import get_variable

NO2_FILE = Path(__file__).resolve().parent.parent.parent / "data" / "no2_manila.json"
pytestmark = pytest.mark.skipif(
    not NO2_FILE.exists(), reason="no2_manila.json not present"
)


def test_no2_is_registered_as_static():
    var = get_variable("NO2")
    assert var.static_file == "no2_manila.json"
    assert "satellite" in var.source.lower()
    assert var.scale == 1e6


def test_no2_case_served_from_static_file():
    client = TestClient(app)
    r = client.get("/api/case", params={"lat": 14.6, "lon": 121.0, "variable": "NO2",
                                        "start": 2018, "end": 2024})
    assert r.status_code == 200
    body = r.json()
    assert body["meta"]["variable"] == "NO2"
    assert "satellite" in body["meta"]["source"].lower()
    # Values are scaled to umol/m^2, so they should be order ~10s, not 1e-5.
    first = body["series"][0]["value"]
    assert 1 < abs(first) < 1000
    assert body["verdict"]["state"] in {"confirmed", "not_yet"}


def test_no2_short_record_warns():
    client = TestClient(app)
    r = client.get("/api/case", params={"lat": 14.6, "lon": 121.0, "variable": "NO2",
                                        "start": 2018, "end": 2024})
    # S5P starts 2018 -> under 120 months -> warning present.
    assert any("months" in w for w in r.json()["meta"]["warnings"])
