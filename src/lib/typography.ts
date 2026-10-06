import { StyleSheet, Text, TextInput } from 'react-native';

/**
 * Typographie de marque appliquée globalement : le poids demandé (fontWeight)
 * est converti en police — Bricolage Grotesque (néo-grotesque expressive) pour
 * les titres, Plus Jakarta Sans pour la lecture.
 */
function pickFamily(weight: number, size: number): { family: string; display: boolean } {
  if (weight >= 800 && size >= 22) return { family: 'BricolageGrotesque_800ExtraBold', display: true };
  if (weight >= 700 && size >= 17) return { family: 'BricolageGrotesque_700Bold', display: true };
  if (weight >= 800) return { family: 'PlusJakartaSans_800ExtraBold', display: false };
  if (weight >= 700) return { family: 'PlusJakartaSans_700Bold', display: false };
  if (weight >= 600) return { family: 'PlusJakartaSans_600SemiBold', display: false };
  if (weight >= 500) return { family: 'PlusJakartaSans_500Medium', display: false };
  return { family: 'PlusJakartaSans_400Regular', display: false };
}

function patch(Component: any) {
  const original = Component.render;
  if (!original || Component.__brandPatched) return;
  Component.__brandPatched = true;
  Component.render = function (props: any, ref: any) {
    const flat: any = StyleSheet.flatten(props.style) || {};
    if (flat.fontFamily) return original.call(this, props, ref);
    const weight = flat.fontWeight === 'bold' ? 700 : parseInt(String(flat.fontWeight ?? '400'), 10) || 400;
    const size = typeof flat.fontSize === 'number' ? flat.fontSize : 14;
    const { family, display } = pickFamily(weight, size);
    const override: any = { fontFamily: family, fontWeight: 'normal' };
    if (display && typeof flat.letterSpacing === 'number' && flat.letterSpacing < -0.3) {
      override.letterSpacing = -0.3;
    }
    return original.call(this, { ...props, style: [props.style, override] }, ref);
  };
}

export function applyBrandTypography() {
  patch(Text);
  patch(TextInput);
}
