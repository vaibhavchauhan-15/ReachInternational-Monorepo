# Ingested Project Requirements

**Analysis Date:** 2026-09-09

## Functional Requirements

### REQ-MACH-001: Machine Master Data Management
- source: `prd.md`, `docs/current-architecture.md`
- description: Complete machine lifecycle management including serial number uniqueness, manufacturer specs, hour meter readings, client allocations, and document attachments.
- acceptance criteria:
  - CRUD operations restricted to Super Admin, Admin, and Service Managers.
  - Serial numbers must be unique across the fleet.
  - Server-side search, filtering, and pagination support up to 50,000 machines.

### REQ-SERV-002: Service Scheduling & Field Execution
- source: `prd.md`, `docs/phases.md`
- description: Track recurring service intervals based on running hours or calendar dates. Enable field service engineers to log completed maintenance, checklist items, and photo evidence.
- acceptance criteria:
  - Status progression: Pending → In Progress → Completed / Verified.
  - Service history immutable once closed.
  - Real-time notification dispatch upon service completion.

### REQ-NOTIF-003: Automated Multi-Channel Alert Scheduling
- source: `prd.md`
- description: Automated daily notification system alerting admins and assigned engineers about machines due today, due tomorrow, or overdue.
- acceptance criteria:
  - Automated execution via Upstash QStash cron trigger.
  - WhatsApp alerts formatted with pre-approved Twilio Content Templates.
  - Fallback SMS and SendGrid email notifications.
  - Zero missed "due today" alerts.

### REQ-OPS-004: Machine Hour Meter & Breakdown Logging
- source: `docs/phases.md`, `docs/current-database.md`
- description: Mobile and web shift hour logging for machine operators and supervisors with breakdown tracking.
- acceptance criteria:
  - Validates chronological meter progression (no back-stepping HMR).
  - Enforces shift window overlap prevention.
  - Supports overnight shift calculation (22:00 to 06:00) with lunch break deductions.
  - Breakdown tracking captures start time, end time, and conditional remarks.

### REQ-AUTH-005: Enterprise Role-Based Access Control (RBAC)
- source: `prd.md`, `docs/current-security.md`
- description: Secure authentication and authorization covering 12 enterprise roles with PostgreSQL Row Level Security (RLS).
- acceptance criteria:
  - Supabase PKCE SSR session authentication with HTTP-only cookies.
  - Role capabilities strictly checked at UI, Server Action, and RLS levels.
  - Supervised role hierarchy (operators, mechanics, engineers assigned to supervisors).

### REQ-AUDIT-006: Tamper-Proof Centralized Audit Logging
- source: `prd.md`, `docs/current-architecture.md`
- description: System-wide audit trail recording all elevated operations, user state changes, and machine reassignments.
- acceptance criteria:
  - Captures actor ID, name, role, IP address, severity, and Before/After JSON diffs.
  - Immutable append-only RLS policy (no update or delete permitted).
  - Sensitive passwords, credentials, and super-admin emails auto-redacted prior to insert.

### REQ-MOB-007: Cross-Platform Mobile Application
- source: `docs/phases.md`
- description: Native React Native / Expo mobile application tailored for field technicians, operators, and supervisors.
- acceptance criteria:
  - Built with Expo Router and `@tanstack/react-query`.
  - Full UI and feature parity with web application for operational workflows.
  - Touch-optimized card reflows, bottom sheets, and minimum 44px hit targets.

### REQ-DATA-008: Canonical Pagination & Scalable Querying
- source: `docs/phases.md`, `docs/current-architecture.md`
- description: Consistent data rendering across all high-volume tables (>20 rows).
- acceptance criteria:
  - Canonical `<Pagination />` integrated across desktop table and mobile touch card views.
  - High-volume routes (`/users`, `/operations?tab=logs`, `/clients`, `/audit`) utilize server-side `.range()` pagination.
