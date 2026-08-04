# Thin entrypoint — kept so the existing systemd unit / local dev command
# (`uvicorn server:app`) keeps working unchanged. All real application code
# lives in the `app/` package (see app/main.py for the FastAPI instance,
# app/routers/ for the per-domain route modules).
from app.main import app

__all__ = ["app"]
