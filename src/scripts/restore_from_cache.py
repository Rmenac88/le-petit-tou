#!/usr/bin/env python3
# -*- coding: utf-8 -*-
import sys, json
sys.stdout.reconfigure(encoding='utf-8')

data = json.load(open('etablissements_images.json', encoding='utf-8'))
cache = json.load(open('geocode_cache.json', encoding='utf-8'))

print(f'Cache size: {len(cache)} entries')
before = len([x for x in data if x.get('lat') and x.get('lng')])
print(f'Data geocoded before: {before}')

applied = 0
for etab in data:
    if etab.get('lat') and etab.get('lng'):
        continue
    addr = etab.get('adresse', '').strip()
    name = etab.get('name', etab.get('slug', ''))
    if not addr:
        addr = name + ', Toulouse, France'

    # Try all possible cache keys
    found = False
    for key in ['photon:' + addr, 'nom:' + addr, addr]:
        if key in cache:
            etab['lat'] = cache[key]['lat']
            etab['lng'] = cache[key]['lng']
            applied += 1
            found = True
            break

after = len([x for x in data if x.get('lat') and x.get('lng')])
print(f'Applied from cache: {applied}')
print(f'Data geocoded after: {after}/790')

with open('etablissements_images.json', 'w', encoding='utf-8') as f:
    json.dump(data, f, ensure_ascii=False, indent=2)
print('Saved!')
