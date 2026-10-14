# Data Protection & Privacy Policy

> **DATA PRIVACY, MINIMIZATION, RETENTION, AND SENSITIVE PII INVENTORY**  
> *This document establishes the binding privacy controls, sensitive data inventory, access restrictions, and retention policies across ReachInternational. Real customer or employee PII must NEVER appear in code, logs, or documentation.*

---

## 1. Sensitive Data Category Inventory

ReachInternational processes enterprise machinery operations, staff records, and customer accounts. The following categories of sensitive data are actively stored and managed in the system:

| Data Category | Specific Database Fields | Storage Location | Sensitivity Level | Access Restrictions |
|---|---|---|---|---|
| **Employee Identity & KYC** | `aadhaar_number`, `license_number` | `public.users`, `public.user_documents` | **Confidential / PII** | Restricted to `super_admin`, `admin`, `hr`, and the owning user. Masked in UI views. |
| **Financial & Banking** | `bank_account_number`, `bank_ifsc_code`, `daily_rate`, `monthly_salary`, `ot_hourly_rate` | `public.users`, `public.payroll_records` | **Highly Sensitive** | Restricted to `super_admin`, `admin`, and `hr`. Operators can only view their own payroll summaries. |
| **Contact & Personal PII**| `full_name`, `email`, `phone`, `street`, `city`, `district`, `state` | `public.users` | **PII** | Scoped directory access. Full address restricted to HR and self-profile. |
| **KYC File Scans** | Aadhaar cards, driving licenses, certificates | Supabase Storage (`user_files` bucket) | **Confidential Files** | Private storage bucket. Short-lived signed URLs (180s expiry). Access logged in audit trail. |
| **Customer / Client Data**| `client_name`, `gstin`, `contact_email`, `contact_phone`, `billing_address` | `public.clients`, `public.client_sites` | **Commercial Confidential** | Restricted to `super_admin`, `admin`, `manager`. |
| **Operational Fleet Data**| `machine_id`, `serial_number`, `hour_meter`, `breakdown_notes`, `shift_times` | `public.machines`, `public.machine_hour_logs` | **Operational Proprietary** | Accessible to all authenticated staff based on operational need. |

---

## 2. Data Minimization Principles

1. **Explicit Query Projection**: Using `SELECT *` on `public.users` or `public.payroll_records` is strictly prohibited. Database queries must explicitly request only the columns required for the immediate screen:
   ```ts
   // Canonical safe projection omitting banking & identity numbers:
   const { data } = await supabase
     .from("users")
     .select("id, full_name, role, status, email, phone");
   ```
2. **PII Masking**: Sensitive fields must be masked before rendering in lists or summary views:
   - Aadhaar: `XXXX-XXXX-1234` (display last 4 digits only).
   - Bank Account: `XXXXXXXX1234` (display last 4 digits only).
3. **No Credential Logging**: Never log user request bodies during `/login`, `/signup`, or `/api/auth/*` requests.

---

## 3. Storage Bucket Privacy Controls (`user_files`)

All user KYC documents and identity scans are stored in the private Supabase storage bucket `user_files`:
1. **Private by Default**: `public: false` is enforced in `INSERT INTO storage.buckets`. Direct unauthenticated CDN links are impossible.
2. **Access via Signed URLs Only**: Clients obtain short-lived signed URLs via `getDocumentViewUrlAction` (`apps/web/app/actions/documents.ts`). URLs expire automatically after **180 seconds** (3 minutes).
3. **Storage RLS Policies**: `storage.objects` enforces that users can only upload and read files within their own folder path (`documents/{user_id}/*`).
4. **File Quota & Limits**: Maximum file size is strictly capped at **2MB** (2,097,152 bytes) per document.

---

## 4. User Account Deletion & Right to Erasure

ReachInternational implements a dedicated account deletion workflow adhering to data privacy standards:

1. **User Request Flow (`/account-deletion`, `app/actions/account-deletion.ts`)**:
   - Authenticated users may request account deletion through the web or mobile interface.
   - Deletion requests require explicit confirmation dialog (`ConfirmDialog`) and verification keyword matching.
2. **Audit Logging & Soft Deletion**:
   - The deletion event is recorded in `public.audit_logs` (`action: "account.deletion_requested"`).
   - To preserve operational fleet integrity and historic machinery logs (safety compliance), user accounts are marked as `status: "deleted"` / deactivated, and sensitive personal fields are cleared or anonymized.
3. **Document Purging**:
   - Uploaded KYC files in `user_files` bucket associated with the user ID are queued for permanent deletion upon account closure.

---

## 5. Third-Party Data Transmission Safeguards

When transmitting data to external service providers:
- **SendGrid**: Only the recipient email address, template parameters, and transactional reset links are sent. Passwords and banking details are never included.
- **Twilio**: Transactional SMS notifications contain operational notices (shift assignments, machine breakdown alerts) without sensitive PII.
- **Sentry Error Tracking**: Sentry configuration in `sentry.client.config.ts` and `apps/mobile/lib/sentry.ts` sanitizes request bodies, stripping authentication cookies, tokens, and PII.
