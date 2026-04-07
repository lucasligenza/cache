import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableWithoutFeedback } from 'react-native';
import { COLORS } from '../constants';

const LINES = [
  'initializing cache...',
  'mounting storage...',
  'ready.',
];

interface Props {
  onDone: () => void;
}

export function BootSequence({ onDone }: Props) {
  const [visibleLines, setVisibleLines] = useState<number>(0);

  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = [];
    LINES.forEach((_, i) => {
      timers.push(setTimeout(() => setVisibleLines(i + 1), i * 250 + 100));
    });
    timers.push(setTimeout(onDone, 850));
    return () => timers.forEach(clearTimeout);
  }, [onDone]);

  return (
    <TouchableWithoutFeedback onPress={onDone}>
      <View style={styles.container}>
        {LINES.slice(0, visibleLines).map((line, i) => (
          <Text key={i} style={[styles.line, line === 'ready.' && styles.ready]}>
            {line}
          </Text>
        ))}
        {visibleLines < LINES.length && <Text style={styles.cursor}>▋</Text>}
      </View>
    </TouchableWithoutFeedback>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
    justifyContent: 'center',
    alignItems: 'flex-start',
    paddingHorizontal: 32,
  },
  line: {
    fontFamily: 'JetBrainsMono_400Regular',
    fontSize: 14,
    color: COLORS.accent,
    marginBottom: 4,
    letterSpacing: 0.5,
  },
  ready: {
    color: COLORS.accent,
    opacity: 0.9,
  },
  cursor: {
    fontFamily: 'JetBrainsMono_400Regular',
    fontSize: 14,
    color: COLORS.accent,
    opacity: 0.8,
  },
});
