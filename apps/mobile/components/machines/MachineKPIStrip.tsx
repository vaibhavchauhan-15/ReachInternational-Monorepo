import React from 'react';
import { KPIGrid, KPICard } from '../ui';

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

export function MachineKPIStrip({ stats, isLoading = false }: MachineKPIStripProps) {
  return (
    <KPIGrid columns={2}>
      <KPICard
        label="ASSIGNED FLEET"
        value={stats.totalCount}
        isLoading={isLoading}
        variant="default"
      />
      <KPICard
        label="AVAILABLE"
        value={stats.availableCount}
        isLoading={isLoading}
        variant="success"
      />
      <KPICard
        label="ON RENT"
        value={stats.rentedCount}
        isLoading={isLoading}
        variant="info"
      />
      <KPICard
        label="BREAKDOWN EVENTS"
        value={stats.breakdownCount}
        isLoading={isLoading}
        variant={stats.breakdownCount > 0 ? 'error' : 'default'}
      />
    </KPIGrid>
  );
}
