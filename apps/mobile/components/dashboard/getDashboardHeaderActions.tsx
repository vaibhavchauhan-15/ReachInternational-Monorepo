import { useRouter } from 'expo-router';

type Router = ReturnType<typeof useRouter>;
import type { HeaderActionItem } from '../ui';
import {
  RefreshCw,
  FileSpreadsheet,
  Wrench,
  CalendarCheck,
  Clock,
  Users,
  Building2,
  Settings,
  Sun,
  Moon,
} from '../ui/icon';

export interface DashboardHeaderActionsOptions {
  activeRole: string;
  refreshing: boolean;
  onRefresh: () => void;
  router: Router;
  isDark: boolean;
  setMode: (mode: 'light' | 'dark' | 'system') => void;
  inkColor: string;
}

export function getDashboardHeaderActions({
  activeRole,
  refreshing,
  onRefresh,
  router,
  isDark,
  setMode,
  inkColor,
}: DashboardHeaderActionsOptions): HeaderActionItem[] {
  const actions: HeaderActionItem[] = [
    {
      id: 'refresh-data',
      label: refreshing ? 'Refreshing...' : 'Refresh Dashboard',
      icon: <RefreshCw size={15} color={inkColor} />,
      onPress: onRefresh,
      disabled: refreshing,
    },
  ];

  // Role-specific operational shortcuts
  switch (activeRole) {
    case 'supervisor':
      actions.push(
        {
          id: 'op-logs',
          label: 'Review Shift Logs',
          icon: <FileSpreadsheet size={15} color={inkColor} />,
          onPress: () => router.push('/operations'),
        },
        {
          id: 'op-fleet',
          label: 'Supervised Machinery',
          icon: <Wrench size={15} color={inkColor} />,
          onPress: () => router.push('/machines'),
        },
        {
          id: 'op-attendance',
          label: 'Shift Attendance',
          icon: <CalendarCheck size={15} color={inkColor} />,
          onPress: () => router.push('/attendance'),
        }
      );
      break;

    case 'operator':
      actions.push(
        {
          id: 'op-entry',
          label: 'Record Running Hours',
          icon: <FileSpreadsheet size={15} color={inkColor} />,
          onPress: () => router.push('/operations'),
        },
        {
          id: 'op-machine',
          label: 'Assigned Equipment',
          icon: <Wrench size={15} color={inkColor} />,
          onPress: () => router.push('/machines'),
        },
        {
          id: 'op-history',
          label: 'Shift History & Logs',
          icon: <Clock size={15} color={inkColor} />,
          onPress: () => router.push('/operations'),
        },
        {
          id: 'op-attendance',
          label: 'My Attendance',
          icon: <CalendarCheck size={15} color={inkColor} />,
          onPress: () => router.push('/attendance'),
        }
      );
      break;

    case 'manager':
      actions.push(
        {
          id: 'mgr-ops',
          label: 'Operations Review',
          icon: <FileSpreadsheet size={15} color={inkColor} />,
          onPress: () => router.push('/operations'),
        },
        {
          id: 'mgr-fleet',
          label: 'Fleet Utilization',
          icon: <Wrench size={15} color={inkColor} />,
          onPress: () => router.push('/machines'),
        },
        {
          id: 'mgr-attendance',
          label: 'Attendance Roster',
          icon: <CalendarCheck size={15} color={inkColor} />,
          onPress: () => router.push('/attendance'),
        },
        {
          id: 'mgr-payroll',
          label: 'Running Hours & Payroll',
          icon: <Clock size={15} color={inkColor} />,
          onPress: () => router.push('/payroll'),
        }
      );
      break;

    case 'admin':
      actions.push(
        {
          id: 'adm-ops',
          label: 'Operations & Running Logs',
          icon: <FileSpreadsheet size={15} color={inkColor} />,
          onPress: () => router.push('/operations'),
        },
        {
          id: 'adm-fleet',
          label: 'Machinery Fleet',
          icon: <Wrench size={15} color={inkColor} />,
          onPress: () => router.push('/machines'),
        },
        {
          id: 'adm-users',
          label: 'Personnel & Directory',
          icon: <Users size={15} color={inkColor} />,
          onPress: () => router.push('/users'),
        },
        {
          id: 'adm-clients',
          label: 'Client Worksites',
          icon: <Building2 size={15} color={inkColor} />,
          onPress: () => router.push('/clients'),
        }
      );
      break;

    case 'super_admin':
      actions.push(
        {
          id: 'sa-fleet',
          label: 'Machinery Fleet Matrix',
          icon: <Wrench size={15} color={inkColor} />,
          onPress: () => router.push('/machines'),
        },
        {
          id: 'sa-users',
          label: 'User Directory & Access',
          icon: <Users size={15} color={inkColor} />,
          onPress: () => router.push('/users'),
        },
        {
          id: 'sa-clients',
          label: 'Client Directory',
          icon: <Building2 size={15} color={inkColor} />,
          onPress: () => router.push('/clients'),
        }
      );
      break;

    case 'hr':
      actions.push(
        {
          id: 'hr-staff',
          label: 'Employee Directory',
          icon: <Users size={15} color={inkColor} />,
          onPress: () => router.push('/users'),
        },
        {
          id: 'hr-attendance',
          label: 'Attendance Records',
          icon: <CalendarCheck size={15} color={inkColor} />,
          onPress: () => router.push('/attendance'),
        },
        {
          id: 'hr-payroll',
          label: 'Payroll Overview',
          icon: <Clock size={15} color={inkColor} />,
          onPress: () => router.push('/payroll'),
        }
      );
      break;
  }

  // Common system shortcuts
  actions.push(
    {
      id: 'app-settings',
      label: 'Settings & Preferences',
      icon: <Settings size={15} color={inkColor} />,
      onPress: () => router.push('/settings' as any),
    },
    {
      id: 'theme-toggle',
      label: isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode',
      icon: isDark ? (
        <Sun size={15} color={inkColor} />
      ) : (
        <Moon size={15} color={inkColor} />
      ),
      onPress: () => setMode(isDark ? 'light' : 'dark'),
    }
  );

  return actions;
}
