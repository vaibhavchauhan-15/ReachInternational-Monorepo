# Current Task: Security Audit Re-Verification & Advanced Linter Hardening (Web, Mobile, Database, Supabase Advisor)

Status: COMPLETED & VERIFIED (2026-09-16)

## Task Summary
Conducted third-pass deep-dive security re-verification of `./src` across `apps/web`, `apps/mobile`, `packages/*`, and the live Supabase PostgreSQL database using the Cloudflare `security-audit` skill and live Supabase security linter:

1. **Database PostgREST Anon RPC Revocation (REV3-H01)**:
   - Live Supabase security advisor identified 36 `SECURITY DEFINER` functions in `public` schema executable by unauthenticated `anon` users via `/rest/v1/rpc/*`.
   - Created and applied `082_revoke_anon_rpc_and_harden_search_path.sql` and `083_revoke_public_function_execution.sql`.
   - Revoked `PUBLIC` and `anon` execution on all internal RPCs, triggers, and administrative procedures.
   - Pinned public execution strictly to the 2 authorized signup selectors: `get_active_supervisors_public()` and `get_active_working_locations_public()`.
   - Verified via Supabase advisor: Finding count reduced from 36 down to 2 (100% intentional signup selectors).

2. **Database Function Search Path Hardening (REV3-H02)**:
   - Live Supabase advisor identified 20 `SECURITY DEFINER` functions with mutable search paths (CWE-426).
   - Enforced `SET search_path = public, pg_temp` across all 20 functions.
   - Verified via Supabase advisor: Finding count reduced from 20 to 0 (completely resolved).

3. **Account Deletion Authorization (REV3-M01)**:
   - Hardened `getAccountDeletionRequestsAction()` in `apps/web/app/actions/account-deletion.ts` with `getCurrentUserOrNull()` check requiring `admin` or `super_admin` role.

4. **Super Admin Protection in User Actions (REV3-M02)**:
   - In `apps/web/app/actions/users.ts`:
     - `resetUserPassword()`: Added role projection and blocked admins from resetting passwords of `super_admin` accounts.
     - `editUser()`: Added role guard rejecting non-super_admins from assigning `super_admin` in both database payload and `auth.users` metadata.

5. **Monorepo Build & Typecheck**:
   - `pnpm turbo run typecheck`: 7 of 7 packages passing with 0 errors.

6. **Documentation & Memory**:
   - Updated `AI/STATE.md`, `AI/CHANGELOG_AI.md`, `README.md`, and artifact `walkthrough.md`.