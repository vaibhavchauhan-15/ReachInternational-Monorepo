# Known Issues & Technical Debt — ServiceCentric

## Open Items
1. **Cron Secret Fallback**: Ensure production deployment configures `CRON_SECRET` in environment variables for `/api/cron/send-reminders`.
2. **RechartsSSR Hydration**: Ensure client components importing `Recharts` (`components/dashboard/Charts.tsx`) use proper dynamic rendering to prevent React SSR hydration mismatches.
3. **Table Column Customization**: Enterprise Table component (`components/ui/EnterpriseTable.tsx`) supports sorting & pagination; filter column customization requires further UI configuration options.

## Resolved Items
- Fixed client component directive issue on `MobileBottomNav.tsx`.
- Resolved RPC security user context parameter in `005_fix_dashboard_rpc_user_context.sql`.
