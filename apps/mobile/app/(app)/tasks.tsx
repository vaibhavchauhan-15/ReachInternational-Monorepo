/**
 * ServiceCentric Mobile — To-Do & Task Management Screen
 * Complete mobile task center matching user design mockup & wireframes.
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  RefreshControl,
} from 'react-native';
import { Card, Badge, useTheme, MobileHeader } from '../../components/ui';
import { CreateTaskModal } from '../../components/tasks/CreateTaskModal';
import { spacingNumeric, radiusNumeric } from '@servicecentric/design-tokens';
import { formatDate } from '@servicecentric/utils';
import type { Task, User } from '@servicecentric/types';

export default function TasksScreen() {
  const { theme } = useTheme();

  const [activeTab, setActiveTab] = useState<'all' | 'my' | 'assigned' | 'completed'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'due_date' | 'priority'>('due_date');
  const [refreshing, setRefreshing] = useState(false);

  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);

  // Mock initial users for mobile task assignment picker
  const mockUsers: Pick<User, 'id' | 'full_name' | 'email' | 'role'>[] = [
    { id: 'usr-1', full_name: 'Rahul Gupta', email: 'rahul@reach.com', role: 'service_manager' },
    { id: 'usr-2', full_name: 'Priya Sharma', email: 'priya@reach.com', role: 'supervisor' },
    { id: 'usr-3', full_name: 'Amit Verma', email: 'amit@reach.com', role: 'service_engineer' },
    { id: 'usr-4', full_name: 'Neha Singh', email: 'neha@reach.com', role: 'operator' },
    { id: 'usr-5', full_name: 'Vikram Patel', email: 'vikram@reach.com', role: 'mechanic' },
    { id: 'usr-6', full_name: 'Anjali Mehta', email: 'anjali@reach.com', role: 'hr_manager' },
  ];

  // Dummy mobile tasks matching screenshot wireframe
  const [tasks, setTasks] = useState<Task[]>([
    {
      id: '1',
      task_no: 'TSK-00001',
      title: 'Prepare Project Plan for Q2',
      description: 'Review machine fleet maintenance schedule and prepare Q2 plan.',
      due_date: '2025-05-20',
      due_time: '14:00',
      priority: 'high',
      status: 'pending',
      created_by: 'usr-1',
      branch_id: null,
      reminder_offset: '10m',
      completion_notes: null,
      completed_by: null,
      completed_at: null,
      verified_by: null,
      verified_at: null,
      reopened_by: null,
      reopened_at: null,
      reopen_reason: null,
      cancelled_by: null,
      cancelled_at: null,
      cancel_reason: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      assignees: [
        { id: 'a1', task_id: '1', user_id: 'usr-1', assigned_at: new Date().toISOString(), assigned_by: 'usr-1', user: mockUsers[0] },
      ],
    },
    {
      id: '2',
      task_no: 'TSK-00002',
      title: 'Design Homepage Mockup',
      description: 'Create mobile UI/UX mocks for customer portal.',
      due_date: '2025-05-21',
      due_time: '17:00',
      priority: 'medium',
      status: 'in_progress',
      created_by: 'usr-1',
      branch_id: null,
      reminder_offset: '30m',
      completion_notes: null,
      completed_by: null,
      completed_at: null,
      verified_by: null,
      verified_at: null,
      reopened_by: null,
      reopened_at: null,
      reopen_reason: null,
      cancelled_by: null,
      cancelled_at: null,
      cancel_reason: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      assignees: [
        { id: 'a2', task_id: '2', user_id: 'usr-2', assigned_at: new Date().toISOString(), assigned_by: 'usr-1', user: mockUsers[1] },
      ],
    },
    {
      id: '3',
      task_no: 'TSK-00003',
      title: 'Fix Issues in Dashboard',
      description: 'Resolve KPI calculation latency on field service reports.',
      due_date: '2025-05-22',
      due_time: '11:00',
      priority: 'medium',
      status: 'pending',
      created_by: 'usr-1',
      branch_id: null,
      reminder_offset: '1h',
      completion_notes: null,
      completed_by: null,
      completed_at: null,
      verified_by: null,
      verified_at: null,
      reopened_by: null,
      reopened_at: null,
      reopen_reason: null,
      cancelled_by: null,
      cancelled_at: null,
      cancel_reason: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      assignees: [
        { id: 'a3', task_id: '3', user_id: 'usr-3', assigned_at: new Date().toISOString(), assigned_by: 'usr-1', user: mockUsers[2] },
      ],
    },
    {
      id: '4',
      task_no: 'TSK-00004',
      title: 'Client Meeting & Requirements',
      description: 'Discuss equipment rental lease terms with Delhi Hub client.',
      due_date: '2025-05-23',
      due_time: '15:30',
      priority: 'low',
      status: 'pending',
      created_by: 'usr-1',
      branch_id: null,
      reminder_offset: '10m',
      completion_notes: null,
      completed_by: null,
      completed_at: null,
      verified_by: null,
      verified_at: null,
      reopened_by: null,
      reopened_at: null,
      reopen_reason: null,
      cancelled_by: null,
      cancelled_at: null,
      cancel_reason: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      assignees: [
        { id: 'a4', task_id: '4', user_id: 'usr-4', assigned_at: new Date().toISOString(), assigned_by: 'usr-1', user: mockUsers[3] },
      ],
    },
    {
      id: '5',
      task_no: 'TSK-00005',
      title: 'API Integration for Payment',
      description: 'Integrate billing gateway endpoint for rental invoices.',
      due_date: '2025-05-24',
      due_time: '18:00',
      priority: 'high',
      status: 'pending',
      created_by: 'usr-1',
      branch_id: null,
      reminder_offset: '1h',
      completion_notes: null,
      completed_by: null,
      completed_at: null,
      verified_by: null,
      verified_at: null,
      reopened_by: null,
      reopened_at: null,
      reopen_reason: null,
      cancelled_by: null,
      cancelled_at: null,
      cancel_reason: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      assignees: [
        { id: 'a5', task_id: '5', user_id: 'usr-5', assigned_at: new Date().toISOString(), assigned_by: 'usr-1', user: mockUsers[4] },
      ],
    },
    {
      id: '6',
      task_no: 'TSK-00006',
      title: 'Write Unit Test Cases',
      description: 'Increase test coverage for breakdown complaint triggers.',
      due_date: '2025-05-25',
      due_time: '12:00',
      priority: 'medium',
      status: 'completed',
      created_by: 'usr-1',
      branch_id: null,
      reminder_offset: 'none',
      completion_notes: 'Unit tests added cleanly',
      completed_by: 'usr-6',
      completed_at: new Date().toISOString(),
      verified_by: null,
      verified_at: null,
      reopened_by: null,
      reopened_at: null,
      reopen_reason: null,
      cancelled_by: null,
      cancelled_at: null,
      cancel_reason: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      assignees: [
        { id: 'a6', task_id: '6', user_id: 'usr-6', assigned_at: new Date().toISOString(), assigned_by: 'usr-1', user: mockUsers[5] },
      ],
    },
  ]);

  const onRefresh = React.useCallback(() => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 800);
  }, []);

  const filteredTasks = tasks.filter((t) => {
    if (activeTab === 'completed' && t.status !== 'completed') return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return t.title.toLowerCase().includes(q) || (t.assignees?.[0]?.user?.full_name?.toLowerCase().includes(q) ?? false);
    }
    return true;
  });

  const handleSaveTask = (taskData: any) => {
    if (taskData.id) {
      setTasks((prev) =>
        prev.map((t) => (t.id === taskData.id ? { ...t, ...taskData } : t))
      );
    } else {
      const newTask: Task = {
        id: String(Date.now()),
        task_no: `TSK-${String(tasks.length + 1).padStart(5, '0')}`,
        title: taskData.title,
        description: taskData.description,
        due_date: taskData.due_date,
        due_time: taskData.due_time,
        priority: taskData.priority,
        status: 'pending',
        created_by: 'usr-1',
        branch_id: null,
        reminder_offset: taskData.reminder_offset,
        completion_notes: null,
        completed_by: null,
        completed_at: null,
        verified_by: null,
        verified_at: null,
        reopened_by: null,
        reopened_at: null,
        reopen_reason: null,
        cancelled_by: null,
        cancelled_at: null,
        cancel_reason: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        assignees: [
          {
            id: String(Date.now()),
            task_id: String(Date.now()),
            user_id: taskData.assignee_ids[0],
            assigned_at: new Date().toISOString(),
            assigned_by: 'usr-1',
            user: mockUsers.find((u) => u.id === taskData.assignee_ids[0]) || mockUsers[0],
          },
        ],
      };
      setTasks((prev) => [newTask, ...prev]);
    }
  };

  const handleDeleteTask = (taskId: string) => {
    setTasks((prev) => prev.filter((t) => t.id !== taskId));
    setCreateModalVisible(false);
  };

  const openEdit = (task: Task) => {
    setSelectedTask(task);
    setCreateModalVisible(true);
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.canvas }]}>
      {/* Top Header */}
      <MobileHeader eyebrow="TASK MANAGEMENT" title="My Tasks" subtitle="Daily To-Do queue & employee assignments" />

      {/* Search Input Bar */}
      <View style={[styles.searchContainer, { backgroundColor: theme.colors.canvas, borderBottomColor: theme.colors.hairline }]}>
        <View style={[styles.searchBox, { backgroundColor: theme.colors.canvasElevated, borderColor: theme.colors.hairline }]}>
          <Text style={styles.searchIcon}>🔍</Text>
          <TextInput
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="Search tasks by title..."
            placeholderTextColor={theme.colors.faint}
            style={[styles.searchInput, { color: theme.colors.ink }]}
          />
        </View>
      </View>

      {/* Sub-Tab Navigation Bar */}
      <View style={[styles.tabBar, { borderBottomColor: theme.colors.hairline }]}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabScroll}>
          {[
            { key: 'all', label: 'All Tasks' },
            { key: 'my', label: 'My Tasks' },
            { key: 'assigned', label: 'Assigned to Me' },
            { key: 'completed', label: 'Completed' },
          ].map((tab) => {
            const isActive = activeTab === tab.key;
            return (
              <TouchableOpacity
                key={tab.key}
                onPress={() => setActiveTab(tab.key as any)}
                style={[
                  styles.tabItem,
                  isActive && { borderBottomColor: theme.colors.link, borderBottomWidth: 3 },
                ]}
              >
                <Text
                  style={[
                    styles.tabText,
                    { color: isActive ? theme.colors.link : theme.colors.mute },
                    isActive && { fontWeight: '700' },
                  ]}
                >
                  {tab.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* Stats Header Row */}
      <View style={styles.statsRow}>
        <View style={styles.totalBadge}>
          <Text style={styles.totalIcon}>📋</Text>
          <Text style={[styles.totalLabel, { color: theme.colors.mute }]}>Total Tasks</Text>
          <Text style={[styles.totalCount, { color: theme.colors.ink }]}>{filteredTasks.length}</Text>
        </View>
        <TouchableOpacity
          onPress={() => setSortBy(sortBy === 'due_date' ? 'priority' : 'due_date')}
          style={[styles.sortBtn, { backgroundColor: theme.colors.canvasElevated, borderColor: theme.colors.hairline }]}
        >
          <Text style={[styles.sortText, { color: theme.colors.body }]}>
            Sort by: <Text style={{ fontWeight: '700' }}>{sortBy === 'due_date' ? 'Due Date ∨' : 'Priority ∨'}</Text>
          </Text>
        </TouchableOpacity>
      </View>

      {/* Task Cards Feed */}
      <ScrollView
        contentContainerStyle={styles.feedContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.colors.link} />}
      >
        {filteredTasks.map((item) => {
          const priorityColor =
            item.priority === 'high' || item.priority === 'critical'
              ? '#ef4444'
              : item.priority === 'medium'
              ? '#f59e0b'
              : '#10b981';

          const assignee = item.assignees?.[0]?.user;

          return (
            <Card
              key={item.id}
              style={[
                styles.taskCard,
                { borderLeftColor: priorityColor, borderLeftWidth: 4 },
              ]}
            >
              {/* Card Header: Title & Priority Pill Badge */}
              <View style={styles.cardTopRow}>
                <Text style={[styles.taskTitle, { color: theme.colors.ink }]} numberOfLines={1}>
                  {item.title}
                </Text>

                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                  <View
                    style={[
                      styles.priorityPillBadge,
                      { backgroundColor: priorityColor + '20', borderColor: priorityColor + '40' },
                    ]}
                  >
                    <Text style={[styles.priorityPillBadgeText, { color: priorityColor }]}>
                      {item.priority.charAt(0).toUpperCase() + item.priority.slice(1)}
                    </Text>
                  </View>

                  <TouchableOpacity onPress={() => openEdit(item)} style={styles.moreBtn}>
                    <Text style={[styles.moreText, { color: theme.colors.mute }]}>⋮</Text>
                  </TouchableOpacity>
                </View>
              </View>

              {/* Card Footer: Due Date & Assignee Info */}
              <View style={styles.cardBottomRow}>
                <View style={[styles.dueDateBadge, { backgroundColor: theme.colors.canvasElevated }]}>
                  <Text style={styles.calIcon}>📅</Text>
                  <Text style={[styles.dueDateText, { color: theme.colors.link }]}>
                    Due: {item.due_date}
                  </Text>
                </View>

                {assignee && (
                  <View style={styles.assigneeBox}>
                    <View style={[styles.assigneeAvatar, { backgroundColor: theme.colors.primary + '25' }]}>
                      <Text style={[styles.assigneeAvatarText, { color: theme.colors.primary }]}>
                        {assignee.full_name.charAt(0).toUpperCase()}
                      </Text>
                    </View>
                    <View>
                      <Text style={[styles.assigneeName, { color: theme.colors.ink }]}>{assignee.full_name}</Text>
                      <Text style={[styles.assigneeRole, { color: theme.colors.mute }]}>
                        {assignee.role.replace(/_/g, ' ')}
                      </Text>
                    </View>
                  </View>
                )}
              </View>
            </Card>
          );
        })}
      </ScrollView>

      {/* Floating Action Button (+) */}
      <TouchableOpacity
        onPress={() => { setSelectedTask(null); setCreateModalVisible(true); }}
        style={[styles.fab, { backgroundColor: theme.colors.primary }]}
        activeOpacity={0.8}
      >
        <Text style={[styles.fabIcon, { color: theme.colors.onPrimary }]}>+</Text>
      </TouchableOpacity>

      {/* Create / Edit To-Do Modal */}
      <CreateTaskModal
        visible={createModalVisible}
        onClose={() => setCreateModalVisible(false)}
        users={mockUsers}
        initialTask={selectedTask}
        onSave={handleSaveTask}
        onDelete={handleDeleteTask}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  searchContainer: {
    paddingHorizontal: spacingNumeric.md,
    paddingVertical: spacingNumeric.xs,
    borderBottomWidth: 1,
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 42,
    borderWidth: 1,
    borderRadius: radiusNumeric.md,
    paddingHorizontal: spacingNumeric.sm,
  },
  searchIcon: {
    fontSize: 14,
    marginRight: 6,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
  },
  tabBar: {
    borderBottomWidth: 1,
  },
  tabScroll: {
    paddingHorizontal: spacingNumeric.md,
    flexDirection: 'row',
    gap: spacingNumeric.md,
  },
  tabItem: {
    paddingVertical: 12,
  },
  tabText: {
    fontSize: 13,
    fontWeight: '500',
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacingNumeric.md,
    paddingVertical: spacingNumeric.xs,
  },
  totalBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  totalIcon: {
    fontSize: 14,
  },
  totalLabel: {
    fontSize: 12,
  },
  totalCount: {
    fontSize: 14,
    fontWeight: '800',
  },
  sortBtn: {
    paddingHorizontal: spacingNumeric.sm,
    paddingVertical: 4,
    borderRadius: radiusNumeric.sm,
    borderWidth: 1,
  },
  sortText: {
    fontSize: 11,
  },
  feedContent: {
    padding: spacingNumeric.md,
    paddingBottom: 90,
    gap: spacingNumeric.sm,
  },
  taskCard: {
    padding: spacingNumeric.md,
    borderRadius: radiusNumeric.md,
  },
  cardTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacingNumeric.sm,
  },
  taskTitle: {
    fontSize: 15,
    fontWeight: '700',
    flex: 1,
    marginRight: spacingNumeric.xs,
  },
  priorityPillBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
    borderWidth: 1,
  },
  priorityPillBadgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  moreBtn: {
    paddingLeft: 6,
  },
  moreText: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  cardBottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacingNumeric.xs,
  },
  dueDateBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    // Standardized border radius
    borderRadius: radiusNumeric.sm,
    gap: 4,
  },
  calIcon: {
    fontSize: 12,
  },
  dueDateText: {
    fontSize: 11,
    fontWeight: '600',
  },
  assigneeBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  assigneeAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  assigneeAvatarText: {
    fontSize: 12,
    fontWeight: 'bold',
  },
  assigneeName: {
    fontSize: 12,
    fontWeight: '600',
  },
  assigneeRole: {
    fontSize: 10,
  },
  fab: {
    position: 'absolute',
    right: 20,
    bottom: 24,
    width: 54,
    height: 54,
    borderRadius: 27,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
  fabIcon: {
    fontSize: 28,
    fontWeight: 'bold',
    lineHeight: 30,
  },
});
