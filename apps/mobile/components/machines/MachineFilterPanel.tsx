import React, { useRef, useCallback } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  Platform,
  Dimensions,
  type TextInput,
} from 'react-native';
import {
  useTheme,
  Text,
  Badge,
  SearchInput,
  type FilterOption,
  type PopoverCoords,
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
  setFilterAnchorCoords?: (coords: PopoverCoords | null) => void;
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
  setFilterAnchorCoords,
}: MachineFilterPanelProps) {
  const { theme, isDark } = useTheme();
  const searchInputRef = useRef<TextInput>(null);
  const filterBtnRef = useRef<View>(null);

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

  const handleOpenFilterPopover = useCallback(() => {
    if (filterPanelOpen) {
      setFilterPanelOpen(false);
      return;
    }
    haptics.select();
    if (filterBtnRef.current && filterBtnRef.current.measureInWindow) {
      filterBtnRef.current.measureInWindow((x, y, width, height) => {
        const windowWidth =
          Platform.OS === 'web' && typeof window !== 'undefined'
            ? window.innerWidth
            : Dimensions.get('window').width;
        const windowHeight =
          Platform.OS === 'web' && typeof window !== 'undefined'
            ? window.innerHeight
            : Dimensions.get('window').height;

        const popoverWidth = Math.min(380, windowWidth - 24);
        const rightEdge = x + width;
        let left = rightEdge - popoverWidth;
        if (left < 12) left = 12;
        if (left + popoverWidth > windowWidth - 12) {
          left = Math.max(12, windowWidth - popoverWidth - 12);
        }
        const top = y + height + 6;
        const maxHeight = Math.max(280, Math.min(540, windowHeight - top - 20));

        setFilterAnchorCoords?.({ top, left, width: popoverWidth, maxHeight });
        setFilterPanelOpen(true);
      });
    } else {
      setFilterPanelOpen(true);
    }
  }, [filterPanelOpen, setFilterPanelOpen, setFilterAnchorCoords]);

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

        {/* Filter Trigger Button (Opens Popover Anchored Below Button) */}
        <Pressable
          ref={filterBtnRef}
          variant="buttonSecondary"
          haptic="select"
          hitSlopToMin48
          activeOpacity={1.0}
          onPress={handleOpenFilterPopover}
          style={[
            styles.filterToggleBtn,
            {
              backgroundColor:
                filterPanelOpen || activeFilterCount > 0
                  ? isDark
                    ? '#0ea5e9'
                    : '#0284c7'
                  : theme.colors.canvasElevated,
              borderColor:
                filterPanelOpen || activeFilterCount > 0
                  ? isDark
                    ? '#0ea5e9'
                    : '#0284c7'
                  : theme.colors.hairline,
              opacity: 1,
            },
          ]}
          accessibilityRole="button"
          accessibilityLabel="Open filter sidebar"
        >
          <SlidersHorizontal
            size={14}
            color={
              filterPanelOpen || activeFilterCount > 0
                ? '#ffffff'
                : theme.colors.ink
            }
          />
          <Text
            variant="label"
            style={{
              color:
                filterPanelOpen || activeFilterCount > 0
                  ? '#ffffff'
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
                  backgroundColor:
                    filterPanelOpen || activeFilterCount > 0
                      ? '#ffffff'
                      : isDark
                      ? '#0ea5e9'
                      : '#0284c7',
                  opacity: 1,
                },
              ]}
            >
              <Text
                variant="micro"
                style={{
                  color:
                    filterPanelOpen || activeFilterCount > 0
                      ? isDark
                        ? '#0ea5e9'
                        : '#0284c7'
                      : '#ffffff',
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
            activeOpacity={1.0}
            onPress={handleResetAllFilters}
            style={[
              styles.quickResetBtn,
              {
                backgroundColor: theme.colors.canvasElevated,
                borderColor: theme.colors.hairline,
                opacity: 1,
              },
            ]}
            accessibilityRole="button"
            accessibilityLabel="Reset all filters"
          >
            <RotateCcw size={13} color={theme.colors.ink} />
            <Text variant="caption" style={{ color: theme.colors.ink }}>
              Reset
            </Text>
          </Pressable>
        )}
      </View>

      {/* Horizontal Active Filter Chips Strip: 100% Solid Opacity & Dismissible */}
      {activeFilterCount > 0 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.activeBadgesScrollContent}
          style={styles.activeBadgesScroll}
        >
          {debouncedSearch.trim() !== '' && (
            <Badge
              variant="outline"
              size="md"
              label={`Search: "${debouncedSearch}"`}
              onRemove={handleClearSearch}
            />
          )}

          {rentalFilter !== 'all' && (
            <Badge
              variant="info"
              solid
              size="md"
              label={`Rental: ${currentRentalLabel}`}
              onRemove={() => setRentalFilter('all')}
            />
          )}

          {healthFilter !== 'all' && (
            <Badge
              variant={healthVariant}
              solid
              size="md"
              label={`Health: ${currentHealthLabel}`}
              onRemove={() => setHealthFilter('all')}
            />
          )}

          {supervisorFilter !== 'all' && (
            <Badge
              variant="outline"
              size="md"
              label={`Supervisor: ${currentSupervisorLabel}`}
              onRemove={() => setSupervisorFilter('all')}
            />
          )}

          {clientFilter !== 'all' && (
            <Badge
              variant="outline"
              size="md"
              label={`Client: ${currentClientLabel}`}
              onRemove={() => setClientFilter('all')}
            />
          )}

          {sortBy !== 'machine_id_asc' && (
            <Badge
              variant="outline"
              size="md"
              label={`Sort: ${currentSortLabel}`}
              onRemove={() => setSortBy('machine_id_asc')}
            />
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
    minWidth: 0,
  },
  filterToggleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    minHeight: 44,
    borderRadius: radiusNumeric.md,
    borderWidth: 1,
    flexShrink: 0,
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
    flexShrink: 0,
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
