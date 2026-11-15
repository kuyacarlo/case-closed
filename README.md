# Case Closed

**Is your climate actually changing? Check the evidence, get a verdict you can defend.**

Case Closed is a web tool for the NASA Space Apps 2026 challenge *"Be An Earth
System Trend Detective!"*. Pick a place and an Earth-science variable, see the
monthly record from NASA data, and get a plain-language verdict: is it changing,
how fast, and how sure can we be?

Built for high-school and college students, Philippines first.

**Live:** <https://caseclosed.kuyacarlo.dev>

## The idea: be honest about confidence

Most trend tools stop at "the line goes up." The hard part is knowing whether a
line is a real signal or just noise — and climate series mislead the usual test,
because warm months follow warm months (autocorrelation). Treating each month as
independent makes a trend look far more certain than it is.

Case Closed shows both numbers side by side:

- **The naive test** (plain Mann-Kendall) — assumes every month is independent.
- **The honest test** (Hamed-Rao modified Mann-Kendall) — corrects for
  autocorrelation.

When a trend isn't significant yet, it estimates how long a record it would take
to call it.

**Metro Manila air temperature, 1981–2025:** Rising **0.14 °C per decade,
significant (p = 0.001)**. The naive test reports p ≈ 4e-12 — wildly
overconfident. Accounting for the 0.52 lag-1 autocorrelation shrinks 540 months
to an effective 172, and the honest p-value lands at 0.001. Still a real trend,
but the honest number is the one you can defend.

## The challenge's workflow, step by step

| Step | In the app |
| --- | --- |
| **1 · Variable** | Pick a theme (heat, water, land, sun & sky, air), then one of 15 variables, each with a plain definition and why it matters. "What's changing here?" ranks every variable for the chosen place. |
| **2 · Region** | Any of 1,647 towns and cities (one ~55 km NASA square), or a **region average**: 87 provinces, 17 regions, the 3 island groups or the whole Philippines, averaged over their squares and weighted by land area. Or tap the map. |
| **3 · Time period** | A start and end year (defaults to each variable's full record). Under 20 years the app refuses a significance verdict. |
| **4 · Time series** | Exhibit A (every month, with a 12-month average line), Exhibit B (seasons removed, trend line), Exhibit C (a second NASA source, when there is one), then **"Your call: does it look like a trend?"** |
| **5 · Significance** | Is there a trend, how much, is it significant (honest Mann-Kendall p, 95% range), how sure, and how your call compares. |

Two watchable demos walk through it (Manila: a significant trend; Tuguegarao,
then Cagayan Valley: a trend that only shows up clearly as a region average).

The home map shows every one of the 223 squares that touch Philippine land, coloured by
direction and rate (faded when not significant), with counts of rises and falls by
island group and a Benjamini-Hochberg multiple-testing note.

## How a verdict is built

On a monthly series:

1. **Anomalies:** subtract each calendar month's mean to strip the seasons.
2. **Rate:** Sen's slope on the anomalies, per decade.
3. **Naive p-value:** plain Mann-Kendall.
4. **Honest p-value:** Hamed-Rao modified Mann-Kendall.
5. **Least-squares slope** with a 95% interval using the effective sample size
   `n_eff = n · (1 − r1) / (1 + r1)`, `r1` = lag-1 autocorrelation of residuals.
6. **Jump check:** Pettitt test on yearly means. If the series is roughly level
   after the biggest shift, the change is "mostly a jump", not a steady trend.
7. **Years needed** (Weatherhead et al. 1998) when the trend isn't significant.

Verdict states: `too_short` under 20 years (whatever the p-value), `step` when
significant but jump-dominated, `confirmed` when the honest p-value < 0.05,
otherwise `not_yet`. The text is written for the general public; p-values are
on the "How sure are we?" panel.

## Data sources

Two families, both NASA:

**From the challenge's NASA resource list, via [Giovanni](https://giovanni.gsfc.nasa.gov/)**
(downloaded once per square by `tools/fetch_giovanni.py`; needs a free Earthdata
Login token in the git-ignored `api/.env`; the deployed app never calls Giovanni):

| Variable | Dataset | Years |
| --- | --- | --- |
| Rainfall (satellite) | GPM IMERG V07 monthly | 2001–2025 |
| Evaporation | GLDAS Noah 2.1 monthly | 2000–2025 |
| Root-zone soil water | GLDAS Noah 2.1 monthly | 2000–2025 |
| Surface runoff | GLDAS Noah 2.1 monthly | 2000–2025 |
| Nitrogen dioxide | Aura OMI OMNO2d v003 (daily → monthly) | 2005–2025 |

**From [NASA POWER](https://power.larc.nasa.gov/)** (monthly point API, no login):
MERRA-2 reanalysis temperature (average, monthly hottest and coolest), rainfall,
evaporation, root-zone soil wetness, humidity and wind; CERES SYN1deg sunlight
and cloud. These are labelled **model-based** (MERRA-2) in the UI.

Where two sources measure the same thing (e.g. MERRA-2 vs GPM rainfall, MERRA-2
vs GLDAS evaporation and soil water), the Evidence page calls the second one as a
**witness**.

**Set aside:** Aqua AIRS daytime surface air temperature was downloaded and tested,
but it showed cooling in 208 of 223 squares with a sharp 2025 drop while MERRA-2
shows 2024 as the warmest year, which points to a measurement change (Aqua's orbit
has been drifting). It is documented on the methods page and not used for verdicts.

**Data-break detector.** Across all PH squares the MERRA-2 moisture record
(rainfall, evaporation, soil moisture; humidity jumps too) shifts in 1999 at
once, the signature of a change in the data rather than the weather. The
overview builder flags this automatically; those variables are analysed from
2000. Sunlight and cloud start in 2001 because POWER joins GEWEX SRB to CERES.

Also: Sentinel-5P TROPOMI (ESA/Copernicus) NO₂ for Metro Manila only; place
names and outlines from geoBoundaries PHL (CC BY 3.0 IGO; NAMRIA, PSA, OCHA).

No silent fallbacks: if a live call fails, the app shows an error, never another
place's data.

## Architecture

```
api/        FastAPI: POWER client, grid snapping, stats, verdicts, tests
web/        Vite + React + TypeScript + Leaflet: Place (map + search),
            Evidence, Verdict, How it works
web/public/data/  ph_places.json, ph_provinces.geojson, ph_overview.json
data/       Manila POWER cache + the exported NO2 series
tools/      offline builders (not deployed):
              build_places.py      places + land squares from geoBoundaries
              build_ph_overview.py national overview (memoised POWER calls)
              gee/export_no2.py    Earth Engine NO2 exporter
app.py      Vercel entrypoint: serves the API and the built SPA, same origin
```

Rebuild the static data (raw downloads cache in git-ignored `tools/.cache/`):

```
cd api
uv run --with shapely python ../tools/build_places.py   # places + 223 land squares
uv run python ../tools/fetch_giovanni.py                 # NASA Giovanni (needs api/.env)
uv run python ../tools/build_nasa_grids.py               # -> data/nasa/*.json
uv run python ../tools/build_ph_overview.py              # -> web/public/data/overview/
uv run python ../tools/build_areas.py                    # -> data/areas/, web/public/data/areas/
```

Deployed to **Vercel** (one project, FastAPI + SPA on the same origin) via
**GitHub Actions** on every push to `main`.

## Run it locally

Backend (Python, [uv](https://docs.astral.sh/uv/)):

```
cd api
uv sync --extra dev
uv run pytest -q                      # 59 tests
uv run uvicorn case_closed.app:app --port 8000
```

Frontend ([pnpm](https://pnpm.io/)):

```
cd web
pnpm install
pnpm dev                              # http://localhost:5173 (or --port 5191)
```

The frontend reads `VITE_API_BASE` (default `http://localhost:8000`); in
production it's empty so the SPA calls `/api/*` on the same origin.

## API

```
GET /api/case?lat=&lon=&variable=&start=&end=     # everything a screen needs
GET /api/variables                                 # catalog + plain definitions
GET /api/health
```

## AI disclosure

Per the NASA Space Apps rules on acknowledging AI-generated code: **the entire
codebase in this repository was written by an AI coding agent (Kiro)**, directed
and reviewed by the team. This covers the FastAPI backend, the React frontend,
the Earth Engine exporter, the tests, the deployment pipeline, and this README.
The statistical method, design, and scope were defined by the team; the agent
implemented them. Results were validated against real NASA POWER data.

The whole-Philippines explorer, the integrity fixes (honest verdict states,
no silent fallbacks, grid snapping, the 1999 rainfall-break finding), the
place and overview builders, and the redesigned interface were written by
**Claude Code (Anthropic)**, directed and reviewed by the team.

## Attribution

- **NASA POWER Project** (Prediction Of Worldwide Energy Resources); temperature
  and rainfall from the MERRA-2 reanalysis — <https://power.larc.nasa.gov>
- **geoBoundaries** (Runfola et al.), PHL boundaries, CC BY 3.0 IGO; source data
  from NAMRIA, PSA and OCHA Philippines.
- Map tiles © **OpenStreetMap** contributors.
- **Copernicus Sentinel-5P / TROPOMI** NO₂, accessed via Google Earth Engine.
- Satellite photos in `web/public/photos/` are from **NASA Worldview** (EOSDIS
  snapshots of Suomi NPP VIIRS true colour, 18 April 2022, 24 April 2024 and
  20 August 2024) and **NASA Earth Observatory** Black Marble 2016. Each photo
  carries its credit on the page.

Not endorsed by or affiliated with NASA or ESA; no NASA logos or branding are
used.

## License

Fonts (Space Grotesk, Inter, JetBrains Mono) under the SIL Open Font License 1.1.
