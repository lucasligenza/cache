import React, { useRef, useState, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, ScrollView,
} from 'react-native';
import Animated, {
  useSharedValue, withTiming, withSequence, runOnJS, useAnimatedStyle,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { COLORS } from '../constants';
import { Category } from '../types';

interface Props {
  onCommit: (text: string, categoryId?: string) => void;
  categories: Category[];
  initialCategoryId: string | null;
}

export function CaptureScreen({ onCommit, categories, initialCategoryId }: Props) {
  const [text, setText] = useState('');
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const inputRef = useRef<TextInput>(null);
  const translateX = useSharedValue(0);
  const opacity = useSharedValue(1);

  useEffect(() => {
    if (initialCategoryId !== null) {
      setSelectedCategoryId(initialCategoryId);
      setDropdownOpen(false);
    }
  }, [initialCategoryId]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
    opacity: opacity.value,
  }));

  const handleCommit = () => {
    if (!text.trim()) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const note = text.trim();
    const catId = selectedCategoryId ?? undefined;

    const reset = () => {
      setText('');
      setSelectedCategoryId(null);
      setDropdownOpen(false);
      translateX.value = 0;
      opacity.value = 1;
      inputRef.current?.focus();
      onCommit(note, catId);
    };

    translateX.value = withSequence(
      withTiming(-8, { duration: 60 }),
      withTiming(-300, { duration: 260 })
    );
    opacity.value = withTiming(0, { duration: 280 }, (done) => {
      if (done) runOnJS(reset)();
    });
  };

  const selectCategory = (id: string | null) => {
    setSelectedCategoryId(id);
    setDropdownOpen(false);
  };

  const selectedCat = selectedCategoryId
    ? categories.find(c => c.id === selectedCategoryId)
    : null;

  const selectorLabel = selectedCat ? `→ /${selectedCat.name.toLowerCase()}` : '→ buffer';

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={80}
    >
      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.center}>
          <Text style={styles.prompt}>~/cache $</Text>
          <View style={styles.editorPane}>
            <Animated.View style={animatedStyle}>
              <TextInput
                ref={inputRef}
                style={styles.input}
                value={text}
                onChangeText={setText}
                multiline
                autoFocus
                placeholder="type a note..."
                placeholderTextColor={COLORS.textDim}
                cursorColor={selectedCat ? selectedCat.color : COLORS.accent}
                selectionColor={(selectedCat ? selectedCat.color : COLORS.accent) + '40'}
                onSubmitEditing={handleCommit}
              />
            </Animated.View>
          </View>

          {/* Category dropdown */}
          <TouchableOpacity
            style={styles.selectorRow}
            onPress={() => setDropdownOpen(o => !o)}
            activeOpacity={0.7}
          >
            <Text style={[styles.selectorLabel, selectedCat && { color: selectedCat.color }]}>
              {selectorLabel}
            </Text>
            <Text style={styles.selectorCaret}>{dropdownOpen ? '[▴]' : '[▾]'}</Text>
          </TouchableOpacity>

          {dropdownOpen && (
            <View style={styles.dropdownList}>
              <TouchableOpacity
                style={[styles.dropdownItem, !selectedCategoryId && styles.dropdownItemActive]}
                onPress={() => selectCategory(null)}
              >
                <Text style={[styles.dropdownItemText, !selectedCategoryId && { color: COLORS.textMuted }]}>
                  none  <Text style={styles.dropdownHint}>(→ buffer)</Text>
                </Text>
              </TouchableOpacity>
              {categories.map(cat => {
                const isSelected = selectedCategoryId === cat.id;
                return (
                  <TouchableOpacity
                    key={cat.id}
                    style={[
                      styles.dropdownItem,
                      isSelected && { backgroundColor: cat.color + '18' },
                    ]}
                    onPress={() => selectCategory(cat.id)}
                  >
                    <View style={[styles.dropdownSwatch, { backgroundColor: cat.color }]} />
                    <Text style={[styles.dropdownItemText, { color: cat.color }]}>
                      /{cat.name.toLowerCase()}
                    </Text>
                    {isSelected && <Text style={[styles.dropdownCheck, { color: cat.color }]}>●</Text>}
                  </TouchableOpacity>
                );
              })}
            </View>
          )}

          <TouchableOpacity
            style={[
              styles.commitBtn,
              selectedCat && { borderColor: selectedCat.color + '60' },
              dropdownOpen && { marginTop: 12 },
            ]}
            onPress={handleCommit}
            activeOpacity={0.7}
          >
            <Text style={[styles.commitText, selectedCat && { color: selectedCat.color }]}>
              commit
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  scroll: {
    flexGrow: 1,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingVertical: 48,
  },
  prompt: {
    fontFamily: 'JetBrainsMono_400Regular',
    fontSize: 12,
    color: COLORS.textMuted,
    marginBottom: 8,
    letterSpacing: 0.5,
  },
  editorPane: {
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 4,
    padding: 16,
    minHeight: 140,
    marginBottom: 12,
  },
  input: {
    fontFamily: 'JetBrainsMono_400Regular',
    fontSize: 15,
    color: COLORS.text,
    lineHeight: 22,
    minHeight: 108,
    textAlignVertical: 'top',
  },
  selectorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 3,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 2,
  },
  selectorLabel: {
    fontFamily: 'JetBrainsMono_400Regular',
    fontSize: 13,
    color: COLORS.textMuted,
    letterSpacing: 0.3,
  },
  selectorCaret: {
    fontFamily: 'JetBrainsMono_400Regular',
    fontSize: 11,
    color: COLORS.textDim,
  },
  dropdownList: {
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderTopWidth: 0,
    borderBottomLeftRadius: 3,
    borderBottomRightRadius: 3,
    marginBottom: 2,
    overflow: 'hidden',
  },
  dropdownItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 11,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    gap: 8,
  },
  dropdownItemActive: {
    backgroundColor: COLORS.surfaceHover,
  },
  dropdownItemText: {
    fontFamily: 'JetBrainsMono_400Regular',
    fontSize: 13,
    color: COLORS.textDim,
    flex: 1,
  },
  dropdownHint: {
    fontFamily: 'JetBrainsMono_400Regular',
    fontSize: 11,
    color: COLORS.textDim,
  },
  dropdownSwatch: {
    width: 6,
    height: 6,
    borderRadius: 1,
  },
  dropdownCheck: {
    fontFamily: 'JetBrainsMono_400Regular',
    fontSize: 8,
  },
  commitBtn: {
    marginTop: 12,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 4,
    paddingVertical: 14,
    alignItems: 'center',
  },
  commitText: {
    fontFamily: 'JetBrainsMono_400Regular',
    fontSize: 14,
    color: COLORS.accent,
    letterSpacing: 2,
  },
});
