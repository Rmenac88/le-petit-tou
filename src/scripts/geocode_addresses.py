#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Geocodage rapide multi-thread des 790 etablissements Le Petit Tou.
- 10 threads paralleles pour scraper les adresses
- Geocodage sequentiel Nominatim (1 req/s max - condition d'utilisation)
- Cache pour ne pas re-geocoder ce qui est deja fait
"""
import sys
sys.stdout.reconfigure(encoding='utf-8')

import json
import time
import os
import requests
from bs4 import BeautifulSoup
from concurrent.futures import ThreadPoolExecutor, as_completed
from dotenv import load_dotenv

load_dotenv()

HEADERS = {"User-Agent": "LePetitTou-App/1.0 contact@lepetittou.com"}
INPUT_FILE = "etablissements_images.json"
CACHE_FILE = "geocode_cache.json"

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

def scrape_address(url):
    """Scrape l'adresse exacte depuis une page etablissement lepetittou."""
    try:
        r = requests.get(url, timeout=8, headers=HEADERS)
        if r.status_code != 200:
            return ""
        soup = BeautifulSoup(r.text, "html.parser")
        
        # Meta OG business contact (la plus fiable)
        meta_street = soup.find("meta", {"property": "business:contact_data:street_address"})
        meta_postal = soup.find("meta", {"property": "business:contact_data:postal_code"})
        meta_city = soup.find("meta", {"property": "business:contact_data:locality"})
        
        if meta_street and meta_street.get("content", "").strip():
            street = meta_street["content"].strip()
            postal = meta_postal["content"].strip() if meta_postal and meta_postal.get("content") else "31000"
            city = meta_city["content"].strip() if meta_city and meta_city.get("content") else "Toulouse"
            return f"{street}, {postal} {city}, France"
        
        # Fallback: ld+json
        for script in soup.find_all("script", {"type": "application/ld+json"}):
            try:
                d = json.loads(script.string)
                if isinstance(d, dict) and "address" in d:
                    a = d["address"]
                    street = a.get("streetAddress", "")
                    postal = a.get("postalCode", "31000")
                    city = a.get("addressLocality", "Toulouse")
                    if street:
                        return f"{street}, {postal} {city}, France"
            except Exception:
                pass
        return ""
    except Exception:
        return ""

def geocode_nominatim(address, cache):
    """Geocode une adresse via Nominatim (OSM). Respecte la limite 1 req/s."""
    if not address:
        return None, None
    
    if address in cache:
        return cache[address]["lat"], cache[address]["lng"]
    
    try:
        r = requests.get(
            "https://nominatim.openstreetmap.org/search",
            params={"q": address, "format": "json", "limit": 1, "countrycodes": "fr"},
            headers=HEADERS,
            timeout=10
        )
        results = r.json()
        if results:
            lat = float(results[0]["lat"])
            lng = float(results[0]["lon"])
            cache[address] = {"lat": lat, "lng": lng}
            return lat, lng
    except Exception:
        pass
    return None, None

def main():
    print("=" * 60)
    print("Geocodage rapide - 790 etablissements Le Petit Tou")
    print("=" * 60)
    
    data = load_data()
    cache = load_cache()
    
    already_done = [x for x in data if x.get("lat") and x.get("lng")]
    todo = [x for x in data if not (x.get("lat") and x.get("lng"))]
    
    print(f"Deja geocodes: {len(already_done)}/790")
    print(f"Restants: {len(todo)}/790")
    
    if not todo:
        print("Tous les etablissements sont deja geocodes!")
        return
    
    # ETAPE 1 : Scraper les adresses manquantes en parallele (10 threads)
    need_address = [x for x in todo if not x.get("adresse", "").strip()]
    print(f"\nEtape 1: Scraping adresses pour {len(need_address)} etablissements (10 threads)...")
    
    def scrape_one(etab):
        url = etab.get("url_originale", "")
        if not url:
            return etab["slug"], ""
        addr = scrape_address(url)
        return etab["slug"], addr
    
    slug_to_idx = {x["slug"]: i for i, x in enumerate(data)}
    
    scraped = 0
    with ThreadPoolExecutor(max_workers=10) as executor:
        futures = {executor.submit(scrape_one, etab): etab for etab in need_address}
        for future in as_completed(futures):
            slug, addr = future.result()
            if addr:
                idx = slug_to_idx[slug]
                data[idx]["adresse"] = addr
                scraped += 1
            if (scraped + 1) % 50 == 0:
                save_data(data)
                print(f"  Scrape: {scraped}/{len(need_address)}")
    
    save_data(data)
    print(f"  Scrape termine: {scraped} nouvelles adresses trouvees")
    
    # ETAPE 2 : Geocodage sequentiel Nominatim (1 req/s)
    still_todo = [x for x in data if not (x.get("lat") and x.get("lng"))]
    print(f"\nEtape 2: Geocodage de {len(still_todo)} adresses via Nominatim (1 req/s)...")
    print(f"  Duree estimee: ~{len(still_todo)//60 + 1} minutes")
    
    geocoded = 0
    failed = 0
    
    for i, etab in enumerate(still_todo):
        addr = etab.get("adresse", "").strip()
        slug = etab.get("slug", "?")
        
        if not addr:
            # Fallback: geocoder par nom + Toulouse
            addr = f"{etab.get('name', slug)}, Toulouse, France"
        
        lat, lng = geocode_nominatim(addr, cache)
        save_cache(cache)
        
        idx = slug_to_idx[etab["slug"]]
        if lat and lng:
            data[idx]["lat"] = lat
            data[idx]["lng"] = lng
            geocoded += 1
        else:
            failed += 1
        
        # Sauvegarde toutes les 25
        if (i + 1) % 25 == 0:
            save_data(data)
            done_total = len(already_done) + geocoded
            print(f"  [{done_total}/790] Geocodes | +{geocoded} ce run | {failed} echecs | adresse: {addr[:50]}")
        
        time.sleep(1.05)  # Nominatim: max 1 req/s
    
    save_data(data)
    
    total_geocoded = len([x for x in data if x.get("lat") and x.get("lng")])
    print(f"\n{'=' * 60}")
    print(f"Geocodage termine!")
    print(f"  Total avec GPS reel: {total_geocoded}/790")
    print(f"  Echecs: {failed}")
    print(f"{'=' * 60}")
    print("\nRelancez maintenant: python seed_supabase_db.py")

if __name__ == "__main__":
    main()
