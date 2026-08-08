"""
One-off script — creates a real, playable Snake game as a Studio App,
built entirely from the App Builder's own Designer components and Blockly
logic (no special-cased app type, no shortcuts), to show the App Builder
can genuinely build a game, not just forms/lists.

Run once, on the server, in the backend's own venv (needs the same Mongo
connection the live API uses — see backend/app/database.py):

    cd /opt/vakargames/backend
    source venv/bin/activate   # or however this venv is activated here
    python3 -m scripts.create_snake_showcase_app --owner-email you@example.com

Creates the app as a DRAFT, private, owned by the given account — it does
NOT auto-publish. Open it in the App Builder afterwards to review/test
(steps come from a real Android step sensor only inside a built app, but
Snake here doesn't touch that — it's pure Designer components + Blockly),
then Submit Version / approve / publish it yourself like any other app.

The game logic (movement, wall/self collision, food, growth, score) is
pre-built, verified Blockly workspace JSON — see snake_blocks.json,
generated and round-trip/execution-tested against the actual pinned
Blockly version before being embedded here (see the chat session this
shipped in for the full verification transcript). This script only
assembles the surrounding app: screens, component layout/props, variables.
"""
import argparse
import asyncio
import json
import re
import sys
from datetime import datetime, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from bson import ObjectId  # noqa: E402
from app.database import db  # noqa: E402

BLOCKS_PATH = Path(__file__).resolve().parent / "snake_blocks.json"

SLUG_RE = re.compile(r"[^a-z0-9]+")


def slugify(name: str) -> str:
    s = SLUG_RE.sub("-", name.lower()).strip("-")
    return s or "app"


async def unique_slug(base_slug: str) -> str:
    slug = base_slug
    n = 1
    while True:
        if not await db.studio_apps.find_one({"slug": slug}):
            return slug
        n += 1
        slug = f"{base_slug}-{n}"


def _gen_public_id() -> str:
    import secrets
    import string
    alphabet = string.ascii_lowercase + string.digits
    return "".join(secrets.choice(alphabet) for _ in range(8))


async def unique_public_id() -> str:
    while True:
        pid = _gen_public_id()
        if not await db.studio_apps.find_one({"public_id": pid}):
            return pid


def build_screens(blocks: dict) -> list:
    # 360x640 reference canvas — same coordinate system as every other App
    # Builder screen. 8x8 emoji grid at 40px/cell (320x320) leaves plenty
    # of room below for a D-pad + Restart, no scrolling needed.
    return [{
        "id": "game",
        "name": "Game",
        # Both "when this screen opens" (initial state + first draw) and
        # "every 200ms while this screen is open" (the actual game loop —
        # see the new ab_when_timer hat) live in this ONE workspace, same
        # as any element that has more than one hat.
        "blocks": {"v": 2, "blockly": blocks["game"]},
        "components": [
            {"id": "appbar", "type": "appbar", "layout": {"x": 0, "y": 0, "w": 360, "h": 56, "anchors": {"left": 0, "right": 0, "top": 0}},
             "props": {"title": "🐍 Snake", "show_back": False}},
            {"id": "score", "type": "text", "layout": {"x": 20, "y": 64, "w": 200, "h": 24},
             "props": {"content": "Score: {{score}}", "size": "md", "weight": "bold", "align": "left", "color": ""}},
            {"id": "gameover-msg", "type": "text", "layout": {"x": 200, "y": 64, "w": 140, "h": 24},
             "visible_if": {"variable": "gameOver", "op": "eq", "value": "true"},
             "props": {"content": "GAME OVER", "size": "md", "weight": "bold", "align": "right", "color": "#EB5757"}},
            {"id": "board", "type": "text", "layout": {"x": 20, "y": 96, "w": 320, "h": 320},
             "props": {"content": "{{board}}", "size": "custom", "size_px": 32, "weight": "normal", "align": "left", "color": ""}},
            {"id": "up", "type": "button", "layout": {"x": 152, "y": 432, "w": 56, "h": 44},
             "blocks": {"v": 2, "blockly": blocks["up"]},
             "props": {"label": "▲", "style": "secondary"}},
            {"id": "left", "type": "button", "layout": {"x": 88, "y": 480, "w": 56, "h": 44},
             "blocks": {"v": 2, "blockly": blocks["left"]},
             "props": {"label": "◀", "style": "secondary"}},
            {"id": "right", "type": "button", "layout": {"x": 216, "y": 480, "w": 56, "h": 44},
             "blocks": {"v": 2, "blockly": blocks["right"]},
             "props": {"label": "▶", "style": "secondary"}},
            {"id": "down", "type": "button", "layout": {"x": 152, "y": 528, "w": 56, "h": 44},
             "blocks": {"v": 2, "blockly": blocks["down"]},
             "props": {"label": "▼", "style": "secondary"}},
            {"id": "restart", "type": "button", "layout": {"x": 20, "y": 584, "w": 320, "h": 40},
             "blocks": {"v": 2, "blockly": blocks["restart"]},
             "props": {"label": "Restart", "style": "outline"}},
        ],
    }]


def build_variables() -> list:
    # snakeXs/snakeYs are parallel arrays (index i = one segment's x,y),
    # head at index 0 — see the tick logic. foodXs/foodYs are always a
    # single-element array, same shape, so one render_grid call can mark
    # both "layers" the same way. headX/headY/newHeadX/newHeadY/i/collided
    # are pure scratch space for the tick's own working state.
    defaults = {
        "snakeXs": "[4,4,4]", "snakeYs": "[3,4,5]",
        "dirX": "0", "dirY": "-1",
        "foodXs": "[6]", "foodYs": "[6]",
        "score": "0", "gameOver": "false", "board": "",
        "headX": "0", "headY": "0", "newHeadX": "0", "newHeadY": "0",
        "i": "0", "collided": "false",
    }
    return [{"name": k, "initial_value": v} for k, v in defaults.items()]


async def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--owner-email", required=True, help="Existing user account to own this app (find it in My Apps afterwards)")
    parser.add_argument("--name", default="Snake", help="App name (default: Snake)")
    args = parser.parse_args()

    owner = await db.users.find_one({"email": args.owner_email.lower().strip()})
    if not owner:
        print(f"No user found with email '{args.owner_email}'.", file=sys.stderr)
        sys.exit(1)

    blocks = json.loads(BLOCKS_PATH.read_text())

    name = args.name.strip()[:80] or "Snake"
    slug = await unique_slug(slugify(name))
    now = datetime.now(timezone.utc)

    doc = {
        "name": name,
        "slug": slug,
        "public_id": await unique_public_id(),
        "description": "A real Snake game — built entirely with Designer components and Blockly logic, no shortcuts. Use the arrows to move, eat the food to grow, avoid the walls and your own tail.",
        "accent_color": "#4ECDC4",
        "theme": "midnight",
        "visibility": "private",
        "status": "draft",
        "screens": build_screens(blocks),
        "variables": build_variables(),
        "created_at": now,
        "updated_at": now,
        "created_by": owner.get("username") or owner.get("email"),
        "user_id": ObjectId(owner["_id"]),
    }

    result = await db.studio_apps.insert_one(doc)
    print(f"Created '{name}' — id={result.inserted_id} slug={slug}")
    print("It's a private draft — open it in the App Builder (My Apps) to review, then Submit Version / approve / publish yourself.")


if __name__ == "__main__":
    asyncio.run(main())
