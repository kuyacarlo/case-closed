# Case Closed

**Earth System Trend Detective** — a web tool that lets a student pick an Earth
science variable and a place, see the monthly time series, and get a verdict:
is it changing, how fast, and is the trend statistically significant?

Built for the NASA Space Apps 2026 challenge *"Be An Earth System Trend
Detective!"*. Audience: high school and college students, Philippines first.

**Live:** <https://case-closed-ivory.vercel.app>

## What makes it different

Most tools stop at "the line goes up." Case Closed is honest about confidence.
It shows the naive p-value (plain Mann-Kendall) next to the
autocorrelation-corrected one (Hamed-Rao modified Mann-Kendall), and when a
trend is not yet significant it estimates how many more years of data it would
take to call it.

The verdict for Metro Manila air temperature (1981–2024), straight from the
data: **Rising 0.14 °C per decade, significant (p = 0.002).** The naive test
reports p ≈ 1e-10; the honest test, accounting for the 0.52 lag-1
autocorrelation that shrinks 528 months to an effective 169, reports p ≈ 0.002.

## The method

Run in order on a monthly series:

1. Require at least 120 months (warn below that).
2. **Anomalies** — subtract each calendar month's mean.
3. **Rate** — Sen's slope on the anomalies, per decade.
4. **Naive p-value** — plain Mann-Kendall.
5. **Honest p-value** — Hamed-Rao modified Mann-Kendall.
6. **Least-squares slope** with a 95% interval using the effective sample size
   `n_eff = n · (1 − r1) / (1 + r1)`, where `r1` is the lag-1 autocorrelation of
   the residuals.
7. **Years needed** (Weatherhead et al. 1998) when the trend is not yet
   significant.

Verdict: `confirmed` when the honest p-value < 0.05, otherwise `not_yet`.

## Data

NASA POWER monthly point queries only, no login. POWER is built on MERRA-2 and
CERES, so values are labelled **model-based** in the UI. Demo-case responses are
cached under `data/` and served when a live call fails.

## Layout

```
api/   FastAPI app, stats, POWER client, tests
web/   Vite + React + TypeScript app (three screens)
data/  cached JSON for demo cases
```

## Run it

**Backend** (Python, uv):

```
cd api
uv sync --extra dev
uv run pytest -q                                  # 27 tests
uv run uvicorn case_closed.app:app --port 8000
```

**Frontend** (pnpm):

```
cd web
pnpm install
pnpm dev                                          # http://localhost:5173
```

The frontend reads `VITE_API_BASE` (default `http://localhost:8000`). If the API
is unreachable it falls back to a saved Metro Manila demo case so the
walkthrough still works.

## API

One endpoint returns everything a screen needs:

```
GET /api/case?lat=&lon=&variable=&start=&end=
GET /api/variables
GET /api/health
```

## AI disclosure

Per the NASA Space Apps rules on acknowledging AI-generated code: **the entire
codebase in this repository was written by an AI coding agent (Kiro)**, directed
and reviewed by the team. This covers the FastAPI backend (POWER client,
statistics module, API endpoint), the React frontend (all three screens,
charts, and state), the tests, and this README. The statistical method,
design specification, and scope were defined by the team; the agent implemented
them. Results were validated against real NASA POWER data for Metro Manila.

## Attribution

Data courtesy of the **NASA POWER Project** (Prediction Of Worldwide Energy
Resources), built on **MERRA-2** and **CERES**. See
<https://power.larc.nasa.gov>. This project is not endorsed by or affiliated
with NASA, and uses no NASA logos or branding.

## License

Fonts (Space Grotesk, Inter, JetBrains Mono) are used under the SIL Open Font
License 1.1.
