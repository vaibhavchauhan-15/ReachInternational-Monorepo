/**
 * ServiceCentric Mobile — Auth Provider & useAuth Hook
 * React Context managing session, user role, branch scope, and permission checks.
 */

import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../supabase';
import type { Session, User } from '@supabase/supabase-js';
import type { UserRole } from '@reachinternational/types';
import { roleHasPermission, hasAnyPermission, type PermissionCode } from '@reachinternational/permissions';

export interface AuthContextType {
  session: Session | null;
  user: User | null;
  role: UserRole | null;
  branchId: string | null;
  isLoading: boolean;
  can: (permission: PermissionCode) => boolean;
  canAny: (permissions: PermissionCode[]) => boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  session: null,
  user: null,
  role: null,
  branchId: null,
  isLoading: true,
  can: () => false,
  canAny: () => false,
  signOut: async () => {},
});

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState<UserRole | null>(null);
  const [branchId, setBranchId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        setRole((session.user.user_metadata?.role as UserRole) || 'service_engineer');
        setBranchId((session.user.user_metadata?.branch_id as string) || null);
      }
      setIsLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        setRole((session.user.user_metadata?.role as UserRole) || 'service_engineer');
        setBranchId((session.user.user_metadata?.branch_id as string) || null);
      } else {
        setRole(null);
        setBranchId(null);
      }
      setIsLoading(false);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const can = (permission: PermissionCode): boolean => {
    if (!role) return false;
    return roleHasPermission(role, permission);
  };

  const canAny = (permissions: PermissionCode[]): boolean => {
    if (!role) return false;
    return hasAnyPermission(role, permissions);
  };

  const signOut = async (): Promise<void> => {
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider
      value={{
        session,
        user,
        role,
        branchId,
        isLoading,
        can,
        canAny,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => useContext(AuthContext);
