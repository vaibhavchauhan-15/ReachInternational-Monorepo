# AI State

## Monorepo Health & Status
- **Current Task**: Request-a-Quote (RFQ) System & Route 404 Resolution
- **Status**: 🟢 Clean / Verified & Production Ready
- **Last Verified**: 2026-11-01
- **Turborepo Typecheck**: 7/7 packages & apps passed with 0 errors (`pnpm turbo run typecheck`)
- **Monorepo Test Suite**: 10/10 suites passed cleanly (`node scripts/run-all-tests.mjs`)
- **RFQ System Implementation**:
  - **Marketing Side**:
    - `/request-a-quote`: Multi-machine form with Geist tokens, Indian states selector, signed uploads, 4-section layout. (Resolves 404!)
    - `/request-a-quote/thank-you`: Confirmation page with SLA timeline, WhatsApp/Phone actions, zero PII displayed.
    - `/api/rfq/session`: Direct Storage signed upload URL generator for private bucket `rfq-attachments`.
    - `submitRfqAction`: Rate-limited, honeypot-protected atomic submission calling `submit_rfq` RPC with service role.
  - **Admin Side**:
    - `/admin/sales/rfq`: Realtime pipeline dashboard (KPI cards, table, and Kanban board).
    - `/admin/sales/rfq/[id]`: Two-column inspection page, status transitions, staff assignment, follow-up scheduler, quotation draft line-items editor, and immutable event timeline.
    - `/admin/sales/rfq/new`: Manual intake form for phone, WhatsApp, email, and walk-in enquiries.
    - `/admin/sales/rfq/clients`: Client companies directory with past RFQ counts and atomic company merge.
    - `/admin/sales/rfq/settings`: Business profile, GSTIN, bank details, default terms, and notification targets.
    - `/rfq`: Redirect alias to `/admin/sales/rfq`.
    - `/api/rfq/download`: Authorized attachment download endpoint via signed URLs.
  - **RBAC**:
    - Gated at Edge (`proxy.ts`), Server (`requireRole`), and Database (`can_manage_rfq()`).
    - Allowed: `super_admin`, `admin`, `sales`.
    - Forbidden: `marketing`, `operator`, `hr`, `manager`, `supervisor` (redirected to role home; prevents PII/pricing leakage).
  - **Navigation**:
    - `AppSidebar.tsx` updated with "Quote Requests" (`AnimatedFileText`).
