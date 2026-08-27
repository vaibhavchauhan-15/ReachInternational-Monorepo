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
  isLoading: boolean;
  can: (permission: PermissionCode) => boolean;
  canAny: (permissions: PermissionCode[]) => boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  session: null,
  user: null,
  role: null,
  isLoading: true,
  can: () => false,
  canAny: () => false,
  signOut: async () => {},
});

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState<UserRole | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const syncUserProfile = async (currentSession: Session | null) => {
    if (!currentSession?.user) {
      setRole(null);
      setIsLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('users')
        .select('role, status')
        .eq('id', currentSession.user.id)
        .single();

      if (error || !data) {
        // Safe fallback: use session metadata if strictly present, otherwise null
        const metaRole = currentSession.user.user_metadata?.role as UserRole | undefined;
        setRole(metaRole || null);
      } else if (data.status === 'inactive' || data.status === 'pending') {
        console.warn(`[useAuth] Account is ${data.status}. Revoking session.`);
        await supabase.auth.signOut();
        setSession(null);
        setUser(null);
        setRole(null);
      } else {
        setRole(data.role as UserRole);
      }
    } catch (err) {
      console.error('[useAuth] Error fetching user role from database:', err);
      const metaRole = currentSession.user.user_metadata?.role as UserRole | undefined;
      setRole(metaRole || null);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      syncUserProfile(session);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      syncUserProfile(session);
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
