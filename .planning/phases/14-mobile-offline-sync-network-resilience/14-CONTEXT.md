# Phase 14: Mobile Offline Sync & Network Resilience - Context

**Gathered:** 2026-09-09
**Status:** Ready for planning

<domain>
## Phase Boundary

Phase 14 delivers offline-first operational capabilities for the ReachInternational mobile application (`apps/mobile/`). Specifically, it provides local persistence for machine hour meter logs and breakdown submissions when mobile devices lose connectivity in remote industrial sites, automatic background synchronization when network reconnects, collision resolution for overlapping shifts, and clear operator-facing visual status indicators.

</domain>

<decisions>
## Implementation Decisions

### 1. Offline Queue Persistence & Storage Mechanism
- **D-01:** Dedicated typed AsyncStorage mutation queue (`@react-native-async-storage/async-storage`) managing pending shift submissions with explicit lifecycle statuses (`pending`, `syncing`, `failed`, `conflict`). This queue operates independently of React Query's in-memory cache to guarantee zero data loss across app reloads and process kills. — **Reversibility:** reversible
- **D-02:** Immediate optimistic insertion into main mobile operational feeds (`apps/mobile/app/(app)/operations.tsx`). Newly created offline shift logs appear instantly in the operator's log stream accompanied by an amber "Pending Sync" status pill, automatically promoting to verified state once acknowledged by Supabase. — **Reversibility:** reversible

### 2. Sync Triggering & Network Reconnection Behavior
- **D-03:** Automatic background synchronization executed upon network reconnection detected via `@react-native-community/netinfo` event listeners. To provide operators with direct control in spotty cellular yards, an interactive "Sync Now" CTA button is exposed on the offline status banner. — **Reversibility:** reversible
- **D-04:** Network failure retry policy utilizes exponential backoff across 3 attempts (2s, 5s, 10s). If all retries fail due to network drops, the queue item transitions to `failed` status and exposes an explicit "Retry" button on the affected card. — **Reversibility:** reversible

### 3. Conflict Resolution & Idempotency Strategy
- **D-05:** In the event of a database constraint rejection (such as `prevent_overlapping_shifts` or backwards hour meter sequence from another concurrent operator), the mobile app preserves the offline draft, flags it as `conflict`, and launches an "Edit & Resubmit" bottom sheet presenting the conflicting server shift window so the operator can adjust timings. — **Reversibility:** costly — touches mutation pipeline and bottom sheet UX.
- **D-06:** Client generates a cryptographically unique UUID `idempotency_key` upon local log creation. This key is transmitted to the backend RPC mutation to guarantee exactly-once persistence and prevent duplicate entries during network retries. — **Reversibility:** one-way — establishes database idempotency contract.

### 4. Offline UI States & Operator Visual Indicators
- **D-07:** Slim persistent top status banner rendered across mobile screens whenever device is disconnected: `"Working Offline · X logs queued"`, paired with a subtle offline pill in the app header. — **Reversibility:** reversible
- **D-08:** High-contrast status badges on mobile cards:
  - Amber `Pending Sync` (clock icon) for local drafts.
  - Blue `Syncing...` (animated activity indicator) during upload.
  - Green `Synced` (check icon, auto-fades after confirmation).
  - Red `Sync Error / Overlap` (alert triangle) for failed or rejected submissions. — **Reversibility:** reversible

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project & Roadmap Specifications
- `.planning/PROJECT.md` — Core value, single Supabase backend constraint, and locked architectural decisions.
- `.planning/REQUIREMENTS.md` — `MOB-03` (Offline submission queue) and `OPS-01` through `OPS-04` (Shift rules).
- `.planning/ROADMAP.md` — Phase 14 scope, success criteria, and dependencies on Phase 12 and Phase 13.

### Codebase Architecture & Conventions
- `.planning/codebase/ARCHITECTURE.md` — Monorepo layering, single Supabase datastore rule, and mutation flow.
- `.planning/codebase/CONVENTIONS.md` — Vercel Geist design tokens, min 44px touch targets, and web-to-mobile sync rule.
- `.planning/codebase/INTEGRATIONS.md` — Supabase client configuration and authentication storage.

### Target Mobile Implementation Files
- `apps/mobile/app/(app)/operations.tsx` — Main mobile operations screen with daily hour logs feed.
- `apps/mobile/components/work/MeterLogModal.tsx` — Mobile shift hour log and breakdown modal entry form.
- `apps/mobile/lib/supabase.ts` — Mobile Supabase client instance with session token persistence.
- `packages/validation/src/` — Canonical Zod schemas for machine hour logs and shift validation.
- `supabase/migrations/033_machine_log_sequencing_and_overlap_prevention.sql` — Database shift sequencing and overlap trigger rules.
</canonical_refs>
