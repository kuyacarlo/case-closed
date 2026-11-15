"""Vercel entrypoint.

Reuses the existing FastAPI app from ``api/case_closed/app.py`` and serves the
built Vite frontend (``web/dist``) from the same origin, so the SPA calls
``/api/*`` without CORS. The ``api/`` package is importable because the build
installs it (see pyproject ``build`` script adding it to the path).

Vercel discovers a ``FastAPI`` instance named ``app`` at repo-root ``app.py``.
"""
from __future__ import annotations

import sys
from pathlib import Path

# Make the backend package importable (api/case_closed).
sys.path.insert(0, str(Path(__file__).resolve().parent / "api"))

from case_closed.app import app  # noqa: E402
from case_closed.fresh_html import FreshHtml  # noqa: E402

# Serve the built SPA. API routes are declared on the imported app and take
# priority; everything else falls back to index.html for client-side routing.
# ``frontend`` is provided by Vercel's FastAPI runtime; guard it so this module
# still imports under plain FastAPI (local dev, tests).
if hasattr(app, "frontend"):
    app.frontend("/", directory="web/dist", fallback="index.html")


app.add_middleware(FreshHtml)
