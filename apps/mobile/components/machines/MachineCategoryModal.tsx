import React, { useState, useEffect, useCallback } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  TextInput,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useTheme } from '../ui/ThemeProvider';
import { Button } from '../ui/Button';
import { spacingNumeric, radiusNumeric } from '@reachinternational/design-tokens';
import { supabase } from '../../lib/supabase';
import {
  X,
  Plus,
  Trash2,
  Tag,
  FolderTree,
  AlertCircle,
  CheckCircle,
} from 'lucide-react-native';

export interface MachineCategory {
  id: string;
  name: string;
  description?: string | null;
  created_at?: string;
}

export interface MachineCategoryModalProps {
  visible: boolean;
  onClose: () => void;
  onCategoriesChanged?: () => void;
}

export const MachineCategoryModal: React.FC<MachineCategoryModalProps> = ({
  visible,
  onClose,
  onCategoriesChanged,
}) => {
  const { theme } = useTheme();
  const [categories, setCategories] = useState<MachineCategory[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isAdding, setIsAdding] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Form State
  const [newName, setNewName] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);

  const fetchCategories = useCallback(async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('machine_categories')
        .select('*')
        .order('name', { ascending: true });

      if (error) throw error;
      setCategories(data || []);
    } catch (err: any) {
      console.warn('[MachineCategoryModal] Failed to load categories:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (visible) {
      fetchCategories();
      setShowAddForm(false);
      setNewName('');
      setNewDesc('');
    }
  }, [visible, fetchCategories]);

  const handleAddCategory = async () => {
    if (!newName.trim()) {
      Alert.alert('Required Field', 'Please enter a category name.');
      return;
    }

    setIsAdding(true);
    try {
      const { error } = await supabase.from('machine_categories').insert({
        name: newName.trim(),
        description: newDesc.trim() || null,
      });

      if (error) {
        if (error.code === '23505') {
          Alert.alert('Duplicate Category', `Category "${newName.trim()}" already exists.`);
          return;
        }
        throw error;
      }

      setNewName('');
      setNewDesc('');
      setShowAddForm(false);
      await fetchCategories();
      onCategoriesChanged?.();
      Alert.alert('Success', `Category "${newName.trim()}" added successfully.`);
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'Failed to add category.');
    } finally {
      setIsAdding(false);
    }
  };

  const handleDeleteCategory = (cat: MachineCategory) => {
    Alert.alert(
      'Delete Category',
      `Are you sure you want to delete "${cat.name}"? Machines assigned to this category may lose their classification.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            setDeletingId(cat.id);
            try {
              const { error } = await supabase
                .from('machine_categories')
                .delete()
                .eq('id', cat.id);

              if (error) throw error;

              await fetchCategories();
              onCategoriesChanged?.();
            } catch (err: any) {
              Alert.alert('Error', err?.message || 'Failed to delete category.');
            } finally {
              setDeletingId(null);
            }
          },
        },
      ]
    );
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.overlay}
      >
        <View style={[styles.sheet, { backgroundColor: theme.colors.canvas }]}>
          {/* Header */}
          <View style={[styles.header, { borderBottomColor: theme.colors.hairline }]}>
            <View style={styles.headerLeft}>
              <FolderTree size={20} color={theme.colors.link} />
              <View>
                <Text style={[styles.title, { color: theme.colors.ink }]}>Machine Categories</Text>
                <Text style={[styles.subtitle, { color: theme.colors.mute }]}>
                  {categories.length} {categories.length === 1 ? 'category' : 'categories'} configured
                </Text>
              </View>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <X size={20} color={theme.colors.mute} />
            </TouchableOpacity>
          </View>

          {/* Add Category Trigger / Form */}
          <View style={[styles.actionSection, { borderBottomColor: theme.colors.hairline }]}>
            {!showAddForm ? (
              <Button
                label="+ Add New Category"
                onPress={() => setShowAddForm(true)}
                variant="primary"
                size="sm"
                fullWidth
              />
            ) : (
              <View style={[styles.formCard, { backgroundColor: theme.colors.canvasElevated, borderColor: theme.colors.hairline }]}>
                <Text style={[styles.formTitle, { color: theme.colors.ink }]}>New Category Details</Text>
                
                <TextInput
                  style={[
                    styles.textInput,
                    {
                      color: theme.colors.ink,
                      borderColor: theme.colors.hairline,
                      backgroundColor: theme.colors.canvas,
                    },
                  ]}
                  placeholder="Category Name (e.g. Scissor Lift, Boom Lift) *"
                  placeholderTextColor={theme.colors.mute}
                  value={newName}
                  onChangeText={setNewName}
                  autoFocus
                />

                <TextInput
                  style={[
                    styles.textInput,
                    styles.textArea,
                    {
                      color: theme.colors.ink,
                      borderColor: theme.colors.hairline,
                      backgroundColor: theme.colors.canvas,
                    },
                  ]}
                  placeholder="Description or notes (optional)..."
                  placeholderTextColor={theme.colors.mute}
                  value={newDesc}
                  onChangeText={setNewDesc}
                  multiline
                  numberOfLines={2}
                />

                <View style={styles.formActions}>
                  <Button
                    label="Cancel"
                    onPress={() => {
                      setShowAddForm(false);
                      setNewName('');
                      setNewDesc('');
                    }}
                    variant="outline"
                    size="sm"
                    style={{ flex: 1, marginRight: 8 }}
                  />
                  <Button
                    label={isAdding ? 'Adding...' : 'Save Category'}
                    onPress={handleAddCategory}
                    variant="primary"
                    size="sm"
                    disabled={isAdding}
                    style={{ flex: 1 }}
                  />
                </View>
              </View>
            )}
          </View>

          {/* Categories List */}
          {isLoading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="small" color={theme.colors.link} />
              <Text style={[styles.loadingText, { color: theme.colors.mute }]}>Loading categories...</Text>
            </View>
          ) : categories.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Tag size={32} color={theme.colors.mute} style={{ opacity: 0.5, marginBottom: 8 }} />
              <Text style={[styles.emptyTitle, { color: theme.colors.ink }]}>No Categories Found</Text>
              <Text style={[styles.emptySubtitle, { color: theme.colors.mute }]}>
                Add machine classifications to organize your fleet.
              </Text>
            </View>
          ) : (
            <ScrollView style={styles.list} showsVerticalScrollIndicator={false}>
              {categories.map((cat) => (
                <View
                  key={cat.id}
                  style={[
                    styles.categoryItem,
                    {
                      borderBottomColor: theme.colors.hairline,
                    },
                  ]}
                >
                  <View style={styles.catLeft}>
                    <View style={[styles.catIconCircle, { backgroundColor: 'rgba(0, 112, 243, 0.08)' }]}>
                      <Tag size={16} color={theme.colors.link} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.catName, { color: theme.colors.ink }]}>{cat.name}</Text>
                      {cat.description ? (
                        <Text style={[styles.catDesc, { color: theme.colors.mute }]} numberOfLines={2}>
                          {cat.description}
                        </Text>
                      ) : null}
                    </View>
                  </View>

                  <TouchableOpacity
                    style={styles.deleteBtn}
                    onPress={() => handleDeleteCategory(cat)}
                    disabled={deletingId === cat.id}
                  >
                    {deletingId === cat.id ? (
                      <ActivityIndicator size="small" color="#dc2626" />
                    ) : (
                      <Trash2 size={16} color="#dc2626" />
                    )}
                  </TouchableOpacity>
                </View>
              ))}
              <View style={{ height: 32 }} />
            </ScrollView>
          )}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  sheet: {
    borderTopLeftRadius: radiusNumeric.lg,
    borderTopRightRadius: radiusNumeric.lg,
    maxHeight: '85%',
    paddingBottom: 24,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacingNumeric.md,
    borderBottomWidth: 1,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  title: {
    fontSize: 16,
    fontWeight: '800',
  },
  subtitle: {
    fontSize: 11,
    marginTop: 1,
  },
  closeBtn: {
    padding: 6,
    borderRadius: 20,
  },
  actionSection: {
    padding: spacingNumeric.md,
    borderBottomWidth: 1,
  },
  formCard: {
    padding: spacingNumeric.md,
    borderRadius: radiusNumeric.md,
    borderWidth: 1,
  },
  formTitle: {
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 8,
  },
  textInput: {
    height: 42,
    borderWidth: 1,
    borderRadius: radiusNumeric.md,
    paddingHorizontal: 12,
    fontSize: 14,
    marginBottom: 8,
  },
  textArea: {
    height: 60,
    paddingTop: 8,
    textAlignVertical: 'top',
  },
  formActions: {
    flexDirection: 'row',
    marginTop: 4,
  },
  loadingContainer: {
    padding: 32,
    alignItems: 'center',
    gap: 8,
  },
  loadingText: {
    fontSize: 12,
  },
  emptyContainer: {
    padding: 32,
    alignItems: 'center',
  },
  emptyTitle: {
    fontSize: 14,
    fontWeight: '700',
  },
  emptySubtitle: {
    fontSize: 12,
    marginTop: 4,
    textAlign: 'center',
  },
  list: {
    paddingHorizontal: spacingNumeric.md,
  },
  categoryItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  catLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
    marginRight: 10,
  },
  catIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  catName: {
    fontSize: 14,
    fontWeight: '700',
  },
  catDesc: {
    fontSize: 12,
    marginTop: 2,
    lineHeight: 16,
  },
  deleteBtn: {
    padding: 8,
    borderRadius: radiusNumeric.sm,
    backgroundColor: 'rgba(220, 38, 38, 0.08)',
  },
});
