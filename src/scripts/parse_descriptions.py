#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Parse scraped raw descriptions into clean structured fields:
- breadcrumbs: list of strings (e.g. ['Bars', 'Pubs et bars à bières', 'Trinquer Danser'])
- review_text: clean text of "L'avis du Petit Tou"
- hours_text: clean opening hours string
- tags: list of complementary feature tags
"""

import re
import json
import unicodedata

INPUT_FILE = "etablissements_images.json"

def parse_description_blob(raw_desc: str):
    if not raw_desc:
        return {
            "breadcrumbs": [],
            "review_text": "",
            "hours_text": "",
            "tags": []
        }
    
    text = unicodedata.normalize('NFC', raw_desc)
    text = re.sub(r"\s+", " ", text).strip()

    breadcrumbs = []
    review_text = ""
    hours_text = ""
    tags = []

    # 1. Extract breadcrumbs before "L'avis du Petit Tou"
    m_avis = re.search(r"L['’]avis du Petit Tou", text, re.IGNORECASE)
    if m_avis:
        head = text[:m_avis.start()].strip()
        body = text[m_avis.end():].strip()

        # Extract breadcrumb parts split by '>'
        if '>' in head:
            parts = [p.strip() for p in head.split('>') if p.strip()]
            breadcrumbs = parts
        elif head:
            breadcrumbs = [head]
    else:
        body = text

    # 2. Extract review content up to metadata keywords ("Gamme de prix", "Contact", "Lundi", "Obtenir des directions")
    stop_match = re.search(r"\b(Gamme de prix|Contact|Lundi|Mardi|Obtenir des directions|Infos complémentaires)\b", body, re.IGNORECASE)
    if stop_match:
        review_text = body[:stop_match.start()].strip()
        meta_tail = body[stop_match.start():]
    else:
        review_text = body
        meta_tail = ""

    # Clean up review text trailing punctuation/formatting
    review_text = re.sub(r"\s+", " ", review_text).strip()

    # 3. Extract hours text if present
    hours_match = re.search(r"(Lundi [^Obtenir]+)", meta_tail, re.IGNORECASE)
    if hours_match:
        hours_text = hours_match.group(1).strip()

    # 4. Extract complementary tags if present
    tags_match = re.search(r"Infos complémentaires (.*)", meta_tail, re.IGNORECASE)
    if tags_match:
        raw_tags = tags_match.group(1).strip()
        # Split tags
        tag_candidates = re.findall(r"\b(Terrasse|Bio|Tickets restaurant|France|À emporter|Wifi|Accès PMR|Végé|Climatisé|Livraison|CB|Chèques vacances|Réservation|Brunch|Cocktails)\b", raw_tags, re.IGNORECASE)
        tags = list(set(tag_candidates))

    return {
        "breadcrumbs": breadcrumbs,
        "review_text": review_text,
        "hours_text": hours_text,
        "tags": tags
    }

def main():
    with open(INPUT_FILE, "r", encoding="utf-8") as f:
        items = json.load(f)

    print(f"Loaded {len(items)} items.")

    for i in range(min(5, len(items))):
        res = parse_description_blob(items[i].get("description", ""))
        print(f"\n--- Item {i+1}: {items[i].get('name')} ---")
        print("Breadcrumbs:", res["breadcrumbs"])
        print("Review Text:", res["review_text"][:120] + "..." if len(res["review_text"]) > 120 else res["review_text"])
        print("Hours:", res["hours_text"][:60])
        print("Tags:", res["tags"])

if __name__ == "__main__":
    main()
