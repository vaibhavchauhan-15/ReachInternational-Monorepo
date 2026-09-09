# Codebase Concerns

**Analysis Date:** 2026-09-09

## Tech Debt

**In-Memory Relational Hydration in DAL Queries:**
- Issue: In `apps/web/lib/queries/users.ts`, supervisors and working locations are hydrated in memory via parallel `Promise.all()` lookup queries rather than single deep relational PostgREST SQL joins.
- Why: Self-referencing foreign keys on `public.users` (`supervisor_id` / `supervisor_ids`) and complex array joins in PostgREST can trigger embedded dotted column ambiguity or syntax errors.
- Impact: Requires two roundtrips to the database instead of one, though mitigated by in-memory Map caching and parallel execution.
- Fix approach: Create a materialized view or PostgreSQL database view (`public.users_with_relations`) projecting pre-joined supervisor and location names.

**Dual Supervisor Storage (`supervisor_id` & `supervisor_ids`):**
- Issue: Both a scalar `supervisor_id UUID` and an array `supervisor_ids UUID[]` exist on `public.users`.
- Why: Implemented to support multi-supervisor assignments while maintaining backward compatibility with legacy consumers and triggers.
- Impact: Requires database synchronization triggers (`sync_user_supervisor_array()`) to keep both fields in sync.
- Fix approach: Gradually migrate all legacy code paths to `supervisor_ids` and deprecate the scalar column in a future major database release.

**Large Persistent Memory Log Files:**
- Issue: `AI/STATE.md` and `AI/CHANGELOG_AI.md` are extensive (>4,000 lines / ~800KB).
- Why: The monorepo tracks an exhaustive historical audit trail of all architectural implementations and feedback cycles.
- Impact: Large memory footprint when reading full files without line bounds.
- Fix approach: Agents must view sliced line ranges (e.g. lines 1 to 100) or rely on `AI/CURRENT_TASK.md` and `.planning/codebase/` documents.

## Known Edge Cases & Operational Considerations

**Overnight Shift Calculations & Timezone Handling:**
- Symptoms: Shifts spanning past midnight (e.g., 22:00 to 06:00) could be rejected if evaluated against UTC dates.
- Trigger: Cross-day machine operation logged near midnight.
- Mitigation: All date parsing and shift window validations are strictly pinned to Indian Standard Time (IST / Asia/Kolkata, UTC+5:30) with explicit overnight duration derivation (`(end_min + 1440 - start_min)`).
- Status: Protected and verified by 31 automated tests in `supabase/tests/test_shift_timing_and_lunch_inclusion.mjs`.

**Shift Sequencing & Hour Meter Overlap:**
- Symptoms: Submitting a new log with an hour meter reading lower than the previous shift is blocked.
- Trigger: Faulty machine hour meter or clerical typo by field operator.
- Mitigation: Database trigger `prevent_overlapping_shifts` and sequencing rules enforce chronological HMR progression while providing clear UI error envelopes.

## Security Considerations

**Service Role Key Isolation:**
- Risk: Exposing `SUPABASE_SERVICE_ROLE_KEY` to client components would allow bypassing Row Level Security (RLS).
- Current mitigation: The key is strictly isolated to server-side files (`apps/web/lib/supabase/admin.ts` and Server Actions) and excluded from all client bundles via Next.js compiler checks.
- Recommendations: Continue enforcing zero client imports of admin clients; audit via automated lint rules.

**Public Unauthenticated RPC Projection Scoping:**
- Risk: Signup workflows need access to active supervisors and working locations before the user is authenticated.
- Current mitigation: Dedicated security-definer RPCs (`get_active_supervisors_public()`, `get_active_working_locations_public()`) project only `(id, full_name, email)` and `(id, name, type, city, state)`, omitting phone numbers, Aadhaar numbers, and passwords.
- Recommendations: Ensure any future public RPC strictly defines returned table columns.

**Tamper-Proof Audit Trail:**
- Risk: Unauthorized deletion or tampering of system audit logs.
- Current mitigation: `public.audit_logs` has an append-only RLS policy (no `UPDATE` or `DELETE` allowed, only `INSERT` by authorized server actors and `SELECT` by admin roles). Sensitive passwords and super-admin emails are auto-redacted before insert.

## Performance Bottlenecks & Optimization Areas

**Large Data Table Rendering (>20 rows):**
- Problem: Hydrating thousands of rows on client tables caused memory bloat and scroll degradation.
- Improvement path implemented:
  - Deployed canonical `<Pagination />` across all 39 routes in `apps/web`.
  - Migrated high-volume directories (`/users`, `/operations?tab=logs`, `/clients`, `/audit`) to server-side `.range()` pagination (10 or 20 rows/page).
  - Added GIN `pg_trgm` indexes for partial string searches and composite B-tree indexes for sorting.

**Client-Side Bundle Size & Tree-Shaking:**
- Problem: Large dependencies like `recharts`, `lucide-react`, and `xlsx` could increase Initial Server Response and First Contentful Paint.
- Improvement path implemented:
  - `apps/web/next.config.ts` includes `optimizePackageImports: ["lucide-react", "@supabase/supabase-js", "recharts"]`.
  - Heavy export handlers (`xlsx`) are dynamically imported only when an export button is clicked.

## Fragile Areas

**Web-to-Mobile Synchronization Parity:**
- Why fragile: Web and Mobile apps share types, validation schemas, and database APIs, but run on different UI runtimes (Next.js vs. Expo React Native).
- Common failure: A feature or form field is updated on Web, but omitted on Mobile.
- Safe modification: Strict adherence to `.agents/rules/web_mobile_ui_consistency.md` and `AI/PROJECT_MEMORY.md` rule #5: Every Web change MUST be simultaneously mirrored in `apps/mobile` within the same task.

---

*Concerns analysis: 2026-09-09*
*Update after resolving technical debt or uncovering new operational risks*
