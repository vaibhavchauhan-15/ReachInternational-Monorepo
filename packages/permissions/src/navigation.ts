import type { UserRole } from "@reachinternational/types";

// ─── Nav destination keys ───────────────────────────────────────
export type NavKey =
  | "home"
  | "operations"
  | "machines"
  | "clients"
  | "users"
  | "audit"
  | "payroll"
  | "attendance"
  | "hr";

// ─── Nav item definition ───────────────────────────────────────
export interface NavItem {
  key: NavKey;
  label: string;
  href: string;
  /** String key; each platform maps it to its own icon component */
  icon: string;
  /** Pathname prefixes that mark this item active */
  match: string[];
  /** Roles that may see this item */
  roles: readonly UserRole[];
  /** Per-role label overrides (e.g. "Log" for operators) */
  roleLabel?: Partial<Record<UserRole, string>>;
}

// ─── Reusable role constants ────────────────────────────────────
export const CANONICAL_NAV_ROLES: readonly UserRole[] = [
  "super_admin",
  "admin",
  "manager",
  "supervisor",
  "hr",
  "operator",
];

// Matches the constant in apps/web/app/actions/clients.ts
export const AUTHORIZED_CLIENT_ROLES: readonly UserRole[] = [
  "super_admin",
  "admin",
  "manager",
  "supervisor",
];

const AUDIT_ROLES: readonly UserRole[] = [
  "super_admin",
  "admin",
  "manager",
];

// ─── All navigable destinations ─────────────────────────────────
export const NAV_ITEMS: NavItem[] = [
  {
    key: "home",
    label: "Home",
    href: "/dashboard",
    icon: "home",
    match: ["/dashboard"],
    roles: CANONICAL_NAV_ROLES,
  },
  {
    key: "operations",
    label: "Operations",
    href: "/operations",
    icon: "gauge",
    match: ["/operations"],
    roles: [
      "super_admin",
      "admin",
      "manager",
      "supervisor",
      "hr",
      "operator",
    ],
    roleLabel: { operator: "Log" },
  },
  {
    key: "machines",
    label: "Machines",
    href: "/machines",
    icon: "wrench",
    match: ["/machines"],
    roles: [
      "super_admin",
      "admin",
      "manager",
      "supervisor",
      "operator",
    ],
  },
  {
    key: "clients",
    label: "Clients",
    href: "/clients",
    icon: "building",
    match: ["/clients"],
    roles: AUTHORIZED_CLIENT_ROLES,
  },
  {
    key: "users",
    label: "Users",
    href: "/users",
    icon: "users",
    match: ["/users"],
    roles: [
      "super_admin",
      "admin",
      "manager",
      "hr",
      "supervisor",
    ],
  },
  {
    key: "audit",
    label: "Audit",
    href: "/audit",
    icon: "shield",
    match: ["/audit"],
    roles: AUDIT_ROLES,
  },
  {
    key: "payroll",
    label: "Payroll",
    href: "/payroll",
    icon: "banknote",
    match: ["/payroll", "/hr"],
    roles: [
      "super_admin",
      "admin",
      "hr",
    ],
  },
  {
    key: "attendance",
    label: "Attendance",
    href: "/attendance",
    icon: "calendar-check",
    match: ["/attendance"],
    roles: [
      "super_admin",
      "admin",
      "hr",
    ],
  },
];

// ─── Centralized Role Home Routes ───────────────────────────────
export const ROLE_HOME_ROUTES: Record<UserRole, string> = {
  super_admin: "/dashboard",
  admin: "/dashboard",
  manager: "/dashboard",
  supervisor: "/dashboard",
  hr: "/dashboard",
  operator: "/dashboard",
};

export const MOBILE_ROLE_HOME_ROUTES: Record<UserRole, string> = {
  super_admin: "/(app)/dashboard",
  admin: "/(app)/dashboard",
  manager: "/(app)/dashboard",
  supervisor: "/(app)/dashboard",
  hr: "/(app)/dashboard",
  operator: "/(app)/dashboard",
};

export function getRoleHomeRoute(role?: UserRole | string | null): string {
  if (role && role in ROLE_HOME_ROUTES) {
    return ROLE_HOME_ROUTES[role as UserRole];
  }
  return "/dashboard";
}

export function getMobileRoleHomeRoute(role?: UserRole | string | null): string {
  if (role && role in MOBILE_ROLE_HOME_ROUTES) {
    return MOBILE_ROLE_HOME_ROUTES[role as UserRole];
  }
  return "/(app)/dashboard";
}

// ─── Route Categorization Standards ─────────────────────────────
export const ACTIVE_PROTECTED_ROUTES: readonly string[] = [
  "/dashboard",
  "/machines",
  "/operations",
  "/clients",
  "/users",
  "/payroll",
  "/attendance",
  "/audit",
  "/settings",
  "/more",
  "/profile",
  "/onboarding",
];

export const AUTH_ROUTES: readonly string[] = [
  "/login",
  "/forgot-password",
  "/signup",
  "/reset-password",
];

export const PUBLIC_LEGAL_ROUTES: readonly string[] = [
  "/privacy",
  "/terms",
  "/account-deletion",
  "/delete-account",
  "/account-deletion-guide",
];

export const DEPRECATED_ROUTES: readonly string[] = [
  "/crm",
  "/inventory",
  "/finance",
  "/tasks",
  "/documents",
  "/challans",
  "/purchase-orders",
  "/rentals",
  "/reports",
  "/vendors",
  "/administration",
  "/branches",
  "/complaints",
  "/services",
  "/service",
  "/notifications",
  "/notification",
  "/audit-logs",
  "/my-work",
  "/docs",
];

export function isProtectedRoute(pathname: string): boolean {
  return (
    ACTIVE_PROTECTED_ROUTES.some((route) => pathname.startsWith(route)) ||
    DEPRECATED_ROUTES.some((route) => pathname.startsWith(route))
  );
}

export function isAuthRoute(pathname: string): boolean {
  return AUTH_ROUTES.some((route) => pathname.startsWith(route));
}

export function isPublicLegalRoute(pathname: string): boolean {
  return PUBLIC_LEGAL_ROUTES.some((route) => pathname.startsWith(route));
}

export function isDeprecatedRoute(pathname: string): boolean {
  return DEPRECATED_ROUTES.some((route) => pathname.startsWith(route));
}

export function isRouteAllowedForRole(pathname: string, role: UserRole): boolean {
  // Super admin has unrestricted access to all routes
  if (role === "super_admin") return true;

  // Universal authenticated routes
  if (
    pathname === "/" ||
    pathname.startsWith("/dashboard") ||
    pathname.startsWith("/settings") ||
    pathname.startsWith("/profile") ||
    pathname.startsWith("/more") ||
    pathname.startsWith("/onboarding")
  ) {
    return true;
  }

  // Check matching nav item permissions
  const matchingItem = NAV_ITEMS.find((item) =>
    item.match.some((prefix) => pathname.startsWith(prefix))
  );

  if (matchingItem) {
    return matchingItem.roles.includes(role);
  }

  // Default to allowing if not explicitly restricted by known nav items
  return true;
}

// ─── Bar slot order per role (max 4 primary + More/Account) ─────
// ponytail: hand-picked per role; derive from usage data only if it ever matters.
export const PRIMARY: Record<UserRole, NavKey[]> = {
  operator: ["home", "operations", "machines"],
  supervisor: ["home", "operations", "machines", "users"],
  hr: ["home", "operations", "attendance", "payroll"],
  manager: ["home", "operations", "machines", "clients"],
  admin: ["home", "operations", "machines", "users"],
  super_admin: ["home", "operations", "machines", "users"],
};

// ─── Runtime helpers ────────────────────────────────────────────

export interface NavForRole {
  /** Items shown directly in the bottom bar */
  primary: NavItem[];
  /** Items hidden behind More */
  more: NavItem[];
  /** Whether the last bar slot should be "More" or "Account" */
  hasMore: boolean;
}

export function getNavForRole(role: UserRole): NavForRole {
  const visible = NAV_ITEMS.filter((i) => i.roles.includes(role));
  const primaryKeys = PRIMARY[role];
  const primary = primaryKeys
    .map((k) => visible.find((i) => i.key === k))
    .filter((i): i is NavItem => !!i);
  const more = visible.filter((i) => !primaryKeys.includes(i.key));
  return { primary, more, hasMore: more.length > 0 };
}

export function labelFor(item: NavItem, role: UserRole): string {
  return item.roleLabel?.[role] ?? item.label;
}

