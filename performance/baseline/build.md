# Monorepo Build & Bundle Performance Baseline — Phase 0

> **Build Command**: `pnpm build` (`turbo run build`)  
> **Compiler**: Next.js 16.2.12 (Turbopack)  
> **Compilation Time**: 63s compilation + 30.9s TypeScript check + 689ms page generation = **2m 6.8s total build time**  
> **Recorded Date**: 2026-08-27

---

## 1. Monorepo Build Execution Matrix

```text
Packages in Scope: 9
├── @reachinternational/config          (echo built - ~0.1s)
├── @reachinternational/types           (echo built - ~0.1s)
├── @reachinternational/design-tokens   (echo built - ~0.1s)
├── @reachinternational/utils           (echo built - ~0.1s)
├── @reachinternational/permissions     (echo built - ~0.1s)
├── @reachinternational/validation      (echo built - ~0.1s)
├── @reachinternational/api-client      (echo built - ~0.1s)
├── @reachinternational/mobile          (Expo mobile target ready - ~0.2s)
└── @reachinternational/web             (next build - 126.8s)
```

---

## 2. Next.js Route Manifest & Page Rendering Strategy

| Route Path | Type | Rendering Mode | Purpose / Area |
|---|---|---|---|
| `/` | Dynamic (`ƒ`) | Server Rendered on Demand | Root Gateway / Redirect |
| `/_not-found` | Static (`○`) | Prerendered Static Content | Global 404 Page |
| `/login` | Static (`○`) | Prerendered Static Content | User Authentication Form |
| `/signup` | Static (`○`) | Prerendered Static Content | Operator & Employee Access Request |
| `/forgot-password` | Static (`○`) | Prerendered Static Content | Password Reset Request |
| `/signin` | Static (`○`) | Prerendered Static Content | Legacy Route Redirect |
| `/sitemap.xml` | Static (`○`) | Prerendered Static Content | SEO XML Sitemap |
| `/machines` | Dynamic (`ƒ`) | Server Rendered on Demand | Fleet Inventory Directory |
| `/machines/[id]` | Dynamic (`ƒ`) | Server Rendered on Demand | Individual Machine Detail |
| `/operations` | Dynamic (`ƒ`) | Server Rendered on Demand | Operations Hub (Running Hours & Assignments) |
| `/users` | Dynamic (`ƒ`) | Server Rendered on Demand | User & Operator Directory |
| `/clients` | Dynamic (`ƒ`) | Server Rendered on Demand | Client Accounts Directory |
| `/clients/[id]` | Dynamic (`ƒ`) | Server Rendered on Demand | Client Account Details |
| `/dashboard` | Dynamic (`ƒ`) | Server Rendered on Demand | Role Dashboard View |
| `/dashboard/logs` | Dynamic (`ƒ`) | Server Rendered on Demand | Fleet Activity Feed |
| `/administration` | Dynamic (`ƒ`) | Server Rendered on Demand | System Admin Panel |
| `/audit-logs` | Dynamic (`ƒ`) | Server Rendered on Demand | Security & Operational Audit Trail |
| `/branches` | Dynamic (`ƒ`) | Server Rendered on Demand | Branch / Depot Locations |
| `/challans` | Dynamic (`ƒ`) | Server Rendered on Demand | Delivery & Parts Challans |
| `/complaints` | Dynamic (`ƒ`) | Server Rendered on Demand | Machine Breakdown Complaints |
| `/crm` | Dynamic (`ƒ`) | Server Rendered on Demand | CRM & Customer Leads |
| `/documents` | Dynamic (`ƒ`) | Server Rendered on Demand | Company & Fleet Documents |
| `/finance` | Dynamic (`ƒ`) | Server Rendered on Demand | Invoices & Ledgers |
| `/hr` | Dynamic (`ƒ`) | Server Rendered on Demand | Employee Directory & Salary |
| `/inventory` | Dynamic (`ƒ`) | Server Rendered on Demand | Spare Parts & Stock |
| `/my-work` | Dynamic (`ƒ`) | Server Rendered on Demand | Engineer & Operator Work Queue |
| `/notifications` | Dynamic (`ƒ`) | Server Rendered on Demand | Notification Log Feed |
| `/purchase-orders` | Dynamic (`ƒ`) | Server Rendered on Demand | PO Management |
| `/purchase-orders/[id]`| Dynamic (`ƒ`) | Server Rendered on Demand | Purchase Order Detail |
| `/rentals` | Dynamic (`ƒ`) | Server Rendered on Demand | Rental Agreements & Fleet Dispatch |
| `/reports` | Dynamic (`ƒ`) | Server Rendered on Demand | Operations & Financial Reports |
| `/service` | Dynamic (`ƒ`) | Server Rendered on Demand | Maintenance Records |
| `/services` | Dynamic (`ƒ`) | Server Rendered on Demand | Scheduled Maintenance Hub |
| `/tasks` | Dynamic (`ƒ`) | Server Rendered on Demand | Maintenance Tasks & Followups |
| `/vendors` | Dynamic (`ƒ`) | Server Rendered on Demand | Supplier & Vendor Directory |
| `/vendors/[id]` | Dynamic (`ƒ`) | Server Rendered on Demand | Vendor Detail |
| `/api/cron/send-reminders` | Dynamic (`ƒ`) | Serverless API Route | Scheduled Job Handler (QStash/Cron) |

---

## 3. Next.js Experimental Configurations Active

- `optimizePackageImports`: Lucide React, Radix UI, Base UI
- `serverActions.bodySizeLimit`: `1mb`
- `staleTimes.dynamic`: `0s` (strict immediate data freshness for operational routes)
- `staleTimes.static`: `180s`
- Edge Proxy (`proxy.ts`): Replaced deprecated `middleware.ts`

---

## 4. Build Optimization Targets for Subsequent Phases

1. **Reduce Client Bundle Overhead**:
   - Defer interactive modules (`recharts`, modal popups, large sheet drawers) using `dynamic(() => import(...), { ssr: false })`.
2. **Turborepo Output Caching**:
   - Fix warning: `no output files found for task ... Please check your outputs key in turbo.json` to enable incremental monorepo builds.
3. **Build Compilation Time**:
   - Current total build time: **2m 6s**. Target: `< 45s` with warmed Turborepo remote/local cache.
