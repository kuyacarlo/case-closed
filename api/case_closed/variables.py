"""Variable catalog: POWER parameter codes, labels, units, plain definitions.

Item 6 of the MVP. Starts with air temperature and rainfall. Each definition
is one plain sentence aimed at a high-school student.
"""
from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class Variable:
    code: str  # POWER parameter code
    label: str
    units: str
    definition: str
    source: str


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
