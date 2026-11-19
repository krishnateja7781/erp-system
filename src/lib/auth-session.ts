/**
 * DEPRECATED — This file is a legacy artifact from before the Supabase Auth migration.
 *
 * iron-session and bcrypt-based session management are NO LONGER USED.
 * All authentication is now handled by Supabase Auth (@supabase/ssr).
 *
 * - Auth:       Use `createServerSupabaseClient()` from `@/lib/supabase`
 * - Session:    Use `getSession()` from `@/actions/auth-actions`
 * - Sign-out:   Use `signOutAction()` from `@/actions/auth-actions`
 *
 * This file is kept temporarily to avoid breaking any remaining import
 * that may reference it. It should be deleted once all call-sites are migrated.
 */

// Re-export nothing — this module is intentionally empty.
export {};
