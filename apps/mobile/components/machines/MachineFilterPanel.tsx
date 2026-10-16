import React, { useRef } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  type TextInput,
} from 'react-native';
import {
  useTheme,
  Text,
  Badge,
  SearchInput,
  type FilterOption,
} from '../ui';
import { Pressable } from '../ui/touch/Pressable';
import { SlidersHorizontal, RotateCcw, X } from '../ui/icon';
import { radiusNumeric, spacingNumeric } from '@reachinternational/design-tokens';
import { haptics } from '../../lib/haptics';

export type RentalFilterType = 'all' | 'available' | 'rented';
export type HealthFilterType = 'all' | 'active' | 'spare' | 'under_maintenance' | 'breakdown';
export type SortOptionType =
  | 'machine_id_asc'
  | 'machine_id_desc'
  | 'model_asc'
  | 'newest_yum'
  | 'oldest_yum'
  | 'highest_hmr'
  | 'lowest_hmr';

export interface MachineFilterPanelProps {
  search: string;
  setSearch: (text: string) => void;
  debouncedSearch: string;
  handleClearSearch: () => void;
  handleSearchSubmit: () => void;
  isSearching: boolean;
  filterPanelOpen: boolean;
  setFilterPanelOpen: (open: boolean | ((prev: boolean) => boolean)) => void;
  activeFilterCount: number;
  handleResetAllFilters: () => void;
  rentalFilter: RentalFilterType;
  setRentalFilter: (val: RentalFilterType) => void;
  healthFilter: HealthFilterType;
  setHealthFilter: (val: HealthFilterType) => void;
  supervisorFilter: string;
  setSupervisorFilter: (val: string) => void;
  clientFilter: string;
  setClientFilter: (val: string) => void;
  sortBy: SortOptionType;
  setSortBy: (val: SortOptionType) => void;
  rentalFilterOptions: FilterOption[];
  healthFilterOptions: FilterOption[];
  supervisorFilterOptions: FilterOption[];
  clientFilterOptions: FilterOption[];
  sortOptions: FilterOption[];
}

export const MachineFilterPanel = React.memo(function MachineFilterPanel({
  search,
  setSearch,
  debouncedSearch,
  handleClearSearch,
  handleSearchSubmit,
  isSearching,
  filterPanelOpen,
  setFilterPanelOpen,
  activeFilterCount,
  handleResetAllFilters,
  rentalFilter,
  setRentalFilter,
  healthFilter,
  setHealthFilter,
  supervisorFilter,
  setSupervisorFilter,
  clientFilter,
  setClientFilter,
  sortBy,
  setSortBy,
  rentalFilterOptions,
  healthFilterOptions,
  supervisorFilterOptions,
  clientFilterOptions,
  sortOptions,
}: MachineFilterPanelProps) {
  const { theme, isDark } = useTheme();
  const searchInputRef = useRef<TextInput>(null);

  const currentRentalLabel =
    rentalFilterOptions.find((o) => o.id === rentalFilter)?.label || 'All Rental';
  const currentHealthLabel =
    healthFilterOptions.find((o) => o.id === healthFilter)?.label || 'All Health';
  const currentSupervisorLabel =
    supervisorFilterOptions.find((o) => o.id === supervisorFilter)?.label || 'All Supervisors';
  const currentClientLabel =
    clientFilterOptions.find((o) => o.id === clientFilter)?.label || 'All Clients';
  const currentSortLabel =
    sortOptions.find((o) => o.id === sortBy)?.label || 'Default Order';

  const healthVariant =
    healthFilter === 'spare'
      ? 'info'
      : healthFilter === 'breakdown'
      ? 'error'
      : healthFilter === 'under_maintenance'
      ? 'warning'
      : 'success';

  return (
    <View style={styles.filterToolbar}>
      {/* Top Search & Filter Action Row */}
      <View style={styles.toolbarTopRow}>
        <View style={styles.searchContainer}>
          <SearchInput
            ref={searchInputRef}
            placeholder="Search Machine ID, Model, Serial Number..."
            placeholderTextColor={theme.colors.mute}
            value={search}
            onChangeText={setSearch}
            onSubmitEditing={handleSearchSubmit}
            onClear={handleClearSearch}
            isLoading={isSearching}
            returnKeyType="search"
            autoCapitalize="none"
            autoCorrect={false}
          />
        </View>

        {/* Filter Sidebar Trigger Button */}
        <Pressable
          variant="buttonSecondary"
          haptic="select"
          hitSlopToMin48
          onPress={() => setFilterPanelOpen(true)}
          style={[
            styles.filterToggleBtn,
            {
              backgroundColor:
                filterPanelOpen || activeFilterCount > 0
                  ? isDark
                    ? 'rgba(2, 132, 199, 0.22)'
                    : '#e0f2fe'
                  : theme.colors.canvas,
              borderColor:
                filterPanelOpen || activeFilterCount > 0
                  ? isDark
                    ? '#38bdf8'
                    : '#0284c7'
                  : theme.colors.hairline,
            },
          ]}
          accessibilityRole="button"
          accessibilityLabel="Open filter sidebar"
        >
          <SlidersHorizontal
            size={14}
            color={
              filterPanelOpen || activeFilterCount > 0
                ? isDark
                  ? '#38bdf8'
                  : '#0284c7'
                : theme.colors.ink
            }
          />
          <Text
            variant="label"
            style={{
              color:
                filterPanelOpen || activeFilterCount > 0
                  ? isDark
                    ? '#38bdf8'
                    : '#0284c7'
                  : theme.colors.ink,
            }}
          >
            Filters
          </Text>
          {activeFilterCount > 0 && (
            <View
              style={[
                styles.activeCountBadge,
                {
                  backgroundColor: isDark ? '#38bdf8' : '#0284c7',
                },
              ]}
            >
              <Text
                variant="micro"
                style={{
                  color: '#ffffff',
                }}
              >
                {activeFilterCount}
              </Text>
            </View>
          )}
        </Pressable>

        {/* Quick Reset Filters Button */}
        {activeFilterCount > 0 && (
          <Pressable
            variant="buttonSecondary"
            haptic="select"
            hitSlopToMin48
            onPress={handleResetAllFilters}
            style={[
              styles.quickResetBtn,
              {
                backgroundColor: theme.colors.canvas,
                borderColor: theme.colors.hairline,
              },
            ]}
            accessibilityLabel="Reset all filters"
          >
            <RotateCcw size={13} color={theme.colors.mute} />
            <Text variant="caption" style={{ color: theme.colors.mute }}>
              Reset
            </Text>
          </Pressable>
        )}
      </View>

      {/* Horizontal Active Filter Chips Strip */}
      {activeFilterCount > 0 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.activeBadgesScrollContent}
          style={styles.activeBadgesScroll}
        >
          {debouncedSearch.trim() !== '' && (
            <Pressable
              variant="plain"
              haptic="select"
              hitSlopToMin48
              onPress={handleClearSearch}
              accessibilityRole="button"
              accessibilityLabel={`Remove search query ${debouncedSearch}`}
            >
              <Badge variant="outline" size="md">
                <View style={styles.filterBadgeContent}>
                  <Text variant="caption" style={{ color: theme.colors.ink }}>
                    Search: "{debouncedSearch}"
                  </Text>
                  <X size={12} color={theme.colors.mute} />
                </View>
              </Badge>
            </Pressable>
          )}

          {rentalFilter !== 'all' && (
            <Pressable
              variant="plain"
              haptic="select"
              hitSlopToMin48
              onPress={() => setRentalFilter('all')}
              accessibilityRole="button"
              accessibilityLabel={`Remove rental filter ${currentRentalLabel}`}
            >
              <Badge variant="info" size="md">
                <View style={styles.filterBadgeContent}>
                  <Text variant="caption" style={{ color: isDark ? '#38bdf8' : '#0284c7' }}>
                    Rental: {currentRentalLabel}
                  </Text>
                  <X size={12} color={isDark ? '#38bdf8' : '#0284c7'} />
                </View>
              </Badge>
            </Pressable>
          )}

          {healthFilter !== 'all' && (
            <Pressable
              variant="plain"
              haptic="select"
              hitSlopToMin48
              onPress={() => setHealthFilter('all')}
              accessibilityRole="button"
              accessibilityLabel={`Remove health filter ${currentHealthLabel}`}
            >
              <Badge variant={healthVariant} size="md">
                <View style={styles.filterBadgeContent}>
                  <Text
                    variant="caption"
                    style={{
                      color:
                        healthFilter === 'spare'
                          ? isDark ? '#38bdf8' : '#0284c7'
                          : healthFilter === 'breakdown'
                          ? isDark ? '#f87171' : '#dc2626'
                          : isDark ? '#fbbf24' : '#d97706',
                    }}
                  >
                    Health: {currentHealthLabel}
                  </Text>
                  <X
                    size={12}
                    color={
                      healthFilter === 'spare'
                        ? isDark ? '#38bdf8' : '#0284c7'
                        : healthFilter === 'breakdown'
                        ? isDark ? '#f87171' : '#dc2626'
                        : isDark ? '#fbbf24' : '#d97706'
                    }
                  />
                </View>
              </Badge>
            </Pressable>
          )}

          {supervisorFilter !== 'all' && (
            <Pressable
              variant="plain"
              haptic="select"
              hitSlopToMin48
              onPress={() => setSupervisorFilter('all')}
              accessibilityRole="button"
              accessibilityLabel={`Remove supervisor filter ${currentSupervisorLabel}`}
            >
              <Badge variant="outline" size="md">
                <View style={styles.filterBadgeContent}>
                  <Text variant="caption" style={{ color: theme.colors.ink }}>
                    Supervisor: {currentSupervisorLabel}
                  </Text>
                  <X size={12} color={theme.colors.mute} />
                </View>
              </Badge>
            </Pressable>
          )}

          {clientFilter !== 'all' && (
            <Pressable
              variant="plain"
              haptic="select"
              hitSlopToMin48
              onPress={() => setClientFilter('all')}
              accessibilityRole="button"
              accessibilityLabel={`Remove client filter ${currentClientLabel}`}
            >
              <Badge variant="outline" size="md">
                <View style={styles.filterBadgeContent}>
                  <Text variant="caption" style={{ color: theme.colors.ink }}>
                    Client: {currentClientLabel}
                  </Text>
                  <X size={12} color={theme.colors.mute} />
                </View>
              </Badge>
            </Pressable>
          )}

          {sortBy !== 'machine_id_asc' && (
            <Pressable
              variant="plain"
              haptic="select"
              hitSlopToMin48
              onPress={() => setSortBy('machine_id_asc')}
              accessibilityRole="button"
              accessibilityLabel={`Reset sort order ${currentSortLabel}`}
            >
              <Badge variant="outline" size="md">
                <View style={styles.filterBadgeContent}>
                  <Text variant="caption" style={{ color: theme.colors.ink }}>
                    Sort: {currentSortLabel}
                  </Text>
                  <X size={12} color={theme.colors.mute} />
                </View>
              </Badge>
            </Pressable>
          )}

          <Pressable
            variant="plain"
            hitSlopToMin48
            onPress={handleResetAllFilters}
            style={styles.resetAllLink}
            accessibilityRole="button"
            accessibilityLabel="Reset all active filters"
          >
            <RotateCcw size={11} color={theme.colors.link} />
            <Text variant="caption" style={{ color: theme.colors.link }}>
              Clear all
            </Text>
          </Pressable>
        </ScrollView>
      )}
    </View>
  );
});

const styles = StyleSheet.create({
  filterToolbar: {
    paddingVertical: spacingNumeric.xs,
    gap: 8,
  },
  toolbarTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  searchContainer: {
    flex: 1,
  },
  filterToggleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    minHeight: 44,
    borderRadius: radiusNumeric.md,
    borderWidth: 1,
  },
  activeCountBadge: {
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 999,
  },
  quickResetBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    minHeight: 44,
    borderRadius: radiusNumeric.md,
    borderWidth: 1,
  },
  activeBadgesScroll: {
    maxHeight: 38,
  },
  activeBadgesScrollContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 2,
  },
  filterBadgeContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  resetAllLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    minHeight: 32,
  },
});
