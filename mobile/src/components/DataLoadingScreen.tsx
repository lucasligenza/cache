import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { COLORS } from '../constants';

export function DataLoadingScreen() {
  const dot1 = useRef(new Animated.Value(0)).current;
  const dot2 = useRef(new Animated.Value(0)).current;
  const dot3 = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const pulse = (dot: Animated.Value, delay: number) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(dot, { toValue: 1, duration: 300, useNativeDriver: true }),
          Animated.timing(dot, { toValue: 0.2, duration: 300, useNativeDriver: true }),
          Animated.delay(600),
        ])
      );

    const a1 = pulse(dot1, 0);
    const a2 = pulse(dot2, 200);
    const a3 = pulse(dot3, 400);
    a1.start(); a2.start(); a3.start();
    return () => { a1.stop(); a2.stop(); a3.stop(); };
  }, [dot1, dot2, dot3]);

  return (
    <View style={styles.container}>
      <View style={styles.block}>
        <Text style={styles.label}>~/cache $</Text>
        <View style={styles.row}>
          <Text style={styles.cmd}>syncing</Text>
          <Animated.Text style={[styles.dot, { opacity: dot1 }]}>.</Animated.Text>
          <Animated.Text style={[styles.dot, { opacity: dot2 }]}>.</Animated.Text>
          <Animated.Text style={[styles.dot, { opacity: dot3 }]}>.</Animated.Text>
        </View>
      </View>
    </View>
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
  block: {
    gap: 6,
  },
  label: {
    fontFamily: 'JetBrainsMono_400Regular',
    fontSize: 11,
    color: COLORS.textDim,
    letterSpacing: 0.5,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-end',
  },
  cmd: {
    fontFamily: 'JetBrainsMono_400Regular',
    fontSize: 15,
    color: COLORS.accent,
    letterSpacing: 1,
  },
  dot: {
    fontFamily: 'JetBrainsMono_400Regular',
    fontSize: 15,
    color: COLORS.accent,
    letterSpacing: 2,
    lineHeight: 20,
  },
});
