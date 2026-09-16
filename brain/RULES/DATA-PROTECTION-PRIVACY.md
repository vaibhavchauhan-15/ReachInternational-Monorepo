# ReachInternational Production Data Protection & Privacy Rules

> **AUTHORITATIVE DATA PROTECTION & PRIVACY POLICY FOR AI AGENTS**  
> *This document establishes the binding data protection, privacy, data handling, minimization, exposure, transmission, storage, logging, export, retention, and deletion policy for all applications (`apps/web`, `apps/mobile`), shared packages (`packages/*`), data access layers (`lib/dal.ts`), server actions, database queries, and storage systems within the ReachInternational monorepo. Every AI coding agent MUST read, obey, and enforce these rules before writing or modifying any data handling code in this repository.*

---

## 1. Purpose

The purpose of ReachInternational's Data Protection & Privacy policy is to guarantee that **all enterprise data—spanning employees, customers, machinery, finances, operational logs, and uploaded documents—is handled with strict confidentiality, privacy controls, and data minimization** throughout its complete lifecycle.

Every feature implemented by an AI coding agent MUST follow the controlled data lifecycle:
```text
Collection → Validation → Processing → Storage → Access → Transmission → Display → Caching → Export → Retention → Deletion
```

---

## 2. Source of Truth

ReachInternational establishes authoritative canonical sources of truth for data classification and handling:
1. **Database Schema & Types**: Shared package `@reachinternational/types` (`database.ts`).
2. **Data Access & Scoping**: `apps/web/lib/dal.ts` (`verifySession()`, `getCurrentUser()`, `getUserBranchIds()`).
3. **Database Security Boundaries**: Supabase PostgreSQL 35 migrations enforcing Row Level Security (RLS) policies.
4. **Audit Logging System**: `apps/web/lib/audit.ts` (`logAudit()`) writing to `public.audit_logs`.
5. **Storage Privacy Infrastructure**: Supabase Storage public buckets vs private storage buckets requiring signed URLs.

---

## 3. Data Architecture

ReachInternational handles operational enterprise data across web (`apps/web`) and mobile (`apps/mobile`) platforms:
* **Multi-Tenant Isolation**: Every database table includes an `organization_id` column linked to PostgreSQL RLS policies.
* **Branch Isolation**: Data is partitioned by `branch_id` (`DEL-HQ` and regional branches) and scoped to authorized user branch assignments.
* **Storage Isolation**: Sensitive uploaded files (employee PII, payroll documents, customer agreements, invoices) are stored in private Supabase Storage buckets.

---

## 4. Data Sources

The application receives data from trusted and untrusted sources:
* **Untrusted Sources**: Browser form submissions, mobile app API requests, uploaded files, URL search params, and incoming webhooks.
* **Trusted Server Sources**: Server Data Access Layer (`lib/dal.ts`), Supabase Auth SSR engine, and PostgreSQL database queries.
* **Third-Party Services**: SendGrid (email), Twilio (SMS), WhatsApp Business API, and Upstash QStash (background queue).

---

## 5. Data Inventory

ReachInternational manages 11 core data entity categories:

```text
DATA CATEGORY           ENTITY TABLES IN DATABASE               KEY ATTRIBUTES / FIELDS
──────────────────────────────────────────────────────────────────────────────────────────
• User Identity        public.users, auth.users                id, email, role, is_active
• Employee PII         public.employees, public.payroll        full_name, phone, salary, Aadhaar/PAN
• Customer Data        public.clients, public.leads            company_name, GSTIN, contact_email
• Machine & Fleet      public.machines, public.compliance      code, serial_no, hour_meter, status
• Service Records      public.service_complaints, FSR logs     complaint_no, checklist, parts_used
• Inventory ERP        public.inventory_items, stock_ledgers   sku, quantity_on_hand, unit_cost
• Operational Logs     public.operator_daily_meters, movements shift_hours, start_meter, end_meter
• Financial Records    public.purchase_orders, invoices        po_number, total_amount, discount_%
• Uploaded Documents   Supabase Storage Buckets                machine_photo.jpg, agreement_fsr.pdf
• Audit Security Logs  public.audit_logs                       action, entity_id, metadata, user_id
```

---

## 6. Data Classification Framework

ReachInternational classifies all application data into 5 strict privacy levels:

```text
CLASSIFICATION LEVEL   DESCRIPTION                             EXAMPLE DATA TYPES
──────────────────────────────────────────────────────────────────────────────────────────
• Level 1: Public      Public marketing assets, machine catalog Machine catalog photos, public docs
• Level 2: Internal    Standard operational codes & catalog     Machine codes (#MCH-001), model specs
• Level 3: Confidential Customer, fleet agreement & rental data Customer agreements, rental rates
• Level 4: Sensitive    Employee PII, financial ledgers, salary Employee Aadhaar/PAN, bank accounts
• Level 5: Highly Sent. Passwords, auth JWTs, API secret keys   SUPABASE_SERVICE_ROLE_KEY, tokens
```

---

## 7. Data Minimization

1. **Collect Minimal Fields**: AI agents MUST NOT add database columns or form fields without an explicit, documented product requirement.
2. **Explicit Query Projections**: Database queries MUST explicitly project required columns only. Using `SELECT *` on operational tables is **STRICTLY FORBIDDEN**.
3. **API Response Scrubbing**: API responses MUST return only fields required by the frontend client view, omitting password hashes, secret keys, or internal metadata.

---

## 8. Purpose Limitation

Data collected for operational workflows (e.g. employee phone numbers for SMS dispatch) MUST NOT be reused for unrelated purposes (e.g. public displays, analytics exports) without explicit product authorization.

---

## 9. User Data Privacy

1. **User Identity Boundaries**: User profiles in `public.users` are visible only within the user's assigned organization (`organization_id`).
2. **Profile Exposure**: User list views MUST expose only operational identity fields (`full_name`, `email`, `role`, `branch_id`), hiding internal auth tokens and private credentials.

---

## 10. Employee Data Protection

1. **PII Masking**: Employee identification numbers (Aadhaar, PAN, Bank Account numbers) MUST be masked in user interfaces (`XXXX-XXXX-1294`).
2. **Payroll Access Restrictions**: Payroll revision histories (`public.payroll`) are classified as **Sensitive Data** and MUST require `HR_PAYROLL_REVISE` or `FINANCE_LEDGER_READ` permissions.

---

## 11. Customer Data Privacy

1. **Customer Record Confidentiality**: Customer profiles (`public.clients`), leads, and contact numbers MUST be scoped by branch (`branch_id`).
2. **BOLA Protection**: Direct access to customer IDs via URLs (e.g. `/crm/clients/cli_991`) MUST verify that the user's branch assignment permits access.

---

## 12. Operational & Machine Data

1. **Fleet Catalog Visibility**: Operational machine codes, model specifications, and status logs are classified as **Internal Data**.
2. **Branch Scoping**: Machine status logs MUST be filtered by authorized user branch IDs (`getUserBranchIds()`).

---

## 13. Financial Data Protection

1. **Financial Confidentiality**: Invoices, purchase order amounts, supplier costs, and aging receivables ledgers are classified as **Sensitive Data**.
2. **Field-Level Redaction**: Non-financial roles (e.g. `mechanic`, `operator`) MUST NOT receive financial pricing, unit costs, or invoice totals in API responses.

---

## 14. Authentication Data Isolation

1. **Plaintext Password Prohibition**: Passwords MUST NEVER be stored, logged, or transmitted in plaintext.
2. **Token Isolation**: JWT tokens and session secrets MUST remain inside HttpOnly cookies and MUST NEVER be exposed in client component props, URLs, or client logs.

---

## 15. File Data Privacy

1. **File Type Classification**: Uploaded documents MUST be classified prior to storage:
   * *Public Assets*: Machine photos, public brochures → Public Storage Bucket.
   * *Confidential/Sensitive*: HR onboarding docs, customer agreements, FSR attachments, supplier invoices → Private Storage Bucket.
2. **UUID File Renaming**: Uploaded files MUST be renamed using UUIDs (`${crypto.randomUUID()}.pdf`) to prevent path traversal and filename leaks.

---

## 16. Database Data Access Protocols

1. **DAL Mandate**: Database queries MUST execute through server-only Data Access Layer modules (`lib/dal.ts` and `lib/queries/`).
2. **RLS Enforcement**: Row Level Security policies MUST remain enabled on all tables across all 35 migrations.

---

## 17. API Data Handling

1. **Response Minimization**: API endpoints MUST transform database entities into minimal DTOs, stripping sensitive internal columns before returning JSON responses.
2. **Input Validation**: Request bodies MUST be parsed with Zod schemas from `@reachinternational/validation` to prevent mass-assignment attacks.

---

## 18. Client Data Exposure Safeguards

1. **No Hiding via CSS**: Hiding sensitive UI elements with CSS (`display: none`) DOES NOT protect data. If a user is unauthorized to see data, the server MUST NOT send it to the browser.
2. **Zero Server Secrets in Client**: Client Components (`'use client'`) MUST NEVER access server-only environment variables (`SUPABASE_SERVICE_ROLE_KEY`, `SENDGRID_API_KEY`).

---

## 19. Data Transmission Encryption

All data transmitted across network boundaries MUST use **TLS 1.3** transport encryption. Insecure HTTP connections MUST automatically redirect to HTTPS in production environments.

---

## 20. Third-Party Data Sharing Rules

Data transmitted to external service providers MUST be strictly minimized:
* **SendGrid (Email)**: Transmit recipient email, name, and email body template variables only.
* **Twilio / WhatsApp (SMS/Chat)**: Transmit recipient phone number and operational alert message text only.
* **Upstash QStash (Background Queue)**: Transmit job ID and minimal task context payload.

---

## 21. AI & LLM Data Privacy

If AI/LLM integrations are introduced:
1. **No Sensitive PII in Prompts**: User Aadhaar/PAN, passwords, or full bank details MUST NEVER be injected into LLM prompts.
2. **Data Minimization**: Pass only the specific operational text excerpt required to satisfy the prompt request.
3. **No Auth Bypass**: AI-generated responses MUST pass standard DAL permission checks before executing database state changes.

---

## 22. Logging Privacy Standards (`lib/audit.ts`)

1. **Log Scrubbing**: Passwords, auth tokens, credit card numbers, and secret keys MUST BE SCRUBBED before writing log messages or audit events.
2. **Audit Log Access**: Access to `public.audit_logs` is restricted to `super_admin` and `company_admin` roles.

---

## 23. Error Monitoring Privacy

Production error logs (e.g. console errors, error boundary alerts) MUST NOT reveal stack traces, database credentials, internal SQL queries, or user passwords.

---

## 24. Analytics Privacy

Analytics tracking scripts MUST NOT collect form inputs, password fields, employee PII, or full customer agreement details. Only aggregate operational route events shall be tracked.

---

## 25. Storage Privacy Infrastructure

1. **Public Storage**: Machine catalog photos use public CDN buckets with cache-control headers.
2. **Private Storage**: HR documents, financial invoices, payroll receipts, and agreements MUST use private buckets requiring time-limited signed URLs (`createSignedUrl(path, 60)`).

---

## 26. File Access Verification

Before serving a signed URL for a file download, the server MUST verify that the requesting user's identity and branch assignment permit access to the underlying entity record.

---

## 27. Cache Isolation & Privacy

1. **Scope-Aware Cache Keys**: Cached queries in `lib/cache.ts` MUST incorporate authorization parameters (`userId`, `branchId`, `role`) into the cache key array.
2. **No Cross-User Leaks**: User-specific dashboard data MUST NEVER be cached under global key names.

---

## 28. Browser Storage Restrictions

1. **No Sensitive Data in Web Storage**: Writing passwords, auth tokens, financial records, or employee PII to `localStorage` or `sessionStorage` is **STRICTLY FORBIDDEN**.
2. **Transient UI State Only**: Web storage may only hold non-sensitive UI preferences (e.g. sidebar collapse state, density choice).

---

## 29. Cookie Privacy Flags

Authentication cookies MUST enforce `HttpOnly`, `Secure` (in production), and `SameSite=Lax` flags to prevent client-side JavaScript access and cross-site scripting exposure.

---

## 30. URL Privacy

Sensitive data (passwords, auth tokens, employee Aadhaar/PAN, customer financial amounts) MUST NEVER be passed inside URL query parameters (`?token=xyz`), as query parameters appear in browser histories, server logs, and referrer headers.

---

## 31. Notification Privacy

Email and SMS alerts MUST keep payload details minimal (e.g. "Breakdown Complaint #CMP-991 reported for Machine #MCH-001"), avoiding inclusion of full financial ledgers or employee personal documents in notification bodies.

---

## 32. Search & Filtering Privacy

1. **Search Scoping**: Search queries inside `FilterToolbar` MUST execute within the user's authorized branch scope (`getUserBranchIds()`).
2. **Autocomplete Privacy**: Autocomplete popovers MUST NOT suggest customer or employee names outside the user's authorized branch scope.

---

## 33. Export Privacy Controls

1. **Permission Check**: CSV exports and PDF report generation require explicit export permissions (`MACHINES_EXPORT`, `FINANCE_REPORTS_READ`).
2. **Column Scrubbing**: Export files MUST exclude internal database keys, secret tokens, and masked employee PII unless explicitly authorized.

---

## 34. Data Retention

Data retention MUST follow established operational policies:
* **Active Operational Data**: Retained for active fleet management.
* **Audit Security Logs**: Retained in `public.audit_logs` for historical security verification.
* **Undefined Retention**: New sensitive data categories MUST NOT be stored indefinitely without defining an explicit retention policy.

---

## 35. Data Deletion Lifecycle

Deletion operations MUST observe strict authorization rules:
1. **Hard Delete Guard**: Direct hard deletion of database records is restricted to `super_admin` and `company_admin` roles.
2. **Audit Trail**: Every deletion operation MUST write a record to `public.audit_logs` specifying the target record ID and deleting user ID.

---

## 36. Soft Delete & Archive Architecture

Where entities support soft deletion (e.g. `EmployeeStatus = "archived"`, `is_active = false`):
1. **Query Filtering**: All active list queries MUST include `.eq("is_active", true)` or filter out archived status to avoid rendering soft-deleted records.
2. **Restoration Guard**: Restoring archived records requires elevated administrative authorization (`USERS_MANAGE`).

---

## 37. Database Migration Safeguards

Database migrations (`supabase/migrations/`) involving schema changes on sensitive tables MUST:
* Preserve existing Row Level Security policies.
* Avoid exposing newly added columns to `anon` or unauthorized roles.
* Include rollback safeguards before altering production data types.

---

## 38. Database Backup Privacy

Database backups managed via Supabase MUST be encrypted at rest and in transit. Access to raw database dumps is restricted to Super Admins.

---

## 39. Data Masking & Redaction Standards

When rendering sensitive PII fields in user interfaces:
* **Bank Account / Aadhaar / PAN**: Mask all but the last 4 digits (`XXXX-XXXX-1294`).
* **Phone Numbers**: Mask middle digits (`+91 98XXX XX291`) for unauthorized roles.

---

## 40. Data Lifecycle Governance

```text
1. Collection   → Collect only required fields via Zod-validated forms
2. Validation   → Parse inputs against Zod schemas in @reachinternational/validation
3. Processing   → Execute mutations in RSC / Server Actions under DAL permission guards
4. Storage      → Store in PostgreSQL under RLS bounds & private Supabase buckets
5. Access       → Filter data by organization_id, getUserBranchIds(), and role
6. Transmission → Encrypt all network traffic via TLS 1.3
7. Display      → Render through React JSX with automatic XSS escaping & PII masking
8. Caching      → Cache with scope-aware keys in lib/cache.ts
9. Export       → Enforce export permissions & column scrubbing on CSV/PDF reports
10. Retention   → Maintain active vs archived data lifecycle
11. Deletion    → Execute authorized deletions with mandatory logAudit() recording
```

---

## 41. Privacy + Security Integration

Privacy and Security MUST coexist:
* Security controls (RLS, `verifySession()`, Zod validation) serve as the primary enforcement mechanism for data privacy.
* Disabling security controls for convenience is FORBIDDEN.

---

## 42. Privacy + Authentication & Authorization

Privacy boundaries rely 100% on canonical authentication and authorization helpers (`verifySession()`, `roleHasPermission()`, `requirePermission()`, `getUserBranchIds()`).

---

## 43. Privacy + Performance

Performance optimizations MUST NOT compromise data privacy:
* DO NOT expose extra sensitive table columns simply to eliminate a join query.
* Project required columns explicitly while keeping privacy boundaries intact.

---

## 44. Privacy + Accessibility

Accessibility features MUST NOT leak unauthorized data:
* Screen-reader announcements (`aria-live`) and tooltips (`<TooltipWrapper>`) MUST respect the exact same data authorization boundaries as visible text.

---

## 45. Privacy + Responsive Design

Data privacy rules are 100% identical across Mobile (≤640px touch cards), Tablet (641px–1023px), and Desktop (≥1024px `<EnterpriseTable>`).

---

## 46. Privacy Testing & Verification

1. **Compilation Check**: `pnpm typecheck` across all 9 monorepo workspace packages.
2. **Data Isolation Tests**: Test data scoping to ensure users cannot view records from unauthorized branches or organizations.

---

## 47. Privacy Regression Protection

Before modifying shared query functions in `lib/queries/` or storage bucket rules:
1. Audit downstream data exposure across all 26 domain modules.
2. Verify zero sensitive data leakage vectors exist.
3. Verify zero compilation errors across all workspace packages (`pnpm typecheck`).

---

## 48. Forbidden Privacy Anti-Patterns (NEVER INTRODUCE)

AI agents MUST NEVER introduce any of the following data privacy anti-patterns:
* ❌ **`SELECT *` Data Over-Fetching**: Returning all table columns when only a few are needed.
* ❌ **Private Files in Public Storage**: Storing employee PII or financial invoices in public CDN storage buckets.
* ❌ **Sensitive Data in Web Storage**: Writing tokens, PII, or passwords to `localStorage` or `sessionStorage`.
* ❌ **Credentials in Logs**: Writing auth tokens, passwords, or secret keys to `console.log` or audit metadata.
* ❌ **Sensitive Data in URLs**: Passing passwords, PII, or secret tokens inside URL query string parameters.
* ❌ **CSS-Only Hiding**: Hiding sensitive UI elements with CSS (`display: none`) while sending raw data to the browser.
* ❌ **Un-Scratched Export Files**: Generating bulk CSV exports containing un-masked employee bank details or secret keys.

---

## 49. Data Change Policy

Before executing a database schema change or modifying data access logic:
1. Identify affected data classifications and trust boundaries.
2. Formulate the smallest correct code change.
3. Verify zero data leakage, security, or visual regressions are introduced.

---

## 50. AI Agent Pre-Implementation Privacy Checklist

Before writing code, every AI agent MUST complete this mental checklist:

* [ ] Am I fetching only the minimal required columns (explicit projection, no `SELECT *`)?
* [ ] Is sensitive employee PII or financial data masked in the UI view?
* [ ] Are uploaded confidential documents stored in private Supabase Storage buckets with signed URLs?
* [ ] Are scope-aware parameters (`userId`, `branchId`) included in cache keys?
* [ ] Are sensitive tokens and passwords excluded from `console.log` and audit logs?
* [ ] Does the mutation trigger `logAudit()` in `lib/audit.ts` for tracking?

---

## 51. AI Agent Post-Implementation Data Protection Audit

After completing code modifications, every AI agent MUST perform the following verification protocol:

1. **Compilation Audit**: Run `pnpm typecheck` across all 9 monorepo workspace packages.
2. **Privacy & RLS Audit**: Confirm data isolation and RLS policies remain 100% active.
3. **Design & Responsive Audit**: Confirm visual compliance with `DESIGN.md` across Mobile, Tablet, and Desktop.
4. **Memory Synchronization**: Update `AI/STATE.md`, `AI/CURRENT_TASK.md`, `AI/CHANGELOG_AI.md`, and `README.md`.

---
