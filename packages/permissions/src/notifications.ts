/**
 * ReachInternational Notification Route Mapping & Role Gating (@reachinternational/permissions)
 */

import type { UserRole } from "@reachinternational/types";

export const NOTIFICATION_ROUTE_KEYS = [
  "operations",
  "machines",
  "users",
  "approvals",
  "payroll",
  "attendance",
  "rfq",
  "settings",
  "dashboard",
] as const;

export type NotificationRouteKey = typeof NOTIFICATION_ROUTE_KEYS[number];

/**
 * Route access permissions by role.
 */
export const NOTIFICATION_ROUTE_ROLE_ACCESS: Record<NotificationRouteKey, readonly UserRole[]> = {
  operations: ["super_admin", "admin", "manager", "supervisor", "hr", "operator"],
  machines: ["super_admin", "admin", "manager", "supervisor", "operator"],
  users: ["super_admin", "admin", "manager", "hr", "supervisor"],
  approvals: ["super_admin", "admin"],
  payroll: ["super_admin", "admin", "hr", "manager", "supervisor", "operator"],
  attendance: ["super_admin", "admin", "hr", "manager", "supervisor", "operator"],
  rfq: ["super_admin", "admin"],
  settings: ["super_admin", "admin", "manager", "supervisor", "hr", "operator"],
  dashboard: ["super_admin", "admin", "manager", "supervisor", "hr", "operator"],
};

export interface ResolvedNotificationNav {
  webHref: string;
  mobileRoute: string;
  isAuthorized: boolean;
}

/**
 * Resolves typed route key and parameters into canonical Web URL and Native Expo Router path.
 * If user role is supplied and lacks authorization for the route, falls back safely to `/dashboard`.
 */
export function resolveNotificationNav(
  routeKey: string | null | undefined,
  params?: Record<string, any> | null,
  userRole?: UserRole | string | null
): ResolvedNotificationNav {
  const normalizedKey = (routeKey || "dashboard").toLowerCase() as NotificationRouteKey;
  const isRecognized = NOTIFICATION_ROUTE_KEYS.includes(normalizedKey);
  const effectiveKey = isRecognized ? normalizedKey : "dashboard";

  // Check role authorization if userRole is supplied
  let isAuthorized = true;
  if (userRole) {
    const allowedRoles = NOTIFICATION_ROUTE_ROLE_ACCESS[effectiveKey];
    if (allowedRoles && !allowedRoles.includes(userRole as UserRole)) {
      isAuthorized = false;
    }
  }

  if (!isAuthorized) {
    return {
      webHref: "/dashboard",
      mobileRoute: "/(app)/dashboard",
      isAuthorized: false,
    };
  }

  const safeParams = params || {};

  switch (effectiveKey) {
    case "operations": {
      const date = safeParams.date ? String(safeParams.date) : null;
      const query = date ? `?date=${encodeURIComponent(date)}` : "";
      return {
        webHref: `/operations${query}`,
        mobileRoute: `/(app)/operations${query}`,
        isAuthorized: true,
      };
    }
    case "machines": {
      const id = safeParams.id ? String(safeParams.id) : null;
      if (id) {
        return {
          webHref: `/machines/${id}`,
          mobileRoute: `/(app)/machines?id=${encodeURIComponent(id)}`,
          isAuthorized: true,
        };
      }
      return {
        webHref: "/machines",
        mobileRoute: "/(app)/machines",
        isAuthorized: true,
      };
    }
    case "users": {
      const id = safeParams.id ? String(safeParams.id) : null;
      if (id) {
        return {
          webHref: `/users/${id}`,
          mobileRoute: `/(app)/users/${encodeURIComponent(id)}`,
          isAuthorized: true,
        };
      }
      return {
        webHref: "/users",
        mobileRoute: "/(app)/users",
        isAuthorized: true,
      };
    }
    case "approvals": {
      return {
        webHref: "/approvals",
        mobileRoute: "/(app)/approvals",
        isAuthorized: true,
      };
    }
    case "payroll": {
      return {
        webHref: "/payroll",
        mobileRoute: "/(app)/payroll",
        isAuthorized: true,
      };
    }
    case "attendance": {
      return {
        webHref: "/attendance",
        mobileRoute: "/(app)/attendance",
        isAuthorized: true,
      };
    }
    case "rfq": {
      return {
        webHref: "/admin/sales/rfq",
        mobileRoute: "/(app)/dashboard",
        isAuthorized: true,
      };
    }
    case "settings": {
      return {
        webHref: "/settings",
        mobileRoute: "/(app)/settings/index",
        isAuthorized: true,
      };
    }
    case "dashboard":
    default: {
      return {
        webHref: "/dashboard",
        mobileRoute: "/(app)/dashboard",
        isAuthorized: true,
      };
    }
  }
}
