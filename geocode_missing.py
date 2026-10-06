#!/usr/bin/env python3
"""
Geocode les adresses manquantes dans dataset.json via l'API BAN officielle
(api-adresse.data.gouv.fr) - 100% gratuit, pas de cle requise.
"""
import json
import urllib.request
import urllib.parse
import time

DATASET_PATH = "src/constants/dataset.json"
BAN_URL = "https://api-adresse.data.gouv.fr/search/"
DELAY = 0.08  # 80ms entre chaque requete

def geocode_address(query):
    if not query or len(query.strip()) < 5:
        return None
    try:
        params = urllib.parse.urlencode({"q": query.strip(), "limit": "1", "citycode": "31555"})
        url = f"{BAN_URL}?{params}"
        req = urllib.request.Request(url, headers={"User-Agent": "LePetitTou-Geocoder/1.0"})
        with urllib.request.urlopen(req, timeout=6) as resp:
            data = json.loads(resp.read())
        features = data.get("features", [])
        if features and features[0]["properties"]["score"] >= 0.4:
            coords = features[0]["geometry"]["coordinates"]
            return (coords[1], coords[0])
    except Exception:
        pass
    return None

def main():
    print("Chargement du dataset...")
    with open(DATASET_PATH, "r", encoding="utf-8") as f:
        data = json.load(f)
    
    addresses = data.get("addresses", [])
    missing = [(i, a) for i, a in enumerate(addresses) if not a.get("lat") or not a.get("lng")]
    
    print(f"Total: {len(addresses)} | Sans coords: {len(missing)}")
    
    success = 0
    failed = 0
    
    for n, (idx, addr) in enumerate(missing):
        title = addr.get("title", "?")
        address_str = addr.get("address", "")
        
        query = address_str if address_str and "Toulouse" in address_str else (
            f"{address_str}, Toulouse" if address_str else f"{title}, Toulouse"
        )
        
        result = geocode_address(query)
        if not result and title:
            result = geocode_address(f"{title}, Toulouse")
        
        if result:
            lat, lng = result
            addresses[idx]["lat"] = lat
            addresses[idx]["lng"] = lng
            success += 1
            status = "OK"
        else:
            failed += 1
            status = "FAIL"
        
        print(f"[{n+1}/{len(missing)}] {status} {title[:45]:<45} | {result or 'ECHEC'}")
        
        if (n + 1) % 50 == 0:
            with open(DATASET_PATH, "w", encoding="utf-8") as f:
                json.dump(data, f, ensure_ascii=False, indent=2)
            print(f"  >> Sauvegarde intermediaire ({n+1}/{len(missing)})")
        
        time.sleep(DELAY)
    
    with open(DATASET_PATH, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    
    print()
    print(f"DONE: succes={success} echecs={failed}")
    still_missing = [a for a in data["addresses"] if not a.get("lat") or not a.get("lng")]
    print(f"Final: {len(data['addresses']) - len(still_missing)}/{len(data['addresses'])} avec coords")

if __name__ == "__main__":
    main()
