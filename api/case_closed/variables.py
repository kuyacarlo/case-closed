"""Variable catalog: POWER parameter codes, labels, units, plain definitions.

Item 6 of the MVP. Starts with air temperature and rainfall. Each definition
is one plain sentence aimed at a high-school student.
"""
from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class Variable:
    code: str  # POWER parameter code (or static variable code)
    label: str
    units: str
    definition: str
    source: str
    # Static variables are served from a bundled JSON file instead of POWER.
    static_file: str | None = None
    # Multiply raw values by this for display (e.g. mol/m^2 -> umol/m^2).
    scale: float = 1.0
    # Plain place name for a static variable's only location (used in errors).
    static_place: str | None = None
    # Plain words for an upward / downward change in the verdict headline.
    up_word: str = "Rising"
    down_word: str = "Falling"
    # Earliest year this variable may be analysed from, and why (shown to users).
    first_year: int = 1981
    first_year_note: str | None = None


VARIABLES: dict[str, Variable] = {
    "T2M": Variable(
        code="T2M",
        label="Air temperature",
        units="\u00b0C",
        definition="How warm the air is 2 meters above the ground.",
        source="NASA POWER · MERRA-2 reanalysis (model-based)",
        up_word="Getting warmer",
        down_word="Getting cooler",
    ),
    "PRECTOTCORR": Variable(
        code="PRECTOTCORR",
        label="Rainfall",
        units="mm/day",
        definition="How much rain falls, averaged over each day of the month.",
        source="NASA POWER · MERRA-2 reanalysis, bias-corrected (model-based)",
        up_word="Getting wetter",
        down_word="Getting drier",
        # Across all ~180 PH land cells the POWER rainfall record jumps by
        # about 50% in 1999 at once (national mean ~4.5 -> ~6.9 mm/day) and
        # stays there: the signature of a change in how the data was made,
        # not of climate. See tools/build_ph_overview.py and the methods page.
        first_year=2000,
        first_year_note=(
            "Rainfall is analysed from 2000. Before then the record jumps by about "
            "50% across the whole country in 1999, which points to a change in the "
            "data, not the weather."
        ),
    ),
    "NO2": Variable(
        code="NO2",
        label="Nitrogen dioxide",
        units="\u00b5mol/m\u00b2",
        definition="Nitrogen dioxide in the air column, a marker of traffic and industry.",
        source="Sentinel-5P TROPOMI satellite (ESA/Copernicus), via Google Earth Engine",
        static_file="no2_manila.json",
        scale=1e6,  # mol/m^2 -> umol/m^2
        static_place="Metro Manila",
    ),
}

DEFAULT_VARIABLE = "T2M"


def get_variable(code: str) -> Variable:
    if code not in VARIABLES:
        raise KeyError(code)
    return VARIABLES[code]


def variable_list() -> list[dict]:
    """Serializable list for the frontend variable picker."""
    return [
        {
            "code": v.code,
            "label": v.label,
            "units": v.units,
            "definition": v.definition,
            "source": v.source,
            "static_place": v.static_place,
            "first_year": v.first_year,
            "first_year_note": v.first_year_note,
        }
        for v in VARIABLES.values()
    ]
