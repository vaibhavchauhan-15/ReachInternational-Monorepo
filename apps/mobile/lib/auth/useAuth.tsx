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
  isProfileComplete: boolean;
  userProfile: any | null;
  can: (permission: PermissionCode) => boolean;
  canAny: (permissions: PermissionCode[]) => boolean;
  signOut: () => Promise<void>;
  refreshSession: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  session: null,
  user: null,
  role: null,
  isLoading: true,
  isProfileComplete: true,
  userProfile: null,
  can: () => false,
  canAny: () => false,
  signOut: async () => {},
  refreshSession: async () => {},
});

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState<UserRole | null>(null);
  const [isProfileComplete, setIsProfileComplete] = useState<boolean>(true);
  const [userProfile, setUserProfile] = useState<any | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const syncUserProfile = async (currentSession: Session | null) => {
    if (!currentSession?.user) {
      setRole(null);
      setIsProfileComplete(true);
      setUserProfile(null);
      setIsLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('users')
        .select('id, full_name, phone, role, status, complete_profile, shift_time, city, district, state, state_id, address, aadhaar_number, license_number')
        .eq('id', currentSession.user.id)
        .single();

      if (error || !data) {
        // Safe fallback: use session metadata if strictly present, otherwise null
        const metaRole = currentSession.user.user_metadata?.role as UserRole | undefined;
        setRole(metaRole || null);
        setIsProfileComplete(true);
      } else if (data.status === 'inactive' || data.status === 'pending') {
        console.warn(`[useAuth] Account is ${data.status}. Revoking session.`);
        await supabase.auth.signOut();
        setSession(null);
        setUser(null);
        setRole(null);
        setIsProfileComplete(true);
        setUserProfile(null);
      } else {
        setRole(data.role as UserRole);
        setUserProfile(data);

        // Fast check: if complete_profile === 'yes', skip checking individual fields
        if (data.complete_profile === 'yes') {
          setIsProfileComplete(true);
        } else {
          // Check if any required field is missing
          const hasName = Boolean(data.full_name && data.full_name.trim().length >= 2);
          const hasPhone = Boolean(data.phone && data.phone.trim().replace(/\D/g, '').length >= 10);
          const hasRole = Boolean(data.role);
          const hasShift = Boolean(data.shift_time && data.shift_time.trim());
          const hasLocation = Boolean(data.city && data.district && data.state);
          const hasAddress = Boolean(data.address && data.address.trim());
          const hasAadhaar = Boolean(data.aadhaar_number && data.aadhaar_number.replace(/\D/g, '').length === 12);

          const complete = hasName && hasPhone && hasRole && hasShift && hasLocation && hasAddress && hasAadhaar;
          setIsProfileComplete(complete);
        }
      }
    } catch (err) {
      console.error('[useAuth] Error fetching user role from database:', err);
      const metaRole = currentSession.user.user_metadata?.role as UserRole | undefined;
      setRole(metaRole || null);
      setIsProfileComplete(true);
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

  const refreshSession = async (): Promise<void> => {
    const { data: { session } } = await supabase.auth.getSession();
    setSession(session);
    setUser(session?.user ?? null);
    await syncUserProfile(session);
  };

  return (
    <AuthContext.Provider
      value={{
        session,
        user,
        role,
        isLoading,
        isProfileComplete,
        userProfile,
        can,
        canAny,
        signOut,
        refreshSession,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => useContext(AuthContext);
