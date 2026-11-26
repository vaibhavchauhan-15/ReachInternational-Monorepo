/**
 * ReachInternational — Shared Push Notification Payload & Route Types
 *
 * Consumes the single notification type registry owned by the in-app
 * notifications task (`./notifications`). This file is the push-side view of
 * that registry: it MUST NOT introduce new categories or routes. The runtime
 * route allowlist is derived from a `Record<NotificationRouteKey, ...>` so
 * TypeScript enforces completeness against the registry union — a new registry
 * route breaks the build until it is added here deliberately.
 */

import type { NotificationPriority, NotificationRouteKey } from './notifications';

/**
 * Canonical route allowlist for push deep links (web + native parity).
 * Mirrors the DB-side allowlist in `trg_sync_notification_route`
 * (supabase/migrations/242_in_app_notifications_inbox_and_keyset_rpc.sql):
 * allowed deep-link path prefixes per registry route key.
 */
const ROUTE_KEY_REGISTRY: Record<NotificationRouteKey, readonly string[]> = {
  operations: ['/operations'],
  machines: ['/machines'],
  users: ['/users'],
  approvals: ['/approvals'],
  payroll: ['/payroll'],
  attendance: ['/attendance'],
  rfq: ['/admin/sales/rfq', '/rfq'],
  settings: ['/settings'],
  dashboard: ['/dashboard', '/'],
};

export const PUSH_ROUTE_ALLOWLIST: readonly NotificationRouteKey[] =
  Object.keys(ROUTE_KEY_REGISTRY) as NotificationRouteKey[];

/** Allowed deep-link path prefixes, derived from the registry (no second copy). */
export const PUSH_ROUTE_PREFIXES: readonly string[] = Object.values(
  ROUTE_KEY_REGISTRY
).flat();

/** Returns true when a deep-link path targets an allowlisted same-origin route. */
export function isAllowedPushDeepLink(link: unknown): link is string {
  if (typeof link !== 'string') return false;
  const trimmed = link.trim();
  // Relative same-origin path only (no scheme, no host, no //)
  if (!/^\/(?!\/)[A-Za-z0-9/_\-?=&%.]*$/.test(trimmed)) return false;
  const pathname = trimmed.split('?')[0].replace(/\/$/, '') || '/';
  return PUSH_ROUTE_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  );
}

/**
 * Push payload data carried to the client. Opaque non-enumerable references
 * only (`nid` is a random UUID used for client-side dedupe, never as an
 * authorization credential). No raw URLs, sequential IDs, recipient ids or
 * auth tokens.
 */
export interface PushTapData {
  nid: string;
  link: string;
  priority: NotificationPriority | string;
  category: string;
}

export interface PushPayload extends PushTapData {
  title: string;
  body: string;
  tag?: string;
}
