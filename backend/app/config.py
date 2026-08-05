import os
import secrets
import hashlib
import base64
from pathlib import Path
from dotenv import load_dotenv

VERSION = "1.3.0"

ROOT_DIR = Path(__file__).parent.parent
load_dotenv(ROOT_DIR / '.env')

MONGO_URL = os.environ['MONGO_URL']
DB_NAME = os.environ['DB_NAME']

_jwt_secret_env = os.environ.get('JWT_SECRET', '')
JWT_SECRET = _jwt_secret_env if _jwt_secret_env else secrets.token_urlsafe(64)
_JWT_EPHEMERAL = not bool(_jwt_secret_env)  # True = no env var set → tokens die on restart
JWT_ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_HOURS = 24

# Initial setup key — only works ONCE to bootstrap the Super Admin
SETUP_KEY = os.environ.get('MASTER_KEY', '')

# Super admin credentials from environment (never hardcode in source)
SUPER_ADMIN_EMAIL    = os.environ.get('SUPER_ADMIN_EMAIL', '')
SUPER_ADMIN_PASSWORD = os.environ.get('SUPER_ADMIN_PASSWORD', '')

UPLOADS_DIR = ROOT_DIR / "uploads"
UPLOADS_DIR.mkdir(exist_ok=True)

GAME_FILES_DIR = ROOT_DIR / "uploads" / "game_files"
GAME_FILES_DIR.mkdir(exist_ok=True, parents=True)

STRIPE_SECRET_KEY = os.environ.get('STRIPE_SECRET_KEY', '')
STRIPE_WEBHOOK_SECRET = os.environ.get('STRIPE_WEBHOOK_SECRET', '')

def _price_cents_env(name: str, default: str) -> int:
    raw = os.environ.get(name, '') or default
    try:
        return int(raw)
    except ValueError:
        return 0

# Vakar+ subscription pricing — priced inline at checkout (Stripe
# `price_data` with `recurring` set) rather than referencing a pre-created
# Stripe Price ID, so subscriptions work with only the base Stripe API keys
# configured, no separate "create a Product + Price in the Dashboard" step.
# Owner-confirmed monthly price is $7.99; overridable via env without a code
# change. Yearly is 0 (not offered) until a price is set — both pricing.py's
# public endpoint and checkout gracefully treat 0 as "not available yet",
# same UX as the old Price-ID-missing case.
VAKAR_PLUS_MONTHLY_PRICE_CENTS = _price_cents_env('VAKAR_PLUS_MONTHLY_PRICE_CENTS', '799')
VAKAR_PLUS_YEARLY_PRICE_CENTS = _price_cents_env('VAKAR_PLUS_YEARLY_PRICE_CENTS', '0')

# This server's own publicly-reachable base URL (e.g. https://api.vakargames.com
# or https://www.vakargames.com/api, whatever nginx actually exposes) — distinct
# from FRONTEND_URL above. Needed so an external GitHub Actions runner can fetch
# an app's exported bundle and POST the finished APK back to this backend.
BACKEND_PUBLIC_URL = os.environ.get('BACKEND_PUBLIC_URL', '')

# APK export (Phase E) — triggers a GitHub Actions workflow in this repo to build
# a debug APK via Capacitor, entirely off the production VPS. Requires a GitHub
# Personal Access Token with `actions:write` (classic PAT: `repo` scope) on the
# repo below. Left blank until configured — the trigger endpoint fails closed
# (503) rather than erroring confusingly deep in a GitHub API call.
GITHUB_PAT = os.environ.get('GITHUB_PAT', '')
GITHUB_REPO = os.environ.get('GITHUB_REPO', 'FodersGames/vkgmsweb')
GITHUB_WORKFLOW_FILE = os.environ.get('GITHUB_WORKFLOW_FILE', 'build-apk.yml')
GITHUB_WORKFLOW_REF = os.environ.get('GITHUB_WORKFLOW_REF', 'version_006')

# .vakarstudio export/import (Studio App Builder) — the file is Fernet-encrypted
# so it's opaque to anyone but this backend; the key is deterministically
# derived from JWT_SECRET (SHA-256, urlsafe-base64) rather than a brand-new env
# var, so it stays STABLE across restarts whenever JWT_SECRET is actually set
# (same requirement production already has for sessions to survive a restart) —
# a fresh random key every boot would make previously-exported files
# permanently undecryptable, which JWT ephemerality never risked (a logged-out
# user just logs back in; a corrupted export file is unrecoverable data loss).
VAKARSTUDIO_FILE_KEY = base64.urlsafe_b64encode(hashlib.sha256(f"vakarstudio-file-v1:{JWT_SECRET}".encode()).digest())
