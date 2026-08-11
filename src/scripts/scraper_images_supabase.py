#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
scraper_images_supabase.py
==========================
Scrape toutes les images des établissements de lepetittou.com
et les upload directement dans Supabase Storage (bucket: etablissements).

Usage:
    pip install requests beautifulsoup4 supabase python-dotenv
    python scraper_images_supabase.py

Variables d'environnement requises (fichier .env ou variables système):
    SUPABASE_URL      = https://xxxx.supabase.co
    SUPABASE_KEY      = service_role_key_ici
    BUCKET_NAME       = etablissements    (optionnel, défaut: etablissements)
"""

import os
import sys
import re
import json
import time
import hashlib
import mimetypes
import unicodedata
from urllib.parse import urljoin, urlparse

# Fix stdout encoding for Windows console print
if sys.stdout.encoding != 'utf-8':
    try:
        sys.stdout.reconfigure(encoding='utf-8')
    except Exception:
        pass

from dotenv import load_dotenv
import requests
from bs4 import BeautifulSoup
from supabase import create_client, Client

# ─────────────────────────────────────────────
# 0. Configuration
# ─────────────────────────────────────────────
load_dotenv()

SUPABASE_URL = os.getenv("SUPABASE_URL", "")
SUPABASE_KEY = os.getenv("SUPABASE_KEY", "")
BUCKET_NAME  = os.getenv("BUCKET_NAME", "etablissements")

BASE_URL     = "https://www.lepetittou.com"
SITEMAP_URL  = "https://www.lepetittou.com/sitemap.xml"

# Délai entre chaque requête HTTP (en secondes) pour ne pas surcharger le serveur
REQUEST_DELAY = 1.0

# Chemin du fichier JSON de sortie
OUTPUT_JSON = os.path.join(os.path.dirname(__file__), "etablissements_images.json")

# Nombre maximum d'établissements à scraper (None = tous)
MAX_ETABLISSEMENTS = None

# Headers HTTP réalistes
HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/124.0.0.0 Safari/537.36"
    ),
    "Accept-Language": "fr-FR,fr;q=0.9,en;q=0.8",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
}

# ─────────────────────────────────────────────
# 1. Helpers
# ─────────────────────────────────────────────

def slugify(text: str) -> str:
    """Convertit un texte en slug URL-safe (ASCII, tirets)."""
    text = unicodedata.normalize("NFKD", text)
    text = text.encode("ascii", "ignore").decode("ascii")
    text = re.sub(r"[^\w\s-]", "", text).strip().lower()
    text = re.sub(r"[\s_-]+", "-", text)
    return text


def best_image_url(img_tag) -> str | None:
    """
    Extrait la meilleure URL d'image depuis un tag <img> en gérant le lazy-loading.
    Priorité: data-src > data-lazy-src > srcset (plus grande) > src
    """
    # Attributs courants pour le lazy-loading
    for attr in ("data-src", "data-lazy-src", "data-original", "data-lazy"):
        val = img_tag.get(attr, "").strip()
        if val and val.startswith("http"):
            return val

    # srcset / data-srcset → prendre le plus grand
    for attr in ("data-srcset", "srcset"):
        srcset = img_tag.get(attr, "").strip()
        if srcset:
            best = pick_best_from_srcset(srcset)
            if best:
                return best

    # Fallback sur src classique
    src = img_tag.get("src", "").strip()
    if src and not src.startswith("data:"):
        return src

    return None


def pick_best_from_srcset(srcset: str) -> str | None:
    """
    Parse un attribut srcset et retourne l'URL avec le descriptor de taille le plus élevé.
    Format: 'url 800w, url 1600w' ou 'url 1x, url 2x'
    """
    entries = []
    for part in srcset.split(","):
        part = part.strip()
        if not part:
            continue
        tokens = part.split()
        if len(tokens) >= 2:
            url_part = tokens[0]
            desc = tokens[1]
            # Extraire la valeur numérique (px en w ou x)
            num = re.sub(r"[^\d.]", "", desc)
            try:
                entries.append((float(num), url_part))
            except ValueError:
                entries.append((0, url_part))
        elif len(tokens) == 1:
            entries.append((0, tokens[0]))
    if not entries:
        return None
    entries.sort(key=lambda x: x[0], reverse=True)
    return entries[0][1]


def get_content_type(url: str, response: requests.Response) -> str:
    """Détermine le Content-Type depuis les headers ou l'extension URL."""
    ct = response.headers.get("Content-Type", "").split(";")[0].strip()
    if ct and "image" in ct:
        return ct
    ext = os.path.splitext(urlparse(url).path)[1].lower()
    mime = mimetypes.guess_type(f"file{ext}")[0]
    return mime or "image/jpeg"


def ext_from_content_type(ct: str) -> str:
    """Retourne l'extension de fichier depuis le content-type."""
    mapping = {
        "image/jpeg": ".jpg",
        "image/jpg":  ".jpg",
        "image/png":  ".png",
        "image/gif":  ".gif",
        "image/webp": ".webp",
        "image/avif": ".avif",
        "image/svg+xml": ".svg",
    }
    return mapping.get(ct, ".jpg")


def make_storage_path(etab_slug: str, filename: str) -> str:
    """Construit le chemin Supabase Storage: etablissements/<slug>/<filename>."""
    return f"{etab_slug}/{filename}"

# ─────────────────────────────────────────────
# 2. Supabase helpers
# ─────────────────────────────────────────────

def ensure_bucket(supabase: Client, bucket: str):
    """Crée le bucket s'il n'existe pas déjà (ignoré si déjà présent)."""
    try:
        buckets = supabase.storage.list_buckets()
        bucket_names = [b.name for b in buckets]
        if bucket not in bucket_names:
            supabase.storage.create_bucket(bucket, options={"public": True})
            print(f"  ✅ Bucket '{bucket}' créé.")
        else:
            print(f"  ✅ Bucket '{bucket}' déjà existant.")
    except Exception as e:
        print(f"  ⚠️  Impossible de vérifier/créer le bucket: {e}")


def upload_image_to_supabase(
    supabase: Client,
    bucket: str,
    storage_path: str,
    image_bytes: bytes,
    content_type: str,
) -> str | None:
    """
    Upload une image dans Supabase Storage.
    Retourne l'URL publique ou None en cas d'erreur.
    Si le fichier existe déjà, retourne directement l'URL publique.
    """
    try:
        supabase.storage.from_(bucket).upload(
            path=storage_path,
            file=image_bytes,
            file_options={"content-type": content_type, "upsert": "true"},
        )
        # Construire l'URL publique
        public_url = f"{SUPABASE_URL}/storage/v1/object/public/{bucket}/{storage_path}"
        return public_url
    except Exception as e:
        err_msg = str(e)
        if "already exists" in err_msg or "23505" in err_msg:
            # Fichier déjà présent → retourner l'URL
            public_url = f"{SUPABASE_URL}/storage/v1/object/public/{bucket}/{storage_path}"
            return public_url
        print(f"    ❌ Erreur upload '{storage_path}': {e}")
        return None

# ─────────────────────────────────────────────
# 3. Scraping du sitemap & URLs des établissements
# ─────────────────────────────────────────────

def get_etablissement_urls() -> list[dict]:
    """
    Parcourt le sitemap XML et retourne les URLs des pages d'établissements.
    URL pattern: /le-petit-tou/<sous-categorie>/<slug>/
    On exclut /categories/, /page/, /le-petit-news/, etc.
    """
    print("📡 Récupération du sitemap XML...")
    etablissements = []
    seen = set()

    # Essayer le sitemap principal
    sitemaps_to_check = [SITEMAP_URL]
    
    try:
        resp = requests.get(SITEMAP_URL, headers=HEADERS, timeout=20)
        soup = BeautifulSoup(resp.content, "xml")
        
        # Chercher des sitemapindex (sous-sitemaps)
        sitemap_tags = soup.find_all("sitemap")
        if sitemap_tags:
            for sm in sitemap_tags:
                loc = sm.find("loc")
                if loc:
                    sitemaps_to_check.append(loc.text.strip())
            sitemaps_to_check.remove(SITEMAP_URL)  # déjà dans la liste
        
        # Traiter tous les sitemaps
        for sitemap_url in sitemaps_to_check:
            try:
                r = requests.get(sitemap_url, headers=HEADERS, timeout=20)
                s = BeautifulSoup(r.content, "xml")
                urls = s.find_all("url")
                for url_tag in urls:
                    loc = url_tag.find("loc")
                    if not loc:
                        continue
                    url = loc.text.strip()
                    # Filtrer les pages d'établissements
                    # Pattern: /le-petit-tou/<slug>/ avec exactement 3 segments non vides
                    path = urlparse(url).path.rstrip("/")
                    parts = [p for p in path.split("/") if p]
                    if (
                        len(parts) == 3
                        and parts[0] == "le-petit-tou"
                        and parts[1] not in ("categories",)
                        and url not in seen
                    ):
                        seen.add(url)
                        etablissements.append({
                            "url": url,
                            "slug": parts[2],
                            "category_slug": parts[1],
                        })
            except Exception as e:
                print(f"  ⚠️  Erreur sitemap {sitemap_url}: {e}")
                time.sleep(REQUEST_DELAY)
    
    except Exception as e:
        print(f"  ❌ Erreur récupération sitemap: {e}")
        # Fallback: crawl des catégories principales
        etablissements = fallback_crawl_categories()
    
    print(f"  📋 {len(etablissements)} établissements trouvés.")
    return etablissements


def fallback_crawl_categories() -> list[dict]:
    """
    Fallback: crawl manuel des catégories principales pour extraire les liens.
    """
    print("  🔄 Fallback: crawl des catégories principales...")
    etablissements = []
    seen = set()

    # Récupérer toutes les catégories depuis la homepage
    try:
        resp = requests.get(BASE_URL, headers=HEADERS, timeout=20)
        soup = BeautifulSoup(resp.content, "html.parser")
        category_links = set()
        
        for a in soup.find_all("a", href=True):
            href = a["href"]
            if "/le-petit-tou/categories/" in href:
                full = urljoin(BASE_URL, href)
                category_links.add(full)
        
        print(f"    📂 {len(category_links)} catégories trouvées.")
        
        for cat_url in sorted(category_links):
            time.sleep(REQUEST_DELAY)
            try:
                r = requests.get(cat_url, headers=HEADERS, timeout=20)
                s = BeautifulSoup(r.content, "html.parser")
                
                for a in s.find_all("a", href=True):
                    href = a["href"]
                    path = urlparse(href).path.rstrip("/")
                    parts = [p for p in path.split("/") if p]
                    if (
                        len(parts) == 3
                        and parts[0] == "le-petit-tou"
                        and parts[1] not in ("categories",)
                    ):
                        full = urljoin(BASE_URL, href)
                        if full not in seen:
                            seen.add(full)
                            etablissements.append({
                                "url": full,
                                "slug": parts[2],
                                "category_slug": parts[1],
                            })
            except Exception as e:
                print(f"    ⚠️  Erreur catégorie {cat_url}: {e}")
    
    except Exception as e:
        print(f"    ❌ Erreur fallback crawl: {e}")
    
    return etablissements

# ─────────────────────────────────────────────
# 4. Extraction des images d'une page établissement
# ─────────────────────────────────────────────

def scrape_etablissement_page(url: str, etab_slug: str) -> dict:
    """
    Scrape une page d'établissement et retourne:
    - name: str
    - url: str
    - image_couverture_url: str | None (URL originale)
    - galerie_photos_urls: list[str] (URLs originales)
    - description: str
    """
    result = {
        "name": etab_slug,
        "url": url,
        "image_couverture_url": None,
        "galerie_photos_urls": [],
        "description": "",
        "adresse": "",
        "telephone": "",
        "site_web": "",
    }
    
    try:
        resp = requests.get(url, headers=HEADERS, timeout=20)
        soup = BeautifulSoup(resp.content, "html.parser")
        
        # ── Nom de l'établissement ──
        h1 = soup.find("h1")
        if h1:
            result["name"] = h1.get_text(strip=True)
        
        # ── Description ──
        # Chercher le contenu principal (balises communes WordPress)
        for sel in [".entry-content", ".post-content", "article .content", ".description"]:
            div = soup.select_one(sel)
            if div:
                result["description"] = div.get_text(" ", strip=True)[:1000]
                break
        
        # ── Image de couverture ──
        # 1. Open Graph (souvent la meilleure image)
        og_image = soup.find("meta", property="og:image")
        if og_image and og_image.get("content"):
            result["image_couverture_url"] = og_image["content"].strip()
        
        # 2. Featured image / hero image
        if not result["image_couverture_url"]:
            for sel in [
                ".featured-image img",
                ".hero img",
                ".post-thumbnail img",
                ".entry-thumbnail img",
                "article img:first-of-type",
                ".wp-post-image",
            ]:
                img = soup.select_one(sel)
                if img:
                    url_img = best_image_url(img)
                    if url_img:
                        result["image_couverture_url"] = urljoin(url, url_img)
                        break
        
        # ── Galerie de photos ──
        gallery_urls = set()
        
        # 1. Galerie WordPress/ACF standard
        gallery_selectors = [
            ".gallery img",
            ".galerie img",
            ".photos img",
            ".slider img",
            ".swiper-slide img",
            ".carousel img",
            '[class*="gallery"] img',
            '[class*="galerie"] img',
            '[class*="slider"] img',
            '[class*="photo"] img',
            "figure img",
        ]
        for sel in gallery_selectors:
            for img in soup.select(sel):
                url_img = best_image_url(img)
                if url_img:
                    full = urljoin(url, url_img)
                    # Exclure les images de navigation / logo / icônes (trop petites)
                    if is_valid_content_image(img, full):
                        gallery_urls.add(full)
        
        # 2. Liens vers images dans la page
        for a in soup.find_all("a", href=True):
            href = a["href"]
            if re.search(r"\.(jpg|jpeg|png|webp|avif)(\?.*)?$", href, re.IGNORECASE):
                full = urljoin(url, href)
                gallery_urls.add(full)
        
        # 3. Toutes les images de l'article (fallback)
        article = soup.find("article") or soup.find("main") or soup
        for img in article.find_all("img"):
            url_img = best_image_url(img)
            if url_img:
                full = urljoin(url, url_img)
                if is_valid_content_image(img, full):
                    gallery_urls.add(full)
        
        # Exclure l'image de couverture des URLs de galerie
        if result["image_couverture_url"] in gallery_urls:
            gallery_urls.remove(result["image_couverture_url"])
        
        result["galerie_photos_urls"] = sorted(gallery_urls)
        
        # ── Informations pratiques ──
        # Adresse
        for sel in [".adresse", "[itemprop='address']", ".address", ".lieu"]:
            el = soup.select_one(sel)
            if el:
                result["adresse"] = el.get_text(strip=True)
                break
        
        # Téléphone
        for sel in ["[href^='tel:']", ".telephone", ".phone"]:
            el = soup.select_one(sel)
            if el:
                result["telephone"] = el.get_text(strip=True) or el.get("href", "").replace("tel:", "")
                break
        
        # Site web externe
        for a in soup.find_all("a", href=True, rel=True):
            if "nofollow" in (a.get("rel") or []) and a["href"].startswith("http"):
                parsed = urlparse(a["href"])
                if parsed.netloc and "lepetittou" not in parsed.netloc:
                    result["site_web"] = a["href"]
                    break
    
    except Exception as e:
        print(f"    ⚠️  Erreur scraping {url}: {e}")
    
    return result


def is_valid_content_image(img_tag, full_url: str) -> bool:
    """
    Vérifie qu'une image est bien une photo de contenu
    (exclut logos, icônes, trackers, images trop petites).
    """
    # Exclure par URL
    exclude_patterns = [
        "logo", "icon", "favicon", "avatar", "gravatar",
        "pixel", "tracker", "analytics", "1x1", "spacer",
        "badge", "button", "arrow", "chevron", "sprite",
        "wp-includes", "plugins/", "themes/",
    ]
    url_lower = full_url.lower()
    if any(pat in url_lower for pat in exclude_patterns):
        return False
    
    # Exclure les data-URI
    if full_url.startswith("data:"):
        return False
    
    # Exclure SVG (souvent icônes)
    if full_url.endswith(".svg"):
        return False
    
    # Vérifier les attributs width/height si présents
    try:
        w = int(img_tag.get("width", 0))
        h = int(img_tag.get("height", 0))
        if (w > 0 and w < 100) or (h > 0 and h < 100):
            return False
    except (ValueError, TypeError):
        pass
    
    return True

# ─────────────────────────────────────────────
# 5. Upload d'une image vers Supabase
# ─────────────────────────────────────────────

def download_and_upload_image(
    supabase: Client,
    image_url: str,
    etab_slug: str,
    filename_prefix: str,
) -> str | None:
    """
    Télécharge une image et l'upload dans Supabase Storage.
    Retourne l'URL publique Supabase ou None en cas d'échec.
    """
    try:
        # Télécharger l'image
        resp = requests.get(image_url, headers=HEADERS, timeout=30, stream=True)
        if resp.status_code != 200:
            print(f"      ⚠️  HTTP {resp.status_code} pour {image_url}")
            return None
        
        content_type = get_content_type(image_url, resp)
        if "image" not in content_type:
            return None
        
        image_bytes = resp.content
        
        # Générer un nom de fichier unique basé sur un hash de l'URL
        url_hash = hashlib.md5(image_url.encode()).hexdigest()[:8]
        ext = ext_from_content_type(content_type)
        filename = f"{filename_prefix}_{url_hash}{ext}"
        
        storage_path = make_storage_path(etab_slug, filename)
        
        # Upload
        public_url = upload_image_to_supabase(
            supabase, BUCKET_NAME, storage_path, image_bytes, content_type
        )
        return public_url
    
    except requests.exceptions.Timeout:
        print(f"      ⚠️  Timeout téléchargement: {image_url}")
        return None
    except Exception as e:
        print(f"      ⚠️  Erreur download/upload '{image_url}': {e}")
        return None

# ─────────────────────────────────────────────
# 6. Pipeline principal
# ─────────────────────────────────────────────

def main():
    print("=" * 60)
    print("🚀 Scraper Images Le Petit Tou → Supabase Storage")
    print("=" * 60)
    
    # Vérification configuration
    if not SUPABASE_URL or not SUPABASE_KEY:
        print("❌ ERREUR: SUPABASE_URL et SUPABASE_KEY sont requis.")
        print("   Créez un fichier .env avec ces variables ou exportez-les.")
        print("\n   Exemple .env:")
        print("   SUPABASE_URL=https://xxxx.supabase.co")
        print("   SUPABASE_KEY=votre_service_role_key")
        return
    
    # Connexion Supabase
    print(f"\n🔌 Connexion à Supabase: {SUPABASE_URL}")
    supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)
    
    # Vérifier / créer le bucket
    print(f"\n📦 Vérification du bucket '{BUCKET_NAME}'...")
    ensure_bucket(supabase, BUCKET_NAME)
    
    # Récupérer les URLs des établissements
    print("\n🕷️  Découverte des établissements...")
    etablissements_meta = get_etablissement_urls()
    
    if MAX_ETABLISSEMENTS:
        etablissements_meta = etablissements_meta[:MAX_ETABLISSEMENTS]
        print(f"  ⚙️  Limité à {MAX_ETABLISSEMENTS} établissements (MAX_ETABLISSEMENTS).")
    
    if not etablissements_meta:
        print("❌ Aucun établissement trouvé. Vérifiez la connexion au site.")
        return
    
    # Résultats finaux
    results = []
    total = len(etablissements_meta)
    
    print(f"\n📸 Traitement de {total} établissements...\n")
    
    for idx, meta in enumerate(etablissements_meta, 1):
        url     = meta["url"]
        slug    = meta["slug"]
        cat_slug = meta.get("category_slug", "divers")
        etab_slug = f"{cat_slug}/{slug}"
        
        print(f"[{idx:4d}/{total}] 🏪 {slug}")
        print(f"         URL: {url}")
        
        # Scraper la page
        time.sleep(REQUEST_DELAY)
        page_data = scrape_etablissement_page(url, slug)
        
        # Résultat pour cet établissement
        etab_result = {
            "id":               slug,
            "slug":             slug,
            "category_slug":    cat_slug,
            "name":             page_data["name"],
            "url_originale":    url,
            "description":      page_data["description"],
            "adresse":          page_data["adresse"],
            "telephone":        page_data["telephone"],
            "site_web":         page_data["site_web"],
            "image_couverture_url":   None,
            "image_couverture_originale": page_data["image_couverture_url"],
            "galerie_photos_urls":    [],
            "galerie_originale_urls": page_data["galerie_photos_urls"],
            "nb_photos":        0,
            "erreurs":          [],
        }
        
        # ── Upload image de couverture ──
        if page_data["image_couverture_url"]:
            print(f"         🖼️  Image couverture: {page_data['image_couverture_url'][:80]}...")
            supabase_url = download_and_upload_image(
                supabase,
                page_data["image_couverture_url"],
                etab_slug,
                "cover",
            )
            if supabase_url:
                etab_result["image_couverture_url"] = supabase_url
                print(f"         ✅ Cover uploadé → {supabase_url}")
            else:
                etab_result["erreurs"].append(f"Cover upload échoué: {page_data['image_couverture_url']}")
        else:
            print("         ⚠️  Pas d'image de couverture trouvée.")
        
        # ── Upload galerie ──
        nb_galerie = len(page_data["galerie_photos_urls"])
        if nb_galerie > 0:
            print(f"         🖼️  Galerie: {nb_galerie} photo(s)")
            for i, img_url in enumerate(page_data["galerie_photos_urls"], 1):
                time.sleep(0.3)  # Délai léger entre les images
                supabase_url = download_and_upload_image(
                    supabase,
                    img_url,
                    etab_slug,
                    f"gallery_{i:02d}",
                )
                if supabase_url:
                    etab_result["galerie_photos_urls"].append(supabase_url)
                    print(f"           [{i:02d}] ✅ {supabase_url}")
                else:
                    etab_result["erreurs"].append(f"Galerie {i} upload échoué: {img_url}")
                    print(f"           [{i:02d}] ❌ Échec: {img_url[:60]}...")
        
        etab_result["nb_photos"] = (
            (1 if etab_result["image_couverture_url"] else 0)
            + len(etab_result["galerie_photos_urls"])
        )
        
        results.append(etab_result)
        
        # Sauvegarde incrémentale (toutes les 10 fiches)
        if idx % 10 == 0:
            save_json(results, OUTPUT_JSON)
            print(f"\n  💾 Sauvegarde intermédiaire: {OUTPUT_JSON}\n")
    
    # ── Sauvegarde finale ──
    save_json(results, OUTPUT_JSON)
    
    # ── Statistiques ──
    total_covers  = sum(1 for r in results if r["image_couverture_url"])
    total_gallery = sum(len(r["galerie_photos_urls"]) for r in results)
    total_errors  = sum(len(r["erreurs"]) for r in results)
    
    print("\n" + "=" * 60)
    print("✅ Scraping terminé !")
    print("=" * 60)
    print(f"  🏪 Établissements traités : {len(results)}")
    print(f"  🖼️  Images de couverture   : {total_covers}")
    print(f"  📸 Photos de galerie      : {total_gallery}")
    print(f"  📸 Total photos uploadées : {total_covers + total_gallery}")
    print(f"  ❌ Erreurs                : {total_errors}")
    print(f"  💾 Fichier JSON           : {OUTPUT_JSON}")
    print("=" * 60)


def save_json(data: list, path: str):
    """Sauvegarde les données en JSON avec encodage UTF-8."""
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)


# ─────────────────────────────────────────────
# Point d'entrée
# ─────────────────────────────────────────────
if __name__ == "__main__":
    main()
