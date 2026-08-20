# Routing Map — ReachInternational

## Public Routes
| Route | Page File | Access | Description |
|-------|-----------|--------|-------------|
| `/` | `app/page.tsx` | Public | SaaS Landing Page (Hero, Features, Pricing, Testimonials) |
| `/login` | `app/login/page.tsx` | Public | User authentication login page |
| `/signup` | `app/signup/page.tsx` | Public | User registration & onboarding |
| `/forgot-password` | `app/forgot-password/page.tsx` | Public | Password recovery request & link generation |

## Authenticated App Routes `(app)`
All routes inside `(app)` require an active session and inherit layout from `app/(app)/layout.tsx`.

| Route | Page File | Allowed Roles | Primary Components |
|-------|-----------|---------------|--------------------|
| `/dashboard` | `app/(app)/dashboard/page.tsx` | All | `Charts.tsx`, `ChartLoaders.tsx`, `MetricCard.tsx` |
| `/machines` | `app/(app)/machines/page.tsx` | All | `MachineListClient.tsx`, `MachineModal.tsx` |
| `/machines/[id]` | `app/(app)/machines/[id]/page.tsx` | All | Machine detail, service logs, status timeline |
| `/services` | `app/(app)/services/page.tsx` | All | `ServicesClient.tsx` |
| `/notifications` | `app/(app)/notifications/page.tsx` | All | `NotificationListClient.tsx`, `NotificationPreviewModal.tsx` |
| `/users` | `app/(app)/users/page.tsx` | `admin`, `service_manager` | User table, role assignments |

## API & Webhook Endpoints
| Endpoint | Handler File | Trigger | Description |
|----------|--------------|---------|-------------|
| `/api/cron/send-reminders` | `app/api/cron/send-reminders/route.ts` | Upstash QStash / Cron | Executes scheduled service reminder dispatches |
