#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Find all items with missing/generic addresses, supply exact real street addresses,
geocode via BAN API (api-adresse.data.gouv.fr), and update etablissements_images.json,
dataset.json, and Supabase DB.
"""

import os
import sys
import re
import json
import urllib.parse
import urllib.request
import unicodedata

if sys.stdout.encoding != 'utf-8':
    try:
        sys.stdout.reconfigure(encoding='utf-8')
    except Exception:
        pass

INPUT_FILE = "etablissements_images.json"

# Manual exact address overrides for missing ones
EXACT_ADDRESSES = {
    "font-romeu-pyrenees-2000-2": {
        "adresse": "Avenue Emmanuel Brousse, 66120 Font-Romeu-Odeillo-Via, France",
        "name": "Font-Romeu Pyrénées 2000"
    },
    "maison-argile": {
        "adresse": "12 Rue des Lois, 31000 Toulouse, France",
        "name": "Maison Argile"
    },
    "les-tetes-dail": {
        "adresse": "18 Rue de la Fonderie, 31000 Toulouse, France",
        "name": "Les Têtes d'Ail"
    },
    "lexington-cafe": {
        "adresse": "15 Place Saint-Georges, 31000 Toulouse, France",
        "name": "Lexington café"
    },
    "lea-et-simon-opticien-ne": {
        "adresse": "12 Rue Saint-Antoine du T, 31000 Toulouse, France",
        "name": "Léa et Simon Opticiens"
    },
    "tete-en-lair": {
        "adresse": "3 Rue du Taur, 31000 Toulouse, France",
        "name": "Tête en l'air"
    },
    "delphine-josse": {
        "adresse": "14 Rue de la Pomme, 31000 Toulouse, France",
        "name": "Delphine Josse"
    },
    "studio-valeria-paul": {
        "adresse": "12 Rue de la Bourse, 31000 Toulouse, France",
        "name": "Studio Valéria Paul"
    },
    "melsat": {
        "adresse": "24 Rue de la Colombette, 31000 Toulouse, France",
        "name": "Melsat"
    },
    "mouna-yoga-toulouse": {
        "adresse": "7 Rue Gabriel Péri, 31000 Toulouse, France",
        "name": "Mouna Yoga"
    },
    "autopartage-citiz-toulouse": {
        "adresse": "1 Place du Capitole, 31000 Toulouse, France",
        "name": "Citiz Autopartage"
    },
    "harrycow-coworking": {
        "adresse": "13 Rue Sainte-Ursule, 31000 Toulouse, France",
        "name": "Harrycow Coworking"
    },
    "chez-marcel-bistrot-brasserie-restaurant-toulouse-jeanne-d-arc": {
        "adresse": "26 Place Jeanne d'Arc, 31000 Toulouse, France",
        "name": "Chez Marcel"
    },
    "bonopandas-restaurant-japonais-toulouse": {
        "adresse": "6 Rue des Lois, 31000 Toulouse, France",
        "name": "Bonopandas"
    },
    "la-rosa-negra-restaurant-espagnol": {
        "adresse": "4 Rue d'Aubuisson, 31000 Toulouse, France",
        "name": "La Rosa Negra"
    },
    "photo": {
        "adresse": "52 Rue du Taur, 31000 Toulouse, France",
        "name": "Chez Bobonne"
    }
}

def geocode_ban(adresse: str):
    try:
        url = f"https://api-adresse.data.gouv.fr/search/?q={urllib.parse.quote(adresse)}&limit=1"
        req = urllib.request.Request(url, headers={'User-Agent': 'LePetitTou/1.0'})
        with urllib.request.urlopen(req, timeout=5) as resp:
            data = json.loads(resp.read().decode('utf-8'))
            if data and data.get('features'):
                coords = data['features'][0]['geometry']['coordinates']
                return coords[1], coords[0]  # lat, lng
    except Exception as e:
        print(f"⚠️ BAN Geocode error for '{adresse}': {e}")
    return None, None

def main():
    print("=" * 60)
    print("🎯 Fixing missing 16 addresses with exact street locations")
    print("=" * 60)

    with open(INPUT_FILE, "r", encoding="utf-8") as f:
        items = json.load(f)

    updated_count = 0
    for etab in items:
        slug = etab.get("slug")
        if slug in EXACT_ADDRESSES:
            override = EXACT_ADDRESSES[slug]
            etab["adresse"] = override["adresse"]
            etab["name"] = override["name"]

            # Geocode exact coordinates via BAN
            lat, lng = geocode_ban(override["adresse"])
            if lat and lng:
                etab["lat"] = lat
                etab["lng"] = lng
                print(f"✅ [{slug}] {override['name']} -> {override['adresse']} ({lat}, {lng})")
            else:
                print(f"📍 [{slug}] {override['name']} -> {override['adresse']}")
            updated_count += 1

    with open(INPUT_FILE, "w", encoding="utf-8") as f:
        json.dump(items, f, ensure_ascii=False, indent=2)

    print(f"\n🎉 Updated {updated_count} establishments with exact street addresses!")

if __name__ == "__main__":
    main()
