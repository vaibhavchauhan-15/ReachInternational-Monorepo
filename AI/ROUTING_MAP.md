# Routing Map — ReachInternational

## Public Routes
| Route | Page File | Access | Description |
|---|---|---|---|
| `/` | `app/page.tsx` | Public | SaaS Landing Page (Hero, Features, Pricing, Testimonials) |
| `/login` | `app/login/page.tsx` | Public | User authentication login page |
| `/signup` | `app/signup/page.tsx` | Public | User registration & onboarding |
| `/forgot-password` | `app/forgot-password/page.tsx` | Public | Password recovery request & link generation |
| `/privacy` | `app/privacy/page.tsx` | Public | Enterprise data protection & privacy policy |
| `/terms` | `app/terms/page.tsx` | Public | Fleet operations terms of service & equipment custody |
| `/account-deletion` | `app/account-deletion/page.tsx` | Public | Self-service account deletion request portal |
| `/onboarding` | `app/onboarding/page.tsx` | Authenticated | Profile completion gate for new users |

## Authenticated App Routes `(app)`
All routes inside `(app)` require an active session and inherit layout from `app/(app)/layout.tsx`.

| Route | Page File | Allowed Roles | Primary Purpose |
|---|---|---|---|
| `/dashboard` | `app/(app)/dashboard/page.tsx` | `super_admin`, `admin`, `manager`, `supervisor`, `hr`, `operator` | Operations overview, running metrics & fleet statistics |
| `/machines` | `app/(app)/machines/page.tsx` | `super_admin`, `admin`, `manager`, `supervisor`, `operator` | Fleet machinery directory, 24h shift assignments, HMR logs |
| `/machines/[id]` | `app/(app)/machines/[id]/page.tsx` | `super_admin`, `admin`, `manager`, `supervisor`, `operator` | Machine detail, 24h personnel assignments, HMR history, audit trail |
| `/clients` | `app/(app)/clients/page.tsx` | `super_admin`, `admin`, `manager`, `supervisor` | Client CRM, site locations, equipment deployments, contact/tax info |
| `/operations` | `app/(app)/operations/page.tsx` | `super_admin`, `admin`, `manager`, `supervisor`, `operator` | Daily running hour logs, machine/client/operator views, operator fast entry |
| `/users` | `app/(app)/users/page.tsx` | `super_admin`, `admin`, `manager`, `supervisor`, `hr` | Employee & account management, approvals, profile change diffs |
| `/audit` | `app/(app)/audit/page.tsx` | `super_admin`, `admin`, `manager`, `hr` | Immutable security audit logs, state mutations, before/after diffs |

## Canonical Roles
The platform strictly supports 6 canonical roles across web, mobile, shared packages, and database:
1. `super_admin`: Full platform control, security governance, user administration.
2. `admin`: Global organizational management, fleet & client administration, user management.
3. `manager`: Operations & business oversight, fleet management, client contracts, running hour logs.
4. `supervisor`: Field site supervision, machine HMR entry, operator assignment management.
5. `hr`: Human resources, personnel lifecycle, profile change requests, user records.
6. `operator`: Daily machine operation, HMR meter logging (`/operations?tab=entry`), shift execution.
