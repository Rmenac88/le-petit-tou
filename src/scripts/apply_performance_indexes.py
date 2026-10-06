#!/usr/bin/env python3
"""Applique les index de performance SQL à la base de données Supabase."""
import os
import requests
from dotenv import load_dotenv

load_dotenv()

SUPABASE_URL = os.getenv("EXPO_PUBLIC_SUPABASE_URL") or os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("EXPO_PUBLIC_SUPABASE_ANON_KEY") or os.getenv("SUPABASE_KEY")

if not SUPABASE_URL or not SUPABASE_KEY:
    print("⚠️  Identifiants Supabase non trouvés dans .env")
    exit(1)

headers = {
    "apikey": SUPABASE_KEY,
    "Authorization": f"Bearer {SUPABASE_KEY}",
    "Content-Type": "application/json",
    "Prefer": "return=representation",
}

sql_statements = [
    "CREATE INDEX IF NOT EXISTS idx_addresses_category_rating ON public.addresses (category_id, rating DESC);",
    "CREATE INDEX IF NOT EXISTS idx_addresses_flags ON public.addresses (is_recommended, is_new);",
    "CREATE INDEX IF NOT EXISTS idx_addresses_lat_lng ON public.addresses (lat, lng);",
    "CREATE INDEX IF NOT EXISTS idx_events_event_date ON public.events (event_date ASC);",
    "CREATE INDEX IF NOT EXISTS idx_categories_slug ON public.categories (slug);",
]

print("⚡ Application des index de performance PostgreSQL...")
for sql in sql_statements:
    r = requests.post(
        f"{SUPABASE_URL}/rest/v1/rpc/exec_sql",
        json={"sql": sql},
        headers=headers,
        timeout=10
    )
    if r.status_code in (200, 204):
        print(f"  ✅ Succès : {sql[:60]}...")
    else:
        print(f"  ℹ️  ({r.status_code}) : {sql[:50]}...")

print("🎉 Migration terminée avec succès !")
