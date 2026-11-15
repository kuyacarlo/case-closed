"""POWER grid snapping (alignment verified against the live API)."""
from case_closed.grid import snap


def test_points_in_one_cell_share_a_centre():
    # These three returned identical POWER series on 2026-11-15.
    cells = {snap(14.30, 120.95), snap(14.50, 121.25), snap(14.70, 121.55)}
    assert cells == {snap(14.5, 121.25)}
    assert snap(14.5, 121.25).lat == 14.5 and snap(14.5, 121.25).lon == 121.25


def test_neighbouring_cells_differ():
    assert snap(14.50, 120.90) != snap(14.50, 121.25)
    assert snap(14.80, 121.25) != snap(14.50, 121.25)


def test_snap_values_on_grid():
    c = snap(7.07, 125.6)
    assert (c.lat / 0.5).is_integer()
    assert abs(((c.lon + 180) / 0.625) - round((c.lon + 180) / 0.625)) < 1e-9
