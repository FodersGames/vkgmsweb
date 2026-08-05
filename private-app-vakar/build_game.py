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

from PIL import Image, ImageDraw

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


def make_card(role_icon_rel, rarity, w=300, h=380):
    color = RARITY_COLORS[rarity]
    card = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    mask = Image.new("L", (w, h), 0)
    ImageDraw.Draw(mask).rounded_rectangle([0, 0, w - 1, h - 1], radius=30, fill=255)
    fill = Image.new("RGBA", (w, h), hex_to_rgba(color))
    card.paste(fill, (0, 0), mask)

    band = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    bd = ImageDraw.Draw(band)
    bd.rounded_rectangle([0, h - 90, w - 1, h - 1], radius=30, fill=(0, 0, 0, 60))
    bd.rectangle([0, h - 90, w - 1, h - 61], fill=(0, 0, 0, 60))
    card.alpha_composite(band)

    draw = ImageDraw.Draw(card)
    draw.rounded_rectangle([5, 5, w - 6, h - 6], radius=25, outline=(255, 255, 255, 150), width=4)

    icon = load(role_icon_rel)
    bbox = icon.getbbox()
    if bbox:
        icon = icon.crop(bbox)
    icon_w = int(w * 0.52)
    ratio = icon_w / icon.width
    icon_resized = icon.resize((icon_w, max(1, int(icon.height * ratio))), Image.LANCZOS)
    icon_x = (w - icon_resized.width) // 2
    icon_y = int(h * 0.30 - icon_resized.height / 2)
    shadow = Image.new("RGBA", card.size, (0, 0, 0, 0))
    shadow_layer = Image.new("RGBA", icon_resized.size, (0, 0, 0, 90))
    shadow_layer.putalpha(icon_resized.split()[-1].point(lambda a: min(a, 90)))
    shadow.alpha_composite(shadow_layer, (icon_x + 3, icon_y + 5))
    card.alpha_composite(shadow)
    card.alpha_composite(icon_resized, (icon_x, icon_y))
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


def container_comp(id_, x, y, w, h, background="surface", radius=16, opacity=100, border=False, shadow=False, children=None):
    return {"id": id_, "type": "container", "actions": {},
            "layout": {"x": x, "y": y, "w": w, "h": h},
            "props": {"background": background, "border": border, "radius": radius, "shadow": shadow, "opacity": opacity},
            "children": children or []}


def chest_open_actions(cost, stage_var, rewards_var):
    return [
        {"type": "calculate", "variable": "coins", "op": "subtract", "a": "coins", "b": str(cost)},
        {"type": "set_variable", "variable": stage_var, "value_mode": "literal", "value": "open"},
        {"type": "random_pick", "options_variable": rewards_var, "target_variable": "lastReward", "collection_variable": "myCards"},
        {"type": "wait", "duration_ms": 1200},
        {"type": "show_message", "text": "Chest opened! Check My Cards to see what you got."},
        {"type": "set_variable", "variable": stage_var, "value_mode": "literal", "value": "closed"},
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

    # --- Chests ---
    chest_bronze_closed = make_icon("asset-graphique-2/PNG/Component/Chest/Chest_Close_m_01.png", 360)
    chest_bronze_open = make_icon("asset-graphique-2/PNG/Component/Chest/Chest_Open_SparklingCoin_m_01.png", 400)
    chest_gold_closed = make_icon("asset-graphique-2/PNG/Component/Chest/Chest_Close_m_04.png", 360)
    chest_gold_open = make_icon("asset-graphique-2/PNG/Component/Chest/Chest_Open_SparklingCoin_m_04.png", 400)

    cb_closed_uri, s4 = data_uri(chest_bronze_closed, "PNG")
    cb_open_uri, s5 = data_uri(chest_bronze_open, "PNG")
    cg_closed_uri, s6 = data_uri(chest_gold_closed, "PNG")
    cg_open_uri, s7 = data_uri(chest_gold_open, "PNG")
    report += [("chest_bronze_closed", s4), ("chest_bronze_open", s5), ("chest_gold_closed", s6), ("chest_gold_open", s7)]

    # --- Coin icon ---
    coin_img = make_icon("asset-graphique-2/PNG/Component/IconMisc/Icon_Coin.png", 96)
    coin_uri, s8 = data_uri(coin_img, "PNG")
    report.append(("coin_icon", s8))

    # --- Cards ---
    ROLE_DIR = "asset-graphique-2/PNG/Component/IconMisc"
    heroes = {
        "Warrior": ("IconSet_Role_Warrior.png", "Common"),
        "Archer": ("IconSet_Role_Archer.png", "Common"),
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
        card_img = make_card(f"{ROLE_DIR}/{icon_file}", rarity)
        uri, size = data_uri(card_img, "PNG")
        card_uris[name] = {"uri": uri, "rarity": rarity}
        report.append((f"card_{name}", size))
        card_img.save(os.path.join(PREVIEW_DIR, f"card_{name}.png"))

    bg_home.save(os.path.join(PREVIEW_DIR, "bg_home.jpg"), quality=85)
    bg_shop.save(os.path.join(PREVIEW_DIR, "bg_shop.jpg"), quality=85)
    bg_collection.save(os.path.join(PREVIEW_DIR, "bg_collection.jpg"), quality=85)
    chest_bronze_closed.save(os.path.join(PREVIEW_DIR, "chest_bronze_closed.png"))
    chest_bronze_open.save(os.path.join(PREVIEW_DIR, "chest_bronze_open.png"))
    chest_gold_closed.save(os.path.join(PREVIEW_DIR, "chest_gold_closed.png"))
    chest_gold_open.save(os.path.join(PREVIEW_DIR, "chest_gold_open.png"))

    total = sum(s for _, s in report)
    print("Asset sizes (bytes):")
    for name, size in report:
        print(f"  {name:24s} {size:>10,}")
    print(f"  {'TOTAL':24s} {total:>10,}  (~{total/1024/1024:.2f} MB)")

    # --- Reward tables ---
    def reward(name, weight):
        c = card_uris[name]
        return {"value": {"name": name, "rarity": c["rarity"], "image": c["uri"]}, "weight": weight}

    bronze_rewards = [reward("Warrior", 60), reward("Archer", 20), reward("Ranger", 15), reward("Wizard", 5)]
    gold_rewards = [reward("Paladin", 40), reward("Assassin", 35), reward("Gladiator", 15), reward("Sorcerer", 8), reward("Darkmage", 2)]

    variables = [
        {"name": "coins", "initial_value": "0"},
        {"name": "lastReward", "initial_value": ""},
        {"name": "myCards", "initial_value": "[]"},
        {"name": "bronzeStage", "initial_value": "closed"},
        {"name": "goldStage", "initial_value": "closed"},
        {"name": "bronzeRewards", "initial_value": json.dumps(bronze_rewards, ensure_ascii=False)},
        {"name": "goldRewards", "initial_value": json.dumps(gold_rewards, ensure_ascii=False)},
    ]

    bronze_closed_vis = {"variable": "bronzeStage", "op": "eq", "value": "closed"}
    bronze_open_vis = {"variable": "bronzeStage", "op": "eq", "value": "open"}
    gold_closed_vis = {"variable": "goldStage", "op": "eq", "value": "closed"}
    gold_open_vis = {"variable": "goldStage", "op": "eq", "value": "open"}
    can_afford_bronze = {"variable": "coins", "op": "gt", "value": "49"}
    cannot_afford_bronze = {"variable": "coins", "op": "lt", "value": "50"}
    can_afford_gold = {"variable": "coins", "op": "gt", "value": "199"}
    cannot_afford_gold = {"variable": "coins", "op": "lt", "value": "200"}

    # --- Screen: home (Clicker) ---
    home_components = [
        img_comp("bg-home", bg_home_uri, 0, 0, 360, 640, fit="cover"),
        container_comp("title-panel", 20, 36, 320, 56, background="surface", radius=18, opacity=80,
                        children=[text_comp("title", "Coin Clicker", 0, 12, 320, 32, size="xl", weight="bold")]),
        container_comp("coins-panel", 70, 116, 220, 92, background="surface", radius=20, opacity=84, children=[
            img_comp("coin-icon", coin_uri, 20, 16, 40, 40, fit="contain"),
            text_comp("coins-display", "{{coins}}", 68, 12, 132, 40, size="custom", size_px=30, align="left", weight="bold"),
            text_comp("coins-label", "coins", 68, 56, 132, 20, size="sm", align="left"),
        ]),
        btn_comp("tap-button", "TAP TO EARN +1", 40, 250, 280, 100, [
            {"type": "set_variable", "variable": "coins", "value_mode": "increment", "value": "1"},
        ]),
        container_comp("hint-panel", 30, 372, 300, 48, background="surface", radius=14, opacity=72,
                        children=[text_comp("hint", "Tap to earn coins, then spend them in the Shop.", 12, 6, 276, 36, size="sm")]),
        btn_comp("shop-button", "Shop", 20, 540, 150, 56, [{"type": "navigate", "screen_id": "shop"}], style="secondary"),
        btn_comp("collection-button", "My Cards", 190, 540, 150, 56, [{"type": "navigate", "screen_id": "collection"}], style="secondary"),
    ]

    # --- Screen: shop ---
    shop_components = [
        img_comp("bg-shop", bg_shop_uri, 0, 0, 360, 640, fit="cover"),
        container_comp("shop-title-panel", 20, 18, 320, 40, background="surface", radius=16, opacity=80, children=[
            text_comp("shop-title", "Shop", 12, 6, 160, 26, size="lg", weight="bold", align="left"),
            img_comp("shop-coin-icon", coin_uri, 210, 6, 24, 24, fit="contain"),
            text_comp("shop-coins", "{{coins}}", 238, 6, 70, 26, size="md", align="left", weight="bold"),
        ]),

        container_comp("bronze-panel", 20, 66, 320, 190, background="surface", radius=20, opacity=74, children=[
            text_comp("bronze-label", "Bronze Chest", 0, 8, 320, 20, size="md", weight="bold"),
            text_comp("bronze-sub", "50 coins - mostly Common & Rare", 0, 28, 320, 16, size="sm"),
            img_comp("bronze-closed-img", cb_closed_uri, 80, 48, 160, 118, fit="contain", visible_if=bronze_closed_vis),
            img_comp("bronze-open-img", cb_open_uri, 68, 48, 184, 118, fit="contain", animation="pop", visible_if=bronze_open_vis),
        ]),
        btn_comp("open-bronze", "Open Bronze Chest - 50 coins", 20, 262, 320, 44,
                 chest_open_actions(50, "bronzeStage", "bronzeRewards"), visible_if=can_afford_bronze),
        text_comp("bronze-locked", "Need 50 coins for a Bronze Chest", 20, 262, 320, 44, size="sm", visible_if=cannot_afford_bronze),

        container_comp("gold-panel", 20, 316, 320, 190, background="surface", radius=20, opacity=74, children=[
            text_comp("gold-label", "Gold Chest", 0, 8, 320, 20, size="md", weight="bold"),
            text_comp("gold-sub", "200 coins - guaranteed Rare or better", 0, 28, 320, 16, size="sm"),
            img_comp("gold-closed-img", cg_closed_uri, 80, 48, 160, 118, fit="contain", visible_if=gold_closed_vis),
            img_comp("gold-open-img", cg_open_uri, 68, 48, 184, 118, fit="contain", animation="pop", visible_if=gold_open_vis),
        ]),
        btn_comp("open-gold", "Open Gold Chest - 200 coins", 20, 512, 320, 44,
                 chest_open_actions(200, "goldStage", "goldRewards"), visible_if=can_afford_gold),
        text_comp("gold-locked", "Need 200 coins for a Gold Chest", 20, 512, 320, 44, size="sm", visible_if=cannot_afford_gold),

        btn_comp("to-collection", "View My Cards", 20, 568, 150, 50, [{"type": "navigate", "screen_id": "collection"}], style="secondary"),
        btn_comp("back-home", "Back to Clicker", 190, 568, 150, 50, [{"type": "navigate", "screen_id": "home"}], style="outline"),
    ]

    # --- Screen: collection ---
    collection_components = [
        img_comp("bg-collection", bg_collection_uri, 0, 0, 360, 640, fit="cover"),
        container_comp("collection-title-panel", 20, 20, 320, 56, background="surface", radius=16, opacity=80, children=[
            text_comp("collection-title", "My Card Collection", 0, 8, 320, 26, size="lg", weight="bold"),
            text_comp("collection-sub", "Every card pulled from a chest", 0, 32, 320, 18, size="sm"),
        ]),
        {
            "id": "card-list", "type": "list", "actions": {},
            "layout": {"x": 20, "y": 90, "w": 320, "h": 470},
            "props": {
                "source_variable": "myCards",
                "item_template": "{{item.name}} - {{item.rarity}}",
                "item_image_template": "{{item.image}}",
                "empty_text": "No cards yet - open a chest in the Shop!",
                "item_action": None,
            },
        },
        btn_comp("to-shop", "Shop", 20, 572, 150, 48, [{"type": "navigate", "screen_id": "shop"}], style="secondary"),
        btn_comp("to-home", "Clicker", 190, 572, 150, 48, [{"type": "navigate", "screen_id": "home"}], style="secondary"),
    ]

    payload = {
        "format": "vakarstudio",
        "version": 1,
        "name": "Coin Clicker",
        "description": "Tap to earn coins, open real chests in the shop, and collect hero cards by rarity.",
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
            {"id": "collection", "name": "My Cards", "components": collection_components},
        ],
    }

    with open(OUT_PATH, "w", encoding="utf-8") as f:
        json.dump(payload, f, ensure_ascii=False)

    out_size = os.path.getsize(OUT_PATH)
    print(f"\nWrote {OUT_PATH} ({out_size:,} bytes, ~{out_size/1024/1024:.2f} MB)")


if __name__ == "__main__":
    main()
