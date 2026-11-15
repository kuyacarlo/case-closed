"""Gridded NASA variables served from data/nasa/ (built from Giovanni)."""
import json

import pytest

from case_closed import grid_cases
from case_closed.grid_cases import OutsideGrid, load_grid_series


@pytest.fixture
def grid_dir(tmp_path, monkeypatch):
    (tmp_path / "nasa").mkdir()
    months = 24
    vals = [300.0 + (i % 12) for i in range(months)]
    vals[5] = None  # one missing month
    payload = {"code": "X", "start": "2003-01", "cells": {"14.5000,121.2500": vals}}
    (tmp_path / "nasa" / "X.json").write_text(json.dumps(payload))
    monkeypatch.setattr(grid_cases, "DATA_DIR", tmp_path)
    grid_cases._load.cache_clear()
    return tmp_path


def test_converts_units_and_fills_gaps(grid_dir):
    series, warnings = load_grid_series("X", "X.json", 14.6, 121.0, 2003, 2004, offset=-273.15)
    assert len(series.points) == 24
    assert series.points[0].t == "2003-01"
    assert abs(series.points[0].value - 26.85) < 1e-9  # 300 K -> 26.85 C
    # June 2003 was missing: filled with June's value from 2004 (305 K).
    assert abs(series.points[5].value - (305 - 273.15)) < 1e-9
    assert "1 of 24 months" in warnings[0]


def test_outside_grid_raises(grid_dir):
    with pytest.raises(OutsideGrid):
        load_grid_series("X", "X.json", 40.0, -100.0, 2003, 2004)


def test_nasa_variables_are_registered():
    from case_closed.variables import VARIABLES, POWER_CODES
    for code in ("IMERG", "GLDAS_EVAP", "GLDAS_ROOTMOIST", "GLDAS_RUNOFF", "OMI_NO2", "AIRS_TSURF"):
        v = VARIABLES[code]
        assert v.grid_file and "Giovanni" in v.source and v.definition
        assert code not in POWER_CODES
