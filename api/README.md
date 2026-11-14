# Case Closed API

FastAPI backend for the Earth System Trend Detective.

## Run

```
uv sync --extra dev
uv run uvicorn case_closed.app:app --reload --port 8000
```

## Test

```
uv run pytest -q
```

## Endpoints

- `GET /api/case?lat=&lon=&variable=&start=&end=` — full case contract.
- `GET /api/variables` — variable catalog with plain definitions.
- `GET /api/health`
