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
      onClose={onClose}
      title="Filters & Sorting"
      subtitle="Category-wise fleet equipment refinement"
      activeFilterCount={activeFilterCount}
      onResetAll={onResetAllFilters}
      applyText={`Show ${totalFilteredCount} ${totalFilteredCount === 1 ? 'Machine' : 'Machines'}`}
      onApply={onClose}
      testID="machine-filter-sidebar"
    >
      {/* Category 1: Rental Status */}
      <FilterCategoryCard
        index={1}
        title="RENTAL STATUS"
        subtitle="Filter equipment by rental availability status"
        isFiltered={rentalFilter !== 'all'}
        testID="category-rental-status"
      >
        <DropdownFilterSelector
          label="Rental"
          value={rentalFilter}
          options={rentalFilterOptions}
          onChange={(val) => setRentalFilter(val as RentalFilterType)}
          minMenuWidth={280}
        />
      </FilterCategoryCard>

      {/* Category 2: Health Status */}
      <FilterCategoryCard
        index={2}
        title="HEALTH STATUS"
        subtitle="Filter equipment by operational health condition"
        isFiltered={healthFilter !== 'all'}
        testID="category-health-status"
      >
        <DropdownFilterSelector
          label="Health"
          value={healthFilter}
          options={healthFilterOptions}
          onChange={(val) => setHealthFilter(val as HealthFilterType)}
          minMenuWidth={280}
        />
      </FilterCategoryCard>

      {/* Category 3: Client Allocation */}
      <FilterCategoryCard
        index={3}
        title="CLIENT ALLOCATION"
        subtitle="Filter equipment assigned to specific client locations"
        isFiltered={clientFilter !== 'all'}
        testID="category-client-allocation"
      >
        {isLoadingOptions ? (
          <Skeleton width="100%" height={44} borderRadius={radiusNumeric.md} />
        ) : (
          <DropdownFilterSelector
            label="Client"
            value={clientFilter}
            options={clientFilterOptions}
            onChange={setClientFilter}
            showSearch={true}
            minMenuWidth={280}
          />
        )}
      </FilterCategoryCard>

      {/* Category 4: Site Supervisor */}
      <FilterCategoryCard
        index={4}
        title="SITE SUPERVISOR"
        subtitle="Filter machinery overseen by supervising personnel"
        isFiltered={supervisorFilter !== 'all'}
        testID="category-site-supervisor"
      >
        {isLoadingOptions ? (
          <Skeleton width="100%" height={44} borderRadius={radiusNumeric.md} />
        ) : (
          <DropdownFilterSelector
            label="Supervisor"
            value={supervisorFilter}
            options={supervisorFilterOptions}
            onChange={setSupervisorFilter}
            showSearch={true}
            minMenuWidth={280}
          />
        )}
      </FilterCategoryCard>

      {/* Category 5: Sorting Order */}
      <FilterCategoryCard
        index={5}
        title="SORTING ORDER"
        subtitle="Order equipment by ID, model, manufacturing year, or meter"
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
