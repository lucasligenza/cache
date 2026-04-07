import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Dimensions,
  TextInput, ScrollView, Modal,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { Note, Category } from '../types';
import { COLORS } from '../constants';
import { useNoteConnections } from '../hooks/useNoteConnections';

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');

function LineEdge({ x1, y1, x2, y2, color, dashed }: {
  x1: number; y1: number; x2: number; y2: number; color: string; dashed?: boolean;
}) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const length = Math.sqrt(dx * dx + dy * dy);
  const angle = Math.atan2(dy, dx) * 180 / Math.PI;
  return (
    <View
      style={{
        position: 'absolute',
        left: (x1 + x2) / 2 - length / 2,
        top: (y1 + y2) / 2 - 0.5,
        width: length,
        height: 1,
        backgroundColor: dashed ? 'transparent' : color,
        opacity: dashed ? 0.4 : 0.35,
        borderWidth: dashed ? 0.5 : 0,
        borderColor: dashed ? color : 'transparent',
        borderStyle: dashed ? 'dashed' : 'solid',
        transform: [{ rotate: `${angle}deg` }],
      }}
    />
  );
}

const CENTER_X = SCREEN_W / 2;
const CENTER_Y = (SCREEN_H - 180) / 2; // account for header + bottom space
const ORBIT_RADIUS = 140;
const NODE_W = 118;
const NODE_H = 68;

function nodePosition(index: number, total: number) {
  // +1 because [+] node always occupies one slot
  const count = total + 1;
  const angle = (2 * Math.PI / count) * index - Math.PI / 2;
  return {
    x: CENTER_X + ORBIT_RADIUS * Math.cos(angle),
    y: CENTER_Y + ORBIT_RADIUS * Math.sin(angle),
  };
}

interface Props {
  rootNote: Note;
  category: Category;
  categoryNotes: Note[]; // all notes in the category (for link sheet)
  onBack: () => void;
  onCreateNote: (text: string, categoryId: string) => Promise<Note | void>;
}

export function GraphView({
  rootNote, category, categoryNotes, onBack, onCreateNote,
}: Props) {
  const { connections, loading, fetchConnections, addConnection, removeConnection } = useNoteConnections();
  const [root, setRoot] = useState<Note>(rootNote);
  const [creating, setCreating] = useState(false);
  const [newText, setNewText] = useState('');
  const [linkSheetVisible, setLinkSheetVisible] = useState(false);

  useEffect(() => {
    fetchConnections(root.id);
  }, [root.id, fetchConnections]);

  const handleNavigate = (note: Note) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setRoot(note);
  };

  const handleCreateConnected = async () => {
    if (!newText.trim()) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const created = await onCreateNote(newText.trim(), category.id);
    if (created) {
      await addConnection(root.id, created.id);
      await fetchConnections(root.id);
    }
    setNewText('');
    setCreating(false);
  };

  const handleLink = async (note: Note) => {
    await addConnection(root.id, note.id);
    await fetchConnections(root.id);
    setLinkSheetVisible(false);
  };

  // Notes not yet connected to root (and not root itself)
  const linkableNotes = categoryNotes.filter(n =>
    n.id !== root.id && !connections.find(c => c.id === n.id)
  );

  // Satellite nodes: connected notes + [+] slot
  const addSlotIndex = connections.length; // [+] goes last

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack}>
          <Text style={styles.backBtn}>← back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>◈ graph</Text>
        <Text style={[styles.headerCat, { color: category.color }]}>
          /{category.name.toLowerCase()}
        </Text>
        <TouchableOpacity onPress={() => setLinkSheetVisible(true)}>
          <Text style={styles.linkBtn}>[link]</Text>
        </TouchableOpacity>
      </View>

      {/* Graph canvas */}
      <View style={styles.canvas}>
        {/* Edges */}
        {connections.map((_, i) => {
          const pos = nodePosition(i, connections.length);
          return (
            <LineEdge key={i} x1={CENTER_X} y1={CENTER_Y} x2={pos.x} y2={pos.y} color={category.color} />
          );
        })}
        {(() => {
          const pos = nodePosition(addSlotIndex, connections.length);
          return <LineEdge x1={CENTER_X} y1={CENTER_Y} x2={pos.x} y2={pos.y} color={COLORS.border} dashed />;
        })()}

        {/* Center node */}
        <View style={[
          styles.node,
          styles.centerNode,
          { borderLeftColor: category.color },
          {
            left: CENTER_X - NODE_W / 2,
            top: CENTER_Y - NODE_H / 2,
          },
        ]}>
          <Text style={styles.nodeText} numberOfLines={2}>{root.text}</Text>
          <Text style={styles.nodeHint}>root</Text>
        </View>

        {/* Connected satellite nodes */}
        {connections.map((note, i) => {
          const pos = nodePosition(i, connections.length);
          return (
            <TouchableOpacity
              key={note.id}
              style={[
                styles.node,
                { borderLeftColor: category.color },
                {
                  left: pos.x - NODE_W / 2,
                  top: pos.y - NODE_H / 2,
                },
              ]}
              onPress={() => handleNavigate(note)}
              activeOpacity={0.75}
            >
              <Text style={styles.nodeText} numberOfLines={2}>{note.text}</Text>
            </TouchableOpacity>
          );
        })}

        {/* [+] create node */}
        {(() => {
          const pos = nodePosition(addSlotIndex, connections.length);
          return creating ? (
            <View style={[
              styles.node,
              styles.createNode,
              {
                left: pos.x - NODE_W / 2,
                top: pos.y - NODE_H / 2,
                width: NODE_W + 20,
              },
            ]}>
              <TextInput
                style={styles.createInput}
                value={newText}
                onChangeText={setNewText}
                autoFocus
                multiline={false}
                placeholder="new note..."
                placeholderTextColor={COLORS.textDim}
                cursorColor={COLORS.accent}
                onSubmitEditing={handleCreateConnected}
                returnKeyType="done"
              />
              <TouchableOpacity onPress={handleCreateConnected}>
                <Text style={styles.createCommit}>[+]</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity
              style={[
                styles.node,
                styles.addNode,
                {
                  left: pos.x - NODE_W / 2,
                  top: pos.y - NODE_H / 2,
                },
              ]}
              onPress={() => setCreating(true)}
              activeOpacity={0.7}
            >
              <Text style={styles.addNodeText}>+</Text>
            </TouchableOpacity>
          );
        })()}
      </View>

      {/* Link existing note sheet */}
      <Modal visible={linkSheetVisible} transparent animationType="slide">
        <TouchableOpacity
          style={styles.sheetOverlay}
          onPress={() => setLinkSheetVisible(false)}
          activeOpacity={1}
        >
          <View style={styles.sheet}>
            <Text style={styles.sheetTitle}>link existing note</Text>
            <ScrollView>
              {linkableNotes.length === 0 ? (
                <Text style={styles.sheetEmpty}>// no unlinked notes in this category</Text>
              ) : (
                linkableNotes.map(note => (
                  <TouchableOpacity
                    key={note.id}
                    style={[styles.sheetRow, { borderLeftColor: category.color }]}
                    onPress={() => handleLink(note)}
                  >
                    <Text style={styles.sheetRowText} numberOfLines={2}>{note.text}</Text>
                  </TouchableOpacity>
                ))
              )}
            </ScrollView>
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 12,
    gap: 10,
  },
  backBtn: {
    fontFamily: 'JetBrainsMono_400Regular',
    fontSize: 13,
    color: COLORS.textMuted,
  },
  headerTitle: {
    fontFamily: 'JetBrainsMono_400Regular',
    fontSize: 13,
    color: COLORS.textDim,
    flex: 1,
    marginLeft: 4,
  },
  headerCat: {
    fontFamily: 'JetBrainsMono_400Regular',
    fontSize: 13,
  },
  linkBtn: {
    fontFamily: 'JetBrainsMono_400Regular',
    fontSize: 12,
    color: COLORS.textMuted,
  },
  canvas: {
    flex: 1,
    position: 'relative',
  },
  node: {
    position: 'absolute',
    width: NODE_W,
    height: NODE_H,
    backgroundColor: COLORS.surface,
    borderLeftWidth: 3,
    borderRadius: 3,
    padding: 8,
    justifyContent: 'center',
  },
  centerNode: {
    borderWidth: 1,
    borderLeftWidth: 3,
    borderColor: COLORS.border,
  },
  nodeText: {
    fontFamily: 'JetBrainsMono_400Regular',
    fontSize: 11,
    color: COLORS.text,
    lineHeight: 16,
  },
  nodeHint: {
    fontFamily: 'JetBrainsMono_400Regular',
    fontSize: 9,
    color: COLORS.textDim,
    marginTop: 3,
  },
  addNode: {
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: COLORS.border,
    borderLeftWidth: 1,
    borderLeftColor: COLORS.border,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.background,
  },
  addNodeText: {
    fontFamily: 'JetBrainsMono_400Regular',
    fontSize: 22,
    color: COLORS.textDim,
  },
  createNode: {
    height: 'auto',
    minHeight: NODE_H,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderColor: COLORS.border,
    borderWidth: 1,
    paddingHorizontal: 10,
  },
  createInput: {
    flex: 1,
    fontFamily: 'JetBrainsMono_400Regular',
    fontSize: 11,
    color: COLORS.text,
  },
  createCommit: {
    fontFamily: 'JetBrainsMono_400Regular',
    fontSize: 13,
    color: COLORS.accent,
  },
  sheetOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  sheet: {
    backgroundColor: COLORS.surface,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    padding: 20,
    paddingBottom: 36,
    maxHeight: SCREEN_H * 0.55,
  },
  sheetTitle: {
    fontFamily: 'JetBrainsMono_400Regular',
    fontSize: 12,
    color: COLORS.textMuted,
    marginBottom: 12,
    letterSpacing: 0.5,
  },
  sheetEmpty: {
    fontFamily: 'JetBrainsMono_400Regular',
    fontSize: 12,
    color: COLORS.textDim,
    paddingVertical: 16,
  },
  sheetRow: {
    borderLeftWidth: 3,
    backgroundColor: COLORS.background,
    borderRadius: 2,
    padding: 10,
    marginBottom: 8,
  },
  sheetRowText: {
    fontFamily: 'JetBrainsMono_400Regular',
    fontSize: 13,
    color: COLORS.text,
    lineHeight: 18,
  },
});
