/**
 * Reach International Mobile — Today's Shift Monitor Component
 * Displays real-time today shift roster for Supervisors, Managers, and Admins.
 * Shows who has entered today's shift log and who is pending, with RBAC scoping
 * and 1-tap Assisted Shift Entry.
 *
 * Implements canonical Search & Filter pattern from User Page (users.tsx)
 * with DropdownFilterSelector and clean 5-line information hierarchy card layout.
 */

import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  TextInput,
  Animated,
  Easing,
  Platform,
} from 'react-native';
import {
  useTheme,
  KPICard,
  KPIGrid,
  DropdownFilterSelector,
  type FilterOption,
  HighlightText,
} from '../ui';
import type { TodayShiftMonitorRow } from '@reachinternational/types';
import { useTodayShiftMonitor } from '../../lib/hooks/useOperationsData';
import { spacingNumeric, radiusNumeric } from '@reachinternational/design-tokens';
import { supabase } from '../../lib/supabase';
import * as Haptics from 'expo-haptics';
import {
  Clock,
  UserCheck,
  CheckCircle2,
  AlertCircle,
  Truck,
  Building2,
  User,
  X,
  UserPlus,
  UserX,
  Search,
  SlidersHorizontal,
  RotateCcw,
  ChevronDown,
  Wrench,
  Edit2,
} from 'lucide-react-native';
import { MobileAssignPersonnelModal } from './MobileAssignPersonnelModal';
import { isManagerOrAbove } from '@reachinternational/permissions';
import { useAuth } from '../../lib/auth/useAuth';

export interface MobileTodayShiftMonitorTabProps {
  actorId?: string;
  userRole?: string;
  onEnterLog: (row: TodayShiftMonitorRow) => void;
  onRefresh?: () => void;
  refreshing?: boolean;
  isAssignModalOpen?: boolean;
  onCloseAssignModal?: () => void;
}

const STATUS_FILTER_OPTIONS: FilterOption[] = [
  { id: 'all', label: 'All Status' },
  { id: 'pending', label: 'Pending', dotColor: '#f59e0b' },
  { id: 'entered', label: 'Entered', dotColor: '#10b981' },
  { id: 'unassigned', label: 'Unassigned', dotColor: '#94a3b8' },
];

const SORT_FILTER_OPTIONS: FilterOption[] = [
  { id: 'default', label: 'Default Order' },
  { id: 'operator_asc', label: 'Operator (A → Z)' },
  { id: 'operator_desc', label: 'Operator (Z → A)' },
  { id: 'machine_asc', label: 'Machine (A → Z)' },
  { id: 'status_pending', label: 'Pending First' },
  { id: 'status_entered', label: 'Entered First' },
];

export const MobileTodayShiftMonitorTab: React.FC<MobileTodayShiftMonitorTabProps> = ({
  actorId,
  userRole,
  onEnterLog,
  onRefresh,
  refreshing = false,
  isAssignModalOpen: isAssignModalOpenProp,
  onCloseAssignModal,
}) => {
  const { theme, isDark } = useTheme();
  const { role: authRole, userProfile } = useAuth();
  const effectiveRole = (userRole || authRole || userProfile?.role || '').toLowerCase().replace(/[\s-]/g, '_');
  const canEnterLog = isManagerOrAbove(effectiveRole) || ['super_admin', 'admin', 'manager'].includes(effectiveRole);
  const { data: rows = [], isLoading, refetch } = useTodayShiftMonitor(actorId);

  // Search & Filter State (reusing User Page canonical architecture)
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'entered' | 'unassigned'>('all');
  const [shiftFilter, setShiftFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<string>('default');
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const searchInputRef = useRef<TextInput>(null);

  // Animated Expandable Filter Drawer state
  const isWeb = Platform.OS === 'web';
  const filterAnim = useRef(new Animated.Value(0)).current;
  const [filterPanelOpen, setFilterPanelOpen] = useState(false);
  const [panelContentHeight, setPanelContentHeight] = useState(160);

  const [internalAssignModalOpen, setInternalAssignModalOpen] = useState(false);
  const [assignMachineId, setAssignMachineId] = useState<string | undefined>();

  const isAssignModalOpen = isAssignModalOpenProp !== undefined ? isAssignModalOpenProp : internalAssignModalOpen;

  useEffect(() => {
    if (!isWeb) {
      Animated.timing(filterAnim, {
        toValue: filterPanelOpen ? 1 : 0,
        duration: 220,
        easing: Easing.bezier(0.16, 1, 0.3, 1),
        useNativeDriver: false,
      }).start();
    }
  }, [filterPanelOpen, isWeb]);

  const handleOpenAssignModal = (machineId?: string) => {
    setAssignMachineId(machineId);
    setInternalAssignModalOpen(true);
  };

  const handleCloseAssignModal = () => {
    setInternalAssignModalOpen(false);
    setAssignMachineId(undefined);
    onCloseAssignModal?.();
  };

  // Real-time broadcast listener for instant roster revalidation
  useEffect(() => {
    const rosterChannel = supabase.channel('operations-roster');

    rosterChannel
      .on('broadcast', { event: 'assignment_changed' }, () => {
        refetch();
      })
      .on('broadcast', { event: 'roster_updated' }, () => {
        refetch();
      })
      .on('broadcast', { event: 'log_entered' }, () => {
        refetch();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(rosterChannel);
    };
  }, [refetch]);

  const summary = useMemo(() => {
    const total = rows.length;
    const entered = rows.filter((r) => r.status === 'entered').length;
    const pending = rows.filter((r) => r.status === 'pending').length;
    const unassigned = rows.filter((r) => r.status === 'unassigned').length;
    return { total, entered, pending, unassigned };
  }, [rows]);

  // Dynamic Shift filter options derived from live roster rows
  const shiftOptions = useMemo<FilterOption[]>(() => {
    const list: FilterOption[] = [{ id: 'all', label: 'All Shifts' }];
    const shiftCodes = Array.from(new Set(rows.map((r) => r.shift_code).filter(Boolean)));
    shiftCodes.sort().forEach((code) => {
      const sample = rows.find((r) => r.shift_code === code);
      list.push({
        id: code as string,
        label: sample?.shift_name || `Shift ${code}`,
      });
    });
    return list;
  }, [rows]);

  const currentStatusLabel =
    STATUS_FILTER_OPTIONS.find((opt) => opt.id === statusFilter)?.label || 'Status';
  const currentShiftLabel =
    shiftOptions.find((opt) => opt.id === shiftFilter)?.label || 'Shift';
  const currentSortLabel =
    SORT_FILTER_OPTIONS.find((opt) => opt.id === sortBy)?.label || 'Sort';

  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (statusFilter !== 'all') count++;
    if (shiftFilter !== 'all') count++;
    if (sortBy !== 'default') count++;
    return count;
  }, [statusFilter, shiftFilter, sortBy]);

  const handleResetAllFilters = useCallback(() => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    setStatusFilter('all');
    setShiftFilter('all');
    setSortBy('default');
    setSearchQuery('');
  }, []);

  const filtered = useMemo(() => {
    let r = [...rows];

    // 1. Status Filter
    if (statusFilter !== 'all') {
      r = r.filter((row) => row.status === statusFilter);
    }

    // 2. Shift Filter
    if (shiftFilter !== 'all') {
      r = r.filter((row) => row.shift_code === shiftFilter || row.shift_name === shiftFilter);
    }

    // 3. Search Query Filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().replace(/\s+/g, '');
      r = r.filter(
        (row) =>
          (row.operator_name || '').toLowerCase().replace(/\s+/g, '').includes(q) ||
          (row.machine_code || '').toLowerCase().includes(q) ||
          (row.machine_serial_number || '').toLowerCase().includes(q) ||
          (row.machine_model || '').toLowerCase().includes(q) ||
          (row.client_name || '').toLowerCase().includes(q) ||
          (row.client_code || '').toLowerCase().includes(q) ||
          (row.client_id || '').toLowerCase().includes(q)
      );
    }

    // 4. Sorting
    if (sortBy === 'operator_asc') {
      r.sort((a, b) => (a.operator_name || '').localeCompare(b.operator_name || ''));
    } else if (sortBy === 'operator_desc') {
      r.sort((a, b) => (b.operator_name || '').localeCompare(a.operator_name || ''));
    } else if (sortBy === 'machine_asc') {
      r.sort((a, b) =>
        (a.machine_serial_number || a.machine_code || '').localeCompare(
          b.machine_serial_number || b.machine_code || ''
        )
      );
    } else if (sortBy === 'status_pending') {
      r.sort((a, b) => (a.status === 'pending' ? -1 : 1) - (b.status === 'pending' ? -1 : 1));
    } else if (sortBy === 'status_entered') {
      r.sort((a, b) => (a.status === 'entered' ? -1 : 1) - (b.status === 'entered' ? -1 : 1));
    }

    return r;
  }, [rows, statusFilter, shiftFilter, searchQuery, sortBy]);

  const renderFilterPanelContent = () => (
    <View
      onLayout={(e) => {
        const h = e.nativeEvent.layout.height;
        if (h > 0 && Math.abs(h - panelContentHeight) > 2) {
          setPanelContentHeight(h);
        }
      }}
      style={[
        styles.filterPanelCard,
        {
          backgroundColor: theme.colors.canvasElevated,
          borderColor: theme.colors.hairline,
        },
      ]}
    >
      <View style={styles.filterSelectorsGrid}>
        {/* Status Dropdown */}
        <DropdownFilterSelector
          label="Status"
          value={statusFilter}
          options={STATUS_FILTER_OPTIONS}
          onChange={(val) => setStatusFilter(val as any)}
        />

        {/* Shift Dropdown */}
        <DropdownFilterSelector
          label="Shift"
          value={shiftFilter}
          options={shiftOptions}
          onChange={(val) => setShiftFilter(val)}
        />

        {/* Sort By Dropdown */}
        <DropdownFilterSelector
          label="Sort"
          value={sortBy}
          options={SORT_FILTER_OPTIONS}
          onChange={(val) => setSortBy(val)}
          align="right"
          showSearch={false}
        />
      </View>

      {/* Active Filter Chips Strip */}
      {(activeFilterCount > 0 || searchQuery.trim() !== '') && (
        <View style={[styles.activeBadgesRow, { borderTopColor: theme.colors.hairline }]}>
          <Text style={[styles.activeBadgesHeader, { color: theme.colors.mute }]}>
            Active Filters:
          </Text>

          {searchQuery.trim() !== '' && (
            <TouchableOpacity
              onPress={() => setSearchQuery('')}
              style={[
                styles.badgeChip,
                { backgroundColor: theme.colors.canvas, borderColor: theme.colors.hairline },
              ]}
            >
              <Text style={[styles.badgeChipText, { color: theme.colors.ink }]}>
                Search: "{searchQuery}"
              </Text>
              <X size={12} color={theme.colors.mute} />
            </TouchableOpacity>
          )}

          {statusFilter !== 'all' && (
            <TouchableOpacity
              onPress={() => setStatusFilter('all')}
              style={[
                styles.badgeChip,
                {
                  backgroundColor:
                    statusFilter === 'entered'
                      ? isDark ? '#064e3b26' : '#ecfdf5'
                      : isDark ? '#78350f26' : '#fffbeb',
                  borderColor:
                    statusFilter === 'entered' ? '#10b98133' : '#f59e0b33',
                },
              ]}
            >
              <Text
                style={[
                  styles.badgeChipText,
                  {
                    color: statusFilter === 'entered' ? '#059669' : '#d97706',
                  },
                ]}
              >
                Status: {currentStatusLabel}
              </Text>
              <X size={12} color={statusFilter === 'entered' ? '#059669' : '#d97706'} />
            </TouchableOpacity>
          )}

          {shiftFilter !== 'all' && (
            <TouchableOpacity
              onPress={() => setShiftFilter('all')}
              style={[
                styles.badgeChip,
                {
                  backgroundColor: isDark ? '#1e3a8a26' : '#eff6ff',
                  borderColor: '#3b82f633',
                },
              ]}
            >
              <Text style={[styles.badgeChipText, { color: '#2563eb' }]}>
                Shift: {currentShiftLabel}
              </Text>
              <X size={12} color="#2563eb" />
            </TouchableOpacity>
          )}

          {sortBy !== 'default' && (
            <TouchableOpacity
              onPress={() => setSortBy('default')}
              style={[
                styles.badgeChip,
                { backgroundColor: theme.colors.canvas, borderColor: theme.colors.hairline },
              ]}
            >
              <Text style={[styles.badgeChipText, { color: theme.colors.ink }]}>
                Sort: {currentSortLabel}
              </Text>
              <X size={12} color={theme.colors.mute} />
            </TouchableOpacity>
          )}

          <TouchableOpacity onPress={handleResetAllFilters} style={styles.resetAllLink}>
            <RotateCcw size={11} color={theme.colors.link} />
            <Text style={[styles.resetAllLinkText, { color: theme.colors.link }]}>
              Reset all
            </Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );

  if (isLoading && rows.length === 0) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={theme.colors.link} />
        <Text style={[styles.loadingText, { color: theme.colors.mute }]}>
          Loading today's shift roster...
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* 1. KPI COUNTER SUMMARY CARDS */}
      <KPIGrid columns={4}>
        <KPICard
          label="Total Shifts"
          value={summary.total}
          icon={Clock}
          variant="default"
          active={statusFilter === 'all'}
          onPress={() => setStatusFilter('all')}
        />
        <KPICard
          label="Entered"
          value={summary.entered}
          icon={CheckCircle2}
          variant="success"
          active={statusFilter === 'entered'}
          onPress={() => setStatusFilter((prev) => (prev === 'entered' ? 'all' : 'entered'))}
        />
        <KPICard
          label="Pending"
          value={summary.pending}
          icon={AlertCircle}
          variant={summary.pending > 0 ? 'warning' : 'default'}
          active={statusFilter === 'pending'}
          onPress={() => setStatusFilter((prev) => (prev === 'pending' ? 'all' : 'pending'))}
        />
        <KPICard
          label="Unassigned"
          value={summary.unassigned}
          icon={UserX}
          variant={summary.unassigned > 0 ? 'error' : 'default'}
          active={statusFilter === 'unassigned'}
          onPress={() => setStatusFilter((prev) => (prev === 'unassigned' ? 'all' : 'unassigned'))}
        />
      </KPIGrid>

      {/* 2. SEARCH & FILTER TOOLBAR */}
      <View style={styles.toolbarContainer}>
        {/* Top Search & Filter Action Row */}
        <View style={styles.toolbarTopRow}>
          {/* Search Input Bar (Capsule Pill with Web Outline Suppression & Focus Ring) */}
          <TouchableOpacity
            activeOpacity={1}
            onPress={() => searchInputRef.current?.focus()}
            style={[
              styles.searchBarBox,
              {
                backgroundColor: theme.colors.canvasElevated,
                borderColor: isSearchFocused ? theme.colors.ink : theme.colors.hairline,
              },
              isSearchFocused && Platform.OS === 'web' && ({
                boxShadow: isDark
                  ? '0 0 0 1.5px rgba(255, 255, 255, 0.4)'
                  : '0 0 0 1.5px rgba(0, 0, 0, 0.15)',
              } as any),
            ]}
          >
            {isLoading && rows.length > 0 ? (
              <ActivityIndicator
                size="small"
                color={theme.colors.mute}
                style={styles.searchIcon}
              />
            ) : (
              <Search
                size={15}
                color={isSearchFocused ? theme.colors.ink : theme.colors.mute}
                style={styles.searchIcon}
              />
            )}
            <TextInput
              ref={searchInputRef}
              placeholder="Search operator, machine, client..."
              placeholderTextColor={theme.colors.mute}
              value={searchQuery}
              onChangeText={setSearchQuery}
              onFocus={() => setIsSearchFocused(true)}
              onBlur={() => setIsSearchFocused(false)}
              style={[
                styles.searchInputText,
                { color: theme.colors.ink },
                Platform.OS === 'web' && ({ outlineStyle: 'none' } as any),
              ]}
              returnKeyType="search"
              autoCapitalize="none"
              autoCorrect={false}
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity
                onPress={() => setSearchQuery('')}
                style={styles.searchClearBtn}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                accessibilityLabel="Clear search"
              >
                <X size={14} color={theme.colors.mute} />
              </TouchableOpacity>
            )}
          </TouchableOpacity>

          {/* Filter Toggle Button */}
          <TouchableOpacity
            onPress={() => {
              Haptics.selectionAsync().catch(() => {});
              setFilterPanelOpen((prev) => !prev);
            }}
            activeOpacity={0.8}
            style={[
              styles.filterToggleBtn,
              {
                backgroundColor:
                  filterPanelOpen || activeFilterCount > 0
                    ? theme.colors.ink
                    : theme.colors.canvasElevated,
                borderColor:
                  filterPanelOpen || activeFilterCount > 0
                    ? theme.colors.ink
                    : theme.colors.hairline,
              },
              isWeb && ({
                transition: 'background-color 180ms ease, border-color 180ms ease',
              } as any),
            ]}
            accessibilityLabel="Toggle filter selectors"
          >
            <SlidersHorizontal
              size={13}
              color={
                filterPanelOpen || activeFilterCount > 0
                  ? theme.colors.canvas
                  : theme.colors.ink
              }
            />
            <Text
              style={[
                styles.filterToggleBtnText,
                {
                  color:
                    filterPanelOpen || activeFilterCount > 0
                      ? theme.colors.canvas
                      : theme.colors.ink,
                },
              ]}
            >
              Filter
            </Text>
            {activeFilterCount > 0 && (
              <View
                style={[
                  styles.activeCountBadge,
                  {
                    backgroundColor:
                      filterPanelOpen || activeFilterCount > 0
                        ? theme.colors.canvas
                        : theme.colors.ink,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.activeCountBadgeText,
                    {
                      color:
                        filterPanelOpen || activeFilterCount > 0
                          ? theme.colors.ink
                          : theme.colors.canvas,
                    },
                  ]}
                >
                  {activeFilterCount}
                </Text>
              </View>
            )}
            {isWeb ? (
              <View
                style={{
                  transform: [{ rotate: filterPanelOpen ? '180deg' : '0deg' }],
                  transition: 'transform 220ms cubic-bezier(0.16, 1, 0.3, 1)',
                } as any}
              >
                <ChevronDown
                  size={13}
                  color={
                    filterPanelOpen || activeFilterCount > 0
                      ? theme.colors.canvas
                      : theme.colors.mute
                  }
                />
              </View>
            ) : (
              <Animated.View
                style={{
                  transform: [
                    {
                      rotate: filterAnim.interpolate({
                        inputRange: [0, 1],
                        outputRange: ['0deg', '180deg'],
                      }),
                    },
                  ],
                }}
              >
                <ChevronDown
                  size={13}
                  color={
                    filterPanelOpen || activeFilterCount > 0
                      ? theme.colors.canvas
                      : theme.colors.mute
                  }
                />
              </Animated.View>
            )}
          </TouchableOpacity>

          {/* Quick Reset Filters Button */}
          {(activeFilterCount > 0 || searchQuery.length > 0) && (
            <TouchableOpacity
              onPress={handleResetAllFilters}
              activeOpacity={0.8}
              style={[
                styles.quickResetBtn,
                {
                  backgroundColor: theme.colors.canvasElevated,
                  borderColor: theme.colors.hairline,
                },
              ]}
              accessibilityLabel="Reset all filters"
            >
              <RotateCcw size={13} color={theme.colors.mute} />
              <Text style={[styles.quickResetBtnText, { color: theme.colors.mute }]}>
                Reset
              </Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Expandable Animated Filter Selectors Section */}
        {isWeb ? (
          <View
            style={[
              styles.filterPanelWebContainer,
              {
                display: 'grid',
                gridTemplateRows: filterPanelOpen ? '1fr' : '0fr',
                opacity: filterPanelOpen ? 1 : 0,
                transition:
                  'grid-template-rows 220ms cubic-bezier(0.16, 1, 0.3, 1), opacity 180ms cubic-bezier(0.16, 1, 0.3, 1)',
                pointerEvents: filterPanelOpen ? 'auto' : 'none',
              } as any,
            ]}
          >
            <View style={{ minHeight: 0, overflow: 'hidden' } as any}>
              {renderFilterPanelContent()}
            </View>
          </View>
        ) : (
          <Animated.View
            style={[
              styles.filterPanelAnimatedContainer,
              {
                maxHeight: filterAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0, Math.max(panelContentHeight + 40, 260)],
                }),
                opacity: filterAnim,
              },
            ]}
          >
            {renderFilterPanelContent()}
          </Animated.View>
        )}
      </View>

      {/* 3. ROSTER SHIFT LOG CARDS */}
      {filtered.length === 0 ? (
        <View
          style={[
            styles.emptyCard,
            {
              backgroundColor: theme.colors.canvasElevated,
              borderColor: theme.colors.hairline,
            },
          ]}
        >
          <AlertCircle size={28} color={theme.colors.mute} />
          <Text style={[styles.emptyTitle, { color: theme.colors.ink }]}>
            No Shifts Found
          </Text>
          <Text style={[styles.emptySubtitle, { color: theme.colors.mute }]}>
            {searchQuery
              ? `No matching shifts found for "${searchQuery}". Try changing search or filters.`
              : statusFilter === 'pending'
              ? 'All operators have submitted their shift logs today!'
              : 'No active shift assignments found for today.'}
          </Text>
          {!searchQuery && (
            <TouchableOpacity
              onPress={() => handleOpenAssignModal(undefined)}
              activeOpacity={0.8}
              style={[styles.emptyAssignButton, { backgroundColor: theme.colors.link }]}
            >
              <UserPlus size={14} color="#ffffff" />
              <Text style={styles.emptyAssignButtonText}>Assign Operator</Text>
            </TouchableOpacity>
          )}
        </View>
      ) : (
        <View style={styles.cardsList}>
          {filtered.map((row, idx) => {
            const isUnassigned = row.status === 'unassigned' || !row.operator_id;
            const isEntered = row.status === 'entered';
            const cardKey = row.operator_id
              ? `mon-${row.operator_id}-${row.machine_id}-${row.shift_code}`
              : `mon-unassigned-${row.machine_id}-${idx}`;

            const accentColor = isEntered
              ? '#10b981'
              : isUnassigned
              ? isDark ? '#fbbf24' : '#d97706'
              : '#f59e0b';

            const isAssistedLog = Boolean(
              (row.entry_source && row.entry_source !== 'operator') ||
              (row.entered_by && row.operator_id && row.entered_by !== row.operator_id) ||
              (row.entered_by_name && row.operator_name && row.entered_by_name.trim().toLowerCase() !== row.operator_name.trim().toLowerCase())
            );

            const enteredAuthorName = row.entered_by_name || (isAssistedLog ? 'Admin' : (row.operator_name || 'Operator'));

            const authorRoleBadge = row.entry_source && row.entry_source !== 'operator'
              ? row.entry_source === 'super_admin' ? 'Super Admin'
                : row.entry_source === 'admin' ? 'Admin'
                : row.entry_source === 'manager' ? 'Manager'
                : row.entry_source === 'supervisor' ? 'Supervisor'
                : row.entry_source
              : null;

            return (
              <View
                key={cardKey}
                style={[
                  styles.card,
                  {
                    backgroundColor: theme.colors.canvasElevated,
                    borderColor: theme.colors.hairline,
                    borderLeftColor: accentColor,
                    borderLeftWidth: 4,
                  },
                ]}
              >
                {/* LINE 1: Operator Name (Left)  +  Shift Log Status (Right) */}
                <View style={styles.cardHeader}>
                  <View style={styles.userAvatarRow}>
                    <View
                      style={[
                        styles.avatarCircle,
                        {
                          backgroundColor: isUnassigned
                            ? isDark ? 'rgba(245, 158, 11, 0.2)' : '#fef3c7'
                            : theme.colors.ink,
                        },
                      ]}
                    >
                      {isUnassigned ? (
                        <UserX size={15} color={isDark ? '#fbbf24' : '#d97706'} />
                      ) : (
                        <Text style={[styles.avatarLetter, { color: theme.colors.canvas }]}>
                          {row.operator_name ? row.operator_name[0].toUpperCase() : 'O'}
                        </Text>
                      )}
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text
                        style={[
                          styles.operatorName,
                          {
                            color: isUnassigned
                              ? isDark ? '#fbbf24' : '#d97706'
                              : theme.colors.ink,
                          },
                        ]}
                        numberOfLines={1}
                      >
                        {isUnassigned ? (
                          'Unassigned Machine'
                        ) : (
                          <HighlightText
                            text={row.operator_name}
                            query={searchQuery}
                            style={[
                              styles.operatorName,
                              { color: theme.colors.ink },
                            ]}
                            numberOfLines={1}
                          />
                        )}
                      </Text>
                    </View>
                  </View>

                  {/* Shift Log Status Badge */}
                  <View
                    style={[
                      styles.cardStatusBadge,
                      {
                        backgroundColor: isEntered
                          ? isDark ? '#064e3b26' : '#d1fae5'
                          : isUnassigned
                          ? isDark ? '#78350f26' : '#fef3c7'
                          : isDark ? '#78350f26' : '#fffbeb',
                        borderColor: isEntered ? '#10b98133' : '#f59e0b33',
                      },
                    ]}
                  >
                    <View style={[styles.statusDot, { backgroundColor: accentColor }]} />
                    <Text
                      style={[
                        styles.cardStatusText,
                        {
                          color: isEntered
                            ? '#047857'
                            : isUnassigned
                            ? isDark ? '#fbbf24' : '#b45309'
                            : isDark ? '#fbbf24' : '#d97706',
                        },
                      ]}
                    >
                      {isEntered ? 'ENTERED' : isUnassigned ? 'UNASSIGNED' : 'PENDING'}
                    </Text>
                  </View>
                </View>

                {/* USER DETAILS CARD METADATA BOX (Lines 2, 3, 4, 5) */}
                <View
                  style={[
                    styles.cardMetaBox,
                    {
                      backgroundColor: theme.colors.canvas,
                      borderColor: theme.colors.hairline,
                    },
                  ]}
                >
                  {/* LINE 2: Shift Name */}
                  <View style={styles.metaFieldRow}>
                    <View style={styles.metaFieldLabelGroup}>
                      <Clock size={12} color={theme.colors.mute} />
                      <Text style={[styles.metaFieldLabel, { color: theme.colors.mute }]}>
                        Shift:
                      </Text>
                    </View>
                    <Text style={[styles.metaFieldValue, { color: theme.colors.ink, fontWeight: '600' }]} numberOfLines={1}>
                      {row.shift_name || (row.shift_code ? `Shift ${row.shift_code}` : 'Shift A')}
                    </Text>
                  </View>

                  {/* LINE 3: Machine Model */}
                  <View style={styles.metaFieldRow}>
                    <View style={styles.metaFieldLabelGroup}>
                      <Wrench size={12} color={theme.colors.mute} />
                      <Text style={[styles.metaFieldLabel, { color: theme.colors.mute }]}>
                        Model:
                      </Text>
                    </View>
                    <HighlightText
                      text={row.machine_model || '—'}
                      query={searchQuery}
                      style={[styles.metaFieldValue, { color: theme.colors.ink, fontWeight: '600' }]}
                      numberOfLines={1}
                    />
                  </View>

                  {/* LINE 4: Machine Sr No */}
                  <View style={styles.metaFieldRow}>
                    <View style={styles.metaFieldLabelGroup}>
                      <Truck size={12} color={theme.colors.link} />
                      <Text style={[styles.metaFieldLabel, { color: theme.colors.mute }]}>
                        Sr No:
                      </Text>
                    </View>
                    <TouchableOpacity
                      activeOpacity={0.7}
                      onPress={() => handleOpenAssignModal(row.machine_id)}
                      style={[
                        styles.monoBadge,
                        {
                          backgroundColor: theme.colors.canvasElevated,
                          borderColor: theme.colors.hairline,
                        },
                      ]}
                    >
                      <HighlightText
                        text={row.machine_serial_number || row.machine_code || '—'}
                        query={searchQuery}
                        style={[
                          styles.metaFieldValueMono,
                          { color: theme.colors.link, fontWeight: '700' },
                        ]}
                        numberOfLines={1}
                      />
                    </TouchableOpacity>
                  </View>

                  {/* LINE 5: Client Name */}
                  <View style={styles.metaFieldRow}>
                    <View style={styles.metaFieldLabelGroup}>
                      <Building2 size={12} color={theme.colors.mute} />
                      <Text style={[styles.metaFieldLabel, { color: theme.colors.mute }]}>
                        Client:
                      </Text>
                    </View>
                    <HighlightText
                      text={`${row.client_name || 'Direct / Internal Fleet'}${row.client_code ? ` (${row.client_code})` : ''}`}
                      query={searchQuery}
                      style={[styles.metaFieldValue, { color: theme.colors.ink, fontWeight: '600' }]}
                      numberOfLines={1}
                    />
                  </View>
                </View>

                {/* Entered Details Summary Box */}
                {isEntered && (
                  <View
                    style={[
                      styles.enteredMetaBox,
                      {
                        backgroundColor: isDark ? '#064e3b18' : '#ecfdf5',
                        borderColor: isDark ? '#064e3b40' : '#a7f3d0',
                      },
                    ]}
                  >
                    <View style={styles.attributionInline}>
                      <UserCheck size={13} color={isDark ? '#34d399' : '#059669'} />
                      <Text style={[styles.attributionText, { color: isDark ? '#34d399' : '#047857' }]} numberOfLines={1}>
                        {isAssistedLog ? (
                          <>
                            Assisted Log by <Text style={{ fontWeight: '700' }}>{enteredAuthorName}</Text>
                            {authorRoleBadge ? (
                              <Text style={{ fontStyle: 'italic', fontWeight: '500' }}>{` (${authorRoleBadge})`}</Text>
                            ) : null}
                          </>
                        ) : (
                          <>
                            Logged by <Text style={{ fontWeight: '600' }}>{enteredAuthorName}</Text>
                          </>
                        )}
                      </Text>
                    </View>
                  </View>
                )}

                {/* Action Buttons: Assign Operator (Unassigned) or Enter Shift Log (Pending) / Edit Shift Log (Entered) */}
                {isUnassigned ? (
                  <TouchableOpacity
                    onPress={() => handleOpenAssignModal(row.machine_id)}
                    activeOpacity={0.8}
                    style={[styles.assignRowBtn, { backgroundColor: theme.colors.ink }]}
                  >
                    <UserPlus size={14} color={theme.colors.canvas} />
                    <Text style={[styles.assignRowBtnText, { color: theme.colors.canvas }]}>
                      Assign Operator to {row.machine_code}
                    </Text>
                  </TouchableOpacity>
                ) : !isEntered ? (
                  canEnterLog ? (
                    <TouchableOpacity
                      onPress={() => onEnterLog(row)}
                      activeOpacity={0.8}
                      style={[
                        styles.enterLogBtn,
                        {
                          backgroundColor: theme.colors.link + '15',
                          borderColor: theme.colors.link + '35',
                        },
                      ]}
                    >
                      <User size={14} color={theme.colors.link} />
                      <Text style={[styles.enterLogBtnText, { color: theme.colors.link }]} numberOfLines={1}>
                        Enter Shift Log for {row.operator_name || 'Operator'}
                      </Text>
                    </TouchableOpacity>
                  ) : (
                    <View style={styles.pendingNoticeBox}>
                      <Text style={[styles.pendingNoticeText, { color: theme.colors.mute }]}>
                        Shift log submission pending
                      </Text>
                    </View>
                  )
                ) : canEnterLog ? (
                  <TouchableOpacity
                    onPress={() => onEnterLog(row)}
                    activeOpacity={0.8}
                    style={[
                      styles.enterLogBtn,
                      {
                        backgroundColor: isDark ? '#064e3b18' : '#ecfdf5',
                        borderColor: isDark ? '#064e3b40' : '#a7f3d0',
                      },
                    ]}
                  >
                    <Edit2 size={13} color={isDark ? '#34d399' : '#059669'} />
                    <Text style={[styles.enterLogBtnText, { color: isDark ? '#34d399' : '#047857' }]} numberOfLines={1}>
                      Edit Shift Log for {row.operator_name || 'Operator'}
                    </Text>
                  </TouchableOpacity>
                ) : null}
              </View>
            );
          })}
        </View>
      )}

      {/* 4. ASSIGN PERSONNEL MODAL */}
      <MobileAssignPersonnelModal
        visible={isAssignModalOpen}
        onClose={handleCloseAssignModal}
        initialMachineId={assignMachineId}
        onSuccess={() => {
          refetch();
        }}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    gap: spacingNumeric.sm,
  },
  loadingContainer: {
    paddingVertical: 48,
    alignItems: 'center',
    gap: 12,
  },
  loadingText: {
    fontSize: 13,
    fontWeight: '500',
  },
  toolbarContainer: {
    gap: spacingNumeric.sm,
  },
  toolbarTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  searchBarBox: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    height: 42,
    borderRadius: radiusNumeric.full,
    borderWidth: 1,
    paddingHorizontal: 14,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInputText: {
    flex: 1,
    fontSize: 13.5,
    paddingVertical: 0,
    paddingHorizontal: 0,
    height: '100%',
    borderWidth: 0,
    backgroundColor: 'transparent',
  },
  searchClearBtn: {
    padding: 3,
    marginLeft: 4,
  },
  filterToggleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: 42,
    paddingHorizontal: 13,
    borderRadius: radiusNumeric.full,
    borderWidth: 1,
  },
  filterToggleBtnText: {
    fontSize: 12,
    fontWeight: '700',
  },
  activeCountBadge: {
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  activeCountBadgeText: {
    fontSize: 12,
    fontWeight: '800',
  },
  quickResetBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    height: 42,
    paddingHorizontal: 11,
    borderRadius: radiusNumeric.full,
    borderWidth: 1,
  },
  quickResetBtnText: {
    fontSize: 12.5,
    fontWeight: '600',
  },
  filterPanelWebContainer: {
    overflow: 'hidden',
  },
  filterPanelAnimatedContainer: {
    overflow: 'hidden',
  },
  filterPanelCard: {
    borderRadius: radiusNumeric.lg,
    borderWidth: 1,
    padding: spacingNumeric.sm,
    gap: spacingNumeric.sm,
    marginTop: 4,
  },
  filterPanelContent: {
    gap: spacingNumeric.sm,
  },
  filterSelectorsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  activeBadgesRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 6,
    paddingTop: spacingNumeric.xs,
    borderTopWidth: 1,
  },
  activeBadgesHeader: {
    fontSize: 12.5,
    fontWeight: '600',
    marginRight: 2,
  },
  badgeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radiusNumeric.sm,
    borderWidth: 1,
  },
  badgeChipText: {
    fontSize: 12.5,
    fontWeight: '600',
  },
  resetAllLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 6,
    paddingVertical: 4,
  },
  resetAllLinkText: {
    fontSize: 12.5,
    fontWeight: '700',
  },
  emptyCard: {
    padding: 32,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radiusNumeric.lg,
    borderWidth: 1,
    gap: 8,
  },
  emptyTitle: {
    fontSize: 15.5,
    fontWeight: '700',
  },
  emptySubtitle: {
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18,
    maxWidth: 280,
  },
  emptyAssignButton: {
    height: 44,
    borderRadius: radiusNumeric.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 18,
    marginTop: 6,
  },
  emptyAssignButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '700',
  },
  // Card Styles
  cardsList: {
    gap: spacingNumeric.sm,
  },
  card: {
    borderRadius: radiusNumeric.lg,
    borderWidth: 1,
    padding: spacingNumeric.md,
    gap: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 2,
    elevation: 1,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  userAvatarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  avatarCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarLetter: {
    fontSize: 14,
    fontWeight: '800',
  },
  operatorName: {
    fontSize: 15.5,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  cardStatusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radiusNumeric.full,
    borderWidth: 1,
  },
  statusDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
  },
  cardStatusText: {
    fontSize: 11.5,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  // Structured Metadata Box (Lines 2, 3, 4, 5)
  cardMetaBox: {
    borderRadius: radiusNumeric.md,
    borderWidth: 1,
    padding: 10,
    gap: 7,
  },
  metaFieldRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  metaFieldLabelGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    width: 66,
  },
  metaFieldLabel: {
    fontSize: 12,
    fontWeight: '600',
  },
  metaFieldValue: {
    fontSize: 13,
    flex: 1,
  },
  monoBadge: {
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4,
    borderWidth: 1,
  },
  metaFieldValueMono: {
    fontSize: 12.5,
    fontFamily: 'monospace',
  },
  // Summary & Actions
  enteredMetaBox: {
    paddingVertical: 7,
    paddingHorizontal: 10,
    borderRadius: radiusNumeric.sm,
    borderWidth: 1,
    justifyContent: 'center',
  },
  attributionInline: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  attributionText: {
    fontSize: 12.5,
  },
  enterLogBtn: {
    height: 44, // Minimum 44px touch target
    borderRadius: radiusNumeric.md,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 14,
  },
  enterLogBtnText: {
    fontSize: 14,
    fontWeight: '600',
  },
  assignRowBtn: {
    height: 44, // Minimum 44px touch target
    borderRadius: radiusNumeric.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 14,
  },
  assignRowBtnText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '700',
  },
  pendingNoticeBox: {
    paddingVertical: spacingNumeric.xs,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pendingNoticeText: {
    fontSize: 12.5,
    fontStyle: 'italic',
  },
});
