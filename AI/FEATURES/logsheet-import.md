# Admin Bulk Machine Logsheet (Excel) Import

**Status**: ✅ Implemented & Verified (Dev DB) — 2026-11-26
**Migration**: `supabase/migrations/244_machine_logsheet_bulk_import.sql` (+ rollback) — applied to Dev DB `vlmxciuogczumumrwyot`
**Permission**: `machine.logs_import` (`MACHINE_CAPABILITIES.LOGS_IMPORT`) — `super_admin` + `admin` only

## Overview

Admin-only bulk import of historical/paper machine hour-logsheet records into the existing
`machine_hour_logs` table via standardized Excel (.xlsx) upload on the Operations page.
No parallel logsheet system: imported records are indistinguishable from manual logs except
`entry_source = 'admin'` and `entered_by = importing admin`.

## Flow (Web wizard — 5 steps)

1. **Machine** — select the target machine (exact `machine_id` match; batch imports are single-machine).
2. **Template** — download the standardized template generated from the live schema
   (`Logsheet Data` + `Instructions` + `Data Dictionary` sheets, v1.0, marked example rows).
3. **Upload** — drag-and-drop .xlsx (≤ 10 MB, ≤ 1000 rows, ZIP magic-byte format check).
4. **Review** — full row-by-row validation preview: statuses valid/warning/duplicate/invalid/review;
   per-issue column, original value, reason, expected format; intra-file + DB duplicate detection
   (machine+date+shift, operator+date+shift, timeline overlaps) never overwrites existing logs;
   downloadable error-report CSV.
5. **Import** — confirmation dialog with counts/date-range/hours → atomic `import_machine_hour_logs_bulk`
   RPC (all-or-nothing) → commit verified against `inserted_log_ids` before success is reported →
   audit record in `machine_log_imports` (machine, admin, filename, checksum, counts, log IDs).

## Column Model (14 columns, NO trusted DB identifiers)

`log_date, operator_employee_id, operator_name, shift_code, start_time, end_time,
start_hmr, end_hmr, overtime_hours, machine_condition, is_breakdown, breakdown_start_time,
breakdown_end_time, remarks`

Machine identity comes from the wizard; operator identity is resolved server-side by
`employee_id` (exact) or exact unique `full_name` — ambiguous operators are held for review.
`running_hours` is DB-generated (`end_meter - start_meter`). `entry_source`, `entered_by`,
`shift`, `shift_code` derivation, `assignment_id` linkage and meter semantics match the existing
manual logsheet exactly.

## Architecture

| Layer | File | Responsibility |
|---|---|---|
| Capability | `packages/permissions/src/machines.ts`, `matrix.ts` | `machine.logs_import`, admin-only |
| Canonical validation | `packages/validation/src/logsheetImport.ts` | Column model, parsers, business rules, conflict detection, payload schema |
| DB audit + RPC | `supabase/migrations/244_machine_logsheet_bulk_import.sql` | `machine_log_imports` (RLS admin-read-only), `import_machine_hour_logs_bulk(jsonb)` SECURITY DEFINER, in-RPC role re-check, two-pass validate-then-insert, notification suppression, non-regressing hour-meter advance, in-tx commit verification |
| Server | `apps/web/lib/server/logsheet-import/` (`parse.ts`, `validate.ts`, `template.ts`, `types.ts`) | XLSX structural parsing, full validation pipeline (batched queries, no N+1), template generation |
| Actions | `apps/web/app/actions/logsheet-import.ts` | `validateLogsheetImportAction` (read-only), `importLogsheetAction` (checksum-bound, verified commit, audit), history/machines/checksum actions |
| Template route | `apps/web/app/api/operations/logsheet-import/template/route.ts` | Authenticated, capability-gated .xlsx download |
| Web UI | `apps/web/components/operations/import/LogsheetImportModal.tsx`, `LogsheetImportPreviewTable.tsx` | 5-step wizard, preview table + mobile cards |
| Native | `apps/mobile/components/operations/LogsheetImportModal.tsx` | Informational bottom-sheet guide + share (Excel upload is web-portal-only; documented parity exception) |

## Security Invariants

- Admin-only at 3 layers: capability guard (actions/route), UI gating, and in-RPC re-verification of
  the real `users.role` (client JWT claims are never trusted).
- RPC called with the **user's session client** (`lib/supabase/server`) so `auth.uid()` resolves correctly;
  the privileged admin client only performs post-commit verification reads.
- `REVOKE ... FROM PUBLIC/anon` on the RPC; `machine_log_imports` has SELECT-only RLS (admin), writes
  only via the definer function. RLS on `machine_hour_logs` is untouched; existing triggers/constraints
  (overlap, meter, duplicate keys, immutability) run on every imported row.
- No service-role keys reach the client bundle; spreadsheet can never set machine/operator IDs.

## Key Decisions

- **Template columns carry no trusted IDs** (`machine_id`/`operator_id`/`assignment_id` excluded) — identity
  is resolved server-side against `public.users`; ambiguity blocks the row for review.
- **Duplicate policy**: rows matching existing machine/date/shift OR operator/date/shift logs are marked
  `duplicate` and NEVER imported; they require explicit removal from the file (never auto-skipped silently).
- **Idempotency**: `import_token` (UNIQUE) + checksum binding; a retried confirmation returns the original
  result (`already_imported: true`) and can never double-insert.
- **Native parity exception**: Excel upload remains web-only (native shows an informational guide + share,
  matching the existing `MachineImportModal` precedent).

## Bugfix — false "operator ambiguous" on every row (2026-11-26)

**Root cause**: `resolveOperators` cross-indexed the same `users` record into the match lists twice (by-ID and by-name batched query loops both populated both maps). Rows carrying both Employee ID and Name — the normal case — hit `matches.length === 2` and were falsely flagged `operator_ambiguous`, blocking the whole file.

**Fix**: union of query results de-duplicated by record id; pure `matchOperatorToRow()` in `@reachinternational/validation` (unique-ID resolution, name-based disambiguation of genuinely shared IDs → warning `operator_disambiguated_by_name`, ambiguity errors listing exact candidate records). `shiftCodeKey` now canonicalizes A↔S1/B↔S2/C↔S3/D↔S4 + digits (mirrors existing `OperationsLogsTable` UI semantics) for duplicate detection and assignment linkage; migration 244 RPC pre-check aligned via SQL `logsheet_shift_key()`.

**Verified live** with a real 62-row workbook: operators resolve, only genuinely affected rows are flagged with row-specific messages, and re-uploads of already-imported data are blocked row-by-row as duplicates (never double-inserted).

## Tests

- `tests/logsheet-import/test-logsheet-import-engine.mjs` — 17/17 (template round-trip, structural, field, business, duplicate semantics)
- `tests/logsheet-import/test-logsheet-import-security.mjs` — 16/16 (RBAC matrix, server enforcement, credential hygiene, no trusted IDs)
- `tests/logsheet-import/test-logsheet-import-db.mjs` — 13/13 live Dev DB (auth rejection ×2, atomic import, verification, audit, idempotent retry, duplicate rejection, zero-partial rollback, meter/future-date rejection, privilege/RLS hardening)
- `packages/validation` vitest — 81/81 · `packages/permissions` vitest — 38/38
- Registered in `scripts/run-all-tests.mjs` (3 suites).
