import re
from typing import List

from .database import db

async def get_banned_words():
    doc = await db.chat_settings.find_one({"key": "banned_words"})
    if not doc:
        return []
    return doc.get("words", [])

def censor_message(text: str, banned_words: List[str]) -> str:
    """Replace each banned word (whole-word, case-insensitive) with asterisks matching its length."""
    if not banned_words:
        return text
    for word in banned_words:
        word = word.strip()
        if not word:
            continue
        pattern = re.compile(r'\b' + re.escape(word) + r'\b', re.IGNORECASE)
        text = pattern.sub(lambda m: '*' * len(m.group(0)), text)
    return text

async def _get_chat_maintenance(project_slug: str) -> dict:
    project = await db.projects.find_one({"slug": project_slug}, {"chat_global_enabled": 1, "chat_guilds_enabled": 1})
    if not project:
        return {"chat_global_enabled": True, "chat_guilds_enabled": True}
    return {
        "chat_global_enabled": project.get("chat_global_enabled", True),
        "chat_guilds_enabled": project.get("chat_guilds_enabled", True),
    }
