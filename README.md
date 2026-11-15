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

When a trend isn't significant yet, it estimates how many more years of data it
would take to call it.

**Metro Manila air temperature, 1981–2024:** Rising **0.14 °C per decade,
significant (p = 0.002)**. The naive test reports p ≈ 1e-10 — wildly
overconfident. Accounting for the 0.52 lag-1 autocorrelation shrinks 528 months
to an effective 169, and the honest p-value lands at 0.002. Still a real trend,
but the honest number is the one you can defend.

## Every place in the Philippines

Search any of 1,751 regions, provinces, cities and municipalities, or tap the
map. Each place snaps to its **NASA POWER grid square** (MERRA-2, 0.5° × 0.625°,
about 55 km across), and the app says which other towns share that square.

The home map shows a **national overview**: the trend in every one of the 180
squares that cover Philippine land, precomputed with exactly the same code the
API uses, so the map and a case page always agree. Because 180 squares are
tested at once, the legend also reports how many trends survive a
Benjamini-Hochberg correction for multiple testing.

| Featured case | Question | Source | What it shows |
| --- | --- | --- | --- |
| **Air temperature** | Is Metro Manila getting hotter? | NASA POWER (model-based) | Clear trend, +0.14 °C/decade since 1981 |
| **A faulty witness** | Why does rainfall start in 2000? | NASA POWER (model-based) | A nationwide 1999 jump in the data, caught and excluded |
| **Nitrogen dioxide** | Did Manila's air get cleaner? | Sentinel-5P TROPOMI (ESA) | Too short to call: 7 years of data |

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
| Daytime air temperature | Aqua AIRS AIRS3STM v7 | 2003–2025 |

**From [NASA POWER](https://power.larc.nasa.gov/)** (monthly point API, no login):
MERRA-2 reanalysis temperature (average, monthly hottest and coolest), rainfall,
evaporation, root-zone soil wetness, humidity and wind; CERES SYN1deg sunlight
and cloud. These are labelled **model-based** (MERRA-2) in the UI.

Where two sources measure the same thing (e.g. MERRA-2 vs GPM rainfall, MERRA-2
vs AIRS temperature), the Evidence page calls the second one as a **witness**.

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
```

Deployed to **Vercel** (one project, FastAPI + SPA on the same origin) via
**GitHub Actions** on every push to `main`.

## Run it locally

Backend (Python, [uv](https://docs.astral.sh/uv/)):

```
cd api
uv sync --extra dev
uv run pytest -q                      # 49 tests
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

Not endorsed by or affiliated with NASA or ESA; no NASA logos or branding are
used.

## License

Fonts (Space Grotesk, Inter, JetBrains Mono) under the SIL Open Font License 1.1.
