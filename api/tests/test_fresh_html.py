"""Page HTML must never come back as 304, or a redeploy leaves browsers on a deleted script."""
from fastapi import FastAPI
from fastapi.responses import FileResponse
from fastapi.testclient import TestClient

from case_closed.fresh_html import FreshHtml


def test_html_is_never_revalidated(tmp_path):
    page = tmp_path / "index.html"
    page.write_text("<!doctype html><script src='/assets/index-abc.js'></script>")
    plain = FastAPI()
    plain.add_api_route("/", lambda: FileResponse(page), methods=["GET"])
    etag = TestClient(plain).get("/").headers["etag"]

    site = FastAPI()
    site.add_api_route("/", lambda: FileResponse(page), methods=["GET"])
    site.add_api_route("/api/ping", lambda: {"ok": True}, methods=["GET"])
    site.add_middleware(FreshHtml)
    client = TestClient(site)
    fresh = client.get("/", headers={"If-None-Match": etag})
    assert fresh.status_code == 200
    assert fresh.headers["cache-control"] == "no-store"
    assert "etag" not in fresh.headers
    assert "index-abc.js" in fresh.text
    assert client.get("/api/ping").json() == {"ok": True}
