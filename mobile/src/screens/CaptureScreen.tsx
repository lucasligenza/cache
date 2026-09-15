import React, { useRef, useState, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { COLORS } from '../constants';
import type { Category } from '../types';
import { resolveCaptureInput } from '../lib/capture';

interface Props {
  onCommit: (text: string, categoryId?: string) => Promise<void>;
  categories: Category[];
  initialCategoryId: string | null;
  bufferCount: number;
  /** Keyboard height already applied by the parent shell (paddingBottom). */
  keyboardOpen: boolean;
}

export function CaptureScreen({
  onCommit, categories, initialCategoryId, bufferCount, keyboardOpen,
}: Props) {
  const [text, setText] = useState('');
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const inputRef = useRef<TextInput>(null);

  useEffect(() => {
    if (initialCategoryId !== null) setSelectedCategoryId(initialCategoryId);
  }, [initialCategoryId]);

  useEffect(() => {
    if (keyboardOpen) {
      const t = setTimeout(() => inputRef.current?.focus(), 50);
      return () => clearTimeout(t);
    }
  }, [keyboardOpen]);

  const selectedCat = selectedCategoryId
    ? categories.find(c => c.id === selectedCategoryId)
    : null;

  const handleCommit = async () => {
    if (submitting) return;
    const resolved = resolveCaptureInput(text, categories, selectedCategoryId);
    if (!resolved.ok) {
      setStatus(resolved.hint);
      return;
    }

    setSubmitting(true);
    setStatus(resolved.warning ?? null);
    try {
      await onCommit(resolved.text, resolved.categoryId);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      setText('');
      setSelectedCategoryId(null);
      setStatus(resolved.warning ?? 'cached ✓');
      // Stay on capture — saving must not launch review, todos, or nags.
      inputRef.current?.focus();
    } catch {
      setStatus('could not cache — kept in editor');
    } finally {
      setSubmitting(false);
    }
  };

  const canSave = text.trim().length > 0 && !submitting;
  const accent = selectedCat?.color ?? COLORS.accent;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.prompt}>~/cache $</Text>
        <Text style={styles.bufferCount}>
          {bufferCount} in buffer
        </Text>
      </View>

      {status ? (
        <Text
          style={[
            styles.status,
            status.startsWith('cached') ? styles.statusOk : styles.statusWarn,
          ]}
          accessibilityLiveRegion="polite"
        >
          {status}
        </Text>
      ) : (
        <Text style={styles.hint}>memory inbox — save files a thought, nothing else</Text>
      )}

      <View style={styles.spacer} />

      <View style={styles.composer} accessibilityLabel="capture composer">
        <View style={[styles.editorPane, keyboardOpen && { borderColor: COLORS.accent + '66' }]}>
          <TextInput
            ref={inputRef}
            style={styles.input}
            value={text}
            onChangeText={t => {
              setText(t);
              if (status) setStatus(null);
            }}
            multiline
            autoFocus
            blurOnSubmit={false}
            returnKeyType="default"
            placeholder="type a note..."
            placeholderTextColor={COLORS.textDim}
            cursorColor={accent}
            selectionColor={accent + '40'}
            textAlignVertical="top"
            accessibilityLabel="note"
          />
        </View>

        <ScrollView
          horizontal
          keyboardShouldPersistTaps="handled"
          showsHorizontalScrollIndicator={false}
          style={styles.chipRow}
          contentContainerStyle={styles.chipRowContent}
          accessibilityLabel="file to"
        >
          <TouchableOpacity
            style={[styles.chip, !selectedCat && styles.chipActive]}
            onPress={() => setSelectedCategoryId(null)}
            accessibilityRole="button"
            accessibilityState={{ selected: !selectedCat }}
            accessibilityLabel="file to buffer"
          >
            <Text style={[styles.chipText, !selectedCat && styles.chipTextActive]}>buffer</Text>
          </TouchableOpacity>
          {categories.map(cat => {
            const active = selectedCategoryId === cat.id;
            return (
              <TouchableOpacity
                key={cat.id}
                style={[styles.chip, active && { borderColor: cat.color, backgroundColor: cat.color + '18' }]}
                onPress={() => setSelectedCategoryId(cat.id)}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                accessibilityLabel={`file to ${cat.name}`}
              >
                <Text style={[styles.chipText, { color: cat.color }]}>/{cat.name.toLowerCase()}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        <TouchableOpacity
          style={[
            styles.saveBtn,
            canSave ? { borderColor: accent + '99' } : styles.saveBtnDisabled,
          ]}
          onPress={handleCommit}
          disabled={!canSave}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel="save"
          accessibilityState={{ disabled: !canSave, busy: submitting }}
        >
          <Text style={[styles.saveText, { color: canSave ? accent : COLORS.textDim }]}>
            {submitting ? 'saving…' : 'save'}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
    paddingHorizontal: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    paddingTop: 12,
  },
  prompt: {
    fontFamily: 'JetBrainsMono_400Regular',
    fontSize: 12,
    color: COLORS.textMuted,
    letterSpacing: 0.5,
  },
  bufferCount: {
    fontFamily: 'JetBrainsMono_400Regular',
    fontSize: 11,
    color: COLORS.amber,
    letterSpacing: 0.3,
  },
  hint: {
    fontFamily: 'JetBrainsMono_400Regular',
    fontSize: 11,
    color: COLORS.textDim,
    marginTop: 8,
  },
  status: {
    fontFamily: 'JetBrainsMono_400Regular',
    fontSize: 12,
    marginTop: 8,
  },
  statusOk: { color: COLORS.accent },
  statusWarn: { color: COLORS.amber },
  spacer: {
    flex: 1,
    minHeight: 8,
  },
  composer: {
    paddingBottom: 8,
  },
  editorPane: {
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 4,
    paddingHorizontal: 12,
    paddingVertical: 10,
    minHeight: 88,
    maxHeight: 160,
  },
  input: {
    fontFamily: 'JetBrainsMono_400Regular',
    fontSize: 16,
    color: COLORS.text,
    lineHeight: 22,
    minHeight: 68,
    textAlignVertical: 'top',
  },
  chipRow: {
    marginTop: 10,
    flexGrow: 0,
  },
  chipRowContent: {
    gap: 8,
    paddingRight: 8,
    alignItems: 'center',
  },
  chip: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 3,
    backgroundColor: COLORS.surface,
  },
  chipActive: {
    borderColor: COLORS.textMuted,
  },
  chipText: {
    fontFamily: 'JetBrainsMono_400Regular',
    fontSize: 12,
    color: COLORS.textMuted,
  },
  chipTextActive: {
    color: COLORS.text,
  },
  saveBtn: {
    marginTop: 10,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 4,
    minHeight: 52,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveBtnDisabled: {
    opacity: 0.7,
  },
  saveText: {
    fontFamily: 'JetBrainsMono_700Bold',
    fontSize: 16,
    letterSpacing: 3,
  },
});
