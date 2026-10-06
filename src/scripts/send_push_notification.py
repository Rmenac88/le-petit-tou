#!/usr/bin/env python3
"""
Script d'envoi de notifications Push Expo pour Le Petit Tou.
Permet d'envoyer des notifications à tous les utilisateurs ou selon leurs préférences.

Usage:
  python3 src/scripts/send_push_notification.py --title "Nouvel Événement !" --body "Venez au Quai de la Daurade pour la soirée !" --type events
"""

import os
import sys
import json
import argparse
import requests
from dotenv import load_dotenv

load_dotenv()

SUPABASE_URL = os.environ.get("EXPO_PUBLIC_SUPABASE_URL") or os.environ.get("SUPABASE_URL")
SUPABASE_KEY = os.environ.get("EXPO_PUBLIC_SUPABASE_ANON_KEY") or os.environ.get("SUPABASE_SERVICE_ROLE_KEY")

EXPO_PUSH_ENDPOINT = "https://exp.host/--/api/v2/push/send"


def fetch_push_tokens(notification_type="all"):
    """Récupère les tokens Expo valides depuis la table Supabase user_push_tokens."""
    if not SUPABASE_URL or not SUPABASE_KEY:
        print("❌ Erreur : Variables SUPABASE_URL ou SUPABASE_KEY manquantes dans le fichier .env")
        return []

    headers = {
        "apikey": SUPABASE_KEY,
        "Authorization": f"Bearer {SUPABASE_KEY}",
        "Content-Type": "application/json",
    }

    url = f"{SUPABASE_URL}/rest/v1/user_push_tokens?select=push_token,notify_events,notify_spots&push_token=not.is.null"
    
    if notification_type == "events":
        url += "&notify_events=eq.true"
    elif notification_type == "spots":
        url += "&notify_spots=eq.true"

    try:
        response = requests.get(url, headers=headers, timeout=10)
        if response.status_code == 200:
            records = response.json()
            tokens = list(set([r["push_token"] for r in records if r.get("push_token") and "ExponentPushToken" in r["push_token"]]))
            return tokens
        else:
            print(f"⚠️ Erreur Supabase ({response.status_code}) : {response.text}")
            return []
    except Exception as e:
        print(f"❌ Erreur réseau Supabase : {e}")
        return []


def send_expo_push_notifications(tokens, title, body, data=None):
    """Envoie la notification par lots de 100 à l'API Expo Push."""
    if not tokens:
        print("ℹ️ Aucun token enregistré trouvé.")
        return

    print(f"🚀 Envoi de la notification à {len(tokens)} appareil(s)...")

    # Découpage par lots de 100
    batch_size = 100
    success_count = 0

    for i in range(0, len(tokens), batch_size):
        batch = tokens[i : i + batch_size]
        messages = [
            {
                "to": token,
                "sound": "default",
                "title": title,
                "body": body,
                "data": data or {"source": "le-petit-tou-admin"},
                "priority": "high",
                "badge": 1,
            }
            for token in batch
        ]

        try:
            resp = requests.post(
                EXPO_PUSH_ENDPOINT,
                headers={"Content-Type": "application/json", "Accept": "application/json"},
                json=messages,
                timeout=15,
            )
            if resp.status_code == 200:
                results = resp.json().get("data", [])
                for res in results:
                    if res.get("status") == "ok":
                        success_count += 1
            else:
                print(f"⚠️ Erreur Expo Push ({resp.status_code}) : {resp.text}")
        except Exception as e:
            print(f"❌ Erreur d'envoi de lot : {e}")

    print(f"✅ Notification envoyée avec succès à {success_count}/{len(tokens)} appareil(s) !")


def main():
    parser = argparse.ArgumentParser(description="Envoyer des notifications push Le Petit Tou")
    parser.add_argument("--title", type=str, default="Le Petit Tou Toulouse 🌟", help="Titre de la notification")
    parser.add_argument("--body", type=str, required=True, help="Texte du message")
    parser.add_argument("--type", type=str, choices=["all", "events", "spots"], default="all", help="Cible des abonnés")
    parser.add_argument("--url", type=str, default=None, help="Lien optionnel")

    args = parser.parse_args()

    custom_data = {"type": args.type}
    if args.url:
        custom_data["url"] = args.url

    tokens = fetch_push_tokens(args.type)
    send_expo_push_notifications(tokens, args.title, args.body, custom_data)


if __name__ == "__main__":
    if len(sys.argv) == 1:
        print("💡 Exemple d'utilisation :")
        print('   python3 src/scripts/send_push_notification.py --title "Soirée Petit Tou 🎉" --body "Nouveau lieu secret dévoilé ce soir !" --type events\n')
    else:
        main()
