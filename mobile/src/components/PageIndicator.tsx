import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { COLORS } from '../constants';

interface Props {
  currentPage: number;
  onPress: (page: number) => void;
  unsortedCount: number;
}

export function PageIndicator({ currentPage, onPress, unsortedCount }: Props) {
  const labels = [
    unsortedCount > 0 ? `[${unsortedCount}]` : '[ ]',
    currentPage === 1 ? '[•]' : '[ ]',
    '[ ]',
  ];

  return (
    <View style={styles.container}>
      {labels.map((label, i) => (
        <TouchableOpacity key={i} onPress={() => onPress(i)} style={styles.item}>
          <Text style={[
            styles.text,
            currentPage === i && styles.active,
            i === 0 && unsortedCount > 0 && styles.amber,
          ]}>
            {i === 0 ? (unsortedCount > 0 ? `[${unsortedCount}]` : '[ ]') :
             i === 1 ? (currentPage === 1 ? '[•]' : '[ ]') :
             currentPage === 2 ? '[•]' : '[ ]'}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 12,
    gap: 16,
    backgroundColor: COLORS.background,
  },
  item: {
    padding: 4,
  },
  text: {
    fontFamily: 'JetBrainsMono_400Regular',
    fontSize: 12,
    color: COLORS.textMuted,
    letterSpacing: 2,
  },
  active: {
    color: COLORS.accent,
  },
  amber: {
    color: COLORS.amber,
  },
});
