#!/usr/bin/env python3
"""Ajoute les colonnes lat, lng, address, telephone, gallery_urls, tags, slug à la table addresses de Supabase."""
import os
import requests
from dotenv import load_dotenv

load_dotenv()

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")

headers = {
    "apikey": SUPABASE_KEY,
    "Authorization": f"Bearer {SUPABASE_KEY}",
    "Content-Type": "application/json",
    "Prefer": "return=representation",
}

sql_commands = [
    "ALTER TABLE addresses ADD COLUMN IF NOT EXISTS lat double precision",
    "ALTER TABLE addresses ADD COLUMN IF NOT EXISTS lng double precision",
    "ALTER TABLE addresses ADD COLUMN IF NOT EXISTS address text",
    "ALTER TABLE addresses ADD COLUMN IF NOT EXISTS telephone text",
    "ALTER TABLE addresses ADD COLUMN IF NOT EXISTS site_web text",
    "ALTER TABLE addresses ADD COLUMN IF NOT EXISTS gallery_urls text[]",
    "ALTER TABLE addresses ADD COLUMN IF NOT EXISTS tags text[]",
    "ALTER TABLE addresses ADD COLUMN IF NOT EXISTS slug text",
]

print("🔧 Ajout des colonnes manquantes à la table 'addresses'...")

for sql in sql_commands:
    # Utiliser l'endpoint SQL de Supabase Management API (via pg_meta)
    r = requests.post(
        f"{SUPABASE_URL}/rest/v1/rpc/exec_sql",
        json={"sql": sql},
        headers=headers,
        timeout=10
    )
    col_name = sql.split("ADD COLUMN IF NOT EXISTS ")[1].split(" ")[0]
    if r.status_code in (200, 204):
        print(f"  ✅ Colonne '{col_name}' ajoutée/vérifiée")
    else:
        print(f"  ⚠️  '{col_name}' → {r.status_code}: {r.text[:100]}")

print("\n📋 Vérification des colonnes actuelles...")
from supabase import create_client
s = create_client(SUPABASE_URL, SUPABASE_KEY)
res = s.from_("addresses").select("*").limit(1).execute()
print("Colonnes:", list(res.data[0].keys()) if res.data else "table vide")
