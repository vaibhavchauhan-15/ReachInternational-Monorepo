import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { cache } from "react";
import { getSupabaseUrl, getSupabasePublishableKey } from "@/lib/env/client";
import type { User, AuthError } from "@supabase/supabase-js";

export type GetCachedAuthUserResult = {
  data: { user: User | null };
  error: AuthError | null;
};

/**
 * Per-request React cache() memoized auth.getUser() call.
 * Eliminates 10–20 redundant /auth/v1/user network roundtrips per page render.
 * Scoped automatically to the lifetime of a single Server Component render or Server Action request.
 */
export const getCachedAuthUser = cache(async (): Promise<GetCachedAuthUserResult> => {
  const cookieStore = await cookies();

  const supabase = createServerClient(
    getSupabaseUrl(),
    getSupabasePublishableKey(),
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll() {
          // Read-only inspection for cached auth user
        },
      },
    }
  );

  return supabase.auth.getUser();
});

/**
 * Factory for Supabase server-side SSR client with per-request cookie access
 * and memoized auth.getUser() delegating to React cache().
 */
export const createSupabaseServerClient = cache(async () => {
  const cookieStore = await cookies();

  const client = createServerClient(
    getSupabaseUrl(),
    getSupabasePublishableKey(),
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // The `setAll` method was called from a Server Component.
            // This can be ignored if you have middleware refreshing sessions.
          }
        },
      },
    }
  );

  // Wrap getUser in React cache() per request
  const originalGetUser = client.auth.getUser.bind(client.auth);
  client.auth.getUser = (async (jwt?: string) => {
    // If an explicit JWT string is passed, bypass the cookie cache and validate it directly
    if (typeof jwt === "string" && jwt.trim().length > 0) {
      return originalGetUser(jwt);
    }
    return getCachedAuthUser();
  }) as typeof client.auth.getUser;

  return client;
});
