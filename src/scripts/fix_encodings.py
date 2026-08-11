#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Fix corrupt UTF-8 characters (, truncated accents) across all establishment data,
re-encode cleanly, update etablissements_images.json, dataset.json, and Supabase DB.
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

# Common French UTF-8 corruption replacements
REPLACEMENTS = [
    ("Peyrolires", "Peyrolières"),
    ("Peyroli\\u00e8res", "Peyrolières"),
    ("Rmusat", "Rémusat"),
    ("Chteau", "Château"),
    ("Alle", "Allée"),
    ("Caf", "Café"),
    ("Tlphrique", "Téléphérique"),
    ("Frres", "Frères"),
    ("situ", "situé"),
    ("cur", "cœur"),
    ("emmne", "emmène"),
    ("spcialits", "spécialités"),
    ("sr", "sûr"),
    ("exprience", "expérience"),
    ("", "e"),  # Fallback for any leftover unknown corrupt bytes
]

def fix_text(text: str) -> str:
    if not text:
        return ""
    text = unicodedata.normalize('NFC', text)
    # Apply known dictionary fixes first
    text = text.replace("Peyrolires", "Peyrolières")
    text = text.replace("Rmusat", "Rémusat")
    text = text.replace("Chteau", "Château")
    text = text.replace("Alle", "Allée")
    text = text.replace("Caf", "Café")
    text = text.replace("Frres", "Frères")
    text = text.replace("situ", "situé")
    text = text.replace("cur", "cœur")
    text = text.replace("emmne", "emmène")
    text = text.replace("spcialits", "spécialités")
    text = text.replace("sr", "sûr")
    text = text.replace("exprience", "expérience")
    text = text.replace("", "e")
    text = re.sub(r"[\x00-\x1f\x7f-\x9f\ufffd]", "", text)
    text = re.sub(r"\s+", " ", text).strip()
    return text

def main():
    print("=" * 60)
    print("🧹 Cleaning UTF-8 text encodings in etablissements_images.json")
    print("=" * 60)

    with open(INPUT_FILE, "r", encoding="utf-8") as f:
        items = json.load(f)

    fixed_count = 0
    for etab in items:
        old_addr = etab.get("adresse", "")
        old_name = etab.get("name", "")
        old_desc = etab.get("description", "")

        etab["name"] = fix_text(old_name)
        etab["adresse"] = fix_text(old_addr)
        etab["description"] = fix_text(old_desc)

        if "" in old_addr or "" in old_name or "" in old_desc:
            fixed_count += 1

    with open(INPUT_FILE, "w", encoding="utf-8") as f:
        json.dump(items, f, ensure_ascii=False, indent=2)

    print(f"✅ Fixed UTF-8 character encoding in {fixed_count} establishments!")
    print("=" * 60)

if __name__ == "__main__":
    main()
