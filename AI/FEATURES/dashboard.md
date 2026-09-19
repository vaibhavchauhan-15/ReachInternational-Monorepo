# Feature Module — Role-Based Operational Dashboard Architecture

## Overview
Provides dedicated, high-performance, role-based operational dashboards for all 6 canonical roles (`super_admin`, `admin`, `manager`, `supervisor`, `hr`, `operator`). All active users land on `/dashboard` post-login and via the top-level navigation item.

## Architecture & File Map
- **Server Page**: `apps/web/app/(app)/dashboard/page.tsx`
- **Error & Loading Skeletons**: `apps/web/app/(app)/dashboard/error.tsx`, `loading.tsx`
- **Edge Route Proxy**: `apps/web/proxy.ts` (Active protected route, universal landing target)
- **Role Compositions**:
  - `components/dashboard/super-admin/SuperAdminDashboardView.tsx`
  - `components/dashboard/admin/AdminDashboardView.tsx`
  - `components/dashboard/manager/ManagerDashboardView.tsx`
  - `components/dashboard/supervisor/SupervisorDashboardView.tsx` (Fleet supervision, shift submission status, breakdown alerts linking to `/operations?tab=logs`)
  - `components/dashboard/hr/HRDashboardView.tsx`
  - `components/dashboard/operator/OperatorDashboardView.tsx`
- **Shared Primitives**: `components/dashboard/shared/` (`DashboardShell`, `DashboardHeader`, `KPIGrid`, `KPICard`, `StatusCard`, `PrimaryAction`, `AlertWidget`, `ActivityWidget`)
- **DAL Layer**: `apps/web/lib/data/dashboard/` (`getDashboardForRole`, `getSupervisorDashboard`, etc.)
- **RPC Migrations**:
  - `supabase/migrations/088_dashboard_read_model_rpcs.sql`: 6 lean PostgreSQL RPCs (`get_super_admin_dashboard`, `get_admin_dashboard`, `get_manager_dashboard`, `get_supervisor_dashboard`, `get_hr_dashboard`, `get_operator_dashboard`)
  - `supabase/migrations/090_supervisor_dashboard_action_url.sql`: Updates supervisor breakdown alert `actionUrl` to `/operations?tab=logs`
  - `supabase/migrations/091_dashboard_action_urls.sql`: Hardens action URLs across all roles
  - `supabase/migrations/092_fix_active_machines_dashboard_kpis.sql`: Fixes active machines fleet metric in `get_super_admin_dashboard` and `get_manager_dashboard` (checks `health_status = 'active' OR status = 'active'` while excluding inactive)
  - `supabase/migrations/093_operator_dashboard_submitted_alert.sql`: Emits `entry-submitted` success alert when operator has submitted their shift log for today. Single dynamic alert displays yellow/amber when pending and light green when submitted, eliminating duplicate action cards.
- **Mobile Parity**: `apps/mobile/app/(app)/dashboard.tsx` with modular cards in `apps/mobile/components/dashboard/` (`SupervisorDashboardCard`, `OperatorDashboardCard`, etc.)
