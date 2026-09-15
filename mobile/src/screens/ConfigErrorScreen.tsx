import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { COLORS } from '../constants';

export function ConfigErrorScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.prompt}>~/cache $ FATAL</Text>
      <Text style={styles.body}>missing supabase credentials</Text>
      <Text style={styles.hint}>
        copy mobile/.env.example to mobile/.env and set EXPO_PUBLIC_SUPABASE_URL
        + EXPO_PUBLIC_SUPABASE_ANON_KEY, or fill expo.extra in app.json
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  prompt: {
    fontFamily: 'JetBrainsMono_400Regular',
    fontSize: 14,
    color: COLORS.red,
    marginBottom: 12,
  },
  body: {
    fontFamily: 'JetBrainsMono_400Regular',
    fontSize: 15,
    color: COLORS.text,
    marginBottom: 16,
  },
  hint: {
    fontFamily: 'JetBrainsMono_400Regular',
    fontSize: 12,
    color: COLORS.textMuted,
    lineHeight: 18,
  },
});
