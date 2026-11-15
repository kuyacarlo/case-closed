"""ASGI middleware that keeps browsers from reusing cached page HTML."""
from __future__ import annotations


class FreshHtml:
    """Serve page HTML uncached, so it always names the current script file.

    The HTML's ETag stayed the same across two deploys, the server answered
    304, and a returning browser kept HTML that asked for a deleted script.
    """

    STATIC = ("/api/", "/assets/", "/data/", "/photos/")
    CONDITIONAL = (b"if-none-match", b"if-modified-since")
    VALIDATORS = (b"etag", b"last-modified", b"cache-control")

    def __init__(self, inner):
        self.inner = inner

    async def __call__(self, scope, receive, send):
        if scope["type"] != "http" or scope["path"].startswith(self.STATIC):
            await self.inner(scope, receive, send)
            return
        scope = dict(scope)
        scope["headers"] = [h for h in scope["headers"] if h[0].lower() not in self.CONDITIONAL]

        async def send_fresh(message):
            if message["type"] == "http.response.start":
                headers = list(message.get("headers", []))
                is_html = any(
                    k.lower() == b"content-type" and v.startswith(b"text/html") for k, v in headers
                )
                if is_html:
                    headers = [h for h in headers if h[0].lower() not in self.VALIDATORS]
                    headers.append((b"cache-control", b"no-store"))
                    message = {**message, "headers": headers}
            await send(message)

        await self.inner(scope, receive, send_fresh)
