/**
 * ReachInternational Mobile — Canonical Machine Filter Sidebar Component
 * 
 * Strict Invariants:
 * - Vercel Geist design tokens (#171717 ink, hairline borders, muted washes)
 * - 0 raw typography properties in StyleSheet.create (enforced via <Text variant="...">)
 * - Minimum 44px touch targets on action buttons (hitSlopToMin48, minHeight: 44)
 * - Category-wise grouping without icons in header or category titles
 * - 100% unified DropdownFilterSelector across all filter dimensions (Rental, Health, Client, Supervisor, Sort)
 * - Uses canonical reusable FilterSidebar & FilterCategoryCard (matches Operations page slide-out drawer)
 * - Tactile haptic feedback on filter changes and dismissals
 */

import React from 'react';
import {
  FilterSidebar,
  FilterCategoryCard,
  DropdownFilterSelector,
  type FilterOption,
  type PopoverCoords,
  Skeleton,
} from '../ui';
import { radiusNumeric } from '@reachinternational/design-tokens';

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

export interface MachineFilterSidebarProps {
  visible?: boolean;
  isOpen?: boolean;
  presentation?: 'drawer' | 'popover';
  anchorCoords?: PopoverCoords | null;
  onClose: () => void;
  activeFilterCount?: number;
  badgeCount?: number;
  totalFilteredCount: number;
  totalFleetCount?: number;
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
  isLoadingOptions?: boolean;
  onResetAllFilters?: () => void;
  onReset?: () => void;
}

export const MachineFilterSidebar: React.FC<MachineFilterSidebarProps> = React.memo(({
  visible,
  isOpen,
  presentation = 'drawer',
  anchorCoords,
  onClose,
  activeFilterCount,
  badgeCount,
  totalFilteredCount,
  totalFleetCount: _totalFleetCount,
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
  isLoadingOptions = false,
  onResetAllFilters,
  onReset,
}) => {
  const isDrawerOpen = visible !== undefined ? visible : Boolean(isOpen);
  const count = activeFilterCount !== undefined ? activeFilterCount : (badgeCount ?? 0);
  const resetHandler = onResetAllFilters || onReset;

  return (
    <FilterSidebar
      visible={isDrawerOpen}
      presentation={presentation}
      anchorCoords={anchorCoords}
      onClose={onClose}
      title="Filters & Sorting"
      activeFilterCount={count}
      onResetAll={resetHandler}
      applyText={`Show ${totalFilteredCount} ${totalFilteredCount === 1 ? 'Machine' : 'Machines'}`}
      onApply={onClose}
      testID="machine-filter-sidebar"
    >
      {/* 1. Rental Status */}
      <FilterCategoryCard
        title="Rental Status"
        isFiltered={rentalFilter !== 'all'}
        testID="category-rental-status"
      >
        <DropdownFilterSelector
          label="Rental Status"
          value={rentalFilter}
          selectedId={rentalFilter}
          options={rentalFilterOptions}
          onChange={(val) => setRentalFilter(val as RentalFilterType)}
          onSelect={(val) => setRentalFilter(val as RentalFilterType)}
          placeholder="Select Rental Status"
          minMenuWidth={280}
        />
      </FilterCategoryCard>

      {/* 2. Health Status */}
      <FilterCategoryCard
        title="Health Status"
        isFiltered={healthFilter !== 'all'}
        testID="category-health-status"
      >
        <DropdownFilterSelector
          label="Health Status"
          value={healthFilter}
          selectedId={healthFilter}
          options={healthFilterOptions}
          onChange={(val) => setHealthFilter(val as HealthFilterType)}
          onSelect={(val) => setHealthFilter(val as HealthFilterType)}
          placeholder="Select Health Status"
          minMenuWidth={280}
        />
      </FilterCategoryCard>

      {/* 3. Client Allocation */}
      <FilterCategoryCard
        title="Client Allocation"
        isFiltered={clientFilter !== 'all'}
        testID="category-client-allocation"
      >
        {isLoadingOptions ? (
          <Skeleton width="100%" height={44} borderRadius={radiusNumeric.md} />
        ) : (
          <DropdownFilterSelector
            label="Client Allocation"
            value={clientFilter}
            selectedId={clientFilter}
            options={clientFilterOptions}
            onChange={setClientFilter}
            onSelect={setClientFilter}
            searchable={clientFilterOptions.length > 5}
            showSearch={clientFilterOptions.length > 5}
            searchPlaceholder="Search clients..."
            placeholder="Select Client"
            minMenuWidth={280}
          />
        )}
      </FilterCategoryCard>

      {/* 4. Site Supervisor */}
      <FilterCategoryCard
        title="Site Supervisor"
        isFiltered={supervisorFilter !== 'all'}
        testID="category-site-supervisor"
      >
        {isLoadingOptions ? (
          <Skeleton width="100%" height={44} borderRadius={radiusNumeric.md} />
        ) : (
          <DropdownFilterSelector
            label="Site Supervisor"
            value={supervisorFilter}
            selectedId={supervisorFilter}
            options={supervisorFilterOptions}
            onChange={setSupervisorFilter}
            onSelect={setSupervisorFilter}
            searchable={supervisorFilterOptions.length > 5}
            showSearch={supervisorFilterOptions.length > 5}
            searchPlaceholder="Search supervisors..."
            placeholder="Select Supervisor"
            minMenuWidth={280}
          />
        )}
      </FilterCategoryCard>

      {/* 5. Sort By */}
      <FilterCategoryCard
        title="Sort By"
        isFiltered={sortBy !== 'machine_id_asc'}
        badgeLabel="Custom"
        testID="category-sorting-order"
      >
        <DropdownFilterSelector
          label="Sort By"
          value={sortBy}
          selectedId={sortBy}
          options={sortOptions}
          onChange={(val) => setSortBy(val as SortOptionType)}
          onSelect={(val) => setSortBy(val as SortOptionType)}
          placeholder="Select Sort"
          minMenuWidth={280}
        />
      </FilterCategoryCard>
    </FilterSidebar>
  );
});
