import React from 'react';
import { KPIGrid, KPICard } from '../ui';
import { Wrench, CheckCircle2, Building2, AlertTriangle } from '../ui/icon';
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
        icon={Wrench}
        variant="default"
        labelVariant="micro"
        valueVariant="title"
      />
      <KPICard
        label="Available"
        value={stats.availableCount}
        isLoading={isLoading}
        icon={CheckCircle2}
        variant="success"
        labelVariant="micro"
        valueVariant="title"
      />
      <KPICard
        label="On Rent"
        value={stats.rentedCount}
        isLoading={isLoading}
        icon={Building2}
        variant="info"
        labelVariant="micro"
        valueVariant="title"
      />
      <KPICard
        label="Breakdown Events"
        value={stats.breakdownCount}
        isLoading={isLoading}
        icon={AlertTriangle}
        variant={stats.breakdownCount > 0 ? 'error' : 'default'}
        labelVariant="micro"
        valueVariant="title"
      />
    </KPIGrid>
  );
}
