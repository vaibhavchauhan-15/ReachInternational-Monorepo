# Monorepo Build Baseline (Phase 0)

> **BUILD MATRIX SPECIFICATION**  
> *Next.js: 16.2.12 (Turbopack)*  
> *Monorepo Orchestrator: Turborepo 2.10.11*  
> *Package Manager: pnpm 11.21.0*  
> *Node Version: v22.22.3*  
> *Build Total Time: 1m 4.676s (Turbo 9 packages)*  
> *Compilation Time: 28.2s (Next.js Turbopack) + 26.8s (TypeScript Typecheck)*  
> *Static Page Generation: 35/35 pages generated in 666ms*

---

## 1. Monorepo Package Build Status

| Package Name | Package Type | Build Status | Caching Behavior | Output Summary |
| :--- | :--- | :---: | :---: | :--- |
| `@reachinternational/types` | Shared Library | PASS | Turbo Cached | Type definitions ready |
| `@reachinternational/design-tokens` | Shared Design | PASS | Turbo Cached | Design tokens ready |
| `@reachinternational/utils` | Shared Utility | PASS | Turbo Cached | Utilities ready |
| `@reachinternational/config` | Shared Config | PASS | Turbo Cached | Config ready |
| `@reachinternational/validation` | Shared Zod Schemas | PASS | Turbo Cached | Schemas ready |
| `@reachinternational/permissions` | Shared RBAC | PASS | Turbo Cached | RBAC permissions ready |
| `@reachinternational/api-client` | Shared Client | PASS | Turbo Cached | API client ready |
| `@reachinternational/mobile` | Expo Mobile App | PASS | Turbo Cached | Mobile build target ready |
| `@reachinternational/web` | Next.js 16 Web App | PASS | Compiled (1m 4s) | 35 Routes generated |

---

## 2. Next.js 16 Route Tree & Generation Strategy

Legend:
- `○  (Static)`: Prerendered as static content at build time.
- `ƒ  (Dynamic)`: Server-rendered on demand via React Server Components (RSC) & Data Access Layer (DAL).
- `ƒ Proxy (Middleware)`: Edge request interception and session verification.

### Web Route Inventory:

| Route Path | Type | Rendering Mode | Purpose |
| :--- | :---: | :--- | :--- |
| `ƒ /` | Dynamic | Server-Rendered | Root Gateway / Redirect |
| `○ /_not-found` | Static | Prerendered | 404 Error Page |
| `ƒ /administration` | Dynamic | Server-Rendered | Super Admin Console (Redirects to active hub) |
| `ƒ /api/cron/send-reminders` | Dynamic | API Route | Automated QStash / Cron Reminder Worker |
| `ƒ /audit-logs` | Dynamic | Server-Rendered | Audit Logs Viewer |
| `ƒ /branches` | Dynamic | Server-Rendered | Branch Management |
| `ƒ /challans` | Dynamic | Server-Rendered | Delivery Challans Hub |
| `ƒ /clients` | Dynamic | Server-Rendered | Client CRM Registry |
| `ƒ /clients/[id]` | Dynamic | Server-Rendered | Client Detail View |
| `ƒ /complaints` | Dynamic | Server-Rendered | Machine Breakdown Complaints |
| `ƒ /crm` | Dynamic | Server-Rendered | CRM Leads & Deals |
| `ƒ /dashboard` | Dynamic | Server-Rendered | Dashboard (Redirects to `/machines`) |
| `ƒ /dashboard/logs` | Dynamic | Server-Rendered | Activity Logs |
| `ƒ /documents` | Dynamic | Server-Rendered | Document Storage Hub |
| `ƒ /finance` | Dynamic | Server-Rendered | Invoices & Finance Hub |
| `○ /forgot-password` | Static | Prerendered | Password Recovery Screen |
| `ƒ /hr` | Dynamic | Server-Rendered | HR & Employees Hub |
| `ƒ /inventory` | Dynamic | Server-Rendered | Spare Parts Inventory Hub |
| `○ /login` | Static | Prerendered | Authentication Login Screen |
| `ƒ /machines` | Dynamic | Server-Rendered | **Core Machine Fleet Hub** |
| `ƒ /machines/[id]` | Dynamic | Server-Rendered | Single Machine Detail Page |
| `ƒ /my-work` | Dynamic | Server-Rendered | Personal Tasks View |
| `ƒ /notification` | Dynamic | Server-Rendered | Notification Center |
| `ƒ /notifications` | Dynamic | Server-Rendered | Notification Management |
| `ƒ /operations` | Dynamic | Server-Rendered | **Core Operations Hub (Logs, Assignments, Entry, History)** |
| `ƒ /purchase-orders` | Dynamic | Server-Rendered | Purchase Orders Hub |
| `ƒ /purchase-orders/[id]` | Dynamic | Server-Rendered | Single Purchase Order View |
| `ƒ /rentals` | Dynamic | Server-Rendered | Machine Rentals Hub |
| `ƒ /reports` | Dynamic | Server-Rendered | Analytics & Export Reports |
| `ƒ /service` | Dynamic | Server-Rendered | Service Records |
| `ƒ /services` | Dynamic | Server-Rendered | Maintenance & Service Hub |
| `○ /signin` | Static | Prerendered | Legacy Signin Alias |
| `○ /signup` | Static | Prerendered | **User Self-Registration Screen** |
| `○ /sitemap.xml` | Static | Prerendered | Public Sitemap |
| `ƒ /tasks` | Dynamic | Server-Rendered | Operations Task Board |
| `ƒ /users` | Dynamic | Server-Rendered | **Core User & Employee Management Hub** |
| `ƒ /vendors` | Dynamic | Server-Rendered | Vendor Directory |
| `ƒ /vendors/[id]` | Dynamic | Server-Rendered | Single Vendor Detail View |

---

## 3. Shared Bundle Distribution

- Polyfill Chunk: `static/chunks/0cz1d0mv5g_q7.js` (109.95 KB)
- Root Main / Runtime Files:
  - `static/chunks/turbopack-3d5yaka1vsc2b.js` (10.37 KB)
  - `static/chunks/3apf5jap0d9wm.js` (32.11 KB)
  - `static/chunks/3po3fl2ey1icj.js` (30.65 KB)
  - `static/chunks/2j2woml_bs7pk.js` (43.45 KB)
  - `static/chunks/20_ga2wjswjyy.js` (222.09 KB)
  - `static/chunks/17xr82xco-q7f.js` (108.14 KB)

---

## 4. Observations & Optimization Insights (For Phase 1+)

1. **Static vs Dynamic**: Public pages (`/login`, `/signup`, `/forgot-password`) are prerendered as static HTML shells (`○`), hydrating interactive leaf components instantly.
2. **Server-Side Rendering Efficiency**: Dynamic operational routes (`/machines`, `/operations`, `/users`) execute server-side data fetching via Next.js RSC and stream minimal JSON payloads to leaf client components.
3. **Build Time**: Turbopack compiles all 35 routes in **28.2s**, and static page generation completes in **666ms**.
