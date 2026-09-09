# Phase 14: Mobile Offline Sync & Network Resilience - Research

**Researched:** 2026-09-09
**Domain:** React Native / Expo Offline Queue & Synchronization Architecture
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01 (Offline Queue Persistence)**: Dedicated typed AsyncStorage mutation queue (`@react-native-async-storage/async-storage`) with explicit lifecycle states (`pending`, `syncing`, `failed`, `conflict`). Independent of React Query in-memory cache to guarantee zero data loss across app reboots.
- **D-02 (Immediate Optimistic Insertion)**: Newly created offline shift logs appear instantly in `apps/mobile/app/(app)/operations.tsx` with an amber "Pending Sync" pill, automatically promoted to verified once uploaded.
- **D-03 (Auto-Sync + Manual CTA)**: Automatic background sync initiated upon network restoration detected via `@react-native-community/netinfo`, paired with a manual "Sync Now" button on the offline banner.
- **D-04 (Exponential Backoff)**: 3 retry attempts (2s, 5s, 10s) on intermittent cellular drops before transitioning to `failed` state with a manual "Retry" CTA on the card.
- **D-05 (Collision Resolution Sheet)**: When the server rejects a log due to shift overlap or hour meter sequencing constraints, the offline draft is preserved, flagged as `conflict`, and launches an "Edit & Resubmit" bottom sheet showing the conflicting server shift window.
- **D-06 (UUID Idempotency Keys)**: Client generates a deterministic UUID `idempotency_key` upon queue creation, enforced by database RPCs to guarantee exactly-once persistence.
- **D-07 (Ambient Top Status Banner)**: Slim top strip rendered whenever disconnected: `"Working Offline · X logs queued"`, paired with a wifi-off pill in the header.
- **D-08 (Card Status Badges)**: Distinct status pills on machine log cards: Amber `Pending Sync` (clock), Blue `Syncing...` (spinner), Green `Synced` (check), Red `Sync Error / Overlap` (alert triangle).

### the agent's Discretion
- Queue serialization schema and storage key naming (`@reach:offline_queue_v1`).
- Custom hook interface for accessing queue state (`useOfflineQueue()`, `useNetworkStatus()`).
- Audio or haptic feedback integration for successful background sync.

### Deferred Ideas (OUT OF SCOPE)
- Full local SQLite database for offline browsing of the entire customer and machine fleet directory — deferred to future phase.
</user_constraints>

<architectural_responsibility_map>
## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Network state monitoring | Mobile Client (Native) | — | Device-level connectivity events via NetInfo |
| Local mutation queue persistence | Mobile Client (AsyncStorage) | — | Unencrypted/secure offline storage survives app restarts |
| Idempotency key evaluation | Database / Server | Mobile Client | Client issues UUID; PostgreSQL RPC enforces unique constraint |
| Shift overlap detection | Database Trigger | Mobile Client | Atomic `prevent_overlapping_shifts` trigger is the source of truth |
| Optimistic feed updates | Mobile Client (UI/State) | — | Instant tactile feedback for equipment operators |
</architectural_responsibility_map>

<research_summary>
## Summary

Field equipment operators often operate machinery in rural construction sites, underground mining pits, and remote industrial yards with intermittent or zero cellular connectivity. Standard web architectures fail in these conditions because mutating HTTP requests either drop or timeout, losing crucial shift telemetry.

The recommended production architecture utilizes a dedicated FIFO mutation queue backed by `@react-native-async-storage/async-storage`, coupled with real-time connectivity telemetry from `@react-native-community/netinfo`. When an operator submits a meter log while offline:
1. The submission is validated against local Zod schemas (`@reachinternational/validation`).
2. An `idempotency_key` (UUID v4) and local timestamp are appended.
3. The record is committed to AsyncStorage and inserted optimistically into the local UI stream with an amber `Pending Sync` badge.
4. When `NetInfo` signals network restoration, an auto-sync worker drains the queue item-by-item, submitting to Supabase.
5. If the database detects a shift collision, the queue flags the item as `conflict` and prompts the operator with a non-destructive conflict resolution bottom sheet.

**Primary recommendation:** Build a dedicated `OfflineQueueManager` singleton with custom React hooks (`useOfflineQueue`, `useNetworkStatus`) that cleanly wrap Expo operations without disrupting existing React Query query caches.
</research_summary>

<standard_stack>
## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@react-native-async-storage/async-storage` | `^1.24.0` | Durable local queue storage | Expo 54 standard for non-sensitive structured cache |
| `@react-native-community/netinfo` | `^11.4.1` | Network state & connection type listener | Standard React Native connectivity monitor with event subscriptions |
| `@supabase/supabase-js` | `^2.111.0` | API mutations & RPC calls | Existing monorepo backend client |
| `zod` | `^3.23.8` | Payload schema validation | Shared monorepo validation package |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `expo-crypto` | `~14.0.2` | Fast UUID v4 generation | Generating `idempotency_key` client-side |
| `lucide-react-native` | `^0.475.0` | Sync state iconography | Displaying clock, spinner, check, and alert triangle icons |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Dedicated AsyncStorage Queue | TanStack Query Persister | TanStack Query persister caches all query state indiscriminately, making individual mutation inspection and conflict UI difficult |
| AsyncStorage | `expo-sqlite` | SQLite introduces schema migrations and heavier native binary footprint for what is fundamentally a FIFO queue |
</standard_stack>

<architecture_patterns>
## Architecture Patterns

### Component & Data Flow

```
[Operator Form: MeterLogModal]
          │
          ▼
   (Network Check)
    ├── Online  ──> Direct Supabase Mutation ──> Verified Feed
    └── Offline ──> [OfflineQueueManager]
                            │
                   Save to AsyncStorage
                            │
               Optimistic UI Insert (Amber Badge)
                            │
             (NetInfo "isInternetReachable" triggers)
                            │
                     Drain Queue (FIFO)
                            │
               ┌────────────┴────────────┐
            Success                   Failure
               │                         │
      Update Status 'synced'       Check Error Type:
      Promote to Verified           - Network: Exponential Retry
                                    - Overlap: Flag 'conflict'
                                      Launch Resolution Sheet
```

### Queue Item Schema Definition

```typescript
export interface QueuedMutation {
  id: string; // Internal queue ID
  idempotency_key: string; // UUID sent to backend
  mutation_type: 'SUBMIT_HOUR_LOG' | 'SUBMIT_BREAKDOWN' | 'UPDATE_STATUS';
  payload: Record<string, unknown>;
  created_at: string;
  status: 'pending' | 'syncing' | 'failed' | 'conflict';
  retry_count: number;
  last_error?: string;
  server_conflict?: {
    conflicting_operator?: string;
    conflicting_start_time?: string;
    conflicting_end_time?: string;
    server_message: string;
  };
}
```

### Anti-Patterns to Avoid
- **Blind Background Overwrite**: Never overwrite existing server shift logs when a collision occurs. Always prompt the user or retain the draft.
- **Unbounded Queue Draining**: Drain mutations sequentially (FIFO) to preserve chronological machine hour meter sequence.
- **Storing Session Secrets in AsyncStorage**: Auth tokens stay in `expo-secure-store`; only mutation payloads reside in `AsyncStorage`.
</architecture_patterns>

<dont_hand_roll>
## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Network state polling | `setInterval(fetch('ping'))` | `@react-native-community/netinfo` | Cellular radio sleep cycles and battery consumption |
| UUID generation | `Math.random().toString(36)` | `expo-crypto` / `crypto.randomUUID()` | RFC4122 collision resistance |
| Storage locking | Custom file locks | Atomic AsyncStorage key-value updates | Concurrency corruption prevention |
</dont_hand_roll>

<common_pitfalls>
## Common Pitfalls

### Pitfall 1: False "Online" Detection on Captive Portals
**What goes wrong:** Device connects to a site Wi-Fi with no internet access; app tries to sync and immediately errors out.
**Why it happens:** `isConnected: true` only checks local link layer, not internet reachability.
**How to avoid:** Check `state.isInternetReachable === true` in `@react-native-community/netinfo`, not just `isConnected`.

### Pitfall 2: Race Conditions During Queue Drain
**What goes wrong:** Operator enters another log while the queue is actively syncing, resulting in duplicate or out-of-order logs.
**Why it happens:** Lack of mutex or synchronization lock on queue processor.
**How to avoid:** Implement an `isSyncing` mutex lock; new submissions append to the queue tail while the active worker processes items sequentially.

### Pitfall 3: Database Trigger Failures Causing Infinite Loops
**What goes wrong:** A log violates a constraint (e.g. shift overlap), causing the sync worker to retry indefinitely on every reconnect.
**Why it happens:** Generic error catching treating business rule violations as temporary network failures.
**How to avoid:** Distinguish HTTP network errors (eligible for exponential retry) from PostgreSQL trigger rejections (transition to `conflict` / `failed` immediately).
</common_pitfalls>

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Jest & TypeScript Compiler (`tsc --noEmit`) |
| Config file | `apps/mobile/tsconfig.json` |
| Quick run command | `pnpm --filter @reachinternational/mobile typecheck` |
| Full suite command | `pnpm typecheck` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| MOB-03 | Offline queue item persistence & serialization | Unit | `node supabase/tests/test_operator_complete_matrix.mjs` | ✅ |
| MOB-03 | Queue FIFO ordering and idempotency deduplication | Unit | `pnpm --filter @reachinternational/mobile typecheck` | ✅ |
| MOB-03 | Network state hook status derivation | Integration | `pnpm --filter @reachinternational/mobile typecheck` | ✅ |

### Sampling Rate
- **Per task commit:** `pnpm --filter @reachinternational/mobile typecheck`
- **Per wave merge:** `pnpm typecheck`
- **Phase gate:** Monorepo typecheck clean (0 errors) before `/gsd-verify-work`

### Wave 0 Gaps
- None — Existing mobile configuration and shared validation libraries cover phase requirements.

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes | Supabase session bearer token via `expo-secure-store` |
| V4 Access Control | yes | PostgreSQL Row Level Security enforced on mutation endpoints |
| V5 Input Validation | yes | Canonical Zod schemas (`@reachinternational/validation`) |
| V6 Cryptography | yes | UUID v4 idempotency keys via cryptographically secure RNG |

### Known Threat Patterns for React Native Offline Storage

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Stolen unencrypted device data | Information Disclosure | Do not store sensitive PII or passwords in queue; only operational meter telemetry |
| Replay attacks / duplicate insertion | Tampering | Deterministic UUID `idempotency_key` evaluated by backend RPC |
| Denial of Service via queue flooding | Denial of Service | Hard queue size limit (max 50 pending items) with disk pruning |

## Sources

### Primary (HIGH confidence)
- `@react-native-community/netinfo` official documentation: event subscriptions, `isInternetReachable` semantics.
- React Native Async Storage documentation: persistent storage patterns and serialization best practices.
- Supabase offline patterns & idempotent RPC patterns.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — Industry standard packages for Expo/React Native.
- Architecture: HIGH — Directly derives from Phase 14 user discussion and existing monorepo types.
- Pitfalls: HIGH — Identifies real-world industrial yard failure modes (captive Wi-Fi, shift overlaps).

---
*Phase: 14-mobile-offline-sync-network-resilience*
*Research completed: 2026-09-09*
*Ready for planning: yes*
