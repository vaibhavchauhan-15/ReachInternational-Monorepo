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
      { label: 'Directory', tab: 'inventory', icon: Wrench },
    ],
  },
  {
    href: '/(app)/operations',
    label: 'Operations',
    icon: Gauge,
    roles: ['super_admin', 'admin', 'manager', 'service_manager', 'supervisor', 'operator'],
    subItems: [
      { label: 'Running Hours', tab: 'logs', icon: Gauge },
      { label: 'Assignments', tab: 'assignments', icon: Star },
    ],
  },
  {
    href: '/(app)/clients',
    label: 'Clients',
    icon: Building2,
    roles: ['super_admin', 'admin', 'manager', 'service_manager'],
    subItems: [
      { label: 'Client Directory', tab: 'all', icon: Building2 },
    ],
  },
  {
    href: '/(app)/users',
    label: 'Employees & Users',
    icon: Users,
    roles: ['super_admin', 'admin', 'manager', 'service_manager', 'hr_manager'],
    subItems: [
      { label: 'All Accounts', tab: 'all', icon: Users },
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
              { label: 'Daily Entry', tab: 'entry', icon: Gauge },
              { label: 'Log History', tab: 'history', icon: Clock },
            ],
          };
        }
        return {
          ...item,
          subItems: [
            { label: 'Running Hours', tab: 'logs', icon: Gauge },
            { label: 'Assignments', tab: 'assignments', icon: Star },
          ],
        };
      }
      return item;
    });
}
