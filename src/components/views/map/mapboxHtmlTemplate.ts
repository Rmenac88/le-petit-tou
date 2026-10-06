/**
 * Mapbox GL JS Web HTML Template
 * High-performance 60FPS WebGL map with Supercluster and 3D buildings.
 * Extracted from MapView for modularity and maintainability.
 */

export const TOULOUSE_LAT = 43.6047;
export const TOULOUSE_LNG = 1.4442;
export const MAPBOX_ACCESS_TOKEN = process.env.EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN || "";

export const getWebMapHtml = (mapboxToken: string = MAPBOX_ACCESS_TOKEN) => `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
  <link href="https://api.mapbox.com/mapbox-gl-js/v3.9.4/mapbox-gl.css" rel="stylesheet" />
  <script src="https://api.mapbox.com/mapbox-gl-js/v3.9.4/mapbox-gl.js"></script>
  <script src="https://unpkg.com/supercluster@8.0.1/dist/supercluster.min.js"></script>
  <style>
    * { box-sizing: border-box; }
    html, body { 
      margin: 0; 
      padding: 0; 
      width: 100%; 
      height: 100%; 
      overflow: hidden; 
      background-color: #24242E; 
      -webkit-tap-highlight-color: transparent;
    }
    #map { 
      position: absolute;
      top: 0;
      bottom: 0;
      left: 0;
      right: 0;
      width: 100%; 
      height: 100%; 
      background-color: #24242E; 
    }
    .mapboxgl-ctrl-bottom-left, .mapboxgl-ctrl-bottom-right {
      display: none !important;
    }
    
    /* Cluster Badge Design Le Petit Tou */
    .lpt-cluster {
      display: flex;
      justify-content: center;
      align-items: center;
      border-radius: 50%;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      font-weight: 800;
      color: #FFFFFF;
      border: 2.5px solid #FFFFFF;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.25);
      cursor: pointer;
      user-select: none;
    }
    .lpt-cluster:hover {
      box-shadow: 0 6px 16px rgba(0, 0, 0, 0.35);
      filter: brightness(1.1);
    }
    .lpt-cluster-small {
      width: 34px;
      height: 34px;
      background: #F2B835;
      font-size: 13px;
    }
    .lpt-cluster-medium {
      width: 40px;
      height: 40px;
      background: #E84A5F;
      font-size: 14px;
    }
    .lpt-cluster-large {
      width: 48px;
      height: 48px;
      background: #A82840;
      font-size: 15px;
      box-shadow: 0 6px 18px rgba(139, 26, 23, 0.45);
    }
    .lpt-cluster-xlarge {
      width: 58px;
      height: 58px;
      background: #5C0F0C;
      font-size: 16px;
      box-shadow: 0 8px 22px rgba(92, 15, 12, 0.55);
    }

    /* Individual Markers - Wrapper has NO CSS transition so Mapbox positions it instantly with zero lag */
    .custom-marker-wrapper {
      width: 32px;
      height: 32px;
      cursor: pointer;
      user-select: none;
      position: absolute;
      will-change: transform;
      transition: none !important;
      -webkit-backface-visibility: hidden;
      backface-visibility: hidden;
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
      transform: scale(var(--marker-scale, 1)) translateZ(0);
      transform-origin: center center;
      transition: transform 0.12s ease-out, box-shadow 0.15s ease, border-color 0.15s ease;
    }
    .custom-marker-wrapper:hover .custom-marker-pin {
      transform: scale(calc(var(--marker-scale, 1) * 1.2)) translateY(-2px);
      box-shadow: 0 6px 14px rgba(0, 0, 0, 0.35);
      z-index: 9999 !important;
    }
    .custom-marker-wrapper.active-marker .custom-marker-pin {
      transform: scale(calc(var(--marker-scale, 1) * 1.35)) translateY(-3px);
      border: 2.5px solid #FFC107;
      box-shadow: 0 0 0 4px rgba(255, 193, 7, 0.45), 0 8px 22px rgba(0, 0, 0, 0.4);
      z-index: 99999 !important;
    }
    /* Floating Star Pop-in Badge on Selected Marker */
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
      font-size: 13px;
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
    var map = null;
    var clusterIndex = null;
    var activeMarkers = {};
    var userMarker = null;
    var currentSelectedId = null;
    var currentSpots = [];

    function getIconSvg(cat) {
      if (cat === 'food' || cat === 'brunch' || cat === 'lunch') {
        return '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"><path d="M18 2v6a3 3 0 0 1-3 3 3 3 0 0 1-3-3V2"/><path d="M15 2v19"/><path d="M5 2v4a3 3 0 0 0 3 3v12"/><path d="M9 2v4"/></svg>';
      }
      if (cat === 'drinks' || cat === 'bars' || cat === 'cafe') {
        return '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"><path d="M17 8h1a4 4 0 1 1 0 8h-1"/><path d="M3 8h14v9a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4Z"/><line x1="6" y1="2" x2="6" y2="4"/><line x1="10" y1="2" x2="10" y2="4"/><line x1="14" y1="2" x2="14" y2="4"/></svg>';
      }
      if (cat === 'shopping' || cat === 'mode') {
        return '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"><path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z"/><path d="M3 6h18"/><path d="M16 10a4 4 0 0 1-8 0"/></svg>';
      }
      if (cat === 'beauty' || cat === 'bien-etre' || cat === 'beaute') {
        return '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"><path d="m12 3-1.9 5.8a2 2 0 0 1-1.3 1.3L3 12l5.8 1.9a2 2 0 0 1 1.3 1.3L12 21l1.9-5.8a2 2 0 0 1 1.3-1.3L21 12l-5.8-1.9a2 2 0 0 1-1.3-1.3L12 3Z"/></svg>';
      }
      if (cat === 'sport' || cat === 'activites') {
        return '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/><path d="M4 22h16"/><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"/><path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"/><path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"/></svg>';
      }
      if (cat === 'culture' || cat === 'loisirs') {
        return '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76"/></svg>';
      }
      if (cat === 'services') {
        return '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"><rect width="20" height="14" x="2" y="7" rx="2" ry="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/></svg>';
      }
      return '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>';
    }

    var spotsById = {};
    function buildClusterIndex(spots) {
      spotsById = {};
      var points = [];
      var coordGroups = {};

      for (var i = 0; i < spots.length; i++) {
        var s = spots[i];
        if (s && typeof s.lat === 'number' && typeof s.lng === 'number' && !isNaN(s.lat) && !isNaN(s.lng)) {
          spotsById[s.id] = s;
          var k = s.lat.toFixed(5) + ',' + s.lng.toFixed(5);
          if (!coordGroups[k]) coordGroups[k] = [];
          coordGroups[k].push(s);
        }
      }

      // Micro-décalage de 2.0m uniquement si plusieurs adresses partagent EXACTEMENT la même position
      for (var k in coordGroups) {
        var group = coordGroups[k];
        for (var j = 0; j < group.length; j++) {
          var s = group[j];
          var lat = s.lat;
          var lng = s.lng;

          if (group.length > 1 && j > 0) {
            var angle = (j * 2 * Math.PI) / group.length;
            lat += (2.0 * Math.sin(angle)) / 111000;
            lng += (2.0 * Math.cos(angle)) / 80400;
          }
          // Sauvegarder impérativement fixedLat et fixedLng sur s pour assurer la cohérence absolue
          s.fixedLat = lat;
          s.fixedLng = lng;

          points.push({
            type: 'Feature',
            properties: {
              id: s.id,
              name: s.name,
              cat: s.cat || s.category || 'food',
              image_url: s.image_url,
              rating: s.rating || 4.8,
              spotLat: lat,
              spotLng: lng,
              rawSpot: s
            },
            geometry: {
              type: 'Point',
              coordinates: [lng, lat]
            }
          });
        }
      }

      if (typeof Supercluster !== 'undefined') {
        try {
          clusterIndex = new Supercluster({
            radius: 60,
            maxZoom: 14,
            minZoom: 0,
            minPoints: 2
          });
          clusterIndex.load(points);
        } catch (e) {
          clusterIndex = null;
        }
      } else {
        clusterIndex = null;
      }
    }

    // Clustering unifié via Supercluster à TOUS les niveaux de zoom
    // Plus de switch binaire — Supercluster gère tout de façon déterministe

    function updateZoomScale() {
      if (!map) return;
      var z = map.getZoom();
      var s = 1.0;
      if (z < 12.0) {
        s = 0.72;
      } else if (z < 13.0) {
        s = 0.72 + (z - 12.0) * 0.16;
      } else if (z < 14.5) {
        s = 0.88 + (z - 13.0) * 0.08;
      } else {
        s = 1.0;
      }
      document.documentElement.style.setProperty('--marker-scale', s.toFixed(2));
    }

    function updateActiveMarkerStyles() {
      for (var key in activeMarkers) {
        if (key.indexOf('spot_') === 0) {
          var id = key.replace('spot_', '');
          var el = activeMarkers[key].getElement();
          if (id === currentSelectedId) {
            el.classList.add('active-marker');
          } else {
            el.classList.remove('active-marker');
          }
        }
      }
    }

    function createSpotMarkerElement(s, isActive) {
      var el = document.createElement('div');
      var catClass = 'cat-' + (s.cat || 'food');
      el.className = 'custom-marker-wrapper' + (isActive ? ' active-marker' : '');

      var iconSvg = getIconSvg(s.cat);
      var innerHtml = '<div class="custom-marker-pin ' + catClass + '">';
      innerHtml += '<div class="active-star-badge">⭐</div>';
      innerHtml += '<div class="custom-marker-inner">';
      innerHtml += '<div class="fallback-icon">' + iconSvg + '</div>';
      if (s.image_url) {
        innerHtml += '<img src="' + s.image_url + '" alt="" loading="lazy" decoding="async" onload="this.style.opacity=1" onerror="this.remove()" />';
      }
      innerHtml += '</div>';
      innerHtml += '</div>';
      el.innerHTML = innerHtml;
      return el;
    }

    function updateVisibleMarkers(force) {
      if (!map) return;
      var currentZoom = map.getZoom();

      // Récupère les bounds actuels + padding
      var bounds = map.getBounds();
      if (!bounds) return;

      var west = bounds.getWest();
      var east = bounds.getEast();
      var south = bounds.getSouth();
      var north = bounds.getNorth();

      // Bounding box globale en dézoom très fort
      var bbox;
      if (currentZoom <= 2) {
        bbox = [-180, -85, 180, 85];
      } else {
        var padLng = (east - west) * 0.2;
        var padLat = (north - south) * 0.2;
        bbox = [
          Math.max(-180, west - padLng),
          Math.max(-85, south - padLat),
          Math.min(180, east + padLng),
          Math.min(85, north + padLat)
        ];
      }

      // Supercluster détermine lui-même ce qui est cluster ou point individuel
      // maxZoom de Supercluster = 14 → au-delà, queryZoom 15+ = points individuels garantis
      var queryZoom = Math.max(0, Math.min(17, Math.floor(currentZoom)));
      var rawFeatures = [];
      if (clusterIndex) {
        try {
          rawFeatures = clusterIndex.getClusters(bbox, queryZoom);
        } catch (e) {
          rawFeatures = [];
        }
      }

      // Diff/reconciliation — on ne recree que ce qui change
      var nextKeys = {};

      for (var i = 0; i < rawFeatures.length; i++) {
        var f = rawFeatures[i];
        var coords = f.geometry.coordinates;
        var isCluster = f.properties && f.properties.cluster;

        if (isCluster) {
          var cId = f.properties.cluster_id;
          var key = 'cluster_' + cId;
          nextKeys[key] = true;

          if (!activeMarkers[key]) {
            var count = f.properties.point_count;
            var sizeClass = 'lpt-cluster-small';
            if (count > 200) {
              sizeClass = 'lpt-cluster-xlarge';
            } else if (count > 50) {
              sizeClass = 'lpt-cluster-large';
            } else if (count > 10) {
              sizeClass = 'lpt-cluster-medium';
            }

            var el = document.createElement('div');
            el.className = 'lpt-cluster ' + sizeClass;
            el.innerText = count;

            (function(clusterId, cCoords, cCount) {
              el.addEventListener('click', function(e) {
                e.stopPropagation();
                if (clusterIndex) {
                  try {
                    var expZoom = clusterIndex.getClusterExpansionZoom(clusterId);
                    map.easeTo({ center: cCoords, zoom: Math.min(expZoom + 0.5, 17), duration: 500, essential: true });
                  } catch (err) {
                    map.easeTo({ center: cCoords, zoom: Math.min(map.getZoom() + 2, 17), duration: 450 });
                  }
                } else {
                  map.easeTo({ center: cCoords, zoom: Math.min(map.getZoom() + 2, 17), duration: 450 });
                }
              });
            })(cId, coords, count);

            var marker = new mapboxgl.Marker({ element: el })
              .setLngLat(coords)
              .addTo(map);
            activeMarkers[key] = marker;
          }
          // Les clusters existants : on met juste à jour leur position (centroïde peut bouger légèrement selon zoom)
          // Note: Supercluster est déterministe, donc la position ne change pas pour un même cluster_id

        } else {
          // Point individuel
          var spotId = f.properties.id;
          var s = spotsById[spotId] || f.properties.rawSpot || f.properties;
          var key = 'spot_' + spotId;
          nextKeys[key] = true;
          var isActive = (spotId !== null && spotId !== undefined) ? (String(spotId) === String(currentSelectedId)) : false;
          var sLng = (typeof s.fixedLng === 'number') ? s.fixedLng : (typeof s.lng === 'number' ? s.lng : coords[0]);
          var sLat = (typeof s.fixedLat === 'number') ? s.fixedLat : (typeof s.lat === 'number' ? s.lat : coords[1]);

          if (typeof sLng !== 'number' || typeof sLat !== 'number' || isNaN(sLng) || isNaN(sLat)) continue;

          if (!activeMarkers[key]) {
            var el = createSpotMarkerElement(s, isActive);

            (function(spotItem, targetCoords) {
              el.addEventListener('click', function(e) {
                e.stopPropagation();
                currentSelectedId = spotItem.id;
                updateActiveMarkerStyles();
                map.flyTo({ center: targetCoords, zoom: Math.max(map.getZoom(), 16.5), duration: 550, essential: true });
                window.parent.postMessage(JSON.stringify({ type: 'SPOT_CLICKED', id: spotItem.id }), '*');
              });
            })(s, [sLng, sLat]);

            var marker = new mapboxgl.Marker({ element: el })
              .setLngLat([sLng, sLat])
              .addTo(map);
            activeMarkers[key] = marker;
          } else {
            // Marqueur déjà présent : mise à jour position et état actif uniquement
            activeMarkers[key].setLngLat([sLng, sLat]);
            var mEl = activeMarkers[key].getElement();
            if (isActive && !mEl.classList.contains('active-marker')) {
              mEl.classList.add('active-marker');
            } else if (!isActive && mEl.classList.contains('active-marker')) {
              mEl.classList.remove('active-marker');
            }
          }
        }
      }

      // Supprimer les marqueurs qui ne sont plus dans le résultat Supercluster
      for (var existingKey in activeMarkers) {
        if (!nextKeys[existingKey]) {
          activeMarkers[existingKey].remove();
          delete activeMarkers[existingKey];
        }
      }
    }

    function renderSpots(spotsArray, activeId) {
      currentSpots = spotsArray || [];
      if (activeId !== undefined) {
        currentSelectedId = activeId;
      }
      buildClusterIndex(currentSpots);
      updateVisibleMarkers(true);
    }

    function init() {
      if (typeof mapboxgl === 'undefined') {
        setTimeout(init, 50);
        return;
      }
      if (map) return;

      mapboxgl.accessToken = '${mapboxToken}';
      map = new mapboxgl.Map({
        container: 'map',
        style: 'mapbox://styles/mapbox/streets-v12',
        center: [${TOULOUSE_LNG}, ${TOULOUSE_LAT}],
        zoom: 13.8,
        projection: 'globe',
        fadeDuration: 0,
        attributionControl: false
      });

      map.on('style.load', function() {
        try {
          map.setFog({
            color: 'rgb(220, 230, 242)',
            'high-color': 'rgb(36, 92, 223)',
            'horizon-blend': 0.02,
            'space-color': 'rgb(15, 23, 42)',
            'star-intensity': 0.6
          });
        } catch (e) {}

        // Bâtiments en relief 3D
        try {
          var layers = map.getStyle().layers;
          var labelLayerId;
          for (var i = 0; i < layers.length; i++) {
            if (layers[i].type === 'symbol' && layers[i].layout && layers[i].layout['text-field']) {
              labelLayerId = layers[i].id;
              break;
            }
          }
          if (!map.getLayer('add-3d-buildings')) {
            map.addLayer(
              {
                id: 'add-3d-buildings',
                source: 'composite',
                'source-layer': 'building',
                filter: ['==', 'extrude', 'true'],
                type: 'fill-extrusion',
                minzoom: 14,
                paint: {
                  'fill-extrusion-color': '#ECE6EA',
                  'fill-extrusion-height': [
                    'interpolate',
                    ['linear'],
                    ['zoom'],
                    14,
                    0,
                    15.05,
                    ['get', 'height']
                  ],
                  'fill-extrusion-base': [
                    'interpolate',
                    ['linear'],
                    ['zoom'],
                    14,
                    0,
                    15.05,
                    ['get', 'min_height']
                  ],
                  'fill-extrusion-opacity': 0.75
                }
              },
              labelLayerId
            );
          }
        } catch (e) {}
      });

      map.on('pitch', function() {
        var p = map.getPitch();
        window.parent.postMessage(JSON.stringify({ type: 'PITCH_CHANGED', is3d: p > 25 }), '*');
      });

      map.on('error', function(e) {
        console.warn('Mapbox GL error:', e);
      });

      map.on('webglcontextlost', function(e) {
        console.error('Mapbox WebGL context lost:', e);
      });

      map.on('load', function() {
        updateZoomScale();
        renderSpots(currentSpots, currentSelectedId);
        setTimeout(function() { if (map) map.resize(); }, 100);
        setTimeout(function() { if (map) map.resize(); }, 400);
        setTimeout(function() { if (map) map.resize(); }, 800);
        window.parent.postMessage(JSON.stringify({ type: 'MAP_READY' }), '*');
      });

      // Clustering unifié : mise à jour à chaque changement de zoom ou déplacement
      map.on('zoom', function() {
        updateZoomScale();
      });

      map.on('moveend', function() {
        updateVisibleMarkers();
      });

      map.on('zoomend', function() {
        updateVisibleMarkers();
      });

      map.on('click', function() {
        currentSelectedId = null;
        updateActiveMarkerStyles();
        window.parent.postMessage(JSON.stringify({ type: 'MAP_CLICKED' }), '*');
      });
    }

    if (window.ResizeObserver) {
      try {
        var ro = new ResizeObserver(function() {
          if (map) map.resize();
        });
        ro.observe(document.getElementById('map'));
      } catch (e) {}
    }

    window.addEventListener('resize', function() {
      if (map) map.resize();
    });

    window.addEventListener('message', function(event) {
      try {
        var data = JSON.parse(event.data);
        if (!map) return;

        if (data.type === 'UPDATE_SPOTS') {
          renderSpots(data.spots);
          if (map) map.resize();
        } else if (data.type === 'RESET_TOULOUSE') {
          map.flyTo({ center: [${TOULOUSE_LNG}, ${TOULOUSE_LAT}], zoom: 13.8, duration: 800 });
          setTimeout(function() { if (map) map.resize(); }, 200);
        } else if (data.type === 'FOCUS_SPOT') {
          currentSelectedId = data.id;
          map.flyTo({ center: [data.lng, data.lat], zoom: 16.5, duration: 800 });
          renderSpots(data.spots || currentSpots, data.id);
        } else if (data.type === 'SELECT_SPOT') {
          currentSelectedId = data.id;
          updateActiveMarkerStyles();
          // Ne pas refaire flyTo si le click du marqueur l'a déjà fait
          if (!data.skipFly) {
            var tLng = data.lng;
            var tLat = data.lat;
            if ((!tLng || !tLat) && currentSpots) {
              for (var si = 0; si < currentSpots.length; si++) {
                if (currentSpots[si].id === data.id) {
                  tLng = currentSpots[si].lng;
                  tLat = currentSpots[si].lat;
                  break;
                }
              }
            }
            if (tLng && tLat) {
              map.flyTo({
                center: [tLng, tLat],
                zoom: Math.max(map.getZoom(), 16.5),
                duration: 750,
                essential: true
              });
            }
          }
        } else if (data.type === 'DESELECT_SPOT') {
          currentSelectedId = null;
          updateActiveMarkerStyles();
        } else if (data.type === 'SET_3D_MODE') {
          if (data.enabled) {
            map.easeTo({ pitch: 58, bearing: -18, duration: 850, essential: true });
          } else {
            map.easeTo({ pitch: 0, bearing: 0, duration: 750, essential: true });
          }
        } else if (data.type === 'USER_LOCATION') {
          if (userMarker) {
            userMarker.setLngLat([data.lng, data.lat]);
          } else {
            var uEl = document.createElement('div');
            uEl.className = 'user-location-marker';
            userMarker = new mapboxgl.Marker({ element: uEl })
              .setLngLat([data.lng, data.lat])
              .addTo(map);
          }
          if (data.center) {
            map.flyTo({ center: [data.lng, data.lat], zoom: 15, duration: 800 });
          }
        } else if (data.type === 'SHOW_ROUTE') {
          var geojson = {
            type: 'Feature',
            properties: {},
            geometry: data.geometry
          };
          if (map.getSource('pt-route')) {
            map.getSource('pt-route').setData(geojson);
          } else {
            map.addSource('pt-route', {
              type: 'geojson',
              data: geojson
            });
            map.addLayer({
              id: 'pt-route-casing',
              type: 'line',
              source: 'pt-route',
              layout: {
                'line-join': 'round',
                'line-cap': 'round'
              },
              paint: {
                'line-color': '#1A1A22',
                'line-width': 8,
                'line-opacity': 0.85
              }
            });
            map.addLayer({
              id: 'pt-route-line',
              type: 'line',
              source: 'pt-route',
              layout: {
                'line-join': 'round',
                'line-cap': 'round'
              },
              paint: {
                'line-color': '#E84A5F',
                'line-width': 4.5
              }
            });
          }
          var rCoords = data.geometry.coordinates;
          if (rCoords && rCoords.length > 0) {
            var bounds = rCoords.reduce(function(b, c) {
              return b.extend(c);
            }, new mapboxgl.LngLatBounds(rCoords[0], rCoords[0]));
            map.fitBounds(bounds, {
              padding: { top: 130, bottom: 250, left: 60, right: 60 },
              maxZoom: 17,
              duration: 900
            });
          }
        } else if (data.type === 'FETCH_ROUTE') {
          // Si le départ est la position utilisateur, s'assurer que le marqueur bleu est affiché au départ exact
          if (data.isFromUserLocation) {
            if (userMarker) {
              userMarker.setLngLat([data.startLng, data.startLat]);
            } else {
              var uEl = document.createElement('div');
              uEl.className = 'user-location-marker';
              userMarker = new mapboxgl.Marker({ element: uEl })
                .setLngLat([data.startLng, data.startLat])
                .addTo(map);
            }
          }

          // Fetch Mapbox Directions depuis l'iframe (pas bloqué par CORS)
          var mbToken = '${mapboxToken}';
          var routeUrl = 'https://api.mapbox.com/directions/v5/mapbox/walking/'
            + data.startLng + ',' + data.startLat + ';'
            + data.endLng + ',' + data.endLat
            + '?geometries=geojson&overview=full&access_token=' + mbToken;
          fetch(routeUrl)
            .then(function(r) { return r.json(); })
            .then(function(rData) {
              if (!rData.routes || rData.routes.length === 0) {
                window.parent.postMessage(JSON.stringify({
                  type: 'ROUTE_ERROR',
                  message: 'Aucun itineraire trouve'
                }), '*');
                return;
              }
              var route = rData.routes[0];
              var geojson = {
                type: 'Feature',
                properties: {},
                geometry: route.geometry
              };
              // Afficher le tracé sur la carte
              if (map.getSource('pt-route')) {
                map.getSource('pt-route').setData(geojson);
              } else {
                map.addSource('pt-route', { type: 'geojson', data: geojson });
                map.addLayer({
                  id: 'pt-route-casing',
                  type: 'line',
                  source: 'pt-route',
                  layout: { 'line-join': 'round', 'line-cap': 'round' },
                  paint: { 'line-color': '#1A1A22', 'line-width': 8, 'line-opacity': 0.85 }
                });
                map.addLayer({
                  id: 'pt-route-line',
                  type: 'line',
                  source: 'pt-route',
                  layout: { 'line-join': 'round', 'line-cap': 'round' },
                  paint: { 'line-color': '#E84A5F', 'line-width': 4.5 }
                });
              }
              // Ajuster les limites de la carte pour englober l'utilisateur et la destination
              var coords = route.geometry.coordinates;
              if (coords && coords.length > 0) {
                var bds = coords.reduce(function(b, c) {
                  return b.extend(c);
                }, new mapboxgl.LngLatBounds(coords[0], coords[0]));
                
                var dLat = Math.abs(data.startLat - data.endLat);
                var dLng = Math.abs(data.startLng - data.endLng);
                var isNearby = (dLat < 0.4 && dLng < 0.4);

                if (isNearby) {
                  bds.extend([data.startLng, data.startLat]);
                  bds.extend([data.endLng, data.endLat]);
                  map.fitBounds(bds, {
                    padding: { top: 120, bottom: 220, left: 60, right: 60 },
                    maxZoom: 16.5,
                    duration: 800
                  });
                } else {
                  map.flyTo({ center: [data.endLng, data.endLat], zoom: 15.5, duration: 800 });
                }
              }
              // Notifier le parent avec la distance, la durée et l'origine
              window.parent.postMessage(JSON.stringify({
                type: 'ROUTE_READY',
                distance: route.distance,
                duration: route.duration,
                spotId: data.spotId || '',
                spotName: data.spotName || '',
                isFromUserLocation: !!data.isFromUserLocation
              }), '*');
            })
            .catch(function(err) {
              window.parent.postMessage(JSON.stringify({
                type: 'ROUTE_ERROR',
                message: err ? err.message : 'Erreur reseau'
              }), '*');
            });
        } else if (data.type === 'CLEAR_ROUTE') {
          if (map.getSource('pt-route')) {
            if (map.getLayer('pt-route-line')) map.removeLayer('pt-route-line');
            if (map.getLayer('pt-route-casing')) map.removeLayer('pt-route-casing');
            map.removeSource('pt-route');
          }
        }
      } catch (err) {}
    });

    if (document.readyState === 'complete' || document.readyState === 'interactive') {
      init();
    } else {
      window.addEventListener('DOMContentLoaded', init);
    }
  </script>
</body>
</html>
`;
