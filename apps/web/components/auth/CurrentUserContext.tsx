"use client";

import React, { createContext, useContext, useMemo } from "react";
import type { User, UserRole } from "@/lib/types/database";
import {
  roleHasPermission,
  hasAnyPermission,
  type PermissionCode,
} from "@reachinternational/permissions";

export interface CurrentUserContextValue {
  user: User | null;
  role: UserRole | null;
  isProfileComplete: boolean;
  can: (permission: PermissionCode) => boolean;
  canAny: (permissions: PermissionCode[]) => boolean;
}

const CurrentUserContext = createContext<CurrentUserContextValue>({
  user: null,
  role: null,
  isProfileComplete: false,
  can: () => false,
  canAny: () => false,
});

export function CurrentUserProvider({
  user,
  children,
}: {
  user: User;
  children: React.ReactNode;
}) {
  const value = useMemo<CurrentUserContextValue>(() => {
    const role = (user?.role as UserRole) || null;
    const isProfileComplete =
      user?.complete_profile === true || (user?.complete_profile as any) === "yes";

    return {
      user,
      role,
      isProfileComplete,
      can: (permission: PermissionCode) => {
        if (!role) return false;
        return roleHasPermission(role, permission);
      },
      canAny: (permissions: PermissionCode[]) => {
        if (!role) return false;
        return hasAnyPermission(role, permissions);
      },
    };
  }, [user]);

  return (
    <CurrentUserContext.Provider value={value}>
      {children}
    </CurrentUserContext.Provider>
  );
}

export function useCurrentUser(): CurrentUserContextValue {
  return useContext(CurrentUserContext);
}
