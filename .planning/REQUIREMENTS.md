# Requirements: ReachInternational

**Defined:** 2026-09-09
**Core Value:** Zero missed machine maintenance due dates and 100% field operational accountability across web and mobile platforms with real-time audit logging.

## v1 Requirements

### Authentication & RBAC

- [x] **AUTH-01**: User can authenticate securely via Supabase PKCE SSR auth with HTTP-only cookies on web.
- [x] **AUTH-02**: Mobile user session persists securely using `expo-secure-store`.
- [x] **AUTH-03**: Enforce 12 enterprise roles (`super_admin`, `admin`, `manager`, `service_manager`, `supervisor`, `engineer`, `service_engineer`, `mechanic`, `operator`, `client`, `store_manager`, `hr_manager`).
- [x] **AUTH-04**: Support supervised role hierarchy (operators, mechanics, engineers assigned to supervisors).

### Machine Master Data

- [x] **MACH-01**: Complete machine CRUD restricted to Super Admin, Admin, and Service Managers.
- [x] **MACH-02**: Enforce unique machine serial numbers with database-level constraints.
- [x] **MACH-03**: Server-side pagination and debounced search across machines fleet.
- [x] **MACH-04**: Machine client assignment, location tagging, and operational status tracking.

### Service Scheduling & Field Workflows

- [x] **SERV-01**: Automated calculation of next service due dates based on running hours and calendar intervals.
- [x] **SERV-02**: Field service engineers can log completed services with checklist items and photo attachments.
- [x] **SERV-03**: Immutable service records once verified by service manager.

### Automated Notifications Engine

- [x] **NOTIF-01**: Daily automated cron job running via Upstash QStash checking machines due today, tomorrow, or overdue.
- [x] **NOTIF-02**: WhatsApp alert dispatch using pre-approved Twilio Content Templates to assigned engineers and admins.
- [x] **NOTIF-03**: Fallback SMS and SendGrid email notifications.
- [x] **NOTIF-04**: Notification logs with manual retry trigger for failed deliveries.

### Operations & Hour Meter Logging

- [x] **OPS-01**: Daily machine hour meter logs with chronological sequencing validation (no backwards HMR).
- [x] **OPS-02**: Shift window overlap prevention preventing multiple operators logging the same equipment simultaneously.
- [x] **OPS-03**: Overnight shift duration calculation (e.g. 22:00 to 06:00) with lunch break deductions.
- [x] **OPS-04**: Breakdown incident tracking with start time, end time, and conditional remarks.

### Centralized Audit Trail

- [x] **AUDIT-01**: System-wide audit log capturing actor ID, name, role, IP address, severity, and event taxonomy.
- [x] **AUDIT-02**: Before vs After JSON state diffs viewable via dedicated drawer and deep-link route `/audit/[id]`.
- [x] **AUDIT-03**: Append-only tamper-proof database policy with automated credential redaction.

### Cross-Platform Mobile Application

- [x] **MOB-01**: React Native / Expo 54 application sharing business packages with web application.
- [x] **MOB-02**: Field operator daily shift logging with native touch time pickers and breakdown toggles.
- [x] **MOB-03**: Complete offline submission queue with automatic background sync when connectivity resumes.
- [ ] **MOB-04**: Push notifications for immediate breakdown assignments.

### High-Density Data Tables & Pagination

- [x] **DATA-01**: Canonical `<Pagination />` integrated across all desktop tables and mobile card views exceeding 20 rows.
- [x] **DATA-02**: Server-side range pagination (`.range()`) on high-volume directories (`/users`, `/operations`, `/clients`, `/audit`).

## v2 Requirements

### Telemetry & Advanced Field Intelligence

- **IOT-01**: Direct CAN bus IoT hardware integration for automated hour meter updates.
- **AI-01**: Predictive machine failure modeling based on vibration and temperature anomalies.
- **GEO-01**: GPS geo-fencing alerts when rented machines leave authorized site perimeters.

## Out of Scope

| Feature | Reason |
|---------|--------|
| Multi-tenant SaaS | ReachInternational is a single-tenant enterprise operating for its own fleet |
| In-app Credit Card Gateway | Invoicing and payments are enterprise B2B (PO matching, bank transfers) |
| Independent Mobile Database | Strict architectural constraint: single shared Supabase PostgreSQL instance |

## Traceability

| Requirement | Module | Status |
|-------------|--------|--------|
| AUTH-01 – AUTH-04 | `apps/web/app/(auth)`, `packages/permissions` | Complete |
| MACH-01 – MACH-04 | `apps/web/app/(app)/machines`, `supabase/migrations` | Complete |
| SERV-01 – SERV-03 | `apps/web/app/(app)/services`, `apps/web/lib/queries/services.ts` | Complete |
| NOTIF-01 – NOTIF-04| `apps/web/lib/notifications`, `apps/web/app/api/cron` | Complete |
| OPS-01 – OPS-04 | `apps/web/app/(app)/operations`, `apps/mobile/app/(app)/operations.tsx` | Complete |
| AUDIT-01 – AUDIT-03| `apps/web/app/(app)/audit`, `apps/web/lib/audit.ts` | Complete |
| MOB-01 – MOB-02 | `apps/mobile/app/(app)` | Complete |
| MOB-03 | `apps/mobile/lib/offline` | Complete |
| MOB-04 | `apps/mobile/lib/sync` | Active |
| DATA-01 – DATA-02 | `apps/web/components/ui/Table.tsx`, `apps/web/lib/queries/*` | Complete |

---
*Requirements defined: 2026-09-09*
*Last updated: 2026-09-09 after /gsd-ingest-docs*
