import sys
from pathlib import Path

this_file = Path(__file__).resolve()
parent_dir = this_file.parent.parent
backend_dir = parent_dir / "backend" if (parent_dir / "backend").exists() else parent_dir

for p in (str(backend_dir), str(parent_dir), str(this_file.parent)):
    if p not in sys.path:
        sys.path.insert(0, p)

try:
    from app.main import app
except Exception:
    try:
        from server import app
    except Exception:
        from backend.app.main import app

application = app
handler = app
__all__ = ["app", "application", "handler"]
