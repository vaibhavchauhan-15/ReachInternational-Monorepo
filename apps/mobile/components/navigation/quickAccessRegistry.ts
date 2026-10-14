/**
 * ReachInternational Mobile — Quick Access Destination Registry
 * Centralized, typed, and RBAC-aware inventory of all native app destinations,
 * nested settings screens, operations tabs, and actionable system functions.
 */

import React from 'react';
import type { UserRole } from '@reachinternational/types';
import {
  Home,
  Wrench,
  Gauge,
  Clock,
  Activity,
  CalendarCheck,
  Banknote,
  Building2,
  Users,
  User,
  UserPlus,
  Settings,
  KeyRound,
  Shield,
  Sliders,
  Type,
  Bell,
  Info,
  Mail,
  Trash2,
  FileText,
  Sun,
  Moon,
  LogOut,
  Vibrate,
  Sparkles,
} from '../ui/icon';

export type QuickAccessCategory = 'Navigation' | 'Settings' | 'Quick Actions' | 'System';

export interface QuickAccessDestination {
  id: string;
  title: string;
  subtitle?: string;
  category: QuickAccessCategory;
  breadcrumb: string;
  icon: React.ComponentType<{ size?: number; color?: string }>;
  href?: string;
  actionId?: 'toggle-theme' | 'toggle-haptics' | 'logout';
  keywords: string[];
  roles?: string[]; // If undefined, accessible by all canonical roles
}

export interface QuickAccessRegistryOptions {
  userRole?: string | null;
  isDark?: boolean;
  hapticsEnabled?: boolean;
}

/**
 * Builds the comprehensive list of all potential Quick Access destinations and actions.
 */
export function buildQuickAccessDestinations(
  options: QuickAccessRegistryOptions = {}
): QuickAccessDestination[] {
  const isDark = Boolean(options.isDark);
  const hapticsEnabled = options.hapticsEnabled !== false;

  return [
    // ════════════════════════════════════════════════════════════════
    // 1. PRIMARY NAVIGATION & TABS
    // ════════════════════════════════════════════════════════════════
    {
      id: 'nav-dashboard',
      title: 'Home',
      subtitle: 'Executive overview, fleet utilization KPIs & recent activities',
      category: 'Navigation',
      breadcrumb: 'Home',
      icon: Home,
      href: '/dashboard',
      keywords: ['home', 'dashboard', 'kpi', 'metrics', 'overview', 'analytics', 'telemetry'],
    },
    {
      id: 'nav-machines',
      title: 'Machines Directory',
      subtitle: 'Fleet inventory, specs, HMR running hours & status tracking',
      category: 'Navigation',
      breadcrumb: 'Fleet → Machines',
      icon: Wrench,
      href: '/machines',
      keywords: ['machines', 'machine', 'equipment', 'devices', 'inventory', 'assets', 'fleet', 'jcb', 'scissor lift'],
      roles: ['super_admin', 'admin', 'manager', 'supervisor'],
    },
    {
      id: 'nav-machines-operator',
      title: 'My Assigned Machine',
      subtitle: 'View specifications and worksite details for your assigned machine',
      category: 'Navigation',
      breadcrumb: 'Fleet → My Machine',
      icon: Wrench,
      href: '/machines',
      keywords: ['equipment', 'machine', 'assigned machine', 'specs', 'details', 'my machine'],
      roles: ['operator'],
    },
    {
      id: 'nav-operations',
      title: 'Operations Hub',
      subtitle: 'Daily machine running logs, overtime & operator shift assignments',
      category: 'Navigation',
      breadcrumb: 'Operations',
      icon: Gauge,
      href: '/operations',
      keywords: ['operations', 'hub', 'duty', 'shifts', 'logs', 'meter'],
    },
    {
      id: 'nav-operations-today',
      title: "Today's Shift Monitor",
      subtitle: 'Live shift roster, machine coverage & real-time shift verification',
      category: 'Navigation',
      breadcrumb: "Operations → Today's Shifts",
      icon: Clock,
      href: '/operations?tab=today',
      keywords: ['today', "today's shifts", 'shift roster', 'coverage', 'assisted log', 'active shifts', 'live shifts'],
      roles: ['super_admin', 'admin', 'manager', 'supervisor', 'hr'],
    },
    {
      id: 'nav-operations-entry',
      title: 'Operator Shift Entry',
      subtitle: 'Submit daily machine running hour log entries, start/end HMR & fuel',
      category: 'Navigation',
      breadcrumb: 'Operations → Shift Entry',
      icon: Gauge,
      href: '/operations?tab=entry',
      keywords: ['shift entry', 'log entry', 'meter entry', 'submit log', 'running hours entry', 'hmr log'],
      roles: ['super_admin', 'admin', 'manager', 'supervisor', 'operator'],
    },
    {
      id: 'nav-operations-history',
      title: 'Operator Log History',
      subtitle: 'Inspect past machine log entries, shift approvals & printable reports',
      category: 'Navigation',
      breadcrumb: 'Operations → Log History',
      icon: Clock,
      href: '/operations?tab=history',
      keywords: ['history', 'log history', 'past logs', 'shift history', 'previous logs'],
      roles: ['super_admin', 'admin', 'manager', 'supervisor', 'operator'],
    },
    {
      id: 'nav-operations-running-hours',
      title: 'Machinery Running Hours',
      subtitle: 'Aggregated daily machine run times, overtime breakdown & supervisor reviews',
      category: 'Navigation',
      breadcrumb: 'Operations → Running Hours',
      icon: Activity,
      href: '/operations?tab=logs',
      keywords: ['running hours', 'machine hours', 'meter breakdown', 'shift hours', 'overtime hours'],
      roles: ['super_admin', 'admin', 'manager', 'supervisor', 'hr'],
    },
    {
      id: 'nav-running-logs',
      title: 'Daily Running Hours Logs',
      subtitle: 'Monthly machinery running hours, client site summaries & export logs',
      category: 'Navigation',
      breadcrumb: 'Operations → Daily Running Logs',
      icon: Activity,
      href: '/running-logs',
      keywords: ['running logs', 'daily log', 'daily running logs', 'meter log', 'log history', 'export logs'],
      roles: ['super_admin', 'admin', 'manager', 'supervisor', 'hr'],
    },
    {
      id: 'nav-attendance',
      title: 'Attendance & Shifts',
      subtitle: 'Daily workforce attendance, shift duty records & overtime status',
      category: 'Navigation',
      breadcrumb: 'Workforce → Attendance',
      icon: CalendarCheck,
      href: '/attendance',
      keywords: ['attendance', 'shift attendance', 'present', 'absent', 'half day', 'duty records', 'workforce'],
    },
    {
      id: 'nav-payroll',
      title: 'Payroll & Compensation',
      subtitle: 'Monthly operator compensation, wage calculations & overtime payouts',
      category: 'Navigation',
      breadcrumb: 'Workforce → Payroll',
      icon: Banknote,
      href: '/payroll',
      keywords: ['payroll', 'salary', 'wages', 'rates', 'compensation', 'operator pay', 'overtime pay', 'slip'],
      roles: ['super_admin', 'admin', 'hr'],
    },
    {
      id: 'nav-clients',
      title: 'Clients & Accounts Directory',
      subtitle: 'Registered customer organizations, site locations & equipment allocations',
      category: 'Navigation',
      breadcrumb: 'Commercial → Clients',
      icon: Building2,
      href: '/clients',
      keywords: ['clients', 'customers', 'accounts', 'sites', 'locations', 'commercial', 'billing'],
      roles: ['super_admin', 'admin', 'manager', 'supervisor'],
    },
    {
      id: 'nav-users',
      title: 'User & Personnel Directory',
      subtitle: 'Staff directory, RBAC roles, KYC verification & account approvals',
      category: 'Navigation',
      breadcrumb: 'Administration → Users',
      icon: Users,
      href: '/users',
      keywords: ['users', 'user', 'personnel', 'employees', 'staff', 'operators', 'supervisors', 'hr', 'accounts', 'kyc'],
      roles: ['super_admin', 'admin', 'manager', 'supervisor', 'hr'],
    },
    {
      id: 'nav-profile',
      title: 'User Profile & Identity',
      subtitle: 'Account credentials, employment details, shift timings & Aadhaar KYC',
      category: 'Navigation',
      breadcrumb: 'Account → Profile',
      icon: User,
      href: '/profile',
      keywords: ['profile', 'account', 'identity', 'contact', 'aadhaar', 'personal', 'shift time'],
    },
    {
      id: 'nav-profile-edit',
      title: 'Edit Profile Details',
      subtitle: 'Update contact details, banking info, Aadhaar card & driving licence',
      category: 'Navigation',
      breadcrumb: 'Account → Profile → Edit Profile',
      icon: User,
      href: '/profile/edit',
      keywords: ['edit profile', 'update profile', 'change address', 'bank details', 'ifsc', 'kyc update'],
    },

    // ════════════════════════════════════════════════════════════════
    // 2. SETTINGS MODULE & NESTED PREFERENCES
    // ════════════════════════════════════════════════════════════════
    {
      id: 'nav-settings',
      title: 'Settings Hub',
      subtitle: 'Configure preferences, security, notifications & account controls',
      category: 'Settings',
      breadcrumb: 'Settings',
      icon: Settings,
      href: '/settings',
      keywords: ['settings', 'preferences', 'configuration', 'options'],
    },
    {
      id: 'nav-settings-account',
      title: 'Account Settings',
      subtitle: 'Profile management, password security & account lifecycle',
      category: 'Settings',
      breadcrumb: 'Settings → Account',
      icon: User,
      href: '/settings/account',
      keywords: ['account settings', 'credentials', 'account security', 'manage account'],
    },
    {
      id: 'nav-settings-preferences',
      title: 'App Preferences',
      subtitle: 'Theme styling (Dark/Light/System), font scaling & haptic feedback',
      category: 'Settings',
      breadcrumb: 'Settings → Preferences',
      icon: Sliders,
      href: '/settings/preferences',
      keywords: ['preferences', 'appearance', 'theme', 'dark mode', 'light mode', 'haptics', 'styling'],
    },
    {
      id: 'nav-settings-theme',
      title: 'Theme Customization',
      subtitle: 'Customize visual appearance: Light, Dark, or System mode',
      category: 'Settings',
      breadcrumb: 'Settings → Preferences → Theme',
      icon: Sun,
      href: '/settings/preferences',
      keywords: ['theme', 'dark mode', 'light mode', 'color mode', 'appearance', 'display'],
    },
    {
      id: 'nav-settings-font-size',
      title: 'Font Size & Display Scaling',
      subtitle: 'Interactive font scaling presets with live shift card preview',
      category: 'Settings',
      breadcrumb: 'Settings → Preferences → Font Size',
      icon: Type,
      href: '/settings/font-size',
      keywords: ['font size', 'text size', 'font scaling', 'display scaling', 'large text', 'typography'],
    },
    {
      id: 'nav-settings-notification',
      title: 'Notification Settings',
      subtitle: 'Shift alerts, breakdown notices, overtime authorizations & reminders',
      category: 'Settings',
      breadcrumb: 'Settings → Notifications',
      icon: Bell,
      href: '/settings/notification',
      keywords: ['notifications', 'alerts', 'reminders', 'push notifications', 'shift alerts', 'breakdown alerts'],
    },
    {
      id: 'nav-settings-password',
      title: 'Change Password',
      subtitle: 'Update account authentication password and secure access',
      category: 'Settings',
      breadcrumb: 'Settings → Account → Password',
      icon: KeyRound,
      href: '/settings/password',
      keywords: ['change password', 'reset password', 'password', 'credentials', 'security password'],
    },
    {
      id: 'nav-settings-security',
      title: 'Account Security & Telemetry',
      subtitle: 'Hardware-backed SecureStore status, encryption verification & active sessions',
      category: 'Settings',
      breadcrumb: 'Settings → Account → Security',
      icon: Shield,
      href: '/settings/security',
      keywords: ['security', 'hardware keystore', 'secure store', 'encryption', 'sessions', 'telemetry'],
    },
    {
      id: 'nav-settings-app-info',
      title: 'App Information & Specifications',
      subtitle: 'Installed build, runtime environment, Hermes engine & system specs',
      category: 'Settings',
      breadcrumb: 'Settings → App Info',
      icon: Info,
      href: '/settings/app-info',
      keywords: ['about app', 'app info', 'version', 'build', 'hermes', 'specs', 'system info'],
    },
    {
      id: 'nav-settings-support',
      title: 'Support & Help Desk',
      subtitle: 'Enterprise technical support contact, email assistance & portal',
      category: 'Settings',
      breadcrumb: 'Settings → Support',
      icon: Mail,
      href: '/settings/support',
      keywords: ['support', 'help', 'contact', 'customer care', 'email support', 'assistance'],
    },
    {
      id: 'nav-account-deletion',
      title: 'Delete Account & Erasure',
      subtitle: 'Submit statutory account deletion request and data erasure',
      category: 'Settings',
      breadcrumb: 'Settings → Account → Delete Account',
      icon: Trash2,
      href: '/account-deletion',
      keywords: ['delete account', 'account deletion', 'erase data', 'close account', 'terminate account'],
    },
    {
      id: 'nav-account-deletion-guide',
      title: 'Account Deletion Guide',
      subtitle: 'Statutory compliance details, data retention policy & erasure process',
      category: 'Settings',
      breadcrumb: 'Settings → Account → Deletion Guide',
      icon: FileText,
      href: '/account-deletion/guide',
      keywords: ['deletion guide', 'retention policy', 'factories act', 'data privacy', 'erasure steps'],
    },

    // ════════════════════════════════════════════════════════════════
    // 3. QUICK ACTIONS (ACTIONABLE SYSTEM FUNCTIONS)
    // ════════════════════════════════════════════════════════════════
    {
      id: 'action-add-machine',
      title: 'Add New Machine Asset',
      subtitle: 'Register industrial machine with serial number and initial HMR',
      category: 'Quick Actions',
      breadcrumb: 'Fleet → Machines → New Asset',
      icon: Wrench,
      href: '/machines',
      keywords: ['add machine', 'create machine', 'new machine', 'register equipment', 'new asset'],
      roles: ['super_admin', 'admin', 'manager'],
    },
    {
      id: 'action-assign-operator',
      title: 'Assign Operator to Machine',
      subtitle: 'Schedule field operator to equipment shift roster',
      category: 'Quick Actions',
      breadcrumb: "Operations → Today's Shifts → Roster",
      icon: Clock,
      href: '/operations?tab=today',
      keywords: ['assign operator', 'assign machine', 'new assignment', 'schedule operator', 'roster shift'],
      roles: ['super_admin', 'admin', 'manager', 'supervisor'],
    },
    {
      id: 'action-log-hours',
      title: 'Log Daily Machine Hours (HMR)',
      subtitle: 'Submit daily meter reading, shift timings and fuel log',
      category: 'Quick Actions',
      breadcrumb: 'Operations → Shift Entry → Log Meter',
      icon: Gauge,
      href: '/operations?tab=entry',
      keywords: ['log hours', 'record hours', 'submit shift', 'hmr log', 'meter log'],
      roles: ['super_admin', 'admin', 'manager', 'supervisor', 'operator'],
    },
    {
      id: 'action-export-running-logs',
      title: 'Export Running Hours Summary',
      subtitle: 'Generate and export machinery running logs report',
      category: 'Quick Actions',
      breadcrumb: 'Operations → Daily Running Logs → Export',
      icon: Activity,
      href: '/running-logs',
      keywords: ['export logs', 'download report', 'running hours export', 'print logbook'],
      roles: ['super_admin', 'admin', 'manager', 'supervisor', 'hr'],
    },
    {
      id: 'action-invite-user',
      title: 'Register New Personnel Account',
      subtitle: 'Create new employee, operator, or supervisor account',
      category: 'Quick Actions',
      breadcrumb: 'Administration → Users → Create User',
      icon: UserPlus,
      href: '/users',
      keywords: ['create user', 'add employee', 'new operator', 'invite staff', 'register user'],
      roles: ['super_admin', 'admin', 'manager', 'hr'],
    },

    // ════════════════════════════════════════════════════════════════
    // 4. SYSTEM & PREFERENCES ACTIONS
    // ════════════════════════════════════════════════════════════════
    {
      id: 'sys-toggle-theme',
      title: isDark ? 'Switch to Light Theme' : 'Switch to Dark Theme',
      subtitle: `Currently active: ${isDark ? 'Dark Mode (Canvas #0a0a0a)' : 'Light Mode (Canvas #fafafa)'}`,
      category: 'System',
      breadcrumb: 'System → Appearance',
      icon: isDark ? Sun : Moon,
      actionId: 'toggle-theme',
      keywords: ['theme', 'dark mode', 'light mode', 'switch theme', 'appearance', 'display'],
    },
    {
      id: 'sys-toggle-haptics',
      title: hapticsEnabled ? 'Disable Haptic Feedback' : 'Enable Haptic Feedback',
      subtitle: `Currently active: ${hapticsEnabled ? 'Tactile vibration enabled' : 'Tactile vibration disabled'}`,
      category: 'System',
      breadcrumb: 'System → Preferences',
      icon: Vibrate,
      actionId: 'toggle-haptics',
      keywords: ['haptics', 'vibration', 'tactile', 'feedback', 'toggle haptics'],
    },
    {
      id: 'sys-logout',
      title: 'Sign Out of Account',
      subtitle: 'Securely terminate active session and return to login screen',
      category: 'System',
      breadcrumb: 'System → Session',
      icon: LogOut,
      actionId: 'logout',
      keywords: ['logout', 'sign out', 'exit', 'disconnect', 'leave'],
    },
    {
      id: 'sys-privacy',
      title: 'Privacy Policy',
      subtitle: 'Statutory compliance under Factories Act 1948 & data protection',
      category: 'System',
      breadcrumb: 'Legal → Privacy Policy',
      icon: FileText,
      href: '/privacy',
      keywords: ['privacy policy', 'privacy', 'legal', 'data protection', 'factories act'],
    },
    {
      id: 'sys-terms',
      title: 'Terms of Service',
      subtitle: 'Platform operational responsibilities, terms & guidelines',
      category: 'System',
      breadcrumb: 'Legal → Terms of Service',
      icon: FileText,
      href: '/terms',
      keywords: ['terms of service', 'terms', 'conditions', 'legal', 'agreement'],
    },
    {
      id: 'sys-motion-lab',
      title: 'Motion & Transitions Lab',
      subtitle: 'Material 3 Expressive motion diagnostics, sheet physics & toasts',
      category: 'System',
      breadcrumb: 'Diagnostics → Motion Lab',
      icon: Sparkles,
      href: '/motion-lab',
      keywords: ['motion lab', 'transitions', 'diagnostics', 'animation tuning', 'sheet physics', 'ui tests'],
      roles: ['super_admin', 'admin'],
    },
  ];
}

/**
 * Checks if a destination is permitted for a given user role.
 */
export function isDestinationPermitted(
  destination: QuickAccessDestination,
  role?: string | null
): boolean {
  if (!destination.roles || destination.roles.length === 0) {
    return true;
  }
  const normalizedRole = (role || 'operator').toLowerCase();
  if (normalizedRole === 'super_admin') {
    return true;
  }
  return destination.roles.some((r) => r.toLowerCase() === normalizedRole);
}

/**
 * Normalizes text for search matching: converts to lowercase, trims whitespace,
 * and strips common punctuation while keeping alphanumerics.
 */
export function normalizeSearchString(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Filters and scores destinations based on the user's role and search query.
 * Produces prioritized results matching token boundaries and whole query prefixes.
 */
export function filterAndScoreDestinations(
  destinations: QuickAccessDestination[],
  rawQuery: string,
  userRole?: string | null
): QuickAccessDestination[] {
  // 1. Role-based permission filter
  const permitted = destinations.filter((dest) => isDestinationPermitted(dest, userRole));

  const query = rawQuery.trim().toLowerCase();
  if (!query) {
    return permitted;
  }

  const tokens = query.split(/\s+/).filter(Boolean);

  // 2. Score each permitted destination
  const scored = permitted
    .map((dest) => {
      const title = dest.title.toLowerCase();
      const breadcrumb = dest.breadcrumb.toLowerCase();
      const subtitle = (dest.subtitle || '').toLowerCase();
      const category = dest.category.toLowerCase();
      const keywords = (dest.keywords || []).join(' ').toLowerCase();
      const href = (dest.href || '').toLowerCase();

      const haystack = `${title} ${breadcrumb} ${category} ${keywords} ${subtitle} ${href}`;

      let score = 0;

      // Every token must match somewhere in haystack
      for (const token of tokens) {
        if (!haystack.includes(token)) {
          return null;
        }

        if (title.startsWith(token)) {
          score += 100;
        } else if (title.includes(` ${token}`)) {
          score += 60;
        } else if (title.includes(token)) {
          score += 40;
        }

        if (breadcrumb.includes(token)) {
          score += 80;
        }

        if (keywords.includes(token)) {
          score += 30;
        }

        if (subtitle.includes(token)) {
          score += 15;
        }

        if (href.includes(token)) {
          score += 10;
        }
      }

      // Strong bonus for whole query matching the start of the title or breadcrumb
      if (title.startsWith(query)) {
        score += 200;
      } else if (breadcrumb.startsWith(query)) {
        score += 150;
      }

      return { dest, score };
    })
    .filter((entry): entry is { dest: QuickAccessDestination; score: number } => entry !== null)
    .sort((a, b) => b.score - a.score);

  return scored.map((entry) => entry.dest);
}
