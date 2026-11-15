"""Variable catalog: POWER parameter codes, labels, units, plain definitions.

Item 6 of the MVP. Each definition is one plain sentence aimed at a
high-school student.
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
    # Shown with the evidence when the data itself can mislead.
    caveat: str | None = None


MODEL_CAVEAT = (
    "This value comes from a weather model that blends many instruments. The "
    "instruments changed over the decades, and that change can look like a "
    "trend, so compare it with station records before you trust it."
)

VARIABLES: dict[str, Variable] = {
    "T2M": Variable(
        code="T2M",
        label="Air temperature",
        units="\u00b0C",
        definition="How warm the air is 2 meters above the ground.",
        source="NASA POWER (MERRA-2)",
    ),
    "PRECTOTCORR": Variable(
        code="PRECTOTCORR",
        label="Rainfall",
        units="mm/day",
        definition="How much rain falls, averaged over each day of the month.",
        source="NASA POWER (MERRA-2)",
        caveat=(
            "This rainfall comes from a weather model corrected with rain gauges "
            "and satellites. The instruments feeding it changed over the decades, "
            "so compare a long rainfall trend with rain-gauge records before you "
            "trust it."
        ),
    ),
    "T2M_MAX": Variable(
        code="T2M_MAX",
        label="Hottest temperature of the month",
        units="°C",
        definition="The highest air temperature reached in each month.",
        source="NASA POWER (MERRA-2)",
    ),
    "T2M_MIN": Variable(
        code="T2M_MIN",
        label="Coldest temperature of the month",
        units="°C",
        definition="The lowest air temperature reached in each month.",
        source="NASA POWER (MERRA-2)",
    ),
    "TS": Variable(
        code="TS",
        label="Ground surface temperature",
        units="°C",
        definition="How warm the surface of the ground itself is.",
        source="NASA POWER (MERRA-2)",
    ),
    "RH2M": Variable(
        code="RH2M",
        label="Humidity",
        units="% RH",
        definition="How much water vapor the air holds, compared with the most it could hold.",
        source="NASA POWER (MERRA-2)",
        caveat=MODEL_CAVEAT,
    ),
    "WS2M": Variable(
        code="WS2M",
        label="Wind speed",
        units="m/s",
        definition="How fast the air moves 2 meters above the ground.",
        source="NASA POWER (MERRA-2)",
        caveat=MODEL_CAVEAT,
    ),
    "NO2": Variable(
        code="NO2",
        label="Nitrogen dioxide",
        units="\u00b5mol/m\u00b2",
        definition="Nitrogen dioxide in the air column, a marker of traffic and industry.",
        source="Sentinel-5P TROPOMI (satellite)",
        static_file="no2_manila.json",
        scale=1e6,  # mol/m^2 -> umol/m^2
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
        }
        for v in VARIABLES.values()
    ]
