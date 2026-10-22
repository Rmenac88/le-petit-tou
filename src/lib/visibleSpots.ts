export interface MapRegion {
  latitude: number;
  longitude: number;
  latitudeDelta: number;
  longitudeDelta: number;
}

/**
 * Marqueurs à dessiner sur la carte native : ceux de la zone visible (avec une marge) et au plus `max`, les plus
 * proches du centre d'abord. Dessiner les 790 marqueurs à vue personnalisée d'un coup gèlerait un téléphone
 * d'entrée de gamme. L'adresse sélectionnée est toujours conservée.
 */
export function visibleSpots<T extends { id: string; lat: number; lng: number }>(
  spots: readonly T[],
  region: MapRegion,
  selectedId: string | null,
  max = 120
): T[] {
  const halfLat = region.latitudeDelta * 0.75;
  const halfLng = region.longitudeDelta * 0.75;
  const inView = spots.filter(
    (s) =>
      Number.isFinite(s.lat) &&
      Number.isFinite(s.lng) &&
      Math.abs(s.lat - region.latitude) <= halfLat &&
      Math.abs(s.lng - region.longitude) <= halfLng
  );
  const dist = (s: T) => (s.lat - region.latitude) ** 2 + (s.lng - region.longitude) ** 2;
  const shown = inView.length > max ? [...inView].sort((a, b) => dist(a) - dist(b)).slice(0, max) : inView;
  if (selectedId && !shown.some((s) => s.id === selectedId)) {
    const selected = spots.find((s) => s.id === selectedId);
    if (selected) return [...shown, selected];
  }
  return shown;
}
