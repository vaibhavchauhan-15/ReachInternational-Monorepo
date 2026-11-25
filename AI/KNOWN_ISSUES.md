# Known Issues & Technical Debt — ServiceCentric

## Open Items
1. **🔴 PRODUCTION: pending-approval badges show zero** — production (`dhbbgfzbyatzvqafnsqp`) has approvals migrations 236/237/238 but not `239_approval_counts_service_role_identity.sql`. Verified read-only through PostgREST: `approval_list` reports `pending_total: 25` while `approval_counts` returns `{"total":0}`. Applying 239 to production requires explicit user approval (production writes are never automatic).
2. **Cron Secret Fallback**: Ensure production deployment configures `CRON_SECRET` in environment variables for `/api/cron/send-reminders`.
2. **RechartsSSR Hydration**: Ensure client components importing `Recharts` (`components/dashboard/Charts.tsx`) use proper dynamic rendering to prevent React SSR hydration mismatches.
3. **Table Column Customization**: Enterprise Table component (`components/ui/EnterpriseTable.tsx`) supports sorting & pagination; filter column customization requires further UI configuration options.
4. **`pnpm build` cannot run while a Next.js dev server is up** — `apps/web/scripts/guard-build.js` blocks concurrent builds to protect `.next`. A dev server left running from 2026-11-23 currently prevents build verification in this workspace.
5. **No browser automation available in this environment** — the DeepAI preview MCP returns `invalid_mcp_credential` and Playwright (the documented web E2E workflow) is not installed, so viewport/theme verification can only be done statically.

## Resolved Items
- Fixed client component directive issue on `MobileBottomNav.tsx`.
- Resolved RPC security user context parameter in `005_fix_dashboard_rpc_user_context.sql`.
