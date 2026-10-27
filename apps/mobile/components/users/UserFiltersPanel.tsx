/**
 * ReachInternational Mobile — Canonical User Filters Panel & Sidebar Component
 * 
 * Strict Invariants:
 * - Vercel Geist design tokens (#171717 ink, hairline borders, muted washes)
 * - 0 raw typography properties in StyleSheet.create (enforced via <Text variant="...">)
 * - Minimum 44px touch targets on action buttons (hitSlopToMin48, minHeight: 44)
 * - Uses canonical reusable FilterSidebar & FilterCategoryCard
 * - Clean top search row + horizontal active badges strip
 * - 100% unified DropdownFilterSelector across all dimensions
 * - Tactile haptic feedback on filter changes and dismissals
 */

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
  DropdownFilterSelector,
  FilterSidebar,
  FilterCategoryCard,
  type FilterOption,
} from '../ui';
import { Pressable } from '../ui/touch/Pressable';
import { SlidersHorizontal, RotateCcw, X } from '../ui/icon';
import { radiusNumeric, spacingNumeric } from '@reachinternational/design-tokens';
import { haptics } from '../../lib/haptics';

export interface UserFiltersPanelProps {
  search: string;
  setSearch: (text: string) => void;
  debouncedSearch: string;
  handleClearSearch: () => void;
  handleSearchSubmit: () => void;
  isSearching: boolean;
  roleFilter: string;
  setRoleFilter: (val: string) => void;
  statusFilter: string;
  setStatusFilter: (val: string) => void;
  stateFilter: string;
  setStateFilter: (val: string) => void;
  kycFilter: string;
  setKycFilter: (val: string) => void;
  dateRangeFilter: string;
  setDateRangeFilter: (val: string) => void;
  sortBy: string;
  setSortBy: (val: string) => void;
  activeFilterCount: number;
  handleResetAllFilters: () => void;
  filterPanelOpen: boolean;
  setFilterPanelOpen: (open: boolean | ((prev: boolean) => boolean)) => void;
  roleFilterOptions: FilterOption[];
  statusFilterOptions: FilterOption[];
  stateFilterOptions: FilterOption[];
  kycFilterOptions: FilterOption[];
  dateRangeFilterOptions: FilterOption[];
  sortFilterOptions: FilterOption[];
  totalUsersCount?: number;
}

export const UserFiltersPanel = React.memo(function UserFiltersPanel({
  search,
  setSearch,
  debouncedSearch,
  handleClearSearch,
  handleSearchSubmit,
  isSearching,
  roleFilter,
  setRoleFilter,
  statusFilter,
  setStatusFilter,
  stateFilter,
  setStateFilter,
  kycFilter,
  setKycFilter,
  dateRangeFilter,
  setDateRangeFilter,
  sortBy,
  setSortBy,
  activeFilterCount,
  handleResetAllFilters,
  filterPanelOpen,
  setFilterPanelOpen,
  roleFilterOptions,
  statusFilterOptions,
  stateFilterOptions,
  kycFilterOptions,
  dateRangeFilterOptions,
  sortFilterOptions,
  totalUsersCount,
}: UserFiltersPanelProps) {
  const { theme, isDark } = useTheme();
  const searchInputRef = useRef<TextInput>(null);

  const currentRoleLabel =
    roleFilterOptions.find((o) => o.id === roleFilter)?.label || 'All Roles';
  const currentStatusLabel =
    statusFilterOptions.find((o) => o.id === statusFilter)?.label || 'All Status';
  const currentStateLabel =
    stateFilterOptions.find((o) => o.id === stateFilter)?.label || 'All States';
  const currentKycLabel =
    kycFilterOptions.find((o) => o.id === kycFilter)?.label || 'All KYC';
  const currentJoinedLabel =
    dateRangeFilterOptions.find((o) => o.id === dateRangeFilter)?.label || 'All Time';
  const currentSortLabel =
    sortFilterOptions.find((o) => o.id === sortBy)?.label || 'Newest First';

  return (
    <View style={styles.filterToolbar}>
      {/* Top Search & Filter Action Row */}
      <View style={styles.toolbarTopRow}>
        <View style={styles.searchContainer}>
          <SearchInput
            ref={searchInputRef}
            placeholder="Search staff by name, email, phone, city..."
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

        {/* Filter Drawer Trigger Button */}
        <Pressable
          variant="buttonSecondary"
          haptic="select"
          hitSlopToMin48
          activeOpacity={1.0}
          onPress={() => setFilterPanelOpen(true)}
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
            variant="caption"
            weight="semibold"
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
                weight="bold"
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
            <Text variant="caption" weight="semibold" style={{ color: theme.colors.ink }}>
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
              variant="chip"
              haptic="select"
              hitSlopToMin48
              activeOpacity={1.0}
              onPress={handleClearSearch}
              accessibilityRole="button"
              accessibilityLabel={`Remove search query ${debouncedSearch}`}
            >
              <Badge variant="outline" size="md">
                <View style={styles.filterBadgeContent}>
                  <Text variant="caption" weight="medium" style={{ color: theme.colors.ink }}>
                    Search: "{debouncedSearch}"
                  </Text>
                  <X size={12} color={theme.colors.mute} />
                </View>
              </Badge>
            </Pressable>
          )}

          {roleFilter !== 'all' && (
            <Pressable
              variant="chip"
              haptic="select"
              hitSlopToMin48
              activeOpacity={1.0}
              onPress={() => setRoleFilter('all')}
              accessibilityRole="button"
              accessibilityLabel={`Remove role filter ${currentRoleLabel}`}
            >
              <Badge variant="info" size="md">
                <View style={styles.filterBadgeContent}>
                  <Text variant="caption" weight="medium" style={{ color: isDark ? '#bfdbfe' : '#1d4ed8' }}>
                    Role: {currentRoleLabel}
                  </Text>
                  <X size={12} color={isDark ? '#bfdbfe' : '#1d4ed8'} />
                </View>
              </Badge>
            </Pressable>
          )}

          {statusFilter !== 'all' && (
            <Pressable
              variant="chip"
              haptic="select"
              hitSlopToMin48
              activeOpacity={1.0}
              onPress={() => setStatusFilter('all')}
              accessibilityRole="button"
              accessibilityLabel={`Remove status filter ${currentStatusLabel}`}
            >
              <Badge
                variant={statusFilter === 'active' ? 'success' : statusFilter === 'suspended' ? 'error' : 'warning'}
                size="md"
              >
                <View style={styles.filterBadgeContent}>
                  <Text
                    variant="caption"
                    weight="medium"
                    style={{
                      color:
                        statusFilter === 'active'
                          ? isDark ? '#a7f3d0' : '#065f46'
                          : statusFilter === 'suspended'
                          ? isDark ? '#fca5a5' : '#b91c1c'
                          : isDark ? '#fde68a' : '#b45309',
                    }}
                  >
                    Status: {currentStatusLabel}
                  </Text>
                  <X
                    size={12}
                    color={
                      statusFilter === 'active'
                        ? isDark ? '#a7f3d0' : '#065f46'
                        : statusFilter === 'suspended'
                        ? isDark ? '#fca5a5' : '#b91c1c'
                        : isDark ? '#fde68a' : '#b45309'
                    }
                  />
                </View>
              </Badge>
            </Pressable>
          )}

          {stateFilter !== 'all' && (
            <Pressable
              variant="chip"
              haptic="select"
              hitSlopToMin48
              activeOpacity={1.0}
              onPress={() => setStateFilter('all')}
              accessibilityRole="button"
              accessibilityLabel={`Remove state filter ${currentStateLabel}`}
            >
              <Badge variant="outline" size="md">
                <View style={styles.filterBadgeContent}>
                  <Text variant="caption" weight="medium" style={{ color: theme.colors.ink }}>
                    State: {currentStateLabel}
                  </Text>
                  <X size={12} color={theme.colors.mute} />
                </View>
              </Badge>
            </Pressable>
          )}

          {kycFilter !== 'all' && (
            <Pressable
              variant="chip"
              haptic="select"
              hitSlopToMin48
              activeOpacity={1.0}
              onPress={() => setKycFilter('all')}
              accessibilityRole="button"
              accessibilityLabel={`Remove KYC filter ${currentKycLabel}`}
            >
              <Badge variant="outline" size="md">
                <View style={styles.filterBadgeContent}>
                  <Text variant="caption" weight="medium" style={{ color: theme.colors.ink }}>
                    KYC: {currentKycLabel}
                  </Text>
                  <X size={12} color={theme.colors.mute} />
                </View>
              </Badge>
            </Pressable>
          )}

          {dateRangeFilter !== 'all' && (
            <Pressable
              variant="chip"
              haptic="select"
              hitSlopToMin48
              activeOpacity={1.0}
              onPress={() => setDateRangeFilter('all')}
              accessibilityRole="button"
              accessibilityLabel={`Remove timeline filter ${currentJoinedLabel}`}
            >
              <Badge variant="outline" size="md">
                <View style={styles.filterBadgeContent}>
                  <Text variant="caption" weight="medium" style={{ color: theme.colors.ink }}>
                    Joined: {currentJoinedLabel}
                  </Text>
                  <X size={12} color={theme.colors.mute} />
                </View>
              </Badge>
            </Pressable>
          )}

          {sortBy !== 'newest' && (
            <Pressable
              variant="chip"
              haptic="select"
              hitSlopToMin48
              activeOpacity={1.0}
              onPress={() => setSortBy('newest')}
              accessibilityRole="button"
              accessibilityLabel={`Reset sorting order ${currentSortLabel}`}
            >
              <Badge variant="outline" size="md">
                <View style={styles.filterBadgeContent}>
                  <Text variant="caption" weight="medium" style={{ color: theme.colors.ink }}>
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
            <Text variant="caption" weight="semibold" style={{ color: theme.colors.link }}>
              Clear all
            </Text>
          </Pressable>
        </ScrollView>
      )}

      {/* Reusable Filter Sidebar Drawer */}
      <FilterSidebar
        visible={filterPanelOpen}
        onClose={() => setFilterPanelOpen(false)}
        title="Filters & Sorting"
        activeFilterCount={activeFilterCount}
        onResetAll={handleResetAllFilters}
        applyText={
          totalUsersCount !== undefined
            ? `Show ${totalUsersCount} ${totalUsersCount === 1 ? 'Staff Member' : 'Staff Members'}`
            : 'Apply Filters'
        }
        onApply={() => setFilterPanelOpen(false)}
        testID="user-filter-sidebar"
      >
        {/* Category 1: Role */}
        <FilterCategoryCard
          title="Organizational Role"
          isFiltered={roleFilter !== 'all'}
          testID="category-user-role"
        >
          <DropdownFilterSelector
            label="Role"
            value={roleFilter}
            options={roleFilterOptions}
            onChange={setRoleFilter}
            minMenuWidth={280}
          />
        </FilterCategoryCard>

        {/* Category 2: Status */}
        <FilterCategoryCard
          title="Employment Status"
          isFiltered={statusFilter !== 'all'}
          testID="category-user-status"
        >
          <DropdownFilterSelector
            label="Status"
            value={statusFilter}
            options={statusFilterOptions}
            onChange={setStatusFilter}
            minMenuWidth={280}
          />
        </FilterCategoryCard>

        {/* Category 3: State Allocation */}
        <FilterCategoryCard
          title="State Allocation"
          isFiltered={stateFilter !== 'all'}
          testID="category-user-state"
        >
          <DropdownFilterSelector
            label="State"
            value={stateFilter}
            options={stateFilterOptions}
            onChange={setStateFilter}
            showSearch={true}
            minMenuWidth={280}
          />
        </FilterCategoryCard>

        {/* Category 4: KYC Verification */}
        <FilterCategoryCard
          title="KYC Verification"
          isFiltered={kycFilter !== 'all'}
          testID="category-user-kyc"
        >
          <DropdownFilterSelector
            label="KYC"
            value={kycFilter}
            options={kycFilterOptions}
            onChange={setKycFilter}
            minMenuWidth={280}
          />
        </FilterCategoryCard>

        {/* Category 5: Joined Timeline */}
        <FilterCategoryCard
          title="Joined Timeline"
          isFiltered={dateRangeFilter !== 'all'}
          testID="category-user-joined"
        >
          <DropdownFilterSelector
            label="Joined"
            value={dateRangeFilter}
            options={dateRangeFilterOptions}
            onChange={setDateRangeFilter}
            minMenuWidth={280}
          />
        </FilterCategoryCard>

        {/* Category 6: Sorting Order */}
        <FilterCategoryCard
          title="Sort By"
          isFiltered={sortBy !== 'newest'}
          badgeLabel="Custom"
          testID="category-user-sorting"
        >
          <DropdownFilterSelector
            label="Sort By"
            value={sortBy}
            options={sortFilterOptions}
            onChange={setSortBy}
            minMenuWidth={280}
          />
        </FilterCategoryCard>
      </FilterSidebar>
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
