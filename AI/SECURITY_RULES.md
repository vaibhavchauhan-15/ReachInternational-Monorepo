# Security Rules — ReachInternational

> **CANONICAL SECURITY RULES SUMMARY**  
> *Authoritative policies live in [`security/`](file:///c:/Users/vaibh/PROGRAMMING/PROJECTS/ReachInternational-Monorepo/security/README.md), [`apps/web/security/`](file:///c:/Users/vaibh/PROGRAMMING/PROJECTS/ReachInternational-Monorepo/apps/web/security/README.md), and [`apps/mobile/security/`](file:///c:/Users/vaibh/PROGRAMMING/PROJECTS/ReachInternational-Monorepo/apps/mobile/security/README.md).*

1. **Role-Based Access Control (RBAC)**: Enforce the canonical 6 roles (`super_admin`, `admin`, `manager`, `supervisor`, `hr`, `operator`) defined in `@reachinternational/permissions`. Always verify role server-side via `lib/dal.ts` (`requireRole()`, `requirePermission()`) before executing elevated Server Actions.
2. **Supabase Row Level Security (RLS)**: Enforce RLS policies on all database tables. Never bypass RLS in application queries. Service-role clients (`createSupabaseAdminClient()`) are restricted to server-only system tasks.
3. **Structured Audit Logging**: Every state mutation (machine lifecycle, breakdown resolution, client modification, role update, payroll revision) must record an immutable audit log via `logAudit()` in `lib/audit.ts`.
4. **Input Validation**: Validate all inbound payloads using canonical Zod schemas from `@reachinternational/validation` before executing database mutations.
5. **Secret Protection**: Keep privileged credentials (`SUPABASE_SECRET_KEY`, `INTERNAL_AUTH_SECRET`, `SENDGRID_API_KEY`, `TWILIO_AUTH_TOKEN`, `UPSTASH_REDIS_REST_TOKEN`) strictly server-side with `import "server-only"`. Mobile builds must never contain server secrets.
6. **Mobile Hardware Keystore**: Mobile session tokens must be stored exclusively via `expo-secure-store` backed by Android KeyStore / iOS Keychain with zero plaintext `AsyncStorage` fallback.
7. **Explicit Query Projections**: Never use `SELECT *`. Explicitly select only necessary columns to prevent data leakage.
