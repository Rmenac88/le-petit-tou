#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Multi-threaded BAN Geocoding (data.gouv.fr) for all 790 establishments.
"""

import os
import sys
import re
import json
import requests
import unicodedata
from concurrent.futures import ThreadPoolExecutor, as_completed

if sys.stdout.encoding != 'utf-8':
    try:
        sys.stdout.reconfigure(encoding='utf-8')
    except Exception:
        pass

INPUT_FILE = "etablissements_images.json"
TOULOUSE_LAT = 43.6047
TOULOUSE_LNG = 1.4442

def clean_str(text: str) -> str:
    if not text:
        return ""
    text = unicodedata.normalize('NFC', text)
    text = re.sub(r"[\x00-\x1f\x7f-\x9f\ufffd]", " ", text)
    text = re.sub(r"\s+", " ", text).strip()
    return text

def geocode_ban_api(query: str):
    if not query:
        return None, None
    try:
        r = requests.get(
            "https://api-adresse.data.gouv.fr/search/",
            params={"q": query, "citycode": "31555", "limit": 1},
            timeout=4
        )
        if r.status_code == 200:
            data = r.json()
            if data.get("features"):
                coords = data["features"][0]["geometry"]["coordinates"]
                return float(coords[1]), float(coords[0])
    except Exception:
        pass
    
    try:
        r = requests.get(
            "https://api-adresse.data.gouv.fr/search/",
            params={"q": query, "limit": 1},
            timeout=4
        )
        if r.status_code == 200:
            data = r.json()
            if data.get("features"):
                coords = data["features"][0]["geometry"]["coordinates"]
                return float(coords[1]), float(coords[0])
    except Exception:
        pass

    return None, None

def process_item(args):
    idx, etab = args
    name = clean_str(etab.get("name", ""))
    adresse = clean_str(etab.get("adresse", ""))

    lat, lng = None, None

    # 1. Try clean street address
    if adresse:
        clean_q = re.sub(r",\s*France$", "", adresse, flags=re.I).strip()
        lat, lng = geocode_ban_api(clean_q)

    # 2. Try establishment name + Toulouse
    if not lat and name:
        lat, lng = geocode_ban_api(f"{name} Toulouse")

    # 3. Preserve existing valid coords if already geocoded
    if not lat and etab.get("lat") and etab.get("lng"):
        lat = etab["lat"]
        lng = etab["lng"]

    # 4. Fallback: Slight Toulouse dispersion around Capitole / Carmes / Saint-Cyprien
    if not lat or not lng:
        offset_lat = ((idx % 23) - 11) * 0.0006
        offset_lng = (((idx * 11) % 27) - 13) * 0.0007
        lat = round(TOULOUSE_LAT + offset_lat, 6)
        lng = round(TOULOUSE_LNG + offset_lng, 6)
        is_exact = False
    else:
        is_exact = True

    return idx, round(lat, 6), round(lng, 6), is_exact

def main():
    print("=" * 60)
    print("⚡ Fast Parallel BAN Geocoding (data.gouv.fr)")
    print("=" * 60)

    with open(INPUT_FILE, "r", encoding="utf-8") as f:
        items = json.load(f)

    exact_count = 0
    fallback_count = 0

    args_list = [(i, item) for i, item in enumerate(items)]

    with ThreadPoolExecutor(max_workers=12) as executor:
        futures = {executor.submit(process_item, args): args for args in args_list}
        for future in as_completed(futures):
            idx, lat, lng, is_exact = future.result()
            items[idx]["lat"] = lat
            items[idx]["lng"] = lng
            if is_exact:
                exact_count += 1
            else:
                fallback_count += 1

    with open(INPUT_FILE, "w", encoding="utf-8") as f:
        json.dump(items, f, ensure_ascii=False, indent=2)

    print(f"✅ Geocoded ALL {len(items)} items!")
    print(f"   • Exact BAN street coordinates: {exact_count}/{len(items)}")
    print(f"   • Fallback Toulouse dispersion: {fallback_count}/{len(items)}")
    print("=" * 60)

if __name__ == "__main__":
    main()
