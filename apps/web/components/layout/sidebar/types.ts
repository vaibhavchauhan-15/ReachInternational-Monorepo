import type { User, UserRole } from "@/lib/types/database";

export interface SubNavItem {
  label: string;
  tab: string;
  icon: React.ComponentType<{ className?: string }>;
  roles?: UserRole[];
}

export interface NavItem {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  roles?: UserRole[];
  badge?: string | number;
  subItems?: SubNavItem[];
}

export interface AppSidebarProps {
  user: User;
  collapsed: boolean;
  onToggleCollapse: () => void;
}
