import React from 'react';
import { KPIGrid, KPICard } from '../ui';
import { useAuth } from '../../lib/auth/useAuth';

export interface MachineKPIStats {
  totalCount: number;
  availableCount: number;
  rentedCount: number;
  breakdownCount: number;
}

export interface MachineKPIStripProps {
  stats: MachineKPIStats;
  isLoading?: boolean;
}

export function MachineKPIStrip({
  stats,
  isLoading = false,
}: MachineKPIStripProps) {
  const { role } = useAuth();
  const isOperator = (role || '').toLowerCase() === 'operator';

  return (
    <KPIGrid columns={4}>
      <KPICard
        label={isOperator ? 'Assigned Fleet' : 'Total Fleet'}
        value={stats.totalCount}
        isLoading={isLoading}
        variant="default"
        labelVariant="micro"
        valueVariant="title"
      />
      <KPICard
        label="Available"
        value={stats.availableCount}
        isLoading={isLoading}
        variant="success"
        labelVariant="micro"
        valueVariant="title"
      />
      <KPICard
        label="On Rent"
        value={stats.rentedCount}
        isLoading={isLoading}
        variant="info"
        labelVariant="micro"
        valueVariant="title"
      />
      <KPICard
        label="Breakdown Events"
        value={stats.breakdownCount}
        isLoading={isLoading}
        variant={stats.breakdownCount > 0 ? 'error' : 'default'}
        labelVariant="micro"
        valueVariant="title"
      />
    </KPIGrid>
  );
}
