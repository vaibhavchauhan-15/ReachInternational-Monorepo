# Current Task

## Task: Request-a-Quote (RFQ) System & Route 404 Resolution
**Status**: 🟢 COMPLETED & VERIFIED
**Date**: 2026-11-01
**Routes**:
- Public Marketing: `/request-a-quote`, `/request-a-quote/thank-you`
- Admin Sales Pipeline: `/admin/sales/rfq`, `/admin/sales/rfq/[id]`, `/admin/sales/rfq/new`, `/admin/sales/rfq/clients`, `/admin/sales/rfq/settings`, `/rfq`
- API Handlers: `/api/rfq/session`, `/api/rfq/download`

### Root Cause of 404
`GET /request-a-quote` was showing 404 because `apps/web/app/(marketing)/request-a-quote/page.tsx` was not yet created. The edge proxy (`proxy.ts`) correctly classified it as a public marketing route, so once the page and components were created, it serves immediately with 200 OK.

### Deliverables Implemented
1. **Public Marketing Route & Multi-Machine RFQ Form**:
   - `apps/web/app/(marketing)/request-a-quote/page.tsx`: Full SSR prefetching of equipment models and categories, SEO metadata, JSON-LD Schema, 2–4 hour SLA badges, trust badges, and equipment FAQ accordion.
   - `apps/web/components/rfq/RfqForm.tsx`: 4-section responsive Geist form:
     1. Contact & Organization Details (+91 validation, Indian states selector with GST codes).
     2. Equipment Selection (`ItemCard.tsx` with rental/purchase toggle, catalogue or category selection, quantity, duration).
     3. Project Site & Schedule (site address, operating ground conditions, file upload zone via signed URLs).
     4. Consent & Submission (DPDP Act 2023 consent checkbox, Turnstile CAPTCHA).
   - `apps/web/app/(marketing)/request-a-quote/thank-you/page.tsx`: Clean confirmation screen with RFQ reference number, 3-step SLA timeline, direct WhatsApp & Phone links, and zero PII leakage.
   - `apps/web/app/api/rfq/session/route.ts`: Upload session endpoint generating signed PUT URLs for private bucket `rfq-attachments`.

2. **Admin Sales & Enquiries RFQ Module**:
   - `apps/web/app/(app)/admin/sales/rfq/page.tsx` & `RfqDashboardClient.tsx`: Pipeline KPI cards, table & Kanban views, status tabs, source filters, sales rep filters, search bar, and Supabase Realtime alert listener for new RFQs.
   - `apps/web/app/(app)/admin/sales/rfq/[id]/page.tsx` & `RfqDetailClient.tsx`: Two-column detail page with status transition modal, staff assignment, follow-up picker, client profile, requested items, signed attachment downloads, quotations draft editor (line items, rates, duration, GST %, totals), and audit event timeline.
   - `apps/web/app/(app)/admin/sales/rfq/new/page.tsx` & `ManualRfqClient.tsx`: Manual intake form for phone calls, WhatsApp inquiries, walk-ins, and verbal leads.
   - `apps/web/app/(app)/admin/sales/rfq/clients/page.tsx` & `ClientsDirectoryClient.tsx`: Client accounts directory with past RFQ counts and atomic company merge (`mergeCompanyAction`).
   - `apps/web/app/(app)/admin/sales/rfq/settings/page.tsx` & `RfqSettingsClient.tsx`: Business profile, GSTIN, bank details, default terms, and notification targets.
   - `apps/web/app/(app)/rfq/page.tsx`: Redirect alias to `/admin/sales/rfq`.
   - `apps/web/app/api/rfq/download/route.ts`: Authorized attachment download endpoint via signed URLs.

3. **RBAC & Security Enforcement**:
   - Public marketing side (`/request-a-quote`, `/request-a-quote/thank-you`) accessible without authentication.
   - Admin routes (`/admin/sales/rfq/*`, `/rfq`) strictly protected for `super_admin`, `admin`, `sales`.
   - `marketing` role strictly forbidden and redirected to role home (preventing PII and commercial pricing leakage).
   - Enforced at 3 levels: Edge Proxy (`proxy.ts`), Server DAL (`requireRole`), and Database RLS (`can_manage_rfq()`).
   - Added "Quote Requests" to `AppSidebar.tsx` navigation with `AnimatedFileText` icon.

4. **Verification**:
   - `pnpm turbo run typecheck`: 7/7 packages clean (100% pass).
   - `node scripts/run-all-tests.mjs`: 10/10 monorepo suites passed (100% pass).
