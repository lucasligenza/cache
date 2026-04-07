import React, { useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity, Alert,
} from 'react-native';
import Animated, {
  useSharedValue, withTiming, useAnimatedStyle, runOnJS,
} from 'react-native-reanimated';

import * as Haptics from 'expo-haptics';
import { formatDistanceToNow, differenceInDays } from 'date-fns';
import { Note, Category } from '../types';
import { COLORS } from '../constants';

const ANTHROPIC_KEY = process.env.EXPO_PUBLIC_ANTHROPIC_API_KEY || '';

interface BufferCardProps {
  note: Note;
  categories: Category[];
  onAssign: (noteId: string, categoryId: string) => void;
  onDelete: (noteId: string) => void;
}

function BufferCard({ note, categories, onAssign, onDelete }: BufferCardProps) {
  const [aiSuggestion, setAiSuggestion] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [sortingText, setSortingText] = useState<string | null>(null);
  const [trayOpen, setTrayOpen] = useState(false);

  const translateX = useSharedValue(0);
  const cardOpacity = useSharedValue(1);

  const animatedCardStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
    opacity: cardOpacity.value,
  }));

  const ageDays = differenceInDays(new Date(), new Date(note.created_at));
  const isStale = ageDays >= 3;
  const relTime = formatDistanceToNow(new Date(note.created_at), { addSuffix: true });
  const borderColor = isStale ? COLORS.red : COLORS.amber;

  const exitCard = (catName?: string) => {
    if (catName) setSortingText(`mv → /${catName.toLowerCase()}`);
    setTimeout(() => {
      translateX.value = withTiming(-400, { duration: 250 });
      cardOpacity.value = withTiming(0, { duration: 280 });
    }, catName ? 180 : 0);
  };

  const handleAssign = (cat: Category) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setTrayOpen(false);
    exitCard(cat.name);
    setTimeout(() => onAssign(note.id, cat.id), 430);
  };

  const confirmDelete = () => {
    Alert.alert(
      'Delete note?',
      note.text.length > 60 ? note.text.slice(0, 60) + '...' : note.text,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'rm',
          style: 'destructive',
          onPress: () => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            cardOpacity.value = withTiming(0, { duration: 200 }, (done) => {
              if (done) runOnJS(onDelete)(note.id);
            });
            translateX.value = withTiming(-400, { duration: 220 });
          },
        },
      ]
    );
  };

  const handleAutoSort = async () => {
    if (!ANTHROPIC_KEY) {
      Alert.alert('API Key missing', 'Set EXPO_PUBLIC_ANTHROPIC_API_KEY in .env');
      return;
    }
    setAiLoading(true);
    try {
      const categoryNames = categories.map(c => c.name).join(', ');
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'x-api-key': ANTHROPIC_KEY,
          'anthropic-version': '2023-06-01',
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          model: 'claude-haiku-4-5-20251001',
          max_tokens: 20,
          messages: [{
            role: 'user',
            content: `Categorize this note into exactly one of these categories: ${categoryNames}. Note: "${note.text}". Reply with ONLY the category name, nothing else.`,
          }],
        }),
      });
      const data = await res.json();
      const suggested = data.content?.[0]?.text?.trim();
      setAiSuggestion(suggested || null);
    } catch (e) {
      console.error(e);
    }
    setAiLoading(false);
  };

  const suggestedCat = aiSuggestion
    ? categories.find(c => c.name.toLowerCase() === aiSuggestion.toLowerCase())
    : null;

  return (
    <Animated.View style={[styles.card, { borderLeftColor: borderColor }, animatedCardStyle]}>
      {sortingText && <Text style={styles.sortingText}>{sortingText}</Text>}
      {isStale && !sortingText && <Text style={styles.staleTag}>stale</Text>}

      <TouchableOpacity activeOpacity={0.7} onPress={() => setTrayOpen(o => !o)}>
        <Text style={styles.noteText} numberOfLines={4}>{note.text}</Text>
        <Text style={styles.timestamp}>{relTime}</Text>
      </TouchableOpacity>

      {aiSuggestion && suggestedCat && (
        <View style={styles.aiRow}>
          <Text style={[styles.aiSuggestion, { color: suggestedCat.color }]}>
            → /{aiSuggestion.toLowerCase()}
          </Text>
          <TouchableOpacity style={styles.aiBtn} onPress={() => handleAssign(suggestedCat)}>
            <Text style={styles.aiBtnText}>[y]</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.aiBtn} onPress={() => setAiSuggestion(null)}>
            <Text style={[styles.aiBtnText, { color: COLORS.red }]}>[n]</Text>
          </TouchableOpacity>
        </View>
      )}

      {trayOpen ? (
        <View style={styles.tray}>
          <View style={styles.trayGrid}>
            {categories.map(cat => (
              <TouchableOpacity
                key={cat.id}
                style={[styles.trayChip, { borderColor: cat.color }]}
                onPress={() => handleAssign(cat)}
              >
                <View style={[styles.traySwatch, { backgroundColor: cat.color }]} />
                <Text style={[styles.trayChipText, { color: cat.color }]}>
                  /{cat.name.toLowerCase()}
                </Text>
              </TouchableOpacity>
            ))}
            <TouchableOpacity
              style={[styles.trayChip, styles.rmChip]}
              onPress={() => { setTrayOpen(false); confirmDelete(); }}
            >
              <Text style={styles.rmChipText}>rm</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.catRow}
          contentContainerStyle={styles.catRowContent}
        >
          {categories.map(cat => (
            <TouchableOpacity
              key={cat.id}
              style={styles.catChip}
              onPress={() => handleAssign(cat)}
            >
              <Text style={[styles.catChipText, { color: cat.color }]}>
                /{cat.name.toLowerCase()}
              </Text>
            </TouchableOpacity>
          ))}
          <TouchableOpacity
            style={[styles.catChip, styles.autoChip]}
            onPress={handleAutoSort}
            disabled={aiLoading}
          >
            <Text style={styles.autoChipText}>
              {aiLoading ? '...' : 'sort --auto'}
            </Text>
          </TouchableOpacity>
        </ScrollView>
      )}
    </Animated.View>
  );
}

interface Props {
  notes: Note[];
  categories: Category[];
  onAssign: (noteId: string, categoryId: string) => void;
  onDelete: (noteId: string) => void;
}

export function BufferScreen({ notes, categories, onAssign, onDelete }: Props) {
  const unsorted = notes.filter(n => !n.category_id);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerText}>
          uncommitted <Text style={styles.headerCount}>[{unsorted.length}]</Text>
        </Text>
      </View>

      {unsorted.length >= 5 && (
        <View style={styles.banner}>
          <Text style={styles.bannerText}>// {unsorted.length} uncommitted notes</Text>
        </View>
      )}

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.grid}
        showsVerticalScrollIndicator={false}
      >
        {unsorted.map(note => (
          <BufferCard
            key={note.id}
            note={note}
            categories={categories}
            onAssign={onAssign}
            onDelete={onDelete}
          />
        ))}
        {unsorted.length === 0 && (
          <Text style={styles.empty}>// buffer empty</Text>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  header: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 4,
  },
  headerText: {
    fontFamily: 'JetBrainsMono_400Regular',
    fontSize: 13,
    color: COLORS.textMuted,
    letterSpacing: 0.5,
  },
  headerCount: { color: COLORS.amber },
  banner: {
    marginHorizontal: 16,
    marginBottom: 8,
    padding: 8,
    borderLeftWidth: 2,
    borderLeftColor: COLORS.accent,
    backgroundColor: COLORS.surface,
  },
  bannerText: {
    fontFamily: 'JetBrainsMono_400Regular',
    fontSize: 12,
    color: COLORS.accent,
    opacity: 0.7,
  },
  scroll: { flex: 1 },
  grid: { padding: 12, gap: 10 },
  card: {
    backgroundColor: COLORS.surface,
    borderLeftWidth: 3,
    borderRadius: 3,
    padding: 12,
  },
  noteText: {
    fontFamily: 'JetBrainsMono_400Regular',
    fontSize: 13,
    color: COLORS.text,
    lineHeight: 20,
    marginBottom: 6,
  },
  timestamp: {
    fontFamily: 'JetBrainsMono_400Regular',
    fontSize: 10,
    color: COLORS.textMuted,
    marginBottom: 8,
  },
  sortingText: {
    fontFamily: 'JetBrainsMono_400Regular',
    fontSize: 11,
    color: COLORS.accent,
    marginBottom: 4,
  },
  staleTag: {
    fontFamily: 'JetBrainsMono_400Regular',
    fontSize: 10,
    color: COLORS.red,
    marginBottom: 4,
  },
  aiRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  aiSuggestion: {
    fontFamily: 'JetBrainsMono_400Regular',
    fontSize: 12,
  },
  aiBtn: { padding: 2 },
  aiBtnText: {
    fontFamily: 'JetBrainsMono_400Regular',
    fontSize: 12,
    color: COLORS.accent,
  },
  catRow: { marginTop: 4 },
  catRowContent: { gap: 8, paddingRight: 8 },
  catChip: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    backgroundColor: COLORS.background,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 2,
  },
  catChipText: {
    fontFamily: 'JetBrainsMono_400Regular',
    fontSize: 11,
  },
  autoChip: { borderColor: COLORS.textDim },
  autoChipText: {
    fontFamily: 'JetBrainsMono_400Regular',
    fontSize: 11,
    color: COLORS.textDim,
  },
  tray: {
    marginTop: 8,
  },
  trayGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  trayChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderWidth: 1,
    borderRadius: 2,
    backgroundColor: COLORS.background,
  },
  traySwatch: {
    width: 6,
    height: 6,
    borderRadius: 1,
  },
  trayChipText: {
    fontFamily: 'JetBrainsMono_400Regular',
    fontSize: 12,
  },
  rmChip: {
    borderColor: COLORS.red,
  },
  rmChipText: {
    fontFamily: 'JetBrainsMono_400Regular',
    fontSize: 12,
    color: COLORS.red,
  },
  empty: {
    fontFamily: 'JetBrainsMono_400Regular',
    fontSize: 13,
    color: COLORS.textDim,
    textAlign: 'center',
    marginTop: 40,
  },
});
