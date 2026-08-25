/**
 * ServiceCentric Mobile — Navigation Registry & RBAC Rules
 * Fully aligned with apps/web/components/layout/AppSidebar.tsx.
 */

import {
  LayoutDashboard,
  Star,
  Users,
  Wrench,
  ClipboardList,
  Package,
  Building2,
  ShoppingBag,
  FileText,
  BarChart3,
  Settings,
  Bell,
  AlertTriangle,
  Gauge,
  RefreshCw,
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
    label: 'Dashboard',
    icon: LayoutDashboard,
    roles: [
      'super_admin', 'admin', 'service_manager', 'service_engineer', 'engineer',
      'supervisor', 'store_manager', 'operator', 'mechanic',
      'hr_manager', 'finance_manager', 'sales_executive', 'rental_manager'
    ],
  },
  {
    href: '/(app)/my-work',
    label: 'My Work',
    icon: Star,
    roles: [
      'super_admin', 'admin', 'service_manager', 'service_engineer', 'engineer',
      'supervisor', 'store_manager', 'mechanic',
      'hr_manager', 'finance_manager', 'sales_executive', 'rental_manager'
    ],
  },
  {
    href: '/(app)/tasks',
    label: 'To-Do / Tasks',
    icon: ClipboardList,
    roles: [
      'super_admin', 'admin', 'service_manager', 'service_engineer', 'engineer',
      'supervisor', 'store_manager', 'mechanic',
      'hr_manager', 'finance_manager', 'sales_executive', 'rental_manager'
    ],
  },
  {
    href: '/(app)/rentals',
    label: 'Rentals',
    icon: Building2,
    roles: ['super_admin', 'admin', 'rental_manager', 'sales_executive', 'finance_manager'],
    subItems: [
      { label: 'Dashboard', tab: 'dashboard', icon: LayoutDashboard },
      { label: 'Requests', tab: 'requests', icon: ClipboardList },
      { label: 'Customers', tab: 'customers', icon: Users },
      { label: 'Agreements', tab: 'agreements', icon: FileText },
      { label: 'Challans', tab: 'challans', icon: Package },
      { label: 'Returns', tab: 'returns', icon: RefreshCw },
      { label: 'Damage', tab: 'damage', icon: AlertTriangle },
      { label: 'Billing', tab: 'billing', icon: BarChart3 },
    ],
  },
  {
    href: '/(app)/crm',
    label: 'CRM',
    icon: Users,
    roles: ['super_admin', 'admin', 'sales_executive', 'rental_manager'],
    subItems: [
      { label: 'Dashboard', tab: 'dashboard', icon: LayoutDashboard },
      { label: 'Leads', tab: 'leads', icon: ClipboardList },
      { label: 'Customers', tab: 'customers', icon: Users },
      { label: 'Interactions', tab: 'interactions', icon: Bell },
      { label: 'Opportunities', tab: 'opportunities', icon: Star },
      { label: 'Quotations', tab: 'quotations', icon: FileText },
      { label: 'Orders', tab: 'orders', icon: ShoppingBag },
      { label: 'Machine Sales', tab: 'machine-sales', icon: Wrench },
      { label: 'Handover', tab: 'deliveries', icon: Package },
      { label: 'Escalations', tab: 'service-requests', icon: AlertTriangle },
      { label: 'Settings', tab: 'settings', icon: Settings },
    ],
  },
  {
    href: '/(app)/machines',
    label: 'Machines',
    icon: Wrench,
    roles: [
      'super_admin', 'admin', 'service_manager', 'service_engineer', 'engineer',
      'supervisor', 'mechanic', 'store_manager', 'sales_executive', 'rental_manager', 'finance_manager'
    ],
    subItems: [
      { label: 'Directory', tab: 'inventory', icon: Wrench },
      { label: 'Service Logs', tab: 'services', icon: ClipboardList },
      { label: 'Complaints', tab: 'complaints', icon: AlertTriangle },
    ],
  },
  {
    href: '/(app)/operations',
    label: 'Operations',
    icon: Gauge,
    roles: ['super_admin', 'admin', 'service_manager', 'supervisor'],
    subItems: [
      { label: 'Daily Hours', tab: 'logs', icon: Gauge },
      { label: 'Assignments', tab: 'assignments', icon: Star },
      { label: 'Site Movement', tab: 'site-movement', icon: Package },
      { label: 'Operators', tab: 'operators', icon: Users },
    ],
  },
  {
    href: '/(app)/service',
    label: 'Service',
    icon: ClipboardList,
    roles: [
      'super_admin', 'admin', 'service_manager', 'service_engineer', 'engineer',
      'supervisor', 'mechanic', 'rental_manager'
    ],
    subItems: [
      { label: 'Dashboard', tab: 'dashboard', icon: LayoutDashboard },
      { label: 'Complaints', tab: 'complaints', icon: AlertTriangle },
      { label: 'Schedule', tab: 'schedule', icon: ClipboardList },
      { label: 'FSR Reports', tab: 'reports', icon: FileText },
    ],
  },
  {
    href: '/(app)/inventory',
    label: 'Inventory',
    icon: Package,
    roles: ['super_admin', 'admin', 'service_manager', 'store_manager', 'service_engineer', 'engineer', 'mechanic', 'finance_manager', 'rental_manager'],
    subItems: [
      { label: 'Dashboard', tab: 'dashboard', icon: LayoutDashboard },
      { label: 'Part Master', tab: 'master', icon: Package },
      { label: 'Storage', tab: 'locations', icon: Building2 },
      { label: 'Procurement', tab: 'procurement', icon: ShoppingBag },
      { label: 'GRN', tab: 'grn', icon: FileText },
      { label: 'Issues', tab: 'issues', icon: Wrench },
      { label: 'Returns', tab: 'returns', icon: ClipboardList },
      { label: 'Ledger', tab: 'transactions', icon: BarChart3 },
      { label: 'Transfers', tab: 'transfers', icon: RefreshCw },
    ],
  },
  {
    href: '/(app)/vendors',
    label: 'Vendors',
    icon: Building2,
    roles: ['super_admin', 'admin', 'store_manager', 'finance_manager'],
    subItems: [
      { label: 'Directory', tab: 'directory', icon: Building2 },
      { label: 'Performance', tab: 'performance', icon: BarChart3 },
    ],
  },
  {
    href: '/(app)/purchase-orders',
    label: 'Purchase Orders',
    icon: ShoppingBag,
    roles: ['super_admin', 'admin', 'store_manager', 'finance_manager'],
    subItems: [
      { label: 'All POs', tab: 'all', icon: ShoppingBag },
      { label: 'Approvals', tab: 'approvals', icon: AlertTriangle },
      { label: 'Create PO', tab: 'create', icon: FileText },
    ],
  },
  {
    href: '/(app)/challans',
    label: 'Challans',
    icon: Package,
    roles: ['super_admin', 'admin', 'store_manager', 'rental_manager', 'finance_manager'],
  },
  {
    href: '/(app)/documents',
    label: 'Documents',
    icon: FileText,
    roles: [
      'super_admin', 'admin', 'service_manager', 'service_engineer', 'engineer',
      'store_manager', 'mechanic', 'hr_manager', 'rental_manager', 'sales_executive', 'finance_manager'
    ],
  },
  {
    href: '/(app)/hr',
    label: 'HR',
    icon: Users,
    roles: ['super_admin', 'admin', 'service_manager', 'hr_manager', 'finance_manager', 'rental_manager'],
    subItems: [
      { label: 'Dashboard', tab: 'dashboard', icon: LayoutDashboard },
      { label: 'Employees', tab: 'employees', icon: Users },
      { label: 'Onboarding', tab: 'onboarding', icon: ClipboardList },
      { label: 'Departments', tab: 'departments', icon: Building2 },
      { label: 'Designations', tab: 'designations', icon: Star },
      { label: 'Payroll', tab: 'payroll', icon: FileText },
      { label: 'Requests', tab: 'user_requests', icon: Settings },
      { label: 'Documents', tab: 'documents', icon: FileText },
    ],
  },
  {
    href: '/(app)/finance',
    label: 'Finance',
    icon: BarChart3,
    roles: ['super_admin', 'admin', 'finance_manager'],
    subItems: [
      { label: 'Dashboard', tab: 'dashboard', icon: LayoutDashboard },
      { label: 'Invoices', tab: 'invoices', icon: FileText },
      { label: 'Payments', tab: 'payments', icon: ShoppingBag },
      { label: 'Receivables', tab: 'receivables', icon: ClipboardList },
      { label: 'Payables', tab: 'payables', icon: Building2 },
      { label: 'PO Match', tab: 'po-match', icon: Settings },
      { label: 'Expenses', tab: 'expenses', icon: Package },
      { label: 'Payroll', tab: 'payroll', icon: Users },
      { label: 'Reports', tab: 'reports', icon: BarChart3 },
      { label: 'Settings', tab: 'settings', icon: Settings },
    ],
  },
  {
    href: '/(app)/reports',
    label: 'Reports',
    icon: BarChart3,
    roles: ['super_admin', 'admin', 'service_manager', 'service_engineer', 'engineer', 'mechanic', 'store_manager', 'hr_manager', 'rental_manager', 'sales_executive', 'finance_manager'],
  },
  {
    href: '/(app)/administration',
    label: 'Administration',
    icon: Settings,
    roles: ['super_admin', 'admin'],
  },
];

export function getVisibleMobileNavItems(role?: string): MobileNavItem[] {
  if (!role) return mobileNavItems;
  return mobileNavItems.filter(
    (item) => !item.roles || item.roles.includes(role) || item.roles.includes(role.toLowerCase())
  );
}
