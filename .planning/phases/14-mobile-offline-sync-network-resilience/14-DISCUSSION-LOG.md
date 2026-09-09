# Phase 14: Mobile Offline Sync & Network Resilience - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-09-09
**Phase:** 14-mobile-offline-sync-network-resilience
**Areas discussed:** Offline Queue Persistence, Sync Triggering & Network Reconnect, Conflict Resolution & Idempotency, Offline UI States & Status Badges

---

## Offline Queue Persistence & Storage Mechanism

| Option | Description | Selected |
|--------|-------------|:--------:|
| Dedicated typed AsyncStorage queue | Explicit FIFO queue with pending/syncing/failed states decoupled from UI cache | ✓ |
| TanStack Query persister | Dehydrate and persist mutation state directly within TanStack Query cache | |
| Full local SQLite table | Embedded relational tables for offline logs and drafts | |

**User's choice:** Dedicated typed AsyncStorage queue with status tracking.
**Notes:** Provides crash-resilient local persistence independent of query cache invalidations. Also agreed on immediate optimistic UI insertion with amber "Pending Sync" pills.

---

## Sync Triggering & Network Reconnection Behavior

| Option | Description | Selected |
|--------|-------------|:--------:|
| Automatic background sync + manual CTA | Auto-sync on network restore (NetInfo listener) with manual 'Sync Now' button as backup | ✓ |
| Manual sync only | Prompt operator before uploading | |
| Silent auto-sync only | Fully backgrounded with no manual controls | |

**User's choice:** Automatic background sync on network restore with manual "Sync Now" CTA button.
**Notes:** Exponential backoff retry (3 attempts: 2s, 5s, 10s) before marking status as failed with a visible Retry button.

---

## Conflict Resolution & Shift Overlap Guarding

| Option | Description | Selected |
|--------|-------------|:--------:|
| Edit & Resubmit sheet on conflict | Flag log with 'Conflict', retain draft, open bottom sheet showing server collision | ✓ |
| Auto-discard rejected log | Discard and toast operator | |
| Admin portal intervention | Require web portal escalation | |

**User's choice:** Flag with conflict status, retain draft, and launch Edit & Resubmit bottom sheet.
**Notes:** Also selected UUID `idempotency_key` generation to guarantee exactly-once persistence during retry storms.

---

## Offline UI States & Operator Visual Indicators

| Option | Description | Selected |
|--------|-------------|:--------:|
| Slim persistent top status banner | Banner when offline ('Working Offline · X logs queued') with wifi-off header pill | ✓ |
| Floating bottom pill | Floating action pill expanding to sheet | |
| Modal-only warning | Alert only when submitting form | |

**User's choice:** Slim persistent top status banner with header pill.
**Notes:** Cards feature 4 clear lifecycle badges: Amber (Pending Sync), Blue (Syncing...), Green (Synced), Red (Sync Error / Overlap).

---

## Deferred Ideas

- Direct SQLite relational caching for whole app offline viewing — noted for potential future field-service expansion.
