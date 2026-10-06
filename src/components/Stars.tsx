import React from 'react';
import { StyleSheet, View } from 'react-native';

import { Brand } from '../constants/brand';
/** [x%, y%, taille, opacité] — petites étoiles du ciel « violet sidéral » */
const STARS: [number, number, number, number][] = [
  [8, 14, 3, 0.9], [22, 8, 2, 0.6], [38, 20, 2, 0.5], [55, 10, 3, 0.8],
  [70, 18, 2, 0.6], [86, 9, 3, 0.9], [93, 28, 2, 0.5], [12, 46, 2, 0.5],
  [47, 40, 2, 0.4], [78, 52, 2, 0.5], [30, 62, 2, 0.4], [64, 70, 3, 0.7],
];

export default function Stars() {
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {STARS.map(([x, y, s, o], i) => (
        <View
          key={i}
          style={{
            position: 'absolute',
            left: `${x}%`,
            top: `${y}%`,
            width: s,
            height: s,
            borderRadius: s,
            backgroundColor: Brand.white,
            opacity: o,
          }}
        />
      ))}
    </View>
  );
}
