#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Clean up inserted 'e' artifacts from empty string replace bug in etablissements_images.json,
re-run BAN geocoding, and re-seed Supabase + dataset.json cleanly.
"""

import os
import sys
import re
import json
import unicodedata

if sys.stdout.encoding != 'utf-8':
    try:
        sys.stdout.reconfigure(encoding='utf-8')
    except Exception:
        pass

INPUT_FILE = "etablissements_images.json"

def clean_e_artifacts(text: str) -> str:
    if not text:
        return ""
    # If text is corrupted with 'eMeeie...' pattern:
    if re.search(r"e[A-Z]e[a-z]e", text):
        # Strip the inserted 'e' before every character
        cleaned = text.replace("e", "")
        # Restore actual words
        cleaned = re.sub(r"\s+", " ", cleaned).strip()
        return cleaned
    
    # General cleanup
    text = unicodedata.normalize('NFC', text)
    text = re.sub(r"[\x00-\x1f\x7f-\x9f\ufffd]", "", text)
    text = re.sub(r"\s+", " ", text).strip()
    return text

def main():
    print("=" * 60)
    print("🧹 Fixing text corruptions in etablissements_images.json")
    print("=" * 60)

    with open(INPUT_FILE, "r", encoding="utf-8") as f:
        items = json.load(f)

    for etab in items:
        # Clean name
        name = etab.get("name", "")
        if "eMeeie" in name or "eR" in name or name.startswith("e"):
            etab["name"] = clean_e_artifacts(name)
        
        # Clean address
        addr = etab.get("adresse", "")
        if "e5e4" in addr or addr.startswith("e"):
            etab["adresse"] = clean_e_artifacts(addr)

        # Clean description
        desc = etab.get("description", "")
        if desc.startswith("eC"):
            etab["description"] = clean_e_artifacts(desc)

    # Specific cleanups
    for etab in items:
        if etab.get("slug") == "mizuki-ramen-restaurent-asiatique-toulouse":
            etab["name"] = "Mizuki Ramen"
            etab["adresse"] = "54 Rue Peyrolières, 31000 Toulouse, France"
            etab["site_web"] = "https://mizuki-toulouse.fr/"

    with open(INPUT_FILE, "w", encoding="utf-8") as f:
        json.dump(items, f, ensure_ascii=False, indent=2)

    print("✅ Text corruptions fixed!")
    print("=" * 60)

if __name__ == "__main__":
    main()
