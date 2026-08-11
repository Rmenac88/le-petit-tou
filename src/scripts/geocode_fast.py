#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Geocodage ultra-rapide via Photon (OSM) - 5 threads, ~100 addr/min.
Photon ne requiert pas de limite stricte de 1 req/s contrairement a Nominatim.
"""
import sys
sys.stdout.reconfigure(encoding='utf-8')

import json
import time
import os
import requests
from concurrent.futures import ThreadPoolExecutor, as_completed
from dotenv import load_dotenv

load_dotenv()

INPUT_FILE = "etablissements_images.json"
CACHE_FILE = "geocode_cache.json"
HEADERS = {"User-Agent": "LePetitTou-App/1.0"}

def load_data():
    with open(INPUT_FILE, encoding="utf-8") as f:
        return json.load(f)

def save_data(data):
    with open(INPUT_FILE, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

def load_cache():
    if os.path.exists(CACHE_FILE):
        with open(CACHE_FILE, encoding="utf-8") as f:
            return json.load(f)
    return {}

def save_cache(cache):
    with open(CACHE_FILE, "w", encoding="utf-8") as f:
        json.dump(cache, f, ensure_ascii=False, indent=2)

def geocode_photon(address, cache):
    """Geocode via Photon (OSM) - rapide, pas de limite stricte."""
    if not address:
        return None, None
    key = f"photon:{address}"
    if key in cache:
        return cache[key]["lat"], cache[key]["lng"]
    try:
        r = requests.get(
            "https://photon.komoot.io/api/",
            params={"q": address, "limit": 1, "lang": "fr", "bbox": "1.2,43.4,1.7,43.8"},
            headers=HEADERS,
            timeout=8
        )
        data = r.json()
        if data.get("features"):
            coords = data["features"][0]["geometry"]["coordinates"]
            lng, lat = float(coords[0]), float(coords[1])
            # Verifier que c'est bien dans la region Toulouse (elargi)
            if 43.3 <= lat <= 44.0 and 1.0 <= lng <= 1.8:
                cache[key] = {"lat": lat, "lng": lng}
                return lat, lng
    except Exception:
        pass
    return None, None

def geocode_nominatim(address, cache):
    """Fallback Nominatim si Photon echoue."""
    if not address:
        return None, None
    key = f"nom:{address}"
    if key in cache:
        return cache[key]["lat"], cache[key]["lng"]
    try:
        r = requests.get(
            "https://nominatim.openstreetmap.org/search",
            params={"q": address, "format": "json", "limit": 1, "countrycodes": "fr"},
            headers=HEADERS,
            timeout=8
        )
        results = r.json()
        if results:
            lat, lng = float(results[0]["lat"]), float(results[0]["lon"])
            cache[key] = {"lat": lat, "lng": lng}
            return lat, lng
    except Exception:
        pass
    return None, None

def geocode_one(args):
    """Geocode un etablissement (pour thread pool)."""
    idx, etab, cache = args
    addr = etab.get("adresse", "").strip()
    slug = etab.get("slug", "?")
    
    if not addr:
        # Essayer par nom + Toulouse
        name = etab.get("name", slug)
        addr = f"{name}, Toulouse, France"
    
    # 1. Photon
    lat, lng = geocode_photon(addr, cache)
    
    # 2. Fallback Nominatim
    if not lat and ", France" in addr:
        time.sleep(0.3)
        lat, lng = geocode_nominatim(addr, cache)
    
    return idx, slug, lat, lng, addr

def main():
    print("=" * 60)
    print("Geocodage rapide Photon+OSM - 5 threads paralleles")
    print("=" * 60)
    
    data = load_data()
    cache = load_cache()
    
    todo = [(i, x) for i, x in enumerate(data) if not (x.get("lat") and x.get("lng"))]
    already = len(data) - len(todo)
    
    print(f"Deja geocodes: {already}/790")
    print(f"A geocoder: {len(todo)}/790")
    
    if not todo:
        print("Tous les etablissements sont deja geocodes!")
        return
    
    print(f"Debut du geocodage (5 threads)...")
    
    geocoded = 0
    failed = 0
    processed = 0
    
    # Traiter par lots de 50 avec 5 threads
    BATCH = 50
    args_list = [(i, data[i], cache) for i, _ in todo]
    
    with ThreadPoolExecutor(max_workers=5) as executor:
        futures = {executor.submit(geocode_one, args): args for args in args_list}
        
        for future in as_completed(futures):
            idx, slug, lat, lng, addr = future.result()
            processed += 1
            
            if lat and lng:
                data[idx]["lat"] = lat
                data[idx]["lng"] = lng
                geocoded += 1
            else:
                failed += 1
            
            if processed % 25 == 0 or processed == len(todo):
                save_data(data)
                save_cache(cache)
                total_done = already + geocoded
                pct = int(total_done / 790 * 100)
                print(f"  [{total_done}/790 | {pct}%] +{geocoded} geocodes | {failed} echecs")
    
    save_data(data)
    save_cache(cache)
    
    total = len([x for x in data if x.get("lat") and x.get("lng")])
    print(f"\n{'=' * 60}")
    print(f"Geocodage termine!")
    print(f"  Total GPS reels: {total}/790")
    print(f"  Echecs: {failed}")
    print("=" * 60)

if __name__ == "__main__":
    main()
