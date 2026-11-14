"""Tests for the POWER client against a saved response fixture."""
import json
from pathlib import Path

from case_closed.power import clean_power_response

FIXTURE = Path(__file__).parent / "fixtures" / "power_t2m_sample.json"


def load_fixture() -> dict:
    return json.loads(FIXTURE.read_text())


def test_drops_annual_average_entries():
    series = clean_power_response(load_fixture(), "T2M", 14.6, 121.0)
    # No month should be "13" (the annual average).
    assert all(not p.t.endswith("-13") for p in series.points)


def test_drops_fill_values():
    series = clean_power_response(load_fixture(), "T2M", 14.6, 121.0)
    # 2021-02 is -999 in the fixture and must be removed.
    assert "2021-02" not in [p.t for p in series.points]


def test_counts_and_order():
    series = clean_power_response(load_fixture(), "T2M", 14.6, 121.0)
    # 24 months total, minus one fill value = 23 real months.
    assert series.n_months == 23
    times = [p.t for p in series.points]
    assert times == sorted(times)
    assert times[0] == "2020-01"
    assert times[-1] == "2021-12"


def test_values_are_floats_and_labels_iso():
    series = clean_power_response(load_fixture(), "T2M", 14.6, 121.0)
    first = series.points[0]
    assert first.t == "2020-01"
    assert abs(first.value - 26.1) < 1e-9
