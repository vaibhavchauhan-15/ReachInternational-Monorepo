/**
 * ReachInternational Mobile — Canonical Machine Filter Sidebar Component
 * 
 * Strict Invariants:
 * - Vercel Geist design tokens (#171717 ink, hairline borders, muted washes)
 * - 0 raw typography properties in StyleSheet.create (enforced via <Text variant="...">)
 * - Minimum 44px touch targets on action buttons (hitSlopToMin48, minHeight: 44)
 * - Category-wise grouping without icons in header or category titles
 * - 100% unified DropdownFilterSelector across all filter dimensions (Rental, Health, Client, Supervisor, Sort)
 * - Uses canonical reusable FilterSidebar & FilterCategoryCard
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
  visible: boolean;
  presentation?: 'drawer' | 'popover';
  anchorCoords?: PopoverCoords | null;
  onClose: () => void;
  activeFilterCount: number;
  totalFilteredCount: number;
  totalFleetCount: number;
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
  onResetAllFilters: () => void;
}

export const MachineFilterSidebar: React.FC<MachineFilterSidebarProps> = React.memo(({
  visible,
  presentation = 'popover',
  anchorCoords,
  onClose,
  activeFilterCount,
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
}) => {
  return (
    <FilterSidebar
      visible={visible}
      presentation={presentation}
      anchorCoords={anchorCoords}
      onClose={onClose}
      title="Filters & Sorting"
      activeFilterCount={activeFilterCount}
      onResetAll={onResetAllFilters}
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
          options={rentalFilterOptions}
          onChange={(val) => setRentalFilter(val as RentalFilterType)}
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
          options={healthFilterOptions}
          onChange={(val) => setHealthFilter(val as HealthFilterType)}
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
            options={clientFilterOptions}
            onChange={setClientFilter}
            showSearch={true}
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
            options={supervisorFilterOptions}
            onChange={setSupervisorFilter}
            showSearch={true}
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
          options={sortOptions}
          onChange={(val) => setSortBy(val as SortOptionType)}
          minMenuWidth={280}
        />
      </FilterCategoryCard>
    </FilterSidebar>
  );
});
