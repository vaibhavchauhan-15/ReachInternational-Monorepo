# Current Task

## Task: Fix Migration 157 Type Mismatch (operator does not exist: text = uuid)
**Status**: ✅ COMPLETED / VERIFIED
**Date**: 2026-10-03
**Type**: Database Migration / PostgreSQL Type Safety / Client Deduplication

## Root Cause
When executing Migration 157 (`supabase/migrations/157_clients_deduplication_and_unique_company.sql`), Step 1 attempted to delete audit logs referencing duplicate clients:
```sql
DELETE FROM public.audit_logs
WHERE entity_type = 'clients'
  AND entity_id IN (
    SELECT c2.id
    ...
```
- In `public.audit_logs`, `entity_id` is defined as `TEXT`.
- In `public.clients`, `id` is defined as `UUID`.
- PostgreSQL has no default `=` equality operator between `TEXT` and `UUID`, resulting in `ERROR: 42883: operator does not exist: text = uuid` on line 16.

## Solution Implemented
1. Explicitly cast `c2.id::text` in the subquery so PostgreSQL compares `TEXT = TEXT`.
2. Broadened entity type filter to `WHERE entity_type IN ('clients', 'client')` to cover plural and singular conventions.
3. Added deterministic tie-breaking on creation timestamps: `(c2.created_at > c1.created_at OR (c2.created_at = c1.created_at AND c2.id > c1.id))` to avoid race conditions or unhandled duplicates if records share identical millisecond timestamps.

## Files Modified
- `supabase/migrations/157_clients_deduplication_and_unique_company.sql`

## Verification
- Monorepo Typecheck: Clean pass across 7/7 packages (`pnpm typecheck`).
- Subquery test executed successfully against Dev DB (`vlmxciuogczumumrwyot`) returning count without type errors.
