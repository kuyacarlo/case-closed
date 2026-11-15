"""Variable catalog: codes, labels, units, plain definitions and sources.

Each definition is one plain sentence aimed at a high-school student, and
``why_it_matters`` says why a data detective might investigate it. ``theme``
groups variables for the "What do you want to investigate?" step.

POWER semantics checked against the live API (2026-11-15): monthly T2M_MAX
and T2M_MIN are the single hottest / coolest reading of the month (they match
the max / min of POWER's daily values), not averages of daily highs / lows.
"""
from __future__ import annotations

from dataclasses import dataclass

MERRA2 = "NASA POWER · MERRA-2 reanalysis (model-based)"
CERES = "NASA POWER · CERES SYN1deg satellite data (2001 onward)"

# MERRA-2's moisture fields (rainfall, evaporation, soil moisture, humidity)
# shift together in 1999 across the Philippines; the overview's data-break
# detector flags rainfall, evaporation and soil moisture, and humidity jumps
# the same year. We analyse them from 2000.
MOISTURE_NOTE = (
    "{label} is analysed from 2000. In 1999 the moisture data (rainfall, evaporation, "
    "soil moisture, humidity) jump together across the whole country, which points to a "
    "change in the data, not the weather."
)
# POWER splices sunlight and cloud from GEWEX SRB (to 2000) and CERES SYN1deg
# (from 2001); its own metadata lists both sources. Use one product only.
CERES_NOTE = (
    "{label} uses 2001 onward. Before that, NASA POWER fills in from an older satellite "
    "product (GEWEX SRB), and joining two products can create a fake trend."
)


@dataclass(frozen=True)
class Variable:
    code: str  # POWER parameter code (or static variable code)
    label: str
    units: str
    definition: str
    source: str
    theme: str = "heat"  # heat | water | land | sky | air
    why_it_matters: str = ""
    # Static variables are served from a bundled JSON file instead of POWER.
    static_file: str | None = None
    # Multiply raw values by this for display (e.g. mol/m^2 -> umol/m^2).
    scale: float = 1.0
    # Plain place name for a static variable's only location (used in errors).
    static_place: str | None = None
    # Plain words for an upward / downward change in the verdict headline.
    up_word: str = "Rising"
    down_word: str = "Falling"
    # Decimal places used when showing values and rates.
    digits: int = 2
    # Earliest year this variable may be analysed from, and why (shown to users).
    first_year: int = 1981
    first_year_note: str | None = None


VARIABLES: dict[str, Variable] = {
    "T2M": Variable(
        code="T2M",
        label="Air temperature",
        units="°C",
        definition="How warm the air is 2 meters above the ground, averaged over the month.",
        source=MERRA2,
        theme="heat",
        why_it_matters="The most direct sign of a warming climate.",
        up_word="Getting warmer",
        down_word="Getting cooler",
    ),
    "T2M_MAX": Variable(
        code="T2M_MAX",
        label="Hottest temperature of the month",
        units="°C",
        definition="The single highest air temperature reached during each month.",
        source=MERRA2,
        theme="heat",
        why_it_matters="Heat extremes matter for health, work outdoors and power demand.",
        up_word="Hottest days getting hotter",
        down_word="Hottest days getting cooler",
    ),
    "T2M_MIN": Variable(
        code="T2M_MIN",
        label="Coolest temperature of the month",
        units="°C",
        definition="The single lowest air temperature reached during each month, usually at night.",
        source=MERRA2,
        theme="heat",
        why_it_matters="Warmer nights give people, animals and crops less chance to cool down.",
        up_word="Coolest nights getting warmer",
        down_word="Coolest nights getting cooler",
    ),
    "PRECTOTCORR": Variable(
        code="PRECTOTCORR",
        label="Rainfall",
        units="mm/day",
        definition="How much rain falls, averaged over each day of the month.",
        source="NASA POWER · MERRA-2 reanalysis, bias-corrected (model-based)",
        theme="water",
        why_it_matters="Drives floods, droughts, water supply and harvests.",
        up_word="Getting wetter",
        down_word="Getting drier",
        # Across all ~180 PH land cells the POWER rainfall record jumps by
        # about 50% in 1999 at once (national mean ~4.5 -> ~6.9 mm/day) and
        # stays there: the signature of a change in how the data was made,
        # not of climate. See tools/build_ph_overview.py and the methods page.
        first_year=2000,
        first_year_note=(
            "Rainfall is analysed from 2000. In 1999 the record jumps by about 50% across "
            "the whole country at once, which points to a change in the data, not the weather."
        ),
    ),
    "EVLAND": Variable(
        code="EVLAND",
        label="Evaporation from land",
        units="mm/day",
        definition="How much water rises into the air from soil and plants, per day.",
        source=MERRA2,
        theme="water",
        why_it_matters="More evaporation dries soils faster, even when rainfall stays the same.",
        up_word="More evaporation",
        down_word="Less evaporation",
        first_year=2000,
        first_year_note=MOISTURE_NOTE.format(label="Evaporation"),
    ),
    "GWETROOT": Variable(
        code="GWETROOT",
        label="Soil moisture (root zone)",
        units="%",
        definition="How wet the soil is down where plant roots grow, from 0% (bone dry) to 100% (soaked).",
        source=MERRA2,
        theme="land",
        why_it_matters="Crops and forests depend on it; drying soil is an early drought warning.",
        scale=100.0,  # POWER reports a 0-1 fraction
        up_word="Soil getting wetter",
        down_word="Soil getting drier",
        digits=1,
        first_year=2000,
        first_year_note=MOISTURE_NOTE.format(label="Soil moisture"),
    ),
    "RH2M": Variable(
        code="RH2M",
        label="Relative humidity",
        units="%",
        definition="How close the air is to being saturated with water vapour, 2 meters above the ground.",
        source=MERRA2,
        theme="air",
        why_it_matters="Humidity changes how hot it feels and how fast things dry.",
        up_word="More humid",
        down_word="Less humid",
        digits=1,
        first_year=2000,
        first_year_note=MOISTURE_NOTE.format(label="Humidity"),
    ),
    "WS2M": Variable(
        code="WS2M",
        label="Wind speed",
        units="m/s",
        definition="The average wind speed 2 meters above the ground.",
        source=MERRA2,
        theme="air",
        why_it_matters="Affects cooling, evaporation, and wind power.",
        up_word="Windier",
        down_word="Calmer",
    ),
    "ALLSKY_SFC_SW_DWN": Variable(
        code="ALLSKY_SFC_SW_DWN",
        label="Sunlight reaching the ground",
        units="MJ/m²/day",
        definition="How much energy from the Sun reaches the ground each day, after clouds and haze.",
        source=CERES,
        theme="sky",
        why_it_matters="Sets how much power solar panels make and how fast crops grow.",
        up_word="Sunnier",
        down_word="Dimmer",
        first_year=2001,
        first_year_note=CERES_NOTE.format(label="Sunlight"),
    ),
    "CLOUD_AMT": Variable(
        code="CLOUD_AMT",
        label="Cloud cover",
        units="%",
        definition="The share of the sky covered by cloud, averaged over the month.",
        source=CERES,
        theme="sky",
        why_it_matters="Clouds shade the ground by day and trap heat at night.",
        up_word="Cloudier",
        down_word="Clearer skies",
        digits=1,
        first_year=2001,
        first_year_note=CERES_NOTE.format(label="Cloud cover"),
    ),
    "NO2": Variable(
        code="NO2",
        label="Nitrogen dioxide",
        units="µmol/m²",
        definition="Nitrogen dioxide in the air column, a marker of traffic and industry.",
        source="Sentinel-5P TROPOMI satellite (ESA/Copernicus), via Google Earth Engine",
        theme="air",
        why_it_matters="A pollutant from vehicles and industry; it harms lungs.",
        static_file="no2_manila.json",
        scale=1e6,  # mol/m^2 -> umol/m^2
        static_place="Metro Manila",
        digits=1,
    ),
}

# Variables computed for every PH square (the national overview).
OVERVIEW_CODES = [c for c, v in VARIABLES.items() if not v.static_file]

THEMES = {
    "heat": "Heat",
    "water": "Rain & water",
    "land": "Land & farming",
    "sky": "Sun & sky",
    "air": "Air",
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
            "theme": v.theme,
            "why_it_matters": v.why_it_matters,
            "digits": v.digits,
            "static_place": v.static_place,
            "first_year": v.first_year,
            "first_year_note": v.first_year_note,
        }
        for v in VARIABLES.values()
    ]
