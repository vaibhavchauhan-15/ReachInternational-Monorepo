# ReachInternational — Industrial Machine Running Logs & Fleet Operations Platform

> **ReachInternational** — Enterprise platform engineered to automate daily machine running hour logs, operator shift entries, operator-to-machine assignments, machinery fleet management (add/edit/delete), user role governance, and PDF/Excel report exports.

---

## 📋 Table of Contents

- [Project Overview](#-project-overview)
- [Active Core Modules](#-active-core-modules)
- [Monorepo Architecture](#-monorepo-architecture)
- [Tech Stack](#-tech-stack)
- [Getting Started](#-getting-started)
- [User Roles & RBAC](#-user-roles--rbac)
- [Database Schema](#-database-schema)
- [Verification & Quality Gate](#-verification--quality-gate)

---

## 🚀 Project Overview

**ReachInternational** automates daily industrial machine running hour logs and operator workflow management across India. Built for Service Managers, Supervisors, Operators, and Admins, it eliminates paper logbooks, enforces non-overlapping shift validations, tracks operator machine assignments, and generates instant PDF print reports and Excel exports for monthly client billing.

### Core Problems Solved

- ❌ **Manual & Error-Prone Paper Logbooks**: Replaces paper logs with daily operator hour meter tracking, automated HMR calculation, overtime computation, and breakdown duration logging.
- ❌ **Overlapping Operator Shifts**: Enforces database-level PostgreSQL trigger validations preventing shift time overlaps.
- ❌ **Uncontrolled Fleet Catalog**: Provides centralized Machine Management (`/machines`) for adding, editing, and deleting heavy machinery units with detailed specs (Model, Serial No, YUM, HMR, Client).
- ❌ **Manual Report Preparation**: Generates 1-click A4 PDF reports (Machine Running Hours Report, Site Machine Report, Operator Daily Report) and formatted Excel spreadsheet exports.

---

## ✨ Active Core Modules

### 1. 🚜 Machine Management (`/machines`)
- **Fleet Directory & Specifications**: Track machinery fleet details including Model Name, Serial Number, Manufacturer, Year of Manufacture (YUM), Current HMR (Hour Meter Reading), Assigned Supervisors, Assigned Operators, and Client details.
- **24/7 Multi-Shift Multi-Personnel Assignment**: Industrial equipment operates continuously 24 hours a day across 8-hour shifts. The platform enables assigning multiple supervisors (`supervisor_ids UUID[]`) and multiple operators (`operator_ids UUID[]`) per machine simultaneously. Features automatic sync triggers maintaining primary single-ID compatibility (`current_supervisor_id` & `current_operator_id`), GIN array-containment indexing, searchable multi-chip `<MultiUserSelect>` with shift timings, and dedicated "Assigned Shift Personnel (24h Fleet Coverage)" cards on `/machines/[id]`.
- **Supervisor Operational Status & Assignment Management**: Field supervisors can enter/update Hour Meter Readings (HMR), update Equipment Health (`active`, `spare`, `under_maintenance`, `breakdown`), update Rental Status (`available`, `rented`), and assign, change, or unassign Operators (`operator_ids`, `current_operator_id`) and Clients (`client_id`). Master machine specifications (`model`, `serial_number`, `year_of_mfg`, `manufacturer`, `machine_id`) and supervisor assignments (`supervisor_ids`, `current_supervisor_id`) remain strictly locked to Manager tier or above across PostgreSQL RLS triggers, Server Actions, and UI modals.
- **Dynamic Client Selection on "Rented" Status**: When marking or editing a machine's rental status as "Rented", the system dynamically surfaces a searchable client picker `<ClientSelect>` linking the machine directly to `public.clients(id)` via `client_id` foreign key. Clearing or marking the status as "Available" resets the client assignment. Fetched via lightweight, non-blocking parallel queries (`Promise.all`), avoiding waterfalls and over-fetching.
- **Serial Number Duplicate Prevention & Multi-Layer Validation**: Strict uniqueness enforcement preventing duplicate serial numbers across the database (PostgreSQL case-insensitive unique index `idx_machines_serial_number_unique_ci` & non-empty check constraint), backend Server Actions, Excel bulk spreadsheet import (intra-file duplicate tracking + DB pre-validation), web registration/edit modals (with real-time on-blur validation), and cross-platform mobile app.
- **Full Machine Lifecycle & Manager-or-Above Governance**: Add new machines, edit machine parameters via dedicated `/machines/[id]/edit` full-page editor, change/unassign supervisors, and delete machines with strict full-stack RBAC permissions (database RLS policies, DB triggers, backend Server Actions, and frontend gating) restricted strictly to Manager or above (`manager`, `service_manager`, `admin`, and `super_admin`).
- **Multi-Format Export & Reporting (Excel, CSV, PDF/Print)**: 1-click downloads for formatted Excel workbooks (`.xlsx` with metadata, statistics summary row, and auto-adjusted column widths), clean CSV files (`.csv` with UTF-8 BOM), and print-ready high-density PDF reports with company letterhead, KPI summaries, and 3-column verification sign-offs available across `EnterpriseTable` bulk multi-selection, page headers, and dropdown menus.
- **Full React Native Mobile Parity (`apps/mobile/app/(app)/machines.tsx`, `apps/mobile/components/machines/*`)**: Complete mobile fleet management with 4 interactive KPI metric cards, detailed 24h shift personnel view, machine category management modal (`MachineCategoryModal.tsx`), and native PDF/AirPrint/CSV directory exports (`MachineExportModal.tsx`).
- **Search & Filters**: Multi-option filters by Model Name, Serial Number, Manufacturer, Health Status, Supervisor, and Client Name.

### 2. 👥 User & Employee Management (`/users` & `/signup`)
- **System Accounts Directory**: Unified management of system users and staff accounts with active status tracking.
- **Mandatory Profile, Shift & Address Fields**: Strictly enforces Full Name, Email Address, 10-digit Mobile Phone Number, System Role, Shift Timing (`shift_time` e.g. Day Shift 08:00 AM - 08:00 PM), Street / Site Base Address (`address`, e.g. "Plot No. 42, MIDC Industrial Area, Chakan"), Normalized Location (**City/Town/Village**, **District**, and **State / Union Territory** referencing canonical `public.states` with `state_id`), and Regulatory Identity Details (Aadhaar Card Number with mathematical Verhoeff checksum & masked `XXXX-XXXX-1294` PII formatting and Driving Licence Number) across user profiles, admin modals, and self-registration.
- **Self-Service Profile Edits & Hierarchical Approval Workflow**: Users across all roles can edit their personal profile information (name, phone, shift schedule, address, Aadhaar, driving licence). Edits are routed through a strict multi-tier organizational approval workflow:
  - `super_admin`: Direct instant database update (no approval needed). Super Admin can approve changes for all roles.
  - `admin`: Request routed to `super_admin`. Admin can approve requests from all lower roles.
  - `manager` / `service_manager` / `hr_manager` / `store_manager`: Requests routed to `admin`. Can approve requests from supervisors and field staff.
  - `supervisor`: Requests routed to `manager`. **Supervisor has 0 approval access**.
  - Field Staff (`operator`, `engineer`, `mechanic`): Requests routed to `manager`.
- **Dedicated Profile Change Requests Section on `/users`**: Renders pending profile modification requests in a dedicated review section completely separate from new registration requests (`status = 'pending'`), displaying clear side-by-side diffs (Old Value vs Requested Value), individual Approve/Reject actions, and batch Accept All / Reject All actions.
- **Self-Service Registration & Admin Access Governance**: Users request platform access via `/signup` choosing their functional role (`manager`, `service_manager`, `service_engineer`, `supervisor`, `store_manager`, `operator`, `mechanic`, `hr_manager`), their working shift timing via interactive time pickers (`shift_start_time` and `shift_end_time`, defaulting to 12h day shift 08:00 AM - 08:00 PM), their street base address (`address`), and selecting their State/UT from a standardized dropdown linked to `public.states(id)`. The chosen role, shift timing, street address, and `state_id` are preserved in `public.users` in `pending` status, displayed in the Admin Pending User Approvals panel with distinct role badges, and maintained without modification upon administrator approval. All complete registrations are automatically flagged for zero-latency dashboard access upon admin activation.
- **Dynamic Supervisor Selection for Supervised Roles**: When registering or creating/editing a user account with a supervised role (`operator`, `service_engineer`, `mechanic`), the system dynamically renders a searchable and scrollable Supervisor selector. On `/signup` (both Web and Mobile), supervised personnel choose from active supervisors loaded via `get_active_supervisors_public()` RPC. In `/users`, the desktop table features a dedicated `Supervisor` column, and admin modals (`UserCreateModal`, `UserEditModal`) provide direct supervisor assignment and updates with full export support.
- **Multi-Selection & Bulk Actions**: Select individual or all filtered user accounts with a master checkbox and floating bulk actions bar. Perform instant formatted Excel (`.xlsx`) or CSV (`.csv`) export downloads and high-concurrency Bulk Deletions with safety self-delete guards, super admin protection, optimistic UI removals, and audit logging.
- **Full React Native Mobile Parity (`apps/mobile/app/(app)/users.tsx`, `apps/mobile/components/users/*`)**: Complete mobile replication across iOS and Android with 100% feature parity: 4 interactive KPI metric cards (Total, Active, Engineers, Pending), 6-dimension custom filter modal selector (Role, Status, State covering all 36 Indian states & UTs, KYC, Joined Date, Sort By), mobile touch card feed with role-accent left borders, User Detail bottom sheet with quick contact CTAs (`Email User` & `Call Phone`), ACCOUNT DETAILS well (ID, Email, Phone, Shift, Address, Location, Aadhaar with eye reveal toggle, Licence, Registered Date with relative time), MANAGEMENT ACTIONS well (Role selector, Supervisor selector, Edit Account, Reset Password, Activate/Deactivate, Delete Account), User Edit sheet, Password Reset modal with temporary credential generator, Reject Reason modal, native CSV export via `expo-file-system/legacy` & `expo-sharing`, Profile Change Requests diff review, and floating bulk actions bar.
- **Mobile Profile Screen & Validation Parity (`apps/mobile/app/(app)/profile.tsx`, `apps/mobile/components/profile/EditProfileModal.tsx`)**: Reads authoritative account data directly from the PostgreSQL `users` table, renders real-time pending profile modification request banners with withdrawal capabilities, and enforces Zod `ProfileUpdateSchema` alongside strict database uniqueness validation for mobile phone, 12-digit Aadhaar, and driving licence.
- **Mobile Permissions & Real-Time Telemetry (`apps/mobile/app.json`, `apps/mobile/lib/permissions/*`)**: Strictly scoped production permission matrix (`INTERNET` for Supabase API sync, `ACCESS_NETWORK_STATE` for NetInfo offline/online detection, `POST_NOTIFICATIONS` for runtime critical shift alerts). Obsolete camera and legacy storage permissions removed. Features a value-first notification permission primer modal (`NotificationPermissionModal.tsx`), 7-day soft dismissal cooldown in `AsyncStorage`, and a live "APP PERMISSIONS & TELEMETRY" card on the Profile screen (`/profile`) and Profile Sheet with 1-tap configuration.
- **Account Actions**: Create new user accounts, edit employee profiles, activate/deactivate accounts, and delete user accounts with full structured audit logging.

### 3. ⏱️ Operations Hub (`/operations`)
- **Running Hours Logs (`/operations?tab=logs`)**:
  - **3 View Modes**: Machine View (group by equipment), Client View (group by client site), and Operator View (group by operator).
  - **A4 PDF Reports**: 1-click printable PDF report exports with official company branding, centered titles (`MACHINE RUNNING HOURS REPORT`), client/site location sub-headers, and complete unpaginated dataset retrieval exporting all records for the selected month or custom date range across Client, Machine, and Operator views.
  - **Excel Exports**: Export formatted Excel workbooks (`.xlsx` with readable company filenames) capturing daily logs, HMR totals, operating hours, overtime, and breakdown durations for the complete selected period.
  - **Sub-Millisecond On-Demand Query Engine**: Composite B-tree indexed server action (`getOperationsExportLogsAction`) executing in ~0.45 ms in PostgreSQL, allowing fast server-side 10-row pagination for web browsing while fetching hundreds of complete operational records on-demand for export.
  - **Dynamic Viewport Selector Popovers & Clean Date Range Picker**: All filter dropdown selectors (`MachineSelect`, `SearchableSelect`, `ClientSelect`, `UserSelect`, `CustomDatePicker`, `DateRangePicker`) utilize fixed portaling (`createPortal` to `document.body`) with intelligent boundary detection, auto-flipping upward when space below is constrained, dynamic `maxHeight` clamping, and zero clipping across desktop and mobile viewports. The custom `<DateRangePicker>` features an ultra-clean, minimal calendar interface without cluttered preset pills or header banners, opening directly to month navigation and allowing users to select any month's start and end date directly on the month grid with zero inner scrollbars.
  - **Optimized Client Selector & Dynamic Fleet Cascade**: Client selector surfaces rich client profiles directly from the database (Company Name, Client Code, Fleet Size, Status, Full Address / Site Location, and Contact/GST details). Defaults automatically to the most recently active client via sub-millisecond indexed query (`idx_machine_hour_logs_date_created` at 0.105 ms), dynamically cascading to filter equipment fleets (`clientMachines`) and location sites (`clientSites`).
  - **Client Canonical Address & Multi-Site Operational Sites**: Treats `client.street + client.city + client.district + client.state + client.pincode` as the single authoritative address of the client across frontend (web and mobile), backend queries, and database functions. The database maintains a single clean `street text NOT NULL` column (dropping duplicate `"Street"` and separate `address` columns), formatting full address dynamically on the fly. Supports multi-site client deployments where projects operating under the same client company name at different project sites are cleanly aggregated under the company and filtered by distinct site locations without dropped or split logs.
- **Fleet Operator Machine Assignments (`/operations?tab=assignments`)**:
  - **Accordion-Based Machine Cards**: Default-closed summary cards displaying machine ID, model, serial, meter hours, status badge, operator capacity pill (`X / 3 Operators`), quick-reference operator chips, and direct `+ Assign` button.
  - **Expanded Slot Details & Actions**: Multi-shift slot view with shift time badges (☀️ morning / 🌙 night), assigned operator name, 1-click telephone calling (`tel:`), supervisor assigner attribution (`Assigned by: [Supervisor] • [Date]`), and 3 inline action triggers ("Change Operator", "End Shift", "Unassign").
  - **Clean, Uncluttered Interface**: All assignment history and activity audits are consolidated into the standalone first-class `/audit` module accessible directly from the primary navigation sidebar.
- **Cross-Platform Mobile App Parity (`apps/mobile/app/(app)/operations.tsx`)**:
  - Full mobile viewport parity with 4 interactive fleet KPI metric cards, searchable bottom sheet filters (Machine, Client, Location, Operator, Month), machine overview summary card (Manufacturer, Model, Serial, Run Hours, Breakdowns), client overview card, and operator KPI cards.
  - Native PDF document generation (`expo-print`) with AirPrint & Android Print Spooler integration (`Print.printAsync`), CSV spreadsheet export (`expo-file-system/legacy`), and native OS sharing sheet (`expo-sharing`).
  - Native Operator Machine Assignment workflow with 3-shift roster tracking (`0/3`, `1-2/3`, `3/3`), overnight shift badges, and atomic PostgreSQL conflict resolution (`assign_operator_machine_atomic`).
- **Overtime Shift Conflict Detection & Supervisor Resolution System (Web & Mobile Parity)**:
  - **Shared Conflict Parsing Engine (`@reachinternational/utils`)**: Intelligently parses technical database strings into human-readable warnings, severity pills (`DUAL MACHINE CUSTODY CONFLICT`, `SHIFT OVERRUN CONFLICT`), overtime claimed badges, colliding equipment codes, and concrete supervisor guidance (`acknowledgeAdvice` vs `adjustAdvice`).
  - **Comprehensive Touchpoint Warnings**: Active warnings across the Top Overtime Conflict Alert Banner (with expand/collapse toggles), individual daily running log cards/rows (with visual amber/green accents, conflict status badges, and inline advisory wells), the Shift Assignment Modal (rich conflict alert cards with action required instructions), and the Overtime Conflict Resolution Modal (incident breakdown, compliance warning bullet points, and live interactive recalculated running/overtime hours).

### 4. 🛡️ Centralized Audit Logs Module (`/audit`)
- **First-Class Sidebar Navigation**: Promoted from nested operations tabs to a dedicated, top-level sidebar route (`/audit`) accessible to authorized staff (`super_admin`, `admin`, `manager`, `service_manager`, `supervisor`, `engineer`, etc.).
- **Comprehensive Cross-Domain Event Taxonomy**:
  - **Machines**: Added, updated, deleted, status changed, hour meters updated, assigned to client, removed from client.
  - **Assignments**: Operator assigned/changed/unassigned (with assigner and ender attribution), supervisor assigned/changed/unassigned.
  - **Rentals**: Dispatched, rented, extended, inspected, returned, damage reported.
  - **Employees & Users**: Created, edited, approved, rejected, role updated, activated, deactivated, deleted, password reset.
  - **Authentication**: Sign-in, sign-out, failed logins, session expirations.
  - **Operations**: Hour logs created, updated, deleted, shifts started/ended, breakdowns logged.
  - **Security**: Unauthorized actions blocked, RLS violations, role modifications.
- **Real-Time Interactive KPI Strip**: Instant overview of Total Logged Events, Machine & Assignment Operations, Employee & Auth Events, and Security/Alerts with 1-click quick-filtering.
- **High-Performance Filter Toolbar**: Instant search across action, actor name, entity ID/name; category selector; severity pills (`info`, `warning`, `critical`); date range presets (`all`, `today`, `7days`, `30days`, `custom`); role filter; and 1-click CSV export.
- **Detail Slide-Over Drawer & Dedicated Route (`/audit/[id]`)**:
  - Actor metadata (name, role, email, client IP address).
  - Target entity linkage with direct navigation to machines or employee profiles.
  - Visual State Mutation Diff (Side-by-side Before vs After field comparison with color-coded additions, deletions, and modifications).
  - Raw event payload viewer with 1-click JSON copy.
- **Optimized Database Schema & Storage (Migration 053)**:
  - Add `category`, `severity`, `before_state`, `after_state`, `actor_name`, `actor_role`, `entity_name`, `ip_address` to `public.audit_logs`.
  - Composite indexes `(category, created_at DESC)`, `(severity, created_at DESC)`, and `(created_at DESC, id DESC)` for zero-JOIN sub-millisecond filtering.
  - Append-only tamper-proof RLS with role-based selective read access and automated PII redaction of super-admin emails.

### 5. 📝 Operator Daily Machine Logs & Log History (`/operations` for operators)
- **Daily Machine Log Entry (`tab=entry`)**:
  - **Machine Timeline Sequencing & Zero-Overlap Guarantee**: Strictly prevents duplicate and overlapping shifts for each machine. New logs must start at or after the previous log's end time. Supports exact handovers (`06:00 AM – 06:00 PM → 06:00 PM – 10:00 PM`) and overnight shifts (`31-Aug 10:00 PM → 01-Sep 06:00 AM`) across calendar days.
  - **Timeline Context Banner & 1-Click Handover Alignment**: Real-time banner displays previous log end time and handover eligibility with a 1-click button to align start time to exact handover.
  - **PostgreSQL GiST Exclusion & Concurrency Protection**: Atomic `[start_datetime, end_datetime)` GiST exclusion constraint and transaction-level advisory locks prevent race conditions during concurrent submissions.
  - **Section A (Machine & Client Info)**: Auto-populates Machine Model, Serial Number, Client Name, and Client Site Location.
  - **Section B (Time, Meter Readings & Normal Working Time)**: Mobile-optimized `<CustomTimePicker>` / `<TimeInput>` (compact Hours [1-12] & Minutes [0-60] fields with vertical AM/PM segmented toggle) paired side-by-side in a single row on mobile viewports without digit clipping, auto-defaulting start and end times to the operator's Supabase profile shift schedule (`shift_start_time` and `shift_end_time`), full duration shift inclusion with zero lunch deduction (e.g. 6:00 AM – 2:00 PM evaluates to 8.0h working time), live shift duration breakdown, Overtime computation commencing after 8.0h, Normal Working Time calculation ($\text{Duration} - \text{OT}$), and strict start/ending HMR validation with real-time non-blank checks eliminating 0-meter corruption and false running hours.
  - **Shift End Time Validation & Future Logging Prevention**: Strict 3-tier validation (Frontend, Server Actions/Zod, and PostgreSQL DB trigger & RPC) preventing operators from submitting logs before their shift has completed (e.g. attempting to log 02:00 PM when current time is 01:00 PM). Live 30-second interval ticker highlights future shift ends with `border-rose-500` and displays the concise error `"Cannot log before shift end."` optimized for compact mobile and desktop viewports.
  - **Section C (Machine Breakdown Tracking & Formatted Timestamp Persistence)**: Start Time and End Time time pickers for equipment breakdowns, live duration calculation (e.g. `(55min)` or `(3h:55min)`), breakdown bounds enforcement ensuring breakdown duration cannot exceed total shift duration, and structured database storage (`breakdown_start_time`, `breakdown_end_time`, `breakdown_duration`, `breakdown_hours` columns and `[Breakdown Duration: 02:30 PM - 03:25 PM (55min)]` formatted remarks) across web, mobile, and PostgreSQL schema.
  - **Enterprise Security & Lifecycle Hardening (Migration 052)**: Atomic RPC `submit_operator_hour_log_atomic` enforces caller identity checks (`auth.uid() = p_operator_id`), client-machine deployment matching, and equipment lifecycle guards (blocking hour logs on equipment in `maintenance` or `decommissioned` status). Synchronized across Web and React Native mobile apps.
- **Log History & Supervisor Running Hours Hub (`tab=logs` & `tab=history`)**:
  - **Server-Side Pagination & Database Indexing (Migration 058)**: Replaced full eager dataset loading with server-side pagination (fixed 10 records per page), exact counting, 3-tier resilient fallbacks, and composite indexes (`idx_machine_hour_logs_date_created` on `log_date DESC, created_at DESC, id DESC` and `idx_machine_hour_logs_client_date` on `client_id, log_date DESC`).
  - **Debounced Global Search & URL-Driven Filtering**: 300ms debounced search on Web and 400ms on Mobile querying machine model/serial, operator name, remarks, and locations via pre-resolved foreign key indices. Synchronized with Next.js App Router URL search params (`page`, `view`, `machine`, `client`, `operator`, `month`, `start`, `end`, `search`, `sort`) for bookmarkable and shareable views with `isPending` loading state.
  - **Cross-Platform Mobile Sync**: Mobile app logs feed features server-side range pagination (`.range()`), native touch controls (min 44px touch targets), and query-level date/status filtering.
  - Operators inspect past submitted daily machine logs with real-time shift timings alongside normal working time (excl. OT), overtime badges, and breakdown duration indicators (`🔴 02:30 PM - 03:25 PM (55min)`).
  - **7-Day Edit Locking Window**: Operators can edit and resubmit logs created within the past 7 days across desktop and mobile card views, after which logs are automatically locked to prevent retro-edits.

### 6. 🏢 Client Directory & Tax/Billing Management (`/clients`)
- **Streamlined Client Profile**: Uses Company Name as the single primary client identifier along with Contact Person, Phone Number, GSTIN Number, and PAN Card Number.
- **Site Location & District**: Stores primary Office / Site Street Address, City, District, State, and Pincode across database constraints, validation schemas, and UI modals.
- **Conditional Billing Address**: Supports dedicated separate billing addresses (Billing Address, City, District, State, Pincode) toggleable when billing differs from operational site locations.
- **Client Lifecycle Management**: Register new clients, update client parameters, inspect machine fleet counts, soft delete clients with historical log preservation, and manage contact persons.

### 7. 🚀 User Profile Onboarding & Fast Validation (`/onboarding`)
- **Incomplete Profile Interception**: Detects users missing essential details (`full_name`, `phone`, `role`, `shift_time`, `address`, `city`, `district`, `state`, `aadhaar_number`) and routes them directly to `/onboarding`.
- **Ultra-Fast Zero-Latency Bypass**: Employs a single `complete_profile = 'yes'` flag in `public.users`. Once completed, subsequent logins and requests verify in a single string comparison (`if (user.complete_profile === 'yes')`) with zero CPU overhead, completely skipping multi-field inspection.
- **Unified UX**: Reuses the battle-tested 4-section architecture from `/signup` with pre-filled profile information, `<CustomTimePicker>` / `<TimeInput>` integration, live shift duration calculations, and Verhoeff Aadhaar validation across Web and Mobile.

### 8. 🎨 Centralized UI Design System (`apps/web/components/ui/`)
- **Single Canonical UI Architecture**: One centralized reusable UI system across buttons, form controls, date & time pickers, search & filtering controls, enterprise tables, export controls, modals, and layouts.
- **Buttons**: Canonical `<Button>` supporting variants (`primary`, `secondary`, `outline`, `ghost`, `danger`, `destructive`, `success`, `link`, `primary-sm`, `ghost-sm`, `danger-sm`, `success-sm`), sizes (`sm`, `md`, `lg`, `icon`), `fullWidth`, `responsive` / `mobileIconOnly` (auto icon collapse on ≤640px), and `<IconButton>`.
- **Form Controls**: `<Input>`, `<PasswordInput>`, `<NumberInput>`, `<Textarea>`, `<Select>`, `<MultiSelect>`, `<Checkbox>`, `<Radio>`, `<Switch>`, and `<FormField>` layout wrappers.
- **Date & Time**: `<CustomDatePicker>`, `<DateRangePicker>` (custom calendar with connected ribbon range selection, provisional hover preview, presets: Today, Yesterday, Last 7d, Last 30d, This Month, and dynamic viewport positioning), `<TimeInput>` / `<TimePicker>` (manual Hours 1-12, Minutes 0-60, AM/PM toggle with inline validation), `<CustomTimePicker>`, and `<DateTimePicker>`.
- **Search & Filtering**: `<SearchBox>`, `<FilterToolbar>`, `<FilterDropdown>`, `<SortControl>`, and `<FilterChips>` with 1-click reset.
- **Tables & Data Display**: `<DataTable>`, `<EnterpriseTable>`, `<Pagination>` with page size controls (`10`, `25`, `50`, `100`), `<EmptyState>`, and `<SkeletonTable>`.
- **Export Controls**: `<ExportButton>` and `<ExportDropdown>` supporting Excel (`.xlsx`), CSV (`.csv`), PDF (`.pdf`), and Print actions with tooltips and mobile responsiveness.
- **Feedback & Navigation**: `<Alert>`, `<Drawer>`, `<Modal>`, `<ConfirmationDialog>`, `<Tabs>`, `<Breadcrumb>`, `<PageContainer>`, and `<Section>`.

### 9. ⚙️ Settings & System Preferences (`/settings`)
- **Differentiated Cross-Platform Experience**:
  - **Web Settings (`apps/web/app/(app)/settings`)**: Built for administration and enterprise configuration.
    - **Account**: User profile overview card (Avatar, role, KYC badges, contact info, shift timing, yard & street address), Edit Profile modal trigger, and Change Password form with length/match validation and `changePasswordAction` server action.
    - **Appearance**: Interactive 3-card preview system for Light, Dark, and System appearance adhering to Vercel Geist tokens (`#171717`, `#fafafa`, `#ffffff`, `#ebebeb`, `#0070f3`).
    - **About & Support**: 6 modular cards: Help & FAQ (modal), Operator Guide & pre-shift machinery checklist (modal), direct Contact Support email (`info@reachinternational.co.in`), Privacy Policy modal, Terms of Service modal, and system version telemetry (`v1.2.0 Build 2026.09`).
    - **Sign Out**: Red destructive confirmation modal and direct server action call to `logout()`.
    - **Navigation**: Integrated into `mainNavItems` in `AppSidebar.tsx` and user profile dropdown in `UserProfileDropdown.tsx`.
  - **Mobile Settings (`apps/mobile/app/(app)/settings`)**: Tailored for field operators and mobile device behavior.
    - **Bottom Floating Navbar**: Promoted Settings to the 4th primary bottom navigation tab in `MobileBottomNav.tsx`, replacing Profile.
    - **My Account Touch Card**: Compact card with Avatar, Name, Role badge, and email; tapping opens `AccountSettingsModal` containing shift schedule, assigned yard, KYC compliance, Edit Profile launcher, Change Password modal trigger, and link to full Profile screen.
    - **Notifications Touch Card**: Compact card with active alert count badge; tapping opens `NotificationSettingsModal` with switches for Push Notifications, Shift Reminders, Breakdown Alerts, Assignment Alerts, and Overtime Alerts.
    - **App Appearance**: Dedicated theme selector for `Light`, `Dark`, and `System` appearance.
    - **App Permissions**: Push notification permission status badge and `NotificationPermissionModal` launcher.
    - **About & Legal**: App version `v1.0.0 (Build 1)`, Expo SDK 57 runtime, dedicated Privacy Policy (`/(app)/privacy`), Terms of Service (`/(app)/terms`), and official brand footer (`BRAND_NAME`, `BRAND_TAGLINE`).
    - **Google Play Store Compliance**: Full Play Store submission suite: production AAB configuration (`eas.json`), `versionCode: 1`, blocked transitive permissions (`app.json`), public web compliance endpoints (`/privacy`, `/terms`, `/account-deletion`), store listing copy and visual assets (`apps/mobile/store-assets/`), Data Safety declaration (`PLAY_STORE_DATA_SAFETY.md`), Content Rating guide (`PLAY_STORE_CONTENT_RATING.md`), and end-to-end AAB build checklist (`PLAY_STORE_SUBMISSION_CHECKLIST.md`).
    - **Sign Out**: Red pill button with confirmation alert calling `signOut()` and navigating to login.

### 10. 🔒 Account Deletion & Statutory Data Governance (`/account-deletion`)
- **Self-Service Deletion Portals (Web & Mobile Parity)**:
  - **Web Portal (`apps/web/app/account-deletion`)**: Clean, W3C-standard, unauthenticated/authenticated public portal with real-time submission form (`AccountDeletionWebForm.tsx`). Users specify their registered email/phone and reason. Integrated into Profile sheet (`MobileBottomNav.tsx`), User Profile Dropdown (`UserProfileDropdown.tsx`), and Settings (`SettingsClient.tsx`).
  - **Mobile Native Screen (`apps/mobile/app/(app)/account-deletion.tsx`)**: Accessible via Settings -> Profile (`profile.tsx` & `settings.tsx`). Provides real-time pending status tracking, withdrawal/cancellation capabilities, and direct native submission.
- **Administrative Review & Approval Workflow (`/users`)**:
  - Deletion requests from both Web and Mobile stream directly into the Admin Users management console alongside pending employee approvals.
  - **Web Admin Review (`AccountDeletionRequestsSection.tsx`)**: Side-by-side review cards with requester identity, origin badge (`Web Portal` vs `Mobile App`), reason, and action triggers. Approving sets user `status = 'inactive'`, scrubs sensitive KYC identity numbers (`aadhaar_number = NULL`, `license_number = NULL`), and records structured audit log `user.account_deleted`.
  - **Mobile Admin Review (`apps/mobile/app/(app)/users.tsx`)**: High-contrast native review cards with alert notification badges, Approve & Deactivate modal, and Decline modal.
- **Statutory Heavy Equipment Compliance**: In full accordance with Indian Factories Act, Motor Vehicles Act, and insurance regulations, daily machine running logs (HMR), maintenance records, and safety inspections are permanently preserved with operator identity attribution for statutory audits.
- **Database & Backend Resilience**: Dedicated table `account_deletion_requests` (Migration 063) backed by automatic fallback to `profile_change_requests` (`requested_data.type = 'account_deletion'`) to ensure 100% immediate runtime availability across environments.

---

## 🏗 Monorepo Architecture

ReachInternational is structured as a pnpm workspace managed by Turborepo (`turbo.json`).

```
ReachInternational-Monorepo/
├── apps/
│   ├── web/                          # Next.js 16 App Router Web Application (@reachinternational/web)
│   │   ├── app/                      # App Router routes (/machines, /operations, /users, /login, /signup)
│   │   ├── components/               # Geist system UI components, forms & print modals
│   │   └── lib/                      # Data Access Layer (DAL), query helpers & server actions
│   └── mobile/                       # Expo / React Native Mobile Application (@reachinternational/mobile)
│       ├── app/                      # Native App Router screens (machines, operations, users, login, onboarding, profile)
│       ├── components/               # Native UI & domain components (machines, work, ui, offline, branding)
│       │   └── machines/             # MobileMachineCard, MachineDetailView, MachineModal, MultiUserSelect, ClientSelect, etc.
│       ├── shell/                    # WebView shell fallback (AppWebView, NativeBridge, OfflineScreen, ErrorScreen)
│       └── lib/                      # Supabase client, auth hooks, offline queue, navigation drawer context
├── packages/                         # Canonical Shared Monorepo Packages
│   ├── types/                        # @reachinternational/types — TypeScript interfaces & database types
│   ├── validation/                   # @reachinternational/validation — Zod validation schemas
│   ├── permissions/                  # @reachinternational/permissions — RBAC matrix & scoping rules
│   ├── design-tokens/                # @reachinternational/design-tokens — Geist visual tokens & adapters
│   └── utils/                        # @reachinternational/utils — Platform-neutral date, INR currency & string helpers
├── supabase/migrations/              # Idempotent PostgreSQL schema migration scripts
├── pnpm-workspace.yaml               # pnpm workspace declaration
└── turbo.json                        # Turborepo task pipeline orchestration
```

---

## 🛠 Tech Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| **Framework** | Next.js 16.2 (App Router) | React Server Components, Server Actions, Edge Proxy |
| **Mobile** | Expo 57 / React Native 0.86 (WebView Shell) | Native WebView shell loading authoritative web app with cookie persistence, offline interception & native print/download bridge |
| **Language** | TypeScript 5 (Strict Mode) | End-to-end type safety across web, mobile, and packages |
| **Database** | Supabase PostgreSQL | Relational database with Row Level Security (RLS) & Triggers |
| **Auth** | Supabase Auth (SSR) | Server-side cookie sessions & JWT authentication |
| **Styling** | Tailwind CSS v4 | Utility-first styling with Geist design system tokens |
| **Animations** | Framer Motion 12 | Fluid UI transitions, modals, and drawers |
| **PDF & Export**| HTML5 Print Engine / XLSX | Single-page A4 PDF documents & formatted Excel exports |

---

## 🚦 Getting Started

### Prerequisites

- **Node.js**: 20+ (LTS)
- **pnpm**: `pnpm@11.21.0` (Required monorepo package manager)
- **Supabase**: Account & PostgreSQL database project

### Installation & Run

1. **Clone repository**:
   ```bash
   git clone https://github.com/vaibhavchauhan-15/reachinternation.com.git
   cd reachinternation.com
   ```

2. **Install dependencies**:
   ```bash
   pnpm install
   ```

3. **Configure Environment Variables**:
   Copy `.env.example` to `.env` in the project root:
   ```env
   # Public / Publishable Keys (Safe for Web Browser & Mobile App)
   NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
   NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_your_key_here
   EXPO_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
   EXPO_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_your_key_here

   # Server-Only Secrets (STRICTLY RESTRICTED TO SERVER RUNTIMES — NEVER EXPOSE TO FRONTEND/MOBILE)
   SUPABASE_SECRET_KEY=your_service_role_key_here
   NEXT_PUBLIC_APP_URL=http://localhost:3000
   ```

4. **Run Development Server**:
   ```bash
   pnpm dev
   ```
   Open `http://localhost:3000` in your browser.

---

## 🔐 User Roles & RBAC

| Role | Operational Scope | Access Rights |
|------|-------------------|---------------|
| `super_admin` | Global System | Full control over machines, operations, user accounts, and system configuration. |
| `admin` | Global Operations | Add/edit/delete machines, manage users, review all running hour logs, reassign operators. |
| `manager` | Operations & Business | Fleet management, client contracts, running hour logs review, user assignments, and reporting. |
| `service_manager` | Fleet Operations | Oversee machine directory, review running hour logs, export PDF/Excel reports. |
| `supervisor` | Site Operations | Monitor daily running hour logs, track operator machine assignments, record logs, scoped read-only access to assigned field personnel (`/users`). |
| `operator` | Field Operations | Submit daily machine running hour logs (`/operations?tab=entry`) and view log history (`/operations?tab=history`). |

---

## 🗄 Database Schema

The core database is built on 7 central tables in Supabase PostgreSQL:

1. `public.users`: System user accounts (email, phone, role, supervisor_id references users(id), supervisor_ids uuid[] (multi-supervisor roster with GIN index and parity sync trigger), working_location_id references working_locations(id), city, district, state, state_id references states(id), aadhaar_number, license_number, address, shift_time, shift_start_time, shift_end_time, complete_profile ['yes', 'no'], status, role-aware RLS with supervisor scoping).
2. `public.machines`: Machine fleet master (machine_code, model, serial_number, manufacturer, year_of_manufacture, hour_meter, customer_name, status, health_status, current_operator_id).
3. `public.machine_hour_logs`: Daily running hour logs (machine_id, client_id, operator_id, supervisor_id, log_date, start_time, end_time, start_meter, end_meter, running_hours, normal_working_hours, overtime_hours, is_breakdown, breakdown_start_time, breakdown_end_time, breakdown_duration, breakdown_hours, location, remarks, conflict_flag, conflict_reason, conflict_status, conflict_resolved_by, conflict_resolved_at, conflict_resolution_notes, idempotency_key).
4. `public.operator_machine_assignments`: Authoritative multi-shift operator assignment roster with recurring daily shift windows (id, machine_id, operator_id, shift_start_time, shift_end_time, crosses_midnight, is_active, assigned_by, assigned_at, ended_at, ended_by, end_reason). Enforces max 3 distinct active operators per machine via advisory transaction locks.
5. `public.operator_shift_ranges`: Normalized 0–1440 circular minute mapping unrolled across midnight with PostgreSQL GiST exclusion constraint (`EXCLUDE USING GIST (operator_id WITH =, minute_range WITH &&) WHERE (is_active)`) preventing double-booked operators across overlapping shifts.
6. `public.clients`: Registered clients & customer sites (client_code, client_name, contact_person, phone, email, address, city, state).
7. `public.states`: Official Indian State and Union Territory directory with official smallint LGD codes (36 entities).
8. `public.districts`: Official Indian Administrative Districts directory (784 districts mapped to `states(id)` with smallint LGD codes).
9. `public.cities`: Statutory Cities, Municipal Corporations, City Municipal Councils, and Major Urban Centers (466 entities mapped to `districts(id)` with Census location codes).
10. `public.towns`: Statutory Municipal Councils, Nagar Palika Parishads, Nagar Panchayats, Town Panchayats, Census Towns, and Sub-District/Tehsil/Taluka hubs (15,081 entities mapped to `districts(id)`).
11. `public.villages`: Complete Census Revenue Village directory (640,787 villages mapped to `districts(id)` with 6-digit Census village codes).
12. `public.master_location`: Unified high-speed location lookup and autocomplete master (15,331 records) indexed with composite B-Tree and `pg_trgm` GIN indexes (`search_text`).
13. `public.idempotency_keys`: Replay attack protection & state mutation deduplication key ledger (idempotency_key, user_id, action_name, request_hash, status, response_payload, created_at, expires_at).
14. `public.audit_logs`: Immutable, append-only security & compliance audit trail (id, user_id, action, entity_type, entity_id, metadata, details, ip_address, created_at).
15. `public.working_locations`: Enterprise physical work-sites, depots, workshops, warehouses, and regional offices (id, name, type ['yard', 'workshop', 'office', 'warehouse', 'site'], address, city, state, pincode, status ['active', 'inactive']).

---

## 🛡️ Enterprise Security & Defense-in-Depth Architecture

ReachInternational enforces a multi-layered security architecture conforming to **OWASP ASVS 5.0** and **OWASP Top 10** baselines:

1. **Self-Registration Privilege Escalation Guard (`handle_new_user()` trigger & `016_enterprise_security_hardening.sql`)**: PostgreSQL trigger ignores untrusted client metadata, forcing all self-signups to `role = 'operator'` and `status = 'pending'`, requiring explicit administrator dashboard approval before activation.
2. **Tamper-Proof Append-Only Audit Logging (`public.audit_logs`)**: Security events, state mutations, and replay attack blocks are recorded in an append-only PostgreSQL table protected by RLS (no UPDATE or DELETE policies exist).
3. **Restricted Machine Mutation RLS (`machines_update_authorized`)**: Operators cannot update machine master records directly via PostgREST; all running hour logs are submitted through audited Server Actions.
4. **Server-Side Template Injection (SSTI) Defense (`packages/utils/src/ssti.ts`)**: Single-pass, non-evaluating template substitution (`renderSafeTemplate`) with zero dynamic code execution (`eval()`, `new Function()`) and non-recursive replacement.
5. **Context-Aware HTML Entity Escaping (`apps/web/lib/email.ts` & `email-templates.tsx`)**: All dynamic fields in server HTML email and notification templates pass through `escapeHtml()` to neutralize script and tag injection vectors.
6. **Spoof-Proof Edge Rate Limiting (`apps/web/proxy.ts` & `lib/security/rate-limiter.ts`)**: Sliding-window rate limiter inspecting canonical platform headers (`cf-connecting-ip`, `x-real-ip`, `true-client-ip`) and extracting rightmost proxy IPs to prevent header-rotation rate limit bypasses.
7. **Payload & Timeout Bounds (`apps/web/next.config.ts` & `lib/security/timeout.ts`)**: Enforces 1MB Server Action payload limit, 10MB file upload limits on bulk spreadsheets with MIME/extension validation, and 10-second `AbortController` request execution timeout guard (`withExecutionTimeout`).
8. **OWASP ReDoS Hardening (`packages/validation`)**: Enforces `User Input ↓ Max Length Check ↓ Simple Validation ↓ Safe Linear Regex ↓ Business Validation`. String length bounds (`.max(...)`) are applied on ALL Zod schema fields (`email: max 255`, `password: max 128`, `full_name: max 100`, etc.) before executing non-backtracking linear regexes.
9. **PostgreSQL Statement Timeouts (`014_set_statement_timeouts_and_dos_guards.sql`)**: Configures `statement_timeout = '10000ms'` (10s), `lock_timeout = '5000ms'`, and `idle_in_transaction_session_timeout = '10000ms'` on PostgreSQL to prevent database connection pool starvation.
10. **Mobile Client Security & Role Synchronization (`apps/mobile/lib/auth/useAuth.tsx` & `lib/security.ts`)**: Authoritatively verifies user role/status from `public.users` (eliminating insecure role fallbacks), and enforces 15-second client fetch timeouts (`fetchWithTimeout`).
11. **Server-Only Build Boundaries & Action De-exposure (`lib/notifications/send-reminders.ts`)**: System cron batch jobs are quarantined in internal server modules guarded with `import "server-only"` rather than public `"use server"` Server Action boundaries, preventing unauthorized external HTTP RPC execution.
12. **Cache Purge Authorization Guard (`apps/web/app/actions/refresh.ts`)**: All cache purging and page revalidation actions strictly enforce `await verifySession()`, neutralizing unauthenticated LPDoS cache invalidation attacks.
13. **DOM XSS Sanitization (`packages/utils/src/sanitize.ts` & `NotificationPreviewModal.tsx`)**: Raw HTML email previews pass through `sanitizeHtml()` before DOM injection, stripping script tags, iframe embeds, event handlers (`onerror`, `onload`), and pseudo-protocols (`javascript:`).
14. **Hardware-Backed Mobile Session Persistence (`apps/mobile/lib/supabase.ts`)**: Mobile auth storage utilizes `expo-secure-store` on native iOS (Keychain) and Android (Keystore) for hardware-encrypted token persistence across app lifecycles.
15. **Strict Content-Security-Policy (`apps/web/next.config.ts`)**: Production CSP enforces `upgrade-insecure-requests`, `form-action 'self'`, `frame-ancestors 'none'`, `object-src 'none'`, and `base-uri 'self'`.
16. **Public Legal & Compliance Endpoints (`apps/web/app/privacy`, `apps/web/app/terms`, `apps/web/app/account-deletion`)**:
    - `/privacy`: Enterprise Data Protection & Privacy Policy covering 13 structured sections (DPDP Act 2023, IT Act 2000, UIDAI Aadhaar masking, HMR telemetry, Kernel RLS, Zero Data Sale guarantee, 7-year statutory equipment retention, and Google Play Data Safety compliance) with interactive topic search, quick-jump pill navigation, and print optimization.
    - `/terms`: Official Terms of Service and Heavy Equipment Custody conditions.
    - `/account-deletion`: Dedicated Google Play compliant account erasure request portal with 14-day SLA.

---

## 🧪 Verification & Quality Gate

Run full typecheck across all 7 monorepo workspace packages:

```bash
pnpm typecheck
```
Guarantees 0 TypeScript errors across `apps/web`, `apps/mobile`, and `packages/*`.

---

## 📱 Mobile CI/CD, EAS Workflows & OTA Updates

The ReachInternational mobile application (`apps/mobile`, package: `com.reachinternational.app`, SDK 57) is automated via Expo Application Services (EAS):

### 1. Build & Release Profiles (`apps/mobile/eas.json`)
- **`production` Build**: Signed Android App Bundle (`.aab`) with `autoIncrement: true`, Node 22, and pnpm 11 for Play Store distribution.
- **`preview` Build**: Internal test APK with distribution for rapid field testing.
- **`production` Submit**: Automated upload directly to Google Play **Internal testing** track.
- **`production-play` Submit**: Automated promotion of approved releases to Google Play **Production** track (`eas submit -p android --profile production-play`).

### 2. EAS Workflows (`apps/mobile/.eas/workflows/`)
- **`deploy-android.yml`**: Full release pipeline triggered on `push` to `main` (for `apps/mobile/**`, `packages/**`, `pnpm-lock.yaml`) and manual `workflow_dispatch`. Runs quality gate (`pnpm typecheck`) → compiles production `.aab` → submits directly to Google Play internal track.
- **`publish-update.yml`**: Over-The-Air (OTA) pipeline triggered on `main`. Runs quality gate (`pnpm typecheck`) → publishes JS/UI updates to the `production` channel via EAS Update.

### 3. EAS Update (OTA) Governance
- **`runtimeVersion`**: Enforces `{"policy": "appVersion"}`. EAS Update guarantees that OTA updates only land on installed binaries with matching `appVersion` (`1.0.0`), preventing binary incompatibility crashes.
- **Deterministic Routing**: Native changes (dependencies, Android manifest, permissions, `appVersion`) are routed through binary builds (`deploy-android.yml` / `[build]` tag / `release/*`). Non-native JS and styling fixes are published immediately via OTA update.
- **Zero Secrets in Git**: Google Play Service Account JSON keys are securely stored in the EAS credential vault via `eas credentials -p android`, with 0 credentials committed to source control.

---

## Centralized PDF Generation & Export Architecture

The monorepo provides a centralized, lightweight PDF generation architecture ensuring standardized typography, branding, page breaks, and verification blocks across Web (`window.print()`) and Mobile (`expo-print`):

### Web Architecture (`apps/web`)
- **`apps/web/lib/pdf/pdf-config.ts`**: Centralized configuration for A4 dimensions, margins, company branding (`REACH INTERNATIONAL`), month mappings, and filename builders (`buildExportFileName`, `buildMachineExportFileName`, `buildMachinesExportFileName`).
- **`apps/web/lib/pdf/pdf-print-styles.ts`**: Centralized print CSS generator (`getPrintStylesheet`) for clean `@page` rules, `@media print`, table layout, and `page-break-inside: avoid`.
- **`apps/web/lib/pdf/pdf-utils.ts`**: Shared utility functions (`isUuid`, `formatCompactTiming`, `computeDurationHours`, `resolveCleanClientName`, `resolvePeriodLabel`, `resolveClientLocation`, `handleBrowserPrint`).
- **`apps/web/components/pdf/`**: Reusable print components (`<PDFReportHeader>`, `<PDFKPIStrip>`, `<PDFSignatureBlock>`, `<PDFTableWrapper>`, `index.ts`).

### Mobile Architecture (`apps/mobile`)
- **`apps/mobile/lib/pdf-html-templates.ts`**: Standardized HTML template builders (`buildPdfHtmlStyles`, `buildPdfHtmlHeader`, `buildPdfHtmlKpiStrip`, `buildPdfHtmlSignatureBlock`, `buildPdfHtmlWrapper`) consumed by `OperationsExportModal.tsx` and `MachineExportModal.tsx`.
