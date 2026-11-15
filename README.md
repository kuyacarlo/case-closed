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

When a trend isn't significant yet, it estimates how long a record it would
take to call it.

**Metro Manila air temperature, 1981–2024:** Rising **0.14 °C per decade,
significant (p = 0.002)**. The naive test reports p ≈ 1e-10 — wildly
overconfident. Accounting for the 0.52 lag-1 autocorrelation shrinks 528 months
to an effective 169, and the honest p-value lands at 0.002. Still a real trend,
but the honest number is the one you can defend.

## Three cases

| Case | Question | Source | Verdict |
| --- | --- | --- | --- |
| **Air temperature** | Is Metro Manila getting hotter? | NASA POWER (model-based) | Rising, confirmed |
| **Nitrogen dioxide** | Did Manila's air get cleaner? | Sentinel-5P TROPOMI (satellite) | Not enough evidence yet |
| **Your choice** | Any Philippine city, temperature or rainfall | NASA POWER | live |

The NO₂ case is honest in a different way: seven years of satellite data (2018–)
is too short to confirm a trend, so the verdict is "not yet, about 70 years of
record needed" — and the tool says so instead of pretending.

## How a verdict is built

On a monthly series:

1. Require at least 120 months (warn below that).
2. **Anomalies** — subtract each calendar month's mean to strip the seasons.
3. **Rate** — Sen's slope on the anomalies, per decade.
4. **Naive p-value** — plain Mann-Kendall.
5. **Honest p-value** — Hamed-Rao modified Mann-Kendall.
6. **Least-squares slope** with a 95% interval using the effective sample size
   `n_eff = n · (1 − r1) / (1 + r1)`, `r1` = lag-1 autocorrelation of residuals.
7. **Years needed** (Weatherhead et al. 1998) when the trend isn't significant.

Verdict is `confirmed` when the honest p-value < 0.05, otherwise `not_yet`.

## Data sources

- **NASA POWER** — monthly point queries, no login. Built on MERRA-2 and CERES,
  so values are labelled **model-based** in the UI. Air temperature and rainfall.
- **Sentinel-5P TROPOMI** — tropospheric NO₂, exported offline from Google Earth
  Engine into `data/` and served through the same API. The app never calls Earth
  Engine; `tools/gee/export_no2.py` produces the JSON.

Demo responses are cached under `data/` and served if a live call fails, so the
walkthrough works even offline.

## Architecture

```
api/        FastAPI: POWER client, stats, static-case loader, /api/case, tests
web/        Vite + React + TypeScript: three screens (Case, Evidence, Verdict)
data/       cached POWER demos + the exported NO2 series
tools/gee/  offline Earth Engine exporter (not part of the deployed app)
app.py      Vercel entrypoint: serves the API and the built SPA, same origin
```

Deployed to **Vercel** (one project, FastAPI + SPA on the same origin) via
**GitHub Actions** on every push to `main`.

## Run it locally

Backend (Python, [uv](https://docs.astral.sh/uv/)):

```
cd api
uv sync --extra dev
uv run pytest -q                      # 30 tests
uv run uvicorn case_closed.app:app --port 8000
```

Frontend ([pnpm](https://pnpm.io/)):

```
cd web
pnpm install
pnpm dev                              # http://localhost:5173
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

## Attribution

- **NASA POWER Project** (Prediction Of Worldwide Energy Resources), built on
  MERRA-2 and CERES — <https://power.larc.nasa.gov>
- **Copernicus Sentinel-5P / TROPOMI** NO₂, accessed via Google Earth Engine.

Not endorsed by or affiliated with NASA or ESA; no NASA logos or branding are
used.

## License

Fonts (Space Grotesk, Inter, JetBrains Mono) under the SIL Open Font License 1.1.
