import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Brand, Radius, Type } from '../../../constants/brand';
import { dayChipLabel, formatDateFr } from '../../../lib/agendaOccurrences.ts';

interface DayStripProps {
  days: string[];
  selected: string;
  markedDays: Set<string>;
  onSelect: (iso: string) => void;
}

/** Bandeau horizontal de jours ; une pastille jaune marque les jours qui ont des dates. */
export default function DayStrip({ days, selected, markedDays, onSelect }: DayStripProps) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.row}
    >
      {days.map((iso) => {
        const isSelected = iso === selected;
        const { weekday, day } = dayChipLabel(iso);
        return (
          <Pressable
            key={iso}
            onPress={() => onSelect(iso)}
            style={[styles.chip, isSelected && styles.chipSelected]}
            accessibilityLabel={formatDateFr(iso)}
            accessibilityState={{ selected: isSelected }}
          >
            <Text style={[styles.weekday, isSelected && styles.textSelected]}>{weekday}</Text>
            <Text style={[styles.day, isSelected && styles.textSelected]}>{day}</Text>
            <View style={[styles.dot, markedDays.has(iso) && styles.dotOn]} />
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: {
    paddingHorizontal: 20,
    gap: 8,
    paddingBottom: 4,
  },
  chip: {
    width: 56,
    minHeight: 72,
    borderRadius: Radius.lg,
    backgroundColor: Brand.white,
    borderWidth: 1,
    borderColor: Brand.line,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  chipSelected: {
    backgroundColor: Brand.primaryDeep,
    borderColor: Brand.primaryDeep,
  },
  weekday: {
    fontSize: Type.caption,
    fontWeight: '600',
    color: Brand.inkSoft,
  },
  day: {
    fontSize: Type.title3,
    fontWeight: '700',
    color: Brand.ink,
  },
  textSelected: {
    color: Brand.white,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: 'transparent',
  },
  dotOn: {
    backgroundColor: Brand.chouchou,
  },
});
