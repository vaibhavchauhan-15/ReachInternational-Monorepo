# File Index — ServiceCentric

This index maps features directly to exact file paths. AI agents must use this to read ONLY the relevant files for a given task.

## 1. Authentication & Users
- Pages: `app/login/page.tsx`, `app/signup/page.tsx`, `app/forgot-password/page.tsx`
- Server Actions: `app/actions/auth.ts`, `app/actions/users.ts`
- Client Management: `components/users/*` (User table, role assign modals)
- Supabase Clients: `lib/supabase/server.ts`, `lib/supabase/browser.ts`, `lib/supabase/admin.ts`
- Data Access: `lib/dal.ts`

## 2. Dashboard & Analytics
- Pages: `app/(app)/dashboard/page.tsx`
- Components: `components/dashboard/Charts.tsx`, `components/dashboard/ChartLoaders.tsx`
- Queries: `lib/queries/dashboard.ts`
- RPC Migrations: `supabase/migrations/004_dashboard_rpc.sql`, `005_fix_dashboard_rpc_user_context.sql`

## 3. Machines & Inventory
- Pages: `app/(app)/machines/page.tsx`, `app/(app)/machines/[id]/page.tsx`
- Components: `components/machines/MachineListClient.tsx`, `components/machines/MachineModal.tsx`, `components/machines/MachineRow.tsx`
- Server Actions: `app/actions/machines.ts`
- Queries: `lib/queries/machines.ts`

## 4. Machine Services & Maintenance Logs
- Pages: `app/(app)/services/page.tsx`
- Components: `components/services/ServicesClient.tsx`
- Server Actions: `app/actions/services.ts`
- Queries: `lib/queries/services.ts`

## 5. Notifications Engine
- Pages: `app/(app)/notifications/page.tsx`
- Components: `components/notifications/NotificationListClient.tsx`, `components/notifications/NotificationPreviewModal.tsx`, `components/notifications/NotificationRow.tsx`
- Server Actions: `app/actions/notifications.ts`, `app/actions/send-reminders.ts`, `app/actions/manual-reminder.ts`
- Core Dispatchers: `lib/notifications/email-templates.ts`, `lib/notifications/sms.ts`, `lib/notifications/whatsapp.ts`, `lib/notifications/templates.ts`, `lib/notifications/index.ts`
- Queries: `lib/queries/notifications.ts`
- Cron Route: `app/api/cron/send-reminders/route.ts`

## 6. Shared Layout & Design System
- Design Tokens & Rules: `DESIGN.md` (Vercel Geist Design System), `AI/UI_RULES.md`, `.agents/rules/responsive_cross_platform_design.md`
- Shared Packages: `@reachinternational/design-tokens`
- Navigation: `components/layout/MobileBottomNav.tsx`, `components/layout/PublicNavbar.tsx`, `components/layout/Navbar.tsx`, `components/layout/AppSidebar.tsx`
- UI Design System (`components/ui/`):
  - `EnterpriseTable.tsx`, `Table.tsx`
  - `MetricCard.tsx`, `Card.tsx`, `Badge.tsx`, `Button.tsx`, `Input.tsx`
  - `Modal.tsx`, `ConfirmationDialog.tsx`, `CommandPalette.tsx`
  - `Motion.tsx`, `Skeleton.tsx`, `Spinner.tsx`, `Toast.tsx`, `Tooltip.tsx`, `SearchableSelect.tsx`, `Select.tsx`, `CustomTimePicker.tsx`, `EmptyState.tsx`, `PageHeader.tsx`

## 7. Global Utilities & Types
- Types: `lib/types/database.ts`
- System Utils: `lib/utils.ts`, `lib/audit.ts`, `lib/cache.ts`
- Styles: `app/globals.css`

## 8. Architecture & AI Agent Rules
- Authoritative Architecture Rules: `AI/RULES/ARCHITECTURE.md`
- Monorepo & Layering Memory: `AI/ARCHITECTURE.md`
- Core AI Memory & Protocol: `AGENTS.md`, `AI/PROJECT_MEMORY.md`, `AI/STATE.md`, `AI/CURRENT_TASK.md`
- Design Tokens & Responsive UI Rules: `DESIGN.md`, `AI/RULES/DESIGN-SYSTEM.md`, `AI/RULES/UI-UX.md`, `AI/UI_RULES.md`, `.agents/rules/responsive_cross_platform_design.md`
- Authoritative Performance & Optimization Rules: `AI/RULES/PERFORMANCE.md`, `AI/PERFORMANCE_RULES.md`
- Authoritative Security Engineering Rules: `AI/RULES/SECURITY.md`, `AI/SECURITY_RULES.md`
- Authoritative Authentication & Authorization Rules: `AI/RULES/AUTHENTICATION-AUTHORIZATION.md`
- Authoritative Data Protection & Privacy Rules: `AI/RULES/DATA-PROTECTION-PRIVACY.md`
- Authoritative Validation, Error Handling & Resilience Rules: `AI/RULES/VALIDATION-ERROR-RESILIENCE.md`
- Authoritative Testing & Quality Assurance Rules: `AI/RULES/TESTING-QA.md`
- Authoritative SEO, Metadata & Discoverability Rules: `AI/RULES/SEO-METADATA-DISCOVERABILITY.md`
- Authoritative Observability, Monitoring & Logging Rules: `AI/RULES/OBSERVABILITY-MONITORING-LOGGING.md`
- Authoritative Deployment, DevOps & Release Rules: `AI/RULES/DEPLOYMENT-DEVOPS-RELEASE.md`
- Cross-Platform Responsive UI Rules: `.agents/rules/responsive_cross_platform_design.md`
- Web & Mobile UI Consistency Rules: `.agents/rules/web_mobile_ui_consistency.md`

