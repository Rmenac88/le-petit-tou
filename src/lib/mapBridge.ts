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

/** Allège les messages de liste d'adresses : la carte n'a besoin que de quelques champs (évite d'injecter des Mo de texte). */
export function slimMapMessage(data: string): string {
  try {
    const msg = JSON.parse(data);
    if (!msg || !Array.isArray(msg.spots)) return data;
    msg.spots = msg.spots.map((s: any) => {
      const out: Record<string, unknown> = {};
      for (const k of SLIM_KEYS) if (s?.[k] !== undefined) out[k] = s[k];
      if (out.name === undefined && s?.title !== undefined) out.name = s.title;
      return out;
    });
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
