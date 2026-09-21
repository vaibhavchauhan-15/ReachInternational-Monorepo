import type { UserRole } from "@reachinternational/types";

// ─── Nav destination keys ───────────────────────────────────────
export type NavKey =
  | "home"
  | "operations"
  | "machines"
  | "clients"
  | "users"
  | "audit"
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
    key: "hr",
    label: "Payroll",
    href: "/hr",
    icon: "banknote",
    match: ["/hr"],
    roles: [
      "super_admin",
      "admin",
      "manager",
      "hr",
    ],
  },
];

// ─── Bar slot order per role (max 4 primary + More/Account) ─────
// ponytail: hand-picked per role; derive from usage data only if it ever matters.
export const PRIMARY: Record<UserRole, NavKey[]> = {
  operator: ["home", "operations", "machines"],
  supervisor: ["home", "operations", "machines", "users"],
  hr: ["home", "operations", "hr", "users"],
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
