/**
 * Canonical deduplication for today's shift log monitor rows.
 *
 * The implementation lives in `@reachinternational/utils` so Web and Native Mobile
 * share exactly one rule set (entered › pending › unassigned). This module keeps the
 * historical web import path working.
 */
export { dedupeShiftMonitorRows } from "@reachinternational/utils";
