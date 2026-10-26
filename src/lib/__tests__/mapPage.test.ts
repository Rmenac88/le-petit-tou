import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {
  MAP_PAGE_LOGIC,
  MAP_PAGE_SCRIPT,
  getWebMapHtml,
  TOULOUSE_LAT,
  TOULOUSE_LNG,
} from '../../components/views/map/mapboxHtmlTemplate.ts';

const html = getWebMapHtml('pk.jeton-de-test');

const loadLogic = (): any => {
  const ctx: any = vm.createContext({});
  vm.runInContext(`${MAP_PAGE_LOGIC}; this.api = { iconKeyFor, spotsSignature, spotsToGeoJSON };`, ctx);
  return ctx.api;
};

test('le script de la page est du JavaScript valide une fois le jeton et la position insérés', () => {
  const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((m) => m[1]);
  assert.equal(scripts.length, 1);
  assert.doesNotThrow(() => new vm.Script(scripts[0]));
  assert.ok(html.includes("mapboxgl.accessToken = 'pk.jeton-de-test'"));
  assert.ok(html.includes(`center: [${TOULOUSE_LNG}, ${TOULOUSE_LAT}]`));
  assert.ok(!html.includes('__TOKEN__') && !html.includes('__LNG__') && !html.includes('__LAT__'));
});

test('la carte reste légère : plus de globe, de brouillard, de Supercluster ni de ressource tierce', () => {
  assert.ok(html.includes("projection: 'mercator'"));
  assert.ok(!/globe|setFog|Supercluster|unpkg/i.test(html));
  // aucune ressource externe en dehors de Mapbox
  const external = [...html.matchAll(/(?:src|href)="(https?:[^"]+)"/g)].map((m) => m[1]);
  assert.ok(external.length > 0 && external.every((u) => u.startsWith('https://api.mapbox.com/')), external.join(' '));
  // le regroupement est fait par Mapbox (worker), pas par du code sur le fil principal
  assert.ok(MAP_PAGE_SCRIPT.includes('cluster: true'));
  // aucun repère HTML par adresse : un seul élément HTML pour l'adresse sélectionnée
  assert.ok(!MAP_PAGE_SCRIPT.includes('createSpotMarkerElement'));
  assert.equal((MAP_PAGE_SCRIPT.match(/new mapboxgl\.Marker/g) ?? []).length, 2); // sélection + position de l'utilisateur
});

test('les bâtiments 3D ne sont ajoutés que par le mode relief, jamais au chargement du style', () => {
  const setup = MAP_PAGE_SCRIPT.slice(MAP_PAGE_SCRIPT.indexOf('function setupLayers'), MAP_PAGE_SCRIPT.indexOf('function maybeReady'));
  assert.ok(!setup.includes('add-3d-buildings') && !setup.includes('fill-extrusion'));
  assert.ok(MAP_PAGE_SCRIPT.includes("ensureBuildings(true)"));
});

test('aucun message n\'est envoyé à chaque image de la carte (le pitch ne notifie que lors d\'un changement)', () => {
  const pitch = MAP_PAGE_SCRIPT.slice(MAP_PAGE_SCRIPT.indexOf("map.on('pitch'"), MAP_PAGE_SCRIPT.indexOf("map.on('pitchend'"));
  assert.ok(pitch.includes('is3d !== last3d'));
  assert.ok(!MAP_PAGE_SCRIPT.includes("map.on('zoom'") && !MAP_PAGE_SCRIPT.includes("map.on('move'"));
});

test('le protocole avec l\'appli est complet', () => {
  for (const type of ['UPDATE_SPOTS', 'RESET_TOULOUSE', 'FOCUS_SPOT', 'SELECT_SPOT', 'DESELECT_SPOT', 'SET_3D_MODE', 'USER_LOCATION', 'SHOW_ROUTE', 'FETCH_ROUTE', 'CLEAR_ROUTE']) {
    assert.ok(MAP_PAGE_SCRIPT.includes(`data.type === '${type}'`), `message reçu manquant : ${type}`);
  }
  for (const type of ['SPOT_CLICKED', 'MAP_CLICKED', 'MAP_READY', 'PITCH_CHANGED', 'ROUTE_READY', 'ROUTE_ERROR']) {
    assert.ok(MAP_PAGE_SCRIPT.includes(`type: '${type}'`), `message émis manquant : ${type}`);
  }
});

test('catégorie → icône : les 7 catégories de l\'appli, repli sur « food » (y compris pour un nom piégé)', () => {
  const { iconKeyFor } = loadLogic();
  for (const k of ['food', 'drinks', 'shopping', 'beauty', 'culture', 'sport', 'services']) assert.equal(iconKeyFor(k), k);
  for (const bad of [undefined, null, '', 'brunch', 'constructor', '__proto__', 'toString']) assert.equal(iconKeyFor(bad), 'food');
  // chaque catégorie a une pastille et une icône dessinées par la page
  for (const k of ['food', 'drinks', 'shopping', 'beauty', 'culture', 'sport', 'services']) {
    assert.ok(MAP_PAGE_SCRIPT.includes(`${k}: '#`), `couleur manquante : ${k}`);
    assert.ok(MAP_PAGE_SCRIPT.includes(`  ${k}: '<`), `icône manquante : ${k}`);
  }
});

test('signature : stable pour la même liste, différente dès qu\'une adresse visible change', () => {
  const { spotsSignature } = loadLogic();
  const a = [{ id: '1', lat: 43.6, lng: 1.44, cat: 'food', name: 'A', rating: 4.5 }, { id: '2', lat: 43.61, lng: 1.45, cat: 'drinks', name: 'B' }];
  const same = JSON.parse(JSON.stringify(a));
  assert.equal(spotsSignature(a), spotsSignature(same));
  assert.notEqual(spotsSignature(a), spotsSignature(a.slice(0, 1)));
  const moved = JSON.parse(JSON.stringify(a)); moved[1].lat = 43.62;
  assert.notEqual(spotsSignature(a), spotsSignature(moved));
  const renamed = JSON.parse(JSON.stringify(a)); renamed[0].name = 'Autre';
  assert.notEqual(spotsSignature(a), spotsSignature(renamed));
  assert.equal(spotsSignature([]), '0:5381');
});

test('adresses → GeoJSON : coordonnées invalides écartées, 2 m d\'écart entre adresses superposées', () => {
  const { spotsToGeoJSON } = loadLogic();
  const spots = [
    { id: 'a', lat: 43.6, lng: 1.44, cat: 'food', rating: 4.9 },
    { id: 'b', lat: 43.6, lng: 1.44, cat: 'drinks' },
    { id: 'c', lat: 43.6, lng: 1.44, cat: 'inconnue' },
    { id: 'd', lat: 'x', lng: 1.5, cat: 'food' },
    { id: 'e', lat: NaN, lng: 1.5 },
    { id: 'f', lat: 43.7, lng: 1.5, category: 'sport' },
    null,
  ];
  // les objets venant du contexte vm n'ont pas les mêmes prototypes : on compare des données simples
  const { collection, byId } = JSON.parse(JSON.stringify(spotsToGeoJSON(spots)));
  assert.equal(collection.features.length, 4);
  assert.deepEqual(Object.keys(byId).sort(), ['a', 'b', 'c', 'f']);
  const [first, second, third] = collection.features;
  assert.deepEqual(first.geometry.coordinates, [1.44, 43.6]); // la première reste en place
  const meters = (p: number[], q: number[]) => Math.hypot((p[0] - q[0]) * 80400, (p[1] - q[1]) * 111000);
  assert.ok(meters(first.geometry.coordinates, second.geometry.coordinates) > 0.5);
  assert.ok(meters(first.geometry.coordinates, second.geometry.coordinates) < 2.5);
  assert.ok(meters(second.geometry.coordinates, third.geometry.coordinates) > 0.5);
  assert.equal(collection.features[2].properties.k, 'food'); // catégorie inconnue -> food
  assert.equal(collection.features[3].properties.k, 'sport'); // `category` utilisée si `cat` absent
  assert.equal(first.properties.rating, 4.9);
  assert.equal(second.properties.rating, 4.8); // note absente -> 4.8 comme avant
  assert.equal(typeof first.properties.id, 'string');
  assert.equal(byId.b.fixedLng, second.geometry.coordinates[0]);
});

test('la liste de 790 adresses est convertie en quelques millisecondes', () => {
  const { spotsToGeoJSON, spotsSignature } = loadLogic();
  const spots = Array.from({ length: 790 }, (_, i) => ({ id: `id-${i}`, lat: 43.55 + (i % 40) * 0.003, lng: 1.4 + Math.floor(i / 40) * 0.004, cat: 'food', name: `Adresse ${i}`, rating: 4 }));
  const t0 = performance.now();
  spotsToGeoJSON(spots);
  spotsSignature(spots);
  assert.ok(performance.now() - t0 < 100, `trop lent : ${performance.now() - t0} ms`);
});
