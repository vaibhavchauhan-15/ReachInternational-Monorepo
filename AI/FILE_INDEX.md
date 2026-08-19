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

## 6. Shared Layout & UI Components
- Navigation: `components/layout/MobileBottomNav.tsx`, `components/layout/PublicNavbar.tsx`, `components/layout/Navbar.tsx`
- UI Design System (`components/ui/`):
  - `EnterpriseTable.tsx`, `Table.tsx`
  - `MetricCard.tsx`, `Card.tsx`, `Badge.tsx`, `Button.tsx`, `Input.tsx`
  - `Modal.tsx`, `ConfirmationDialog.tsx`, `CommandPalette.tsx`
  - `Motion.tsx`, `Skeleton.tsx`, `Spinner.tsx`, `Toast.tsx`, `Tooltip.tsx`, `SearchableSelect.tsx`, `Select.tsx`, `EmptyState.tsx`, `PageHeader.tsx`

## 7. Global Utilities & Types
- Types: `lib/types/database.ts`
- System Utils: `lib/utils.ts`, `lib/audit.ts`, `lib/cache.ts`
- Styles: `app/globals.css`
