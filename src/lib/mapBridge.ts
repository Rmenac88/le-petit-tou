/**
 * Pont entre l'appli et la carte Mapbox GL affichée dans une WebView (téléphone).
 * La même page HTML sert sur le web (iframe) et sur téléphone (WebView) : sur le web elle dialogue par
 * `window.postMessage`, ici ces messages sont recréés pour qu'elle fonctionne sans aucune modification.
 */

/** Exécuté avant le chargement de la page : `window.parent.postMessage(...)` remonte vers l'appli. */
export const BRIDGE_BEFORE_LOAD = `
(function () {
  var rn = window.ReactNativeWebView;
  window.parent = { postMessage: function (m) { rn.postMessage(typeof m === 'string' ? m : JSON.stringify(m)); } };
})();
true;
`;

const SLIM_KEYS = ['id', 'lat', 'lng', 'name', 'cat', 'category', 'image_url', 'rating'] as const;

const slimCache = new WeakMap<object, Record<string, unknown>>();

/** Réduit une adresse aux champs utiles à la carte (mémorisé par objet : une adresse n'est allégée qu'une fois). */
export function slimSpot(s: any): Record<string, unknown> {
  if (!s || typeof s !== 'object') return {};
  const cached = slimCache.get(s);
  if (cached) return cached;
  const out: Record<string, unknown> = {};
  for (const k of SLIM_KEYS) if (s[k] !== undefined) out[k] = s[k];
  if (out.name === undefined && s.title !== undefined) out.name = s.title;
  slimCache.set(s, out);
  return out;
}

export function slimSpots(spots: readonly any[]): Record<string, unknown>[] {
  return spots.map(slimSpot);
}

/**
 * Empreinte d'une liste telle que la carte la voit (identifiant, position, catégorie, note, nom) : si elle ne change
 * pas, inutile de renvoyer la liste à la carte.
 */
export function spotsKey(spots: readonly any[]): string {
  let h = 5381;
  for (const s of spots) {
    const str = `${s?.id}|${s?.lat}|${s?.lng}|${s?.cat ?? s?.category ?? ''}|${s?.rating ?? ''}|${s?.name ?? s?.title ?? ''}`;
    for (let i = 0; i < str.length; i++) h = ((h << 5) + h + str.charCodeAt(i)) | 0;
  }
  return `${spots.length}:${h}`;
}

/** Allège les messages de liste d'adresses : la carte n'a besoin que de quelques champs (évite d'injecter des Mo de texte). */
export function slimMapMessage(data: string): string {
  // Déjà allégé par l'appelant (slim: true) : rien à relire ni à réécrire
  if (data.indexOf('"slim":true') !== -1) return data;
  try {
    const msg = JSON.parse(data);
    if (!msg || !Array.isArray(msg.spots)) return data;
    msg.spots = slimSpots(msg.spots);
    return JSON.stringify(msg);
  } catch {
    return data;
  }
}

/** Script à injecter dans la WebView pour livrer un message à la page, comme `iframe.contentWindow.postMessage`. */
export function buildMapMessageScript(data: string): string {
  const LS = String.fromCharCode(0x2028);
  const PS = String.fromCharCode(0x2029);
  const literal = JSON.stringify(slimMapMessage(data)).split(LS).join('\\u2028').split(PS).join('\\u2029');
  return `window.dispatchEvent(new MessageEvent('message', { data: ${literal} })); true;`;
}
