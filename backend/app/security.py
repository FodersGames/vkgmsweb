from fastapi import Request
from starlette.middleware.base import BaseHTTPMiddleware


# ── Security headers middleware ──────────────────────────────────────────────
class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        response = await call_next(request)
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-XSS-Protection"] = "1; mode=block"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        response.headers["Permissions-Policy"] = "camera=(), microphone=(), geolocation=()"
        # CSP: allow Stripe, Google Fonts, and same-origin resources
        response.headers["Content-Security-Policy"] = (
            "default-src 'self'; "
            "script-src 'self' 'unsafe-inline' https://js.stripe.com; "
            "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; "
            "font-src 'self' https://fonts.gstatic.com; "
            "img-src 'self' data: blob: https:; "
            "connect-src 'self' https://api.stripe.com; "
            "frame-src https://js.stripe.com https://hooks.stripe.com; "
            "object-src 'none'; "
            "base-uri 'self';"
        )
        return response


class PlayCORSMiddleware:
    """Pure ASGI CORS middleware for /api/play/* and /api/game/* — never buffers responses, safe for FileResponse/streaming."""
    _PREFIXES = ("/api/play/", "/api/game/")

    def __init__(self, app):
        self.app = app

    async def __call__(self, scope, receive, send):
        path = scope.get("path", "")
        if scope["type"] != "http" or not any(path.startswith(p) for p in self._PREFIXES):
            await self.app(scope, receive, send)
            return

        headers_dict = dict(scope.get("headers", []))
        origin = headers_dict.get(b"origin", b"*").decode()

        if scope.get("method") == "OPTIONS":
            await send({
                "type": "http.response.start",
                "status": 200,
                "headers": [
                    [b"access-control-allow-origin",  origin.encode()],
                    [b"access-control-allow-methods", b"GET, POST, OPTIONS"],
                    [b"access-control-allow-headers", b"Authorization, Content-Type, X-Files-Api-Key, X-Chat-Api-Key"],
                    [b"access-control-max-age",       b"86400"],
                    [b"content-length",               b"0"],
                ],
            })
            await send({"type": "http.response.body", "body": b""})
            return

        cors_pair = [b"access-control-allow-origin", origin.encode()]
        injected  = False

        async def send_with_cors(message):
            nonlocal injected
            if message["type"] == "http.response.start" and not injected:
                injected = True
                existing = [h for h in message.get("headers", [])
                            if h[0].lower() != b"access-control-allow-origin"]
                message = {**message, "headers": existing + [cors_pair, [b"vary", b"Origin"]]}
            await send(message)

        await self.app(scope, receive, send_with_cors)
