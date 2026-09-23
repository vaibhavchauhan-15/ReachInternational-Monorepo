import {
  Home,
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
    href: '/(app)/dashboard',
    label: 'Home',
    icon: Home,
    roles: ['super_admin', 'admin', 'manager', 'supervisor', 'hr', 'operator'],
  },
  {
    href: '/(app)/machines',
    label: 'Machines',
    icon: Wrench,
    roles: ['super_admin', 'admin', 'manager', 'supervisor', 'operator'],
  },
  {
    href: '/(app)/operations',
    label: 'Operations',
    icon: Gauge,
    roles: ['super_admin', 'admin', 'manager', 'supervisor', 'operator'],
  },
  {
    href: '/(app)/clients',
    label: 'Clients',
    icon: Building2,
    roles: ['super_admin', 'admin', 'manager'],
  },
  {
    href: '/(app)/users',
    label: 'Employees & Users',
    icon: Users,
    roles: ['super_admin', 'admin', 'manager', 'hr', 'supervisor'],
  },
];

export function getVisibleMobileNavItems(role?: string): MobileNavItem[] {
  if (!role) return mobileNavItems;
  const normalizedRole = role.toLowerCase();
  return mobileNavItems.filter(
    (item) => !item.roles || item.roles.includes(role) || item.roles.includes(normalizedRole)
  );
}
