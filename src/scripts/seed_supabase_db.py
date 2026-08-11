#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
seed_supabase_db.py
===================
1. Lit etablissements_images.json (790 établissements avec photos Supabase et coords réelles).
2. Extrait les catégories, tags, géolocalisations et métadonnées.
3. Alimente la base de données Supabase (tables `categories` et `addresses`).
4. Exporte src/constants/dataset.json pour l'application frontend.
"""

import os
import sys
import re
import json
import random
import uuid
import unicodedata
from dotenv import load_dotenv
from supabase import create_client, Client

if sys.stdout.encoding != 'utf-8':
    try:
        sys.stdout.reconfigure(encoding='utf-8')
    except Exception:
        pass

load_dotenv()

SUPABASE_URL = os.getenv("SUPABASE_URL", "")
SUPABASE_KEY = os.getenv("SUPABASE_KEY", "")

INPUT_JSON = os.path.join(os.path.dirname(__file__), "etablissements_images.json")
OUTPUT_FRONTEND_DATASET = os.path.join(
    os.path.dirname(__file__), "le-petit-tou", "src", "constants", "dataset.json"
)

# Namespace for deterministic UUID generation
NAMESPACE_PETITOU = uuid.UUID("6ba7b810-9dad-11d1-80b4-00c04fd430c8")

# Toulouse centre — fallback uniquement si geocodage échoue
TOULOUSE_LAT = 43.6047
TOULOUSE_LNG = 1.4442

# ─────────────────────────────────────────────
# 1. Catégories Principales Le Petit Tou
# ─────────────────────────────────────────────
CATEGORIES = [
    {
        "id": str(uuid.uuid5(NAMESPACE_PETITOU, "cat_gourmand")),
        "name": "Gourmand Gourmet",
        "icon_name": "UtensilsCrossed",
        "color": "#EF4444",
        "slug": "gourmand-gourmet"
    },
    {
        "id": str(uuid.uuid5(NAMESPACE_PETITOU, "cat_trinquer")),
        "name": "Trinquer & Danser",
        "icon_name": "GlassWater",
        "color": "#8B5CF6",
        "slug": "trinquer-danser"
    },
    {
        "id": str(uuid.uuid5(NAMESPACE_PETITOU, "cat_shopping")),
        "name": "Shopping & Beauté",
        "icon_name": "ShoppingBag",
        "color": "#10B981",
        "slug": "shopping-beaute"
    },
    {
        "id": str(uuid.uuid5(NAMESPACE_PETITOU, "cat_culture")),
        "name": "Culture & Loisirs",
        "icon_name": "Music",
        "color": "#06B6D4",
        "slug": "culture-loisirs"
    },
    {
        "id": str(uuid.uuid5(NAMESPACE_PETITOU, "cat_viepratique")),
        "name": "Vie Pratique & Services",
        "icon_name": "Home",
        "color": "#E5A93B",
        "slug": "vie-pratique"
    }
]

CAT_ID = {cat["slug"]: cat["id"] for cat in CATEGORIES}


def clean_text(text: str) -> str:
    """Nettoie l'encodage et les espaces."""
    if not text:
        return ""
    text = unicodedata.normalize('NFC', text)
    text = re.sub(r"[\x00-\x08\x0b\x0c\x0e-\x1f]", "", text)
    text = re.sub(r"\s+", " ", text).strip()
    return text


def extract_category_and_tags(item: dict) -> tuple:
    """Détermine la catégorie principale et la liste de tags."""
    desc = item.get("description", "").lower()
    name = item.get("name", "").lower()
    full_text = f"{name} {desc}"

    tags = set()

    if any(k in full_text for k in ["restaurant", "bistrot", "cuisine", "brasserie", "tapas", "pizzeria", "burger", "ramen", "sushi", "gastronomie"]):
        tags.add("Restaurants")
    if any(k in full_text for k in ["bar", "pub", "cocktail", "bière", "cave", "trinquer", "danser", "boîte", "club", "vin"]):
        tags.add("Bars & Cafés")
    if any(k in full_text for k in ["café", "coffee", "thé", "brunch", "pâtisserie", "boulangerie", "chocolat", "glace", "salon de thé"]):
        tags.add("Brunch & Douceurs")
    if any(k in full_text for k in ["boutique", "mode", "friperie", "bijou", "déco", "fleur", "cadeau", "shopping", "créateur"]):
        tags.add("Shopping & Déco")
    if any(k in full_text for k in ["coiffeur", "institut", "beauté", "spa", "massage", "tatouage", "bien-être", "esthétique"]):
        tags.add("Beauté & Bien-être")
    if any(k in full_text for k in ["musée", "théâtre", "cinéma", "galerie", "expo", "concert", "escape", "sport", "loisir", "culture"]):
        tags.add("Culture & Loisirs")
    if "terrasse" in full_text:
        tags.add("Terrasse ☀️")
    if "bio" in full_text or "éco" in full_text or "local" in full_text or "circuit court" in full_text:
        tags.add("Bio & Local 🌿")
    if any(k in full_text for k in ["fait maison", "artisan", "traditionnel", "maison"]):
        tags.add("Fait Maison 👨‍🍳")

    if not tags:
        tags.add("Incontournable")

    # Catégorie principale
    if "Restaurants" in tags or "Brunch & Douceurs" in tags or "gourmand" in full_text:
        cat_key = "gourmand-gourmet"
    elif "Bars & Cafés" in tags or "trinquer" in full_text or "nuit" in full_text:
        cat_key = "trinquer-danser"
    elif "Shopping & Déco" in tags or "Beauté & Bien-être" in tags or "shopping" in full_text:
        cat_key = "shopping-beaute"
    elif "Culture & Loisirs" in tags or "culture" in full_text:
        cat_key = "culture-loisirs"
    else:
        cat_key = "vie-pratique"

    cat_id = CAT_ID[cat_key]
    return cat_id, sorted(tags)


def derive_location_name(adresse: str) -> str:
    """Dérive un nom de quartier depuis l'adresse."""
    if not adresse:
        return "Toulouse"
    adresse_lower = adresse.lower()
    if "saint-cyprien" in adresse_lower or "saint cyprien" in adresse_lower:
        return "Saint-Cyprien, Toulouse"
    if "carmes" in adresse_lower:
        return "Carmes, Toulouse"
    if "capitole" in adresse_lower:
        return "Capitole, Toulouse"
    if "victor hugo" in adresse_lower:
        return "Victor Hugo, Toulouse"
    if "jean-jaurès" in adresse_lower or "jean jaures" in adresse_lower:
        return "Jean-Jaurès, Toulouse"
    if "daurade" in adresse_lower:
        return "Daurade, Toulouse"
    if "minimes" in adresse_lower:
        return "Minimes, Toulouse"
    if "saint-sernin" in adresse_lower or "saint sernin" in adresse_lower:
        return "Saint-Sernin, Toulouse"
    if "compans" in adresse_lower:
        return "Compans-Caffarelli, Toulouse"
    # Extraire le quartier depuis le code postal
    if "31300" in adresse:
        return "Saint-Cyprien, Toulouse"
    return "Toulouse"


def parse_description_blob(raw_desc: str):
    if not raw_desc:
        return {
            "breadcrumbs": [],
            "review_text": "Une adresse d'exception sélectionnée par Le Petit Tou à Toulouse.",
            "hours_text": "",
            "tags": []
        }

    text = unicodedata.normalize('NFC', raw_desc)
    text = re.sub(r"\s+", " ", text).strip()

    breadcrumbs = []
    review_text = ""
    hours_text = ""
    tags = []

    m_avis = re.search(r"L['’]avis du Petit Tou", text, re.IGNORECASE)
    if m_avis:
        head = text[:m_avis.start()].strip()
        body = text[m_avis.end():].strip()

        if '>' in head:
            breadcrumbs = [p.strip() for p in head.split('>') if p.strip()]
        elif head:
            breadcrumbs = [head]
    else:
        body = text

    stop_match = re.search(r"\b(Gamme de prix|Contact|Lundi|Mardi|Obtenir des directions|Infos complémentaires)\b", body, re.IGNORECASE)
    if stop_match:
        review_text = body[:stop_match.start()].strip()
        meta_tail = body[stop_match.start():]
    else:
        review_text = body
        meta_tail = ""

    review_text = re.sub(r"\s+", " ", review_text).strip()

    hours_match = re.search(r"(Lundi [^Obtenir]+)", meta_tail, re.IGNORECASE)
    if hours_match:
        hours_text = hours_match.group(1).strip()

    tags_match = re.search(r"Infos complémentaires (.*)", meta_tail, re.IGNORECASE)
    if tags_match:
        raw_tags = tags_match.group(1).strip()
        tag_candidates = re.findall(r"\b(Terrasse|Bio|Tickets restaurant|France|À emporter|Wifi|Accès PMR|Végé|Climatisé|Livraison|CB|Chèques vacances|Réservation|Brunch|Cocktails)\b", raw_tags, re.IGNORECASE)
        tags = list(set(tag_candidates))

    return {
        "breadcrumbs": breadcrumbs,
        "review_text": review_text or "Une adresse d'exception sélectionnée par Le Petit Tou à Toulouse.",
        "hours_text": hours_text,
        "tags": tags
    }


def main():
    print("=" * 60)
    print("🌱 Processing & Seeding 790 Establishments")
    print("=" * 60)

    if not os.path.exists(INPUT_JSON):
        print(f"❌ Erreur: {INPUT_JSON} introuvable.")
        sys.exit(1)

    with open(INPUT_JSON, "r", encoding="utf-8") as f:
        raw_items = json.load(f)

    print(f"📦 {len(raw_items)} établissements chargés depuis {INPUT_JSON}")
    with_real_coords = sum(1 for x in raw_items if x.get('lat') is not None)
    print(f"🌍 {with_real_coords}/{len(raw_items)} établissements avec coordonnées GPS réelles")

    processed_addresses = []

    for idx, item in enumerate(raw_items):
        slug = item.get("slug", f"spot-{idx}")
        item_uuid = str(uuid.uuid5(NAMESPACE_PETITOU, f"spot_{slug}"))
        name = clean_text(item.get("name", "Établissement Toulouse"))
        raw_desc = clean_text(item.get("description", ""))

        parsed = parse_description_blob(raw_desc)
        clean_review = parsed["review_text"]
        clean_breadcrumbs = parsed["breadcrumbs"]

        cat_id, base_tags = extract_category_and_tags(item)
        combined_tags = sorted(list(set(base_tags + parsed["tags"] + clean_breadcrumbs)))

        # Image de couverture
        cover_url = item.get("image_couverture_url") or "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=600&auto=format&fit=crop"

        # Galerie de photos
        gallery = item.get("galerie_photos_urls", [])

        # ── COORDONNÉES RÉELLES ──────────────────────────────────────────
        lat = item.get("lat")
        lng = item.get("lng")

        # Fallback : si on n'a pas de coords, on met None (pas de fake coords)
        if not lat or not lng:
            lat = None
            lng = None

        # Adresse texte
        adresse_str = clean_text(item.get("adresse", ""))
        location_name = derive_location_name(adresse_str) if adresse_str else "Toulouse"

        # Prix & Note (déterministe)
        random.seed(idx * 77)
        rating = round(random.uniform(4.3, 5.0), 1)
        price_level = random.choice(["€", "€€", "€€", "€€€"])
        is_rec = (idx % 3 == 0) or (rating >= 4.8)
        is_new = (idx % 5 == 0)

        address_record = {
            "id": item_uuid,
            "slug": slug,
            "title": name,
            "description": clean_review[:140] + ("..." if len(clean_review) > 140 else ""),
            "full_description": clean_review,
            "breadcrumbs": clean_breadcrumbs,
            "image_url": cover_url,
            "gallery_urls": gallery,
            "rating": rating,
            "category_id": cat_id,
            "price_level": price_level,
            "location": location_name,
            "address": adresse_str,
            "telephone": item.get("telephone", ""),
            "site_web": item.get("site_web", ""),
            "lat": lat,
            "lng": lng,
            "tags": combined_tags,
            "is_recommended": is_rec,
            "is_new": is_new,
        }
        processed_addresses.append(address_record)

    # ── Exportation du dataset.json pour le frontend ──
    os.makedirs(os.path.dirname(OUTPUT_FRONTEND_DATASET), exist_ok=True)
    with open(OUTPUT_FRONTEND_DATASET, "w", encoding="utf-8") as f:
        json.dump(
            {
                "categories": CATEGORIES,
                "addresses": processed_addresses,
                "total": len(processed_addresses)
            },
            f,
            ensure_ascii=False,
            indent=2,
        )

    coords_in_dataset = len([a for a in processed_addresses if a["lat"] and a["lng"]])
    print(f"✅ Frontend dataset généré : {OUTPUT_FRONTEND_DATASET}")
    print(f"   🌍 {coords_in_dataset}/{len(processed_addresses)} adresses avec GPS réel dans le dataset")

    # ── Seeding de Supabase DB ──
    if SUPABASE_URL and SUPABASE_KEY:
        print(f"\n🔌 Connexion Supabase DB ({SUPABASE_URL})...")
        supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

        # 1. Upsert categories
        print("  📂 Upsert des catégories...")
        try:
            for cat in CATEGORIES:
                supabase.from_("categories").upsert({
                    "id": cat["id"],
                    "name": cat["name"],
                    "icon_name": cat["icon_name"],
                    "color": cat["color"],
                }).execute()
            print("  ✅ Catégories synchronisées dans Supabase.")
        except Exception as e:
            print(f"  ⚠️  Catégories upsert info: {e}")

        # 2. Upsert addresses (par lots de 50) — AVEC lat/lng/adresse/telephone
        print("  🏬 Upsert des 790 établissements dans Supabase DB...")
        batch_size = 50
        inserted_count = 0

        for i in range(0, len(processed_addresses), batch_size):
            batch = processed_addresses[i: i + batch_size]
            db_batch = []
            for item in batch:
                record = {
                    "id": item["id"],
                    "slug": item.get("slug", ""),
                    "title": item["title"],
                    "description": item["description"],
                    "image_url": item["image_url"],
                    "gallery_urls": item.get("gallery_urls", []),
                    "rating": item["rating"],
                    "category_id": item["category_id"],
                    "price_level": item["price_level"],
                    "location": item["location"],
                    "address": item.get("address", ""),
                    "telephone": item.get("telephone", ""),
                    "site_web": item.get("site_web", ""),
                    "tags": item.get("tags", []),
                    "is_recommended": item["is_recommended"],
                    "is_new": item["is_new"],
                }
                if item.get("lat") is not None:
                    record["lat"] = item["lat"]
                if item.get("lng") is not None:
                    record["lng"] = item["lng"]
                db_batch.append(record)
            try:
                supabase.from_("addresses").upsert(db_batch).execute()
                inserted_count += len(batch)
                print(f"    [{inserted_count}/{len(processed_addresses)}] ✅ Upserted")
            except Exception as e:
                print(f"    ⚠️  Batch {i} upsert error: {e}")

    print("\n" + "=" * 60)
    print(f"🎉 Seeding et génération terminés avec succès !")
    print(f"   • Total établissements : {len(processed_addresses)}")
    print(f"   • Catégories : {len(CATEGORIES)}")
    print("=" * 60)


if __name__ == "__main__":
    main()
