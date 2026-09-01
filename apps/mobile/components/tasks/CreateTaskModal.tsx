import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Alert,
} from 'react-native';
import { useTheme, Button } from '../ui';
import { spacingNumeric, radiusNumeric } from '@reachinternational/design-tokens';
import type { Task, User } from '@reachinternational/types';
import { summarizeTaskTitle } from '@reachinternational/utils';

interface CreateTaskModalProps {
  visible: boolean;
  onClose: () => void;
  users: Pick<User, 'id' | 'full_name' | 'email' | 'role'>[];
  initialTask?: Task | null;
  onSave: (taskData: any) => void;
  onDelete?: (taskId: string) => void;
}

export function CreateTaskModal({
  visible,
  onClose,
  users,
  initialTask,
  onSave,
  onDelete,
}: CreateTaskModalProps) {
  const { theme } = useTheme();
  const isEditing = !!initialTask;

  const [title, setTitle] = useState(initialTask?.title || '');
  const [description, setDescription] = useState(initialTask?.description || '');
  const [dueDate, setDueDate] = useState(initialTask?.due_date || new Date().toISOString().split('T')[0]);
  const [dueTime, setDueTime] = useState(initialTask?.due_time || '10:00');
  const [priority, setPriority] = useState<string>(initialTask?.priority || 'medium');
  const [reminderOffset, setReminderOffset] = useState<string>(initialTask?.reminder_offset || '10m');
  const [selectedUserId, setSelectedUserId] = useState<string>(
    initialTask?.assignees?.[0]?.user_id || users[0]?.id || ''
  );
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async () => {
    if (!description.trim()) {
      Alert.alert('Required', 'Please enter task description / instructions');
      return;
    }

    let finalTitle = title.trim();
    if (!finalTitle) {
      finalTitle = summarizeTaskTitle(description);
      setTitle(finalTitle);
    }

    if (!finalTitle) {
      Alert.alert('Required', 'Please enter task title');
      return;
    }
    if (!dueDate) {
      Alert.alert('Required', 'Please select due date');
      return;
    }

    setIsSaving(true);
    try {
      await Promise.resolve(onSave({
        id: initialTask?.id,
        title: finalTitle,
        description,
        due_date: dueDate,
        due_time: dueTime,
        priority,
        reminder_offset: reminderOffset,
        assignee_ids: [selectedUserId],
      }));
      onClose();
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'Failed to save task.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent={false}>
      <View style={[styles.container, { backgroundColor: theme.colors.canvas }]}>
        {/* Screen Header */}
        <View style={[styles.header, { borderBottomColor: theme.colors.hairline }]}>
          <TouchableOpacity onPress={onClose} disabled={isSaving} style={styles.backBtn}>
            <Text style={[styles.backIcon, { color: theme.colors.ink }]}>←</Text>
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: theme.colors.ink }]}>
            {isEditing ? 'Edit To-Do' : 'Create To-Do'}
          </Text>
          <TouchableOpacity
            onPress={handleSave}
            disabled={isSaving}
            style={[styles.saveCta, { backgroundColor: theme.colors.primary, opacity: isSaving ? 0.6 : 1 }]}
          >
            <Text style={[styles.saveCtaText, { color: theme.colors.onPrimary }]}>
              {isSaving ? 'SAVING...' : 'SAVE'}
            </Text>
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={styles.formContent}>
          {/* Task Title */}
          <View style={styles.fieldGroup}>
            <Text style={[styles.fieldLabel, { color: theme.colors.mute }]}>Task Title *</Text>
            <View style={[styles.inputBox, { backgroundColor: theme.colors.canvasElevated, borderColor: theme.colors.hairline }]}>
              <Text style={styles.inputIcon}>≡</Text>
              <TextInput
                value={title}
                onChangeText={setTitle}
                placeholder="Enter task title"
                placeholderTextColor={theme.colors.faint}
                style={[styles.textInput, { color: theme.colors.ink }]}
              />
            </View>
          </View>

          {/* Description */}
          <View style={styles.fieldGroup}>
            <Text style={[styles.fieldLabel, { color: theme.colors.mute }]}>Description *</Text>
            <View style={[styles.inputBox, styles.textAreaBox, { backgroundColor: theme.colors.canvasElevated, borderColor: theme.colors.hairline }]}>
              <Text style={styles.inputIcon}>📄</Text>
              <TextInput
                value={description}
                onChangeText={setDescription}
                placeholder="Enter task description / instructions (Required)"
                placeholderTextColor={theme.colors.faint}
                multiline
                numberOfLines={3}
                style={[styles.textInput, styles.textAreaInput, { color: theme.colors.ink }]}
              />
            </View>
          </View>

          {/* Due Date and Due Time Row */}
          <View style={styles.rowGrid}>
            <View style={[styles.fieldGroup, { flex: 1 }]}>
              <Text style={[styles.fieldLabel, { color: theme.colors.mute }]}>Due Date *</Text>
              <View style={[styles.inputBox, { backgroundColor: theme.colors.canvasElevated, borderColor: theme.colors.hairline }]}>
                <Text style={styles.inputIcon}>📅</Text>
                <TextInput
                  value={dueDate}
                  onChangeText={setDueDate}
                  placeholder="YYYY-MM-DD"
                  placeholderTextColor={theme.colors.faint}
                  style={[styles.textInput, { color: theme.colors.ink }]}
                />
              </View>
            </View>

            <View style={[styles.fieldGroup, { flex: 1 }]}>
              <Text style={[styles.fieldLabel, { color: theme.colors.mute }]}>Due Time</Text>
              <View style={[styles.inputBox, { backgroundColor: theme.colors.canvasElevated, borderColor: theme.colors.hairline }]}>
                <Text style={styles.inputIcon}>🕒</Text>
                <TextInput
                  value={dueTime}
                  onChangeText={setDueTime}
                  placeholder="10:00"
                  placeholderTextColor={theme.colors.faint}
                  style={[styles.textInput, { color: theme.colors.ink }]}
                />
              </View>
            </View>
          </View>

          {/* Assign To Employee Selector */}
          <View style={styles.fieldGroup}>
            <Text style={[styles.fieldLabel, { color: theme.colors.mute }]}>Assign To *</Text>
            <View style={[styles.userSelectorBox, { backgroundColor: theme.colors.canvasElevated, borderColor: theme.colors.hairline }]}>
              <ScrollView style={{ maxHeight: 180 }} nestedScrollEnabled>
                {users.map((u) => {
                  const isSelected = selectedUserId === u.id;
                  return (
                    <TouchableOpacity
                      key={u.id}
                      onPress={() => setSelectedUserId(u.id)}
                      activeOpacity={0.7}
                      style={[
                        styles.userItem,
                        { borderBottomColor: theme.colors.hairline },
                        isSelected && { backgroundColor: theme.colors.primary + '15' },
                      ]}
                    >
                      <View style={[styles.userAvatar, { backgroundColor: theme.colors.primary + '30' }]}>
                        <Text style={[styles.avatarText, { color: theme.colors.primary }]}>
                          {u.full_name.charAt(0).toUpperCase()}
                        </Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.userName, { color: theme.colors.ink }]}>{u.full_name}</Text>
                        <Text style={[styles.userRole, { color: theme.colors.mute }]}>
                          {u.role.replace(/_/g, ' ')}
                        </Text>
                      </View>
                      {isSelected && <Text style={[styles.checkMark, { color: theme.colors.primary }]}>✓</Text>}
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>
          </View>

          {/* Priority Selector */}
          <View style={styles.fieldGroup}>
            <Text style={[styles.fieldLabel, { color: theme.colors.mute }]}>Priority</Text>
            <View style={styles.priorityRow}>
              {[
                { key: 'low', label: 'Low', color: '#10b981' },
                { key: 'medium', label: 'Medium', color: '#f59e0b' },
                { key: 'high', label: 'High', color: '#ef4444' },
              ].map((p) => {
                const isSel = priority === p.key;
                return (
                  <TouchableOpacity
                    key={p.key}
                    onPress={() => setPriority(p.key)}
                    style={[
                      styles.priorityPill,
                      {
                        backgroundColor: isSel ? p.color + '25' : theme.colors.canvasElevated,
                        borderColor: isSel ? p.color : theme.colors.hairline,
                      },
                    ]}
                  >
                    <Text style={[styles.priorityPillText, { color: isSel ? p.color : theme.colors.mute }]}>
                      🚩 {p.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {/* Reminder Selector */}
          <View style={styles.fieldGroup}>
            <Text style={[styles.fieldLabel, { color: theme.colors.mute }]}>Reminder</Text>
            <View style={styles.priorityRow}>
              {[
                { key: 'none', label: 'None' },
                { key: '10m', label: '10 mins before' },
                { key: '1h', label: '1 hour before' },
                { key: '1d', label: '1 day before' },
              ].map((r) => {
                const isSel = reminderOffset === r.key;
                return (
                  <TouchableOpacity
                    key={r.key}
                    onPress={() => setReminderOffset(r.key)}
                    style={[
                      styles.reminderPill,
                      {
                        backgroundColor: isSel ? theme.colors.primary + '25' : theme.colors.canvasElevated,
                        borderColor: isSel ? theme.colors.primary : theme.colors.hairline,
                      },
                    ]}
                  >
                    <Text style={[styles.reminderPillText, { color: isSel ? theme.colors.primary : theme.colors.mute }]}>
                      🔔 {r.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {/* Delete Task Button */}
          {isEditing && initialTask && (
            <TouchableOpacity
              onPress={() => onDelete?.(initialTask.id)}
              style={[styles.deleteBtn, { borderColor: theme.colors.error + '40' }]}
            >
              <Text style={[styles.deleteBtnText, { color: theme.colors.error }]}>🗑 DELETE TASK</Text>
            </TouchableOpacity>
          )}
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacingNumeric.md,
    paddingTop: 44,
    paddingBottom: spacingNumeric.sm,
    borderBottomWidth: 1,
  },
  backBtn: {
    padding: spacingNumeric.xs,
  },
  backIcon: {
    fontSize: 22,
    fontWeight: 'bold',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  saveCta: {
    paddingHorizontal: spacingNumeric.md,
    paddingVertical: 6,
    borderRadius: radiusNumeric.sm,
  },
  saveCtaText: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  formContent: {
    padding: spacingNumeric.md,
    gap: spacingNumeric.md,
  },
  fieldGroup: {},
  fieldLabel: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 6,
  },
  inputBox: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: radiusNumeric.md,
    paddingHorizontal: spacingNumeric.sm,
    height: 48,
  },
  textAreaBox: {
    height: 80,
    alignItems: 'flex-start',
    paddingTop: 10,
  },
  inputIcon: {
    fontSize: 16,
    marginRight: 8,
  },
  textInput: {
    flex: 1,
    fontSize: 14,
  },
  textAreaInput: {
    textAlignVertical: 'top',
  },
  rowGrid: {
    flexDirection: 'row',
    gap: spacingNumeric.sm,
  },
  userSelectorBox: {
    borderWidth: 1,
    borderRadius: radiusNumeric.md,
    overflow: 'hidden',
  },
  userItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacingNumeric.xs,
    paddingHorizontal: spacingNumeric.sm,
    borderBottomWidth: 1,
    gap: spacingNumeric.xs,
  },
  userAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 14,
    fontWeight: 'bold',
  },
  userName: {
    fontSize: 13,
    fontWeight: '600',
  },
  userRole: {
    fontSize: 11,
  },
  checkMark: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  priorityRow: {
    flexDirection: 'row',
    gap: spacingNumeric.xs,
    flexWrap: 'wrap',
  },
  priorityPill: {
    paddingHorizontal: spacingNumeric.sm,
    paddingVertical: 8,
    borderRadius: radiusNumeric.sm,
    borderWidth: 1,
  },
  priorityPillText: {
    fontSize: 12,
    fontWeight: '600',
  },
  reminderPill: {
    paddingHorizontal: spacingNumeric.xs,
    paddingVertical: 6,
    borderRadius: radiusNumeric.sm,
    borderWidth: 1,
  },
  reminderPillText: {
    fontSize: 11,
    fontWeight: '600',
  },
  deleteBtn: {
    paddingVertical: spacingNumeric.sm,
    borderWidth: 1,
    borderRadius: radiusNumeric.md,
    alignItems: 'center',
    marginTop: spacingNumeric.md,
  },
  deleteBtnText: {
    fontSize: 13,
    fontWeight: '700',
  },
});
