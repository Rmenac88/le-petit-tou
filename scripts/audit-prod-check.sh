#!/usr/bin/env bash
# Vérifie, avec la seule clé publique (anon) de l'appli, que la base de PRODUCTION est bien verrouillée.
# Usage : EXPO_PUBLIC_SUPABASE_URL=... EXPO_PUBLIC_SUPABASE_ANON_KEY=... [OLD_ADMIN_CODE=...] scripts/audit-prod-check.sh
# - Lectures seules, sauf le test « écriture du catalogue » qui réécrit l'id d'une ligne par sa propre valeur
#   (aucun changement de contenu) ; il est refusé quand la base est correctement protégée.
# - OLD_ADMIN_CODE : ancien code admin (celui qui a fuité dans l'historique Git) ; il doit être REFUSÉ. Jamais affiché.
set -u
URL="${EXPO_PUBLIC_SUPABASE_URL:?URL manquante}"
KEY="${EXPO_PUBLIC_SUPABASE_ANON_KEY:?clé manquante}"
H=(-H "apikey: $KEY" -H "Authorization: Bearer $KEY" -H "Content-Type: application/json")
fail=0
check() { # nom, attendu(0/1), résultat(0/1)
  if [ "$2" = "$3" ]; then echo "PASS  $1"; else echo "FAIL  $1"; fail=1; fi
}

# 1. Tables de données utilisateur : aucune lecture directe (un 200 même vide = le droit de lecture existe encore)
for t in user_place_discoveries user_discount_cards discount_card_uses place_suggestions user_push_tokens address_views admin_secrets admin_login_attempts spot_user_likes; do
  code=$(curl -s -o /tmp/lpt_probe.json -w "%{http_code}" "${H[@]}" "$URL/rest/v1/$t?select=*&limit=1")
  # après la migration 006 le droit de lecture est retiré : réponse attendue 401/403 (ou 404 si la table n'existe pas)
  leaked=1; case "$code" in 401|403|404) leaked=0;; esac
  check "lecture anonyme impossible : $t (HTTP $code)" 0 $leaked
done

# 2. Catalogue : écriture directe refusée (nombre de lignes touchées = 0)
for t in addresses categories events sponsored_partners; do
  id=$(curl -s "${H[@]}" "$URL/rest/v1/$t?select=id&limit=1" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d[0]['id'] if d else '')")
  [ -z "$id" ] && { echo "SKIP  $t vide"; continue; }
  curl -s -o /dev/null -D /tmp/lpt_h.txt -X PATCH "${H[@]}" -H "Prefer: return=minimal,count=exact" "$URL/rest/v1/$t?id=eq.$id" -d "{\"id\":\"$id\"}"
  rng=$(grep -i content-range /tmp/lpt_h.txt | tr -d '\r' | sed 's/.*\///')
  status=$(head -1 /tmp/lpt_h.txt | tr -d '\r')
  writable=0; [ "$rng" = "1" ] && writable=1
  check "écriture directe refusée : $t ($status)" 0 $writable
done

# 3. Code admin : un mauvais code est refusé ; l'ancien code (si fourni) aussi
r=$(curl -s -X POST "${H[@]}" "$URL/rest/v1/rpc/verify_admin_access" -d '{"access_code":"audit-mauvais-code"}')
check "mauvais code admin refusé" 0 $([ "$r" = "true" ] && echo 1 || echo 0)
if [ -n "${OLD_ADMIN_CODE:-}" ]; then
  r=$(curl -s -X POST "${H[@]}" "$URL/rest/v1/rpc/verify_admin_access" -d "{\"access_code\":\"$OLD_ADMIN_CODE\"}")
  check "ANCIEN code admin refusé (rotation effective)" 0 $([ "$r" = "true" ] && echo 1 || echo 0)
fi

# 4. Fonctions attendues présentes (006 appliquée)
r=$(curl -s -X POST "${H[@]}" "$URL/rest/v1/rpc/admin_write" -d '{"p_code":"audit-mauvais-code","p_table":"events","p_op":"insert","p_record":{"title":"x"}}')
check "fonction déployée et refuse un mauvais code : admin_write" 1 $(echo "$r" | grep -q '"forbidden"' && echo 1 || echo 0)
for f in get_my_discoveries get_my_card_usage delete_my_data get_push_preferences; do
  code=$(curl -s -o /dev/null -w "%{http_code}" -X POST "${H[@]}" "$URL/rest/v1/rpc/$f" -d '{}')
  present=1; [ "$code" = "404" ] && present=0
  check "fonction déployée : $f (HTTP $code)" 1 $present
done

# 4b. Notifications (007) : tables fermées
for t in push_devices push_outbox push_deliveries push_requests; do
  code=$(curl -s -o /dev/null -w "%{http_code}" "${H[@]}" "$URL/rest/v1/$t?select=*&limit=1")
  leaked=1; case "$code" in 401|403|404) leaked=0;; esac
  check "lecture anonyme impossible : $t (HTTP $code)" 0 $leaked
done

# 5. Inscriptions inutiles : l'appli n'a aucun écran de connexion
settings=$(curl -s "$URL/auth/v1/settings" -H "apikey: $KEY")
for p in email google; do
  on=$(echo "$settings" | python3 -c "import sys,json; print(1 if json.load(sys.stdin)['external'].get('$p') else 0)")
  check "inscription par $p désactivée (inutile pour l'appli)" 0 $on
done

echo; [ $fail = 0 ] && echo "RÉSULTAT : tout est conforme" || echo "RÉSULTAT : $(date +%F) — des contrôles ÉCHOUENT (voir FAIL ci-dessus)"
exit $fail
