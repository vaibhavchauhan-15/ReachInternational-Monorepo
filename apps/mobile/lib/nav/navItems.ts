import {
  Wrench,
  Gauge,
  Star,
  Building2,
  Users,
  Clock,
  LucideIcon,
} from 'lucide-react-native';

export interface MobileSubItem {
  label: string;
  tab: string;
  icon?: LucideIcon;
}

export interface MobileNavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  roles?: string[];
  subItems?: MobileSubItem[];
}

export const mobileNavItems: MobileNavItem[] = [
  {
    href: '/(app)/machines',
    label: 'Machines',
    icon: Wrench,
    roles: [
      'super_admin', 'admin', 'manager', 'service_manager', 'service_engineer', 'engineer',
      'supervisor', 'mechanic', 'store_manager'
    ],
    subItems: [
      { label: 'Directory', tab: 'inventory' },
    ],
  },
  {
    href: '/(app)/operations',
    label: 'Operations',
    icon: Gauge,
    roles: ['super_admin', 'admin', 'manager', 'service_manager', 'supervisor', 'operator'],
    subItems: [
      { label: 'Running Hours', tab: 'logs' },
      { label: 'Assignments', tab: 'assignments' },
    ],
  },
  {
    href: '/(app)/clients',
    label: 'Clients',
    icon: Building2,
    roles: ['super_admin', 'admin', 'manager', 'service_manager'],
    subItems: [
      { label: 'Client Directory', tab: 'all' },
    ],
  },
  {
    href: '/(app)/users',
    label: 'Employees & Users',
    icon: Users,
    roles: ['super_admin', 'admin', 'manager', 'service_manager', 'hr_manager'],
    subItems: [
      { label: 'All Accounts', tab: 'all' },
    ],
  },
];

export function getVisibleMobileNavItems(role?: string): MobileNavItem[] {
  if (!role) return mobileNavItems;
  const normalizedRole = role.toLowerCase();
  return mobileNavItems
    .filter((item) => !item.roles || item.roles.includes(role) || item.roles.includes(normalizedRole))
    .map((item) => {
      if (item.href === '/(app)/operations') {
        if (normalizedRole === 'operator') {
          return {
            ...item,
            subItems: [
              { label: 'Daily Entry', tab: 'entry' },
              { label: 'Log History', tab: 'history' },
            ],
          };
        }
        return {
          ...item,
          subItems: [
            { label: 'Running Hours', tab: 'logs' },
            { label: 'Assignments', tab: 'assignments' },
          ],
        };
      }
      return item;
    });
}
