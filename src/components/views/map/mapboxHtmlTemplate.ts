/**
 * Page Mapbox GL JS de la carte (iframe sur le web, WebView sur téléphone).
 *
 * Conçue pour les téléphones d'entrée de gamme :
 *  - les adresses sont des couches WebGL (regroupement fait par Mapbox dans un worker, hors du fil principal) et non
 *    plus des centaines d'éléments HTML déplacés à chaque image ; seul l'élément sélectionné est un repère HTML ;
 *  - projection plane (pas de globe ni de brouillard), relief des bâtiments uniquement en mode 3D ;
 *  - aucune bibliothèque externe en plus de Mapbox (plus de Supercluster), aucun message à chaque image.
 *
 * Protocole avec l'appli (inchangé) : messages reçus UPDATE_SPOTS, RESET_TOULOUSE, FOCUS_SPOT, SELECT_SPOT,
 * DESELECT_SPOT, SET_3D_MODE, USER_LOCATION, SHOW_ROUTE, FETCH_ROUTE, CLEAR_ROUTE ; messages émis SPOT_CLICKED,
 * MAP_CLICKED, MAP_READY, PITCH_CHANGED, ROUTE_READY, ROUTE_ERROR.
 *
 * Le code de la page est de l'ES5 volontairement : ni accent grave ni « dollar-accolade » ni barre oblique inverse
 * (il vit dans une chaîne de gabarit), pour rester valide sur toutes les WebView.
 */

export const TOULOUSE_LAT = 43.6047;
export const TOULOUSE_LNG = 1.4442;
export const MAPBOX_ACCESS_TOKEN = process.env.EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN || "";

/** Fond de la page et de la WebView : évite un éclair sombre avant l'affichage des tuiles. */
export const MAP_BACKGROUND = '#F2EEE8';

/**
 * Logique pure de la page (testée sous Node) : catégorie → icône, signature d'une liste, adresses → GeoJSON.
 */
export const MAP_PAGE_LOGIC = `
var ICON_KEYS = { food: 1, drinks: 1, shopping: 1, beauty: 1, culture: 1, sport: 1, services: 1 };
function iconKeyFor(cat) {
  return Object.prototype.hasOwnProperty.call(ICON_KEYS, cat) ? cat : 'food';
}

function isFiniteNumber(n) {
  return typeof n === 'number' && isFinite(n);
}

/** Signature de ce qui se voit sur la carte : si elle ne change pas, la carte n'est pas redessinée. */
function spotsSignature(spots) {
  var h = 5381;
  for (var i = 0; i < spots.length; i++) {
    var s = spots[i] || {};
    var str = String(s.id) + '|' + s.lat + '|' + s.lng + '|' + (s.cat || s.category || '') + '|' + (s.rating || '') + '|' + (s.name || '');
    for (var j = 0; j < str.length; j++) {
      h = ((h << 5) + h + str.charCodeAt(j)) | 0;
    }
  }
  return spots.length + ':' + h;
}

/** Adresses -> GeoJSON. Décale de 2 m les adresses qui partagent exactement la même position. */
function spotsToGeoJSON(spots) {
  var byId = {};
  var groups = {};
  var order = [];
  for (var i = 0; i < spots.length; i++) {
    var s = spots[i];
    if (s && isFiniteNumber(s.lat) && isFiniteNumber(s.lng)) {
      var k = s.lat.toFixed(5) + ',' + s.lng.toFixed(5);
      if (!groups[k]) { groups[k] = []; order.push(k); }
      groups[k].push(s);
    }
  }
  var features = [];
  for (var g = 0; g < order.length; g++) {
    var group = groups[order[g]];
    for (var j = 0; j < group.length; j++) {
      var sp = group[j];
      var lat = sp.lat;
      var lng = sp.lng;
      if (group.length > 1 && j > 0) {
        var angle = (j * 2 * Math.PI) / group.length;
        lat += (2.0 * Math.sin(angle)) / 111000;
        lng += (2.0 * Math.cos(angle)) / 80400;
      }
      sp.fixedLat = lat;
      sp.fixedLng = lng;
      byId[String(sp.id)] = sp;
      features.push({
        type: 'Feature',
        properties: {
          id: String(sp.id),
          k: iconKeyFor(sp.cat || sp.category),
          rating: Number(sp.rating) || 4.8
        },
        geometry: { type: 'Point', coordinates: [lng, lat] }
      });
    }
  }
  return { collection: { type: 'FeatureCollection', features: features }, byId: byId };
}
`;

/** Script principal de la page (carte, couches, messages). */
export const MAP_PAGE_SCRIPT = `
var map = null;
var mapLoaded = false;
var layersReady = false;
var readySent = false;
var pendingSpots = null;
var lastSignature = '';
var spotsById = {};
var currentSelectedId = null;
var selectedMarker = null;
var userMarker = null;
var buildingsAdded = false;
var last3d = false;

var PIN_COLORS = {
  food: '#E84A5F', drinks: '#F2B835', shopping: '#6C4AB6', beauty: '#E84A5F',
  culture: '#1FA67A', sport: '#6C4AB6', services: '#6A6A78'
};
var ICON_PATHS = {
  food: '<path d="M18 2v6a3 3 0 0 1-3 3 3 3 0 0 1-3-3V2"/><path d="M15 2v19"/><path d="M5 2v4a3 3 0 0 0 3 3v12"/><path d="M9 2v4"/>',
  drinks: '<path d="M17 8h1a4 4 0 1 1 0 8h-1"/><path d="M3 8h14v9a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4Z"/><line x1="6" y1="2" x2="6" y2="4"/><line x1="10" y1="2" x2="10" y2="4"/><line x1="14" y1="2" x2="14" y2="4"/>',
  shopping: '<path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z"/><path d="M3 6h18"/><path d="M16 10a4 4 0 0 1-8 0"/>',
  beauty: '<path d="m12 3-1.9 5.8a2 2 0 0 1-1.3 1.3L3 12l5.8 1.9a2 2 0 0 1 1.3 1.3L12 21l1.9-5.8a2 2 0 0 1 1.3-1.3L21 12l-5.8-1.9a2 2 0 0 1-1.3-1.3L12 3Z"/>',
  sport: '<path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/><path d="M4 22h16"/><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"/><path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"/><path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"/>',
  culture: '<circle cx="12" cy="12" r="10"/><polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76"/>',
  services: '<rect width="20" height="14" x="2" y="7" rx="2" ry="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/>'
};

function iconSvg(key, size) {
  return '<svg xmlns="http://www.w3.org/2000/svg" width="' + size + '" height="' + size + '" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round">' + ICON_PATHS[iconKeyFor(key)] + '</svg>';
}

function post(message) {
  try { window.parent.postMessage(JSON.stringify(message), '*'); } catch (e) {}
}

/** Vignette légère pour le repère sélectionné (les images sources peuvent peser plusieurs centaines de Ko). */
function thumbUrl(u) {
  if (!u) return '';
  if (u.indexOf('images.unsplash.com') !== -1) {
    return /[?&]w=[0-9]+/.test(u) ? u.replace(/([?&])w=[0-9]+/, '$1w=120') : u + (u.indexOf('?') === -1 ? '?' : '&') + 'w=120&auto=format&q=70';
  }
  return u;
}

/** Pastille d'une catégorie dessinée une seule fois (canvas) et confiée à la carte : zéro coût à l'affichage. */
function addPinImage(key) {
  return new Promise(function (resolve) {
    var ratio = 2;
    var size = 44;
    var canvas = document.createElement('canvas');
    canvas.width = size * ratio;
    canvas.height = size * ratio;
    var ctx = canvas.getContext('2d');
    ctx.save();
    ctx.shadowColor = 'rgba(0, 0, 0, 0.30)';
    ctx.shadowBlur = 8;
    ctx.shadowOffsetY = 3;
    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath();
    ctx.arc(size * ratio / 2, size * ratio / 2, 17 * ratio, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    ctx.fillStyle = PIN_COLORS[key];
    ctx.beginPath();
    ctx.arc(size * ratio / 2, size * ratio / 2, 14.5 * ratio, 0, Math.PI * 2);
    ctx.fill();
    function finish() {
      try {
        map.addImage('pin-' + key, ctx.getImageData(0, 0, canvas.width, canvas.height), { pixelRatio: ratio });
      } catch (e) {}
      resolve();
    }
    var img = new Image();
    img.onload = function () {
      var iconSize = 17 * ratio;
      ctx.drawImage(img, (canvas.width - iconSize) / 2, (canvas.height - iconSize) / 2, iconSize, iconSize);
      finish();
    };
    img.onerror = finish;
    img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(iconSvg(key, 24));
  });
}

function unselectedFilter() {
  var f = ['all', ['!', ['has', 'point_count']]];
  if (currentSelectedId !== null) f.push(['!=', ['get', 'id'], currentSelectedId]);
  return f;
}

function createSelectedElement(s) {
  var key = iconKeyFor(s.cat || s.category);
  var el = document.createElement('div');
  el.className = 'custom-marker-wrapper active-marker';
  var html = '<div class="custom-marker-pin cat-' + key + '">';
  html += '<div class="active-star-badge">&#11088;</div>';
  html += '<div class="custom-marker-inner"><div class="fallback-icon">' + iconSvg(key, 15) + '</div>';
  if (s.image_url) {
    html += '<img src="' + thumbUrl(s.image_url) + '" alt="" decoding="async" onload="this.style.opacity=1" onerror="this.remove()" />';
  }
  html += '</div></div>';
  el.innerHTML = html;
  return el;
}

function setSelected(id, fallbackSpot) {
  currentSelectedId = (id === null || id === undefined || id === '') ? null : String(id);
  if (map && layersReady) {
    try { map.setFilter('lpt-spots', unselectedFilter()); } catch (e) {}
  }
  if (selectedMarker) { selectedMarker.remove(); selectedMarker = null; }
  if (currentSelectedId !== null && map) {
    var s = spotsById[currentSelectedId] || fallbackSpot;
    if (s) {
      var lng = isFiniteNumber(s.fixedLng) ? s.fixedLng : s.lng;
      var lat = isFiniteNumber(s.fixedLat) ? s.fixedLat : s.lat;
      if (isFiniteNumber(lng) && isFiniteNumber(lat)) {
        selectedMarker = new mapboxgl.Marker({ element: createSelectedElement(s) }).setLngLat([lng, lat]).addTo(map);
      }
    }
  }
}

function applySpots(spots) {
  var built = spotsToGeoJSON(spots);
  spotsById = built.byId;
  var signature = spotsSignature(spots);
  if (signature !== lastSignature) {
    lastSignature = signature;
    map.getSource('lpt-spots').setData(built.collection);
  }
  // l'adresse sélectionnée a pu changer de détail (nom, photo) ou disparaître d'un filtre
  if (currentSelectedId !== null) setSelected(currentSelectedId);
}

function renderSpots(spots, activeId) {
  if (activeId !== undefined) currentSelectedId = (activeId === null || activeId === '') ? null : String(activeId);
  if (!layersReady) {
    pendingSpots = spots || [];
    return;
  }
  applySpots(spots || []);
}

/** Bâtiments en relief : seulement en mode 3D (ils coûtent cher sur un téléphone, même à plat). */
function ensureBuildings(visible) {
  try {
    if (visible && !buildingsAdded && map.getSource('composite')) {
      var layers = map.getStyle().layers;
      var labelLayerId;
      for (var i = 0; i < layers.length; i++) {
        if (layers[i].type === 'symbol' && layers[i].layout && layers[i].layout['text-field']) { labelLayerId = layers[i].id; break; }
      }
      map.addLayer({
        id: 'add-3d-buildings', source: 'composite', 'source-layer': 'building',
        filter: ['==', 'extrude', 'true'], type: 'fill-extrusion', minzoom: 14,
        paint: {
          'fill-extrusion-color': '#ECE6EA',
          'fill-extrusion-height': ['interpolate', ['linear'], ['zoom'], 14, 0, 15.05, ['get', 'height']],
          'fill-extrusion-base': ['interpolate', ['linear'], ['zoom'], 14, 0, 15.05, ['get', 'min_height']],
          'fill-extrusion-opacity': 0.75
        }
      }, labelLayerId);
      buildingsAdded = true;
    }
    if (buildingsAdded) map.setLayoutProperty('add-3d-buildings', 'visibility', visible ? 'visible' : 'none');
  } catch (e) {}
}

function distanceToPoint(feature, point) {
  var p = map.project(feature.geometry.coordinates);
  var dx = p.x - point.x;
  var dy = p.y - point.y;
  return dx * dx + dy * dy;
}

function onMapClick(e) {
  var box = [[e.point.x - 10, e.point.y - 10], [e.point.x + 10, e.point.y + 10]];
  var hits = layersReady ? map.queryRenderedFeatures(box, { layers: ['lpt-clusters', 'lpt-spot-hit'] }) : [];
  if (hits.length === 0) {
    setSelected(null);
    post({ type: 'MAP_CLICKED' });
    return;
  }
  var best = hits[0];
  var bestDistance = distanceToPoint(best, e.point);
  for (var i = 1; i < hits.length; i++) {
    var d = distanceToPoint(hits[i], e.point);
    if (d < bestDistance) { best = hits[i]; bestDistance = d; }
  }
  var coords = best.geometry.coordinates.slice();
  if (best.properties.cluster) {
    map.getSource('lpt-spots').getClusterExpansionZoom(best.properties.cluster_id, function (err, zoom) {
      map.easeTo({ center: coords, zoom: Math.min((err ? map.getZoom() + 2 : zoom + 0.5), 17), duration: 500, essential: true });
    });
    return;
  }
  var id = best.properties.id;
  setSelected(id);
  map.flyTo({ center: coords, zoom: Math.max(map.getZoom(), 16.5), duration: 550, essential: true });
  post({ type: 'SPOT_CLICKED', id: id });
}

function setupLayers() {
  var kinds = ['food', 'drinks', 'shopping', 'beauty', 'culture', 'sport', 'services'];
  // les étiquettes de commerces de Mapbox font doublon avec nos adresses et alourdissent la carte
  try {
    var all = map.getStyle().layers;
    for (var i = 0; i < all.length; i++) {
      if (all[i].id.indexOf('poi-label') === 0) map.setLayoutProperty(all[i].id, 'visibility', 'none');
    }
  } catch (e) {}
  Promise.all(kinds.map(addPinImage)).then(function () {
    map.addSource('lpt-spots', {
      type: 'geojson',
      data: { type: 'FeatureCollection', features: [] },
      cluster: true,
      clusterRadius: 55,
      clusterMaxZoom: 14
    });
    var clustered = ['has', 'point_count'];
    map.addLayer({
      id: 'lpt-cluster-shadow', type: 'circle', source: 'lpt-spots', filter: clustered,
      paint: {
        'circle-radius': ['step', ['get', 'point_count'], 20, 10, 23, 50, 27, 200, 32],
        'circle-color': 'rgba(0, 0, 0, 0.28)', 'circle-blur': 0.8, 'circle-translate': [0, 3]
      }
    });
    map.addLayer({
      id: 'lpt-clusters', type: 'circle', source: 'lpt-spots', filter: clustered,
      paint: {
        'circle-color': ['step', ['get', 'point_count'], '#F2B835', 10, '#E84A5F', 50, '#A82840', 200, '#5C0F0C'],
        'circle-radius': ['step', ['get', 'point_count'], 17, 10, 20, 50, 24, 200, 29],
        'circle-stroke-width': 2.5, 'circle-stroke-color': '#FFFFFF'
      }
    });
    map.addLayer({
      id: 'lpt-cluster-count', type: 'symbol', source: 'lpt-spots', filter: clustered,
      layout: {
        'text-field': ['get', 'point_count_abbreviated'],
        'text-font': ['DIN Pro Bold', 'Arial Unicode MS Bold'],
        'text-size': ['step', ['get', 'point_count'], 13, 10, 14, 50, 15, 200, 16],
        'text-allow-overlap': true, 'text-ignore-placement': true
      },
      paint: { 'text-color': '#FFFFFF' }
    });
    map.addLayer({
      id: 'lpt-spots', type: 'symbol', source: 'lpt-spots', filter: unselectedFilter(),
      layout: {
        'icon-image': ['concat', 'pin-', ['get', 'k']],
        'icon-size': ['interpolate', ['linear'], ['zoom'], 12, 0.72, 13, 0.88, 14.5, 1],
        'icon-allow-overlap': true, 'icon-ignore-placement': true,
        'symbol-sort-key': ['get', 'rating']
      }
    });
    // zone de toucher plus large que la pastille (doigt), invisible
    map.addLayer({
      id: 'lpt-spot-hit', type: 'circle', source: 'lpt-spots', filter: ['!', ['has', 'point_count']],
      paint: { 'circle-radius': 20, 'circle-color': '#000000', 'circle-opacity': 0.01 }
    });
    ['lpt-clusters', 'lpt-spot-hit'].forEach(function (layerId) {
      map.on('mouseenter', layerId, function () { map.getCanvas().style.cursor = 'pointer'; });
      map.on('mouseleave', layerId, function () { map.getCanvas().style.cursor = ''; });
    });
    layersReady = true;
    if (pendingSpots) {
      var toApply = pendingSpots;
      pendingSpots = null;
      applySpots(toApply);
    }
    maybeReady();
  });
}

function maybeReady() {
  if (readySent || !mapLoaded || !layersReady) return;
  readySent = true;
  post({ type: 'MAP_READY' });
}

function drawRoute(geometry) {
  var geojson = { type: 'Feature', properties: {}, geometry: geometry };
  if (map.getSource('pt-route')) {
    map.getSource('pt-route').setData(geojson);
    return;
  }
  map.addSource('pt-route', { type: 'geojson', data: geojson });
  // sous les pastilles d'adresses pour qu'elles restent cliquables
  var before = map.getLayer('lpt-cluster-shadow') ? 'lpt-cluster-shadow' : undefined;
  map.addLayer({
    id: 'pt-route-casing', type: 'line', source: 'pt-route',
    layout: { 'line-join': 'round', 'line-cap': 'round' },
    paint: { 'line-color': '#1A1A22', 'line-width': 8, 'line-opacity': 0.85 }
  }, before);
  map.addLayer({
    id: 'pt-route-line', type: 'line', source: 'pt-route',
    layout: { 'line-join': 'round', 'line-cap': 'round' },
    paint: { 'line-color': '#E84A5F', 'line-width': 4.5 }
  }, before);
}

function showUserMarker(lng, lat) {
  if (userMarker) {
    userMarker.setLngLat([lng, lat]);
  } else {
    var uEl = document.createElement('div');
    uEl.className = 'user-location-marker';
    userMarker = new mapboxgl.Marker({ element: uEl }).setLngLat([lng, lat]).addTo(map);
  }
}

function init() {
  if (typeof mapboxgl === 'undefined') {
    setTimeout(init, 50);
    return;
  }
  if (map) return;
  mapboxgl.accessToken = '__TOKEN__';
  map = new mapboxgl.Map({
    container: 'map',
    style: 'mapbox://styles/mapbox/streets-v12',
    center: [__LNG__, __LAT__],
    zoom: 13.8,
    minZoom: 8,
    maxPitch: 60,
    projection: 'mercator',
    renderWorldCopies: false,
    fadeDuration: 0,
    crossSourceCollisions: false,
    performanceMetricsCollection: false,
    attributionControl: false
  });

  map.on('style.load', setupLayers);

  map.on('pitch', function () {
    var p = map.getPitch();
    var is3d = p > 25;
    if (p > 1) ensureBuildings(true);
    if (is3d !== last3d) {
      last3d = is3d;
      post({ type: 'PITCH_CHANGED', is3d: is3d });
    }
  });
  map.on('pitchend', function () {
    if (map.getPitch() < 1) ensureBuildings(false);
  });

  map.on('error', function (e) {
    console.warn('Mapbox GL error:', e && e.error ? e.error.message : e);
  });

  map.on('load', function () {
    mapLoaded = true;
    setTimeout(function () { if (map) map.resize(); }, 150);
    maybeReady();
  });

  map.on('click', onMapClick);
}

if (window.ResizeObserver) {
  try {
    var ro = new ResizeObserver(function () { if (map) map.resize(); });
    ro.observe(document.getElementById('map'));
  } catch (e) {}
}

window.addEventListener('message', function (event) {
  try {
    var data = JSON.parse(event.data);
    if (!map) return;

    if (data.type === 'UPDATE_SPOTS') {
      renderSpots(data.spots);
    } else if (data.type === 'RESET_TOULOUSE') {
      map.flyTo({ center: [__LNG__, __LAT__], zoom: 13.8, pitch: 0, bearing: 0, duration: 800 });
    } else if (data.type === 'FOCUS_SPOT') {
      if (data.id !== undefined) setSelected(data.id);
      map.flyTo({ center: [data.lng, data.lat], zoom: 16.5, duration: 800 });
      if (data.spots) renderSpots(data.spots, data.id);
    } else if (data.type === 'SELECT_SPOT') {
      setSelected(data.id, { id: data.id, lat: data.lat, lng: data.lng });
      // pas de second flyTo si le toucher sur la pastille l'a déjà fait
      if (!data.skipFly && isFiniteNumber(data.lng) && isFiniteNumber(data.lat)) {
        map.flyTo({ center: [data.lng, data.lat], zoom: Math.max(map.getZoom(), 16.5), duration: 750, essential: true });
      }
    } else if (data.type === 'DESELECT_SPOT') {
      setSelected(null);
    } else if (data.type === 'SET_3D_MODE') {
      if (data.enabled) {
        ensureBuildings(true);
        map.easeTo({ pitch: 58, bearing: -18, duration: 850, essential: true });
      } else {
        map.easeTo({ pitch: 0, bearing: 0, duration: 750, essential: true });
      }
    } else if (data.type === 'USER_LOCATION') {
      showUserMarker(data.lng, data.lat);
      if (data.center) map.flyTo({ center: [data.lng, data.lat], zoom: 15, duration: 800 });
    } else if (data.type === 'SHOW_ROUTE') {
      drawRoute(data.geometry);
      var rCoords = data.geometry.coordinates;
      if (rCoords && rCoords.length > 0) {
        var bounds = rCoords.reduce(function (b, c) { return b.extend(c); }, new mapboxgl.LngLatBounds(rCoords[0], rCoords[0]));
        map.fitBounds(bounds, { padding: { top: 130, bottom: 250, left: 60, right: 60 }, maxZoom: 17, duration: 900 });
      }
    } else if (data.type === 'FETCH_ROUTE') {
      if (data.isFromUserLocation) showUserMarker(data.startLng, data.startLat);
      var routeUrl = 'https://api.mapbox.com/directions/v5/mapbox/walking/'
        + data.startLng + ',' + data.startLat + ';' + data.endLng + ',' + data.endLat
        + '?geometries=geojson&overview=full&access_token=' + mapboxgl.accessToken;
      fetch(routeUrl)
        .then(function (r) { return r.json(); })
        .then(function (rData) {
          if (!rData.routes || rData.routes.length === 0) {
            post({ type: 'ROUTE_ERROR', message: 'Aucun itineraire trouve' });
            return;
          }
          var route = rData.routes[0];
          drawRoute(route.geometry);
          var coords = route.geometry.coordinates;
          if (coords && coords.length > 0) {
            var bds = coords.reduce(function (b, c) { return b.extend(c); }, new mapboxgl.LngLatBounds(coords[0], coords[0]));
            var dLat = Math.abs(data.startLat - data.endLat);
            var dLng = Math.abs(data.startLng - data.endLng);
            if (dLat < 0.4 && dLng < 0.4) {
              bds.extend([data.startLng, data.startLat]);
              bds.extend([data.endLng, data.endLat]);
              map.fitBounds(bds, { padding: { top: 120, bottom: 220, left: 60, right: 60 }, maxZoom: 16.5, duration: 800 });
            } else {
              map.flyTo({ center: [data.endLng, data.endLat], zoom: 15.5, duration: 800 });
            }
          }
          post({
            type: 'ROUTE_READY', distance: route.distance, duration: route.duration,
            spotId: data.spotId || '', spotName: data.spotName || '', isFromUserLocation: !!data.isFromUserLocation
          });
        })
        .catch(function (err) {
          post({ type: 'ROUTE_ERROR', message: err ? err.message : 'Erreur reseau' });
        });
    } else if (data.type === 'CLEAR_ROUTE') {
      if (map.getSource('pt-route')) {
        if (map.getLayer('pt-route-line')) map.removeLayer('pt-route-line');
        if (map.getLayer('pt-route-casing')) map.removeLayer('pt-route-casing');
        map.removeSource('pt-route');
      }
    }
  } catch (err) {
    console.warn('Message carte ignoré:', err && err.message);
  }
});

if (document.readyState === 'complete' || document.readyState === 'interactive') {
  init();
} else {
  window.addEventListener('DOMContentLoaded', init);
}
`;

export const getWebMapHtml = (mapboxToken: string = MAPBOX_ACCESS_TOKEN) => `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
  <link href="https://api.mapbox.com/mapbox-gl-js/v3.9.4/mapbox-gl.css" rel="stylesheet" />
  <script src="https://api.mapbox.com/mapbox-gl-js/v3.9.4/mapbox-gl.js"></script>
  <style>
    * { box-sizing: border-box; }
    html, body {
      margin: 0;
      padding: 0;
      width: 100%;
      height: 100%;
      overflow: hidden;
      background-color: ${MAP_BACKGROUND};
      -webkit-tap-highlight-color: transparent;
      -webkit-text-size-adjust: 100%;
    }
    #map {
      position: absolute;
      top: 0;
      bottom: 0;
      left: 0;
      right: 0;
      width: 100%;
      height: 100%;
      background-color: ${MAP_BACKGROUND};
    }
    .mapboxgl-ctrl-bottom-left, .mapboxgl-ctrl-bottom-right {
      display: none !important;
    }

    /* Repère de l'adresse sélectionnée (le seul élément HTML de la carte) */
    .custom-marker-wrapper {
      width: 32px;
      height: 32px;
      cursor: pointer;
      user-select: none;
      position: absolute;
    }
    .custom-marker-pin {
      width: 32px;
      height: 32px;
      border-radius: 16px;
      border: 2px solid #FFFFFF;
      box-shadow: 0 2px 7px rgba(0, 0, 0, 0.22);
      background: #FFFFFF;
      display: flex;
      justify-content: center;
      align-items: center;
      position: relative;
    }
    .custom-marker-wrapper.active-marker { z-index: 99999; }
    .custom-marker-wrapper.active-marker .custom-marker-pin {
      transform: scale(1.35) translateY(-3px);
      transform-origin: center center;
      border: 2.5px solid #FFC107;
      box-shadow: 0 0 0 4px rgba(255, 193, 7, 0.45), 0 8px 22px rgba(0, 0, 0, 0.4);
    }
    .active-star-badge {
      display: none;
      position: absolute;
      top: -11px;
      right: -9px;
      width: 20px;
      height: 20px;
      background: linear-gradient(135deg, #FFE066, #FF9800);
      border: 2px solid #FFFFFF;
      border-radius: 50%;
      box-shadow: 0 3px 8px rgba(0,0,0,0.35);
      justify-content: center;
      align-items: center;
      font-size: 11px;
      line-height: 1;
      pointer-events: none;
      z-index: 100000;
    }
    .custom-marker-wrapper.active-marker .active-star-badge {
      display: flex;
      animation: starPop 0.35s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards;
    }
    @keyframes starPop {
      0% { transform: scale(0) rotate(-45deg); opacity: 0; }
      70% { transform: scale(1.25) rotate(12deg); opacity: 1; }
      100% { transform: scale(1) rotate(0deg); opacity: 1; }
    }
    .custom-marker-inner {
      width: 100%;
      height: 100%;
      border-radius: 50%;
      overflow: hidden;
      display: flex;
      justify-content: center;
      align-items: center;
      position: relative;
    }
    .custom-marker-inner img {
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      object-fit: cover;
      opacity: 0;
      transition: opacity 0.2s ease-in;
    }
    .custom-marker-pin .fallback-icon {
      display: flex;
      justify-content: center;
      align-items: center;
      width: 100%;
      height: 100%;
      position: absolute;
      top: 0;
      left: 0;
    }
    .custom-marker-pin.cat-food .fallback-icon { background: #E84A5F; }
    .custom-marker-pin.cat-drinks .fallback-icon { background: #F2B835; }
    .custom-marker-pin.cat-shopping .fallback-icon { background: #6C4AB6; }
    .custom-marker-pin.cat-beauty .fallback-icon { background: #E84A5F; }
    .custom-marker-pin.cat-culture .fallback-icon { background: #1FA67A; }
    .custom-marker-pin.cat-sport .fallback-icon { background: #6C4AB6; }
    .custom-marker-pin.cat-services .fallback-icon { background: #6A6A78; }

    .user-location-marker {
      width: 16px;
      height: 16px;
      border-radius: 50%;
      background: #6C4AB6;
      border: 2.5px solid #FFFFFF;
      box-shadow: 0 0 0 5px rgba(59, 130, 246, 0.4);
    }
  </style>
</head>
<body>
  <div id="map"></div>
  <script>
${MAP_PAGE_LOGIC}
${MAP_PAGE_SCRIPT.split('__TOKEN__').join(mapboxToken).split('__LNG__').join(String(TOULOUSE_LNG)).split('__LAT__').join(String(TOULOUSE_LAT))}
  </script>
</body>
</html>
`;
