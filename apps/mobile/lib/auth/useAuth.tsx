/**
 * ServiceCentric Mobile — Auth Provider & useAuth Hook
 * React Context managing session, user role, branch scope, permission checks,
 * persistent session hydration, and atomic sign-in lifecycle.
 *
 * SECURITY & SESSION PERSISTENCE INVARIANTS:
 * 1. Hardware Keystore Session Authority: Supabase Session restored exclusively from SecureStore.
 * 2. Cached Profile as UI Hint Only: Cached profile NEVER establishes authentication or authorizes routes.
 *    isLoading remains true until the Supabase session is verified.
 * 3. User Enumeration Defense: Failed password checks return generic errors. Status checks (inactive/pending)
 *    are evaluated only after cryptographic password authentication succeeds.
 * 4. Stored Tokens Purged on Logout: Sign out purges SecureStore tokens, query cache, and cached profile.
 * 5. Robust Timeout & Lifecycle Handling: Timeout timers are safely cleared, double-submit locks guaranteed reset.
 */

import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../supabase';
import type { Session, User } from '@supabase/supabase-js';
import type { UserRole } from '@reachinternational/types';
import { roleHasPermission, hasAnyPermission, type PermissionCode } from '@reachinternational/permissions';
import { setRememberedEmail } from './savedEmails';
import { mapAuthError, formatAccountStatusNotice } from './authErrors';

export interface SignInResult {
  success: boolean;
  role?: UserRole | null;
  isProfileComplete?: boolean;
  error?: string;
  status?: string;
}

export interface AuthContextType {
  session: Session | null;
  user: User | null;
  role: UserRole | null;
  isLoading: boolean;
  isProfileComplete: boolean;
  userProfile: any | null;
  can: (permission: PermissionCode) => boolean;
  canAny: (permissions: PermissionCode[]) => boolean;
  signIn: (email: string, password: string, rememberMe?: boolean) => Promise<SignInResult>;
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
  signIn: async () => ({ success: false, error: 'Auth not initialized' }),
  signOut: async () => {},
  refreshSession: async () => {},
});

const PROFILE_CACHE_PREFIX = '@reach_cached_profile_v1_';

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState<UserRole | null>(null);
  const [isProfileComplete, setIsProfileComplete] = useState<boolean>(true);
  const [userProfile, setUserProfile] = useState<any | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // In-flight sync deduplication & throttle state
  const syncPromiseRef = useRef<Promise<any> | null>(null);
  const syncingUserIdRef = useRef<string | null>(null);
  const lastSyncTimestampRef = useRef<number>(0);
  const isSigningInRef = useRef<boolean>(false);

  /**
   * Read cached profile as an initial UI hint ONLY if a valid Supabase session exists.
   * NEVER bypasses authentication or sets authenticated session independently.
   */
  const loadCachedProfileHint = async (userId: string) => {
    try {
      const raw = await AsyncStorage.getItem(`${PROFILE_CACHE_PREFIX}${userId}`);
      if (!raw) return false;
      const cached = JSON.parse(raw);
      if (cached?.role) {
        setRole((current) => current || (cached.role as UserRole));
        setIsProfileComplete(cached.isProfileComplete ?? true);
        setUserProfile((current: any) => current || cached.userProfile);
        return true;
      }
      return false;
    } catch {
      return false;
    }
  };

  /**
   * Save user profile into cache as UI hint for smooth subsequent screen loads
   */
  const persistUserProfileCache = async (userId: string, data: any, complete: boolean) => {
    try {
      await AsyncStorage.setItem(
        `${PROFILE_CACHE_PREFIX}${userId}`,
        JSON.stringify({
          role: data.role,
          isProfileComplete: complete,
          userProfile: data,
          cachedAt: Date.now(),
        })
      );
    } catch {
      // Non-fatal
    }
  };

  /**
   * Authoritative profile verification from database with in-flight deduplication.
   * If user status is inactive or pending, immediately revokes the session.
   */
  const syncUserProfile = async (currentSession: Session | null, forceFresh = false): Promise<any> => {
    if (!currentSession?.user) {
      setRole(null);
      setIsProfileComplete(true);
      setUserProfile(null);
      setIsLoading(false);
      return null;
    }

    const userId = currentSession.user.id;
    const now = Date.now();

    // Deduplicate concurrent sync calls within 3 seconds unless forced
    if (
      !forceFresh &&
      syncingUserIdRef.current === userId &&
      syncPromiseRef.current &&
      now - lastSyncTimestampRef.current < 3000
    ) {
      return syncPromiseRef.current;
    }

    // Load UI hint for perceived responsiveness while authoritative check runs
    loadCachedProfileHint(userId);

    const task = (async () => {
      syncingUserIdRef.current = userId;
      lastSyncTimestampRef.current = now;

      try {
        const { data, error } = await supabase
          .from('users')
          .select('id, full_name, phone, role, status, complete_profile, shift_start_time, shift_end_time, city, district, state, state_id, street, aadhaar_number, license_number, monthly_salary')
          .eq('id', userId)
          .single();

        if (error || !data) {
          // If query failed due to offline/network, preserve verified session from SecureStore
          const metaRole = currentSession.user.user_metadata?.role as UserRole | undefined;
          if (metaRole && !role) {
            setRole(metaRole);
          }
          return { error, role: role || metaRole };
        }

        // Authoritative Account Status Check
        if (data.status === 'inactive' || data.status === 'pending') {
          // Immediately revoke session
          await supabase.auth.signOut();
          AsyncStorage.removeItem(`${PROFILE_CACHE_PREFIX}${userId}`).catch(() => {});
          setSession(null);
          setUser(null);
          setRole(null);
          setIsProfileComplete(true);
          setUserProfile(null);
          return { status: data.status, error: `Account is ${data.status}` };
        }

        const userRole = data.role as UserRole;
        const profileObj = {
          ...data,
          address: data.street || null,
        };

        let complete = true;
        if (data.complete_profile === true || data.complete_profile === 'yes') {
          complete = true;
        } else {
          const hasName = Boolean(data.full_name && data.full_name.trim().length >= 2);
          const hasPhone = Boolean(data.phone && data.phone.trim().replace(/\D/g, '').length >= 10);
          const hasRole = Boolean(data.role);
          const hasShift = Boolean(data.shift_start_time && data.shift_end_time);
          const hasLocation = Boolean(data.city && data.district && data.state);
          const hasAddress = Boolean(data.street && data.street.trim());
          const hasAadhaar = Boolean(data.aadhaar_number && data.aadhaar_number.replace(/\D/g, '').length === 12);
          complete = hasName && hasPhone && hasRole && hasShift && hasLocation && hasAddress && hasAadhaar;
        }

        setRole(userRole);
        setUserProfile(profileObj);
        setIsProfileComplete(complete);

        // Update persistent cache hint
        persistUserProfileCache(userId, profileObj, complete);

        return { role: userRole, isProfileComplete: complete, userProfile: profileObj };
      } catch (err) {
        const metaRole = currentSession.user.user_metadata?.role as UserRole | undefined;
        if (metaRole && !role) {
          setRole(metaRole);
        }
        return { error: err, role: role || metaRole };
      } finally {
        setIsLoading(false);
        syncPromiseRef.current = null;
      }
    })();

    syncPromiseRef.current = task;
    return task;
  };

  /**
   * Listen to Supabase Auth lifecycle.
   * Session is exclusively authorized by Supabase Auth (SecureStore tokens).
   */
  useEffect(() => {
    let isMounted = true;

    // 1. Authoritative Initial Session Restoration from SecureStore
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!isMounted) return;
      if (session) {
        setSession(session);
        setUser(session.user);
        syncUserProfile(session);
      } else {
        // No valid session stored; unauthenticated
        setSession(null);
        setUser(null);
        setRole(null);
        setUserProfile(null);
        setIsLoading(false);
      }
    }).catch(() => {
      if (isMounted) {
        setSession(null);
        setUser(null);
        setRole(null);
        setUserProfile(null);
        setIsLoading(false);
      }
    });

    // 2. Auth State Change Listener (handles login, logout, token refresh)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, newSession) => {
      if (!isMounted) return;

      if (event === 'SIGNED_OUT' || !newSession) {
        if (user?.id) {
          AsyncStorage.removeItem(`${PROFILE_CACHE_PREFIX}${user.id}`).catch(() => {});
        }
        setSession(null);
        setUser(null);
        setRole(null);
        setIsProfileComplete(true);
        setUserProfile(null);
        setIsLoading(false);
        return;
      }

      setSession(newSession);
      setUser(newSession.user);

      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'USER_UPDATED') {
        syncUserProfile(newSession);
      }
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  /**
   * Atomic sign-in method:
   * - Double-submission mutex lock (guaranteed reset in finally block)
   * - 15-second timeout protection with safe timer cleanup
   * - User enumeration defense: generic message on failed credentials
   * - Post-authentication account status evaluation (inactive/pending)
   * - Saves non-sensitive email suggestions
   */
  const signIn = async (email: string, password: string, rememberMe = false): Promise<SignInResult> => {
    if (isSigningInRef.current) {
      return { success: false, error: 'Sign in already in progress' };
    }

    const trimmedEmail = email.trim().toLowerCase();
    if (!trimmedEmail || !password) {
      return { success: false, error: 'Email and password are required' };
    }

    isSigningInRef.current = true;
    let timeoutTimer: ReturnType<typeof setTimeout> | null = null;

    try {
      // 15-second timeout protection with explicit cleanup
      const timeoutPromise = new Promise<{ data: any; error: any }>((_, reject) => {
        timeoutTimer = setTimeout(() => {
          reject(new Error('Connection timed out. Please check your internet connection.'));
        }, 15000);
      });

      const authPromise = supabase.auth.signInWithPassword({
        email: trimmedEmail,
        password,
      });

      const { data, error } = await Promise.race([authPromise, timeoutPromise]);

      if (timeoutTimer) {
        clearTimeout(timeoutTimer);
      }

      if (error) {
        // Enforce user enumeration defense: generic invalid credentials error
        const mapped = mapAuthError(error);
        return { success: false, error: mapped.message };
      }

      if (!data?.session || !data.user) {
        return { success: false, error: 'Unable to establish session. Please try again.' };
      }

      // Cryptographic identity established; set session
      setSession(data.session);
      setUser(data.user);

      // Now authoritatively verify account status from database
      const syncResult = await syncUserProfile(data.session, true);

      if (syncResult?.status === 'inactive' || syncResult?.status === 'pending') {
        const statusNotice = formatAccountStatusNotice(syncResult.status);
        return {
          success: false,
          status: syncResult.status,
          error: statusNotice.message,
        };
      }

      // Update remembered email and suggestion history (email string only; no passwords)
      await setRememberedEmail(trimmedEmail, rememberMe);

      return {
        success: true,
        role: syncResult?.role || (data.user.user_metadata?.role as UserRole) || null,
        isProfileComplete: syncResult?.isProfileComplete ?? true,
      };
    } catch (err: unknown) {
      if (timeoutTimer) {
        clearTimeout(timeoutTimer);
      }
      const mapped = mapAuthError(err);
      return { success: false, error: mapped.message };
    } finally {
      // Guaranteed lock release: prevents permanent loading states
      isSigningInRef.current = false;
    }
  };

  const can = (permission: PermissionCode): boolean => {
    if (!role) return false;
    return roleHasPermission(role, permission);
  };

  const canAny = (permissions: PermissionCode[]): boolean => {
    if (!role) return false;
    return hasAnyPermission(role, permissions);
  };

  const signOut = async (): Promise<void> => {
    try {
      const { clearPersistedCache } = await import('../optimistic/persist');
      await clearPersistedCache();
    } catch (err) {
      console.warn('[useAuth] Error purging persisted cache on signout:', err);
    }

    if (user?.id) {
      AsyncStorage.removeItem(`${PROFILE_CACHE_PREFIX}${user.id}`).catch(() => {});
    }

    setSession(null);
    setUser(null);
    setRole(null);
    setIsProfileComplete(true);
    setUserProfile(null);

    await supabase.auth.signOut();
  };

  const refreshSession = async (): Promise<void> => {
    const { data: { session } } = await supabase.auth.getSession();
    setSession(session);
    setUser(session?.user ?? null);
    await syncUserProfile(session, true);
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
        signIn,
        signOut,
        refreshSession,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => useContext(AuthContext);
