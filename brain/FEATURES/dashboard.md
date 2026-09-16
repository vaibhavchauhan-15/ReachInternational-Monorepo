# Feature Module — Analytics Dashboard

## Overview
Provides high-level operational statistics, KPI metric cards, machine status breakdown charts, upcoming service lists, and notification delivery performance metrics.

## File Map
- **Page**: `app/(app)/dashboard/page.tsx`
- **Components**: `components/dashboard/Charts.tsx`, `components/dashboard/ChartLoaders.tsx`, `components/ui/MetricCard.tsx`
- **Queries**: `lib/queries/dashboard.ts`
- **RPC Migrations**: `supabase/migrations/004_dashboard_rpc.sql`, `005_fix_dashboard_rpc_user_context.sql`

## Key Functions & Workflows
- `getDashboardStats()`: Invokes database RPC function to fetch aggregated statistics in a single database roundtrip.
- Recharts Integration: Displays interactive status distribution charts and service activity timelines.
