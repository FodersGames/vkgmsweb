#!/usr/bin/env python3
"""
One-off pipeline: process real art assets from private-app-vakar/asset-graphique-*
into embedded data URIs, then assemble the full Coin Clicker game content
(screens/variables) and write private-app-vakar/coin_clicker_game.json.

Not shipped code — a content-authoring tool, run once.
"""
import base64
import io
import json
import os

from PIL import Image, ImageDraw, ImageFont

FONT_BOLD = r"C:\Windows\Fonts\segoeuib.ttf"

REPO = r"c:\Users\anthony\Desktop\Website FodersGames\vkgmsweb"
ASSETS = os.path.join(REPO, "private-app-vakar")
OUT_PATH = os.path.join(ASSETS, "coin_clicker_game.json")
PREVIEW_DIR = os.path.join(
    r"C:\Users\anthony\AppData\Local\Temp\claude\c--Users-anthony-Desktop-Website-FodersGames-vkgmsweb"
    r"\80b9bc70-6d4f-4c1b-ad71-91abc20b58d7\scratchpad", "preview"
)
os.makedirs(PREVIEW_DIR, exist_ok=True)


def load(rel):
    return Image.open(os.path.join(ASSETS, rel)).convert("RGBA")


def data_uri(img, fmt="PNG", quality=82):
    buf = io.BytesIO()
    if fmt == "JPEG":
        img.convert("RGB").save(buf, format="JPEG", quality=quality, optimize=True)
        mime = "image/jpeg"
    else:
        img.save(buf, format="PNG", optimize=True)
        mime = "image/png"
    b64 = base64.b64encode(buf.getvalue()).decode()
    return f"data:{mime};base64,{b64}", len(buf.getvalue())


def hex_to_rgba(h, alpha=255):
    h = h.lstrip("#")
    r, g, b = (int(h[i:i + 2], 16) for i in (0, 2, 4))
    return (r, g, b, alpha)


def make_background(rel, focus_y_frac=0.4, target_w=480, target_h=853):
    img = load(rel).convert("RGB")
    w, h = img.size
    target_ratio = target_w / target_h
    crop_h = h
    crop_w = int(crop_h * target_ratio)
    if crop_w > w:
        crop_w = w
        crop_h = int(crop_w / target_ratio)
    x0 = (w - crop_w) // 2
    y0 = max(0, min(h - crop_h, int(h * focus_y_frac - crop_h / 2)))
    cropped = img.crop((x0, y0, x0 + crop_w, y0 + crop_h))
    return cropped.resize((target_w, target_h), Image.LANCZOS)


def make_icon(rel, w):
    img = load(rel)
    ratio = w / img.width
    return img.resize((w, max(1, int(img.height * ratio))), Image.LANCZOS)


RARITY_COLORS = {
    "Common": "#8A8F98",
    "Rare": "#3E7FC1",
    "Epic": "#9B4FD1",
    "Legendary": "#E8A63B",
}


def _centered_text(draw, text, font, cx, y, fill):
    bbox = draw.textbbox((0, 0), text, font=font)
    tw = bbox[2] - bbox[0]
    draw.text((cx - tw / 2, y), text, font=font, fill=fill)


def make_card(role_icon_rel, name, rarity, w=300, h=380):
    """Self-contained trading card: rarity-colored background, class emblem,
    and the hero's name + rarity baked directly onto the image (Segoe UI
    Bold) — so the card is complete on its own, no separate text needed
    from the app builder side."""
    color = RARITY_COLORS[rarity]
    card = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    mask = Image.new("L", (w, h), 0)
    ImageDraw.Draw(mask).rounded_rectangle([0, 0, w - 1, h - 1], radius=30, fill=255)
    fill = Image.new("RGBA", (w, h), hex_to_rgba(color))
    card.paste(fill, (0, 0), mask)

    band = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    bd = ImageDraw.Draw(band)
    bd.rounded_rectangle([0, h - 96, w - 1, h - 1], radius=30, fill=(0, 0, 0, 115))
    bd.rectangle([0, h - 96, w - 1, h - 61], fill=(0, 0, 0, 115))
    card.alpha_composite(band)

    draw = ImageDraw.Draw(card)
    draw.rounded_rectangle([5, 5, w - 6, h - 6], radius=25, outline=(255, 255, 255, 150), width=4)

    icon = load(role_icon_rel)
    bbox = icon.getbbox()
    if bbox:
        icon = icon.crop(bbox)
    icon_w = int(w * 0.48)
    ratio = icon_w / icon.width
    icon_resized = icon.resize((icon_w, max(1, int(icon.height * ratio))), Image.LANCZOS)
    icon_x = (w - icon_resized.width) // 2
    icon_y = int(h * 0.26 - icon_resized.height / 2)
    shadow = Image.new("RGBA", card.size, (0, 0, 0, 0))
    shadow_layer = Image.new("RGBA", icon_resized.size, (0, 0, 0, 90))
    shadow_layer.putalpha(icon_resized.split()[-1].point(lambda a: min(a, 90)))
    shadow.alpha_composite(shadow_layer, (icon_x + 3, icon_y + 5))
    card.alpha_composite(shadow)
    card.alpha_composite(icon_resized, (icon_x, icon_y))

    draw = ImageDraw.Draw(card)
    cx = w / 2
    # Rarity pill (small rounded badge) above the name
    rarity_text = rarity.upper()
    font_rarity = ImageFont.truetype(FONT_BOLD, 15)
    r_bbox = draw.textbbox((0, 0), rarity_text, font=font_rarity)
    r_w, r_h = r_bbox[2] - r_bbox[0], r_bbox[3] - r_bbox[1]
    pill_w, pill_h = r_w + 24, r_h + 12
    pill_x0, pill_y0 = cx - pill_w / 2, h - 92
    draw.rounded_rectangle([pill_x0, pill_y0, pill_x0 + pill_w, pill_y0 + pill_h], radius=pill_h / 2, fill=hex_to_rgba(color, 255), outline=(255, 255, 255, 200), width=2)
    _centered_text(draw, rarity_text, font_rarity, cx, pill_y0 + (pill_h - r_h) / 2 - r_bbox[1], (255, 255, 255, 255))

    # Hero name, large and bold, below the pill
    font_name = ImageFont.truetype(FONT_BOLD, 28)
    n_bbox = draw.textbbox((0, 0), name, font=font_name)
    # shrink to fit if a longer name would overflow the card width
    while (n_bbox[2] - n_bbox[0]) > w - 24 and font_name.size > 16:
        font_name = ImageFont.truetype(FONT_BOLD, font_name.size - 2)
        n_bbox = draw.textbbox((0, 0), name, font=font_name)
    _centered_text(draw, name, font_name, cx, h - 50 - n_bbox[1], (255, 255, 255, 255))

    return card


def img_comp(id_, url, x, y, w, h, fit="cover", radius=0, animation="none", visible_if=None):
    c = {"id": id_, "type": "image", "actions": {},
         "layout": {"x": x, "y": y, "w": w, "h": h},
         "props": {"url": url, "radius": radius, "fit": fit, "border": False, "animation": animation}}
    if visible_if:
        c["visible_if"] = visible_if
    return c


def text_comp(id_, content, x, y, w, h, size="md", weight="normal", align="center", color="", visible_if=None, size_px=None):
    c = {"id": id_, "type": "text", "actions": {},
         "layout": {"x": x, "y": y, "w": w, "h": h},
         "props": {"content": content, "size": size, "weight": weight, "align": align, "color": color}}
    if size_px is not None:
        c["props"]["size_px"] = size_px
    if visible_if:
        c["visible_if"] = visible_if
    return c


def btn_comp(id_, label, x, y, w, h, actions, style="primary", visible_if=None):
    c = {"id": id_, "type": "button", "actions": {"onClick": actions},
         "layout": {"x": x, "y": y, "w": w, "h": h}, "props": {"label": label, "style": style, "icon": ""}}
    if visible_if:
        c["visible_if"] = visible_if
    return c


def container_comp(id_, x, y, w, h, background="surface", radius=16, opacity=100, border=False, shadow=False, children=None, visible_if=None):
    c = {"id": id_, "type": "container", "actions": {},
         "layout": {"x": x, "y": y, "w": w, "h": h},
         "props": {"background": background, "border": border, "radius": radius, "shadow": shadow, "opacity": opacity},
         "children": children or []}
    if visible_if:
        c["visible_if"] = visible_if
    return c


def chest_open_actions(cost, stage_var, rewards_var):
    return [
        {"type": "calculate", "variable": "coins", "op": "subtract", "a": "coins", "b": str(cost)},
        {"type": "set_variable", "variable": stage_var, "value_mode": "literal", "value": "open"},
        # dedupe_field/duplicate_variable: a Legend you already own turns
        # into 5 shards instead of a wasted duplicate card.
        {"type": "random_pick", "options_variable": rewards_var, "target_variable": "lastReward",
         "collection_variable": "myCards", "dedupe_field": "name", "duplicate_variable": "shards", "duplicate_amount": 5},
        {"type": "vibrate", "duration_ms": 150},
        {"type": "set_variable", "variable": "chestsOpened", "value_mode": "increment", "value": "1"},
        {"type": "set_variable", "variable": "totalPulls", "value_mode": "increment", "value": "1"},
        {"type": "list_contains", "variable": "myCards", "field": "name", "value": "Sorcerer", "target_variable": "hasSorcerer"},
        {"type": "list_contains", "variable": "myCards", "field": "name", "value": "Darkmage", "target_variable": "hasDarkmage"},
        {"type": "wait", "duration_ms": 1200},
        {"type": "show_message", "text": "Chest opened! Check My Legends to see what you got."},
        {"type": "set_variable", "variable": stage_var, "value_mode": "literal", "value": "closed"},
    ]


def refresh_timers_actions():
    """Piggybacked onto the tap button (fires constantly) and every
    nav-to-Home button, so the daily/idle panels read as fresh without a
    true background timer (this engine has no on-load/interval trigger —
    see the plan's writeup on get_elapsed_time)."""
    return [
        {"type": "get_elapsed_time", "since_variable": "lastIdleClaim", "target_variable": "idleSeconds", "update_since": False},
        {"type": "calculate", "variable": "idleEarned", "op": "multiply", "a": "idleSeconds", "b": "autoRate"},
        {"type": "get_elapsed_time", "since_variable": "lastDailyClaim", "target_variable": "dailySeconds", "update_since": False},
    ]


def chest_tier_section(y, id_prefix, label, sub, cost, closed_uri, open_uri, stage_var, rewards_var):
    """One compact chest tier (label/sub + closed/open art + buy button or
    locked message) — used 3x on the Shop screen via a shared layout so the
    3 tiers stay visually consistent and the script doesn't repeat itself."""
    closed_vis = {"variable": stage_var, "op": "eq", "value": "closed"}
    open_vis = {"variable": stage_var, "op": "eq", "value": "open"}
    can_afford = {"variable": "coins", "op": "gt", "value": str(cost - 1)}
    cannot_afford = {"variable": "coins", "op": "lt", "value": str(cost)}
    return [
        text_comp(f"{id_prefix}-label", label, 0, y, 320, 18, size="sm", weight="bold"),
        text_comp(f"{id_prefix}-sub", sub, 0, y + 17, 320, 15, size="sm"),
        img_comp(f"{id_prefix}-closed-img", closed_uri, 135, y + 34, 90, 84, fit="contain", visible_if=closed_vis),
        img_comp(f"{id_prefix}-open-img", open_uri, 125, y + 34, 110, 84, fit="contain", animation="pop", visible_if=open_vis),
        btn_comp(f"open-{id_prefix}", f"Open - {cost} coins", 20, y + 122, 320, 36,
                 chest_open_actions(cost, stage_var, rewards_var), visible_if=can_afford),
        text_comp(f"{id_prefix}-locked", f"Need {cost} coins", 20, y + 122, 320, 36, size="sm", visible_if=cannot_afford),
    ]


def achievement_badge(y, id_prefix, title, desc, unlocked_vis, locked_vis):
    """Two alternate panels at the same position (locked / unlocked),
    gated by visible_if — the same idiom every toggle-driven template in
    this app builder already uses, since there's no if/else in actions."""
    return [
        container_comp(f"{id_prefix}-locked-panel", 20, y, 320, 92, background="surface", radius=16, opacity=60, visible_if=locked_vis, children=[
            text_comp(f"{id_prefix}-locked-title", f"\U0001F512 {title}", 16, 12, 288, 22, size="md", weight="bold", align="left"),
            text_comp(f"{id_prefix}-locked-desc", desc, 16, 38, 288, 40, size="sm", align="left"),
        ]),
        container_comp(f"{id_prefix}-unlocked-panel", 20, y, 320, 92, background="surface", radius=16, opacity=88, visible_if=unlocked_vis, children=[
            text_comp(f"{id_prefix}-unlocked-title", f"✅ {title}", 16, 12, 288, 22, size="md", weight="bold", align="left"),
            text_comp(f"{id_prefix}-unlocked-desc", desc, 16, 38, 288, 40, size="sm", align="left"),
        ]),
    ]


def main():
    report = []

    # --- Backgrounds ---
    bg_home = make_background("asset-graphique-2/PNG/Demo/Demo_Background/BackGround_Sample_03_Home_1920.png", focus_y_frac=0.42)
    bg_shop = make_background("asset-graphique-2/PNG/Demo/Demo_Background/BackGround_Sample_05_Rreward_1920.png", focus_y_frac=0.55)
    bg_collection = make_background("asset-graphique-2/PNG/Demo/Demo_Background/BackGround_Sample_04_Character_1920.png", focus_y_frac=0.5)

    bg_home_uri, s1 = data_uri(bg_home, "JPEG", 80)
    bg_shop_uri, s2 = data_uri(bg_shop, "JPEG", 80)
    bg_collection_uri, s3 = data_uri(bg_collection, "JPEG", 80)
    report += [("bg_home", s1), ("bg_shop", s2), ("bg_collection", s3)]

    # --- Chests (3 tiers) ---
    chest_bronze_closed = make_icon("asset-graphique-2/PNG/Component/Chest/Chest_Close_m_01.png", 300)
    chest_bronze_open = make_icon("asset-graphique-2/PNG/Component/Chest/Chest_Open_SparklingCoin_m_01.png", 340)
    chest_silver_closed = make_icon("asset-graphique-2/PNG/Component/Chest/Chest_Close_m_02.png", 300)
    chest_silver_open = make_icon("asset-graphique-2/PNG/Component/Chest/Chest_Open_SparklingCoin_m_02.png", 340)
    chest_gold_closed = make_icon("asset-graphique-2/PNG/Component/Chest/Chest_Close_m_04.png", 300)
    chest_gold_open = make_icon("asset-graphique-2/PNG/Component/Chest/Chest_Open_SparklingCoin_m_04.png", 340)

    cb_closed_uri, s4 = data_uri(chest_bronze_closed, "PNG")
    cb_open_uri, s5 = data_uri(chest_bronze_open, "PNG")
    cs_closed_uri, s4b = data_uri(chest_silver_closed, "PNG")
    cs_open_uri, s5b = data_uri(chest_silver_open, "PNG")
    cg_closed_uri, s6 = data_uri(chest_gold_closed, "PNG")
    cg_open_uri, s7 = data_uri(chest_gold_open, "PNG")
    report += [("chest_bronze_closed", s4), ("chest_bronze_open", s5), ("chest_silver_closed", s4b), ("chest_silver_open", s5b), ("chest_gold_closed", s6), ("chest_gold_open", s7)]

    # --- Coin icon ---
    coin_img = make_icon("asset-graphique-2/PNG/Component/IconMisc/Icon_Coin.png", 96)
    coin_uri, s8 = data_uri(coin_img, "PNG")
    report.append(("coin_icon", s8))

    # --- Cards ---
    ROLE_DIR = "asset-graphique-2/PNG/Component/IconMisc"
    heroes = {
        "Warrior": ("IconSet_Role_Warrior.png", "Common"),
        "Archer": ("IconSet_Role_Archer.png", "Common"),
        "Priest": ("IconSet_Role_Priest.png", "Common"),
        "Ranger": ("IconSet_Role_Ranger.png", "Rare"),
        "Wizard": ("IconSet_Role_Wizard.png", "Epic"),
        "Paladin": ("IconSet_Role_Paladin.png", "Rare"),
        "Assassin": ("IconSet_Role_Assassin.png", "Epic"),
        "Gladiator": ("IconSet_Role_Gladiator.png", "Epic"),
        "Sorcerer": ("IconSet_Role_Sorcerer.png", "Legendary"),
        "Darkmage": ("IconSet_Role_Darkmage.png", "Legendary"),
    }
    card_uris = {}
    for name, (icon_file, rarity) in heroes.items():
        card_img = make_card(f"{ROLE_DIR}/{icon_file}", name, rarity)
        uri, size = data_uri(card_img, "PNG")
        card_uris[name] = {"uri": uri, "rarity": rarity}
        report.append((f"card_{name}", size))
        card_img.save(os.path.join(PREVIEW_DIR, f"card_{name}.png"))

    bg_home.save(os.path.join(PREVIEW_DIR, "bg_home.jpg"), quality=85)
    bg_shop.save(os.path.join(PREVIEW_DIR, "bg_shop.jpg"), quality=85)
    bg_collection.save(os.path.join(PREVIEW_DIR, "bg_collection.jpg"), quality=85)
    chest_bronze_closed.save(os.path.join(PREVIEW_DIR, "chest_bronze_closed.png"))
    chest_bronze_open.save(os.path.join(PREVIEW_DIR, "chest_bronze_open.png"))
    chest_silver_closed.save(os.path.join(PREVIEW_DIR, "chest_silver_closed.png"))
    chest_silver_open.save(os.path.join(PREVIEW_DIR, "chest_silver_open.png"))
    chest_gold_closed.save(os.path.join(PREVIEW_DIR, "chest_gold_closed.png"))
    chest_gold_open.save(os.path.join(PREVIEW_DIR, "chest_gold_open.png"))

    total = sum(s for _, s in report)
    print("Asset sizes (bytes):")
    for name, size in report:
        print(f"  {name:24s} {size:>10,}")
    print(f"  {'TOTAL':24s} {total:>10,}  (~{total/1024/1024:.2f} MB)")

    # --- Reward tables (3 tiers, all 10 heroes) ---
    def reward(name, weight):
        c = card_uris[name]
        return {"value": {"name": name, "rarity": c["rarity"], "image": c["uri"]}, "weight": weight}

    bronze_rewards = [reward("Warrior", 50), reward("Archer", 25), reward("Priest", 15), reward("Ranger", 10)]
    silver_rewards = [reward("Ranger", 30), reward("Paladin", 30), reward("Wizard", 30), reward("Gladiator", 10)]
    gold_rewards = [reward("Assassin", 35), reward("Gladiator", 30), reward("Sorcerer", 20), reward("Darkmage", 15)]

    PANEL_OPACITY = 80  # one consistent panel translucency across every screen

    variables = [
        {"name": "coins", "initial_value": "0"},
        {"name": "shards", "initial_value": "0"},
        {"name": "lastReward", "initial_value": ""},
        {"name": "myCards", "initial_value": "[]"},
        {"name": "bronzeStage", "initial_value": "closed"},
        {"name": "silverStage", "initial_value": "closed"},
        {"name": "goldStage", "initial_value": "closed"},
        {"name": "bronzeRewards", "initial_value": json.dumps(bronze_rewards, ensure_ascii=False)},
        {"name": "silverRewards", "initial_value": json.dumps(silver_rewards, ensure_ascii=False)},
        {"name": "goldRewards", "initial_value": json.dumps(gold_rewards, ensure_ascii=False)},
        # Progression
        {"name": "clickPower", "initial_value": "1"},
        {"name": "autoRate", "initial_value": "0"},
        {"name": "chestsOpened", "initial_value": "0"},
        {"name": "totalPulls", "initial_value": "0"},
        {"name": "hasSorcerer", "initial_value": "false"},
        {"name": "hasDarkmage", "initial_value": "false"},
        # Timers — "1" (not "") so elapsed time reads as huge immediately on
        # first play, making the very first daily reward claimable right
        # away instead of forcing a 24h wait before ever seeing it.
        {"name": "lastIdleClaim", "initial_value": "1"},
        {"name": "lastDailyClaim", "initial_value": "1"},
        {"name": "dailyStreak", "initial_value": "0"},
        {"name": "idleSeconds", "initial_value": "0"},
        {"name": "idleEarned", "initial_value": "0"},
        {"name": "dailySeconds", "initial_value": "0"},
    ]

    can_claim_daily = {"variable": "dailySeconds", "op": "gt", "value": "86399"}
    has_auto_clicker = {"variable": "autoRate", "op": "gt", "value": "0"}
    no_auto_clicker = {"variable": "autoRate", "op": "eq", "value": "0"}
    can_afford_click_upgrade = {"variable": "coins", "op": "gt", "value": "99"}
    cannot_afford_click_upgrade = {"variable": "coins", "op": "lt", "value": "100"}
    can_afford_auto_unlock = {"variable": "coins", "op": "gt", "value": "299"}
    cannot_afford_auto_unlock = {"variable": "coins", "op": "lt", "value": "300"}
    can_afford_auto_upgrade = {"variable": "coins", "op": "gt", "value": "199"}
    cannot_afford_auto_upgrade = {"variable": "coins", "op": "lt", "value": "200"}

    def nav_home_actions():
        """Refreshes the time-based state on the way back to Home too, not
        just on tap, so the daily/idle panels don't look stale right after
        navigating in from another screen."""
        return refresh_timers_actions() + [{"type": "navigate", "screen_id": "home"}]

    # --- Screen: home (Clicker) ---
    home_components = [
        img_comp("bg-home", bg_home_uri, 0, 0, 360, 640, fit="cover"),
        container_comp("title-panel", 20, 16, 320, 40, background="surface", radius=16, opacity=PANEL_OPACITY,
                        children=[text_comp("title", "Vakar Legends", 0, 8, 320, 24, size="lg", weight="bold")]),
        container_comp("coins-panel", 80, 62, 200, 68, background="surface", radius=18, opacity=PANEL_OPACITY, children=[
            img_comp("coin-icon", coin_uri, 14, 12, 32, 32, fit="contain"),
            text_comp("coins-display", "{{coins}}", 52, 10, 134, 30, size="custom", size_px=22, align="left", weight="bold"),
            text_comp("coins-label", "coins", 52, 42, 134, 18, size="sm", align="left"),
        ]),
        btn_comp("tap-button", "TAP TO EARN +{{clickPower}}", 40, 138, 280, 88, [
            {"type": "calculate", "variable": "coins", "op": "add", "a": "coins", "b": "clickPower"},
        ] + refresh_timers_actions()),

        # Daily reward — visible once >=24h have passed since the last claim.
        container_comp("daily-panel", 20, 236, 320, 56, background="surface", radius=16, opacity=PANEL_OPACITY, visible_if=can_claim_daily, children=[
            btn_comp("claim-daily", "\U0001F381 Claim Daily Reward (Day {{dailyStreak}})", 8, 8, 304, 40, [
                {"type": "get_elapsed_time", "since_variable": "lastDailyClaim", "target_variable": "dailySeconds", "update_since": True},
                {"type": "set_variable", "variable": "dailyStreak", "value_mode": "increment", "value": "1"},
                {"type": "set_variable", "variable": "coins", "value_mode": "increment", "value": "100"},
                {"type": "show_message", "text": "Daily reward claimed! +100 coins."},
            ], style="primary"),
        ]),

        # Idle earnings — visible once the Auto-Clicker upgrade is owned.
        container_comp("idle-panel", 20, 300, 320, 56, background="surface", radius=16, opacity=PANEL_OPACITY, visible_if=has_auto_clicker, children=[
            btn_comp("claim-idle", "⚙️ Collect Idle Earnings (~{{idleEarned}})", 8, 8, 304, 40, [
                {"type": "get_elapsed_time", "since_variable": "lastIdleClaim", "target_variable": "idleSeconds", "update_since": True},
                {"type": "calculate", "variable": "idleEarned", "op": "multiply", "a": "idleSeconds", "b": "autoRate"},
                {"type": "calculate", "variable": "coins", "op": "add", "a": "coins", "b": "idleEarned"},
                {"type": "show_message", "text": "Collected {{idleEarned}} idle coins!"},
            ], style="primary"),
        ]),

        # 2x2 nav grid
        btn_comp("shop-button", "\U0001F6D2 Shop", 20, 540, 150, 46, [{"type": "navigate", "screen_id": "shop"}], style="secondary"),
        btn_comp("collection-button", "\U0001F3B4 My Legends", 190, 540, 150, 46, [{"type": "navigate", "screen_id": "collection"}], style="secondary"),
        btn_comp("upgrades-button", "⬆️ Upgrades", 20, 592, 150, 40, [{"type": "navigate", "screen_id": "upgrades"}], style="outline"),
        btn_comp("achievements-button", "\U0001F3C6 Achievements", 190, 592, 150, 40, [{"type": "navigate", "screen_id": "achievements"}], style="outline"),
    ]

    # --- Screen: shop (3 compact tiers) ---
    shop_components = [
        img_comp("bg-shop", bg_shop_uri, 0, 0, 360, 640, fit="cover"),
        container_comp("shop-title-panel", 20, 14, 320, 36, background="surface", radius=14, opacity=PANEL_OPACITY, children=[
            text_comp("shop-title", "Shop", 12, 5, 160, 24, size="md", weight="bold", align="left"),
            img_comp("shop-coin-icon", coin_uri, 210, 5, 22, 22, fit="contain"),
            text_comp("shop-coins", "{{coins}}", 236, 5, 70, 24, size="sm", align="left", weight="bold"),
        ]),
    ]
    shop_components.append(container_comp("bronze-panel", 20, 56, 320, 158, background="surface", radius=18, opacity=PANEL_OPACITY,
        children=chest_tier_section(0, "bronze", "Bronze Chest", "50 coins - mostly Common Legends", 50, cb_closed_uri, cb_open_uri, "bronzeStage", "bronzeRewards")))
    shop_components.append(container_comp("silver-panel", 20, 222, 320, 158, background="surface", radius=18, opacity=PANEL_OPACITY,
        children=chest_tier_section(0, "silver", "Silver Chest", "120 coins - guaranteed Rare or better", 120, cs_closed_uri, cs_open_uri, "silverStage", "silverRewards")))
    shop_components.append(container_comp("gold-panel", 20, 388, 320, 158, background="surface", radius=18, opacity=PANEL_OPACITY,
        children=chest_tier_section(0, "gold", "Gold Chest", "200 coins - guaranteed Epic or better", 200, cg_closed_uri, cg_open_uri, "goldStage", "goldRewards")))
    shop_components += [
        btn_comp("to-collection", "View My Legends", 20, 556, 150, 40, [{"type": "navigate", "screen_id": "collection"}], style="secondary"),
        btn_comp("back-home", "Back to Clicker", 190, 556, 150, 40, nav_home_actions(), style="outline"),
    ]

    # --- Screen: upgrades ---
    upgrades_components = [
        img_comp("bg-upgrades", bg_shop_uri, 0, 0, 360, 640, fit="cover"),
        container_comp("upgrades-title-panel", 20, 20, 320, 56, background="surface", radius=16, opacity=PANEL_OPACITY, children=[
            text_comp("upgrades-title", "Upgrades", 0, 8, 320, 26, size="lg", weight="bold"),
            text_comp("upgrades-coins", "\U0001FA99 {{coins}} coins · ✦ {{shards}} shards", 0, 32, 320, 18, size="sm"),
        ]),

        container_comp("click-power-panel", 20, 92, 320, 130, background="surface", radius=18, opacity=PANEL_OPACITY, children=[
            text_comp("click-power-title", "Click Power", 16, 12, 288, 22, size="md", weight="bold", align="left"),
            text_comp("click-power-desc", "Currently +{{clickPower}} coins per tap", 16, 36, 288, 18, size="sm", align="left"),
            btn_comp("upgrade-click", "Upgrade - 100 coins", 16, 66, 288, 46, [
                {"type": "calculate", "variable": "coins", "op": "subtract", "a": "coins", "b": "100"},
                {"type": "set_variable", "variable": "clickPower", "value_mode": "increment", "value": "1"},
                {"type": "show_message", "text": "Click Power increased!"},
            ], visible_if=can_afford_click_upgrade),
            text_comp("click-power-locked", "Need 100 coins", 16, 78, 288, 24, size="sm", align="left", visible_if=cannot_afford_click_upgrade),
        ]),

        container_comp("auto-clicker-panel", 20, 236, 320, 130, background="surface", radius=18, opacity=PANEL_OPACITY, visible_if=no_auto_clicker, children=[
            text_comp("auto-clicker-title", "Auto-Clicker", 16, 12, 288, 22, size="md", weight="bold", align="left"),
            text_comp("auto-clicker-desc", "Not yet unlocked", 16, 36, 288, 18, size="sm", align="left"),
            btn_comp("unlock-auto", "Unlock - 300 coins", 16, 66, 288, 46, [
                {"type": "calculate", "variable": "coins", "op": "subtract", "a": "coins", "b": "300"},
                {"type": "set_variable", "variable": "autoRate", "value_mode": "literal", "value": "1"},
                {"type": "get_elapsed_time", "since_variable": "lastIdleClaim", "target_variable": "idleSeconds", "update_since": True},
                {"type": "show_message", "text": "Auto-Clicker unlocked!"},
            ], visible_if=can_afford_auto_unlock),
            text_comp("auto-clicker-locked", "Need 300 coins", 16, 78, 288, 24, size="sm", align="left", visible_if=cannot_afford_auto_unlock),
        ]),
        # Once unlocked, a repeatable flat-cost upgrade replaces the unlock button (same position).
        container_comp("auto-clicker-upgrade-panel", 20, 236, 320, 130, background="surface", radius=18, opacity=PANEL_OPACITY, visible_if=has_auto_clicker, children=[
            text_comp("auto-clicker-title2", "Auto-Clicker", 16, 12, 288, 22, size="md", weight="bold", align="left"),
            text_comp("auto-clicker-desc2", "Currently earning {{autoRate}} coins/sec while idle", 16, 36, 288, 18, size="sm", align="left"),
            btn_comp("upgrade-auto", "Upgrade - 200 coins", 16, 66, 288, 46, [
                {"type": "calculate", "variable": "coins", "op": "subtract", "a": "coins", "b": "200"},
                {"type": "set_variable", "variable": "autoRate", "value_mode": "increment", "value": "1"},
                {"type": "show_message", "text": "Auto-Clicker upgraded!"},
            ], visible_if=can_afford_auto_upgrade),
            text_comp("auto-clicker-upgrade-locked", "Need 200 coins", 16, 78, 288, 24, size="sm", align="left", visible_if=cannot_afford_auto_upgrade),
        ]),

        btn_comp("upgrades-back", "Back to Clicker", 20, 580, 320, 44, nav_home_actions(), style="outline"),
    ]

    # --- Screen: achievements ---
    achievements_components = [
        img_comp("bg-achievements", bg_collection_uri, 0, 0, 360, 640, fit="cover"),
        container_comp("achievements-title-panel", 20, 20, 320, 40, background="surface", radius=16, opacity=PANEL_OPACITY,
                        children=[text_comp("achievements-title", "Achievements", 0, 8, 320, 24, size="lg", weight="bold")]),
    ]
    achievements_components += achievement_badge(
        76, "ach-chests", "Chest Collector", "Open 10 chests",
        unlocked_vis={"variable": "chestsOpened", "op": "gt", "value": "9"},
        locked_vis={"variable": "chestsOpened", "op": "lt", "value": "10"},
    )
    achievements_components += achievement_badge(
        176, "ach-cards", "Card Hoarder", "Collect 25 Legend pulls",
        unlocked_vis={"variable": "totalPulls", "op": "gt", "value": "24"},
        locked_vis={"variable": "totalPulls", "op": "lt", "value": "25"},
    )
    achievements_components += achievement_badge(
        276, "ach-sorcerer", "Arcane Recruit", "Recruit a Sorcerer",
        unlocked_vis={"variable": "hasSorcerer", "op": "eq", "value": "true"},
        locked_vis={"variable": "hasSorcerer", "op": "eq", "value": "false"},
    )
    achievements_components += achievement_badge(
        376, "ach-darkmage", "Shadow Recruit", "Recruit a Darkmage",
        unlocked_vis={"variable": "hasDarkmage", "op": "eq", "value": "true"},
        locked_vis={"variable": "hasDarkmage", "op": "eq", "value": "false"},
    )
    achievements_components.append(
        btn_comp("achievements-back", "Back to Clicker", 20, 580, 320, 44, nav_home_actions(), style="outline")
    )

    # --- Screen: collection ---
    collection_components = [
        img_comp("bg-collection", bg_collection_uri, 0, 0, 360, 640, fit="cover"),
        container_comp("collection-title-panel", 20, 20, 320, 56, background="surface", radius=16, opacity=PANEL_OPACITY, children=[
            text_comp("collection-title", "My Legends", 0, 8, 320, 26, size="lg", weight="bold"),
            text_comp("collection-sub", "Every Legend recruited from a chest", 0, 32, 320, 18, size="sm"),
        ]),
        {
            "id": "card-list", "type": "list", "actions": {},
            "layout": {"x": 20, "y": 90, "w": 320, "h": 470},
            "props": {
                "source_variable": "myCards",
                # Empty — each card image already carries its own name/rarity
                # (baked in by make_card), so no separate caption is needed.
                "item_template": "",
                "item_image_template": "{{item.image}}",
                "empty_text": "No Legends yet - open a chest in the Shop!",
                "item_action": None,
                "layout_mode": "grid",
                "grid_columns": 2,
            },
        },
        btn_comp("to-shop", "Shop", 20, 572, 150, 48, [{"type": "navigate", "screen_id": "shop"}], style="secondary"),
        btn_comp("to-home", "Clicker", 190, 572, 150, 48, nav_home_actions(), style="secondary"),
    ]

    payload = {
        "format": "vakarstudio",
        "version": 1,
        "name": "Vakar Legends",
        "description": "Tap to earn coins, open real chests in the shop, and recruit Legends by rarity.",
        "accent_color": "#F2994A",
        "theme": "amber",
        "package_id": None,
        "min_sdk": None,
        "target_sdk": None,
        "app_display_name": "",
        "app_icon_url": "",
        "variables": variables,
        "screens": [
            {"id": "home", "name": "Clicker", "components": home_components},
            {"id": "shop", "name": "Shop", "components": shop_components},
            {"id": "upgrades", "name": "Upgrades", "components": upgrades_components},
            {"id": "achievements", "name": "Achievements", "components": achievements_components},
            {"id": "collection", "name": "My Legends", "components": collection_components},
        ],
    }

    with open(OUT_PATH, "w", encoding="utf-8") as f:
        json.dump(payload, f, ensure_ascii=False)

    out_size = os.path.getsize(OUT_PATH)
    print(f"\nWrote {OUT_PATH} ({out_size:,} bytes, ~{out_size/1024/1024:.2f} MB)")


if __name__ == "__main__":
    main()
