# ReachInternational — Industrial Machine Running Logs & Fleet Operations Platform

> **ReachInternational** — Enterprise platform engineered to automate daily machine running hour logs, operator shift entries, operator-to-machine assignments, machinery fleet management (add/edit/delete), user role governance, and PDF/Excel report exports.

---

## 📋 Table of Contents

- [Project Overview](#-project-overview)
- [Active Core Modules](#-active-core-modules)
- [Official Animated Icons System](#-official-animated-icons-system)
- [Monorepo Architecture](#-monorepo-architecture)
- [Tech Stack](#-tech-stack)
- [Getting Started](#-getting-started)
- [User Roles & RBAC](#-user-roles--rbac)
- [Database Schema](#-database-schema)
- [Verification & Quality Gate](#-verification--quality-gate)

---

## 🚀 Project Overview

**ReachInternational** automates daily industrial machine running hour logs and operator workflow management across India. Built for Super Admins, Admins, Managers, Supervisors, HR, and Operators, it eliminates paper logbooks, enforces non-overlapping shift validations, tracks operator machine assignments, and generates instant PDF print reports and Excel exports for monthly client billing.

### Core Problems Solved

- ❌ **Manual & Error-Prone Paper Logbooks**: Replaces paper logs with daily operator hour meter tracking, automated HMR calculation, overtime computation, and breakdown duration logging.
- ❌ **Overlapping Operator Shifts**: Enforces database-level PostgreSQL trigger validations preventing shift time overlaps.
- ❌ **Uncontrolled Fleet Catalog**: Provides centralized Machine Management (`/machines`) for adding, editing, and deleting heavy machinery units with detailed specs (Model, Serial No, YUM, HMR, Client).
- ❌ **Manual Report Preparation**: Generates 1-click A4 PDF reports (Machine Running Hours Report, Site Machine Report, Operator Daily Report) and formatted Excel spreadsheet exports.

---

## ✨ Active Core Modules

### 0. 🏠 Role-Based Home / Operations Overview (`/dashboard`)
- **Dedicated Read Models for All 6 Canonical Roles**: Every authenticated user lands directly on Home (`/dashboard` on Web or `/(app)/dashboard` on Mobile). Instead of monolithic client-side filtering, each role receives a dedicated, minimal read model queried via high-performance PostgreSQL RPCs:
  - **Super Admin**: Platform governance, active fleet counts, client registry, total staff, and system audit log trail.
  - **Admin**: Fleet & personnel overview, operational telemetry exceptions (breakdowns, overtime shifts, timeline conflicts).
  - **Manager**: Machinery fleet utilization breakdown (`total`, `active`, `rented`, `spare`, `breakdown`), operations running hours today (`totalLogs`, `totalHours`).
  - **Supervisor**: Supervised field team and fleet machines, shift logs submitted vs pending today, daily breakdown incidents, and overtime alerts.
  - **HR**: Personnel roster, active field operators, pending employee profile change requests, and daily attendance indicators.
  - **Operator**: Primary high-prominence "Submit Today's Machine Log" CTA, assigned equipment specifications, client worksite location, shift timings, and last recorded HMR reading.
- **Database-Level Read Model RPCs (Migrations 088, 090, 091)**: 6 lean PostgreSQL functions executed under `SECURITY DEFINER` with `search_path = public, pg_temp` and `STABLE` executing in <5ms without full table scans or relational over-fetching. Migration 091 aligns alert action URLs across all roles (`/operations?tab=logs`, `/users`, `/machines`).
- **Server Component Architecture & Zero RSC Serialization Overhead**: Dedicated server-evaluated compositions with server-rendered `KPICard` primitives and client-rendered `<AnimatedCounter />`, completely eliminating React Server Component serialization boundaries for Lucide icons and function props.
- **Shared Dashboard UI Primitives (`components/dashboard/shared/`)**: Design-system compliant primitives (`DashboardShell`, `DashboardHeader`, `KPIGrid`, `KPICard`, `StatusCard`, `PrimaryAction`, `AlertWidget`, `ActivityWidget`, `DashboardShellSkeleton`, `WidgetSkeleton`, `DashboardErrorState`).
- **Targeted Cache Invalidation**: Tag-based caching with volatility-tiered TTLs (15s operational) and surgical revalidation (`dashboard:operator:${id}`) upon daily log submissions.
- **Cross-Platform React Native Parity**: Direct mobile invocation of the same RPCs, featuring touch cards, status pills, and direct CTA navigation.

### 1. 🚜 Machine Management (`/machines`)
- **Fleet Directory & Specifications**: Track machinery fleet details including Model Name, Serial Number, Manufacturer, Year of Manufacture (YUM), Current HMR (Hour Meter Reading), Assigned Supervisors, Assigned Operators, and Client details.
- **24/7 Multi-Shift Multi-Personnel Assignment**: Industrial equipment operates continuously 24 hours a day across 8-hour shifts. The platform enables assigning multiple supervisors (`supervisor_ids UUID[]`) and multiple operators (`operator_ids UUID[]`) per machine simultaneously. Features automatic sync triggers maintaining primary single-ID compatibility (`current_supervisor_id` & `current_operator_id`), GIN array-containment indexing, searchable multi-chip `<MultiUserSelect>` with shift timings, and dedicated "Assigned Shift Personnel (24h Fleet Coverage)" cards on `/machines/[id]`.
- **Supervisor Operational Status & Assignment Management**: Field supervisors can enter/update Hour Meter Readings (HMR), update Equipment Health (`active`, `spare`, `under_maintenance`, `breakdown`), update Rental Status (`available`, `rented`), and assign, change, or unassign Operators (`operator_ids`, `current_operator_id`) and Clients (`client_id`). Master machine specifications (`model`, `serial_number`, `year_of_mfg`, `manufacturer`, `machine_id`) and supervisor assignments (`supervisor_ids`, `current_supervisor_id`) remain strictly locked to Manager tier or above across PostgreSQL RLS triggers, Server Actions, and UI modals.
- **Dynamic Client Selection on "Rented" Status**: When marking or editing a machine's rental status as "Rented", the system dynamically surfaces a searchable client picker `<ClientSelect>` linking the machine directly to `public.clients(id)` via `client_id` foreign key. Clearing or marking the status as "Available" resets the client assignment. Fetched via lightweight, non-blocking parallel queries (`Promise.all`), avoiding waterfalls and over-fetching.
- **Serial Number Duplicate Prevention & Multi-Layer Validation**: Strict uniqueness enforcement preventing duplicate serial numbers across the database (PostgreSQL case-insensitive unique index `idx_machines_serial_number_unique_ci` & non-empty check constraint), backend Server Actions, Excel bulk spreadsheet import (intra-file duplicate tracking + DB pre-validation), web registration/edit modals (with real-time on-blur validation), and cross-platform mobile app.
- **Full Machine Lifecycle & Manager-or-Above Governance**: Add new machines, edit machine parameters via dedicated `/machines/[id]/edit` full-page editor, change/unassign supervisors, and delete machines with strict full-stack RBAC permissions (database RLS policies, DB triggers, backend Server Actions, and frontend gating) restricted strictly to Manager or above (`manager`, `admin`, and `super_admin`).
- **Multi-Format Export & Reporting (Excel, CSV, PDF/Print)**: 1-click downloads for formatted Excel workbooks (`.xlsx` with metadata, statistics summary row, and auto-adjusted column widths), clean CSV files (`.csv` with UTF-8 BOM), and print-ready high-density PDF reports with company letterhead, KPI summaries, and 3-column verification sign-offs available across `EnterpriseTable` bulk multi-selection, page headers, and dropdown menus.
- **Full React Native Mobile Parity (`apps/mobile/app/(app)/machines.tsx`, `apps/mobile/components/machines/*`)**: Complete mobile fleet management with 4 interactive KPI metric cards, detailed 24h shift personnel view, machine category management modal (`MachineCategoryModal.tsx`), and native PDF/AirPrint/CSV directory exports (`MachineExportModal.tsx`).
- **Centralized Data Access Boundary & RPC Aggregations (`apps/web/lib/data/machines/`)**: Strict separation of UI and database access logic with modular DAL services: `machine-list.ts` (slim column projections, parallelized `Promise.all` personnel hydration, server-side pagination), `machine-detail.ts` (isolated deep relation queries), `machine-kpis.ts` (real-time sub-millisecond PostgreSQL RPC `get_machines_directory_summary`), `machine-search.ts` (GIN trigram search), `machine-filters.ts` (cached select options), and `machine-mutations.ts` (atomic lifecycle operations with audit logging).
- **Lazy-Loaded Directory & On-Demand Modal Hydration**: Eliminates unwanted database queries on initial page load by restricting server-side rendering to only the active machine slice and fleet-wide KPI RPC summary. Heavy personnel and client rosters are lazily hydrated on-demand only when `<MachineModal>` is opened (with instant hover prefetching), and supervisor filter rosters hydrate progressively in the background without blocking initial paint.
- **Query-Specific Multi-Tier Caching & Targeted Invalidation**: High-efficiency caching architecture using `unstable_cache` with SWR background revalidation and `React.cache()` in-flight deduplication. Employs volatility-tiered TTLs (120s for directory filter metadata, 60s for paginated list queries and machine details, 15s for operational KPIs and operator assignments). Partitioned by user role and identity to strictly prevent cross-user data leakage while preserving PostgreSQL RLS authorization. Targeted cache invalidation ensures updates only invalidate affected machine details, lists, and KPIs without purging stable filter metadata.
- **Progressive Data Loading & On-Demand Quick Modals**: Initial `/machines` page load carries strictly the data needed for the current viewport (KPI aggregates, 25-row machine slice, current search/filters/sort, and user permissions). Eager table scans and unrequested deep relations (shift assignments, daily running logs, audit records, maintenance history, full client profiles, export payloads) are completely eliminated. Users can inspect 24h shift coverage (`MachineAssignmentsQuickModal`) or daily running logs (`MachineHistoryQuickModal`) on demand with 0ms second-click latency via client session caching. Exports (Excel, CSV, PDF) fetch filtered datasets on demand with query caching.
- **Strict Mutually Exclusive View Rendering & UI Performance**: Eliminates hidden duplicate DOM nodes by dynamically rendering only the selected presentation mode (`effectiveView` using SSR-safe `useMediaQuery`). In Table view, only `EnterpriseTable` mounts (cards completely unmounted); in Cards view, only the card grid mounts (table completely unmounted); in Auto mode, desktop renders table and mobile renders touch cards. Stable subcomponents (`PersonnelCell`, `CustomFilterSelector`, `RowActionsMenu`, `HeaderMoreMenu`) and callbacks are memoized. Native table rendering avoids unnecessary virtualization overhead since pagination strictly limits rendered volume to 25 items.
- **Machine Detail Full-Screen View & 3-Tab Architecture (`/machines/[id]`)**: Full-screen equipment management featuring 3 dedicated tabs (`Basic Info`, `HMR`, `Audit`), streamlined hero banner with live health and rental status badges, 24h shift personnel coverage, client details, and secondary refresh triggers.
- **Machine Audit Trail (Hybrid Responsive Log Timeline + Compact Log Rows)**: Replaces oversized card streams with a scalable hybrid responsive timeline and compact row design. Desktop (≥1024px) renders horizontal rows (~60-80px height), Tablet (641px–1023px) collapses secondary metadata, and Mobile (≤640px) renders stacked compact touch cards. Features sticky date grouping (`15 Sept 2026`), 5 filter tabs (`All Logs`, `HMR Logs`, `Breakdowns`, `Assignments`, `Machine Updates`) with dynamic count badges, type-specific inline metrics/diffs, and an on-demand slide-over `<Drawer size="lg">` on Web and slide-up bottom-sheet `<Modal>` on Mobile for deep audit inspection (actor context, operational metrics, before/after diffs, deletions, and collapsible raw JSON with 1-click copy).
- **High-Performance Search & Filter Architecture (Milestone M8)**: 100% server-side search across PostgreSQL GIN trigram indexes (`machine_id`, `model`, `serial_number`, `manufacturer`) with 350ms input debounce and stale request cancellation via React 19 transitions. Completely eliminates premature client-side JavaScript filtering over paginated slices, ensuring machines across all pages are instantly discoverable with zero input lag. Decouples filter dropdown options from table slice updates and synchronizes all filter mutations with browser history and URL query parameters without redundant router pushes.
- **Client-Scoped Fleet KPI Aggregation RPC (Milestone M9)**: Sub-millisecond (3.08 ms) scalar KPI calculations powered by PostgreSQL RPC `get_machines_directory_summary` supporting optional supervisor and client scoping (`p_client_id`) and harmonized maintenance status counting, cached with 15s SWR operational caching.
- **Progressive On-Demand Export & Dynamic Code-Splitting (Milestone M10)**: Non-blocking export architecture where full filtered datasets are fetched strictly on-demand. Dynamically imports SheetJS (`xlsx`) to save ~180 KB off initial bundle size, caches export responses, and standardizes A4 PDF generation via centralized PDF services across Web and Mobile.
- **Surgical Mutation Cache Invalidation (Milestones M11 & M12)**: Targeted cache tag invalidation (`TAGS.machineDetail(id)`, `TAGS.machinesList`, `TAGS.machinesKpis`) avoiding full-page reloads and blanket cache purges, validated against strict performance budgets (<250ms TTFB, <5ms DB query execution, 0 TypeScript errors).
- **Lightweight Contextual Action Menu Optimization (Phase 12)**: Standardized, ultra-lightweight contextual action menu (`⋮`) offering 5 canonical operations (`View`, `Edit`, `Assignment`, `History`, `Delete`). Guarantees zero network calls and zero database queries on menu open (< 1ms client DOM mount). Data for each action is retrieved strictly Just-In-Time (JIT) upon explicit user click: `History` loads running logs, `Edit` loads modal options with 60s TTL session caching (`modalOptionsSessionCache`), `Assignment` loads shift personnel with session caching, and `Delete` opens confirmation dialogs without upfront queries. Re-clicks return instantly in <0.002ms with zero duplicate network requests across both Web (`apps/web`) and Mobile (`apps/mobile`).
- **Universal Dialog & Modal Lazy Loading (Phase 13)**: Zero dialog bundling on initial page load. All 8 heavy operational dialogs (`Assign Operator`, `Edit Assignment`, `Machine Detail`, `Log Detail`, `History`, `Audit`, `Export`, `Print`) plus global layout modals (`EditProfileModal`, `AccountDeletionModal`, `CommandPalette`, `MobileSidebarDrawer`, `GlobalCreateModal`) are strictly loaded via Next.js `dynamic()` with `{ ssr: false }` and conditionally mounted (`{isOpen && <Dialog ... />}`). Eliminates speculative chunk downloads on page load and guarantees that chunks and required relational datasets are downloaded strictly when the user triggers the action.
- **Operator-Scoped Assigned Machine View (`/machines`)**: Operators accessing `/machines` on Web or Mobile are presented with a dedicated view showing their currently assigned machine's essential operational parameters: Machine ID, Model, Serial Number, Manufacturer, Year of Mfg, Health Status badge, Current HMR reading, Worksite Address, Site Supervisor details (Name, Shift, Call button), and quick CTAs to Log Entry (`/operations?tab=entry`) and Log History (`/operations?tab=history`). Fleet-wide catalog, KPI aggregate counters, management actions (Add/Edit/Delete), commercial rental rates, and Audit tabs are strictly hidden from operators.

### 2. 👥 User & Employee Management (`/users` & `/signup`)
- **System Accounts Directory**: Unified management of system users and staff accounts with active status tracking.
- **Mandatory Profile, Shift & Address Fields**: Strictly enforces Full Name, Email Address, 10-digit Mobile Phone Number, System Role, Shift Timing (`shift_start_time` and `shift_end_time` e.g. 08:00:00 – 20:00:00), Operator Compensation (`monthly_salary` strictly enforced for operators via PostgreSQL check constraint and frontend validation, alongside `daily_rate` and `ot_hourly_rate`), Street / Base Worksite Address (`street`, e.g. "Plot No. 42, MIDC Industrial Area, Chakan"), Normalized Location (**City/Town/Village**, **District**, and **State / Union Territory** referencing canonical `public.states` with `state_id`), and Regulatory Identity Details (Aadhaar Card Number with mathematical Verhoeff checksum & masked `XXXX-XXXX-1294` PII formatting and Driving Licence Number) across user profiles, admin modals, and self-registration.
- **Self-Service Profile Edits & Hierarchical Approval Workflow**: Users across all roles can edit their personal profile information (name, phone, shift schedule, address, Aadhaar, driving licence). Edits are routed through a strict multi-tier organizational approval workflow:
  - `super_admin`: Direct instant database update (no approval needed). Super Admin can approve changes for all roles.
  - `admin`: Request routed to `super_admin`. Admin can approve requests from all lower roles.
  - `manager` / `hr`: Requests routed to `admin`. Can approve requests from supervisors and operators.
  - `supervisor`: Requests routed to `manager`. **Supervisor has 0 approval access**.
  - `operator`: Requests routed to `manager` or `hr`.
- **Dedicated Profile Change Requests Section on `/users`**: Renders pending profile modification requests in a dedicated review section completely separate from new registration requests (`status = 'pending'`), displaying clear side-by-side diffs (Old Value vs Requested Value), individual Approve/Reject actions, and batch Accept All / Reject All actions.
- **Self-Service Registration & Admin Access Governance**: Users request platform access via `/signup` choosing their functional role (`operator`, `supervisor`, `manager`, `hr`), their working shift timing via interactive time pickers (`shift_start_time` and `shift_end_time`, defaulting to 12h day shift 08:00 AM - 08:00 PM), their street base address (`street`), and selecting their State/UT from a standardized dropdown linked to `public.states(id)`. The chosen role, shift timing, street address, and `state_id` are preserved in `public.users` in `pending` status, displayed in the Admin Pending User Approvals panel with distinct role badges, and maintained without modification upon administrator approval. All complete registrations are automatically flagged for zero-latency dashboard access upon admin activation.
- **Unified User Lifecycle Forms & Canonical Address Standard (Signup, Onboarding, Profile Edit & User Modals)**: Standardized all 4 core user lifecycle forms across both Web (`apps/web`) and Mobile (`apps/mobile`) through shared reusable form component architectures (`apps/web/components/forms/` and `apps/mobile/components/forms/`):
  - **Canonical Address Sequence**: Monorepo standard strictly enforces `street` + `city/town/village` + `district` + `state` (`state_id`), with legacy `address` column automatically mirrored for 100% database compatibility.
  - **Standardized Monthly Salary Input (`UserSalaryField` / `MobileSalaryField`)**: Formatted ₹ INR currency prefix, role-aware helper badge, and operator-mandatory validation (`monthly_salary > 0`) satisfying the PostgreSQL database check constraint `users_operator_monthly_salary_check`. Read-only display mode for employee profile views.
  - **Explicit Mandatory vs. Optional Section Badges (`FormSectionCard` / `MobileFormSectionCard`)**: High-contrast section cards showing step number, title, description, `Mandatory` vs `Optional` tags, and real-time green `Completed` checkmarks.
  - **Submit Button Gating & Rapid Double-Tap Lock (`FormSubmitButton` / `MobileSubmitButton`)**: Submit/save buttons remain non-responsive and disabled while required inputs are missing, display a dynamic helper pill (`"X required field(s) remaining"`), and employ ref-based double-submission locking to prevent redundant API/network calls.
- **Dynamic Supervisor Selection for Supervised Roles**: When registering or creating/editing a user account with a supervised role (`operator`), the system dynamically renders a searchable and scrollable Supervisor selector. On `/signup` (both Web and Mobile), supervised personnel choose from active supervisors loaded via `get_active_supervisors_public()` RPC. In `/users`, the desktop table features a dedicated `Supervisor` column, and admin modals (`UserCreateModal`, `UserEditModal`) provide direct supervisor assignment and updates with full export support. Supervisor assignments are managed through the normalized relational junction table `public.user_supervisors` (`user_id`, `supervisor_id`), replacing legacy arrays and synchronizing seamlessly across Web and Mobile.
- **Multi-Selection & Unified Multi-Format Export (Excel, CSV, PDF)**: Select individual or all filtered user accounts with a master checkbox and floating bulk actions bar. Perform instant downloads across formatted Excel (`.xlsx` with metadata, statistics summary row, and auto-adjusted column widths), clean CSV files (`.csv` with UTF-8 BOM), and print-ready landscape A4 PDF reports. Guarantees 100% data consistency across all three export formats with a unified 11-column structure (`S.No`, `Full Name`, `Email Address`, `Mobile Number`, `Role`, `Supervisor`, `Status`, `Address` [smartly merged street + city + district + state with duplicate deduplication], `Aadhaar Number`, `Driving Licence`, `Joined Date`). Features high-concurrency Bulk Deletions with safety self-delete guards, super admin protection, optimistic UI removals, and audit logging.
- **Full React Native Mobile Parity (`apps/mobile/app/(app)/users.tsx`, `apps/mobile/components/users/*`)**: Complete mobile replication across iOS and Android with 100% feature parity: 4 interactive KPI metric cards (Total, Active, Operators, Pending), 6-dimension custom filter modal selector (Role, Status, State covering all 36 Indian states & UTs, KYC, Joined Date, Sort By), mobile touch card feed with role-accent left borders, User Detail bottom sheet with quick contact CTAs (`Email User` & `Call Phone`), ACCOUNT DETAILS well (ID, Email, Phone, Shift, Address, Location, Aadhaar with eye reveal toggle, Licence, Registered Date with relative time), MANAGEMENT ACTIONS well (Role selector, Supervisor selector, Edit Account, Reset Password, Activate/Deactivate, Delete Account), User Edit sheet, Password Reset modal with temporary credential generator, Reject Reason modal, native multi-format directory export modal (`UserExportModal.tsx`) supporting both CSV download and landscape A4 PDF generation/sharing via `expo-print` and `expo-sharing` with identical structure, Profile Change Requests diff review, and floating bulk actions bar.
- **Mobile Profile Screen & Validation Parity (`apps/mobile/app/(app)/profile.tsx`, `apps/mobile/components/profile/EditProfileModal.tsx`)**: Reads authoritative account data directly from the PostgreSQL `users` table, renders real-time pending profile modification request banners with withdrawal capabilities, and enforces Zod `ProfileUpdateSchema` alongside strict database uniqueness validation for mobile phone, 12-digit Aadhaar, and driving licence.
- **Mobile Permissions & Real-Time Telemetry (`apps/mobile/app.json`, `apps/mobile/lib/permissions/*`)**: Strictly scoped production permission matrix (`INTERNET` for Supabase API sync, `ACCESS_NETWORK_STATE` for NetInfo offline/online detection, `POST_NOTIFICATIONS` for runtime critical shift alerts). Obsolete camera and legacy storage permissions removed. Features a value-first notification permission primer modal (`NotificationPermissionModal.tsx`), 7-day soft dismissal cooldown in `AsyncStorage`, and a live "APP PERMISSIONS & TELEMETRY" card on the Profile screen (`/profile`) and Profile Sheet with 1-tap configuration.
- **Account Actions**: Create new user accounts, edit employee profiles, activate/deactivate accounts, and delete user accounts with full structured audit logging.
- **Centralized Data Access Layer & Lean Projection (Phase 1 Performance Program)**: Modularized User DAL (`apps/web/lib/data/users/`) into `user-list.ts`, `user-detail.ts`, `user-shared.ts`, and `index.ts`, mirroring the established `machine-list.ts` pattern. Preserves `apps/web/lib/queries/users.ts` as a 100% backward-compatible facade. Employs optimized column projection (`USER_LIST_COLUMNS`), pulling required profile metadata and regulatory identity data (`aadhaar_number`, `license_number`, `address`, `city`, `district`, `state`) directly from PostgreSQL `users` to support rich list views and unified multi-format exports without secondary roundtrips. Employs sub-millisecond in-memory hydration from Next.js cached master queries (`getActiveSupervisorsCached`). Modals (`UserDetailSheet`, `UserEditModal`) fetch full records on-demand via `getUserDetailAction`.
- **Sub-Millisecond Directory Summary KPI RPC (Phase 3 Performance Program)**: Scalar KPI calculations powered by PostgreSQL RPC `get_users_directory_summary(p_supervisor_id)` returning single JSON `{ total, active, engineers, new_registrations, states }` backed by composite B-tree index `idx_users_status_created_at`. Completely eliminates client-side JavaScript `.filter()` / `.reduce()` computations on browser slices and provides real database-wide counts across all 4 KPI cards.
- **Modular Component Decomposition (Phase 4 Performance Program)**: Decomposed monolithic 2,866-line client component into clean, focused single-responsibility files following the proven `OperationsClient.tsx` pattern: `UsersHeader.tsx` (KPI cards, exports, title), `UsersFilters.tsx` (search, 6 filter dropdowns, active chips), `UsersTable.tsx` (desktop data table, mobile infinite feed, pagination), `PendingApprovalsSection.tsx` (registration approvals), `ProfileChangeRequests.tsx` (profile diff reviews), and `users-helpers.tsx` (filter options & badge helpers), leaving a thin coordinator in `users-client.tsx` orchestrating state and actions.
- **Search & Filter Query Parameters URL Persistence & Reload Resilience**: The `/users` directory synchronizes all active search queries (`?search=...`), pagination (`?page=...`), and filter states (`?role=...`, `?status=...`, `?state=...`, `?kyc=...`) directly to the browser URL via non-blocking `window.history.replaceState`. Hard browser reloads (F5/Ctrl+R/Cmd+R) now preserve the user's active page and all filter parameters seamlessly without resetting search state or redirecting to Home. Service Worker and Edge Proxy anti-caching headers (`no-store, no-cache, max-age=0`) prevent stale redirect loops on authenticated dynamic routes.
- **Dedicated Password Recovery & Email Pre-Check (`/forgot-password` & `/reset-password`)**: Structured two-step password recovery workflow mirroring Supabase's documented flow. When a user requests a recovery link on `/forgot-password`, the system queries `public.users` via `createSupabaseAdminClient()` to verify account existence. If no account matches the entered email, the request immediately halts with an error banner (`No account found with this email address`), preventing unauthorized email dispatch or confusion. If the user exists, a secure email link is sent with dynamic `redirectTo` resolution (`getResetPasswordRedirectUrl()`, pointing to canonical `${getAppUrl()}/reset-password`). The dedicated `/reset-password` page features a strict 4-state lifecycle guard (`verifying`, `valid`, `missing`, `invalid`) blocking unauthorized form access without a verified Supabase recovery token/code. Upon successful password reset, the recovery session is securely terminated and the user is redirected to `/login` with a confirmation notification. Fully synchronized across Web and Mobile (`apps/mobile/app/(auth)/forgot-password.tsx`).
- **Aadhaar & Licence Document Capture & Hybrid In-App Viewer System (Signup, Edit Profile, Onboarding & User Detail)**: Config-driven document infrastructure (`public.user_document_types`, `public.user_documents`, private `user_files` storage bucket) supporting Aadhaar, Driving Licence, and operational identity documents with format-specific badges, single-slot upload enforcement, and strict zero-public-URL security:
  - **Security & Short-Lived Access Architecture**: Sensitive identity documents (Aadhaar, Licence) are stored in a private bucket (`public = false`). Supabase public URLs and permanent signed URLs are strictly prohibited. Access is gated by server-side authorization (`getDocumentViewUrlAction` / `/api/documents/[id]/view`), generating short-lived signed URLs (120-second TTL) strictly on-demand for the document owner or privileged staff (`super_admin`, `admin`, `hr`), with every view logged as `document.viewed` in `public.audit_logs`. Database tracks `uploaded_by UUID` (Migration 102).
  - **Hybrid In-App Document Viewer (`DocumentViewerModal` & `MobileDocumentViewerModal`)**: Custom in-app viewer experience powered by mature native rendering engines underneath without heavy third-party PDF parser bloat:
    - **Image Viewer (JPG/JPEG, PNG, WEBP)**: Interactive zoom (50%–300% on Web, pinch-to-zoom on Mobile), pan/drag, 90° rotation, and fullscreen toggle.
    - **PDF Viewer**: Embedded native browser `<iframe>` on Web and `react-native-webview` on Mobile with toolbar controls, page navigation, and download shortcuts.
    - **DOC/DOCX/Other Files**: External system viewer, download, and native OS share sheet (`expo-sharing`, `expo-file-system`).
  - **Signup Page Integration (`/signup` & `/(auth)/signup`)**: Section 3 ("Work Location & Identity") displays dedicated Aadhaar and Licence upload cards with pre-flight file size checks (2MB cap), format badges, and automatic document upload via `adminSupabase` immediately upon account registration.
  - **Edit Profile Modal Integration (`EditProfileModal`)**: Full personal details, shift timing, worksite location, compensation, and uploaded identity documents with secure signed URLs, one-click replacement with real XHR progress tracking, in-app full-screen viewing, and deletion confirmation. Standardized with card-level Framer Motion hover micro-interactions (`data-hover-parent`), proportional icon sizing (`size={16}` for headers & document subcards, `size={14}` for timepickers, `size={10}` for read-only badges), title padding (`pb-1.5 border-b`), and a clean, responsive single-row modal action footer synchronized across Web and Mobile (`apps/mobile/components/profile/EditProfileModal.tsx`).
  - **Onboarding Page Integration (`/onboarding` & `/(auth)/onboarding`)**: Section 4 ("Identity & Verification") incorporates Aadhaar and Driving Licence document uploads for newly registered users completing initial profile setup.
  - **Staff User Inspection (`UserDetailSheet` on Web & `UserDetailModal` on Mobile)**: Privileged staff (`super_admin`, `admin`, `hr`) inspect employee identity documents directly in the in-app viewer modal with audit logging.
  - **Cross-Platform Mobile Parity (`apps/mobile`)**: Native document picker via `expo-document-picker` (~57.0.2), `MobileDocumentUploadCard`, and `MobileDocumentViewerModal` with Vercel Geist design tokens, min 44px touch targets, and full Android/iOS compatibility.


### 3. ⏱️ Operations Hub (`/operations`)
- **Running Hours Logs (`/operations?tab=logs`)**:
  - **3 View Modes**: Machine View (group by equipment), Client View (group by client site), and Operator View (group by operator).
  - **A4 PDF Reports**: 1-click printable PDF report exports with official company branding, centered titles (`MACHINE RUNNING HOURS REPORT`), client/site location sub-headers, and complete unpaginated dataset retrieval exporting all records for the selected month or custom date range across Client, Machine, and Operator views.
  - **Excel Exports**: Export formatted Excel workbooks (`.xlsx` with readable company filenames) capturing daily logs, HMR totals, operating hours, overtime, and breakdown durations for the complete selected period.
  - **Sub-Millisecond On-Demand Query Engine**: Composite B-tree indexed server action (`getOperationsExportLogsAction`) executing in ~0.45 ms in PostgreSQL, allowing fast server-side 10-row pagination for web browsing while fetching hundreds of complete operational records on-demand for export.
  - **Optimized Server-Side Read Model & Keyset Cursor RPC (`get_operation_logs`, Phase 19 Performance Program)**: High-performance PostgreSQL RPC (`supabase/migrations/076_operations_read_model_rpc.sql`) returning strictly `{ "rows": [], "nextCursor": "...", "total": 100 }` with 0 bloated relational objects. Features deferred joins (seeks index on `machine_hour_logs` first and joins `machines`, `clients`, `users` strictly on the $\le 21$ page rows, achieving $< 1$ ms kernel latency and 7 buffer hits), $O(1)$ URL-safe base64 keyset cursor pagination, offset pagination fallback, and full multi-dimension search. Hydrated by cached Next.js DAL (`apps/web/lib/data/operations/operations-read-model.ts`) and synchronized with React Native Mobile (`apps/mobile/lib/hooks/useOperationsData.ts`).
  - **Dynamic Viewport Selector Popovers & Clean Date Range Picker**: All filter dropdown selectors (`MachineSelect`, `SearchableSelect`, `ClientSelect`, `UserSelect`, `CustomDatePicker`, `DateRangePicker`) utilize fixed portaling (`createPortal` to `document.body`) with intelligent boundary detection, auto-flipping upward when space below is constrained, dynamic `maxHeight` clamping, and zero clipping across desktop and mobile viewports. The custom `<DateRangePicker>` features an ultra-clean, minimal calendar interface without cluttered preset pills or header banners, opening directly to month navigation and allowing users to select any month's start and end date directly on the month grid with zero inner scrollbars.
  - **Optimized Client Selector & Dynamic Fleet Cascade**: Client selector surfaces rich client profiles directly from the database (Company Name, Client Code, Fleet Size, Status, Full Address / Site Location, and Contact/GST details). Defaults automatically to the most recently active client via sub-millisecond indexed query (`idx_machine_hour_logs_date_created` at 0.105 ms), dynamically cascading to filter equipment fleets (`clientMachines`) and location sites (`clientSites`).
  - **Client Canonical Address & Multi-Site Operational Sites**: Treats `client.street + client.city + client.district + client.state + client.pincode` as the single authoritative address of the client across frontend (web and mobile), backend queries, and database functions. The database maintains a single clean `street text NOT NULL` column (dropping duplicate `"Street"` and separate `address` columns), formatting full address dynamically on the fly. Supports multi-site client deployments where projects operating under the same client company name at different project sites are cleanly aggregated under the company and filtered by distinct site locations without dropped or split logs.
  - **Progressive Client Fleet Operations Architecture (Phase 2 Performance Program)**: Architecture blueprint and comprehensive audit (`CLIENT_OPERATIONS_CURRENT_ARCHITECTURE.md`) transforming the Client view into a progressive 3-tier system: **Tier 1 Client Groups** (paginated client accounts with machine count and month running stats via <3ms RPC), **Tier 2 Client Machines on Expand** (lazy-loaded assigned machines and operators on row expand), and **Tier 3 Daily Running Logs on Click** (lazy-loaded machine-specific daily logs, work hours, overtime, and status actions on machine selection), replacing eager full-table loading.
  - **Unified Operations Query & Cache Key System (Phase 1.1 Foundation)**: Centralized, deterministic query key architecture (`@reachinternational/utils`) generating hierarchical cache keys for machine, client, and operator logs (`operations:logs:*`), assignments (`operations:assignments:*`), filter dimensions (`operations:filters:*`), fleet/client/operator summaries (`operations:summaries:*`), and log/assignment details (`operations:*-detail:*`). Supports dual serialization: deterministic strings for Next.js caching/KV stores and structured tuples for TanStack Query v5 cache invalidation on mobile and web client components.
  - **Modular Architecture & Dynamic Code-Splitting (Phase 2 Performance Program)**: Decomposed the monolithic 3,769-line `OperationsClient.tsx` into a thin 234-line coordinator shell (93.8% LOC reduction) and modular subcomponents (`OperationsHeader`, `OperationsTabs`, `OperationsLogsTab`, `OperationsAssignmentsTab`, `AssignOperatorModal`, `ConflictResolutionModal`, `OperationsSkeletons`). Heavy features and export libraries are split into 5 on-demand dynamic chunks (`react-loadable-manifest.json`) totaling **251 KB** deferred client JS, shaving 208 KB off initial route bundles and isolating search typing state to eliminate INP latency.
  - **Sub-Tab Isolated Data-Loading Architecture (Phase 3 Performance Program)**: Optimized Daily Running Hours (`/operations?tab=logs`) to query strictly the active sub-tab's dataset. In Machine view (`view=machine`), only the machine catalog (cached SWR 60s), active machine specs, 10 paginated logs, and summary RPC are fetched (**0 clients and 0 operators queried**). In Client view (`view=client`), only CRM clients, active client specs, rented machines, and client sites are fetched (**0 unrelated fleet machines queried**). In Operator view (`view=operator`), only the operators directory and active operator logs are fetched (**0 machines and 0 clients queried**). Completely eliminates the unindexed 250-row location table scan and 500-log over-fetch on `tab=assignments`. Accelerated by PostgreSQL GIN trigram indexes (`idx_mhl_location_trgm`, `idx_mhl_remarks_trgm`) and partial B-tree site index (`idx_mhl_client_location`) via Migration 069.
  - **Machine Sub-Tab Precision Data-Loading Optimization (Phase 4 Performance Program)**: Delivered precision data loading for `Logs └── Machine` (`/operations?tab=logs&view=machine`). Strict page-bounded initial load retrieves only the machine log rows needed for the active page (default 20 records; zero unbounded loading). Implements server-side pagination (`range(from, to)` with exact count), server-side sorting (`date-desc`, `date-asc`, `hours-desc`, `hours-asc`, `meter-desc`, `meter-asc`) with interactive sort headers, multi-filter queries (`activeMachineId`, `month`/date range, `site`, `shift`, `breakdownOnly`), sub-millisecond GIN trigram search, exact column projection (`MACHINE_LOG_EXACT_PROJECTION`, 20 columns, zero `SELECT *`), redundant SQL machine join elimination (hydrated in-memory from cached fleet catalog), Next.js `unstable_cache` (30s TTL) with React `cache()` deduplication, and a dynamically code-split lazy history modal (`MachineHistoryQuickModal`) with 0ms second-click session caching. ⚠️ **REMOVED (2026-09-16, user request)**: the lazy detail modal (`OperationsLogDetailModal`) was deleted entirely — all log details now render inline, table rows/cards are fully non-clickable, and the per-row eye (view) action was replaced with an RBAC-gated delete (trash) action wired to `deleteOperatorHourLogAction` behind a `<ConfirmationDialog>` guard. Live Supabase benchmarks verify cold page 1 in 201 ms, server sorting in 90–92 ms, and trigram search in 82 ms.
  - **Client Sub-Tab Precision Data-Loading Optimization (Phase 5 Performance Program)**: Delivered on-demand precision data loading for `Logs └── Client` (`/operations?tab=logs&view=client`). Enforces initial page load route default to `view=machine`, ensuring 0 client log rows and 0 client queries are executed on initial load. Implements client-side in-memory session cache (`subTabCacheRef`) preserving machine and client datasets across sub-tab toggles; subsequent switching between "Machine" and "Clients" runs with **0ms latency**, zero network requests, and zero refetching of machines, operators, or permissions. Clicking "Clients" triggers `getOperationsClientLogsAction` strictly on demand if not cached, fetching only client-rented machines, client distinct sites, and 20 paginated client logs. Completely eliminates redundant SQL join `client:clients(...)` by hydrating `activeClient` in JavaScript memory. Implements server-side pagination (default 20 records, exact count), server sorting (`date-desc`, `date-asc`, `hours-desc`, `hours-asc`, `meter-desc`, `meter-asc`), server filtering, and trigram search with Next.js `unstable_cache` (30s TTL) and React `cache()`. Live Supabase benchmarks confirm cold client load in 168 ms, server sorting in 61–74 ms, and 0ms cached sub-tab toggles.
  - **Operator Sub-Tab Precision Data-Loading Optimization (Phase 6 Performance Program)**: Delivered on-demand precision data loading for `Logs └── Operator` (`/operations?tab=logs&view=operator`). Initial page load defaults to `view=machine` with 0 operator logs queried upfront. Clicking "Operator" executes `getOperationsOperatorLogsAction` strictly on demand with 20 paginated logs, server-side sorting (`date-desc`, `date-asc`, `hours-desc`, `hours-asc`, `meter-desc`, `meter-asc`), server filtering, and trigram search. Eliminates redundant SQL join `operator:users(...)` by hydrating `activeOperator` directly in JavaScript memory. In-memory coordinator cache (`subTabCacheRef`) maintains "machine", "client", and "operator" datasets so toggling between any sub-tabs runs with **0ms latency** and zero refetches of machines, clients, or permissions. ⚠️ **REMOVED (2026-09-16, user request)**: the "History" button and `OperatorHistoryQuickModal` dialogue box were removed completely from the operator toolbar.
  - **Manager-Tier Inline Edit & Delete Operations with Instant In-Memory Cache (2026-09-16)**: Full lifecycle control for Daily Running Hours across all 3 sub-tabs (`Machine`, `Client`, `Operator`) on both Web (`OperationsLogsTable.tsx`, `OperationsLogsMobileList.tsx`, `OperationsEditLogModal.tsx`) and React Native Mobile (`MeterLogModal.tsx`, `operations.tsx`). Restricted to Manager tier or above (`super_admin`, `admin`, `manager`) via `isManagerOrAbove`. Features live meter calculation, negative meter guards, breakdown/overtime adjustments, confirmation dialogs on destructive deletion, machine `hour_meter` auto-reconciliation, sub-millisecond in-memory cache updates (`subTabCacheRef`), and non-blocking background server sync.
  - **Operator Landing Page Ultra-Fast Architecture (`Entry / History`) (2026-09-19)**:
    - **Dedicated PostgreSQL RPC Read Model**: `public.get_operator_entry_context(p_operator_id uuid)` executing in <1ms on PostgreSQL kernel, returning strictly the authenticated operator's identity and shift timings, assigned equipment (`id`, `machine_id`, `model`, `serial_number`), client company and site location (`id`, `company_name`, `site`), and the latest valid machine HMR (`last_hmr`). Zero full-table scans, zero history joins, zero audit joins, and zero unrelated machines or clients queried.
    - **Zero-Waterfall Server Fast-Path (`/operations`)**: Operators visiting `/operations` bypass the 1,000-unit machine catalog, CRM client list, and supervisor filter waterfalls. Server component routes directly to `<OperatorEntryClient />` with single cached read-model query.
    - **Immediate Critical Shell First Paint (<100ms)**: The critical entry form (`EntryHeader`, `OperatorMachineInfo`, `HMRInputs`, `ShiftInputs`) is bundled directly in the main server chunk, painting instantaneously upon app open.
    - **Aggressive Dynamic Code-Splitting**: Secondary and heavy modules (`BreakdownSection`, `SubmitConfirmModal`, `OperatorHistoryTab`, print and export engines) are split into on-demand dynamic chunks via `next/dynamic`, strictly loaded when triggered by user interaction.
    - **On-Demand History Lazy Loading**: Historical records and logs are never fetched during initial route load; they are queried on demand only when the operator opens the "History" tab (`tab=history`).
    - **Targeted Operational Caching**: Web DAL uses `React.cache()` and `unstable_cache` with a 15-second TTL tagged with `operator-entry:${operatorId}`. Shift log submissions trigger atomic cache invalidation (`revalidateTag`), instantly syncing the next shift's `last_hmr`.
    - **Full Cross-Platform Parity (`apps/mobile`)**: React Native mobile app features dedicated `useOperatorEntryContext` hook, `MobileOperatorEntryCard` with offline queue support (`offlineQueueManager`), and on-demand history feed, ensuring identical <100ms load times and unified design tokens across iOS, Android, and Web.
> **⚠️ REMOVED (2026-09-15, user request)**: The Fleet Operator Machine Assignments feature has been completely removed from both Web and Mobile. `/operations` now renders Daily Running Hours as the whole page (no top-level tab strip); `?tab=assignments` redirects to `?tab=logs`; sidebar/command-palette entries, Assign Operator actions, and all assignment modals were deleted. The entry below is retained for historical reference only.
- **Fleet Operator Machine Assignments Independent Feature Module (`/operations?tab=assignments`, Phase 7 Performance Program)**:
  - **Zero Upfront Assignment Queries**: When the user is on Daily Running Hours (`tab=logs`), zero assignment records are fetched upfront during server rendering, completely isolating assignment data until requested.
  - **On-Demand Precision Data Loading**: Clicking "Machine Assignments" queries assignment records, active operator rosters, and equipment details on demand via `getOperationsAssignmentsAction()`, cached via Next.js `unstable_cache` (30s TTL, tagged with `TAGS.operationsAssignments`) and React `cache()`.
  - **0ms Client Session Caching**: An in-memory session cache (`assignmentsCacheRef`) ensures instant **0ms latency** when toggling between Daily Running Hours and Machine Assignments with zero network refetches.
  - **Full 8-Part Operational Feature Tree**:
    - **Assignment List**: Equipment roster cards (`MachineAssignmentCard`) with expandable accordion shift slots, capacity indicators (`X / 3 Operators`), and machine specifications.
    - **Search**: Fast fuzzy search across machine ID, model, serial number, and assigned operator name.
    - **Filters**: Instant status filter pills (`All`, `Assigned`, `Full 3/3`, `Unassigned 0/3`).
    - **Assign Operator**: Dynamic modal (`AssignOperatorModal`) enforcing max 3 operators per machine and GiST exclusion shift overlap prevention atomically.
    - **Edit**: Dynamic modal (`EditAssignmentModal`) for adjusting shift start/end times, overnight status, duration, and notes.
    - **Unassign**: Dynamic modal (`UnassignModal`) with end reason categorization (`removed`, `shift_changed`, `reassigned`) and active shift termination.
    - **Assignment Detail**: Dynamic modal (`AssignmentDetailModal`) displaying machine specs, operator contact details, shift timing, supervisor assigner attribution, and direct action shortcuts.
    - **Assignment History**: Dynamic modal (`AssignmentHistoryModal`) with timeline of past and present shift assignments for the machine and 0ms second-click caching (`historySessionCache`).
  - **Clean, Uncluttered Interface**: All assignment history and activity audits are consolidated into the standalone first-class `/audit` module accessible directly from the primary navigation sidebar.
- **Cross-Platform Mobile App Parity (`apps/mobile/app/(app)/operations.tsx`)**:
  - Full mobile viewport parity with 4 interactive fleet KPI metric cards, searchable bottom sheet filters (Machine, Client, Location, Operator, Month), machine overview summary card (Manufacturer, Model, Serial, Run Hours, Breakdowns), client overview card, and operator KPI cards.
  - Native PDF document generation (`expo-print`) with AirPrint & Android Print Spooler integration (`Print.printAsync`), CSV spreadsheet export (`expo-file-system/legacy`), and native OS sharing sheet (`expo-sharing`).
  - Native Operator Machine Assignment workflow with 3-shift roster tracking (`0/3`, `1-2/3`, `3/3`), overnight shift badges, and atomic PostgreSQL conflict resolution (`assign_operator_machine_atomic`).
- **Overtime Shift Conflict Detection & Supervisor Resolution System (Web & Mobile Parity)**:
  - **Shared Conflict Parsing Engine (`@reachinternational/utils`)**: Intelligently parses technical database strings into human-readable warnings, severity pills (`DUAL MACHINE CUSTODY CONFLICT`, `SHIFT OVERRUN CONFLICT`), overtime claimed badges, colliding equipment codes, and concrete supervisor guidance (`acknowledgeAdvice` vs `adjustAdvice`).
  - **Comprehensive Touchpoint Warnings**: Active warnings across the Top Overtime Conflict Alert Banner (with expand/collapse toggles), individual daily running log cards/rows (with visual amber/green accents, conflict status badges, and inline advisory wells), the Shift Assignment Modal (rich conflict alert cards with action required instructions), and the Overtime Conflict Resolution Modal (incident breakdown, compliance warning bullet points, and live interactive recalculated running/overtime hours).

### 4. 🛡️ Centralized Audit Logs Module (`/audit`)
- **First-Class Sidebar Navigation**: Promoted from nested operations tabs to a dedicated, top-level sidebar route (`/audit`) accessible to authorized staff (`super_admin`, `admin`, `manager`, `hr`).
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
  - ⚠️ **REMOVED (2026-09-16, user request) — historical reference only**: **Decoupled Log Details Architecture (Phase 14)**: Completely eliminates monolithic `getEverythingForLog(logId)` overfetching. Operational log inspection in `OperationsLogDetailModal` is decoupled into 5 modular, independent data loaders: `getLogSummary()` (lean core identity, meters, hours, status rendered immediately at 0ms with 0 relational queries), `getLogDetails()` (shift intervals, breakdown duration, full machine specs, condition, site address, remarks on tab 'Details'), `getLogHistory()` (machine meter continuity sequence on tab 'History'), `getLogAssignments()` (shift coverage from `operator_machine_assignments` on tab 'Assignments'), and `getLogAudit()` (immutable mutation trail from `audit_logs` on tab 'Audit'). Features in-memory session caching (`cacheRef`) delivering instant **0ms re-toggles (<0.002ms)** with 0 duplicate network or database queries.
  - **Volatility-Calibrated Cache Strategy (Phase 15)**: Comprehensive, multi-layer caching architecture derived strictly from operational data volatility. Defines typed `OPERATIONS_CACHE_TTLS` in `@reachinternational/utils` and `OPERATIONS_CACHE_TIERS` in `apps/web/lib/cache/policies.ts`. Revalidates Machine filter options in `1,800s` (30m), Client filter options in `900s` (15m), Operator filter options in `600s` (10m), Machine/Client/Operator logs feeds in `45s`, Assignment rosters in `20s`, Log Details in `60s`, and Log History, Assignments, and Audit in `20s`. Synchronizes server-side Next.js `unstable_cache`, in-memory client session cache (`45,000ms`), and React Native TanStack Query v5 `staleTime` (45s logs / 10m filters) across Web and Mobile with surgical tag invalidation (`TAGS.operationsLogs`, `TAGS.operations`, `TAGS.machineOperations(id)`, `TAGS.clientOperations(id)`, `TAGS.operatorOperations(id)`).
  - **Mutation Optimization & Sub-Millisecond Reactive UI (Phase 16)**: Enforces a strict 6-stage lifecycle across all 6 operational mutations (`Assign Operator`, `Edit Assignment`, `Unassign Operator`, `Create Log`, `Edit Log`, `Delete Log`):
    $$\text{CLICK} \longrightarrow \text{validate} \longrightarrow \text{server mutation} \longrightarrow \text{PostgreSQL/RLS} \longrightarrow \text{targeted cache invalidation} \longrightarrow \text{update UI}$$
    Strictly prohibits `window.location.reload()` (0 occurrences in codebase). Decouples query cache tags so assignment mutations never touch or refetch logs and log mutations never touch assignment rosters. Validates inputs at entry via Zod schemas (`SubmitHourLogSchema`, `UpdateHourLogSchema`, `DeleteHourLogSchema`, `UpdateAssignmentSchema`). Features atomic `deleteOperatorHourLogAction` with automatic machine hour meter reconciliation and audit logging. Updates UI in-memory in $<1\text{ms}$ upon mutation success, eliminating blocking router refresh pauses.
  - **On-Demand Print, Excel & PDF Export Architecture (Phase 17)**: Completely decouples heavy export engines (PDF generators, `xlsx` / SheetJS Excel libraries, and print DOM portals) from initial route bundles (strictly **0 bytes** on initial load). Exports execute an on-demand lifecycle: clicking PDF or Excel dynamically loads the required export module via `import()`, executes the authoritative server action `getOperationsExportLogsAction(params)` querying full unpaginated datasets matching exact active filters (`viewMode`, `entityId`, `clientId`, `machineId`, `operatorId`, `site`, `month`, `customStartDate`, `customEndDate`, `search`) and current user RBAC permissions (locking operators strictly to their own logs and clients to their tenant data), and streams or generates the export. Direct triggers for Excel and PDF are integrated across desktop and mobile toolbars in both `OperationsLogsTab.tsx` and `OperatorDashboard.tsx`.
  - **Empirical PostgreSQL Database Optimization (Phase 18)**:
    - **Zero Incremental Quicksort Guarantee**: Empirical `EXPLAIN (ANALYZE, BUFFERS, VERBOSE)` profiling revealed that UI ordering (`log_date DESC, created_at DESC, id DESC`) forced PostgreSQL into `Incremental Sort (quicksort)` when using legacy 2-column indexes `(machine_id, log_date DESC)`. Migration `075_operations_database_optimization.sql` replaced redundant prefixes with 4-column composite B-tree indexes (`idx_mhl_machine_date_created`, `idx_mhl_client_date_created`, `idx_mhl_operator_date_created`), eliminating in-memory sorting completely ($0\text{ms}$ sort overhead).
    - **Machine History Filter Scan Waste Elimination**: Scans for equipment history previously iterated backward across global indexes, filtering out dozens of non-target rows. The tuned composite index provides direct index-only backward seeks, accelerating execution from $0.722\text{ms}$ to $0.040\text{ms}$ (**18x faster**).
    - **Operator Machine Assignment Indexing**: Added partial index `idx_oma_active_assigned` on `(assigned_at DESC) WHERE (is_active = true AND ended_at IS NULL)` plus composite indexes `idx_oma_machine_assigned_at` and `idx_oma_operator_assigned_at`, eliminating sequential scans on shift assignment views and modal histories ($0.035\text{ms}$ execution).
    - **Machine Directory Natural Sort Index**: Created `idx_machines_created_at_desc` on `public.machines (created_at DESC, id DESC)`, eliminating sequential scans and quicksorts on initial fleet listings.
    - **Audit Trail Direct Index Seek**: Replaced unindexed JSONB extraction queries in `getCachedLogAudit` with indexed `entity_id` lookups backed by `idx_audit_logs_entity_id_created`, dropping log audit query time from $71.6\text{ms}$ to **$0.084\text{ms}$ (852x faster)**.
    - **Index Hygiene & Bloat Prevention**: Dropped legacy redundant prefix indexes (`idx_machine_hour_logs_machine_date`, `idx_machine_hour_logs_client_date`, `idx_machine_hour_logs_operator_date`), saving index write overhead and storage bloat on every insert.

### 4. 💰 Operator Payroll & Salary Statement (`/payroll`)
- **Comprehensive 32-Column Excel Salary Statement Parity (Migration 109)**:
  - **Full Parity with Industry Standard Format**: Modeled directly after the industrial Excel "SALARY STATEMENT — SAMPLE MONTH" reference standard, delivering an enterprise-grade compensation and disbursement ledger for every active operator.
  - **Mathematical Exactness & Real-Time Recalculation Engine**:
    - **Total Days**: $\text{Attended Days (A/D)} + \text{PL Adjusted} + \text{OT Days}$
    - **Earned Basic**: $\text{Basic Monthly Salary}$
    - **Base Amount**: $(\text{Basic} / \text{Working Days (W/D)}) \times \text{A/D}$
    - **PL Amount**: $(\text{Basic} / \text{W/D}) \times \text{PL Adjusted}$
    - **Total Base Wages**: $\text{Amount} + \text{PL Amt} + \text{Non-Taxable Allowance (Amt)}$
    - **OT Amount**: $(\text{Basic} / \text{W/D}) \times \text{OT Days}$
    - **Gross Pay**: $\text{Total Base Wages} + \text{OT Amount} + \text{Add Bal Salary}$
    - **Net Pay**: $\text{Gross Pay} - (\text{Loan} + \text{ADV./Other Deduction} + \text{Dedu})$
    - **Unpaid Balance**: $\text{Net Pay} - (\text{PAID REACH} + \text{S\&S} + \text{QUESS Agency Payouts})$
    - **PL Balance**: $\text{Total PL Quota} - (\text{PL Used as on Date} + \text{PL Adjusted})$
  - **High-Performance Database Engine & RPCs (`get_hr_payroll_summary`, `update_operator_salary_statement`)**:
    - `public.users` expanded with statement columns: Date of Joining (`doj`), Bank Account Number (`bank_account_number`), IFSC Code (`bank_ifsc_code`), Total PL Quota (`total_pl_quota`), and Historical PL Used (`pl_used_as_on_date`).
    - `public.operator_payrolls` expanded with all 28 breakdown line items (`working_days`, `attended_days`, `ot_days`, `pl_adjusted_days`, `base_amount`, `pl_amount`, `nt_days`, `nt_amount`, `total_amount`, `loan_deduction`, `add_bal_salary`, `advance_deduction`, `advance_balance`, `other_deductions`, `ot_amount`, `gross_pay`, `net_pay`, `paid_reach`, `paid_sns`, `paid_quess`, `balance_payable`, `pl_used_as_on_date`, `total_pl_quota`, `pl_balance`).
    - Upgraded `get_hr_payroll_summary(date)` automatically hydrates and calculates all 32 statement fields for all active operators, cross-referencing live machine hour logs for attended days and overtime.
    - Dedicated `update_operator_salary_statement` RPC performing atomic line-item mutations with instant real-time recalculations and audit trail logging.
  - **Scalable Enterprise UX & 6 View Mode Switcher Tabs**:
    - **Full Statement (Excel Reference)**: Complete 32-column ledger mirroring the exact Excel spreadsheet with sticky left freeze columns (`SL NO`, `NAME`) and category header tints.
    - **Attendance & Days**: Focuses on W/D, A/D, OT days, PL Adjusted, and Total Days.
    - **Earnings Breakdown**: Displays Basic, Earned, Base Amount, PL Amount, N/T Allowance, OT Amount, and Gross Pay.
    - **Deductions & Banking**: Dedicated view for Loans, Advances, Other Deductions, Net Pay, Bank Account, and IFSC code.
    - **Agency Payouts**: Tracks disbursements across Reach Direct, S&S Agency, Quess Corp, and Unpaid Balance.
    - **Leave Ledger**: Tracks Total PL Quota, PL Used as on Date, PL Adjusted, and Remaining PL Balance.
  - **Official Printable Salary Slip Modal (`PrintSlipModal`)**: Generates an A4 print-ready employee payslip with company header, employee details, attendance summary, earnings breakdown, deductions, net payable in INR words, and dual sign-off blocks.
  - **Live Statement Editor Modal (`EditStatementModal`)**: Full line-item adjustment modal with real-time recalculation of Gross Pay, Net Pay, Unpaid Balance, and PL Balance prior to server persistence.
  - **Exact 32-Column CSV Export**: 1-click export generating an audit-ready CSV spreadsheet matching the exact column layout and headers of the reference Excel file.
  - **Full Cross-Platform React Native Mobile Parity (`apps/mobile/app/(app)/payroll.tsx`)**:
    - Synchronized mobile screen featuring calendar payroll cycle picker, 4 KPI cards, search, operator touch cards, view-mode filters, digital salary slip modal, and interactive editing modal with Geist design tokens.
  - **Accessibility Restricted to HR & Admins**:
    - Accessible strictly to `super_admin`, `admin`, and `hr` across both Web and Mobile.
    - Manager role remains strictly gated from compensation figures.

### 5. 📅 Operator Attendance Management (`/attendance`)
- **Zero-Table Architecture Derived from Operational Machine Hour Logs (Migration 097)**:
  - **Direct Truth Source**: Derives attendance records on demand directly from `public.machine_hour_logs` via high-performance PostgreSQL RPCs, eliminating duplicated tables, sync jobs, and dual-write divergence:
    - `PRESENT`: Operator submitted $\ge 1$ shift log on that calendar day with normal working hours $\ge 4\text{h}$.
    - `HALF_DAY`: Operator worked $< 4\text{h}$ of normal working hours across logs on that day.
    - `ABSENT`: Scheduled weekday with 0 submitted operator hour logs.
    - `WEEK_OFF`: Fixed weekly off-day (Sunday).
  - **Sub-5ms PostgreSQL Kernel RPCs (`get_attendance_monthly_summary`, `get_attendance_daily_detail`)**:
    - `get_attendance_monthly_summary(p_year, p_month, p_role, p_search, p_status, p_page, p_page_size, p_overtime, p_state, p_sort_by)`: Paginated operator directory with scheduled days, present days, absent days, half-days, worked minutes, overtime minutes, fleet KPI summary cards, advanced overtime/state/sorting filters, and search across names, phones, cities, and states (Migrations 097, 106, 107). Leverages composite index `idx_mhl_operator_date_created` on `(operator_id, log_date DESC, created_at DESC, id DESC)`.
    - `get_attendance_daily_detail(p_employee_id, p_year, p_month)`: Calendar-day breakdown (1st through 31st) for a single operator including shift intervals, breakdown minutes, individual log entries, machine telemetry (`machine_code`, `model`, `serial_number`, `machine_name`), and day-of-week rollup averages (`dow` 0–6).
    - Hardened under `SECURITY DEFINER` and `STABLE` with caller authorization checks allowing `service_role` and authenticated `super_admin`, `admin`, and `hr`.
- **Targeted Cache Strategy & Next.js Data Access Layer**:
  - `apps/web/lib/data/attendance/`: Cached with Next.js `unstable_cache` (45s TTL for monthly summary tagged `attendance:summary:${yearMonth}`, 60s TTL for operator daily detail tagged `attendance:detail:${userId}:${yearMonth}`).
  - Server actions in `apps/web/app/actions/attendance.ts` gated strictly via `requireRole("super_admin", "admin", "hr")`.
- **Interactive 3-Tier Responsive Web Experience (`/attendance` & `/attendance/[userId]`)**:
  - **KPI Summary Strip**: 4 real-time interactive cards (Total Operators, Present Count, Absent Count, Half-Day Count) calculating attendance dynamically with hover micro-interactions.
  - **Month Navigation**: URL-synced calendar selector (`?month=YYYY-MM`).
  - **Character Match Highlighting**: Highlights search query matches inside employee name, phone, and location across desktop and mobile using Geist tokens (`#0070f3`).
  - **FilterToolbar Drawer & Chips**: 4 responsive dropdown filters (Attendance Standing, Overtime, Location/State, Sort By) with active filter count, dismissible chips, and one-click reset.
  - **Clickable High-Density Desktop Table (`hidden md:block`)**: Whole table row `<tr>` is clickable (`role="link"`, `cursor-pointer`, `tabIndex={0}`, keyboard accessible via Enter/Space) navigating to `/attendance/[userId]`. Scheduled Days, Present Days, Absent Days, Half Days, Worked Hours, and Overtime displayed cleanly without redundant status columns.
  - **Mobile Touch Cards (`block md:hidden`)**: Minimum 44px touch targets with operator name, contact chip, day counts grid, and worked/OT time badges.
  - **Server-Side Pagination & Browser-Native CSV Export**: On-demand unpaginated CSV export streaming filtered records directly in browser.
  - **Employee Attendance Detail Route (`/attendance/[userId]`)**: Operator profile hero card with shift schedules, 31-day visual calendar grid with status badges, and day-of-week average work hour rollup table.
- **Full React Native Mobile Parity (`apps/mobile/app/(app)/attendance.tsx`)**:
  - Native mobile screen with horizontal month selector bar, 4 KPI cards, search input, status filter pill strip, operator touch cards, and pull-to-refresh (`RefreshControl`).
  - Detailed daily calendar modal showing operator shift timings, month summary stat cards, total worked/OT hours, and day-by-day log entries.
  - Direct integration into `MobileBottomNav` for HR (`["home", "operations", "attendance", "hr"]`) and `More` screen tiles with Lucide `CalendarCheck` icon.
- **Strict RBAC Enforcement**:
  - Accessible strictly to `super_admin`, `admin`, and `hr`.
  - **Manager role is blocked** from `/attendance` across Edge Proxy, Server Actions, PostgreSQL RPCs, and UI navigation bars.


### 6. 🏢 Client Directory & Reference Master Module (`/clients`)
- **World-Class Customer Master Reference Module (Milestones C0 — C21)**:
  - **Progressive Modular Data Architecture**: Features a dedicated Data Access Layer (`apps/web/lib/data/clients/`) separating concerns into `client-kpis.ts` (scalar metric RPC), `client-list.ts` (exact column projections, server sorting, status filtering, trigram search), `client-detail.ts` (deep relation single fetcher), `client-locations.ts` (cached distinct cities), `client-export.ts` (memory-safe batched streaming), and `client-mutations.ts` (atomic operations with audit logs).
  - **PostgreSQL Database Optimization (Migration 070 Applied on Supabase `dhbbgfzbyatzvqafnsqp`)**:
    - **GIN Trigram Indexes**: Sub-millisecond substring search on `company_name`, `code`, `contact_person`, `phone`, and `city` using PostgreSQL `gin_trgm_ops` (`0.156 ms` execution time).
    - **Composite & Covering B-Tree Indexes**: `idx_clients_status_company_name` on `(status, company_name ASC)` for instant status-filtered sorted pagination (`1.294 ms` execution time) and `idx_clients_city` on `(city)`.
    - **Scalar KPI Summary RPC**: `get_clients_directory_summary()` computes `total`, `active`, `inactive`, and distinct `cities` directly in database kernel in sub-millisecond time (`3.5 ms`), returning a tiny 32-byte JSON payload and completely eliminating in-memory JavaScript array iteration.
    - **Single-Evaluation InitPlan RLS**: Optimized RLS policies with `((SELECT current_user_role()) = ANY (...))` evaluating once per query execution.
  - **Interactive 4-Card KPI Strip (`ClientsKPIStrip.tsx`)**: Displays Total Clients, Active Clients, Inactive Clients, and Locations Covered with micro-animations. Wrapped in `React.memo` to eliminate re-renders during search keystrokes or pagination.
  - **Table Optimization & Keyset Cursor Pagination (Milestone C10)**:
    - **Exact 7-Column Projection**: Table query strictly projects fields required for `CODE`, `COMPANY & TAX`, `CONTACT PERSON`, `PHONE`, `SITE LOCATION`, `STATUS`, and `ACTIONS` (`CLIENT_LIST_COLUMNS`), guaranteeing zero overfetching of machine relations, running logs, assignments, or audit records.
    - **Server-Side Page Sizing**: Supports dynamic page sizes `10`, `25`, `50`, `100` server-side with interactive UI density selectors on Desktop and Mobile.
    - **Keyset / Cursor Pagination for Massive Datasets**: Replaced deep $O(N)$ `OFFSET` scans with deterministic keyset index seeks ($O(1)$) using Base64URL-encoded cursors (`afterCursor`, `beforeCursor`) backed by Migration 074 composite B-tree indexes (`idx_clients_cursor_company_name`, `idx_clients_cursor_active`, `idx_clients_cursor_status`, `idx_clients_cursor_created_desc`, `idx_clients_cursor_code`).
  - **Client Detail Independent Section Loading Architecture (Milestone C11)**:
    - **Exact 9-Section Loading Tree**:
      ```
      Client Detail
      │
      ├── Summary      → immediate
      ├── Contact      → immediate/summary
      ├── Tax          → immediate/summary
      ├── Location     → on demand
      ├── Machines     → on tab
      ├── Running Logs → on tab
      ├── Assignments  → on tab
      ├── History      → on tab
      └── Audit        → on tab

      Each section independently loads.
      ```
    - **Zero Upfront Relational Overfetching**: Opening Client Detail (e.g. `CLI-0002`) executes strictly 0 relational queries upfront to `machines`, `machine_hour_logs`, `operator_machine_assignments`, or `audit_logs`.
    - **Immediate Summary, Contact & Tax**: Core record fields render at 0ms wire latency in a persistent top container with direct `tel:` linking for phone and statutory badges for GSTIN and PAN.
    - **On-Demand Location Loading**: Full operational site address and distinct registered billing address are fetched strictly on demand when expanding the location accordion (`279.87ms`).
    - **Independent On-Tab Loaders**: Modular DAL query services and authenticated server actions for `Machines` (`274.08ms`), `Running Logs` (`227.03ms`), `Assignments` (`352.18ms`), `History` (`255.41ms`), and `Audit` (`241.65ms`) executed strictly upon tab selection.
    - **0ms In-Memory Session Caching**: Web (`cacheRef`) and Mobile (`mobileDetailCacheRef`) store tab responses in memory; re-toggling previously visited tabs restores records in **0.0006ms – 0.0016ms** with 0 network calls and 0 database queries.
    - **Cross-Platform Mobile Parity**: React Native mobile app (`apps/mobile/app/(app)/clients.tsx`) provides Client Detail Modal with persistent Summary/Contact/Tax top cards, on-demand Location toggle, 5 operational tabs, horizontal scrollable tab strip, and min 44px touch targets.
  - **Progressive Location Hierarchy & Caching Optimization (Milestone C14)**:
    - **Zero Full-Hierarchy Serialization**: The Indian master location dataset comprises 657,154 records (36 states, 784 districts, 466 cities, 15,081 towns, 640,787 villages) totaling ~53.27 MB of JSON payload. Progressive loading ensures clients receive strictly ~1 KB per selected slice, achieving **99.99% wire payload reduction** (2.92 KB transferred vs ~53 MB).
    - **Strict Progressive Loading**: `State` (36 records, ~1.07 KB) $\rightarrow$ `selected state` $\rightarrow$ `District` (~34 records, ~1.43 KB) $\rightarrow$ `selected district` $\rightarrow$ `City / Town` (~9 records, ~0.42 KB).
    - **Multi-Tier Caching Architecture**: 24-hour server-side cache via Next.js `unstable_cache` (`CACHE_TIERS.CLASS_A_STATIC`, tag: `TAGS.clientsLocations`) combined with in-memory client-side session caches (`sessionCacheRef` / `mobileLocationHierarchyCacheRef`) delivering **0ms re-toggles (0.0012ms – 0.0018ms)** with 0 database queries.
    - **Canonical Manual Address Flow**: Form fields strictly follow the standardized flow: `street/area -> city/town/village -> district -> state -> pincode` for both Site Location and Billing Address, using standard uniform `<Input>` components.
    - **Card-Level Hover Micro-Interactions**: Client Modal cards feature `data-hover-parent` micro-interactions, triggering default animated icon behaviors (`AnimatedBuilding2`, `AnimatedMapPin`, `AnimatedReceipt`) with balanced `size={16}` sizing and title padding.
    - **Cross-Platform Mobile Parity**: `apps/mobile/app/(app)/clients.tsx` provides identical canonical address ordering and min 44px touch targets.
    - **Multi-Dimension Search**: Accelerated full-text search across `city`, `district`, and `state` via PostgreSQL GIN trigram indexes (`idx_clients_city_trgm`, `idx_clients_district_trgm`, `idx_clients_state_trgm`).
  - **All / Active / Inactive Tabs & Session Caching Optimization (Milestone C9)**:
    - **Zero Preloading**: Initial cold page load loads strictly the initial status dataset (default: `status=all`). Non-active datasets are never preloaded upfront.
    - **Intelligent Existing Result Reuse**: When switching to "Active", if the currently loaded dataset already contains all active records (`metrics.total === metrics.active`), the system reuses existing query results with **0 network requests and 0 database queries**.
    - **Zero-Inactive Optimization**: When `metrics.inactive === 0`, clicking "Inactive" immediately returns an empty dataset with **0 database queries**.
    - **0ms In-Memory Session Cache**: Subsequent tab switches resolve in **0ms** from an in-memory session cache (`queryCacheRef` on Web, `mobileQueryCacheRef` on Mobile) keyed by deterministic filter serializers.
    - **Silent URL Synchronization**: Uses `window.history.replaceState` to keep URLs bookmarkable (`?status=active`, etc.) without triggering Next.js RSC server re-renders.
  - **8-Dimension GIN Trigram Search (Milestone C8)**: 100% server-side indexed search across all 8 business dimensions (Company Name, Client Code, GSTIN, PAN, Contact Person, City, District, State) with 350ms input debounce and stale request cancellation.
  - **High-Density Desktop Table & Mobile Touch Cards (`ClientsTable.tsx` & `ClientsMobileList.tsx`)**:
    - Desktop: High-density table conforming strictly to Vercel Geist tokens (`#171717` ink, `#fafafa` canvas, `#ffffff` elevated, `#ebebeb` 1px hairline). Features sortable headers (`code`, `company_name`, `contact_person`, `city`, `status`), GSTIN/PAN pills, unified site address, separate billing indicators, status badges, and action menus.
    - Mobile: Touch cards reflow (`block sm:hidden`, min 44px touch targets) with quick view, edit, and soft-delete buttons.
    - Row memoization (`React.memo`) preventing re-render of unchanged rows.
  - **Zero Preload Contextual Action Menu (`ClientRowActionsMenu.tsx`) (Milestone C15)**:
    - Contextual action menu (`⋮`) guarantees zero data preloading on menu open (< 1ms UI mount). Issues strictly 0 network requests, 0 database queries, and loads 0 cascading deletion data.
    - Standardized actions: `View Details` (JIT drawer), `Edit Client` (JIT modal), `Deactivate / Soft Delete` (JIT confirmation), and `Restore` (for soft-deleted clients).
  - **Zero Full-Page Reload Lifecycle (Milestone C15)**:
    - Soft-deleting or restoring a client updates local state in memory immediately, adjusts `totalCount`, clears `queryCacheRef`, and triggers background `router.refresh()`. `window.location.reload()` is strictly eliminated (0 occurrences).
  - **Formal Client Cache Invalidation Matrix (Milestone C16)**:
    - Enforces surgical Next.js tag revalidation (`TAGS.clientDetail(id)`, `TAGS.clientsList`, `TAGS.clientsKpis`).
    - Strictly isolates unrelated domains: mutations never invalidate `machines`, `operators`, `operations`, `audit`, or `locations master`.
  - **Fine-Grained React Rendering & Component Memoization (Milestone C17)**:
    - All table, card, tab, KPI, and action menu components (`ClientsKPIStrip`, `ClientSearch`, `ClientStatusTabs`, `ClientsTable`, `ClientTableRow`, `ClientsMobileList`, `MobileClientCard`, `ClientRowActionsMenu`) are wrapped in `React.memo`.
    - Single active view rendered via responsive CSS (`hidden sm:block` for desktop table vs `block sm:hidden` for mobile cards).
  - **Decoupled Loading UX & Independent States (`ClientsPageShellLoading.tsx`) (Milestone C18)**:
    - Independent loading states decouple the page: Header ready, Search ready, Tabs ready, KPI loading skeleton, Table loading skeleton, Add Client modal chunk deferred.
  - **Lazy Export Architecture (Milestone C19)**:
    - Zero export libraries in initial bundle. Export modal is loaded strictly on demand via Next.js `dynamic()`.
    - Streams Excel UTF-8 BOM CSV (`\uFEFF`) without downloading all client records upfront to the browser.
  - **Security, RBAC & Cache Isolation (Milestone C20)**:
    - Enforces `AUTHORIZED_CLIENT_ROLES` (`super_admin`, `admin`, `manager`, `supervisor`) across list, search, detail, mutations, and export. Unauthorized roles (`operator`, `hr`) are blocked from equipment operations.
    - Deterministic canonical cache keys prevent cross-user/tenant data leakage.
  - **Dynamic Code-Split Lazy Modals (`next/dynamic`, `ssr: false`)**:
    - `ClientModal.tsx`: Add & Edit form with dual site/billing address management, loaded strictly on button click.
    - `ClientDetailModal.tsx`: Comprehensive client profile, tax identifiers, and assigned equipment roster loaded on demand.
    - `ClientDeleteModal.tsx`: Soft-delete dialog detailing the "Historical Logs Preservation Guarantee".
    - `ClientExportModal.tsx`: On-demand CSV export with Excel UTF-8 BOM compatibility.
    - Shaves **~35 KB** off initial route JavaScript weight.
  - **Full Cross-Platform Mobile Parity (`apps/mobile/app/(app)/clients.tsx`)**:
    - Selects exact database column projection, displays all 4 KPI Summary Cards matching Web, maintains 280ms search debounce, status filter chips with dynamic count badges (`ALL (2)`, `ACTIVE (2)`, `INACTIVE (0)`), mobile in-memory session cache, and pull-to-refresh.

### 7. 🚀 User Profile Onboarding & Fast Validation (`/onboarding`)
- **Incomplete Profile Interception**: Detects users missing essential details (`full_name`, `phone`, `role`, `shift_start_time`, `shift_end_time`, `street`, `city`, `district`, `state`, `aadhaar_number`) and routes them directly to `/onboarding`.
- **Ultra-Fast Zero-Latency Bypass**: Employs a single native PostgreSQL `complete_profile boolean` flag (default `false`) in `public.users` backed by partial index `idx_users_incomplete_profile WHERE (complete_profile = false)`. Once completed, subsequent logins and requests verify in a single boolean check (`if (user.complete_profile)`) with zero CPU overhead, completely skipping multi-field inspection.
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

### 9. ⚙️ Mobile Field Settings & User Preferences (`apps/mobile/app/(app)/settings.tsx`)
- **Mobile Field Settings Screen**: Tailored for field operators and mobile device behavior.
  - **Bottom Floating Navbar**: Promoted Settings to the 4th primary bottom navigation tab in `MobileBottomNav.tsx`.
  - **My Account Touch Card**: Compact card with Avatar, Name, Role badge, and email; tapping opens `AccountSettingsModal` containing shift schedule, assigned yard, KYC compliance, Edit Profile launcher, Change Password modal trigger, and link to full Profile screen.
  - **Notifications Touch Card**: Compact card with active alert count badge; tapping opens `NotificationSettingsModal` with switches for Push Notifications, Shift Reminders, Breakdown Alerts, Assignment Alerts, and Overtime Alerts.
  - **App Appearance**: Dedicated theme selector for `Light`, `Dark`, and `System` appearance adhering to Vercel Geist tokens (`#171717`, `#fafafa`, `#ffffff`, `#ebebeb`, `#0070f3`).
  - **App Permissions**: Push notification permission status badge and `NotificationPermissionModal` launcher.
  - **About & Legal**: App version `v1.0.0 (Build 1)`, Expo SDK 57 runtime, dedicated Privacy Policy (`/(app)/privacy`), Terms of Service (`/(app)/terms`), and official brand footer (`BRAND_NAME`, `BRAND_TAGLINE`).
  - **Google Play Store Compliance**: Full Play Store submission suite: production AAB configuration (`eas.json`), `versionCode: 1`, blocked transitive permissions (`app.json`), public web compliance endpoints (`/privacy`, `/terms`, `/account-deletion`), store listing copy and visual assets (`apps/mobile/store-assets/`), Data Safety declaration (`PLAY_STORE_DATA_SAFETY.md`), Content Rating guide (`PLAY_STORE_CONTENT_RATING.md`), and end-to-end AAB build checklist (`PLAY_STORE_SUBMISSION_CHECKLIST.md`).
  - **Sign Out**: Red pill button with confirmation alert calling `signOut()` and navigating to login.

### 10. 🔒 Account Deletion & Statutory Data Governance (`/delete-account` & `/account-deletion-guide`)
- **Self-Service Deletion Portals & Statutory Documentation**:
  - **Actionable Deletion Portal (`apps/web/app/delete-account`)**: Dedicated self-service page (`DeleteAccountClient.tsx`) enabling users to select their departure reason from a standardized dropdown selector, provide optional operational remarks, acknowledge mandatory permanent data erasure confirmation, and submit deletion requests. Accessible directly from `/settings` Danger Zone.
  - **Account Deletion Guide & Warnings (`apps/web/app/account-deletion-guide`)**: Comprehensive public compliance and data safety documentation detailing permanently purged credentials, irreversibility terms, 14-day SLA, and statutory machinery telemetry retention. The legacy `/account-deletion` route permanently redirects (HTTP 308) here.
  - **Mobile Native Screen (`apps/mobile/app/(app)/account-deletion.tsx`)**: Accessible via Settings -> Account Management (`settings.tsx`). Provides real-time pending status tracking, withdrawal/cancellation capabilities, and direct native submission.
- **Administrative Review & Approval Workflow (`/users`)**:
  - Deletion requests from both Web and Mobile stream directly into the Admin Users management console alongside pending employee approvals.
  - **Web Admin Review (`AccountDeletionRequestsSection.tsx`)**: Side-by-side review cards with requester identity, origin badge (`Web App` vs `Mobile App` vs `Public Web Portal`), reason, and action triggers. Approving sets user `status = 'inactive'`, scrubs sensitive KYC identity numbers (`aadhaar_number = NULL`, `license_number = NULL`), and records structured audit log `user.account_deleted`.
  - **Mobile Admin Review (`apps/mobile/app/(app)/users.tsx`)**: High-contrast native review cards with alert notification badges, Approve & Deactivate modal, and Decline modal.
- **Statutory Heavy Equipment Compliance**: In full accordance with Indian Factories Act 1948, Motor Vehicles Act, and insurance regulations, daily machine running logs (HMR), maintenance records, and safety inspections are decoupled from personal identity and preserved anonymously under machine asset codes (e.g. `#SL-004`) for statutory audits.
- **Database & Backend Resilience**: Dedicated table `account_deletion_requests` backed by automatic fallback to `profile_change_requests` (`requested_data.type = 'account_deletion'`) to ensure 100% immediate runtime availability across environments.

### 11. 📱 Unified Mobile Navigation & Reachability Architecture (Web & Native)
- **Manifest-Driven Navigation (`@reachinternational/permissions`)**:
  - Web and Native navigation layout is driven by a single source of truth (`packages/permissions/src/navigation.ts`).
  - **$\le 2$ Taps Reachability Guarantee**: Every allowed page per role is reachable in 2 taps or fewer across phone viewports ($\le 640$px web and native mobile).
  - **Role-Based Bar Order (Max 5 Slots)**:
    - Slot 1 is always **Home** (`/dashboard`).
    - Slots 2–4 are role-specific operational destinations (`PRIMARY`).
    - Slot 5 is **More** (if the role has overflow pages) or **Account** (if no overflow).
    - Role allocations:
      - `operator`: Home, Log, Machines, Account.
      - `supervisor`: Home, Operations, Machines, Users, Account.
      - `hr`: Home, Users, Account.
      - `manager`: Home, Operations, Machines, Clients, More (Behind More: Users, Audit).
      - `admin`: Home, Operations, Machines, Users, More (Behind More: Clients, Audit).
      - `super_admin`: Home, Operations, Machines, Users, More (Behind More: Clients, Audit).
  - **Zero Keyboard Collision**: The bar hides automatically while any text input is focused (`data-nav-hidden` attribute on Web, `Keyboard.addListener` on Native) to eliminate collisions with virtual keyboards and sticky submit buttons.
  - **Dedicated `/more` Route**: Unified server-driven route on Web (`app/(app)/more/page.tsx`) and Native (`apps/mobile/app/(app)/more.tsx`) displaying profile header, dynamic `EditProfileModal`, 2-column overflow touch cards ($\ge 88$px tall), theme toggle, legal links (`/privacy`, `/terms`), account deletion, and sign-out.
  - **Automated Reachability Test**: Enforced by `packages/permissions/src/navigation.test.ts` via `node:test`, verifying 100% route reachability, home-first ordering, and bar length $\le 5$ across all roles.

### 12. 🔄 Global URL Query State Persistence & Anti-Caching Architecture
- **Web App URL Query State Persistence (`useListQueryState`)**:
  - Implements bidirectional synchronization of search terms, dropdown filters, date ranges, and sorting parameters into the browser URL (`?search=...&page=1&role=...`) across all operational tables (`/users`, `/machines`, `/clients`, `/attendance`, `/payroll`, `/audit`, `/operations`).
  - **Zero History Bloat**: Search updates are debounced (~300ms) and synchronized via `window.history.replaceState` or `router.replace(..., { scroll: false })` instead of `router.push`, ensuring the browser Back button navigates between distinct views rather than cycling through individual keystrokes.
  - **Reload Preservation**: Full page refreshes and link sharing preserve the exact filter state without reverting to initial defaults or redirecting to `/dashboard`.
  - **Native History Traversal**: Native `popstate` event listeners update local UI state immediately when users click browser Back or Forward.
- **Mobile Persistent State Architecture (`usePersistentListState`)**:
  - Implements persistent local state backed by `@react-native-async-storage/async-storage` across mobile list screens (`machines.tsx`, `users.tsx`, `clients.tsx`, `attendance.tsx`, `payroll.tsx`).
  - **Smart Pagination Reset**: Preserves user-selected search keywords, status filters, and sorting orders across app restarts, while strictly resetting pagination back to **Page 1** on initial screen mount to prevent stale offset or missing row errors.
  - **Functional Updater Support**: Setters accept both direct values and functional updater callbacks `(prev) => next` for safe asynchronous updates.
- **Service Worker & CDN Dynamic Anti-Caching Enforcement**:
  - Injected strict anti-caching headers (`Cache-Control: no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0`, `Pragma: no-cache`, `Expires: 0`, `CDN-Cache-Control: no-store`, `Vercel-CDN-Cache-Control: no-store`) into `apps/web/proxy.ts` and `apps/web/next.config.ts`.
  - Prohibits service workers and edge CDNs from caching intermediate navigation redirect headers (`307`/`308`/`302`) or authenticated dynamic App Router HTML pages (`/(app)/*`), eliminating stale redirect loops.

---

## 🎨 Official Animated Icons System

ReachInternational standardizes all platform iconography on official, interactive vector animated icons rendered strictly at their natural default settings:

### 1. Primary Source — `lucide-animated.com`
- **Component Registry (`apps/web/components/icons/*.tsx`)**: 66 official animated components downloaded directly from the `lucide-animated.com` registry.
- **Default Animation Settings**: Icons use their natural internal Framer Motion animations at default settings without custom keyframe overrides or artificial scaling jitter.
- **Universal Prop Support**: Enhanced with standard props (`size?: number | string`, `strokeWidth?: number | string`, `isSpinning?: boolean`, `className?: string`) for smooth integration across buttons, navigation links, and operational tables.

### 2. Complementary Source — `@animateicons/react`
- **Fallback Registry (`@animateicons/react/lucide`)**: Official package providing complementary animated icons not found on `lucide-animated.com` (e.g. `TriangleAlertIcon`, `StoreIcon`, `EllipsisVerticalIcon`, `SaveIcon`, `CircleCheckIcon`, `SignalIcon`).
- **Default Micro-Interactions**: Rendered at their natural default settings with clean vector animations.

### 3. Unified Barrels & Compatibility Bridges
- **`apps/web/components/icons/index.ts`**: Central registry exporting all primary and complementary animated icons.
- **`apps/web/components/ui/animated-icons/index.ts`**: Re-export barrel providing convenient access to animated icons (`AnimatedArrowRight`, `AnimatedCheck`, `AnimatedSearch`, etc.) alongside zero-transform compatibility shims.
- **`apps/web/components/ui/empty-icons.tsx`**: Standard compatibility bridge aliased in `tsconfig.json` and `next.config.ts`, providing seamless zero-breaking-change backwards compatibility across all legacy Lucide import call-sites.
- **`apps/web/components/ui/animated-icon.tsx`**: Clean pass-through rendering icons at default settings with zero custom CSS keyframes.

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
│   └── utils/                        # @reachinternational/utils — Platform-neutral date, INR currency, string & universal instant search helpers
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
| **Animated Icons** | Lucide Animated & `@animateicons/react` | Official interactive vector animated icons at default settings |
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
| `super_admin` | Global System | Full control over machines, operations, attendance, payroll, user accounts, security enforcement, and system configuration. |
| `admin` | Global Operations | Add/edit/delete machines, manage users, review running hour logs, oversee client master, configure and review operator payroll, inspect operator attendance. |
| `manager` | Operations & Fleet | Fleet management, client contracts, running hour logs review, shift approvals, and personnel oversight. Strictly restricted from `/payroll` and `/attendance` per business policy. |
| `supervisor` | Site Operations | Monitor daily running hour logs, track operator machine assignments, record machine HMR. |
| `hr` | Human Resources | Operator monthly payroll calculations (split-month overtime lag formula), operator wage configuration (daily rate & OT rate), operator attendance audit & calendar breakdowns, inspect operator running hours logs reports, employee lifecycle management, and profile approvals. |
| `operator` | Field Operations | Submit daily machine running hour logs (`/operations?tab=entry`), view log history (`/operations?tab=history`), and view assigned machine specifications (`/machines`). |

### 📱 Mobile Bottom Navigation & RBAC Matrix

| Role | Accessible Bottom Navigation Tabs (Web & Mobile) | Restricted Routes |
|------|--------------------------------------------------|-------------------|
| `super_admin` | Dashboard, Machines, Operations, Users, Attendance (`/attendance`), Payroll (`/payroll`), Clients, Audit, Profile/Settings | None (Full System Access) |
| `admin` | Dashboard, Machines, Operations, Users, Attendance (`/attendance`), Payroll (`/payroll`), Clients, Audit, Profile/Settings | None |
| `manager` | Dashboard, Machines, Operations, Clients, Users, Audit, Profile/Settings | Payroll (`/payroll`), Attendance (`/attendance`) |
| `supervisor` | Dashboard, Machines, Operations, Users, Profile/Settings | Clients (`/clients`), Payroll (`/payroll`), Attendance (`/attendance`), Audit (`/audit`) |
| `hr` | Dashboard, Operations (`/operations?tab=logs`), Attendance (`/attendance`), Payroll (`/payroll`), Users (`/users`), Profile/Settings | Machines (`/machines`), Clients (`/clients`), Audit (`/audit`) |
| `operator` | Dashboard, Operations, Machines, Profile/Settings | Users (`/users`), Clients (`/clients`), Payroll (`/payroll`), Attendance (`/attendance`), Audit (`/audit`) |

All bottom navigation bars are micro-optimized for 360×800 mobile viewports with minimum 44px touch targets, single-line text truncation, centered active dot indicators, and automatic subroute matching (`/machines/[id]`, `/users?page=...`).

### 🧭 Centralized Navigation & Lifecycle Architecture

Navigation and session lifecycle are governed by `@reachinternational/permissions/navigation` and enforced across 5 dedicated architectural layers:

1. **Authoritative Role Home Mapping (`ROLE_HOME_ROUTES` & `MOBILE_ROLE_HOME_ROUTES`)**:
   - `super_admin`: `/dashboard` (Web) \| `/(app)/dashboard` (Mobile)
   - `admin`: `/dashboard` (Web) \| `/(app)/dashboard` (Mobile)
   - `manager`: `/dashboard` (Web) \| `/(app)/dashboard` (Mobile)
   - `supervisor`: `/dashboard` (Web) \| `/(app)/dashboard` (Mobile)
   - `hr`: `/dashboard` (Web) \| `/(app)/dashboard` (Mobile)
   - `operator`: `/dashboard` (Web) \| `/(app)/dashboard` (Mobile)
   - Alias redirect: `/home` $\rightarrow$ `/dashboard` configured in `next.config.ts`.

2. **The Four Lifecycle Scenarios**:
   - **Scenario 1 — Successful Login**: User credentials verified via Supabase Auth; role resolved from user profile; redirects to `getRoleHomeRoute(role)`. Previous navigation state is cleared.
   - **Scenario 2 — Normal Internal Navigation**: Authenticated users navigate freely between authorized routes (e.g. `/dashboard` $\rightarrow$ `/operations?tab=logs&page=2` $\rightarrow$ `/users`). Full pathname, search parameters, pagination, and tabs are preserved without proxy interference or unnecessary DB roundtrips.
   - **Scenario 3 — Background $\rightarrow$ Foreground / Tab Switch**: Browser tab switching or native app backgrounding preserves in-memory state; zero redirection is triggered.
   - **Scenario 4 — Browser Reload / Native Restart**:
     - *Web*: Browser refresh (F5 / Cmd+R / reload button) strictly preserves the user on their active route (e.g. `/users`, `/machines`, `/profile`). Hard reloads re-render the current route without unwanted redirection to Home (`/dashboard`). Direct root domain (`/`) visits and post-login transitions route to `getRoleHomeRoute(role)`.
     - *Native*: Cold restart / process relaunch runs `apps/mobile/app/index.tsx`, resolves the active session, and opens at `getMobileRoleHomeRoute(role)`.

3. **Layered Separation of Concerns**:
   - **Edge Proxy (`proxy.ts`)**: Session validation, rate limiting, and unauthenticated redirects to `/login`. Does not perform browser reload detection or interfere with internal route navigation.
   - **Authentication / Session Layer (`actions/auth.ts`, `dal.ts`)**: Credentials verification, session cookie management, and role-based access denial redirects to `getRoleHomeRoute()`.
   - **Web Application Shell**: Normal browser navigation adherence; hard reloads preserve current page state.
   - **Native Navigation Layer (`apps/mobile/app/index.tsx`, `login.tsx`)**: Cold start routing and deep link fallback handling.

---

## 🗄 Database Schema

The core database is built on normalized relational tables in Supabase PostgreSQL:

1. `public.users`: System user accounts (email, phone, role, supervisor_id references users(id) [primary legacy reference], city, district, state, state_id references states(id), aadhaar_number, license_number, street [canonical address], shift_start_time, shift_end_time, monthly_salary NUMERIC(10, 2) [strictly enforced for operators via PostgreSQL check constraint], daily_rate, ot_hourly_rate, complete_profile boolean [true/false, default false; indexed with partial index `idx_users_incomplete_profile WHERE (complete_profile = false)`], status, role-aware RLS with supervisor scoping).
2. `public.user_supervisors`: Normalized operator-to-supervisor junction table (`user_id` UUID references `users(id)` ON DELETE CASCADE, `supervisor_id` UUID references `users(id)` ON DELETE CASCADE, `created_at` TIMESTAMPTZ, PRIMARY KEY (`user_id`, `supervisor_id`); indexed with composite B-trees; protected by RLS for user self-visibility, supervisor scoping, and admin/manager management).
3. `public.user_documents`: Statutory KYC document metadata table (`user_id` UUID references `users(id)` ON DELETE CASCADE, `document_type_id` UUID references `user_document_types(id)`, `file_path`, `file_name`, `file_size`, `mime_type`, `status`, `created_at`, `updated_at`; protected by RLS for user self-access and administrative staff review).
4. `public.user_document_types`: Authorized KYC document registry (`code`, `name`, `description`, `required`, `is_active`) strictly restricted to `aadhaar` and `driving_license`.
5. `public.machines`: Machine fleet master (machine_code, model, serial_number, manufacturer, year_of_manufacture, hour_meter, customer_name, status, health_status, current_operator_id; indexed with `idx_machines_created_at_desc` on `created_at DESC, id DESC`).
6. `public.machine_hour_logs`: Daily running hour logs (machine_id, client_id, operator_id, supervisor_id, log_date, start_time, end_time, start_meter, end_meter, running_hours, normal_working_hours, overtime_hours, is_breakdown, breakdown_start_time, breakdown_end_time, breakdown_duration, breakdown_hours, location, remarks, conflict_flag, conflict_reason, conflict_status, conflict_resolved_by, conflict_resolved_at, conflict_resolution_notes, idempotency_key; optimized with 4-column composite B-tree indexes `idx_mhl_machine_date_created`, `idx_mhl_client_date_created`, and `idx_mhl_operator_date_created` on `(entity_id, log_date DESC, created_at DESC, id DESC)` eliminating quicksorts; served via high-performance read model RPC `public.get_operation_logs(...)` from Migration 076).
7. `public.operator_machine_assignments`: Authoritative multi-shift operator assignment roster with recurring daily shift windows (id, machine_id, operator_id, shift_start_time, shift_end_time, crosses_midnight, is_active, assigned_by, assigned_at, ended_at, ended_by, end_reason; indexed with partial index `idx_oma_active_assigned` on `(assigned_at DESC) WHERE (is_active = true AND ended_at IS NULL)` and composite history indexes `idx_oma_machine_assigned_at`, `idx_oma_operator_assigned_at`). Enforces max 3 distinct active operators per machine via advisory transaction locks.
8. `public.operator_shift_ranges`: Normalized 0–1440 circular minute mapping unrolled across midnight with PostgreSQL GiST exclusion constraint (`EXCLUDE USING GIST (operator_id WITH =, minute_range WITH &&) WHERE (is_active)`) preventing double-booked operators across overlapping shifts.
9. `public.clients`: Registered clients & customer sites (client_code, client_name, contact_person, phone, email, address, city, state; indexed with GIN trigram indexes and keyset cursor indexes).
10. `public.states`: Official Indian State and Union Territory directory with official smallint LGD codes (36 entities).
11. `public.districts`: Official Indian Administrative Districts directory (784 districts mapped to `states(id)` with smallint LGD codes).
12. `public.cities`: Statutory Cities, Municipal Corporations, City Municipal Councils, and Major Urban Centers (466 entities mapped to `districts(id)` with Census location codes).
13. `public.towns`: Statutory Municipal Councils, Nagar Palika Parishads, Nagar Panchayats, Town Panchayats, Census Towns, and Sub-District/Tehsil/Taluka hubs (15,081 entities mapped to `districts(id)`).
14. `public.villages`: Complete Census Revenue Village directory (640,787 villages mapped to `districts(id)` with 6-digit Census village codes).
15. `public.master_location`: Unified high-speed location lookup and autocomplete master (15,331 records) indexed with composite B-Tree and `pg_trgm` GIN indexes (`search_text`).
16. `public.idempotency_keys`: Replay attack protection & state mutation deduplication key ledger (idempotency_key, user_id, action_name, request_hash, status, response_payload, created_at, expires_at).
17. `public.audit_logs`: Immutable, append-only security & compliance audit trail (id, user_id, action, entity_type, entity_id, metadata, details, ip_address, created_at; indexed with `idx_audit_logs_entity_id_created` on `(entity_id, created_at DESC)` for sub-millisecond entity history retrieval).
18. Operational Work Locations: User operational locations, sites, and offices are stored directly on the user record via normalized `street`, `city`, `district`, `state`, and `state_id` linked to the Indian administrative master directories, supporting dynamic relocation across yards, workshops, and project sites without static foreign key constraints.

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

---

## Performance & Architectural Optimization Architecture

The monorepo enforces enterprise-grade performance optimizations across Web and Mobile:

### 1. Zero-Risk Bundle & Code Splitting
- **Dynamic Lazy-Loading of SheetJS (`xlsx`)**: Completely decoupled `xlsx` (~150-200 KB minified) from the initial bundle of `/machines`, `/operations`, and `/dashboard`. `exportMachinesToExcel`, `exportSupervisorRunningLogsToExcel`, and `exportOperatorLogsToExcel` are dynamically imported on-demand only when export buttons are clicked.
- **Dynamic PDF Modal Code-Splitting**: Printable PDF preview modals (`PrintableSupervisorLogsModal`, `PrintableOperatorLogsModal`, `PrintableMachineDirectoryModal`, `MachineImportModal`) use Next.js `dynamic(..., { ssr: false })` to ensure print stylesheets and preview trees are loaded only upon user interaction.

### 2. Edge & Auth Network Deduplication
- **Cryptographic User Token Transport**: `apps/web/proxy.ts` validates the session via `supabase.auth.getUser()`, signs the user ID and email using HMAC-SHA256 (`lib/security/internal-auth-token.ts`), and forwards verified `x-internal-user-*` headers downstream.
- **Instantaneous DAL Session Verification**: `apps/web/lib/dal.ts` (`verifySession()`) verifies the HMAC signature in <0.05ms, eliminating the redundant second outbound HTTP call to Supabase Auth on every page navigation, cutting auth latency by 200-500ms and completely resolving HTTP 429 rate limit spikes.

### 3. Database Aggregation & Query Scoping
- **Fast-Path Database RPC (`get_operations_summary`)**: Computes scalar operations KPI summaries (`total_run_hours`, `total_ot_hours`, `total_breakdowns`, `logged_days_count`) directly inside PostgreSQL in ~0.2ms, eliminating row transfer over the wire and in-memory Node.js JavaScript reduction loops.
- **Indexed Location Scoping**: Machine hour log location extraction on `/operations` uses a backward index scan capped at 250 recent entries instead of scanning the unbounded historical table.

### 4. PostgreSQL Index Optimization & RLS InitPlan Tuning
- **Migration 066**: Dropped 6 redundant and duplicate B-tree indexes (`idx_clients_code`, `idx_machines_machine_id`, `idx_users_email`, `idx_users_email_unique`, `users_role_idx`, `users_status_idx`), reducing write amplification and disk overhead.
- **RLS InitPlan Optimization**: Wrapped `current_user_role()` and `auth.uid()` calls in scalar subqueries `(SELECT ...)` across `machine_hour_logs` and `machines` tables, ensuring PostgreSQL evaluates access control once per query rather than per row.
- **Migration 067 (Machine Directory Performance Optimization — M2)**:
  - Dropped 9 redundant/duplicate indexes across `machines`, `machine_hour_logs`, `users`, and `operator_machine_assignments` (including duplicate GiST index `idx_machine_hour_logs_tstzrange` and redundant B-tree prefix `idx_machines_status`), reducing write maintenance on `machine_hour_logs` by 29%.
  - Added 4 GIN trigram indexes on `machines(machine_id, model, serial_number, manufacturer)` for instant substring search (`BitmapOr` execution in <0.2ms).
  - Added B-tree index `idx_machines_hour_meter` on `machines(hour_meter DESC NULLS LAST)` for index-scanned HMR sorting without in-memory quicksort.
  - Added composite partial index `idx_oma_machine_active_shift` on `operator_machine_assignments(machine_id, shift_start_time ASC) WHERE is_active = true` for pre-sorted shift hydration.
  - Optimized RLS policies on `operator_machine_assignments` to use single-evaluation InitPlans (11.4x faster evaluation).
  - Deployed `get_machines_directory_summary` RPC for real-time fleet KPI metrics in <0.2ms.
- **Migration 100 (User Table Optimization & Supervisor Relational Normalization)**:
  - Extracted supervisor arrays into normalized junction table `public.user_supervisors` (`user_id`, `supervisor_id`, `created_at`) with composite primary key, cascade foreign keys, and scoped RLS policies.
  - Standardized user address storage on `street`, eliminating legacy `location`/`address` divergence across auth, onboarding, profile, and admin workflows.
  - Added `monthly_salary NUMERIC(10, 2)` column with PostgreSQL check constraint (`CHECK (role <> 'operator' OR status = 'pending' OR (monthly_salary IS NOT NULL AND monthly_salary >= 0))`) and frontend enforcement.
  - Dropped redundant `shift_time text` column in favor of canonical `shift_start_time` and `shift_end_time` (time without time zone).
  - Converted `complete_profile` from string (`'yes'`/`'no'`) to native PostgreSQL boolean (`true`/`false`, default `false`) backed by partial index `idx_users_incomplete_profile WHERE (complete_profile = false)`.
  - Added `file_name` and `status` to `public.user_documents` KYC metadata table.
  - Dropped duplicate unique constraints (`users_email_key`, `users_phone_unique`) and pruned 7 redundant/overlapping trigram indexes, drastically cutting write amplification and table bloat.

### 5. Mobile Data Architecture (TanStack Query v5)
- **`apps/mobile/lib/hooks/useOperationsData.ts`**: Connected TanStack Query v5 hooks (`useOperationsMasterData`, `useOperationsLogs`) providing a 5-minute cache for equipment, active operators, and clients, and a 1-minute cache for operational logs. Eliminates the 5-query cascade on every screen focus and filter tap while preserving seamless pull-to-refresh.

---

## Production Operational Runbooks (`runbooks/`)

The repository includes standard operating recovery guides for on-call engineers and operators in the `runbooks/` directory:

| Runbook | Severity | Recovery Focus |
| :--- | :---: | :--- |
| [`runbooks/SECURITY_BREACH_AND_SECRET_EXPOSURE.md`](runbooks/SECURITY_BREACH_AND_SECRET_EXPOSURE.md) | **P0** | Service-role secret compromise, credential leakage, session revocation, key rotation |
| [`runbooks/DATABASE_OUTAGE_AND_POOL_EXHAUSTION.md`](runbooks/DATABASE_OUTAGE_AND_POOL_EXHAUSTION.md) | **P0** | Supabase connection saturation, statement timeouts (10s), PgBouncer recovery |
| [`runbooks/DISASTER_RECOVERY_AND_RESTORE.md`](runbooks/DISASTER_RECOVERY_AND_RESTORE.md) | **P0** | Catastrophic data corruption, Supabase Point-in-Time Recovery (PITR), smoke testing |
| [`runbooks/MOBILE_EAS_AND_OTA_CRASH_RECOVERY.md`](runbooks/MOBILE_EAS_AND_OTA_CRASH_RECOVERY.md) | **P0 / P1** | Mobile startup crash loops, Android 15 edge-to-edge crashes, EAS OTA rollback |
| [`runbooks/DATABASE_MIGRATION_DRIFT_AND_CORRUPTION.md`](runbooks/DATABASE_MIGRATION_DRIFT_AND_CORRUPTION.md) | **P0 / P1** | Migration failures, PostgREST schema cache desync, RLS policy restoration |
| [`runbooks/AUTH_PROXY_AND_SESSION_FAILURE.md`](runbooks/AUTH_PROXY_AND_SESSION_FAILURE.md) | **P1** | Edge proxy HMAC token signature mismatch, Supabase Auth 429, cookie desync |
| [`runbooks/VERCEL_WEB_DEPLOYMENT_FAILURE.md`](runbooks/VERCEL_WEB_DEPLOYMENT_FAILURE.md) | **P1** | Vercel production build failure, `guard-build.js` collisions, instant SHA rollback |
| [`runbooks/RATE_LIMIT_LOCKOUT_AND_LPDOS_INCIDENT.md`](runbooks/RATE_LIMIT_LOCKOUT_AND_LPDOS_INCIDENT.md) | **P1** | Edge rate limiter 429 lockouts, shared office IP unblocking, LPDoS defense |
| [`runbooks/DATA_DISCREPANCY_AND_LOG_OVERLAP.md`](runbooks/DATA_DISCREPANCY_AND_LOG_OVERLAP.md) | **P1 / P2** | Shift log overlap violations, meter reading typos, atomic RPC reconciliation |
| [`runbooks/EXTERNAL_SERVICES_DEGRADATION.md`](runbooks/EXTERNAL_SERVICES_DEGRADATION.md) | **P2** | SendGrid email failures, Twilio WhatsApp/SMS failures, QStash cron failures |
| [`runbooks/STORAGE_BUCKET_AND_UPLOAD_FAILURE.md`](runbooks/STORAGE_BUCKET_AND_UPLOAD_FAILURE.md) | **P2** | Supabase Storage bucket 403s, signed URL expiry, photo upload rejections |

See [`runbooks/README.md`](runbooks/README.md) for the complete severity matrix, on-call 5-minute checklist, and triage workflows.

---

## 🔍 Universal Enterprise High-Scale Search Framework

For the cross-platform search architecture engineered for **100,000+ records** (PostgreSQL GIN Trigram indexes `pg_trgm`, 180ms debounced server actions with `AbortController` cancellation, zero client-side RAM bloat, Geist blue `#0070f3` text-only highlighting with zero background, and turn-key recipes for Users, Clients, Machines, and Operations), see the authoritative [Universal High-Scale Search Developer Guide](docs/REUSABLE_INSTANT_SEARCH_GUIDE.md).

### Machine Directory Search Engine
The Machine Directory (`/machines`) implements the high-scale search engine across Web (`apps/web`) and Mobile (`apps/mobile`):
- **Target Scale**: 100,000+ machines with sub-25ms response times.
- **Search Scope**: Strictly restricted to **Machine ID (`machine_id`)**, **Machine Model (`model`)**, and **Machine Serial Number (`serial_number`) ONLY**.
- **PostgreSQL GIN Trigram Indexes**: `idx_machines_machine_id_trgm`, `idx_machines_model_trgm`, `idx_machines_serial_number_trgm` (migration 067).
- **Server Action**: `searchMachinesServerAction` with 50-row pagination and whole-database search execution.
- **UI/UX & Highlighting**: Zero full page reloads, 180ms debounce with request cancellation, Geist Blue `#0070f3` (light) / `#3291ff` (dark) text highlight with zero background color, and graceful empty state with "Clear Search" button.

---

## 🛡️ Enterprise Security & Database Defense-in-Depth Architecture

The Reach International monorepo implements a defense-in-depth security model across Web (`apps/web`), Mobile (`apps/mobile`), and the Supabase PostgreSQL database:

### 1. Role-Based Access Control (RBAC) & Registration Hardening
- **Canonical 6-Role Consolidation (Migration 085)**: Monorepo-wide and database-level enforcement of strictly 6 canonical roles (`super_admin`, `admin`, `manager`, `supervisor`, `hr`, `operator`). Self-registration on `/signup` is restricted to non-admin roles (`operator`, `supervisor`, `manager`, `hr`). The `handle_new_user()` trigger enforces these 6 roles, and any attempt to self-assign `admin` or `super_admin` via auth metadata is forced to `operator`.
- **Operator RBAC Governance & Super Admin Log Deletion (Migration 086)**: Strict enforcement across database RLS (`public.machine_hour_logs`), backend actions (`deleteOperatorHourLogAction`), and Web/Mobile interfaces. Operators can enter daily logs, view their own logs, edit own logs within a 7-day cutoff window, and export their own logs only. Machine hour log deletion is **strictly and exclusively restricted to `super_admin`**; operators have zero delete controls. Operators are barred from viewing other operators' logs, altering machines, managing clients/users, or viewing audit logs.
- **Immutable Onboarding Role Separation**: Profile onboarding actions (`onboarding.ts`) resolve user identity via verified session claims and explicitly strip `role` from update payloads, preventing privilege escalation.
- **Operator Spec & Rate Mutation Lock (Migration 081)**: The `trg_enforce_supervisor_machine_update_restrictions` trigger enforces that neither `supervisor` nor `operator` can modify machine serial numbers, models, client assignments, or supervisor pairings. Operators are strictly barred from modifying operator assignments or hourly rates.

### 2. PII Protection & Data Minimization
- **Supervisor Directory Pruning (Migration 080)**: The `get_active_supervisors_public()` RPC returns strictly `(id, full_name)` to unauthenticated callers. Supervisor email addresses and phone numbers are inaccessible without authenticated administrative sessions.
- **Zero-PII Action Responses**: `getSupervisorsAction` strips email and PII before returning data to the client, limited to 200 rows to prevent table scraping.

### 3. Native Mobile App Security Shell
- **Path Traversal Sanitization (`NativeBridge.ts`)**: File download events sanitize filenames to alphanumerics and dots, verifying target paths strictly reside within `FileSystem.documentDirectory`.
- **Pinned WebView Host Whitelist (`webview-config.ts`)**: Mobile WebViews strictly pin Supabase traffic to the exact production project domain (`dhbbgfzbyatzvqafnsqp.supabase.co`), preventing malicious origins from communicating with the native bridge.
- **Hardware-Backed Keystore (`expo-secure-store`)**: Native authentication tokens and session refresh tokens are stored in Android KeyStore / iOS Keychain rather than plaintext local storage.

### 4. Dedicated Password Recovery & Server-Side PKCE Callback Architecture
- **Two-Step Architecture**: Separation of concerns between requesting recovery emails (`/forgot-password`) and setting new credentials (`/reset-password`), adhering strictly to Supabase's documented flow.
- **Server-Side PKCE Code & OTP Exchange (`/api/auth/callback`)**: Dedicated route handler executing `exchangeCodeForSession(code)` and `verifyOtp({ token_hash, type })` on the server runtime where HttpOnly cookies (including PKCE verifiers) are accessible, solving client-side storage clearance errors and setting session cookies seamlessly.
- **Strict Token Security Guard**: Direct access to `/reset-password` without a valid recovery token strictly prevents rendering the password input form. Direct hits carrying auth codes or recovery tokens at `/reset-password` or `/login` are automatically intercepted and routed through `/api/auth/callback?next=/reset-password`.
- **Clean Authentication Routing**: Stripped embedded reset cards from `/login`. Any incoming recovery parameters landing at `/login` are automatically routed through the server callback to establish the authenticated reset session.

---

## 📈 Google Analytics 4 (GA4) & Universal Telemetry Architecture

The platform integrates enterprise **Google Analytics 4 (`gtag.js`)** under Measurement ID **`G-DC126P3SM9`** (configurable via `NEXT_PUBLIC_GA_MEASUREMENT_ID` across `.env`, `.env.local`, and `.env.example`):

### 1. Zero-Latency Asynchronous Loading & Consent Mode v2
- **Next.js App Router Integration (`apps/web/components/analytics/GoogleAnalytics.tsx`)**: Injected via `next/script` with `strategy="afterInteractive"`, accompanied by `<link rel="preconnect" href="https://www.googletagmanager.com" />` inside `<head>`.
- **Google Consent Mode v2 Compliance**: Bidirectionally synchronized with `CookieConsent.tsx` (`localStorage["cookie-consent"]`). Defaults to `denied` for analytics and advertising storage until the user accepts, upon which `updateConsent(true)` instantly promotes privileges without page reload.

### 2. Client-Side SPA Route & Query Tracking
- **Automatic Page View Dispatch (`AnalyticsRouteTracker`)**: Listens to `usePathname()` and `useSearchParams()`. Emits granular `page_view` events (`page_path`, `page_title`, `page_location`) on every client-side transition, ensuring 100% of navigations across public pages, authentication flows, and protected dashboards are captured.

### 3. Universal Event Delegation & Automatic Click Capture
- **Automatic Interception (`GlobalAnalyticsListener`)**:
  - **Outbound Link Clicks**: Intercepts external domain links and dispatches `outbound_click` events.
  - **File Downloads**: Captures `.pdf`, `.xlsx`, `.csv`, `.docx`, and `.zip` asset downloads automatically (`file_download`).
  - **Declarative HTML Attributes**: Any DOM element with `data-analytics-click="CTA Name"`, `data-analytics-category="..."`, or `data-analytics-event="..."` is tracked automatically with zero component-level JavaScript wiring.
  - **Form Submissions**: Forms with `data-analytics-form="..."` dispatch structured `form_submit` telemetry.

### 4. Core Business Event Instrumentation (`apps/web/lib/analytics.ts`)
- **Authentication**: `trackLogin()`, `trackSignUp()`, `trackLogout()`.
- **Search Telemetry**: `trackSearch()` hooked into `CommandPalette` and table search inputs.
- **Reporting & Operations**: `trackExport()`, `trackOperationAction()`, `trackThemeChange()`, and `trackException()`.
- **Cross-Platform Mobile Parity (`apps/mobile/lib/analytics/`)**: Provides isomorphic analytics helpers for Expo Web and native targets.

---

## Database Architecture & Supabase Environments

Reach International manages isolated Supabase environments under organization `ljzofzlvjtfiqoffaaua`:

| Environment | Project Name | Project Ref | Region | Status | Tables / Schema |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Production** | `Reach International Production` | `dhbbgfzbyatzvqafnsqp` | `ap-south-1` (Mumbai) | Active Healthy | Live fleet, operations & production data |
| **Development** | `Reach International Dev` | `vlmxciuogczumumrwyot` | `ap-south-1` (Mumbai) | Active Healthy | Mirrored schema (`001`–`110` migrations, 20 public tables, RLS enabled) |

### CLI & Migration Synchronization
- **Supabase CLI**: Switch projects easily via `supabase link --project-ref <REF>`.
- **Migrations Directory (`supabase/migrations/`)**: 110 canonical SQL migrations applied sequentially, with automated schema version tracking in `supabase_migrations.schema_migrations`.
- **Storage Buckets**: Private `user_files` bucket for identity KYC verification (Aadhaar, Driving Licence) secured with short-lived signed URLs.


