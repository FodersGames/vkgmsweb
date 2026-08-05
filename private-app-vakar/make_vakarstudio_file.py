#!/usr/bin/env python3
"""
Encrypts coin_clicker_game.json into a real, importable .vakarstudio file.

This mirrors backend/app/routers/studio_apps.py's _encrypt_vakarstudio_file
and backend/app/config.py's VAKARSTUDIO_FILE_KEY derivation EXACTLY, so the
output is only decryptable by a backend running with the same JWT_SECRET
that produced it — i.e. your real production backend. Run this with your
real JWT_SECRET (never paste it into chat) and the output will import
correctly at Dashboard > App Builder > Import (or My Apps > Import).

Usage:
    pip install cryptography
    JWT_SECRET="your-real-production-secret" python make_vakarstudio_file.py

Or on Windows PowerShell:
    $env:JWT_SECRET = "your-real-production-secret"
    python make_vakarstudio_file.py

Output: coin-clicker.vakarstudio, next to this script.
"""
import base64
import hashlib
import json
import os
import sys

try:
    from cryptography.fernet import Fernet
except ImportError:
    sys.exit("Missing dependency — run: pip install cryptography")

JWT_SECRET = os.environ.get("JWT_SECRET", "").strip()
if not JWT_SECRET:
    sys.exit(
        "JWT_SECRET is not set.\n"
        "Set it to the EXACT value your production backend uses (its .env's "
        "JWT_SECRET) before running this script — otherwise the file won't "
        "decrypt when you import it on the real site.\n\n"
        "  JWT_SECRET=\"...\" python make_vakarstudio_file.py"
    )

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
PAYLOAD_PATH = os.path.join(SCRIPT_DIR, "coin_clicker_game.json")
OUTPUT_PATH = os.path.join(SCRIPT_DIR, "coin-clicker.vakarstudio")

with open(PAYLOAD_PATH, "r", encoding="utf-8") as f:
    payload = json.load(f)

# Same key derivation as config.py's VAKARSTUDIO_FILE_KEY.
key = base64.urlsafe_b64encode(hashlib.sha256(f"vakarstudio-file-v1:{JWT_SECRET}".encode()).digest())
token = Fernet(key).encrypt(json.dumps(payload).encode())

with open(OUTPUT_PATH, "wb") as f:
    f.write(token)

print(f"Wrote {OUTPUT_PATH}")
print("Import it at Dashboard > App Builder > Import, or My Apps > Import.")
