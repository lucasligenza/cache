import React, { useState, useMemo, useCallback } from 'react';
import { GraphView } from './GraphView';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  TextInput, Alert, Modal,
} from 'react-native';
import Animated, { FadeInDown, FadeOut } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import DateTimePicker from '@react-native-community/datetimepicker';
import { formatDistanceToNow, format, isAfter, subDays } from 'date-fns';
import { Note, Category } from '../types';
import { COLORS } from '../constants';
import { scheduleNoteReminder } from '../hooks/useReminders';

// ─── Settings Modal ──────────────────────────────────────────────────────────

function SettingsModal({ visible, onClose, categories, onCreate, onRename, onDelete }: {
  visible: boolean; onClose: () => void; categories: Category[];
  onCreate: (name: string) => void; onRename: (id: string, name: string) => void;
  onDelete: (id: string) => void;
}) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const [newCatName, setNewCatName] = useState('');
  const [showNewInput, setShowNewInput] = useState(false);
  const atMax = categories.length >= 10;
  const nearMax = categories.length === 9;

  const handleDelete = (cat: Category) => {
    Alert.alert('Delete directory', `Notes in /${cat.name.toLowerCase()} will return to buffer.`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'rm', style: 'destructive', onPress: () => onDelete(cat.id) },
    ]);
  };

  const handleCreate = () => {
    if (!newCatName.trim() || atMax) return;
    onCreate(newCatName.trim());
    setNewCatName(''); setShowNewInput(false);
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <View style={ss.container}>
        <View style={ss.header}>
          <Text style={ss.title}>config</Text>
          <TouchableOpacity onPress={onClose}><Text style={ss.close}>[close]</Text></TouchableOpacity>
        </View>
        <ScrollView style={ss.list}>
          {categories.map(cat => (
            <View key={cat.id} style={ss.row}>
              <View style={[ss.swatch, { backgroundColor: cat.color }]} />
              {editingId === cat.id ? (
                <TextInput style={ss.editInput} value={editingName} onChangeText={setEditingName} autoFocus />
              ) : (
                <TouchableOpacity style={{ flex: 1 }} onPress={() => { setEditingId(cat.id); setEditingName(cat.name); }}>
                  <Text style={ss.catName}>/{cat.name.toLowerCase()}</Text>
                </TouchableOpacity>
              )}
              {editingId === cat.id ? (
                <TouchableOpacity style={ss.saveChip} onPress={() => { onRename(cat.id, editingName.trim()); setEditingId(null); }}>
                  <Text style={ss.saveChipText}>save</Text>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity style={ss.rmChip} onPress={() => handleDelete(cat)}>
                  <Text style={ss.rmChipText}>rm</Text>
                </TouchableOpacity>
              )}
            </View>
          ))}
          {nearMax && <Text style={ss.limitWarning}>// limit: 9/10</Text>}
          {atMax && <Text style={ss.limitWarning}>// max dirs reached</Text>}
          {!atMax && !showNewInput && (
            <TouchableOpacity style={ss.addBtn} onPress={() => setShowNewInput(true)}>
              <Text style={ss.addBtnText}>+ add category</Text>
            </TouchableOpacity>
          )}
          {showNewInput && !atMax && (
            <View style={ss.newInputRow}>
              <TextInput style={ss.newInput} value={newCatName} onChangeText={setNewCatName}
                placeholder="category name" placeholderTextColor={COLORS.textDim} autoFocus />
              <TouchableOpacity style={ss.saveChip} onPress={handleCreate}>
                <Text style={ss.saveChipText}>save</Text>
              </TouchableOpacity>
            </View>
          )}
        </ScrollView>
      </View>
    </Modal>
  );
}

const ss = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingTop: 24, paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  title: { fontFamily: 'JetBrainsMono_400Regular', fontSize: 18, color: COLORS.text, letterSpacing: 1 },
  close: { fontFamily: 'JetBrainsMono_400Regular', fontSize: 13, color: COLORS.textMuted },
  list: { padding: 20 },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: COLORS.border, gap: 12 },
  swatch: { width: 10, height: 10, borderRadius: 2 },
  catName: { fontFamily: 'JetBrainsMono_400Regular', fontSize: 14, color: COLORS.text },
  editInput: { flex: 1, fontFamily: 'JetBrainsMono_400Regular', fontSize: 14, color: COLORS.text, backgroundColor: COLORS.surface, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 2, borderWidth: 1, borderColor: COLORS.border },
  rmChip: { paddingHorizontal: 8, paddingVertical: 3, backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.red, borderRadius: 2 },
  rmChipText: { fontFamily: 'JetBrainsMono_400Regular', fontSize: 11, color: COLORS.red },
  saveChip: { paddingHorizontal: 8, paddingVertical: 3, backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.accent, borderRadius: 2 },
  saveChipText: { fontFamily: 'JetBrainsMono_400Regular', fontSize: 11, color: COLORS.accent },
  limitWarning: { fontFamily: 'JetBrainsMono_400Regular', fontSize: 12, color: COLORS.textMuted, marginTop: 12, marginBottom: 4 },
  addBtn: { marginTop: 16, paddingVertical: 10, borderWidth: 1, borderColor: COLORS.border, borderRadius: 2, alignItems: 'center', borderStyle: 'dashed' },
  addBtnText: { fontFamily: 'JetBrainsMono_400Regular', fontSize: 13, color: COLORS.textMuted },
  newInputRow: { flexDirection: 'row', gap: 8, marginTop: 12, alignItems: 'center' },
  newInput: { flex: 1, fontFamily: 'JetBrainsMono_400Regular', fontSize: 14, color: COLORS.text, backgroundColor: COLORS.surface, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 2, borderWidth: 1, borderColor: COLORS.border },
});


// ─── Ping Bottom Sheet ────────────────────────────────────────────────────────

function PingSheet({ visible, onClose, onSchedule }: {
  visible: boolean; onClose: () => void; onSchedule: (date: Date) => void;
}) {
  const [showDatePicker, setShowDatePicker] = useState(false);
  const mk = (daysAhead: number) => { const d = new Date(); d.setDate(d.getDate() + daysAhead); d.setHours(9, 0, 0, 0); return d; };
  const options = [
    { label: 'tomorrow, 9am', fn: () => mk(1) },
    { label: 'in 3 days', fn: () => mk(3) },
    { label: 'next week', fn: () => mk(7) },
  ];
  return (
    <Modal visible={visible} transparent animationType="slide">
      <TouchableOpacity style={ps.overlay} onPress={onClose} activeOpacity={1}>
        <View style={ps.sheet}>
          <Text style={ps.title}>ping</Text>
          {options.map(opt => (
            <TouchableOpacity key={opt.label} style={ps.option} onPress={() => { onSchedule(opt.fn()); onClose(); }}>
              <Text style={ps.optionText}>{opt.label}</Text>
            </TouchableOpacity>
          ))}
          <TouchableOpacity style={[ps.option, ps.pickDate]} onPress={() => setShowDatePicker(true)}>
            <Text style={ps.optionText}>pick a date</Text>
          </TouchableOpacity>
          {showDatePicker && (
            <DateTimePicker value={new Date()} mode="datetime" display="spinner" minimumDate={new Date()}
              themeVariant="dark" onChange={(_, date) => { setShowDatePicker(false); if (date) { onSchedule(date); onClose(); } }} />
          )}
        </View>
      </TouchableOpacity>
    </Modal>
  );
}

const ps = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.6)' },
  sheet: { backgroundColor: COLORS.surface, borderTopWidth: 1, borderTopColor: COLORS.border, padding: 24, gap: 4 },
  title: { fontFamily: 'JetBrainsMono_400Regular', fontSize: 12, color: COLORS.textMuted, marginBottom: 8, letterSpacing: 1 },
  option: { paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  pickDate: { borderBottomWidth: 0 },
  optionText: { fontFamily: 'JetBrainsMono_400Regular', fontSize: 16, color: COLORS.text },
});

// ─── Note Card ────────────────────────────────────────────────────────────────

function NoteCard({ note, category, onUpdate, onArchive, onOpenGraph, index }: {
  note: Note; category: Category;
  onUpdate: (id: string, updates: any) => void;
  onArchive: (id: string) => void;
  onOpenGraph: (note: Note) => void;
  index: number;
}) {
  const [editing, setEditing] = useState(false);
  const [editText, setEditText] = useState(note.text);
  const [pingVisible, setPingVisible] = useState(false);

  const relTime = formatDistanceToNow(new Date(note.created_at), { addSuffix: true });

  const handleSave = () => { onUpdate(note.id, { text: editText }); setEditing(false); };

  const handleDismissPing = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onUpdate(note.id, { pending_review: false });
  };

  const handleSchedule = async (date: Date) => {
    await onUpdate(note.id, { remind_at: date.toISOString() });
    await scheduleNoteReminder({ ...note, remind_at: date.toISOString() });
  };

  const handlePin = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onUpdate(note.id, { pinned: !note.pinned });
  };

  const handleArchive = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onArchive(note.id);
  };

  return (
    <Animated.View
      entering={FadeInDown.delay(index * 60).duration(200)}
      exiting={FadeOut.duration(200)}
      style={[styles.noteCard, { borderLeftColor: category.color }]}
    >
      <View style={styles.cardTopRow}>
        {note.pending_review && (
          <TouchableOpacity onPress={handleDismissPing}>
            <Text style={styles.pingBadge}>[PING]</Text>
          </TouchableOpacity>
        )}
        {note.pinned && <Text style={styles.pinnedGlyph}>◆</Text>}
      </View>

      {note.remind_at && !note.pending_review && (
        <Text style={styles.pingScheduled}>
          ping → {format(new Date(note.remind_at), 'MMM d, h:mma').toLowerCase()}
        </Text>
      )}

      {editing ? (
        <TextInput style={styles.editInput} value={editText} onChangeText={setEditText} multiline autoFocus />
      ) : (
        <Text style={styles.noteText}>{note.text}</Text>
      )}

      <Text style={styles.timestamp}>{relTime}</Text>

      <View style={styles.cardActions}>
        {editing ? (
          <TouchableOpacity style={styles.chip} onPress={handleSave}>
            <Text style={[styles.chipText, { color: COLORS.accent }]}>save</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity style={styles.chip} onPress={() => { setEditing(true); setEditText(note.text); }}>
            <Text style={styles.chipText}>edit</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity
          style={[styles.chip, note.remind_at ? styles.pingActiveChip : null]}
          onPress={() => setPingVisible(true)}
        >
          <Text style={[styles.chipText, note.remind_at ? { color: COLORS.accent } : null]}>ping</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.chip} onPress={() => onOpenGraph(note)}>
          <Text style={styles.chipText}>graph</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.chip, note.pinned ? styles.pinnedChip : null]}
          onPress={handlePin}
        >
          <Text style={[styles.chipText, note.pinned ? { color: COLORS.accent } : null]}>
            {note.pinned ? 'unpin' : 'pin'}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.chip, styles.archiveChip]} onPress={handleArchive}>
          <Text style={[styles.chipText, { color: COLORS.red }]}>archive</Text>
        </TouchableOpacity>
      </View>

      <PingSheet visible={pingVisible} onClose={() => setPingVisible(false)} onSchedule={handleSchedule} />
    </Animated.View>
  );
}

// ─── Note Wall ────────────────────────────────────────────────────────────────

function NoteWall({ category, notes, onUpdate, onArchive, onBack, onQuickCapture, onOpenGraph }: {
  category: Category; notes: Note[];
  onUpdate: (id: string, updates: any) => void;
  onArchive: (id: string) => void;
  onBack: () => void;
  onQuickCapture: () => void;
  onOpenGraph: (note: Note) => void;
}) {
  const sorted = useMemo(() => {
    return [...notes].sort((a, b) => {
      if (a.pinned && !b.pinned) return -1;
      if (!a.pinned && b.pinned) return 1;
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });
  }, [notes]);

  return (
    <View style={styles.container}>
      <View style={styles.wallHeader}>
        <TouchableOpacity onPress={onBack}><Text style={styles.backBtn}>← back</Text></TouchableOpacity>
        <Text style={[styles.wallTitle, { color: category.color }]}>/{category.name.toLowerCase()}</Text>
        <TouchableOpacity style={styles.wallAddBtn} onPress={onQuickCapture}>
          <Text style={[styles.wallAddText, { color: category.color }]}>+</Text>
        </TouchableOpacity>
        <Text style={styles.wallCount}>[{notes.length}]</Text>
      </View>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.wallGrid} showsVerticalScrollIndicator={false}>
        {sorted.map((note, i) => (
          <NoteCard key={note.id} note={note} category={category} onUpdate={onUpdate} onArchive={onArchive} onOpenGraph={onOpenGraph} index={i} />
        ))}
        {notes.length === 0 && <Text style={styles.empty}>// no notes</Text>}
      </ScrollView>
    </View>
  );
}

// ─── Board Screen ─────────────────────────────────────────────────────────────

interface BoardScreenProps {
  categories: Category[];
  notes: Note[];
  onUpdateNote: (id: string, updates: any) => void;
  onArchiveNote: (id: string) => void;
  onCreateNote: (text: string, categoryId?: string) => Promise<any>;
  onCreateCategory: (name: string) => void;
  onRenameCategory: (id: string, name: string) => void;
  onDeleteCategory: (id: string) => void;
  getNotesByCategory: (catId: string) => Note[];
  onNavigateToCapture: (categoryId: string) => void;
}

export function BoardScreen({
  categories, notes, onUpdateNote, onArchiveNote, onCreateNote,
  onCreateCategory, onRenameCategory, onDeleteCategory, getNotesByCategory,
  onNavigateToCapture,
}: BoardScreenProps) {
  const [selectedCat, setSelectedCat] = useState<Category | null>(null);
  const [graphNote, setGraphNote] = useState<Note | null>(null);
  const [settingsVisible, setSettingsVisible] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const handleOpenGraph = useCallback((note: Note) => {
    setGraphNote(note);
  }, []);

  // Stats
  const totalNotes = notes.length;
  const thisWeek = notes.filter(n => isAfter(new Date(n.created_at), subDays(new Date(), 7))).length;
  const topCat = useMemo(() => {
    if (!categories.length) return null;
    return categories.reduce((best, cat) => {
      const count = getNotesByCategory(cat.id).length;
      const bestCount = getNotesByCategory(best.id).length;
      return count > bestCount ? cat : best;
    }, categories[0]);
  }, [categories, getNotesByCategory]);

  // Search results
  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return [];
    const q = searchQuery.toLowerCase();
    return notes.filter(n => n.text.toLowerCase().includes(q));
  }, [notes, searchQuery]);

  const getCategoryForNote = (note: Note) =>
    categories.find(c => c.id === note.category_id) ?? null;

  if (graphNote && selectedCat) {
    const catNotes = getNotesByCategory(selectedCat.id);
    return (
      <GraphView
        rootNote={graphNote}
        category={selectedCat}
        categoryNotes={catNotes}
        onBack={() => setGraphNote(null)}
        onCreateNote={(text, catId) => onCreateNote(text, catId)}
      />
    );
  }

  if (selectedCat) {
    const catNotes = getNotesByCategory(selectedCat.id);
    return (
      <NoteWall
        category={selectedCat}
        notes={catNotes}
        onUpdate={onUpdateNote}
        onArchive={onArchiveNote}
        onBack={() => setSelectedCat(null)}
        onQuickCapture={() => onNavigateToCapture(selectedCat.id)}
        onOpenGraph={handleOpenGraph}
      />
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.boardHeader}>
        <Text style={styles.boardTitle}>dirs</Text>
        <TouchableOpacity onPress={() => setSettingsVisible(true)}>
          <Text style={styles.configBtn}>config</Text>
        </TouchableOpacity>
      </View>

      {/* Stats row */}
      {totalNotes > 0 && (
        <Text style={styles.statsRow}>
          {`// ${totalNotes} notes  ·  ${thisWeek} this week`}
        </Text>
      )}

      {/* Search bar */}
      <View style={styles.searchRow}>
        <TextInput
          style={styles.searchInput}
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholder="search notes..."
          placeholderTextColor={COLORS.textDim}
          cursorColor={COLORS.accent}
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity onPress={() => setSearchQuery('')} style={styles.searchClear}>
            <Text style={styles.searchClearText}>[x]</Text>
          </TouchableOpacity>
        )}
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.grid} showsVerticalScrollIndicator={false}>
        {searchQuery.trim() ? (
          // Search results
          searchResults.length > 0 ? searchResults.map((note, i) => {
            const cat = getCategoryForNote(note);
            return (
              <Animated.View key={note.id} entering={FadeInDown.delay(i * 30).duration(150)}>
                <TouchableOpacity
                  style={[styles.searchResult, { borderLeftColor: cat?.color ?? COLORS.amber }]}
                  onPress={() => { if (cat) { setSelectedCat(cat); setSearchQuery(''); } }}
                >
                  <Text style={styles.searchResultText} numberOfLines={2}>{note.text}</Text>
                  <Text style={[styles.searchResultCat, { color: cat?.color ?? COLORS.amber }]}>
                    {cat ? `/${cat.name.toLowerCase()}` : 'unsorted'}
                  </Text>
                </TouchableOpacity>
              </Animated.View>
            );
          }) : (
            <Text style={styles.empty}>// no results</Text>
          )
        ) : (
          // Category tiles
          categories.map((cat, i) => {
            const count = getNotesByCategory(cat.id).length;
            return (
              <Animated.View key={cat.id} entering={FadeInDown.delay(i * 50).duration(200)}>
                <View style={[styles.catTile, { borderLeftColor: cat.color }]}>
                  <TouchableOpacity style={styles.catTileMain} onPress={() => setSelectedCat(cat)} activeOpacity={0.75}>
                    <Text style={[styles.catTileName, { color: cat.color }]}>/{cat.name.toLowerCase()}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.catTileAdd}
                    onPress={() => onNavigateToCapture(cat.id)}
                  >
                    <Text style={[styles.catTileAddText, { color: cat.color }]}>+</Text>
                  </TouchableOpacity>
                  <Text style={styles.catTileCount}>[{count}]</Text>
                </View>
              </Animated.View>
            );
          })
        )}
      </ScrollView>

      <SettingsModal
        visible={settingsVisible}
        onClose={() => setSettingsVisible(false)}
        categories={categories}
        onCreate={onCreateCategory}
        onRename={onRenameCategory}
        onDelete={onDeleteCategory}
      />
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  boardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingTop: 16, paddingBottom: 4 },
  boardTitle: { fontFamily: 'JetBrainsMono_400Regular', fontSize: 13, color: COLORS.textMuted, letterSpacing: 0.5 },
  configBtn: { fontFamily: 'JetBrainsMono_400Regular', fontSize: 12, color: COLORS.textMuted },
  statsRow: { fontFamily: 'JetBrainsMono_400Regular', fontSize: 11, color: COLORS.textMuted, paddingHorizontal: 16, paddingBottom: 8, opacity: 0.7 },
  searchRow: { flexDirection: 'row', alignItems: 'center', marginHorizontal: 12, marginBottom: 8, backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border, borderRadius: 3 },
  searchInput: { flex: 1, fontFamily: 'JetBrainsMono_400Regular', fontSize: 13, color: COLORS.text, paddingHorizontal: 10, paddingVertical: 8 },
  searchClear: { paddingHorizontal: 10 },
  searchClearText: { fontFamily: 'JetBrainsMono_400Regular', fontSize: 12, color: COLORS.textDim },
  scroll: { flex: 1 },
  grid: { padding: 12, gap: 10 },
  catTile: { backgroundColor: COLORS.surface, borderLeftWidth: 3, borderRadius: 3, flexDirection: 'row', alignItems: 'center' },
  catTileMain: { flex: 1, padding: 14 },
  catTileName: { fontFamily: 'JetBrainsMono_400Regular', fontSize: 15, letterSpacing: 0.5 },
  catTileAdd: { paddingVertical: 14, paddingHorizontal: 10 },
  catTileAddText: { fontFamily: 'JetBrainsMono_400Regular', fontSize: 18, lineHeight: 22 },
  catTileCount: { fontFamily: 'JetBrainsMono_400Regular', fontSize: 12, color: COLORS.textMuted, paddingRight: 14 },
  searchResult: { backgroundColor: COLORS.surface, borderLeftWidth: 3, borderRadius: 3, padding: 12, marginBottom: 2 },
  searchResultText: { fontFamily: 'JetBrainsMono_400Regular', fontSize: 13, color: COLORS.text, lineHeight: 20, marginBottom: 4 },
  searchResultCat: { fontFamily: 'JetBrainsMono_400Regular', fontSize: 10 },
  // Note wall
  wallHeader: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingTop: 16, paddingBottom: 8, gap: 8 },
  backBtn: { fontFamily: 'JetBrainsMono_400Regular', fontSize: 12, color: COLORS.textMuted },
  wallTitle: { fontFamily: 'JetBrainsMono_400Regular', fontSize: 15, letterSpacing: 0.5, flex: 1 },
  wallAddBtn: { paddingHorizontal: 4 },
  wallAddText: { fontFamily: 'JetBrainsMono_400Regular', fontSize: 18 },
  wallCount: { fontFamily: 'JetBrainsMono_400Regular', fontSize: 12, color: COLORS.textMuted },
  wallGrid: { padding: 12, gap: 10 },
  // Note card
  noteCard: { backgroundColor: COLORS.surface, borderLeftWidth: 3, borderRadius: 3, padding: 12 },
  cardTopRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 2 },
  pingBadge: { fontFamily: 'JetBrainsMono_400Regular', fontSize: 10, color: COLORS.amber, letterSpacing: 1 },
  pinnedGlyph: { fontFamily: 'JetBrainsMono_400Regular', fontSize: 10, color: COLORS.accent },
  pingScheduled: { fontFamily: 'JetBrainsMono_400Regular', fontSize: 10, color: COLORS.accent, marginBottom: 4, letterSpacing: 0.3 },
  noteText: { fontFamily: 'JetBrainsMono_400Regular', fontSize: 13, color: COLORS.text, lineHeight: 20, marginBottom: 6 },
  editInput: { fontFamily: 'JetBrainsMono_400Regular', fontSize: 13, color: COLORS.text, lineHeight: 20, backgroundColor: COLORS.background, padding: 8, borderRadius: 2, borderWidth: 1, borderColor: COLORS.border, marginBottom: 6, minHeight: 80, textAlignVertical: 'top' },
  timestamp: { fontFamily: 'JetBrainsMono_400Regular', fontSize: 10, color: COLORS.textMuted, marginBottom: 8 },
  cardActions: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  chip: { paddingHorizontal: 8, paddingVertical: 3, backgroundColor: COLORS.background, borderWidth: 1, borderColor: COLORS.border, borderRadius: 2 },
  pinnedChip: { borderColor: COLORS.accent },
  pingActiveChip: { borderColor: COLORS.accent, backgroundColor: COLORS.accent + '12' },
  archiveChip: { borderColor: COLORS.red },
  chipText: { fontFamily: 'JetBrainsMono_400Regular', fontSize: 11, color: COLORS.textMuted },
  empty: { fontFamily: 'JetBrainsMono_400Regular', fontSize: 13, color: COLORS.textDim, textAlign: 'center', marginTop: 40 },
});
