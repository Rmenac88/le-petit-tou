import json
import unicodedata
import re

d = json.load(open('le-petit-tou/src/constants/dataset.json', encoding='utf-8'))
addrs = d['addresses']
cats = d['categories']

cat_map = {c['id']: c['name'].lower() for c in cats}
cat_slug_map = {c['slug']: c['id'] for c in cats}

print("Categories in DB:", cats)

FILTER_KEYS = {
    'all': [],
    'gourmand-gourmet': ['gourmand', 'restauran', 'bistrot', 'brasserie', 'gastrono', 'manger', 'plat', 'recette'],
    'trinquer-danser': ['trinquer', 'bar', 'biere', 'vin', 'cocktail', 'pub', 'apero', 'fete', 'nuit', 'club', 'cave'],
    'brunch-douceurs': ['brunch', 'patisser', 'boulanger', 'douceur', 'sucre', 'gateau', 'salon de the', 'coffee', 'cafe'],
    'shopping-beaute': ['shopping', 'boutique', 'mode', 'vetement', 'deco', 'maison', 'accessoire', 'friperie', 'bijou'],
    'beaute-bien-etre': ['beaute', 'bien-etre', 'coiffeur', 'spa', 'massage', 'soin', 'institut', 'esthetique', 'barbier'],
    'culture-loisirs': ['culture', 'loisir', 'musee', 'theatre', 'cinema', 'escape', 'exposition', 'art', 'spectacle', 'jeux'],
    'sport-activites': ['sport', 'outdoor', 'fitness', 'yoga', 'pilates', 'escalade', 'danse', 'salle de sport', 'activite'],
    'terrasse': ['terrasse', 'rooftop', 'exterieur', 'patio', 'jardin'],
    'bio-local': ['bio', 'local', 'eco', 'circuit court', 'vegetar', 'vege', 'ecoresponsable'],
    'fait-maison': ['maison', 'artisan', 'traditionnel', 'fait maison'],
    'vie-pratique': ['pratique', 'service', 'coworking', 'transport', 'artisan', 'auto', 'imprimerie', 'pressing', 'reparation']
}

def normalize(s):
    if not s: return ""
    s = unicodedata.normalize('NFD', str(s))
    s = re.sub(r'[\u0300-\u036f]', '', s)
    return s.lower()

for fkey, keywords in FILTER_KEYS.items():
    if fkey == 'all':
        count = len(addrs)
    else:
        norm_key = normalize(fkey)
        matched = []
        for a in addrs:
            # Check cat_id / cat_slug
            cid = a.get('category_id', '')
            cname = cat_map.get(cid, '')
            
            # Combine all text fields
            tags_str = ' '.join(a.get('tags', []))
            crumbs_str = ' '.join(a.get('breadcrumbs', []))
            full_text = normalize(f"{a.get('title','')} {a.get('description','')} {a.get('full_description','')} {tags_str} {crumbs_str} {cname}")
            
            # Match rules
            match = False
            if fkey in cid or fkey in cname:
                match = True
            elif any(normalize(kw) in full_text for kw in keywords):
                match = True
            
            if match:
                matched.append(a)
        count = len(matched)
    print(f"Filter '{fkey}': {count} matching establishments")
