import "server-only";

import type { DashboardRole, RoleDashboardMap } from "./types";
import { getSuperAdminDashboard } from "./super-admin-dashboard";
import { getAdminDashboard } from "./admin-dashboard";
import { getManagerDashboard } from "./manager-dashboard";
import { getSupervisorDashboard } from "./supervisor-dashboard";
import { getHRDashboard } from "./hr-dashboard";
import { getOperatorDashboard } from "./operator-dashboard";

export * from "./types";
export { getSuperAdminDashboard } from "./super-admin-dashboard";
export { getAdminDashboard } from "./admin-dashboard";
export { getManagerDashboard } from "./manager-dashboard";
export { getSupervisorDashboard } from "./supervisor-dashboard";
export { getHRDashboard } from "./hr-dashboard";
export { getOperatorDashboard } from "./operator-dashboard";

/**
 * Dispatcher to get the strictly-typed dashboard read model for a user's role.
 */
export async function getDashboardForRole<R extends DashboardRole>(
  role: R,
  userId: string
): Promise<RoleDashboardMap[R]> {
  switch (role) {
    case "super_admin":
      return (await getSuperAdminDashboard(userId)) as RoleDashboardMap[R];
    case "admin":
      return (await getAdminDashboard(userId)) as RoleDashboardMap[R];
    case "manager":
      return (await getManagerDashboard(userId)) as RoleDashboardMap[R];
    case "supervisor":
      return (await getSupervisorDashboard(userId)) as RoleDashboardMap[R];
    case "hr":
      return (await getHRDashboard(userId)) as RoleDashboardMap[R];
    case "operator":
      return (await getOperatorDashboard(userId)) as RoleDashboardMap[R];
    default: {
      const _exhaustiveCheck: never = role;
      throw new Error(`Unsupported dashboard role: ${_exhaustiveCheck}`);
    }
  }
}
