import os
import secrets
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
