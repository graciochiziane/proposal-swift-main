// ============================================================
// Auth Helpers — Shared utilities for role-based access control
//
// P1-H11 (2026-08-13): Created to support role-based route guards
//   in ProtectedRoute. Provides a synchronous way to read the
//   current user's platform role from the auth context.
// ============================================================

import { supabase } from '@/integrations/supabase/client';

export type PlatformRole = 'admin' | 'user';

// Cache the role to avoid repeated DB queries within the same session
let cachedRole: PlatformRole | null = null;
let cachedUserId: string | null = null;

/**
 * Returns the current user's platform role.
 * Uses an in-memory cache keyed by user ID — when the user changes
 * (login/logout), the cache is automatically invalidated.
 *
 * This is a SYNCHRONOUS read from cache. The cache must be populated
 * first by calling refreshRole() after login.
 *
 * Returns null if:
 *   - User is not authenticated
 *   - Role has not been loaded yet (call refreshRole() first)
 */
export function hasRole(): PlatformRole | null {
  return cachedRole;
}

/**
 * Refreshes the cached role from the database.
 * Should be called:
 *   - After successful login
 *   - After role changes (e.g., admin grants/revoke)
 *   - On app initialization if user session exists
 */
export async function refreshRole(): Promise<PlatformRole | null> {
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    cachedRole = null;
    cachedUserId = null;
    return null;
  }

  // If user changed, invalidate cache
  if (cachedUserId !== user.id) {
    cachedRole = null;
    cachedUserId = user.id;
  }

  // If we already have the role, return it
  if (cachedRole) {
    return cachedRole;
  }

  // Otherwise, query the database
  const { data: roleRow } = await supabase
    .from('user_roles')
    .select('role')
    .eq('user_id', user.id)
    .maybeSingle();

  cachedRole = (roleRow?.role as PlatformRole) ?? 'user';
  return cachedRole;
}

/**
 * Clears the cached role. Should be called on logout.
 */
export function clearRoleCache(): void {
  cachedRole = null;
  cachedUserId = null;
}
