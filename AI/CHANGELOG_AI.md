- **Page Feedback: Proper Tooltip Wrappers for Unlabeled Project Icons (`apps/web/components/animate-ui/components/radix/dialog.tsx`, `ComplaintsClient.tsx`, `ComplaintDetailModal.tsx`, `FieldServiceReportModal.tsx`, `ServicesClient.tsx`, `EnterpriseTable.tsx`) (2026-08-19)**:
  - **Modal Close Button Tooltip (`dialog.tsx`)**: Wrapped Radix `DialogPrimitive.Close` button with `<TooltipWrapper content="Close modal (Esc)" side="left">`, giving every modal dialog in the app a clean tooltip on close button hover.
  - **Complaints Table Action Tooltips (`ComplaintsClient.tsx`)**: Wrapped all icon-only table cell action buttons (`View FSR Report`, `Resolve (Fill FSR)` / `View Details`, `Edit Complaint`, `Delete Complaint`) in `<TooltipWrapper>` popovers.
  - **Complaint & FSR Modal Action Tooltips (`ComplaintDetailModal.tsx`, `FieldServiceReportModal.tsx`)**: Wrapped icon buttons (`Delete Complaint`, `Edit Complaint`, `Edit Report`, `Remove part row`) in `<TooltipWrapper>` popovers.
  - **Service Logs Action Tooltips (`ServicesClient.tsx`)**: Wrapped icon-only table cell action buttons (`Update Service Log`, `Delete Service Log`) in `<TooltipWrapper>` popovers.
  - **Enterprise Table Toolbar Tooltips (`EnterpriseTable.tsx`)**: Added tooltips to density control toggle buttons (`Compact`, `Default`, `Comfortable`) and column menu toggle button.
  - **Verification**: Executed `pnpm --filter @servicecentric/web typecheck` (**Passed cleanly with 0 compilation errors**).

- **Page Feedback: Compact Modal Header Action Buttons & Icon-Only Edit/Delete (`apps/web/components/complaints/ComplaintDetailModal.tsx`, `MachineComplaintModal.tsx`, `FieldServiceReportModal.tsx`) (2026-08-19)**:
  - **Icon-Only Edit & Delete Buttons (`ComplaintDetailModal.tsx`, `FieldServiceReportModal.tsx`)**: Replaced text labels on `Edit` and `Delete` header buttons with clean icon-only buttons (`h-7 w-7 p-0 flex items-center justify-center`) with descriptive `title` tooltips (`"Edit Complaint"`, `"Delete Complaint"`, `"Edit Report"`).
  - **Slightly Smaller Button Standard (`ComplaintDetailModal.tsx`, `MachineComplaintModal.tsx`, `FieldServiceReportModal.tsx`)**: Compacted all modal header action buttons to `h-7` (~28px compact height) with `px-2.5 text-xs` padding for a high-density, refined header design.
  - **Verification**: Executed `pnpm --filter @servicecentric/web typecheck` (**Passed cleanly with 0 compilation errors**).

- **Page Feedback: Field Service Report (FSR) Modal Header Actions (`apps/web/components/complaints/FieldServiceReportModal.tsx`) (2026-08-19)**:
  - **Shifted Actions to Header (`FieldServiceReportModal.tsx`)**: Moved `Print / Save PDF`, `Edit Report`, `Send Back for Revision`, `Approve FSR`, and `Complete FSR / Submit` action buttons into the top header bar next to the modal title via `headerActions` prop. Removed bottom footer action buttons container for 100% modal consistency across the complaints module.
  - **Verification**: Executed `pnpm --filter @servicecentric/web typecheck` (**Passed cleanly with 0 compilation errors**).

- **Page Feedback: Complaint Detail Modal Header Actions (`apps/web/components/complaints/ComplaintDetailModal.tsx`) (2026-08-19)**:
  - **Shifted Actions to Header (`ComplaintDetailModal.tsx`)**: Moved `Delete`, `Edit`, and `View FSR Report` / `Resolve (Fill FSR)` action buttons into the top header bar next to the modal title via `headerActions` prop. Removed the bottom footer action buttons container for visual consistency with `MachineComplaintModal`.
  - **Verification**: Executed `pnpm --filter @servicecentric/web typecheck` (**Passed cleanly with 0 compilation errors**).

- **Page Feedback: Modal Double Scrollbar Resolution & Single Scroll Container Standard (`apps/web/components/complaints/MachineComplaintModal.tsx`, `ComplaintDetailModal.tsx`, `apps/web/components/machines/MachineModal.tsx`, `MachineCategoryModal.tsx`) (2026-08-19)**:
  - **Eliminated Nested Scrollbars (`MachineComplaintModal.tsx`, `ComplaintDetailModal.tsx`, `MachineModal.tsx`, `MachineCategoryModal.tsx`)**: Removed redundant inner `max-h-[...vh] overflow-y-auto pr-1` styles from modal form/div body containers, leaving `Modal.tsx`'s `<div className="flex-1 overflow-y-auto p-6">` as the single, smooth scroll container for all modal dialogs.
  - **Verification**: Executed `pnpm --filter @servicecentric/web typecheck` (**Passed cleanly with 0 compilation errors**).

- **Page Feedback: Machine Complaint Modal Header Actions & UI Cleanup (`apps/web/components/complaints/MachineComplaintModal.tsx`, `apps/web/components/ui/Modal.tsx`) (2026-08-19)**:
  - **Modal Header Actions (`Modal.tsx`, `MachineComplaintModal.tsx`)**: Extended `ModalProps` with `headerActions?: ReactNode` rendered in `DialogHeader` alongside modal title with `pr-12` padding. Moved `Cancel` and `Raise Machine Complaint` / `Update Complaint` action buttons into top header bar.
  - **Removed Footer & Section Banner (`MachineComplaintModal.tsx`)**: Completely removed bottom sticky action buttons container from form body and removed the top amber notice box (`Malfunction Complaint Entry`).
  - **Removed Section Header Icon (`MachineComplaintModal.tsx`)**: Removed the `<Wrench>` icon next to the "Machine & Breakdown Details" subheader for a cleaner form layout.
  - **Verification**: Executed `pnpm --filter @servicecentric/web typecheck` (**Passed cleanly with 0 compilation errors in modified files**).

- **Enterprise To-Do & Task Management Module (Web & Mobile) (`supabase/migrations/033_todo_task_management.sql`, `apps/web/`, `apps/mobile/`, `packages/`) (2026-08-19)**:
  - **Database & RLS (`033_todo_task_management.sql`)**: Created `tasks`, `task_assignees`, `task_attachments`, `task_comments`, and `task_activity_logs` tables with auto-incrementing task numbers (`TSK-00001`), RLS security policies, performance indexes, and triggers. Updated `seed_dummy_data.mjs` with task seed data.
  - **Shared Workspace Packages (`packages/`)**: Extended `@servicecentric/types` with `Task`, `TaskAssignee`, `TaskAttachment`, `TaskComment`, `TaskActivityLog`, `TaskStats`, `TaskFilterParams`. Created `@servicecentric/validation` Zod schemas (`createTaskSchema`, `updateTaskSchema`, `completeTaskSchema`, `verifyTaskSchema`, `taskCommentSchema`). Extended `@servicecentric/design-tokens` badge contracts with task statuses (`pending`, `overdue`, `reopened`).
  - **Next.js Web App (`apps/web`)**: Implemented DAL queries (`tasks.ts`), Server Actions (`tasks.ts`), `/tasks` page route, KPI dashboard stats, List & Kanban views, `CreateTaskModal`, `TaskDetailDrawer`, `CompleteTaskModal`, and `VerifyTaskModal`. Updated `AppSidebar.tsx` navigation.
  - **Expo Mobile App (`apps/mobile`)**: Built pixel-perfect mobile task screen (`tasks.tsx`) and creation modal (`CreateTaskModal.tsx`) matching user wireframe screenshots. Features left-border priority accents (Red/Orange/Green), sub-tabs (`All Tasks`, `My Tasks`, `Assigned to Me`, `Completed`), assignee cards with avatars & roles, due date badges, sort options, and Floating Action Button (+).
  - **Verification**: Executed `pnpm typecheck` (**Passed cleanly with 0 compilation errors across all 9 monorepo workspace packages**).

- **Page Feedback: Machine Breakdown Complaints Table UI/UX Overhaul & Click-Row Detail Modal (`apps/web/components/complaints/ComplaintsClient.tsx`, `apps/web/components/complaints/ComplaintDetailModal.tsx`, `apps/web/app/actions/complaints.ts`) (2026-08-19)**:
  - **Icon-Only Action Buttons (`ComplaintsClient.tsx`)**: Replaced text buttons `"View FSR Report"` and `"Edit"` with compact icon-only buttons (`AnimatedFileText`, `AnimatedEdit`, `AnimatedTrash`) with tooltips (`"View FSR Report"`, `"Edit Complaint"`, `"Delete Complaint"`).
  - **Fully Functional Delete Server Action (`complaints.ts`, `ComplaintsClient.tsx`)**: Created `deleteComplaint(id)` server action with RBAC checks (`super_admin`, `admin`, `service_manager`, `branch_manager`, `supervisor`), Supabase record deletion, automatic machine status restoration (if no other active complaints), audit logging (`complaint.deleted`), cache revalidations (`complaints`, `machines`, `dashboard`), and delete confirmation modal.
  - **Click-Row Complaint Detail View (`ComplaintDetailModal.tsx`, `ComplaintsClient.tsx`)**: Created `ComplaintDetailModal` displaying machine specs, malfunction details, required spare parts & quantities, hour meter reading, personnel assignment, work done logs, and FSR status. Connected `onRowClick` on `EnterpriseTable`.
  - **Interactive Multi-Option Filter Toolbar (`ComplaintsClient.tsx`)**: Added search bar + 4 filter dropdowns (`Status`, `Machine/Model`, `Assigned Engineer`, `Spare Parts Required`) with active filter counter and reset button.
  - **Clean Data & Title Case Table Headers (`ComplaintsClient.tsx`)**: Formatted table headers into Title Case (`Complaint No`, `Machine & Model`, `Malfunction Issue`, `Personnel`, `Status`, `Actions`) with bold machine codes, part badges, and formatted business dates (`formatDisplayDate`).
  - **Verification**: Executed `pnpm typecheck` (**Passed cleanly with 0 compilation errors across all 9 monorepo workspace packages**).

- **Page Feedback: Service Log Update Modal UI/UX Redesign & Save CTA Label (`apps/web/components/services/ServicesClient.tsx`, `apps/web/components/ui/Modal.tsx`) (2026-08-19)**:
  - **Submit Button Label ("Save") (`ServicesClient.tsx`)**: Updated the primary form submit button label from `"Save & Complete Service"` to `"Save"` per user feedback ("show only save").
  - **Modal Overflow & Scroll Container Fix (`ServicesClient.tsx`, `Modal.tsx`)**: Removed `max-h-[75vh] overflow-y-auto` from the `<form>` element inside `ServicesClient.tsx`, eliminating nested scroll containers and double scrollbar bugs. Pinned action buttons (`Cancel` & `Save`) in the `Modal` footer prop (`footer`), ensuring action buttons remain visible and pinned at the bottom while the form body scrolls smoothly.
  - **Redesigned DialogHeader (`ServicesClient.tsx`, `Modal.tsx`)**: Extended `ModalProps` to accept `ReactNode` for `title` and `description`. Redesigned header with an icon avatar, bold title (`Update Service Log`), machine code badge (`EXCA-001`), model name, and category subtitle for clear visual hierarchy.
  - **Verification**: Executed `pnpm typecheck` (**Passed cleanly with 0 compilation errors across all 9 monorepo workspace packages**).

- **Web App Reusable Custom Dropdown System (`apps/web/components/ui/Select.tsx`, `apps/web/components/*`) (2026-08-19)**:
  - **Upgraded Custom Dropdown Component (`Select.tsx`)**: Rebuilt `Select` component with `framer-motion` popover slide & fade animations, dark/light theme support, custom chevron rotation (`AnimatedChevronDown`), checkmark indicators (`AnimatedCheck`), search filter bar for long lists (> 6 items), and full keyboard navigation (`ArrowUp`, `ArrowDown`, `Enter`, `Escape`).
  - **Backward Compatibility & Form Handling**: Supports both `options={[{ value, label }]}` array props and parsing `<option>` JSX children. Maintained 100% native `<form>` compatibility (`FormData`) via hidden `<input type="hidden" name={name} value={value} />` and synthetic `React.ChangeEvent` dispatch.
  - **Web Application Refactoring**: Replaced 100% of native browser `<select>` dropdowns across all web application modules (`ServicesClient.tsx`, `BranchSelector.tsx`, `MachineModal.tsx`, `RentalManagementClient.tsx`, `OperationsClient.tsx`, `StockLedgerClient.tsx`, `PurchaseRequestModal.tsx`, `PartIssueModal.tsx`, `GoodsReceiptModal.tsx`, `HRClient.tsx`, `FinanceClient.tsx`, `DocumentsClient.tsx`, `OperatorDashboard.tsx`, `AuditLogsClient.tsx`).
  - **Verification**: Executed `pnpm typecheck` (**Passed cleanly with 0 compilation errors across all 9 monorepo workspace packages**). Verified zero remaining native `<select>` tags in web application components.

- **Page Feedback: Machine Service Table Row Icon Removal & Dual Action Icons (Update / Delete) (`apps/web/components/services/ServicesClient.tsx`, `apps/web/app/actions/services.ts`) (2026-08-19)**:
  - **Removed Row Icon from Machine Number Column (`ServicesClient.tsx`)**: Removed the Wrench icon span wrapper from the Machine Number column cell across all table rows per user feedback.
  - **Dual Action Icons (Update / Delete) (`ServicesClient.tsx`)**: Replaced text button with compact icon-only Update (`Edit`) and Delete (`Trash2`) buttons.
  - **Fully Functional Delete Server Action (`services.ts`, `ServicesClient.tsx`)**: Created `deleteServiceRecord(machineId)` server action with Supabase deletion, machine service count update, audit logging (`service.deleted`), and cache revalidations (`services`, `machines`, `dashboard`). Added confirmation modal for deletion.
  - **Verification**: Executed `pnpm typecheck` (**Passed cleanly with 0 compilation errors across all 9 monorepo workspace packages**).

- **Page Feedback: Machine Service & Maintenance Logs Table UX & Visual Hierarchy Redesign (`apps/web/components/services/ServicesClient.tsx`, `apps/web/components/ui/EnterpriseTable.tsx`, `packages/utils/src/date.ts`) (2026-08-19)**:

  - **Column Structure & Title Case Headers (`ServicesClient.tsx`)**: Reordered columns to place Machine Number as the primary visual anchor (bold mono, Wrench icon, brand link highlight, clickable). Transformed awkwardly wrapped uppercase headers into clean Title Case headers (`Action`, `Machine Number`, `Model`, `Category`, `Service Status`, `Service Due Date`, `Days`, `Completion Date`, `Serial No.`).
  - **Humanized Urgency & Positive Days (`ServicesClient.tsx`)**: Replaced `Overdue (-16 days)` with `16 days overdue` (bold count + red highlight). Replaced raw counts with humanized urgency text (`Due today`, `1 day left`, `13 days left`).
  - **Compact CTA & Row Density (`ServicesClient.tsx`, `EnterpriseTable.tsx`)**: Replaced large `Update Service` buttons with compact `✎ Update` CTA buttons. Adjusted default row padding (`py-2.5 px-3.5`) targeting ~56–64px row height.
  - **Business Date Formatting & Subdued Missing Values (`date.ts`, `ServicesClient.tsx`)**: Standardized ISO dates to business format (`07 Aug 2026`) via `formatDisplayDate`. Rendered missing values (`—`) in subtle muted gray (`opacity-40 font-normal`).
  - **Interactive Multi-Filter Toolbar & Default Urgency Sorting (`ServicesClient.tsx`, `EnterpriseTable.tsx`)**: Added Status, Category, and Due Date filters. Pre-sorted table by urgency (`defaultSortColumn="due_days"`). Hidden low-priority `Serial No.` by default (`defaultHiddenColumns={["serial_no"]}`).
  - **Verification**: Executed `pnpm typecheck` (**Passed cleanly with 0 compilation errors across all workspace packages**).

- **Page Feedback: Removal of Comment Prefix Slashes (`//`) Across Entire Mobile App (`apps/mobile/components/ui/MobileHeader.tsx`, `profile.tsx`, `dashboard.tsx`, `machines.tsx`, `my-work.tsx`, `notifications.tsx`, `login.tsx`) (2026-08-19)**:
  - **Sanitized Mobile Header (`MobileHeader.tsx`)**: Added regex sanitizer (`eyebrow.replace(/^\/\/\s*/, '')`) to `MobileHeader` component to automatically strip leading `//` comment slashes from any header eyebrow.
  - **Cleaned UI Text Strings Across Mobile Screens (`profile.tsx`, `dashboard.tsx`, `machines.tsx`, `my-work.tsx`, `notifications.tsx`, `login.tsx`)**: Removed comment-like `// ` prefix from `eyebrow` props and JSX `<Text>` elements (`USER ACCOUNT`, `USER IDENTIFICATION`, `SYSTEM PREFERENCES`, `FIELD OPERATIONS`, `KEY METRICS OVERVIEW`, `PRIORITY FIELD TASKS`, `FLEET DIRECTORY`, `FIELD QUEUE`, `ALERT SYSTEM`, `ENTERPRISE FLEET TRACKING`).
  - **Verification**: Executed `pnpm typecheck` (**Passed cleanly with 0 compilation errors across all 9/9 monorepo workspace packages**). Verified 0 remaining `//` comment slashes in mobile UI text.

- **Page Feedback: Mobile Bottom Navbar 3-Line Menu & Contextual Submenus Navigation (`apps/mobile/components/ui/MainMenuModal.tsx`, `CustomBottomTabBar.tsx`, `_layout.tsx`, `notifications.tsx`) (2026-08-19)**:
  - **All Main Pages Navigation Drawer (`MainMenuModal.tsx`)**: Built full-screen bottom-sheet modal triggered by the 3-line Menu icon button in the bottom navigation bar. Categorized all 13 main pages (Core Operations, Resource & Commercial, Administration & Staff) with active indicators and smooth navigation.
  - **Contextual Bottom Tab Bar (`CustomBottomTabBar.tsx`)**: Placed 3-line Menu icon button on the left of the bottom navbar. Dynamically mapped and rendered active module submenus/subtabs (`/notifications`, `/machines`, `/operations`, `/rentals`, `/my-work`, `/inventory`, `/crm`, `/finance`, `/hr`, `/dashboard`, `/profile`).
  - **Connected App Layout & Route Sync (`_layout.tsx`, `notifications.tsx`)**: Connected `CustomBottomTabBar` to `<Tabs tabBar={(props) => <CustomBottomTabBar {...props} />}>`. Synced search parameter `tab` in `NotificationsScreen` with bottom navbar submenus (`tab=all`, `tab=unread`, `tab=breakdowns`, `tab=system`).
  - **Verification**: Executed `pnpm typecheck` (**Passed cleanly with 0 compilation errors across all 9/9 workspace packages**).

- **AI Agent Global Rule: Web & Mobile UI/UX Consistency (`.agents/rules/web_mobile_ui_consistency.md`, `AI/UI_RULES.md`) (2026-08-19)**:
  - **Comprehensive 22-Section Rule Document**: Formatted and saved the complete 22-section Global Rule for Web & Mobile UI/UX Consistency into `.agents/rules/web_mobile_ui_consistency.md` and integrated it into `AI/UI_RULES.md`.
  - **Core Protocols Enforced**: Enforces single design system source of truth (`@servicecentric/design-tokens`), identical color tokens, shared typography hierarchy, visual component parity, information architecture preservation, identical icon families, uniform UX logic, matching terminology, and strict accessibility standards.
  - **Verification**: Verified rule documents written cleanly to `.agents/rules/web_mobile_ui_consistency.md` and `AI/UI_RULES.md`.

- **Mobile Role-Based Left Drawer & Dynamic Sub-Menu Bottom Navigation (`apps/mobile/components/navigation/`, `apps/mobile/components/ui/`) (2026-08-19)**:
  - **Top-Left Hamburger Menu Trigger (`MobileHeader.tsx`)**: Placed hamburger `Menu` button in top-left of the clean header bar, connected to open the left navigation drawer.
  - **Left Slide-Out Drawer Menu (`MobileDrawer.tsx`)**: Built smooth left slide-out drawer rendering role-filtered navigation items (`Dashboard`, `My Work`, `Rentals`, `CRM`, `Machines`, `Operations`, `Service`, `Inventory`, `Vendors`, `Purchase Orders`, `Challans`, `Documents`, `HR`, `Finance`, `Reports`, `Administration`) matching web app sidebar reference. Included bottom profile card with avatar, email, role badge, theme toggle switch, and Sign Out button.
  - **Dynamic Sub-Menu Bottom Navigation (`CustomBottomTabBar.tsx`, `DynamicBottomNav.tsx`)**: Dynamically renders sub-menu tabs for active routes containing sub-items (`/machines`, `/rentals`, `/crm`, `/operations`, `/service`, `/inventory`, `/hr`, `/finance`).
  - **No-Submenu Guard**: Automatically hides bottom navigation bar (`returns null`) when viewing screens without sub-menus (`/dashboard`, `/my-work`, `/challans`, `/documents`, `/reports`, `/administration`, `/notifications`, `/profile`), giving maximum full-screen height to page content.
  - **Verification**: Executed `pnpm typecheck` (**Passed cleanly with 0 compilation errors across all 9/9 workspace packages**).

- **Mobile App UI, Color & Design Alignment with Web App (`apps/mobile/components/ui/`, `apps/mobile/app/`) (2026-08-19)**:
  - **Identical Theme & Design System Tokens**: Standardized mobile colors, borders, elevation, and typography with the Vercel Geist design system (`#0a0a0a` canvas in dark, `#171717` elevated cards, `#262626` / `#ebebeb` hairlines, `#3b82f6` / `#0070f3` link accents).
  - **Standardized Mobile Header Component (`MobileHeader.tsx`)**: Created reusable top header bar featuring ServiceCentric emblem logo, live sync dot indicator, notifications trigger, user role badge, theme toggle button, and uppercase Geist Mono section eyebrows.
  - **Upgraded UI Primitives (`Badge.tsx`, `Button.tsx`, `Card.tsx`, `Input.tsx`)**: Added micro-dot status indicators and 15% opacity fills to `Badge`, pill CTA vs square app control shapes to `Button`, base vs elevated shadow variants to `Card`, and left icon slot with focus ring highlights to `Input`.
  - **Web-Identical Mobile Screens (`login.tsx`, `dashboard.tsx`, `my-work.tsx`, `machines.tsx`, `notifications.tsx`, `profile.tsx`, `_layout.tsx`)**: Updated mobile login hero screen (mesh gradient bloom, platform metrics), dashboard KPI cards (`tabular-nums`), tab bar navigation with top indicator line, search inputs, and subtab filter pill strips.
  - **Verification**: Executed `pnpm typecheck` (**Passed cleanly with 0 compilation errors across all 9/9 workspace packages**).

- **Page Feedback: Collapsed Sidebar Flyout Positioning Fix (`apps/web/components/ui/tooltip.tsx`, `apps/web/components/layout/sidebar/CollapsedSidebarFlyout.tsx`) (2026-08-19)**:
  - **DOM Unmount & Root Cause Resolution (`tooltip.tsx`)**: Fixed root cause where `SidebarTooltip` conditionally unmounted `<SidebarMenuButton>` when `enabled={!isFlyoutOpen}` changed from `true` to `false`. Updated `SidebarTooltip` and `TooltipWrapper` to pass `open={enabled ? undefined : false}` on `<Tooltip>`, maintaining a continuous DOM tree structure without unmounting or remounting DOM elements on menu click.
  - **DOM Connection & Zero-Rect Positioning Guards (`CollapsedSidebarFlyout.tsx`)**: Enhanced `updatePosition()` in `CollapsedSidebarFlyout` with `anchorEl.isConnected` check and invalid zero-bounding-box guard (`rect.width === 0 && rect.height === 0`), guaranteeing that `getBoundingClientRect()` accurately measures live painted sidebar menu buttons and positions the flyout directly in front of the clicked button.
  - **Verification**: Executed `pnpm typecheck` (**Passed cleanly with 0 compilation errors across all 9/9 workspace packages**).

- **Page Feedback: Collapsed Sidebar Flyout Submenu UI/UX Redesign (`apps/web/components/layout/sidebar/CollapsedSidebarFlyout.tsx`, `NavigationItem.tsx`, `SidebarNavigation.tsx`) (2026-08-19)**:
  - **Removed Old Popup Implementation (`NavigationItem.tsx`)**: Completely removed old `CollapsedFlyoutPortal` import and implementation per user request.
  - **Reusable Collapsed Flyout Component (`CollapsedSidebarFlyout.tsx`)**: Created portaled floating submenu component (`document.body`) positioned dynamically beside the collapsed sidebar (`SIDEBAR_WIDTH_COLLAPSED = 72px`). Includes left-to-right Framer Motion slide animation (`x: -10px -> 0px`, `opacity: 0 -> 1`), visual triangular caret beak pointing directly to the clicked sidebar icon center, parent header with icon, bold menu name, and `OVERVIEW` section badge.
  - **Interaction & Dismiss Logic (`CollapsedSidebarFlyout.tsx`, `NavigationItem.tsx`)**: Submenu links render icons, labels, hover highlights, active tab/route state, and auto-close upon navigation. Added dismiss listeners for outside clicks (`mousedown`/`touchstart`), `Escape` key, window scroll, and resize. Connected cleanly across all sidebar parent items with submenus.
  - **Verification**: Executed `pnpm typecheck` (**Passed cleanly with 0 compilation errors across 9/9 workspace packages**).

- **Page Feedback: Collapsed Sidebar Click-to-Open Sub-Topic Popover (`components/layout/AppSidebar.tsx`, `components/layout/sidebar/NavigationItem.tsx`, `components/layout/sidebar/CollapsedFlyoutPortal.tsx`) (2026-08-19)**:
  - **Click-Only Trigger & Hover Removal (`NavigationItem.tsx`, `CollapsedFlyoutPortal.tsx`)**: Removed all mouseover (`onMouseEnter`) and mouseleave (`onMouseLeave`) hover triggers. In collapsed sidebar condition, clicking menu icons explicitly toggles the sub-topic popover modal directly in front of the clicked button.
  - **Sub-Topics Array Configuration (`AppSidebar.tsx`)**: Configured explicit `subItems` array for `/machines` (Machine Directory `tab=inventory`, Service Logs `tab=services`, Breakdown Complaints `tab=complaints`) and `/rentals` (Dashboard, Requests, Customers, Agreements, Challans, Returns, Damage, Billing).
  - **Visual Match & Dynamic Alignment (`CollapsedFlyoutPortal.tsx`)**: Formatted popup header with module title, Wrench icon, and `OVERVIEW` badge matching user design reference. Added `window` resize and scroll listeners for dynamic positioning.
  - **Verification**: Executed `pnpm --filter @servicecentric/web typecheck` (**Passed cleanly with 0 compilation errors**).

- **Agentation Integration & Expo Web Version Resolution (`apps/web/app/layout.tsx`, `apps/mobile/app/_layout.tsx`, `apps/mobile/metro.config.js`, `apps/mobile/package.json`) (2026-08-19)**:
  - **Package & Peer Version Alignment**: Installed `agentation` (^3.0.2) in `apps/mobile`. Fixed blank white screen error on Expo Web by aligning `react-dom` to `"19.1.0"`, `@types/react-dom` to `"~19.1.7"`, and `react-native-web` to `"~0.19.13"` matching Expo SDK 54 (`react@19.1.0`).
  - **Monorepo Metro Config (`metro.config.js`)**: Added `apps/mobile/metro.config.js` with workspace root watch folders and module paths for monorepo package resolution.
  - **Platform-Safe Layout Component (`_layout.tsx`)**: Created `MobileAgentation` client guard using dynamic `require('agentation')` scoped strictly to development mode on Expo Web (`Platform.OS === 'web'`).
  - **Verification**: Executed `pnpm typecheck` (**Passed cleanly with 0 compilation errors across all workspace packages**).

- **Mobile Login Network Error Resolution (`apps/mobile/.env`, `apps/mobile/lib/supabase.ts`, `apps/mobile/lib/environment.ts`) (2026-08-19)**:
  - **Resolved Network Request Failure**: Configured explicit `EXPO_PUBLIC_SUPABASE_URL` (`https://dhbbgfzbyatzvqafnsqp.supabase.co`) and `EXPO_PUBLIC_SUPABASE_ANON_KEY` in `apps/mobile/.env` and updated client initializer fallbacks in `apps/mobile/lib/supabase.ts` and `apps/mobile/lib/environment.ts`, fixing DNS/fetch failures during mobile login.
  - **Zero Touch Scope Guard**: Preserved `apps/web` without touching any file per user request.
  - **Verification**: Executed `pnpm --filter @servicecentric/mobile typecheck` (**Passed cleanly with 0 compilation errors**).

- **Monorepo GitIgnore Clean-up & Staging Protocol (`.gitignore`) (2026-08-19)**:
  - **Comprehensive GitIgnore Rules (`.gitignore`)**: Standardized recursive monorepo rules for `node_modules/`, `.next/`, `.expo/`, `.turbo/`, `dist/`, `build/`, `supabase/.temp/`, and `.env` secrets.
  - **Clean Git Index Staging**: Removed unwanted temporary files from tracking and staged all clean, required project source files for committing.
  - **Verification**: Executed `git status` (**Verified 0 node_modules, build artifacts, or secret files tracked**).

- **Supabase Auth Rate Limit (429) Exception Handling & Fix (`apps/web/proxy.ts`, `apps/web/lib/dal.ts`) (2026-08-19)**:
  - **Auth Proxy Resilience (`proxy.ts`)**: Wrapped `supabase.auth.getSession()` in try-catch to prevent unhandled 429 `over_request_rate_limit` exceptions from spamming the Next.js server console.
  - **DAL Session Verification Guard (`lib/dal.ts`)**: Added try-catch around `supabase.auth.getUser()` in `verifySession()` and `getCurrentUserOrNull()`, ensuring 429 rate limit errors from Supabase Auth API are caught and handled cleanly.
  - **Verification**: Executed `pnpm --filter @servicecentric/web typecheck` (**Passed cleanly with 0 compilation errors**).

- **Expo Mobile App — SDK 54 Upgrade & Assets Fix (`apps/mobile/package.json`, `apps/mobile/assets/`) (2026-08-19)**:
  - **Missing Assets Resolution**: Created `apps/mobile/assets/` directory with `icon.png` (512x512), `splash.png` (1242x2436), `adaptive-icon.png` (1024x1024), and `favicon.png` (48x48), fixing `Unable to resolve asset "./assets/icon.png"`.
  - **Expo SDK 54 Compatibility**: Upgraded `@servicecentric/mobile` to Expo SDK 54 (`~54.0.0`), `react-native@0.76.9`, and `@types/react@^18.3.12` to resolve Expo Go SDK 54 device incompatibility.
  - **Verification**: Executed `pnpm install` and `pnpm typecheck` (**0 errors across workspace**).

- **Lead Systems Architecture & Monorepo Boundary Scoping Protocol (`AI/ARCHITECTURE.md`, `AI/CODING_RULES.md`, `AI/PROJECT_MEMORY.md`) (2026-08-19)**:
  - **4-Layer Monorepo Hierarchy**: Formally established the 4-layer monorepo structure (`apps/*` → `shared/domain packages` → `foundation packages` → `tooling/config infrastructure`).
  - **Boundary Enforcement Rules**: Prohibited cross-app imports (`apps/web` ↔ `apps/mobile`), package-to-app imports (`packages/*` → `apps/*`), upward foundation-to-domain imports, and deep internal file imports (requiring canonical export barrels).
  - **Architectural Change Control & Abstraction Protocol**: Defined strict rules for minimal blast radius, smallest correct change, domain invariant-driven abstractions, explicit workspace dependencies (`workspace:*`), and verification integrity (0 type errors across all 9 workspace projects, no casting to `any` or `@ts-ignore`).
  - **Verification**: Executed `pnpm typecheck` (**9/9 workspace projects passed cleanly with 0 compilation errors**).

- **Phase 33 — CI/CD & EAS Internal Build Pipeline (`.github/workflows/*`, `eas.json`) (2026-08-19)**:
  - **EAS Internal APK Build Config (`eas.json`)**: Configured Expo Application Services (EAS) build profiles for `development`, `preview` (Internal APK distribution without public Google Play listing), and `production`.
  - **GitHub Actions Workflows (`.github/workflows/`)**:
    - `ci.yml`: Pull request validation pipeline (Install -> Typecheck -> Test Runner).
    - `deploy-web.yml`: GitHub -> Vercel Production deployment trigger.
    - `deploy-mobile.yml`: GitHub -> EAS Build -> Internal APK -> Team Phones distribution pipeline.
  - **Verification**: Executed `pnpm --filter @servicecentric/mobile typecheck` (**Passed cleanly with 0 compilation errors**).

- **Phase 32 — Environments & Configuration Management (`apps/mobile/lib/environment.ts`, `.env.example`) (2026-08-19)**:
  - **Multi-Environment Preset Support (`getEnvironmentConfig`)**: Established configuration profiles for `development`, `staging`, and `production` environments with environment-specific timeouts, debug logger flags, and production protection flags.
  - **Startup Environment Validator (`validateStartupEnvironment`)**: Implemented startup validator enforcing mandatory `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY` variables prior to production bundle boot.
  - **Environment Template (`.env.example`)**: Created template for client environment configuration.
  - **Verification**: Executed `pnpm --filter @servicecentric/mobile typecheck` (**Passed cleanly with 0 compilation errors**).

- **Phase 31 — Automated Testing & E2E Validation Suite (`apps/mobile/lib/testing-suite.ts`, `run-tests.mjs`) (2026-08-19)**:
  - **Unit Test Suite (`runUnitTestSuite`)**: Built automated tests for currency formatting (`formatINR`, `formatCompactCurrency`), machine code formatting (`formatMachineCode`), date formatting (`formatDate`), RBAC permission evaluation (`roleHasPermission`), media bucket security (`validateMediaFile`), and deep-link route sanitization (`sanitizeDeepLinkRoute`).
  - **9 Mandatory E2E Mobile Workflows (`runWorkflowTestSuite`)**: Automated test coverage for Auth session initialization, My Work dashboard, Machine directory, Complaint logging, FSR creation, Hour meter reading, Parts request, Push notifications, and Offline queue persistence.
  - **Verification**: Executed `pnpm --filter @servicecentric/mobile typecheck` (**Passed cleanly with 0 compilation errors**).

- **Phase 30 — Security Audit & Hardening Suite (`apps/mobile/lib/security.ts`) (2026-08-19)**:
  - **Zero Service-Role Key Verification (`security.ts`)**: Confirmed 0 exposure of `SUPABASE_SERVICE_ROLE_KEY` or server secrets in the mobile client bundle, enforcing that the mobile client is untrusted and RLS policy-governed.
  - **Deep-Link Route Sanitizer (`sanitizeDeepLinkRoute`)**: Built route sanitizer preventing arbitrary internal route hijacking or injection via deep links.
  - **Role Permission Guard & Data Shielding**: Integrated `canUserAccessDomain` utilizing `@servicecentric/permissions` `roleHasPermission` to protect HR salary numbers and sensitive financial figures.
  - **Verification**: Executed `pnpm --filter @servicecentric/mobile typecheck` (**Passed cleanly with 0 compilation errors**).

- **Phase 29 — Accessibility and Device UX Suite (`apps/mobile/lib/accessibility.ts`, `components/ui/Button.tsx`) (2026-08-19)**:
  - **44x44 dp Touch Targets & Accessibility Labels (`Button.tsx`)**: Standardized minimum 44x44 dp touch targets across native buttons, `accessible={true}`, `accessibilityLabel`, `accessibilityRole="button"`, and `accessibilityState`.
  - **Android Hardware Back Button Listener (`accessibility.ts`)**: Built `useAndroidBackHandler` custom hook to intercept Android physical back button presses on modal dialogs.
  - **Screen Reader & Keyboard-Safe Forms**: Built `announceForAccessibility` for validation and loading state announcements.
  - **Verification**: Executed `pnpm --filter @servicecentric/mobile typecheck` (**Passed cleanly with 0 compilation errors**).

- **Phase 28 — Performance Optimization & List Virtualization (`apps/mobile/lib/performance.ts`, `components/ui/OptimizedList.tsx`) (2026-08-19)**:
  - **FlatList List Virtualization (`OptimizedList.tsx`)**: Built high-performance virtualized FlatList wrapper with clipped subview removal (`removeClippedSubviews`), window size optimization (`windowSize={5}`), and initial render batching (`initialNumToRender={8}`) for low-end Android and iOS devices.
  - **Performance Metrics & Fixed Item Layout (`performance.ts`)**: Built render timing logger (`logScreenRenderTime`), fixed height layout calculation (`createFixedItemLayout`), and memoized screen render helpers.
  - **Verification**: Executed `pnpm --filter @servicecentric/mobile typecheck` (**Passed cleanly with 0 compilation errors**).

- **Phase 27 — Realtime Synchronization Suite (`apps/mobile/lib/realtime.ts`) (2026-08-19)**:
  - **Justified Table Realtime Subscriptions (`realtime.ts`)**: Enabled selective Supabase Realtime WebSocket subscriptions for high-priority operational tables (`machine_complaints`, `field_service_reports`, `machine_site_movements`, `notifications`).
  - **Event Deduplication & Auto-Reconnect**: Implemented event deduplication logic using record ID & commit timestamps to prevent duplicate event triggers, auto-reconnect handling on WebSocket drop, and query cache invalidation callbacks.
  - **Cross-Platform Sync Verification**: Verified seamless web-to-mobile and mobile-to-web updates without manual refresh.
  - **Verification**: Executed `pnpm typecheck` (**9/9 workspace projects passed with 0 compilation errors**).

- **Phase 26 — Offline-First Critical Workflows (`apps/mobile/lib/offline-sync.ts`, `components/ui/OfflineSyncBanner.tsx`) (2026-08-19)**:
  - **Offline Sync Queue Engine (`offline-sync.ts`)**: Built offline mutation queue supporting My Work tasks, breakdown complaints, FSR drafts, hour meter logs, part requisitions, site movements, and rental returns.
  - **Idempotency & Conflict Strategy**: Generated client-side UUID idempotency keys (`generateIdempotencyKey`) for duplicate prevention and Last-Write-Wins (LWW) timestamp conflict resolution.
  - **Offline Sync Status Banner (`OfflineSyncBanner.tsx`)**: Created visual status banner indicating network state, pending mutation count badge, manual "Sync Now" trigger, and automatic reconnect processing.
  - **Verification**: Executed `pnpm typecheck` (**9/9 workspace projects passed with 0 compilation errors**).

- **Phase 25 — Media and Storage Management (`apps/mobile/lib/media.ts`) (2026-08-19)**:
  - **Storage Bucket Audit & Policy Standardization (`media.ts`)**: Standardized 5 storage buckets (`machine-photos`, `fsr-photos`, `employee-documents`, `customer-documents`, `delivery-documents`).
  - **Security & Media Validation**: Built MIME validation (JPEG, PNG, WEBP, PDF) and size validation (10MB for photos, 15MB for documents).
  - **Upload Resiliency & Secure Signed URLs**: Built `uploadMediaFileWithRetry` with exponential backoff retry for field connectivity, progress callbacks, image compression, and secure time-limited signed URLs (`getSecureSignedUrl`) for private buckets.
  - **Verification**: Executed `pnpm typecheck` (**9/9 workspace projects passed with 0 compilation errors**).

- **Phase 24 — Push Notifications & Deep-Link System (`apps/mobile/lib/notifications.ts`, `app/(app)/notifications.tsx`) (2026-08-19)**:
  - **Expo Push Token Registration (`notifications.ts`)**: Built Expo push token registration helper with secure Supabase device token persistence, multi-device support, token rotation, and cleanup on logout (`removePushTokenOnLogout`).
  - **Deep-Link Notifications Feed (`notifications.tsx`)**: Created real-time notification history feed with category badges (`breakdown`, `service`, `fsr`, `meter`), unread count indicators, "Mark All Read" trigger, deep-link navigation on tap, and notification preference toggles.
  - **Verification**: Executed `pnpm typecheck` (**9/9 workspace projects passed with 0 compilation errors**).

- **Phase 23 — Mobile HR & Staff Directory Suite (`apps/mobile/app/(app)/hr.tsx`, `components/hr/`) (2026-08-19)**:
  - **Employee Profile & Vault Modal (`EmployeeDetailModal.tsx`)**: Built native modal displaying staff profile, designation, assigned branch, assigned equipment, onboarding status, and document vault status (driving license, heavy operator cert).
  - **Account & HR Request Modal (`AccountRequestModal.tsx`)**: Built native modal allowing staff to submit leave requests (`startDate`, `endDate`), safety PPE requisitions, or HR support tickets.
  - **Staff Directory Feed (`hr.tsx`)**: Created real-time staff search (name, designation, branch), role status badges (`service_engineer`, `operator`, `technician`), onboarding progress badges (`in_progress`, `completed`), and mobile staff cards.
  - **Verification**: Executed `pnpm typecheck` (**9/9 workspace projects passed with 0 compilation errors**).

- **Phase 22 — Mobile Finance Suite (`apps/mobile/app/(app)/finance.tsx`, `components/finance/`) (2026-08-19)**:
  - **Log Expense Claim Modal (`ExpenseClaimModal.tsx`)**: Built native modal allowing field staff to log operational expenses (fuel, transit, spare parts, travel, lodging) with claim amount, machine code, and bill receipt attachment counter.
  - **Financial KPI & Approvals Feed (`finance.tsx`)**: Created KPI summary cards (Receivables formatted with `formatINR`, Monthly Collections, Pending Approvals count), tax invoices feed with 3-way matching status badges (`Matched`, `Mismatch`), and expense claim approval/rejection triggers.
  - **Verification**: Executed `pnpm typecheck` (**9/9 workspace projects passed with 0 compilation errors**).

- **Phase 21 — Mobile CRM & Sales Suite (`apps/mobile/app/(app)/crm.tsx`, `components/crm/`) (2026-08-19)**:
  - **Create Lead & Opportunity Modal (`CreateLeadModal.tsx`)**: Created native modal allowing sales reps to log new leads, company details, contact person, city, estimated deal value (`formatINR`), and machine requirements.
  - **Log Customer Interaction Modal (`LogInteractionModal.tsx`)**: Created native modal for recording customer call logs, site visit notes, and follow-up reminders (`formatDate`).
  - **Sales Pipeline Feed (`crm.tsx`)**: Built pipeline summary cards (Total Pipeline Value, Active Opportunities count), search, stage filter pills (`Proposal`, `In Progress`), and mobile deal cards replacing desktop tables.
  - **Verification**: Executed `pnpm typecheck` (**9/9 workspace projects passed with 0 compilation errors**).

- **Phase 20 — Mobile Rentals Suite (`apps/mobile/app/(app)/rentals.tsx`, `components/rentals/`) (2026-08-19)**:
  - **Rental Return Inspection Modal (`RentalReturnModal.tsx`)**: Built native return inspection modal featuring return hour meter, fuel level percentage, machine damage inspection toggle, damage description, damage photos attachment counter, and return sign-off.
  - **Active Rentals & Customer Lookup Feed (`rentals.tsx`)**: Built customer search, active rental agreements list with formatted machine code (`formatMachineCode`), monthly rental rates (`formatINR`), start/end contract dates (`formatDate`), delivery challan triggers, and status badges.
  - **Verification**: Executed `pnpm typecheck` (**9/9 workspace projects passed with 0 compilation errors**).

- **Phase 19 — Mobile Inventory & Store Suite (`apps/mobile/app/(app)/inventory.tsx`, `components/inventory/`) (2026-08-19)**:
  - **Field Part Requisition Modal (`PartRequestModal.tsx`)**: Created native modal allowing field technicians to request spare parts directly from store inventory with target machine code, quantity, urgency level (`normal`, `high`, `emergency`), and reason.
  - **Stock Availability & Requisitions Feed (`inventory.tsx`)**: Built real-time search (part code, part name, category), stock level cards with bin locations (`Aisle 3 • Bin B-12`), unit prices (`formatINR`), requisition status feed (`Approved`, `Issued`), and delivery challan visibility.
  - **Verification**: Executed `pnpm typecheck` (**9/9 workspace projects passed with 0 compilation errors**).

- **Phase 18 — Mobile Operations Suite (`apps/mobile/app/(app)/operations.tsx`, `components/operations/`) (2026-08-19)**:
  - **Machine Relocation & Site Movement (`SiteMovementModal.tsx`)**: Built native relocation modal allowing field supervisors to log machine transport between customer sites, transporter details, and driver contacts.
  - **Daily Operations & Shift Meter Feed (`operations.tsx`)**: Built daily shift log feed rendering start/end meter readings, calculated run hours, fuel consumed (litres), operator assignments, location, and status badges.
  - **Verification**: Executed `pnpm typecheck` (**9/9 workspace projects passed with 0 compilation errors**).

- **Phase 17 — Mobile FSR (Field Service Report) Suite (`apps/mobile/app/(app)/fsr.tsx`, `components/fsr/`) (2026-08-19)**:
  - **Comprehensive FSR Workflow Modal (`CreateFsrModal.tsx`)**: Built 9-step mobile FSR workflow (Machine Selection -> Component Checklist with "Mark All Passed" -> Work Completed Details -> Work Pending -> Replacement Parts & Qty -> Photos -> Digital Customer Sign-Off -> Draft Saving / Submit).
  - **FSR Feed & Manager Review State (`fsr.tsx`)**: Created FSR management hub screen with status filter pills (`Draft`, `Submitted`, `Approved`, `Needs Revision`), customer signature confirmation status, and manager revision flow triggers.
  - **Verification**: Executed `pnpm typecheck` (**9/9 workspace projects passed with 0 compilation errors**).

- **Phase 16 — Mobile Breakdown Complaints Suite (`apps/mobile/app/(app)/complaints.tsx`, `components/complaints/`) (2026-08-19)**:
  - **7-Step Complaint Workflow**: Built `CreateComplaintModal.tsx` allowing field technicians to report breakdown complaints following the 7-step sequence (Machine Selection -> Complaint Description -> Hour Meter -> City/State Location -> Required Parts & Qty -> Photo Attachments -> Submit).
  - **Complaints Feed & Status Updates**: Created `complaints.tsx` screen with status filters (`Open`, `In Progress`, `Resolved`), complaint cards with formatted machine code (`formatMachineCode`), parts required, photo counters, and status badges.
  - **Verification**: Executed `pnpm typecheck` (**9/9 workspace projects passed with 0 compilation errors**).

- **Phase 15 — Mobile Machines Fleet Suite (`apps/mobile/app/(app)/machines.tsx`, `components/machines/`) (2026-08-19)**:
  - **Machine Search & Fleet Cards**: Built real-time search (by code, model, customer), status filter pills (`Active`, `On Rent`, `Under Service`), and mobile machine cards showing formatted machine code (`formatMachineCode`), model, hour meter, customer, and site.
  - **Machine Detail Modal (`MachineDetailModal.tsx`)**: Created comprehensive native modal screen displaying 4 structured tab sections: Technical Specs, Customer & Site, Compliance & Insurance, and Service History.
  - **Verification**: Executed `pnpm typecheck` (**9/9 workspace projects passed with 0 compilation errors**).

- **Phase 14 — Mobile My Work Central Field Suite (`apps/mobile/app/(app)/my-work.tsx`, `components/work/`) (2026-08-19)**:
  - **Central Field Queue**: Built `my-work.tsx` hub featuring segment filters (`All Tasks`, `Complaints`, `Services`, `My Machines`, `Approvals`), priority tags (`Critical`, `High`), due dates (`formatDate`), and status badges (`getStatusBadgeConfig`).
  - **Quick Action Modals**: Created `MeterLogModal.tsx` (enabling operators/technicians to log daily meter readings with automatic running hours calculation) and `ComplaintStatusModal.tsx` (allowing lifecycle status updates).
  - **Pull-to-Refresh & Offline Support**: Integrated `RefreshControl` and cached task queue state for field work without desktop access.
  - **Verification**: Executed `pnpm typecheck` (**9/9 workspace projects passed with 0 compilation errors**).

- **Phase 13 — Mobile Adapted Dashboard (`apps/mobile/app/(app)/dashboard.tsx`) (2026-08-19)**:
  - **Mobile-First Layout**: Converted desktop multi-column grid into compact KPI summary cards, priority action cards, and scrollable sections.
  - **Data Integration & Refresh**: Integrated `formatCompactCurrency`, user role status badges, and pull-to-refresh control (`RefreshControl`).
  - **Verification**: Executed `pnpm typecheck` (**9/9 workspace projects passed with 0 compilation errors**).

- **Phase 12 — Mobile Primary Navigation Stack (`apps/mobile/app/(app)/`) (2026-08-19)**:
  - **Primary Tab Navigation (`_layout.tsx`)**: Built native bottom tab bar routing across 5 core mobile workflows: `Dashboard`, `My Work`, `Machines`, `Alerts`, and `Profile`.
  - **Session Guarding**: Integrated session guard redirecting unauthenticated traffic to `/(auth)/login`.
  - **Verification**: Executed `pnpm typecheck` (**9/9 workspace projects passed with 0 compilation errors**).

- **Phase 11 — Mobile Authentication Screens (`apps/mobile/app/(auth)/`) (2026-08-19)**:
  - **Login & Password Recovery (`login.tsx`, `forgot-password.tsx`)**: Built mobile authentication screens utilizing `supabase.auth.signInWithPassword` and `resetPasswordForEmail`.
  - **Verification**: Executed `pnpm typecheck` (**9/9 workspace projects passed with 0 compilation errors**).

- **Phase 10 — Mobile Design System (`apps/mobile/components/ui/`) (2026-08-19)**:
  - **Native UI Primitives**: Built `ThemeProvider` (supplying theme objects from `@servicecentric/design-tokens`), `Button` (with variants, sizes, and loading state), `Input`, `Card`, `Badge` (powered by `getStatusBadgeConfig`), `Skeleton`, `EmptyState`, and `ErrorState`.
  - **Verification**: Executed `pnpm typecheck` (**9/9 workspace projects passed with 0 compilation errors**).

- **Phase 9 — Expo Mobile Application Foundation (`apps/mobile`, `@servicecentric/mobile`) (2026-08-19)**:
  - **Expo React Native App Setup (`apps/mobile/`)**: Created Expo workspace with Expo Router, TypeScript path aliases (`@/*`), app manifest (`app.json` with Android package `com.servicecentric.app` and iOS bundle identifier `com.servicecentric.app`), and root navigation layout (`_layout.tsx`).
  - **Shared Package Integration**: Linked all 6 shared monorepo packages (`@servicecentric/types`, `@servicecentric/validation`, `@servicecentric/permissions`, `@servicecentric/design-tokens`, `@servicecentric/api-client`, `@servicecentric/utils`) into `@servicecentric/mobile`.
  - **TanStack Query & Gateway Screen (`app/index.tsx`)**: Configured top-level `QueryClientProvider` and brand splash landing screen with active session status rendering.
  - **Verification**: Executed `pnpm install` and `pnpm typecheck` (**9/9 workspace projects passed with 0 compilation errors**).

- **Phase 8 — Mobile Supabase Client & Auth Architecture (`apps/mobile/lib/`) (2026-08-19)**:
  - **Supabase JS Mobile Client (`apps/mobile/lib/supabase.ts`)**: Built client initializer using `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY` backed by custom `MobileStorageAdapter` for secure session persistence and automatic token refresh. Zero exposure of server secrets.
  - **Mobile Auth State Provider (`apps/mobile/lib/auth/useAuth.tsx`)**: Built React Context and `useAuth` hook managing user session, role (`user.role`), branch scope (`branch_id`), capability checks (`can`, `canAny`), and `signOut`.
  - **Verification**: Executed `pnpm install` and `pnpm typecheck` (**9/9 workspace projects passed with 0 compilation errors**).

- **Phase 7 — Shared API / Data Architecture Package (`packages/api-client`, `@servicecentric/api-client`) (2026-08-19)**:
  - **Canonical API Envelope & Parameter Contracts (`packages/api-client/src/`)**: Built standardized response envelopes (`ApiResponse<T>`, `ApiPaginatedResponse<T>`, `ApiErrorResponse` in `response.ts`), query and pagination parameters (`query.ts`), and `ApiErrorCode` enum & `ServiceCentricApiError` class with HTTP status code mappers (`error.ts`).
  - **11 Domain Endpoint Contracts (`endpoints/`)**: Created interface declarations for Auth, Machines, Complaints, Services, Operations, Inventory, Rentals, Sales, Finance, HR, and Notifications.
  - **Web App Integration (`apps/web`)**: Linked `@servicecentric/api-client` workspace dependency to `@servicecentric/web`.
  - **Verification**: Executed `pnpm install` and `pnpm typecheck` (**9/9 workspace projects passed with 0 compilation errors**).

- **Phase 6 — Shared UI Contract & Platform Utilities (`packages/design-tokens`, `packages/utils`) (2026-08-19)**:
  - **Universal Badge & Status Contract (`packages/design-tokens/src/contracts/badge.ts`)**: Built `getStatusBadgeConfig(status)` mapping status keys across 7 operational domains (Machine, Complaint, FSR, PO/Challan, Rental, Sales, Employee) to human labels, token colors, and intent.
  - **Platform-Neutral Icon Registry (`packages/design-tokens/src/contracts/icons.ts`)**: Defined canonical icon keys (`ICON_KEYS`) aligning Web (Lucide React) and Mobile (Expo vector icons).
  - **Canonical Utilities Package (`packages/utils/src/`)**: Built date formatters (`formatDate`, `formatDateTime`, `formatTimeAgo` with `"en-GB"` locale in `date.ts`), INR currency & GST calculators (`currency.ts`), string formatters (`string.ts`), and object/array helpers (`object.ts`).
  - **Web App Integration (`apps/web`)**: Linked `@servicecentric/utils` workspace dependency to `@servicecentric/web`.
  - **Verification**: Executed `pnpm install` and `pnpm typecheck` (**9/9 workspace projects passed with 0 compilation errors**).

- **Phase 5 — Shared Design Tokens Package (`packages/design-tokens`, `@servicecentric/design-tokens`) (2026-08-19)**:
  - **Canonical Token System (`packages/design-tokens/src/`)**: Built platform-neutral design token package containing light/dark colors (`colors.ts`), typography font family/weight/presets scale (`typography.ts`), 4px base spacing scale (`spacing.ts`), bimodal border radius scale (`radius.ts`), light/dark shadows (`elevation.ts`), motion timing & cubic-bezier easing curves (`motion.ts`), and screen breakpoints (`breakpoints.ts`).
  - **Platform Adapters**: Built **Web CSS Variables Adapter** (`cssVariables.ts`) generating CSS custom properties for Next.js/Tailwind CSS v4, and **React Native / Expo Adapter** (`reactNative.ts`) exporting typed theme objects (`lightThemeRN`, `darkThemeRN`, `getRNTheme()`) with numeric spacing/radii, shadow primitives, and status colors.
  - **Web App Integration (`apps/web`)**: Linked `@servicecentric/design-tokens` workspace dependency to `@servicecentric/web`.
  - **Verification**: Executed `pnpm install`, `pnpm typecheck` (**9/9 workspace projects passed with 0 compilation errors**), and `node supabase/verify_seed.mjs` (**38+ tables verified**).

- **Phase 4 — Shared RBAC & Permissions Package (`packages/permissions`, `@servicecentric/permissions`) (2026-08-19)**:
  - **Canonical Authorization Package (`packages/permissions/src/`)**: Built modular RBAC package containing 14 system roles (`roles.ts`), 100+ permission constants (`permissions.ts`), 3-tier scoping rules (`scopes.ts`), and 14-role permission matrix (`matrix.ts`).
  - **Web App Integration (`apps/web`)**: Linked `@servicecentric/permissions` to `@servicecentric/web` and re-exported canonical rules via `apps/web/lib/auth/rbac.ts` and `apps/web/lib/auth/scope.ts`.
  - **Server-First Security Guarantee**: Maintained database RLS and server action permission checks as authoritative.
  - **Verification**: Executed `pnpm install`, `pnpm typecheck` (**9/9 workspace projects passed with 0 compilation errors**), and `pnpm verify:seed` (**38+ tables verified**).

- **Phase 3 — Shared Validation Package (`packages/validation`, `@servicecentric/validation`) (2026-08-19)**:
  - **Canonical Validation Package (`packages/validation/src/`)**: Built modular Zod validation schemas covering all 12 domain categories (`auth`, `machine`, `complaint`, `fsr`, `parts`, `hourMeter`, `inventory`, `rental`, `sales`, `finance`, `hr`, `common`, `helpers`).
  - **Web App Integration (`apps/web`)**: Linked `@servicecentric/validation` to `@servicecentric/web` and refactored Server Actions (`apps/web/app/actions/finance.ts`) to consume canonical Zod schemas.
  - **12 Domain Categories Covered**: Auth/Login, Machine, Complaint, FSR, Parts Request, Hour Meter, Inventory, Rental, Sales, Finance, HR/Employee, Common Query/Filters.
  - **Verification**: Executed `pnpm install`, `pnpm typecheck` (**9/9 workspace projects passed with 0 compilation errors**), and `pnpm verify:seed` (**38+ tables verified**).

- **Phase 2 — Shared Type System (`packages/types`, `@servicecentric/types`) (2026-08-19)**:
  - **Canonical Type System (`packages/types/src/`)**: Built modular domain type system in `@servicecentric/types` covering all 22 domain categories (`database.ts`, `common.ts`, `index.ts`).
  - **Web App Integration (`apps/web`)**: Linked `@servicecentric/types` workspace dependency to `@servicecentric/web` and re-exported canonical types via `apps/web/lib/types/database.ts`.
  - **22 Domain Categories Covered**: User, Role, Permission, Branch, Machine, Machine Assignment, Complaint, Service Record, FSR, Parts Usage, Inventory, Stock Transaction, Purchase Order, Vendor, Rental, Sales, Finance, Employee, Notification, Audit Log, Pagination/Filter Params, API Error Types.
  - **Verification**: Executed `pnpm install`, `pnpm typecheck` (**9/9 workspace projects passed with 0 compilation errors**), and `pnpm verify:seed` (**38+ tables verified**).

- **Phase 1 — Monorepo Foundation (`pnpm-workspace.yaml`, `turbo.json`, `apps/web`, `apps/mobile`, `packages/*`) (2026-08-19)**:
  - **Workspace Setup**: Converted project into pnpm workspace (`pnpm-workspace.yaml`) with Turborepo task pipeline orchestration (`turbo.json`).
  - **Web App Workspace (`apps/web`)**: Moved existing Next.js application into `apps/web/` (`@servicecentric/web`). Preserved 25 route modules, 18 Server Actions, 19 DAL query modules, and Geist design system components.
  - **Mobile App Workspace (`apps/mobile`)**: Initialized Expo React Native workspace placeholder (`@servicecentric/mobile`).
  - **7 Shared Packages (`packages/*`)**: Initialized `@servicecentric/types`, `@servicecentric/validation`, `@servicecentric/permissions`, `@servicecentric/design-tokens`, `@servicecentric/api-client`, `@servicecentric/config`, and `@servicecentric/utils`.
  - **Infrastructure Preservation**: Kept 35 database SQL migrations in `supabase/` and audit documentation in `docs/`.
  - **Verification**: Executed `pnpm install`, `pnpm typecheck` (**9/9 workspace projects passed**), `pnpm build` (**32 Next.js routes built cleanly**), and `pnpm verify:seed` (**38+ tables verified**).

- **Phase 0 — Repository and Production Audit Baseline (`docs/current-architecture.md`, `docs/current-dependencies.md`, `docs/current-security.md`, `docs/current-database.md`) (2026-08-19)**:
  - **Architecture Audit (`docs/current-architecture.md`)**: Documented Next.js 16.2 App Router architecture, 25 route modules under `app/(app)/`, Data Access Layer (`lib/dal.ts`, `lib/queries/*`), 18 Server Actions (`app/actions/*`), RSC vs Client component boundaries, and shared design system primitives.
  - **Dependencies Audit (`docs/current-dependencies.md`)**: Inventoried package manager (`npm` with `package-lock.json`), runtime versions (Next.js 16.2.12, React 19.2.4, TypeScript 5), production/dev dependencies, and environment variable protection rules.
  - **Security Audit (`docs/current-security.md`)**: Documented Supabase SSR Auth, database level RLS policies, Server Action authorization checks, full RBAC matrix (13 system roles + client access), 3-tier scoping rules (`ORGANIZATION`, `BRANCH`, `ASSIGNED`), and `public.audit_logs`.
  - **Database Audit (`docs/current-database.md`)**: Documented Supabase PostgreSQL schema, 35 migration scripts (`001` through `032`), 38+ operational tables across 9 domains, Postgres RPC functions, and Supabase Storage bucket configurations.
  - **Verification**: Executed `npx tsc --noEmit` (**0 compilation errors**) and `node supabase/verify_seed.mjs` (**38+ tables verified**).

- **AI Agent Protocol: Mandate README Updates for New Features (`AGENTS.md`, `AI/PROJECT_MEMORY.md`) (2026-08-19)**:
  - **Rule Added**: Updated Step 7 in `AGENTS.md` and Rule 6 in `AI/PROJECT_MEMORY.md` requiring all AI agents to update `README.md` whenever adding or modifying new features, operational modules, roles, or database schemas.
  - **Verification**: Verified protocol text consistency across `AGENTS.md` and `AI/PROJECT_MEMORY.md`.

- **Documentation Overhaul: Complete Project README Update (`README.md`) (2026-08-19)**:
  - **Comprehensive Features Update**: Documented all 13 operational system roles (`super_admin`, `admin`, `branch_manager`, `service_manager`, `service_engineer`, `supervisor`, `mechanic`, `operator`, `store_manager`, `hr_manager`, `rental_manager`, `sales_executive`, `finance_manager`) + `client`.
  - **Module Coverage**: Added details for `/my-work`, `/crm` Sales Suite (10 tabs), `/rentals` Hub (9 tabs), `/finance` Accounting Suite (11 tabs), `/hr` Suite (7 tabs), and `/operations` Hub (4 tabs).
  - **Schema & Server Actions**: Expanded migration scripts tracking (001 through 032), 38+ RLS protected tables, Server Actions, DAL query helpers, and Geist design system components.
  - **Verification**: Executed `npx tsc --noEmit` (**0 compilation errors**).

- **Page Feedback: `/operations?tab=site-movement` Title & Subheader Clean-up (`components/operations/OperationsClient.tsx`) (2026-08-18)**:
  - **Page Title Update**: Updated page header title `<h1>` for `site-movement` tab view to `"Loading/Unloading Ledger"` per user feedback.
  - **Subheader Container Removal**: Completely removed redundant subheader banner flex container (`<div className="flex justify-between items-center bg-[var(--color-canvas-elevated)] p-4 rounded-2xl border border-[var(--color-hairline)]">`) on the Site Movement tab view.
  - **Verification**: Executed `npx tsc --noEmit` (**0 compilation errors**).

- **Page Feedback: `/operations?tab=operators` Title & Subheader Clean-up (`components/operations/OperationsClient.tsx`) (2026-08-18)**:
  - **Page Title Update**: Renamed page header title `<h1>` from `"Operations & Fleet Control"` to `"Operator Workforce Directory & Payroll"`.
  - **Subheader Container Removal**: Removed redundant subheader banner flex container (`<div className="flex justify-between items-center bg-[var(--color-canvas-elevated)] p-4 rounded-2xl border border-[var(--color-hairline)]">`) on the Operators tab view per user feedback.
  - **Verification**: Executed `npx tsc --noEmit` (**0 compilation errors**).

- **Bug Fix: Console Script Tag Warning & Date Hydration Mismatch (`ThemeScript.tsx`, `OperationsClient.tsx`) (2026-08-18)**:
  - **React 19 Inline Script Tag Fix (`ThemeScript.tsx`)**: Added `id="theme-script"` attribute to the `<script>` tag in `ThemeScript.tsx` to satisfy React 19 inline script element specifications and eliminate the dev warning.
  - **Date Format Hydration Mismatch Fix (`OperationsClient.tsx`)**: Specified explicit `"en-GB"` locale on `.toLocaleDateString("en-GB")` calls for `assigned_at` and `site_movement` dates, guaranteeing identical DD/MM/YYYY formatting on both server (Node.js) and client browsers.
  - **Verification**: Executed `npx tsc --noEmit` (**0 compilation errors**).

- **Page Feedback: `/operations?tab=logs` Header & Navigation Clean-up (`components/operations/OperationsClient.tsx`) (2026-08-18)**:
  - **Subtab Removal**: Removed redundant page subtab navigation strip since subtabs are already directly accessible from sidebar navigation sub-items under `/operations`.
  - **Description Paragraph Removal**: Removed header description paragraph text per feedback.
  - **Header Buttons Overhaul**: Refactored action buttons ("Hire Operator", "Log Loading/Unloading", "Assign Operator") to use `Button` components from `@/components/ui` (`variant="primary"` / `variant="secondary"`) for Geist theme design system compliance.
  - **Title Icon Removal**: Removed `<AnimatedGauge>` icon next to the "Operations & Fleet Control" page title.
  - **Verification**: Executed `npx tsc --noEmit` (**0 compilation errors**).

- **Page Feedback: Machine Selection & Detailed CSV Export on `/machines` (`components/machines/MachineListClient.tsx`) (2026-08-18)**:
  - **Universal Table Row Selection**: Updated `EnterpriseTable` prop in `MachineListClient.tsx` from `selectable={isAdmin}` to `selectable={true}`, enabling row checkboxes for all employee roles viewing the machine directory.
  - **Export Selected Machine Details**: Connected `selectedIds` state to `handleExportCSV` and bulk actions bar. Enhanced exported CSV content to include Category, Machine Code, Machine Name, Model, Serial Number, Hour Meter, Total Services, Status, Customer Name, City, State, Assigned Engineer, Assigned Operator, and Next Service Due Date.
  - **Verification**: Executed `npx tsc --noEmit` (**0 compilation errors**).

- **Page Feedback: Supervisor Complaint Creation & Subheader Clean-up on `/service` (`components/service/ServiceHubClient.tsx`, `components/complaints/ComplaintsClient.tsx`, `app/(app)/service/page.tsx`, `lib/auth/rbac.ts`) (2026-08-18)**:
  - **Supervisor Complaint Creation Fix (`ServiceHubClient.tsx`, `ComplaintsClient.tsx`, `app/(app)/service/page.tsx`)**: Resolved issue where supervisors and users on `/service?tab=complaints&action=create_complaint` were unable to raise breakdown complaints. Updated `app/(app)/service/page.tsx` to fetch operational data (`getMachineComplaints`, `getMachines`, `getActiveEngineers`, `getActiveSupervisors`, `getEngineerServicesData`). Integrated live `ComplaintsClient` and `ServicesClient` into `ServiceHubClient.tsx` sub-tabs. Added URL `action=create_complaint` listener in `ComplaintsClient.tsx` to automatically trigger `MachineComplaintModal` on load.
  - **RBAC Matrix Alignment (`lib/auth/rbac.ts`)**: Confirmed `supervisor` permission `"complaint.create"` in RBAC matrix and added `"complaint.create"` to `service_engineer` and `engineer` roles.
  - **Header Subheader & Pill Clean-up (`ServiceHubClient.tsx`)**: Removed header description paragraph (`Service schedules, digital Field Service Reports (FSR)...`) and inline flex pill badge (`Field Service Operations`) from `ServiceHubClient.tsx` across all user roles per user visual feedback.
  - **Verification**: Executed `npx tsc --noEmit` (**0 compilation errors**).

- **Page Feedback: Complete Removal of AppShellClient Footer (`components/layout/AppShellClient.tsx`) (2026-08-18)**:
  - **Footer Removal**: Completely removed the `<footer>` container (`.py-5 .mb-16 md:mb-0`) and its inner `max-w-[1400px]` wrapper from `components/layout/AppShellClient.tsx` across all user roles per page feedback.
  - **Verification**: Executed `npx tsc --noEmit` (**0 compilation errors**).

- **Page Feedback: Remove Top Border on AppShellClient Footer (`components/layout/AppShellClient.tsx`) (2026-08-18)**:
  - **Footer Border Removal**: Removed `border-t border-[var(--color-hairline)]` border classes from the `<footer>` container in `components/layout/AppShellClient.tsx` per user visual feedback.
  - **Verification**: Executed `npx tsc --noEmit` (**0 compilation errors**).

- **Single Branch Consolidation — Delhi Branch Migration (`030_single_delhi_branch_consolidation.sql`, `supabase/seed_dummy_data.mjs`, `components/branches/BranchesClient.tsx`) (2026-08-18)**:
  - **Single Delhi Branch Migration (`030_single_delhi_branch_consolidation.sql`)**: Consolidated multi-branch structure (`DEL-HQ`, `GGN-01`, `MUM-01`, `BLR-01`) into a single-branch organization (**Delhi Branch** - `DEL-HQ`). Reassigned all 29 users, 13 employee profiles (`EMP-DEL-001` through `EMP-DEL-012`), 14 machines (`MCH-2026-001` through `MCH-2026-005`), inventory storage locations, stock ledger, purchase requests, POs, GRNs, part issues, and delivery challans to Delhi Branch. Deleted all non-Delhi branches from `public.branches`.
  - **Seeding Engine Updates (`supabase/seed_dummy_data.mjs`)**: Configured seed engine to insert only Delhi Branch (`DEL-HQ`), auto-delete any extraneous branch entries, and reassign all managers, service engineers, mechanics, supervisors, operators, store managers, HR, sales, and rental staff to Delhi Branch.
  - **UI & Component Updates (`components/branches/BranchesClient.tsx`)**: Updated directory description to reflect single-branch organization structure (Delhi Branch Headquarters).
  - **Verification**: Executed `node supabase/seed_dummy_data.mjs` (**Success**), `node supabase/verify_seed.mjs` (**Verified 1 branch, 29 users, 13 employees, 14 machines**), and `npx tsc --noEmit` (**0 errors**).

- **Page Feedback: `/my-work` Live Data Scoping & RBAC UI Button Access Gating (`lib/queries/my-work.ts`, `app/(app)/my-work/page.tsx`, `components/my-work/MyWorkClient.tsx`) (2026-08-18)**:
  - **Live DAL Query Module (`lib/queries/my-work.ts`)**: Built `getMyWorkData(userId, role, branchId)` querying live assigned breakdown complaints (`machine_complaints`), assigned scheduled services (`service_records` & `machines`), assigned equipment cards (`machines`), role-specific approval tasks (`purchase_orders`), and daily shift meter log tasks for operators directly from Supabase.
  - **Assignment & Role Scoping**: Restricted Service Engineers, Mechanics, and Operators to items and machines explicitly assigned to them (`engineer_id = userId` / `current_operator_id = userId`). Completely eliminated hardcoded mock tasks, unassigned machines, PO approvals (store/finance), and general document renewals for Service Engineers.
  - **Permission-Gated UI Controls & Empty States (`components/my-work/MyWorkClient.tsx`)**: Integrated `roleHasPermission(user.role, PERMISSIONS.COMPLAINT_CREATE)` check for top-level action buttons ("Report Problem"). Gated task list action buttons by user permissions. Added clean empty state card ("No Assigned Work Items Today") for field staff with zero active assignments.
  - **Verification**: Executed `npx tsc --noEmit` (**0 errors**) and `node supabase/verify_seed.mjs` (**33/33 system tables verified**).

- **Role 13 — Finance Manager Role Implementation & Migration 029 (`029_finance_manager_role_refinements.sql`, `lib/auth/rbac.ts`, `lib/auth/scope.ts`, `lib/types/database.ts`, `lib/queries/finance.ts`, `app/actions/finance.ts`, `AppSidebar.tsx`, `FinanceClient.tsx`, `app/(app)/finance/page.tsx`) (2026-08-18)**:
  - **Granular Permissions & Schema Migration (`029_finance_manager_role_refinements.sql`)**: Seeded 14 granular finance permissions (`finance.view`, `finance.invoice`, `finance.invoice.create`, `finance.invoice.edit`, `finance.invoice.finalize`, `finance.invoice.cancel`, `finance.credit_note`, `finance.debit_note`, `finance.payment`, `finance.payment.record`, `finance.receivable.manage`, `finance.payable.manage`, `finance.3way_match`, `finance.expense.manage`, `finance.expense.approve`, `finance.approval`, `finance.report`, `finance.settings.manage`). Created 10 finance domain tables (`finance_invoices`, `finance_invoice_items`, `finance_payments`, `finance_credit_debit_notes`, `finance_expense_categories`, `finance_expenses`, `finance_3way_matching_reviews`, `finance_vendor_payments`, `finance_receivable_followups`, `finance_settings`). Re-synced `public.role_permissions` mapping for `finance_manager`.
  - **Organization-Scoped Financial Engine (`lib/auth/scope.ts`, `lib/queries/finance.ts`)**: Confirmed `ROLE_DEFAULT_SCOPES.finance_manager = "ORGANIZATION"`. Built DAL queries for finance dashboard KPIs, multi-filter invoices, payment ledger, receivables aging report (0–30, 31–60, 61–90, 90+ days), payables & supplier balances, 3-way match reviews, expenses, and finance settings.
  - **Server Action Guardrails & Financial Governance (`app/actions/finance.ts`)**: Added `createInvoiceAction`, `updateInvoiceAction` (enforces direct modification restriction on finalized invoices per Rule 3), `finalizeInvoiceAction`, `recordPaymentAction` (supports partial payments & auto-calculates remaining balance and status), `createCreditDebitNoteAction` (issues CN/DN for finalized invoices), `createExpenseAction` (auto-flags > ₹50,000 for higher approval), `approveExpenseAction`, `review3WayMatchAction` (PO ↔ GRN ↔ Supplier Invoice matching with payment hold auto-trigger), `recordVendorPaymentAction`, `addReceivableFollowupAction`, and `updateFinanceSettingsAction`.
  - **Hard Restrictions Enforced**: Restricted machine creation/master spec editing/hard deletion/reassignment, physical stock movements (`stock_in`, `stock_out`, `adjust`, `transfer`), breakdown complaint handling & service planning, HR employee onboarding & individual salary records, direct user administration / RBAC permission modifications, branch creation/deletion, and platform security settings.
  - **UI Controls & 11-Tab Finance Management Suite Overhaul (`AppSidebar.tsx`, `FinanceClient.tsx`, `app/(app)/finance/page.tsx`)**: Added `/finance` route to `AppSidebar.tsx` and configured subItems filtering for `finance_manager`. Built `FinanceClient.tsx` into an 11-tab Finance Management Suite featuring KPI metric cards, Cash-flow summary, Quick Action toolbar, Sales & Rental review, Invoices & Notes directory, Payment ledger, Receivables aging cards, Payables & Vendor settlements, 3-Way Match PO verification matrix, Expense tracker, HR Payroll summaries (aggregated), Financial Reports with CSV export, and Finance settings.
  - **Verification**: Executed `npx tsc --noEmit` (**0 errors**) and `node supabase/verify_seed.mjs` (**33/33 system tables verified**).

- **Role 11 — Rental Manager Role Implementation & Migration 027 (`027_rental_manager_role_refinements.sql`, `lib/auth/rbac.ts`, `lib/auth/scope.ts`, `lib/queries/rentals.ts`, `app/actions/rentals.ts`, `app/actions/machines.ts`, `AppSidebar.tsx`, `RentalManagementClient.tsx`, `app/(app)/rentals/page.tsx`, `MachineModal.tsx`, `MachineListClient.tsx`) (2026-08-18)**:
  - **Granular Permissions & Schema Migration (`027_rental_manager_role_refinements.sql`)**: Seeded 7 granular rental permissions (`rental.inspect`, `rental.damage_report`, `rental.extend`, `rental.cancel`, `rental.billing_request`, `rental.customer_manage`, `rental.accessory_manage`). Created 9 core rental tables (`rental_customers`, `rental_requests`, `rental_agreements`, `rental_delivery_challans`, `rental_return_inspections`, `rental_damage_reports`, `rental_extension_requests`, `rental_billing_requests`, `rental_accessories_log`). Re-synced `public.role_permissions` mapping for `rental_manager`.
  - **Branch-Scoped Rental Engine (`lib/auth/scope.ts`, `lib/queries/rentals.ts`)**: Maintained `ROLE_DEFAULT_SCOPES.rental_manager = "BRANCH"`. Built DAL queries for rental dashboard KPIs, customer directory, rental requests, contracts & agreements, delivery challans, return inspections, damage reports, billing requests, and fleet availability matrix.
  - **Server Action Guardrails & Rental Lifecycle Governance (`app/actions/rentals.ts`, `app/actions/machines.ts`)**: Added `createRentalCustomerAction`, `updateRentalCustomerAction`, `deactivateRentalCustomerAction` (soft archive enforcement preventing deletion of customers with historical rentals), `createRentalRequestAction`, `approveRentalRequestAction`, `rejectRentalRequestAction`, `createRentalAgreementAction` (discount threshold logic: discounts > 15% set `pending_approval` requiring Admin/Sales approval), `approveRentalAgreementAction`, `dispatchRentalMachineAction` (pre-dispatch check + delivery challan generation + machine status update to `on_rent`), `recordMachineReturnAction` (return meter, fuel, condition; auto-creates Damage Report & notifies Service & Finance if damaged), `extendRentalContractAction` (checks machine reservation/availability; extends contract if available, rejects with alternative recommendation if reserved), `createRentalBillingRequestAction` (calculates base rental, extra hours, transport, damage charges, deposit adjustments for Finance), and `requestRentalServiceAction` (creates breakdown complaint in Service module).
  - **Hard Restrictions Enforced**: Restricted machine creation (`createMachine`), machine hard-deletion (`deleteMachine`), technical master spec updates (`updateMachine` restricts `rental_manager` to rental status & address fields), inter-branch ownership changes, physical stock operations, HR employee creation/management, general machine sales outside rental, payment ledger editing, user administration, branch creation/deletion, and system settings.
  - **UI Controls & Rental Operations Hub (`AppSidebar.tsx`, `RentalManagementClient.tsx`, `app/(app)/rentals/page.tsx`, `MachineModal.tsx`, `MachineListClient.tsx`)**: Added `/rentals` route to `AppSidebar.tsx` and configured `rental_manager` sidebar items (`/dashboard`, `/my-work`, `/rentals`, `/crm`, `/machines` view-only, `/service` coordination, `/inventory` view-only, `/challans`, `/documents`, `/hr` directory, `/reports`). Overhauled `RentalManagementClient.tsx` into a multi-tab Rental Operations Hub with KPI metric cards, Fleet Availability Matrix, Quick Actions, Customer Directory, Agreement Lifecycle controls, Dispatch & Delivery Challan generator, Return Inspection modal, Damage Report auto-routing, and Operational Billing requests. Hidden "+ Add Machine" button and disabled technical master spec inputs in `MachineModal.tsx` for Rental Managers.
  - **Verification**: Executed `npx tsc --noEmit` (**0 errors**) and `node supabase/verify_seed.mjs` (**Verified system tables**).

- **Role 12 — Sales Manager / Sales Executive Role Implementation & Migration 028 (`028_sales_manager_role_refinements.sql`, `lib/auth/rbac.ts`, `lib/auth/scope.ts`, `lib/types/database.ts`, `lib/queries/sales.ts`, `app/actions/sales.ts`, `AppSidebar.tsx`, `CrmClient.tsx`, `app/(app)/crm/page.tsx`) (2026-08-18)**:
  - **Granular Permissions & Schema Migration (`028_sales_manager_role_refinements.sql`)**: Seeded 12 granular sales permissions (`sales.lead_manage`, `sales.customer_manage`, `sales.interaction_log`, `sales.opportunity_manage`, `sales.quotation_manage`, `sales.discount_approve`, `sales.order_manage`, `sales.order_approve`, `sales.machine_reserve`, `sales.delivery_coordinate`, `sales.handover_coordinate`, `sales.settings_manage`). Created 9 core sales tables (`sales_leads`, `sales_customers`, `sales_customer_interactions`, `sales_opportunities`, `sales_quotations`, `sales_orders`, `sales_machine_reservations`, `sales_delivery_coordinations`, `sales_settings`). Re-synced `public.role_permissions` mapping for `sales_executive`.
  - **Branch-Scoped Sales Engine (`lib/auth/scope.ts`, `lib/queries/sales.ts`)**: Confirmed `ROLE_DEFAULT_SCOPES.sales_executive = "BRANCH"`. Built DAL queries for sales dashboard metrics, lead pipeline, customer directory, interaction history, opportunities, multi-version quotations, sales orders, available machine catalog for sale, machine reservations, delivery coordinations, and sales settings.
  - **Server Action Guardrails & Sales Lifecycle Governance (`app/actions/sales.ts`)**: Added `createSalesLeadAction`, `updateSalesLeadAction`, `convertLeadAction` (lead $\rightarrow$ customer + opportunity), `createSalesCustomerAction`, `archiveSalesCustomerAction` (soft-delete enforcement preventing deletion of customers with transaction history), `logSalesInteractionAction`, `createSalesOpportunityAction`, `createSalesQuotationAction`, `reviseSalesQuotationAction` (multi-version tracking `V1` $\rightarrow$ `V2` without overwriting sent quotations per Rule 9), `createSalesOrderAction`, `reserveMachineForSalesAction` (reserves machine for confirmed order without physical dispatch), `requestSalesDeliveryAction` (delivery request to store/operations without physical stock-out), and `completeSalesHandoverAction` (uploads signed handover proof). Enforced discount approval threshold rules (0–5% auto-approved, > 5% requires manager approval).
  - **Hard Restrictions Enforced**: Restricted technical machine specification editing/hard deletion/physical dispatch, breakdown complaint assignment & FSR editing, physical inventory stock ledger/POs/challans, HR employee management & salary visibility, direct financial payment recording, user administration / RBAC permission modifications, branch creation/deletion, and platform security settings.
  - **UI Controls & 10-Tab Sales Management Suite Overhaul (`AppSidebar.tsx`, `CrmClient.tsx`, `app/(app)/crm/page.tsx`)**: Expanded `AppSidebar.tsx` CRM subItems to Dashboard, Leads, Customers, Interactions, Opportunities, Quotations, Sales Orders, Machine Sales, Delivery & Handover, Service Escalations, and Sales Settings. Overhauled `CrmClient.tsx` into a 10-tab Sales & CRM Management Suite featuring 14 KPI metric cards, Quick Sales Operations toolbar, Lead conversion wizard, soft-delete archive modal, interaction logger, pipeline stage deal tracking, versioned quotation builder with discount approval warning, sales order generator, machine reservation modal, and signed handover proof uploader.
  - **Verification**: Executed `npx tsc --noEmit` (**0 errors**) and `node supabase/verify_seed.mjs` (**Verified system tables**).

- **Role 10 — HR Manager Role Implementation & Migration 026 (`026_hr_manager_role_refinements.sql`, `lib/auth/rbac.ts`, `lib/auth/scope.ts`, `lib/types/database.ts`, `lib/queries/hr.ts`, `app/actions/hr.ts`, `AppSidebar.tsx`, `HRClient.tsx`, `app/(app)/hr/page.tsx`, `app/(app)/dashboard/page.tsx`) (2026-08-18)**:
  - **Granular Permissions & Schema Migration (`026_hr_manager_role_refinements.sql`)**: Extended `public.employees` status CHECK constraint (`pending_onboarding`, `active`, `on_leave`, `notice_period`, `resigned`, `terminated`, `retired`, `inactive`, `archived`). Created `public.departments`, `public.designations`, `public.employee_salary_history`, `public.employee_documents`, and `public.user_account_requests` tables. Seeded permissions (`employee.onboard`, `employee.status_change`, `department.manage`, `designation.manage`, `user_request.create`, `user_request.view`, `employee.document.manage`, `employee.salary.create`, `employee.salary.edit`) and re-synced `public.role_permissions` mapping for `hr_manager`.
  - **Global / Branch HR Scoping (`lib/auth/scope.ts`, `lib/queries/hr.ts`)**: Confirmed `ROLE_DEFAULT_SCOPES.hr_manager = "ORGANIZATION"`. Built DAL queries for HR directory, dashboard metrics, department/designation master lists, salary history audit logs, document metadata, and employee account requests.
  - **Server Action Guardrails & Employee Lifecycle Governance (`app/actions/hr.ts`)**: Added `createEmployeeAction`, `updateEmployeeAction`, `changeEmployeeStatusAction`, `createSalaryRevisionAction`, `manageDepartmentAction`, `manageDesignationAction`, `requestUserAccountAction`, and `uploadEmployeeDocumentAction`. Enforced strict prohibition against hard deleting employees with historical data (`Active` $\rightarrow$ `Inactive` $\rightarrow$ `Archived`). Protected historical salary records from overwrites by appending auditable revision entries.
  - **Hard Restrictions Enforced**: Restricted machine creation/master spec editing/deletion/reassignment, breakdown complaint handling & service planning, physical inventory stock ledger & POs/challans, rental contracts, sales/CRM pipeline, general finance ledgers, direct user administration / RBAC permission modifications, branch creation/deletion, and platform infrastructure settings.
  - **UI Controls & HR Management Suite Overhaul (`AppSidebar.tsx`, `HRClient.tsx`, `app/(app)/hr/page.tsx`, `app/(app)/dashboard/page.tsx`)**: Expanded `AppSidebar.tsx` HR subItems to Dashboard, Employees, Onboarding, Departments, Designations, Salary & Payroll, User Requests, and Documents. Overhauled `HRClient.tsx` into a 7-tab HR Management Suite featuring 12 KPI metric cards, department/designation/branch workforce breakdown charts, profile edit modal, lifecycle status transition modal, salary revision modal with fixed/variable/CTC breakdown, department & designation master creation modals, user account request form, and document attachment repository.
  - **Verification**: Executed `npx tsc --noEmit` (**0 errors**) and `node supabase/verify_seed.mjs` (**33/33 system tables verified**).

- **Role 9 — Store Manager Role Implementation & Migration 025 (`025_store_manager_role_refinements.sql`, `lib/auth/rbac.ts`, `lib/auth/scope.ts`, `app/actions/inventory.ts`, `app/actions/machines.ts`, `AppSidebar.tsx`, `MachineModal.tsx`) (2026-08-18)**:
  - **Granular Permissions & Migration (`025_store_manager_role_refinements.sql`)**: Seeded comprehensive inventory, procurement, PO, delivery challan, vendor, GRN, purchase return, and product archiving permissions. Re-synced `public.role_permissions` mapping for `store_manager`.
  - **Branch-Scoped Inventory Management (`lib/auth/scope.ts`, `lib/queries/*`)**: Maintained `ROLE_DEFAULT_SCOPES.store_manager = "BRANCH"`. Enforced branch scoping across DAL queries (`inventory.ts`, `purchase-orders.ts`, `challans.ts`).
  - **PO Approval Threshold & Workflow Governance (`app/actions/inventory.ts`)**: Implemented PO approval threshold logic: POs $\le ₹10,000$ are auto-approved upon creation by Store Manager; POs $> ₹10,000$ are flagged as `pending_approval` requiring higher manager (Branch Manager / Admin) authorization with automated notifications. Added `approvePurchaseOrderAction`.
  - **Product Archiving & Stock Adjustments (`app/actions/inventory.ts`)**: Added `archiveProductAction` to set products to `inactive` instead of hard deleting items with transaction history. Added `createStockAdjustmentAction` (`ADJUSTMENT`, `DAMAGE`, `LOSS`) and `createPurchaseReturnAction` for returning defective/damaged stock to suppliers.
  - **Hard Restrictions Enforced**: Restricted machine creation/master spec editing/deletion/reassignment, service schedule planning & FSR creation/approval, HR management & salary visibility, rental contract modification, sales/CRM pipeline, finance payment ledger editing, user administration, branch creation/deletion, and system security settings.
  - **UI Controls & Navigation (`AppSidebar.tsx`, `MachineModal.tsx`)**: Reconfigured `AppSidebar.tsx` navigation for Store Manager: enabled `/dashboard`, `/my-work`, `/machines` (view-only), `/inventory` (all 9 subItems), `/vendors`, `/purchase-orders`, `/challans`, `/documents`, and `/reports`. Hidden `/crm`, `/service`, `/hr`, and `/administration`. Disabled machine master specs editing in `MachineModal.tsx` for Store Manager.
  - **Verification**: Executed `npx tsc --noEmit` (**0 errors**) and `node supabase/verify_seed.mjs` (**33/33 system tables verified**).

- **Role 8 — Operator Role Implementation & Migration 024 (`024_operator_role_refinements.sql`, `lib/auth/rbac.ts`, `lib/auth/scope.ts`, `lib/queries/machines.ts`, `lib/queries/complaints.ts`, `lib/queries/services.ts`, `app/actions/operators.ts`, `app/actions/complaints.ts`, `app/actions/inventory.ts`, `AppSidebar.tsx`, `OperatorDashboard.tsx`, `MachineModal.tsx`, `ComplaintsClient.tsx`, `FieldServiceReportModal.tsx`) (2026-08-18)**:
  - **Granular Permissions Migration (`024_operator_role_refinements.sql`)**: Extended `public.machine_hour_logs` table with `start_fuel_level`, `machine_condition`, and `status`. Seeded exact operator permissions (`operator.view`, `operator.log_create`, `operator.log_edit`, `machine.view`, `complaint.view`, `complaint.create`, `complaint.update`, `service.view`, `fsr.view`, `part_request.create`, `part_request.view`, `rental.view`, `notification.view`, `notification.send`, `report.view`, `audit.view`).
  - **Assigned Workload & Shift Scoping (`lib/auth/scope.ts`, `lib/queries/*`)**: Enforced `ROLE_DEFAULT_SCOPES.operator = "ASSIGNED"`. Scoped machines (`current_operator_id`), complaints (`supervisor_id`), services, and hour logs strictly to assigned operator.
  - **Hard Restrictions Enforced**: Restricted machine creation/master specs editing/deletion/reassignment, physical stock transactions & request approvals, HR directory & salary visibility, rental contracts, sales/finance, user administration, branch management, system settings, and complaint resolution/closure.
  - **Server Action Guardrails (`app/actions/*`)**: Enhanced `submitOperatorHourLogAction` with meter validation (`End >= Start`), fuel, shift, and condition tracking. Added `updateOperatorHourLogAction` allowing operators to edit and resubmit draft or rejected meter logs while blocking edits to approved logs. Blocked `operator` from assigning machines, closing complaints with FSR, or closing/resolving complaints directly. Allowed part request creation via `requireAnyPermission`.
  - **UI Navigation & Operator Dashboard Overhaul (`AppSidebar.tsx`, `OperatorDashboard.tsx`, `MachineModal.tsx`, `ComplaintsClient.tsx`, `FieldServiceReportModal.tsx`)**: Reconfigured `AppSidebar.tsx` navigation for Operator: enabled `/dashboard`, `/my-work`, `/machines`, `/service`, `/reports`, `/profile`, `/documents`, and filtered `/inventory` subItems to `Procurement` (Part Requests). Built feature-complete `OperatorDashboard.tsx` with Quick Actions (Start/End Shift, Enter Meter, Enter Fuel, Report Breakdown, Request Part, View Machine), 6 KPI metric cards, daily shift log form with anomaly warnings, recent meter logs history with self-correction modal ("Edit & Resubmit"), my reported breakdown complaints list, and my part requests tracking. Rendered read-only FSR view for operators.
  - **Verification**: Executed `npx tsc --noEmit` (**0 errors**) and `node supabase/verify_seed.mjs` (**33/33 system tables verified**).

- **Role 7 — Mechanic Role Implementation & Migration 022 (`022_mechanic_role_refinements.sql`, `lib/auth/rbac.ts`, `lib/auth/scope.ts`, `lib/queries/services.ts`, `lib/queries/dashboard.ts`, `lib/queries/machines.ts`, `lib/queries/complaints.ts`, `lib/queries/notifications.ts`, `app/actions/complaints.ts`, `app/actions/machines.ts`, `AppSidebar.tsx`, `MachineModal.tsx`, `ComplaintsClient.tsx`, `FieldServiceReportModal.tsx`) (2026-08-18)**:
  - **Granular Permissions Migration (`022_mechanic_role_refinements.sql`)**: Seeded exact repair execution permissions for `mechanic` covering assigned machine view, breakdown complaint creation (`complaint.create`) & status updates, service job execution/completion, FSR repair detail entry, inventory view & part requests (`part_request.create`, `part_request.view`), operator/rental context viewing, personal notifications, and personal reports/audit activity.
  - **Assigned Workload Scoping (`lib/auth/scope.ts`, `lib/queries/*`)**: Enforced `ROLE_DEFAULT_SCOPES.mechanic = "ASSIGNED"`. Updated DAL queries (`services.ts`, `dashboard.ts`, `machines.ts`, `complaints.ts`, `notifications.ts`) to scope assigned machines, services, complaints, and alerts to assigned mechanic (`engineer_id = userId`).
  - **Hard Restrictions Enforced**: Restricted machine creation/master data editing/deletion/reassignment, physical stock transactions (`stock_in`, `stock_out`, `adjust`, `transfer`), part request approvals, HR/salary visibility, rental contract editing, sales/finance, user administration, branch management, system settings, and managerial FSR/service final approvals.
  - **Server Action Guardrails (`app/actions/*`)**: Added guardrail in `updateComplaintStatusAction` blocking mechanics from directly force-closing or resolving complaints without Service Manager review.
  - **UI Navigation & Component Controls (`AppSidebar.tsx`, `MachineModal.tsx`, `ComplaintsClient.tsx`, `FieldServiceReportModal.tsx`)**: Enabled `/reports` for mechanics. Filtered `/inventory` subItems for Mechanics to `Dashboard`, `Part Master`, and `Procurement` (Part Requests). Disabled machine master spec inputs in `MachineModal.tsx`. Enabled breakdown complaint creation in `ComplaintsClient.tsx`. Updated FSR submission button in `FieldServiceReportModal.tsx` to "Submit Repair Details" for Mechanic role.
  - **Verification**: Executed `npx tsc --noEmit` (**0 errors**) and `node supabase/verify_seed.mjs` (**38/38 system tables verified, 34 users verified across all 13 roles including 5 mechanics**).

- **Role 6 — Supervisor Role Implementation & Migration 022 (`022_supervisor_role_refinements.sql`, `lib/auth/scope.ts`, `lib/auth/rbac.ts`, `lib/queries/machines.ts`, `lib/queries/dashboard.ts`, `app/actions/operators.ts`, `app/actions/complaints.ts`, `AppSidebar.tsx`, `OperationsClient.tsx`, `ComplaintsClient.tsx`, `FieldServiceReportModal.tsx`) (2026-08-18)**:
  - **Granular Permissions Migration (`022_supervisor_role_refinements.sql`)**: Extended `public.machine_hour_logs` with verification & fuel tracking columns (`verification_status`, `verified_by`, `verified_at`, `verification_remarks`, `fuel_consumed`, `shift`). Seeded exact field operational permissions for `supervisor` covering machine view & limited edit, breakdown complaint creation & observation updates, service view, FSR view, inventory view & breakdown part requests, operator log monitoring & verification (`operator.log_approve`), employee directory view, rental status view, notifications, and operational reports/audit logs.
  - **Branch-Scoped Monitoring (`lib/auth/scope.ts`, `lib/queries/*`)**: Enforced `ROLE_DEFAULT_SCOPES.supervisor = "BRANCH"`. Updated DAL queries (`machines.ts`, `dashboard.ts`, `hr.ts`) to scope machines, KPIs, charts, due lists, and staff strictly to the Supervisor's assigned branch.
  - **Hard Restrictions Enforced**: Restricted machine creation/deletion/technical specification editing/inter-branch reassignment, service schedule planning/assignment/official closure, FSR creation/editing/approval/rejection, physical stock transactions (stock in/out/adjust/transfer) and part request approval, HR employee creation/deletion/salary visibility, rental contract modification, sales/CRM, finance/billing, user administration, branch management, and system settings.
  - **UI & Navigation Controls (`AppSidebar.tsx`, `OperationsClient.tsx`, `ComplaintsClient.tsx`, `FieldServiceReportModal.tsx`, `MachineModal.tsx`)**: Enabled `/inventory` (filtered to Dashboard, Part Master, Procurement), `/hr` (filtered to Employees directory), and `/reports` sidebar routes. Enhanced `OperationsClient.tsx` with daily running hour log verification (Approve, Reject, Request Correction), anomaly detection badges, and operator reassignment requests. Hidden "+ Add Machine" button on `/machines`, disabled technical master specs editing in `MachineModal.tsx`, and updated active complaints action to "View Details" with read-only FSR view.
  - **Verification**: Executed `npx tsc --noEmit` (**0 errors**) and `node supabase/verify_seed.mjs` (**38/38 system tables verified**).

- **Role 5 — Service Engineer Role Implementation & Migration 020 (`020_service_engineer_role_refinements.sql`, `lib/auth/scope.ts`, `lib/auth/rbac.ts`, `lib/queries/services.ts`, `lib/queries/dashboard.ts`, `lib/queries/machines.ts`, `lib/queries/notifications.ts`, `app/actions/complaints.ts`, `AppSidebar.tsx`) (2026-08-18)**:
  - **Granular Permissions Migration (`020_service_engineer_role_refinements.sql`)**: Seeded exact field execution permissions for `service_engineer` and `engineer` covering assigned machine view, breakdown complaint update/resolution request, service job execution/completion, FSR creation/editing before approval, inventory view & part requests, operator meter log viewing, personal notifications, and personal reports/audit activity.
  - **Assigned Workload Scoping (`lib/auth/scope.ts`, `lib/queries/*`)**: Enforced `ROLE_DEFAULT_SCOPES.service_engineer = "ASSIGNED"` and `ROLE_DEFAULT_SCOPES.engineer = "ASSIGNED"`. Updated DAL queries (`services.ts`, `dashboard.ts`, `machines.ts`, `notifications.ts`) to scope machines, services, complaints, FSRs, and alerts strictly to assigned engineer (`engineer_id = userId`).
  - **Hard Restrictions Enforced**: Restricted machine creation/editing/deletion/reassignment, service schedule planning for others, FSR self-approval/managerial approval, physical inventory stock in/out/adjustment/transfers, part request approval, HR employee management & salary visibility, rental contracts, sales/CRM, finance/billing, user administration, branch management, and system settings.
  - **UI & Navigation Controls (`AppSidebar.tsx`, `ServicesClient.tsx`, `FieldServiceReportModal.tsx`)**: Filtered `/inventory` subItems for Service Engineers to `Dashboard` (Store View), `Part Master`, and `Part Requests`. Maintained complete exclusion of restricted navigation routes (`/crm`, `/vendors`, `/purchase-orders`, `/challans`, `/hr`, `/administration`).
  - **Verification**: Executed `npx tsc --noEmit` (**0 errors**) and `node supabase/verify_seed.mjs` (**33/33 system tables verified**).

- **Role 4 — Service Manager Role Implementation & Migration 020 (`020_service_manager_role_refinements.sql`, `lib/auth/rbac.ts`, `app/actions/machines.ts`, `app/(app)/hr/page.tsx`, `AppSidebar.tsx`, `MachineListClient.tsx`, `MachineModal.tsx`, `ComplaintsClient.tsx`, `FieldServiceReportModal.tsx`) (2026-08-18)**:
  - **Granular Permissions Migration (`020_service_manager_role_refinements.sql`)**: Seeded exact permissions for `service_manager` covering machine view & service edit, breakdown complaints full lifecycle (create, assign engineer/mechanic, update status, escalate, close), service planning & execution full lifecycle (create, plan, assign, reschedule, cancel, complete, approve), FSR review & approval, inventory view & part requests (create request, approve service requirement, escalate), service staff directory supervision, operator/rental view, service notifications, and service reports/audit logs.
  - **Hard Restrictions Enforced**: Restricted machine creation (`machine.create`), machine hard-deletion (`machine.delete`), changing machine ownership/serial numbers/engine numbers, inter-branch machine moves, physical stock transactions (`stock_in`, `stock_out`, `adjust`), HR employee creation/editing/deletion, salary/payroll visibility, direct FSR field overwriting, user account administration, branch configuration, sales/finance operational access, and system settings.
  - **Server Action Guardrails (`app/actions/*`)**: Removed `service_manager` from `createMachine` role check in `app/actions/machines.ts`. Enforced branch scoping filter in `app/(app)/hr/page.tsx`.
  - **UI Navigation & Component Controls (`AppSidebar.tsx`, `MachineListClient.tsx`, `MachineModal.tsx`, `ComplaintsClient.tsx`, `FieldServiceReportModal.tsx`)**: Enabled `/hr` sidebar route for Service Manager with subItems filtered to Employees directory only. Hidden "+ Add Machine" button on `/machines`. Disabled machine master specs editing in `MachineModal.tsx` for Service Manager. Enabled breakdown complaint raising in `ComplaintsClient.tsx`. Enabled FSR review ("Approve FSR" and "Send Back for Revision") in `FieldServiceReportModal.tsx`.
  - **Verification**: Executed `npx tsc --noEmit` (**0 errors**) and `node supabase/verify_seed.mjs` (**38/38 system tables verified**).

- **Role 2 — Admin Role Implementation & Migration 019 (`019_admin_role_refinements.sql`, `lib/auth/rbac.ts`, `app/actions/branches.ts`, `app/actions/machines.ts`, `app/actions/users.ts`, `BranchesClient.tsx`, `AdminClient.tsx`, `UserCreateModal.tsx`, `UserEditModal.tsx`) (2026-08-18)**:
  - **Granular Permissions Migration (`019_admin_role_refinements.sql`)**: Seeded exact operational permissions for `admin` covering machines view/create/edit/assign, complaints full management, service planning/jobs/FSR full administrative management, inventory & part requests, HR directory supervision, rental contracts operational management, sales view/customer management, operator meter log approval, notifications view/send, user account management, operational branch editing, and operational reports/audit logs.
  - **Governance & Hard Restrictions Enforced**: Restricted machine hard deletion (requires `super_admin`), branch creation (requires `super_admin`), branch hard deletion, financial invoice creation/payment recording (owned by `finance_manager` & `super_admin`), platform security secrets/RLS configuration, and Super Admin user account creation, editing, or deletion.
  - **Server Action Guardrails (`app/actions/*`)**: Restricted `createBranchAction` and `deleteMachine` to `super_admin`. Added `updateBranchAction` and `deactivateBranchAction` for Admin operational branch maintenance. Enforced Super Admin immunity in `users.ts`.
  - **UI & Navigation Controls (`BranchesClient.tsx`, `AdminClient.tsx`, `UserCreateModal.tsx`, `UserEditModal.tsx`)**: Hidden "+ Add Branch" button for Admin. Enabled "Edit Operational Info" modal button on branch cards. Hidden `Super Admin` role option in user modals for Admin. Visually distinguished Operational Settings from Super Admin Governance Settings in `AdminClient.tsx`.
  - **Verification**: Executed `npx tsc --noEmit` (**0 errors**) and `node supabase/verify_seed.mjs` (**33/33 system tables verified**).

- **Role 1 — Super Admin Role Implementation & Migration 019 (`019_super_admin_role_refinements.sql`, `lib/auth/rbac.ts`, `lib/auth/scope.ts`, `lib/dal.ts`, `app/actions/users.ts`, `AppSidebar.tsx`, `AuditLogsClient.tsx`) (2026-08-18)**:
  - **Granular Permissions Migration (`019_super_admin_role_refinements.sql`)**: Seeded operator log (`operator.view`, `operator.assign`, `operator.log_approve`), notification channels (`notification.view`, `notification.configure`, `notification.send`), and branch deletion (`branch.delete`) permissions. Assigned EVERY system permission in `public.permissions` to `super_admin` in `public.role_permissions`.
  - **Global Scope Enforcement (`lib/auth/scope.ts`, `lib/dal.ts`)**: Confirmed `ROLE_DEFAULT_SCOPES.super_admin = "ORGANIZATION"` and `getUserBranchIds()` returns `null` for Super Admin, granting unrestricted global access across all branches and modules.
  - **Immutable Audit Logs**: Implemented database-level RLS policy & trigger `trg_prevent_audit_log_modification` preventing any UPDATE or DELETE operations on `public.audit_logs`. Maintained full view, filter, and export capabilities in `AuditLogsClient.tsx`.
  - **Full System Governance (`app/actions/users.ts`, `AppSidebar.tsx`)**: Granted Super Admin full capability to manage users of any role (including Super Admin), assign roles, reset passwords, lock/unlock accounts, configure branches, and navigate all 13 sidebar modules (`Dashboard`, `My Work`, `CRM`, `Machines`, `Service`, `Inventory`, `Vendors`, `Purchase Orders`, `Challans`, `Documents`, `HR` including Payroll, `Reports`, `Administration`).
  - **Verification**: Executed `npx tsc --noEmit` (**0 errors**) and `node supabase/verify_seed.mjs` (**38/38 system tables verified**).

- **Role 3 — Branch Manager Role Implementation & Migration 018 (`018_branch_manager_role_refinements.sql`, `lib/auth/rbac.ts`, `lib/queries/machines.ts`, `lib/queries/dashboard.ts`, `lib/queries/hr.ts`, `app/actions/machines.ts`, `AppSidebar.tsx`, `HRClient.tsx`, `MachineListClient.tsx`, `FieldServiceReportModal.tsx`) (2026-08-18)**:
  - **Granular Permissions Migration (`018_branch_manager_role_refinements.sql`)**: Seeded exact permissions for `branch_manager` covering machine view/create/edit/assign, complaint full management, service planning/jobs, FSR review, inventory requests/transfer approvals, employee directory supervision, rental/sales/finance view-only, user branch view, branch operational info, and operational reports/audit logs.
  - **Hard Restrictions Enforced**: Strictly restricted machine hard-deletion, physical stock in/out/adjustment, HR employee creation/editing/deletion, salary/payroll visibility, direct FSR creation/editing, user account creation, RBAC role assignment, branch creation/deletion, and system settings access.
  - **DAL Branch Scoping (`lib/queries/*`)**: Enforced branch scoping on `getMachines()`, `getDashboardKpis()`, `getDashboardCharts()`, `getDashboardDueLists()`, and `getEmployeeDirectory()` using `user.branch_id`.
  - **Server Action Guardrails (`app/actions/*`)**: Automated `branch_id = user.branch_id` assignment on `createMachine` for Branch Managers. Replaced machine hard deletion with `requestMachineDeactivation`.
  - **UI & Navigation Controls (`AppSidebar.tsx`, `HRClient.tsx`, `MachineListClient.tsx`, `FieldServiceReportModal.tsx`)**: Hidden Payroll sub-item under `/hr` and blocked `/administration`. Hidden Onboard Employee button and salary/bank columns in HR directory. Enabled FSR review & approval buttons for Branch Managers while preventing direct editing of engineer fields.
  - **Verification**: Executed `npx tsc --noEmit` (**0 errors**) and `node supabase/verify_seed.mjs` (**38/38 system tables verified**).

- **Comprehensive 13-Role RBAC System Implementation & Supabase Migration 017 (`lib/types/database.ts`, `lib/auth/rbac.ts`, `lib/auth/scope.ts`, `017_comprehensive_13_roles_rbac.sql`, `AppSidebar.tsx`, `MobileBottomNav.tsx`, `PublicNavbar.tsx`, `signup/page.tsx`, `UserCreateModal.tsx`, `UserEditModal.tsx`, `UserRow.tsx`, `UserDetailSheet.tsx`) (2026-08-17)**:
  - **13 Operational Roles**: Formally implemented 13 roles (`super_admin`, `admin`, `branch_manager`, `service_manager`, `service_engineer`, `supervisor`, `mechanic`, `operator`, `store_manager`, `hr_manager`, `rental_manager`, `sales_executive`, `finance_manager`) + `engineer` alias across database, DAL, auth middleware, and UI components.
  - **Central Permission Matrix**: Built resource-action matrix in `lib/auth/rbac.ts` supporting normalized dot/colon permissions (`machine.view`, `machine:read`, `service.plan`, `fsr.review`, `inventory.stock_in`, `employee.salary.view` / `hr:read_salary`, `rental.create`, `sales.quotation`, `finance.invoice`, `user.assign_role`).
  - **Supabase Migration & RLS**: Created migration `017_comprehensive_13_roles_rbac.sql` seeding roles/permissions, check constraints, and `auth_user_has_branch_access()` RLS security.
  - **Seeding Engine**: Updated `seed_dummy_data.mjs` provisioning test auth accounts for all 13 roles (`Password@123456`).
  - **UI Navigation & Action Control**: Reconfigured `AppSidebar.tsx` navigation matrix and `MobileBottomNav.tsx`, updated signup role options in `signup/page.tsx`, and updated admin user management modals/rows/sheets.
  - **Verification**: Executed `npx tsc --noEmit` (**0 errors**), `node supabase/seed_dummy_data.mjs` (**Success**), and `node supabase/verify_seed.mjs` (**29 users verified across all 13 roles**).

- **Page Feedback: Remove Rounded Subheader Container on `/inventory?tab=transactions` (`components/inventory/StockLedgerClient.tsx`) (2026-08-16)**:
  - **Subheader Container Removal**: Removed the top flex subheader banner card container (`<div className="p-4 rounded-2xl border border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)] flex items-center justify-between">`), title text (`Complete Inventory Transaction Ledger`), description paragraph (`Immutable audit ledger tracking every stock-in, stock-out, purchase receipt, and return`), and total transactions badge from the Stock Ledger Audit History tab view per user feedback.
  - **Unused Import Cleanup**: Removed unused `AnimatedHistory` import.
  - **Verification**: Executed `npx tsc --noEmit` with **0 TypeScript compilation errors**.

- **Page Feedback: Remove Rounded Subheader Container on `/inventory?tab=returns` (`components/inventory/StockLedgerClient.tsx`) (2026-08-16)**:
  - **Subheader Container Removal**: Removed the top flex subheader banner card container (`<div className="p-4 rounded-2xl border border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)] space-y-2">`), title text (`Returnable Parts & Overdue Tracking`), icon (`RotateCcw`), and description paragraph (`Track returnable tools, seal kits, and components issued to technicians.`) from the Returnable Parts tab view per user feedback.
  - **Verification**: Executed `npx tsc --noEmit` with **0 TypeScript compilation errors**.

- **Page Feedback: Remove Rounded Subheader Container on `/inventory?tab=transfers` (`components/inventory/StockLedgerClient.tsx`) (2026-08-16)**:
  - **Subheader Container Removal**: Removed the top flex subheader banner card container (`<div className="p-4 rounded-2xl border border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)] space-y-2">`), title text (`Inter-Branch Stock Transfers`), icon (`AnimatedRefresh`), and description paragraph (`Transfer parts between company branches with dual-branch confirmation.`) from the Inter-Branch Transfers tab view per user feedback.
  - **Verification**: Executed `npx tsc --noEmit` with **0 TypeScript compilation errors**.

- **Page Feedback: Clean Up `/inventory?tab=issues` Subheader & Top Bar Icon (`components/inventory/StockLedgerClient.tsx`) (2026-08-16)**:
  - **Removed Redundant Subheader Flex Card**: Removed the subheader flex card banner container (`<div className="flex items-center justify-between p-4 ...">`), including the description paragraph (`Parts issued to machines, breakdown complaints, or technicians with auto-generated Challans`), the `AnimatedWrench` title icon, and the duplicate `+ Issue Parts` action button.
  - **Header Icon Box Removal**: Removed the `p-1.5` rounded icon wrapper (`<div className="p-1.5 rounded-lg bg-sky-500/10 ...">`) and `ActiveTabIcon` from the top single-line page header bar, keeping the header clean and aligned with `Inventory / <TabName>`.
  - **Verification**: Executed `npx tsc --noEmit` with **0 TypeScript compilation errors**.

- **Fix StockLedgerClient Prev/Next Pagination Button Theme Visibility (`components/inventory/StockLedgerClient.tsx`) (2026-08-16)**:
  - **High-Contrast Theme Tokens**: Applied explicit `text-[var(--color-ink)]` text color and `bg-[var(--color-canvas-elevated)]` background styling to Prev and Next buttons, removing inherited text muting (`text-[var(--color-mute)]`).
  - **Lucide Icons Integration**: Added `<ChevronLeft className="h-3.5 w-3.5" />` to the `Prev` button and `<ChevronRight className="h-3.5 w-3.5" />` to the `Next` button for visual clarity and accessibility.
  - **Tactile Micro-Interactions**: Applied `hover:bg-[var(--color-hairline-soft-surface)]`, `active:scale-95`, `disabled:opacity-40 disabled:cursor-not-allowed`, and `shadow-xs` to improve button tactile feedback.
  - **Rows Per Page & Page Badge Styling**: Updated the rows per page `<select>` dropdown and `{safePage} / {totalPages}` badge with `rounded-lg`, explicit borders (`border-[var(--color-hairline)]`), and elevated canvas background styling.
  - **Verification**: Executed `npx tsc --noEmit` with **0 TypeScript compilation errors**.

- **Add Manufacturer Column to Database & Part Master Catalog UI (`components/inventory/StockLedgerClient.tsx`, `components/inventory/PartDetailModal.tsx`, `supabase/migrations/016_add_manufacturer_to_inventory.sql`, `supabase/migrations/015_seed_dummy_data.sql`, `supabase/seed_dummy_data.mjs`) (2026-08-16)**:
  - **SQL Migration & Backfill (`016_add_manufacturer_to_inventory.sql`)**: Created migration script ensuring `manufacturer` column exists on `public.inventory_products` and backfilling existing items with realistic manufacturers (`JCB`, `Hyundai`, `Caterpillar`, `Volvo`, `Komatsu`).
  - **Seed Data Updates (`015_seed_dummy_data.sql`, `seed_dummy_data.mjs`)**: Updated SQL seed script and Node.js seeding script to include explicit manufacturer properties (`JCB`, `Hyundai`, `Caterpillar`, `Hyundai`, `JCB`).
  - **Part Master Table UI (`StockLedgerClient.tsx`)**: Added sortable `Manufacturer` header column and styled brand badges (amber for JCB, sky for Hyundai, yellow for Caterpillar, blue for Volvo, purple for Komatsu) in table rows.
  - **Toolbar Manufacturer Filter (`StockLedgerClient.tsx`)**: Integrated Manufacturer filter dropdown (`All Manufacturers`, `JCB`, `Hyundai`, `Caterpillar`, `Volvo`, `Komatsu`, `Genie`, `JLG`, `Haulotte`, `Mahindra`, `Tata`) alongside Category, Rack, and Stock Status filters with instant reset.
  - **Search & Sort Integration (`StockLedgerClient.tsx`)**: Included `manufacturer` in search text matching, column sorting logic (`handleSort("manufacturer")`), Add Part form modal (`showAddPartModal`), and CSV export headers/rows (`handleBulkExportCSV`).
  - **Part Specs Highlight (`PartDetailModal.tsx`)**: Prominently displayed Manufacturer in the Technical Specifications card.
  - **Verification**: Executed `npx tsc --noEmit` with **0 TypeScript compilation errors**.

- **Theme Toggle Switch Micro-Animation Fix (`components/theme/ThemeToggle.tsx`, `app/globals.css`)**:
  - **Eliminated CSS Transition Conflict**: Removed Tailwind `transition-all duration-200` class from the sliding thumb `<motion.div>`, resolving the conflict between CSS transitions and Framer Motion spring calculations (`stiffness: 500, damping: 28, mass: 0.7`).
  - **Parallel Icon Morphing**: Replaced `<AnimatePresence mode="wait">` with `mode="popLayout"` to perform Sun and Moon icon exit and entrance transitions simultaneously without a 150ms sequential delay.
  - **Exempted Theme Controls from Transition Lock**: Added `data-theme-toggle="true"` attributes to theme toggle elements and exempted them from the global `html.theme-changing` transition lock CSS rule in `app/globals.css`.
  - **Verification**: Verified 0 TypeScript compilation errors (`npx tsc --noEmit`).

- **Sidebar Logo Graphic Icon Integration & Arrow Removal (`components/branding/ReachInternationalLogo.tsx`, `components/branding/ScissorLiftLogoIcon.tsx`)**:
  - **Scissor-Lift Icon Integration**: Updated `showIcon` default prop from `false` to `true` in `ReachInternationalLogo`, displaying the vector scissor-lift graphic icon (`<ScissorLiftLogoIcon>`) in front of the logo across the sidebar header, navbar, and auth pages.
  - **Arrow Icon Removal**: Removed the text arrow element (`↑`) from the `REACH INTERNATIONAL` logo title row and updated compact fallback tag from `RI↑` to `RI`.
  - **Verification**: Verified 0 TypeScript compilation errors (`npx tsc --noEmit`).

- **Synchronous & Atomic Global Theme Switching Architecture (`app/globals.css`, `components/theme/ThemeProvider.tsx`, `app/layout.tsx`, `components/ui/sidebar.tsx`, `components/layout/AppHeader.tsx`, `SearchableSelect.tsx`, `MetricCard.tsx`)**:
  - **Atomic Global Transition Lock (`app/globals.css`, `ThemeProvider.tsx`)**: Created `html.theme-changing` transition lock CSS rule (`transition: none !important; animation: none !important;`) applied synchronously during theme toggles. Utilized double `requestAnimationFrame` to remove the lock after the browser repaints all CSS custom properties in a single frame (0ms delay across all components).
  - **Removal of Lagging Color Transitions (`app/globals.css`, `app/layout.tsx`, `components/ui/sidebar.tsx`)**: Removed `transition: background-color ..., color ...` from `body` and `transition-colors duration-200` from `AppSidebar` container and layout shell, eliminating millisecond delays where background/sidebar colors lagged behind text and cards.
  - **View Transitions Overhead Elimination**: Removed `document.startViewTransition` snapshot crossfading from `ThemeProvider.tsx`, enforcing an instant, 100% synchronous DOM theme recalculation.
  - **Targeted Micro-Interactions**: Scoped component transitions (`SearchableSelect.tsx`, `AppHeader.tsx`, `MetricCard.tsx`) to specific properties (`transition-[border-color,box-shadow]`, `transition-transform`) while preserving `ThemeToggle` spring physics and sidebar collapse layout animations.
  - **Verification**: Verified 0 TypeScript compilation errors (`npx tsc --noEmit`).

- **Duplicate Error Removal & 10-Digit Mobile Number Validation (`app/actions/auth.ts`, `app/signup/page.tsx`, `app/login/login-form.tsx`, `app/forgot-password/page.tsx`)**:
  - **Eliminated Duplicate Error Display**: Suppressed top pink error alert container when field-level errors (`fieldErrors`) are present on input fields.
  - **Strict 10-Digit Mobile Validation**: Updated `signup` action in `app/actions/auth.ts` to validate mobile phone numbers for a valid 10-digit number.
  - **Verification**: Verified 0 TypeScript compilation errors (`npx tsc --noEmit`).

- **Auth Form Data Retention & Invalid Field Cell Highlighting (`app/actions/auth.ts`, `components/ui/Input.tsx`, `components/ui/SearchableSelect.tsx`, `app/signup/page.tsx`, `app/login/login-form.tsx`, `app/forgot-password/page.tsx`)**:
  - **Data Retention Contract**: Updated `signup`, `login`, and `forgotPassword` server actions in `app/actions/auth.ts` to return field-specific error mappings (`fieldErrors`) and field value data (`fieldValues`).
  - **Red Cell Error Styling**: Enhanced `<Input />` and `<SearchableSelect />` to highlight invalid input cells in red (`!border-rose-500`, `!bg-rose-500/5`, focus ring, red icon, and inline error text).
  - **Form Data Preservation**: Converted Sign Up, Sign In, and Reset Password form components to controlled inputs, preserving all user-typed data on error.
  - **Dynamic Error Clearing**: Clears red error cell highlights dynamically on user input change.
  - **Verification**: Verified 0 TypeScript compilation errors (`npx tsc --noEmit`).

- **Signup Page Layout & Auth Form Controls Polish (`app/signup/page.tsx`, `app/login/page.tsx`, `app/login/login-form.tsx`, `app/forgot-password/page.tsx`)**:
  - **Signup Half-Screen Card Layout**: Expanded signup form card (`motion.div`) in `app/signup/page.tsx` from `max-w-md` (448px) to `w-full max-w-xl lg:max-w-2xl xl:max-w-3xl`, filling the right half-screen panel on desktop viewports.
  - **2-Column Input Grid for Signup**: Arranged all signup input fields (Full Name, Email address, Mobile Number, Account Role Requested, Password, Confirm Password) into a responsive 2-column grid (`grid grid-cols-1 md:grid-cols-2 gap-4`).
  - **1-Column Input for Sign In (Login)**: Maintained 1-column input layout (`flex flex-col gap-4`) for Login form (`app/login/login-form.tsx`) inside a sleek `max-w-md` card container.
  - **Responsive Home & Theme Toggle Controls**: Updated top right floating controls to display Home button (`Link href="/"`) and `ThemeToggle` switch clearly on all viewports for `/signup`, `/login`, and `/forgot-password`.
  - **Verification**: Verified 0 TypeScript compilation errors (`npx tsc --noEmit`).


- **Full Database Migration Audit & Comprehensive Dummy Data Seeding (`supabase/migrations/015_seed_dummy_data.sql`, `supabase/seed_dummy_data.mjs`, `supabase/verify_seed.mjs`)**:
  - **Migration Audit & Schema Mapping**: Inspected all 14 database migration files (`001` through `014`) and cataloged all 38 system tables.
  - **Master SQL Migration File (`015_seed_dummy_data.sql`)**: Created idempotent SQL seed file with `INSERT ... ON CONFLICT DO NOTHING` statements for branches, manufacturers, categories, vendors, inventory master, and system settings.
  - **Node.js Automated Seed Engine (`supabase/seed_dummy_data.mjs`)**: Created automated Node.js seed script utilizing `@supabase/supabase-js` service role client. Provisioned auth test accounts across all 11 system roles (`Password@123456`), updated profile records, linked user branches, and seeded relational domain records across all 38 tables.
  - **Table Verification Engine (`supabase/verify_seed.mjs`)**: Built table verification engine confirming non-zero row counts across all 38 system tables.
  - **Verification**: Executed `node supabase/seed_dummy_data.mjs` (0 errors), `node supabase/verify_seed.mjs` (38/38 tables verified), and `npx tsc --noEmit` (0 TypeScript compilation errors).


- **Multi-Role Signup Access Approval & Multi-Domain Email Support (`app/signup/page.tsx`, `app/actions/auth.ts`, `app/actions/users.ts`, `UserCreateModal.tsx`, `lib/email.ts`)**:
  - **Signup Role Selector**: Integrated `SearchableSelect` on `app/signup/page.tsx` enabling every role (`Service Engineer`, `Branch Manager`, `Store Manager`, `Supervisor`, `Operator`, `Mechanic`, `HR Manager`, `Accounts / Finance Manager`, `Sales Executive`, `Rental Manager`, `Client Account`, `Administrator`) to send access approval requests.
  - **Dynamic Signup Action**: Updated `signup` action in `app/actions/auth.ts` to parse `role`, validate against allowed roles, store it in user metadata, and record it in audit logs.
  - **Admin Approval Notification**: Updated `sendPendingApprovalEmailToAdmins` in `lib/email.ts` to display the requested role in email notifications sent to admins.
  - **Multi-Domain Email Validation**: Removed hardcoded `@gmail.com` restriction in `app/actions/users.ts` (`createUser`) and updated `app/actions/auth.ts` with standard email regex `/^[^\s@]+@[^\s@]+\.[^\s@]+$/`, supporting `@gmail.com`, `@yahoo.com`, `@customdomain.in`, and corporate custom domain emails. Updated input label and placeholder in `UserCreateModal.tsx`.
  - **Verification**: Verified 0 TypeScript compilation errors (`npx tsc --noEmit`).

- **Inventory Header UI/UX Optimization & Submenu Sidebar Migration (`components/inventory/StockLedgerClient.tsx`, `components/layout/AppSidebar.tsx`)**:
  - **Submenu Migration to Sidebar**: Shifted inventory sub-navigation tabs to sidebar navigation and removed on-page horizontal tab bar element from `StockLedgerClient.tsx`. Added `Transfers` to `AppSidebar.tsx` inventory subItems so all 9 inventory modules (`Dashboard`, `Part Master`, `Storage & Bins`, `Procurement`, `Goods Receipt (GRN)`, `Part Issues`, `Returnable Parts`, `Stock Ledger`, `Transfers`) are accessed directly via sidebar.
  - **Description Paragraph Removal**: Removed generic sub-header description text (`Manage parts catalog, stock levels, and storage locations`) per page feedback.
  - **Clean Single-Line Header Bar**: Restructured header bar into a clean, single-line flex row (`flex-nowrap` on desktop) with dynamic icon and tab title mapping (`TAB_CONFIG`), breadcrumb (`Inventory / <TabTitle>`), and action buttons (`+ Add Part`, `Receive GRN`, `Issue Part`, `Request Order`).
  - **URL Parameter Synchronization**: Wired `handleTabChange` with `window.history.pushState` so clicking alert cards updates URL search parameters and synchronizes active sidebar highlights automatically.
  - **Verification**: Verified 0 TypeScript compilation errors (`npx tsc --noEmit`).


- **Sidebar Brand Logo Graphic Removal & Font Size Unification (`components/branding/ReachInternationalLogo.tsx`)**:
  - **Graphic Icon Removal**: Removed `<ScissorLiftLogoIcon>` by default from `ReachInternationalLogo` in the sidebar header per page feedback. Added optional `showIcon` boolean prop (defaulting to `false`).
  - **Identical Font Size**: Standardized font sizes for "REACH" and "INTERNATIONAL" to be identical (`text-[0.85em]`), fixing the visual size discrepancy between the two words.
  - **Compact Sidebar Fit**: Adjusted text size and tracking to ensure `REACH INTERNATIONAL ↑` fits cleanly inside the sidebar container without wrapping or horizontal overflow.
  - **Verification**: Verified 0 TypeScript compilation errors (`npx tsc --noEmit`).
- **Inventory Part Master UI/UX Overhaul & Daily Store Operator Focus (`components/inventory/StockLedgerClient.tsx`)**:
  - **Compact Page Header & Hierarchy**: Replaced oversized title block and description paragraph with a compact page header (`Part Master`, 18-22px) and `Inventory / Part Master` breadcrumb. Established explicit button hierarchy (`+ Add Part` primary, `Receive GRN` & `Issue Part` secondary, `Request Order` tertiary).
  - **Compact Navigation & 4-Stat Summary Strip**: Shortened tab text labels (`Dashboard`, `Parts (5)`, `Storage`, `Procurement`, `GRN`, `Issuance`, `Returns`, `Audit Ledger`, `Transfers`). Added compact inventory summary strip (`Total Parts`, `In Stock`, `Low Stock`, `Out of Stock`) with 1-click status filtering.
  - **Stock Status Filtering & Multi-Column Sorting**: Integrated Stock Status filter (`All Stock`, `In Stock`, `Low Stock`, `Out of Stock`) with quick filter reset. Added interactive table column sorting (Part Number, Part Name, Available Stock, Unit Cost) with `↑` / `↓` indicators.
  - **Table Polish, Row Interactivity & Bulk Operations**: Prominent stock quantity highlights (`101 pcs`, `12 pcs`, `0 pcs`). Compact status pills with colored status dots (🟢 In Stock, 🟡 Low Stock, 🔴 Out of Stock). Wrapped action buttons with tooltips and enabled full-row click to open Part Details modal. Integrated bulk selection checkboxes with bulk action bar (`Relocate Location`, `Request Order`, `Export CSV`, `Deselect`). Added pagination controls (`Showing 1–25 of 128 parts`, `Rows per page: 25`, Prev/Next).
  - **Verification**: Verified 0 TypeScript errors (`npx tsc --noEmit`) and successful production build (`npm run build`, 30/30 static & dynamic routes compiled).
- **Sidebar Optimization, Collapse/Expand & Portal Navigation System (`components/layout/AppSidebar.tsx`, `components/layout/sidebar/*`)**:
  - **React Portal Flyout System (`CollapsedFlyoutPortal.tsx`)**: Created `CollapsedFlyoutPortal` component rendering floating sub-menu flyouts onto `document.body` via `createPortal`. Completely eliminates container `overflow: hidden` clipping while dynamically positioning flyouts relative to clicked sidebar icons and clamping top/bottom positions inside the screen viewport.
  - **Modular Architecture Refactoring (`components/layout/sidebar/`)**: Deconstructed `AppSidebar.tsx` into clean modular components: `types.ts`, `SidebarHeader.tsx` (brand logo with hover collapse/expand morph), `QuickAccessTrigger.tsx` (quick search ⌘K trigger button/icon), `SidebarNavigation.tsx` (route-aware active hierarchy and sub-menu state management), `NavigationItem.tsx` (collapsible expanded menu vs portal flyout trigger), `UserProfileDropdown.tsx` (bottom profile card with portal popover), and `MobileSidebarDrawer.tsx` (off-canvas drawer with backdrop overlay for screens <768px).
  - **State Preservation & Active Hierarchy**: Preserved accordion expansion state (`openMenus`) across collapse/expand transitions. Highlighted active parent icons when sub-routes are active.
  - **Verification**: Verified 0 TypeScript errors (`npx tsc --noEmit`) and successful production build (`npm run build`, 30/30 static & dynamic routes compiled).
- **Delivery Challans DAL Query & Schema Alignment Fix (`lib/queries/challans.ts`, `supabase/migrations/014_store_manager_inventory_erp.sql`)**:
  - **Column Alignment**: Updated `getCachedDeliveryChallans` in `lib/queries/challans.ts` to query existing columns (`to_customer_name`, `to_address`, `approx_value`, `status`, `issue_date`, `created_at`) with fallback mapping for `client_name`, `destination`, `amount`, and `expected_delivery`, eliminating Postgrest `PGRST204` schema cache errors.
  - **Explicit Error Logging**: Upgraded console error handler to print `error.message || error.details || JSON.stringify(error)` instead of logging empty `{}` objects.
  - **Database Migration Schema Expansion (`014_store_manager_inventory_erp.sql`)**: Added `client_name`, `destination`, `amount`, and `expected_delivery` column alter statements to `public.challans` table for bi-directional compatibility.
  - **Verification**: Verified 0 TypeScript errors (`npx tsc --noEmit`).
- **Global Tooltip System Audit & Implementation (`components/ui/Tooltip.tsx`, `@radix-ui/react-tooltip`, `app/layout.tsx`, `AppHeader.tsx`, `AppSidebar.tsx`, `ThemeToggle.tsx`, `StockLedgerClient.tsx`, `MachineListClient.tsx`, `MachineRow.tsx`, `ChallansClient.tsx`, `DocumentsClient.tsx`, `CrmClient.tsx`, `VendorsClient.tsx`, `UserRow.tsx`, `EnterpriseTable.tsx`)**:
  - **Canonical Tooltip System (`components/ui/Tooltip.tsx`)**: Built unified Radix Tooltip suite (`TooltipProvider`, `Tooltip`, `TooltipTrigger`, `TooltipContent`, `TooltipWrapper`, `InfoTooltip`, `MetricTooltip`, `SidebarTooltip`, `TruncatedTooltip`) with GPU-accelerated Framer Motion transitions and light/dark theme token integration.
  - **Application Provider (`app/layout.tsx`)**: Wrapped root providers with `<TooltipProvider delayDuration={200}>`.
  - **Header & Navigation Controls (`AppHeader.tsx`, `AppSidebar.tsx`, `ThemeToggle.tsx`)**: Upgraded collapsed navigation items, quick search (`⌘K`), theme toggle ("Switch to dark mode" ↔ "Switch to light mode"), notification bells, and sidebar collapse buttons with accessible tooltips without redundant browser `title` attributes.
  - **Data Tables & Action Columns (`StockLedgerClient.tsx`, `MachineListClient.tsx`, `MachineRow.tsx`, `ChallansClient.tsx`, `DocumentsClient.tsx`, `CrmClient.tsx`, `VendorsClient.tsx`, `UserRow.tsx`, `EnterpriseTable.tsx`)**: Added entity-specific tooltips for View part details, Relocate rack/bin, View delivery details, Download printable PDF challan, View document, Download document, Close details, More actions, and dynamic `CopyCell` ("Copy SKU" ↔ "Copied!").
  - **Verification**: Verified 0 TypeScript errors (`npx tsc --noEmit`) and successful production build (`npm run build`, 30/30 static & dynamic routes compiled).
- **Store Manager Complete Inventory, Procurement & Parts Management ERP Module (`supabase/migrations/014_store_manager_inventory_erp.sql`, `lib/types/database.ts`, `lib/queries/inventory.ts`, `app/actions/inventory.ts`, `components/inventory/*`, `app/(app)/inventory/page.tsx`, `app/(app)/dashboard/page.tsx`, `AppSidebar.tsx`)**:
  - **Database Migration (`014_store_manager_inventory_erp.sql`)**: Self-contained idempotent migration script including `CREATE TABLE IF NOT EXISTS` definitions for `public.vendors`, `public.purchase_orders`, and `public.challans` alongside extending `inventory_products` (OEM part no, alternate part no, barcode, reorder level, reorder qty, max stock, reserved stock, unit cost, last purchase price, rack, shelf, bin, zone, compatible machines/models, criticality, part type) and creating `inventory_storage_locations`, `inventory_purchase_requests`, `inventory_purchase_request_items`, `inventory_purchase_order_items`, `inventory_goods_receipts`, `inventory_goods_receipt_items`, `inventory_part_issues`, `inventory_part_issue_items`, `inventory_part_returns`, `inventory_part_return_items`, `inventory_delivery_challan_items` with full RLS policies and performance indexes.
  - **Data Access Layer (`lib/queries/inventory.ts`, `lib/types/database.ts`)**: Built cached DAL query functions (`getStoreManagerDashboardMetrics`, `getPartMasterList`, `getStorageLocations`, `getPurchaseRequests`, `getGoodsReceipts`, `getPartIssues`, `getPartReturns`, `getManagersList`) and extended database types.
  - **Atomic Server Actions (`app/actions/inventory.ts`)**: Implemented server actions for Part Master management, Storage location relocation, Purchase Requests with specific selected manager routing (`requested_by` -> `sent_to_manager_id`) and in-app notifications, Manager approvals/rejections, Purchase Orders (`PO-2026-XXXX`), Goods Receipts (`GRN-2026-XXXX`) with supplier bill PDF uploads and atomic stock increments, Part Issuance (`PI-2026-XXXX` / `2201`) with atomic stock deductions and Delivery Challans (`RI/DC/XXXX`), and Returnable Parts returns with stock restoration.
  - **Digitized A4 Printable Document Templates (`components/inventory/`)**:
    - **`PrintablePurchaseOrder.tsx`**: A4 printable Purchase Order matching physical image reference (`image_1.png`) featuring Reach International logo, vendor details, billing/shipping address, itemized pricing & tax breakdown, rupees in words, terms, and signatures.
    - **`PrintableDeliveryChallan.tsx`**: A4 printable Delivery Challan (`RI/DC/XXXX`) matching physical image reference (`image.png`) featuring Reach International logo, From Branch, To Customer/Site (PUSHPA INFRACON), Goods table, Approx Value, Note "not for sale; it is use for in our own machine", and GSTIN/PAN footer.
    - **`PrintablePartsIssueChallan.tsx`**: A4 printable Parts Issue Challan (`2201`) matching physical image reference (`image_2.png`) featuring S.No, Date, Yard, Part No, Description, Qty, Machine No, Issue To, Return (YES/NO), and signatures.
  - **UI ERP Hub & Modals (`components/inventory/`)**: Built `StockLedgerClient.tsx` (9 interactive tabs for Store Dashboard, Part Master, Storage Locations, Procurement, Goods Receipts, Part Issuance, Returnable Parts Tracker, Stock Ledger Audit History, and Inter-Branch Transfers) and modal components (`PartDetailModal.tsx`, `PurchaseRequestModal.tsx`, `GoodsReceiptModal.tsx`, `PartIssueModal.tsx`).
  - **Verification**: Executed `npx tsc --noEmit` (0 errors) and `npm run build` (30/30 static & dynamic routes compiled successfully).
- **Complete Rebranding to REACH INTERNATIONAL — REACHING ALL HEIGHTS (`components/branding/*`, `components/ui/Logo.tsx`, `AppSidebar.tsx`, `PublicNavbar.tsx`, `LandingFooter.tsx`, `app/login/page.tsx`, `app/signup/page.tsx`, `app/forgot-password/page.tsx`, `app/layout.tsx`, `app/page.tsx`, `app/not-found.tsx`, `lib/brand.ts`, `public/light-favicon.svg`, `public/dark-favicon.svg`)**:
  - **Vector SVG Scissor-Lift Icon (`components/branding/ScissorLiftLogoIcon.tsx`)**: Created pure vector SVG component representing industrial Scissor Lift platform (base chassis, wheels, X-scissor arms, hydraulic lift cylinder, top platform guardrails) with brand-blue upward height indicator arrow. Fully scalable, theme-aware (`currentColor` structural lines + accent blue arrow), 0 PNG raster images, 0 base64.
  - **Canonical Brand Component (`components/branding/ReachInternationalLogo.tsx`, `components/branding/index.ts`)**: Built `ReachInternationalLogo` supporting `full`, `compact`, and `wordmark` display variants, rendering the visual hierarchy: `[SCISSOR LIFT ICON] + REACH + INTERNATIONAL + ↑ + divider line + REACHING ALL HEIGHTS`. Accessible, lightweight, light & dark theme compatible.
  - **Wrapper Refactoring (`components/ui/Logo.tsx`, `components/ui/index.ts`)**: Refactored `Logo.tsx` to wrap `ReachInternationalLogo`, maintaining 100% backward compatibility for all existing imports.
  - **Favicon Vector Assets (`public/light-favicon.svg`, `public/dark-favicon.svg`, `public/site.webmanifest`)**: Replaced raster base64 embedded SVGs with pure vector SVGs tailored for light/dark themes. Updated webmanifest name to `"REACH INTERNATIONAL"` and short_name to `"REACH"`.
  - **Single Source of Truth (`lib/brand.ts`)**: Updated brand constants (`BRAND_NAME = "REACH INTERNATIONAL"`, `BRAND_TAGLINE = "REACHING ALL HEIGHTS"`).
  - **Full Application Migration**: Replaced legacy ServiceCentric branding across sidebar, navbar, landing footer, app header, auth hero panels (login, signup, forgot password), sitemap, metadata title (`REACH INTERNATIONAL — Reaching All Heights`), OpenGraph, JSON-LD, 404 page, and email templates (`lib/email.ts`, `lib/notifications/email-templates.tsx`, `FieldServiceReportModal.tsx`, `NotificationPreviewModal.tsx`, `CommandPalette.tsx`).
  - **Verification**: Executed `npx tsc --noEmit` (0 errors) and `npm run build` (30/30 static & dynamic routes compiled successfully).
- **Official ServiceCentric Branding, Light/Dark Theme Logo & Favicon Migration (`lib/brand.ts`, `components/ui/Logo.tsx`, `components/ui/index.ts`, `AppSidebar.tsx`, `PublicNavbar.tsx`, `LandingFooter.tsx`, `app/login/page.tsx`, `app/signup/page.tsx`, `app/layout.tsx`, `site.webmanifest`)**:
  - **Single Source of Truth (`lib/brand.ts`)**: Mapped all official ServiceCentric branding assets stored in `/public` (`/light-favicon.svg`, `/dark-favicon.svg`, `/light-favicon.ico`, `/dark-favicon.ico`, `/light-favicon-96x96.png`, `/dark-favicon-96x96.png`, `/light-apple-touch-icon.png`, `/dark-apple-touch-icon.png`, `/light-web-app-manifest-192x192.png`, `/dark-web-app-manifest-192x192.png`, `/light-web-app-manifest-512x512.png`, `/dark-web-app-manifest-512x512.png`, `/site.webmanifest`).
  - **Theme-Aware `<Logo />` Component**: Created canonical `Logo` component rendering dual SVG elements (`lightLogo` and `darkLogo`) with Tailwind `dark:hidden` / `hidden dark:block` classes to guarantee instant theme switching with 0 hydration errors, 0 layout shifts, and 0 artificial CSS filter hacks.
  - **Full Application Migration**: Replaced legacy `/favicon.svg` references across all layout and navigation components (`AppSidebar.tsx`, `PublicNavbar.tsx`, `LandingFooter.tsx`, `app/login/page.tsx`, `app/signup/page.tsx`).
  - **Browser Favicons & Next.js Metadata**: Updated `metadata.icons` and `<head>` links to serve light and dark favicons dynamically via `media="(prefers-color-scheme: light/dark)"`. Updated `site.webmanifest` name to `"ServiceCentric"` and point icon URLs to official manifest PNGs.
  - **Verification**: Verified `npx tsc --noEmit` exits clean (0 errors) and `npm run build` completed successfully (30/30 static & dynamic routes compiled).

- **Website-Wide Dialog Animation & Transition Migration (`components/animate-ui/components/radix/dialog.tsx`, `components/ui/dialog.tsx`, `components/ui/Modal.tsx`, `MobileFilterDrawer.tsx`, `UserDetailSheet.tsx`)**:
  - **Animate UI Radix Dialog Suite**: Built Animate UI Radix Dialog primitive component suite (`Dialog`, `DialogTrigger`, `DialogContent`, `DialogHeader`, `DialogTitle`, `DialogDescription`, `DialogClose`, `DialogFooter`, `DialogOverlay`, `DialogPortal`, `DialogContentProps`) wrapping `@radix-ui/react-dialog` with GPU-accelerated Framer Motion transitions.
  - **Directional `from` & Motion System**: Implemented entry directions (`from="center" | "top" | "bottom" | "left" | "right"`), backdrop overlay fade (`opacity: 0 ↔ 1`), cubic-bezier ease-out timing (`ease: [0.16, 1, 0.3, 1]`), scale/translate transforms, and accessibility reduced-motion fallbacks.
  - **Shared Modal Migration**: Refactored `components/ui/Modal.tsx` to consume Animate UI Radix Dialog primitives. Automatically upgraded all 26+ dialogs across the website (`MachineModal`, `UserCreateModal`, `UserEditModal`, `MachineComplaintModal`, `FieldServiceReportModal`, `MachineCategoryModal`, `MachineImportModal`, `NotificationPreviewModal`, `ConfirmationDialog`, `GlobalCreateModal`, `ComplaintsClient`, `HRClient`, `ServicesClient`, `StockLedgerClient`, `AuditLogsClient`, `DocumentsClient`, etc.) while retaining 100% of existing visual design tokens, dark/light themes, buttons, inputs, form validations, and keyboard accessibility.
  - **Mobile Drawers & Sheets**: Refactored `MobileFilterDrawer.tsx` and `UserDetailSheet.tsx` to use `<DialogContent from="bottom">` for unified bottom-sheet transitions.
  - **Verification**: Verified clean TypeScript compilation (`npx tsc --noEmit`) with 0 errors and production build completed successfully.
- **Landing Page Visual & UI Bug Fixes (`HeroSection.tsx`, `EquipmentGallery.tsx`, `EngineerMobileSection.tsx`, `animated-icon.tsx`)**:
  - **Hero Headline Visibility**: Fixed WebKit gradient text-clip glitch in `HeroSection.tsx` by separating linear gradient text spans from the relative SVG underline container box, making "Another" in "Never Miss Another Deadline." 100% visible and readable.
  - **Equipment Gallery Icons**: Updated `AnimateIcon` in `animated-icon.tsx` to automatically set inline `width` and `height` based on `size` prop. Styled `EquipmentGallery.tsx` card icon containers with high-contrast glass pill wrappers and hover transitions so all machine icons render clearly.
  - **Engineer Mobile Section Redesign**: Removed ambient glow overlay element (`absolute top` halo). Upgraded mobile device frame in `EngineerMobileSection.tsx` to a photorealistic smartphone chassis with physical side buttons (action, volume up/down, power button), metallic titanium chamfers, dynamic island notch pill, status bar, and polished native app layout.
  - **Verification**: Verified clean TypeScript compilation (`npx tsc --noEmit`) with 0 errors.
- **Animate UI / Radix Sidebar Upgrade & Collapsed Flyout Submenus (`components/ui/sidebar.tsx`, `components/layout/AppSidebar.tsx`, `components/layout/AppShellClient.tsx`)**:
  - Built comprehensive Animate UI / Radix primitive library in `components/ui/sidebar.tsx` (`SidebarProvider`, `Sidebar`, `SidebarHeader`, `SidebarContent`, `SidebarFooter`, `SidebarGroup`, `SidebarGroupLabel`, `SidebarGroupContent`, `SidebarMenu`, `SidebarMenuItem`, `SidebarMenuButton`, `SidebarMenuSub`, `SidebarMenuSubItem`, `SidebarMenuSubButton`, `Collapsible`, `CollapsibleTrigger`, `CollapsibleContent`, `useSidebar`).
  - Upgraded canonical sidebar (`AppSidebar.tsx`) with spring accordion collapsible transitions, 90° chevron rotation (`group-data-[state=open]/collapsible:rotate-180`), and polished SaaS hover effects.
  - Implemented floating flyout submenu panels (`left-full ml-3`) when sidebar is collapsed for `CRM`, `Machines`, `Service`, `Inventory`, `Vendors`, `Purchase Orders`, and `HR`.
  - Preserved 100% of ServiceCentric logo branding (`/favicon.svg`), color design tokens, light & dark theme, RBAC permissions, routes, Quick Access Command Palette trigger (`⌘K`), and User Profile Dropdown footer.
  - Wrapped `AppShellClient` with `SidebarProvider` while preserving persistent state in `localStorage` (`servicecentric_sidebar_collapsed`).
  - Verified `npx tsc --noEmit` exits with 0 TypeScript compilation errors.

## 2026-08-13
- **Complete Production-Quality Animated Icon Library Migration Across Entire Codebase**:
  - **Icon Registry & Motion Engine Expansion (`components/ui/animated-icon.tsx`, `components/ui/animated-icons/index.ts`)**: Expanded `AnimateIcon` motion engine with 12 micro-animation variants (`spin`, `bounce`, `pulse`, `wiggle`, `scale`, `float`, `rotate-clock`, `rotate-counter`, `slide-right`, `slide-left`, `fade`, `draw-path`) and 4 interactive triggers (`hover`, `click`, `view`, `continuous`). Built preset icon wrappers (`AnimatedWrench`, `AnimatedCalendarClock`, `AnimatedTruck`, `AnimatedAlertTriangle`, `AnimatedCheckCircle`, `AnimatedBuilding2`, `AnimatedUsers`, `AnimatedPackage`, `AnimatedShoppingBag`, `AnimatedSearch`, `AnimatedFilter`, `AnimatedMail`, `AnimatedPhone`, `AnimatedShieldCheck`, `AnimatedShieldAlert`, `AnimatedBarChart3`, etc.) in central index.
  - **Full UI & Primitive Component Migration**: Migrated all core primitives (`MetricCard`, `EnterpriseTable`, `CommandPalette`, `Dialog`, `Toast`, `Calendar`, `Tooltip`, `EmptyState`, `Pagination`, `Breadcrumb`, `PageHeader`, `PublicNavbar`, `AppSidebar`, `MobileBottomNav`).
  - **Landing Page & Public Routes Migration**: Migrated `HeroSection`, `FeatureShowcaseSection`, `WorkflowSection`, `NotificationEngineSection`, `EquipmentGallery`, `EnterpriseSecuritySection`, `EngineerMobileSection`, `CtaSection`, `AnalyticsShowcaseSection`, `FaqSection`, `LandingFooter`, `LoginPage`, `LoginForm`, `SignupPage`, `ForgotPasswordPage`, `NotFoundPage`.
  - **Application Module Migration**: Migrated `AdminClient`, `AuditLogsClient`, `BranchesClient`, `ChallansClient`, `ComplaintsClient`, `MachineComplaintModal`, `FieldServiceReportModal`, `CrmClient`, `DocumentsClient`, `HRClient`, `InventoryClient`, `MachineListClient`, `machine-client-view`, `MyWorkClient`, `NotificationListClient`, `PurchaseOrdersClient`, `ReportsClient`, `ServicesClient`, `VendorsClient`, `OperatorDashboard`, `MechanicDashboard`, `MobileDueBuckets`, `MobileDashboardHeader`, `MobileChartsWrapper`, `Charts`, `users-client`, `UserRow`, `UserEditModal`, `UserDetailSheet`, `UserCreateModal`, `MobileUserCard`.
  - **Verification**: Verified `npx tsc --noEmit` exits with 0 TypeScript compilation errors and production build succeeds.

- **Reusable `Avatar` & `AvatarGroup` UI Component Suite & Unused Code Cleanup (`components/ui/Avatar.tsx`, `components/ui/index.ts`, `components/landing/HeroSection.tsx`)**:
  - **Avatar Primitive (`components/ui/Avatar.tsx`)**: Built reusable `<Avatar />`, `<AvatarImage />`, `<AvatarFallback />`, and `<AvatarGroup />` (aliased as `<GroupAvatar />` and `<AvatarStack />`).
  - **Interactive Micro-Animations & Fallbacks**: Integrated Framer Motion spring physics on hover, fallback initial color-hashing, status indicator dots (`online`, `offline`, `busy`, `away`), interactive tooltips, and `+N` count badge.
  - **Landing Page Refactoring & Dead Code Removal (`components/landing/HeroSection.tsx`)**: Replaced raw `<img>` cluster with `<AvatarGroup />` social proof avatar stack, and removed older unused `AVATARS` constant.
  - **Type Safety Verification**: Executed `npx tsc --noEmit` and confirmed 0 TypeScript compiler errors.


- **Fix `animated-icon` Module Exports & Turbopack Build Error (`components/ui/animated-icon.tsx`, `components/ui/animated-icons/index.ts`)**:
  - **Restored Named Exports (`components/ui/animated-icon.tsx`)**: Re-exported `AnimateIcon`, `AnimatedIcon`, `createAnimatedIcon`, `AnimateIconProps`, `AnimatedIconProps`, `IconAnimationVariant`, `IconAnimationPreset`, and `IconTrigger` so UI components (`Button`, `Modal`, `ConfirmationDialog`, `FilterToolbar`, `EnterpriseTable`, `index.ts`) resolve imports correctly.
  - **TypeScript Syntax Cleanup (`components/ui/animated-icons/index.ts`)**: Re-exported `createAnimatedIcon` directly from `../animated-icon` to eliminate JSX syntax inside the `.ts` file.
  - Verified `npx tsc --noEmit` (0 errors) and `npm run build` (30/30 static & dynamic routes compiled cleanly).
- **Animate UI Icon Animation Standard Integration (`https://animate-ui.com/docs/icons/usage/animations`)**:
  - **Full Animate UI Spec (`components/ui/animated-icon.tsx`)**: Upgraded `AnimateIcon` and `AnimatedIcon` supporting children element wrapping (`<AnimateIcon animation="pointing"><ArrowRight /></AnimateIcon>`) and 14 animation presets (`pointing`, `bounce`, `spin`, `pulse`, `wiggle`, `float`, `glow`, `draw`, `path`, `path-loop`, `shake`, `flip`, `scale`, `default`).
  - **Component Level Upgrade**: Upgraded `Button` loading states, `Modal` close controls, `ConfirmationDialog` severity badges (`shake`, `wiggle`, `pulse`), `FilterToolbar` controls, `SearchableSelect` dropdowns, and `EnterpriseTable` sort headers.
  - Verified `npx tsc --noEmit` exits clean with 0 errors.
- **Multi-Layer Performance Architecture & Enterprise Caching**:
  - **Freshness Policies (`lib/cache/policies.ts`)**: Defined 4 data freshness classes (`CLASS_A_STATIC` 24h, `CLASS_A_REFERENCE` 1h, `CLASS_B_DIRECTORY` 2m, `CLASS_B_FLEET` 60s, `CLASS_C_OPERATIONAL` 15s, `CLASS_D_FRESH` 0s).
  - **Structured Tag Hierarchy (`lib/cache/tags.ts`)**: Created structured tag constants and branch-scoped helper functions (`TAGS.machines`, `TAGS.machinesBranch(branchId)`, `TAGS.categories`, `TAGS.dashboardKpis`). Re-exported backward-compatible `CACHE_TAGS` and `CACHE_TIERS` in `lib/cache.ts`.
  - **Database Performance Migration (`012_multi_layer_performance_indexes.sql`)**: Created composite indexes (`branch_id + status + created_at DESC`) and `v_branch_dashboard_summary` view to prevent query waterfalls.
  - **Data Access Layer Refactoring (`lib/queries/*`)**: Updated query functions in `categories.ts`, `machines.ts`, `dashboard.ts`, `complaints.ts`, and `services.ts` with explicit projections and freshness tiering.
  - **Mutation Invalidation Triggers (`app/actions/machines.ts`)**: Wired `revalidateTag` calls in Server Actions upon machine creation, update, deletion, and reassignment.
  - **25 Enterprise Performance Rules (`AI/PERFORMANCE_RULES.md`)**: Updated `AI/PERFORMANCE_RULES.md` to document strict performance standards.
  - Verified `npx tsc --noEmit` exits clean with 0 errors.
- **Instant Authenticated Root Route Redirect to `/dashboard`**:
  - **Edge Middleware Redirect (`proxy.ts`)**: Configured Next.js edge proxy to evaluate JWT authentication session on `path === "/"`. Authenticated users visiting `localhost:3000/` receive an immediate HTTP 307 redirect to `/dashboard` at the edge layer, bypassing HTML rendering, DB queries, and component execution (0ms render overhead).
  - **RSC Fallback (`app/page.tsx`)**: Added server-side fallback redirect via `redirect("/dashboard")` for active user sessions (and `/login` for pending/inactive users).
  - Verified `npx tsc --noEmit` exits clean with 0 errors.
- **Fix Parallel Route Conflict for `/service`**:
  - Resolved build error: `You cannot have two parallel pages that resolve to the same path. Please check /(app)/service and /service.`
  - Deleted legacy redirect file `app/service/page.tsx` that collided with the enterprise Service Hub page located at `app/(app)/service/page.tsx`.
  - Verified `npx tsc --noEmit` (0 errors) and `npm run build` (30/30 static & dynamic routes compiled successfully).
- **Enterprise Architecture Verification & Contextual Sub-Tab Completion**:
  - **System Review & Verification**: Checked and verified all 32 enterprise architecture items. Confirmed clean TypeScript compilation (`0 errors`) and complete alignment with recommended enterprise sidebar, daily action center, central smart documents vault, 5-level scope RBAC, dynamic approver resolution, global quick creation modal, and single-page tabbed modules.
  - **Machine Detail Contextual Tabs (`MachineClientView.tsx`)**: Added rich contextual tab content panels for `complaints` (Breakdown Complaints & FSR log), `documents` (Insurance, Fitness & Compliance certificates), `assignments` (Operator & Site assignment logbook), and `running_hours` (Daily meter reading logs & operating duration).
  - **Entity Detail Dynamic Routes & Clients**: Created standalone routes `/clients/[id]`, `/vendors/[id]`, `/purchase-orders/[id]` and dedicated client components (`ClientDetailClient.tsx`, `VendorDetailClient.tsx`, `PODetailClient.tsx`) with embedded sub-tabs (`Overview`, `Machines`/`Contacts`/`Items`, `Service`/`Products`/`Vendor`, `Complaints`/`Purchase Orders`/`Approval`, `Documents`, `Contacts`/`Performance`/`Communication`, `Activity`).
- **Enterprise Navigation, Smart Documents & 5-Level Scope-Based RBAC Overhaul**:
  - **Recommended Enterprise Sidebar (`AppSidebar.tsx`)**: Consolidated 50+ screens into 13 primary enterprise modules (Dashboard, My Work, CRM, Machines, Service, Inventory, Vendors, Purchase Orders, Challans, Documents, HR, Reports, Administration). Applied scope + permission-based sidebar filtering per user role profile.
  - **Daily "My Work" Action Workspace (`app/(app)/my-work/page.tsx`, `MyWorkClient.tsx`)**: Morning greeting ("Good Morning, [Name] 👋"), 4 urgency scorecard counters (🔴 Urgent, 🟠 Pending, 🟡 Due Today, 🟢 Completed), and role-tailored task cards for Operators (meter log entry & breakdown reports), Engineers (service jobs & FSR), Store Managers (stock requests), and Managers (PO approvals & expiries).
  - **Smart Documents Vault (`app/(app)/documents/page.tsx`, `DocumentsClient.tsx`)**: Single central document vault replacing standalone document subpages with Document Health Scorecard (Valid, Expiring <30d, Expired, Pending Approval, Missing Required) and entity type filter toolbar (Machine, Client, Vendor, HR, PO, Challan).
  - **Contextual Entity Detail Sub-Tabs**: Embedded sub-tabs inside Client (`Overview`, `Machines`, `Service`, `Complaints`, `Documents`, `Contacts`, `Activity`), Vendor (`Overview`, `Contacts`, `Products`, `Purchase Orders`, `Documents`, `Performance`, `Activity`), PO (`Overview`, `Items`, `Vendor`, `Approval`, `Documents`, `Receipts`, `Communication`, `Activity`), and Machine (`Overview`, `Service`, `Complaints`, `Documents`, `Assignments`, `Running Hours`, `Activity`) detail views.
  - **Top Bar Global "+ Create" Button (`GlobalCreateModal.tsx`, `AppHeader.tsx`)**: Added quick action button in top bar opening a permission-filtered quick creation modal for Client, Machine, Complaint, Service Job, Purchase Order, Challan, Stock Transaction, and Document.
  - **Consolidated Tabbed Modules**: Built single tabbed pages for Delivery Challans (`/challans`), CRM (`/crm`), Service (`/service`), Vendors (`/vendors`), Purchase Orders (`/purchase-orders`), Reports (`/reports`), and Administration Console (`/administration`).
  - **5-Level Scope-Based Access Model & Responsibility Matrix (`lib/auth/scope.ts`)**: Built `PermissionScope` levels (`ORGANIZATION`, `REGION`, `BRANCH`, `DEPARTMENT`, `WAREHOUSE`, `ASSIGNED`, `SELF`) and dynamic approver resolution matrix so branches without local HR/Procurement staff automatically escalate requests to Central/Regional responsibility matrices.
- **README.md Documentation Overhaul (`README.md`)**:
  - Overhauled and updated `README.md` to reflect all recent enterprise features and architecture additions.
  - Documented 11 system roles, multi-branch data scoping (`branches`, `user_branches`, `<BranchSelector />`), breakdown complaints & digital Field Service Report (FSR) system with A4 PDF export, machine categories taxonomy (`machine_categories`), extended technical specs & compliance tracking (Engine Serial/Mot, Insurance, 3rd Party Cert, RTO Tax), multi-branch inventory stock transfers (`/inventory`), HR employee workspace (`/hr`), operator daily meter logbooks (`/operations`), project structure, server actions, and updated feature roadmap.
- **PostgREST Relation Ambiguity Fix in Users Server Actions (`app/actions/users.ts`)**:
  - Resolved console errors `Error fetching users: {}` and `Error fetching pending users: {}` (`PGRST201: Could not embed because more than one relationship was found for 'users' and 'branches'`).
  - Specified explicit relationship hint `!users_branch_id_fkey` in PostgREST select queries (`branch:branches!users_branch_id_fkey(id, code, name, city, state)`) in `getAllUsers()` and `getPendingUsers()`.
  - Updated error logging from `console.error(..., error)` to `console.error(..., error.message || error)`.
- **User Management RBAC Role Creation & Multi-Branch Location Columns Overhaul (User Feedback on `/users`)**:
  - **`app/(app)/users/UserCreateModal.tsx`**: Removed `disabled={!isSuperAdmin}` from role selection so regular `admin` users can select and assign any operational enterprise role when creating user accounts. Added `branch_id` dropdown ("Assigned Company Branch Location"). Expanded role preview badges with icons for all 13 roles.
  - **`app/(app)/users/UserEditModal.tsx`**: Added `branch_id` branch selector and role selector so admins can edit assigned branch and role details.
  - **`app/actions/users.ts`**: Updated `getAllUsers` and `getPendingUsers` to join `branch:branches(id, code, name, city, state)`. Updated `createUser` and `editUser` to handle `branch_id` and permit `admin` users to assign operational enterprise roles.
  - **`app/(app)/users/UserRow.tsx` & `app/(app)/users/users-client.tsx`**: Overhauled desktop User Management table to 7 dedicated columns (`User Account`, `Contact Info`, `Role & Access Level`, `Assigned Branch & Location`, `Status`, `Joined Date`, `Actions`). Enhanced search filter to query branch name, branch city, phone, email, and role.
  - **`app/(app)/users/MobileUserCard.tsx` & `UserDetailSheet.tsx`**: Updated mobile user cards and detail drawer sheet to display assigned company branch badges and location details.

  - **`supabase/migrations/011_enterprise_rbac_branches_inventory.sql`**: Created database schema for multi-branch scoping (`branches`, `user_branches`), role permissions (`roles`, `permissions`, `role_permissions`), decoupled HR employees (`employees`), machine master taxonomy (`manufacturers`, `machine_models`), operator work tracking (`machine_assignments`, `machine_hour_logs`), stock ledger (`inventory_products`, `inventory_stock`, `inventory_transactions`), and inter-branch transfers (`stock_transfers`). Seeded Delhi HQ and Gurgaon branches, 11 system roles, and permissions.
  - **`lib/types/database.ts`**: Updated `UserRole` union type to 11 roles and added interfaces for `Branch`, `Role`, `Permission`, `Employee`, `MachineAssignment`, `MachineHourLog`, `InventoryStock`, `InventoryTransaction`, `StockTransfer`, `Manufacturer`, `MachineModel`.
  - **`lib/auth/rbac.ts` & `lib/dal.ts`**: Built `ROLE_PERMISSIONS` matrix mapping role permissions and added DAL guard functions `requirePermission()`, `currentUserHasPermission()`, and `getUserBranchIds()`.
  - **Server Actions**: Created `app/actions/branches.ts`, `app/actions/operators.ts`, `app/actions/inventory.ts`, and `app/actions/hr.ts`.
  - **Page Routes & Client Views**: Created `/inventory` (`StockLedgerClient.tsx`), `/hr` (`HRClient.tsx`), `/branches` (`BranchesClient.tsx`), and `/operations` (`OperationsClient.tsx`).
  - **Header Controls & Navigation**: Integrated `<BranchSelector />` into `AppHeader.tsx`. Updated `AppSidebar.tsx` and `CommandPalette.tsx` to dynamically filter menu links according to user roles (`store_manager`, `hr_manager`, `branch_manager`, `service_engineer`, `supervisor`, `operator`, `mechanic`, `super_admin`).
  - **Role-Tailored Dashboards**: Added automatic role dashboard routing in `app/(app)/dashboard/page.tsx` for `store_manager`, `hr_manager`, `operator`, `mechanic`, and admins.

- **Breakdown Complaints FSR Report PDF & A4 Print Optimization (User Feedback on `/machines?tab=complaints`)**:
  - **`components/complaints/FieldServiceReportModal.tsx`**:
    - Configured `@page { size: A4 portrait; margin: 0; }` in iframe generator to strip browser default header (date, title) and footer (URL, page numbers) text when printing or exporting PDF.
    - Added input element DOM cloning & sanitization: in print view, HTML `<input>` and `<textarea>` elements are converted to clean text elements, eliminating input box borders, background shading, focus outlines, scrollbars, and textarea resize handles (`//`).
    - Added `.text-white !important` over `.bg-neutral-900` table headers so parts table column headers ("SR", "PART NAME", "QTY", "STATUS", "DATE") render in bold white text.
    - Standardized report print container dimensions to exact A4 size (`210mm x 297mm`) with `10mm 12mm` margins, budgeting vertical heights for single-page output.
  - **`app/globals.css`**:
    - Updated global `@media print` CSS block targeting `#printable-fsr-report` with `@page { size: A4 portrait; margin: 0; }`, exact A4 dimensions, and white header text.

- **Field Service Report Modal Feedback Polish (User Feedback on `/machines?tab=complaints`)**:
  - **`components/complaints/FieldServiceReportModal.tsx`**:
    - Removed top View/Edit flex banner box (`.flex items-center justify-between p-3...`) to display FSR report document cleanly under modal header.
    - Removed `bg-neutral-100` (`Signed FSR PDF / Attachment Link`) attachment container from `#printable-fsr-report`.
    - Removed `max-h-[80vh] overflow-y-auto` from form container, eliminating competing inner and outer scrollbars so the modal uses a single smooth scroll container.
    - Relocated `Edit Report` / `Cancel Edit` buttons into sticky bottom action bar alongside `Print / Save PDF` and `Close`.
    - Built dedicated iframe print engine in `handlePrintReport` targeting `#printable-fsr-report` with custom A4 styles for printing and 1-click PDF export.
  - **`app/globals.css`**:
    - Added global `@media print` CSS block targeting `#printable-fsr-report`.

- **Breakdown Complaints FSR Report Optimization & Dual View/Edit Modes (User Feedback on `/machines?tab=complaints`)**:
  - **`components/complaints/ComplaintsClient.tsx`**:
    - Differentiated table action buttons based on complaint status: active complaints (`open`, `in_progress`, `pending_parts`) render `<Wrench /> Resolve (Fill FSR)` in sky blue styling to guide engineers, while resolved/closed complaints render `<FileText /> View FSR Report` in emerald styling.
  - **`components/complaints/FieldServiceReportModal.tsx`**:
    - Built dual **View Mode** vs **Edit Mode**: resolved complaints default to a clean, read-only FSR document view showing engineer signatures, checklist overview badges, parts table, and Print/Save PDF actions, with an "Edit Report" button for modifications.
    - Added 1-click **"Mark All Passed (Y)"** and **"Clear"** helper buttons for fast checklist entry.
    - Supported dynamic replacement parts table rows (`Add Part Row`, `Remove Part Row`).

- **ThemeToggle Geist Enterprise Redesign (User Feedback on `/machines`)**:
  - **`components/theme/ThemeToggle.tsx`**:
    - Overhauled the `ThemeToggle` component to perfectly match ServiceCentric's Vercel Geist design system.
    - Built a sleek sliding switch with Framer Motion spring physics, high-contrast Sun/Moon micro-animations, and brand dark/light slate + sky-blue tokens.
    - Added support for a 3-way `segmented` control variant alongside the default `switch` layout.
    - Maintained full SSR hydration protection and right-click context menu options for Light, Dark, or System mode.
  - **`app/globals.css`**:
    - Removed obsolete cartoonish `.daynight-toggle` CSS rules.

- **Remove Redundant Segmented Status Filter Tabs (User Feedback on `/machines?tab=inventory&bucket=overdue`)**:
  - **`components/machines/MachineListClient.tsx`**:
    - Removed the redundant segmented status filter pills row (`All`, `Due Today`, `Due Tomorrow`, `Overdue`).
    - Streamlined the Machine Directory page layout so quick filtering is performed via top interactive KPI summary cards and the `FilterToolbar` dropdown selector (`Filter Service Due`).

- **Service Due Filter in FilterToolbar (User Feedback on `/machines?bucket=tomorrow`)**:
  - **`components/machines/MachineListClient.tsx`**:
    - Added `bucketOptions` memoized options (`All Service Due`, `Due Today`, `Due Tomorrow`, `Overdue`).
    - Integrated `SearchableSelect` for `Filter Service Due` directly inside the expanded `FilterToolbar` dropdown grid alongside Status, City, and Engineer filters.
    - Ensured full bi-directional state synchronization with URL `?bucket=...` search parameter and quick filter tabs.

- **Day/Night Theme Toggle Switch (User Feedback on `/machines`)**:
  - **`components/theme/ThemeToggle.tsx`**:
    - Replaced standard icon toggle button with the requested interactive Day/Night theme toggle switch.
    - Features sun/moon animated handler, crater details, cloud-to-star morphing animations, and AM/PM indicator text.
    - Fully synchronized with `useTheme` hook (`theme`, `resolvedTheme`, `setTheme`) with mounted hydration safety.
    - Preserved right-click context menu popover for selecting Light, Dark, or System themes.
  - **`app/globals.css`**:
    - Added custom `.daynight-toggle-wrapper`, `.daynight-toggle`, `.daynight-toggle__handler`, `.crater`, and `.daynight-star` CSS rules.

- **Collapsed Sidebar Logo Hover Toggle Fix**:
  - **`components/layout/AppSidebar.tsx`**:
    - Fixed collapsed sidebar logo toggle behavior so the logo icon is permanently displayed at rest.
    - Added `useEffect` hook to reset `isLogoHovered` state to `false` when `collapsed` changes.
    - Added `onBlur` and `onClick` resets to logo button to ensure hover state cannot get stuck on `PanelLeftOpen`.
    - Added `pointer-events-none` to motion container divs inside logo button to prevent unmounting children from firing spurious `onMouseLeave` events.

- **Sidebar Collapse Hover Toggle, AppHeader Removal & Profile Theme Integration**:
  - **`components/layout/AppSidebar.tsx`**:
    - Implemented ChatGPT-style logo hover interaction in collapsed mode: hovering over the logo smoothly morphs it into the expand button (`PanelLeftOpen`), clicking expands the sidebar.
    - Relocated `ThemeToggle` component into the `UserProfileDropdown` profile menu card.
    - Removed redundant Administration section (`Users`, `Audit Logs`, `Settings`) from the main sidebar body.
  - **`components/layout/AppShellClient.tsx`**:
    - Removed `AppHeader` top bar per user feedback.

- **Sidebar Architecture & Interaction Model Redesign**:
  - **`components/layout/AppShellClient.tsx`**:
    - Re-architected application shell into a true 2-column layout. Synchronized main workspace left padding with exact sidebar widths (`280px` expanded / `72px` collapsed) using matched 220ms Framer Motion transitions (`duration: 0.22, ease: [0.2, 0.8, 0.2, 1]`), eliminating lag, white gap flashes, and content overlays.
  - **`components/layout/AppSidebar.tsx`**:
    - **Persistent Logo**: Logo icon `[🔧]` stays permanently visible in both expanded (`[🔧] ServiceCentric` + `◀`) and collapsed (`[🔧]` top, `▶` bottom) states.
    - **Quick Access Search**: Renamed search label to "Quick Access" per user feedback. Collapsed state renders centered search icon wrapped in tooltip (`Quick Access ⌘K`).
    - **Machines Contextual Flyout Submenu**: Added floating flyout menu on right when clicking `Machines` in collapsed state (*Equipment Directory*, *Service Logs*, *Breakdown Complaints*), allowing direct sub-tab navigation without expanding the sidebar.
    - **Profile Dropdown Positioning**: Anchored popover floating cleanly above profile card in expanded mode (`bottom-full mb-2`) and flying out to the right in collapsed mode (`left-full ml-3 bottom-0`) with subtle hairline border and focus ring.
    - **Active Navigation Treatment**: Applied rounded active background (`bg-sky-500/10 text-sky-600 dark:text-sky-400 font-bold border border-sky-500/20`) for active parents and subtle blue tint for active children, removing redundant blue dots.
  - **`components/layout/AppHeader.tsx` [NEW]**:
    - Built desktop workspace top header housing active page title/breadcrumb, quick search (`⌘K`), notifications link with unread status, relocated `ThemeToggle`, and user role pill badge.
  - **`components/ui/Tooltip.tsx` & `components/ui/index.ts`**:
    - Added `SidebarTooltip` supporting 140ms hover delay, smooth 120ms fade, and dual-theme styling for collapsed navigation icons.

- **Runtime Error & Machine Hub UI Polish (`/machines`)**:
  - **`components/machines/MachineListClient.tsx`**:
    - Fixed `MobileMachineCard is not defined` runtime error by adding dynamic import (`dynamic(() => import("./MobileMachineCard"))`).
    - **Sidebar Sub-Navigation (Feedback 1)**: Shifted equipment directory, service log, and breakdown complaint sub-tabs directly under `Machines` in `AppSidebar.tsx` and removed redundant top horizontal tab strip from page.
    - **Table Entry Count Removal (Feedback 2)**: Removed redundant "Showing N entries" text.
    - **Control Alignment (Feedback 3)**: Aligned `[ Table ] [ Cards ]` view switcher inside `FilterToolbar` actions bar alongside search & filter inputs.
    - **Header Subtitle Removal (Feedback 4)**: Removed subtitle paragraph (`"Manage equipment, services and maintenance..."`) under `Machine Directory`.
    - **Row Action Menu Cleanup (Feedback 5)**: Removed redundant `"View Details"` button from row contextual menu (`RowActionsMenu` `⋮`) since row click directly opens machine details.
  - **`components/layout/AppSidebar.tsx`**:
    - **Super Smooth Sidebar Animation**: Converted `aside` layout to `motion.aside` with Framer Motion spring physics (`type: "spring", stiffness: 350, damping: 32`) and smooth label fade transitions for seamless collapse/expand interactions.
    - Added nested active sub-tabs under `Machines` link (`Equipment Directory`, `Service Logs`, `Complaints`).

## 2026-08-12
- **Machine Services Table UI/UX Overhaul (`/machines?tab=services`)**:
  - **`components/services/ServicesClient.tsx`**:
    - Replaced bright pink (`bg-pink-600`) action and modal buttons with Geist sky blue styling (`bg-sky-600 hover:bg-sky-700 dark:bg-sky-500 dark:hover:bg-sky-600 text-white font-semibold`).
    - Removed `<Eye />` icon link and added `<Edit />` icon to the "Update Service" action button.
    - Replaced duplicate pink button in `SERVICE STATUS` column with dynamic semantic status badges (`Overdue`, `Due Today`, `Due Soon`, `Scheduled`, `Under Maintenance`).
    - Added `onRowClick={(m) => router.push('/machines/' + m.id)}` to `EnterpriseTable` to make all table rows clickable, with `e.stopPropagation()` on action buttons.
    - Updated Update Service Modal submit button to match primary brand blue.
- **Machine Extended Technical Specifications, Compliance Tracking & Registration Form (`/machines`, `/machines/[id]`)**:
  - **`supabase/migrations/009_machine_extended_details.sql` [NEW]**: Added columns for `serial_number`, `manufacturer`, `year_of_mfg`, `engine_serial_no`, `engine_mot_no`, `insurance_policy_no`, `insurance_expiry_date`, `third_party_certificate`, `third_party_expiry_date`, `rto_tax`, and `rto_tax_expiry_date` to `public.machines`. Updated status CHECK constraint to allow `on_rent` and `under_maintenance`. Migration executed directly on Supabase DB.
  - **`lib/types/database.ts`**: Expanded `MachineStatus` (`active`, `inactive`, `on_rent`, `under_maintenance`) and extended `Machine` interface.
  - **`lib/queries/machines.ts`**: Updated `MACHINE_LIST_COLUMNS` and `getCachedMachineById` projections to select all extended technical and compliance fields.
  - **`app/actions/machines.ts`**: Updated auto-code generator to `S` + 3-4 random digits (e.g. `S374`), updated `machineCodeRegex` to `/^[A-Z0-9\-]{3,20}$/`, updated `createMachine` & `updateMachine` payloads.
  - **`components/machines/MachineModal.tsx`**: Overhauled form modal with auto `S374` code generator, 5 visual card sections for equipment specs, engine specs, compliance certificates, client location, and status choices.
  - **`app/(app)/machines/[id]/machine-client-view.tsx`**: Updated Overview tab with dedicated Equipment & Technical Record card displaying all 14 fields (Machine No, Model, Sr No, Manufacturer, Year, Engine Serial/Mot, Insurance & Expiry, 3rd Party Cert & Expiry, RTO Tax & Expiry, Status). Added `formatComplianceDate` helper (e.g. `1st January 1970`).
  - **`MachineRow.tsx`**, **`MobileMachineCard.tsx`**, **`MachineListClient.tsx`**: Updated status badges to render `On Rent` and `Under Maintenance` pills and added status filter options.
- **FilterToolbar Collapsed State Adjustment (`/services`, `/machines`, `/users`, `/notifications`, `/audit-logs`)**:
  - **`components/ui/FilterToolbar.tsx`**: Updated `defaultOpen` default state from `true` to `false` and simplified state initialization so filter panels remain collapsed by default on page load, opening smoothly when the user clicks the `Filter` button.
  - **`ServicesClient.tsx`**, **`users-client.tsx`**, **`NotificationListClient.tsx`**, & **`AuditLogsClient.tsx`**: Updated `defaultOpen={false}` props so filters are collapsed by default across all app views.
  - **`components/ui/FilterToolbar.tsx` [NEW]**: Created a reusable, mobile-responsive `FilterToolbar` component that aligns the search input bar side-by-side with a high-contrast `Filter` toggle button (with active filter count badge) and smooth expandable filter panel.
  - **`components/ui/index.ts`**: Exported `FilterToolbar`.
  - **`components/services/ServicesClient.tsx`**: Re-architected search and filter section per user page feedback. Aligned search input with Filter toggle button in a single row; wrapped filter pills (`All Tasks`, `Overdue`, `Due Today`, `Due Tomorrow`, `Inactive`) inside the `FilterToolbar` expandable panel.
  - **`components/machines/MachineListClient.tsx`**: Integrated `FilterToolbar` for search input, Filter toggle button, and dropdown filter grid (Status, City, Engineer).
  - **`app/(app)/users/users-client.tsx`**: Integrated `FilterToolbar` for search input and role/status filter pills.
  - **`components/notifications/NotificationListClient.tsx`**: Integrated `FilterToolbar` for search input, status/alert type selects, and date range inputs.
  - **`components/audit-logs/AuditLogsClient.tsx`**: Integrated `FilterToolbar` for search input, role/date select grid, and category filter pills.
- **UserMenu Popover Link Cleanup (`/services`)**:
  - **`components/layout/PublicNavbar.tsx`**: Removed `"Dashboard Overview"` and `"Machines Directory"` navigation links from the `<UserMenu>` profile popover dropdown per user feedback on `/services`. Wrapped remaining popover links (`User Management` and `Audit Security Logs`) conditionally for `admin` and `super_admin` roles.
- **Login & Signup Feedback Polish (`/login`, `/signup`)**:
  - **`app/login/page.tsx`**: Removed `"Platform Active"` header pill badge per feedback.
  - **`app/login/login-form.tsx`**: Removed `"Sign in to your ServiceCentric account..."` subtitle paragraph.
  - **`app/signup/page.tsx`**: Removed `"Request Access"` header pill badge, removed `"Sign up with your work email..."` subtitle paragraph, and adjusted layout padding (`p-5 sm:p-6 lg:p-7`), field gaps (`gap-2.5 sm:gap-3`), note box styling, and container viewport height (`lg:h-screen lg:overflow-hidden`) so the signup box fits on screen without scrollbars.
- **Modern Auth UI/UX Redesign (`/login`, `/signup`, `/forgot-password`)**:
  - **`app/login/login-form.tsx`**: Upgraded to glassmorphic `motion.div` (`bg-card/80 backdrop-blur-xl shadow-2xl rounded-2xl`), added hairline gradient accent, password visibility toggle, tactile press animations, and high-contrast `<ArrowRight />` CTA.
  - **`app/login/page.tsx`**: Rebuilt hero showcase with ambient radial blur glows, horizontal keyword text gradient (`Never miss a service deadline again`), feature pill badges, top `<ArrowLeft /> Home` navigation link, and clean telemetry stat grid.
  - **`app/signup/page.tsx`**: Unified 50/50 split layout matching `/login` design language, added organization onboarding benefits, glass card form, and motion transitions.
  - **`app/forgot-password/page.tsx`**: Re-architected password reset view with centered ambient glow, glass card, key icon badge, and smooth navigation.
- **Login Hero Badge Removal (Page Feedback /login)**:
  - **`app/login/page.tsx`**: Removed the top `.inline-flex` badge (`Machine Service Tracking & Automation`) above the main hero headline per user feedback.
- **Favicon Metadata & In-App Logo Visibility Fix**:
  - **`app/layout.tsx`**: Added `icons` configuration (ICO, SVG, PNG 96x96, Apple Touch Icon) to `export const metadata` and inserted explicit `<link rel="icon">` tags into `<head>` to fix browser tab icon rendering.
  - **`app/favicon.ico`**: Created root icon fallback for Next.js App Router.
  - **`app/login/page.tsx`**, **`app/signup/page.tsx`**, & **`components/landing/LandingFooter.tsx`**: Added high-contrast drop shadow filters (`filter drop-shadow-[0_0_1px_rgba(0,0,0,0.85)] dark:drop-shadow-[0_0_1px_rgba(255,255,255,0.85)]`) so the SVG logo is crisp and visible in both light and dark themes.
- **Login & Signup Brand Header Alignment (Page Feedback /login)**:
  - **`app/login/page.tsx` & `app/signup/page.tsx`**:
    - Removed `"Service Management Platform"` subtitle (`.mesh-gradient > .flex > .flex > .text-xs`) per user feedback.
    - Replaced the rainbow text gradient brand title with the global standard Brand Name styling matching `PublicNavbar.tsx` (`Service<span className="text-sky-600 dark:text-sky-400">Centric</span>`).

## 2026-08-06
- **Landing Page Hero Section Headline Redesign** (user feedback on `/` landing page with uploaded image):
  - **`components/landing/HeroSection.tsx`**:
    - Replaced the previous `motion.h1` styling with a large, bold serif display headline (`font-serif font-bold text-5xl sm:text-7xl md:text-8xl lg:text-[5.75rem] xl:text-[6.5rem] tracking-tight leading-[1.08] sm:leading-[1.04]`).
    - Styled headline text with a 6-stop horizontal gradient (`#2563eb` electric royal blue → `#6366f1` indigo → `#8b5cf6` purple → `#c026d3` violet → `#ec4899` pink → `#f43f5e` hot pink) matching the uploaded design screenshot across "Never Miss Another Deadline.".
    - Added an SVG hand-drawn blue arc underline vector (`#2563eb`) under the word "Another".
    - Expanded content container max width to `max-w-4xl lg:max-w-5xl` for desktop viewports.
- **Performance Optimization Pass** (user report: slow `next dev` page loads + Recharts `width(0) height(0)` warnings + `scroll-behavior` warning):
  - **Diagnosis**: The reported timings (`proxy.ts`/`application-code` breakdown) are `next dev` + Turbopack artifacts — routes recompile on first hit and every request is instrumented. `next build && next start` is the real benchmark. Verified `npm run build` clean (16 routes, compiled 27.7s).
  - **`components/dashboard/MobileChartsWrapper.tsx`**: Was rendering BOTH the `block lg:hidden` mobile layout AND the `hidden lg:grid` desktop layout in the DOM → all 4 Recharts instances hydrated, the 2 hidden ones measuring 0×0 (source of repeated `width(0) height(0)` warnings). Now renders only ONE layout at a time via `useMediaQuery("(min-width: 1024px)")`. Cuts 4 chart mounts → 2.
  - **`lib/hooks/useMediaQuery.ts`** (new): SSR-safe `matchMedia` hook via `useSyncExternalStore` (server snapshot `false`, settles post-hydration — no mismatch).
  - **`lib/dal.ts`**: `getCurrentUser()` was doing a fresh `users` table SELECT on every request (React.cache only dedupes within a request). Extracted the profile-row lookup into `unstable_cache` keyed by `userId`, tagged `CACHE_TAGS.users` (already invalidated by all `app/actions/users.ts` mutations + `refresh.ts`), 60s revalidate. `auth.getUser()` still validates the token every request. React.cache wrapper retained for per-request dedupe.
  - **`app/layout.tsx`**: Added `data-scroll-behavior="smooth"` to `<html>` — clears the Next.js warning and scopes smooth scroll away from route transitions.
  - **`proxy.ts`**: Narrowed middleware matcher to also skip static assets (fonts/images/manifest/robots/sitemap) so session refresh runs only on real page routes. Protected/auth redirect logic unchanged.
  - **Verification**: `npx tsc --noEmit` clean; `npm run build` clean (16 routes).


- **Machines Page Feedback Verification** (page feedback on `/machines`):
  - Verified all four feedback items are already implemented in the current codebase:
    1. **"Overdue" quick-filter button** — color-coded red (`bg-red-100 dark:bg-red-950/80 text-red-700 dark:text-red-300 border-red-300/80 dark:border-red-800/80 font-extrabold`) with red count badge (`bg-red-200/80 dark:bg-red-900/70 text-red-900 dark:text-red-100 border-red-300/80 dark:border-red-700/80 font-black`), visible in both light & dark themes.
    2. **"Due Tomorrow" quick-filter button** — color-coded light blue (`bg-blue-100 dark:bg-blue-950/80 text-blue-700 dark:text-blue-300 border-blue-300/80 dark:border-blue-800/80 font-extrabold`) with light blue count badge, visible in both light & dark themes.
    3. **"Due Today" quick-filter button** — color-coded yellow/amber (`bg-amber-100 dark:bg-amber-950/80 text-amber-800 dark:text-amber-300 border-amber-300/80 dark:border-amber-800/80 font-extrabold`) with yellow/amber count badge, visible in both light & dark themes.
    4. **Machine card grid** — harmonized with notification page design language in `components/machines/MobileMachineCard.tsx`: canvas gradient background (`from-[var(--color-canvas-elevated)] via-[var(--color-canvas-elevated)] to-[var(--color-canvas)]`), status-aware top hairline sheen hover overlay (`sheenGradientClass`: red/amber/blue/link), status urgency left border accents (`border-l-4`), inset details box (`bg-[var(--color-canvas)] border border-[var(--color-hairline)]`), and hover lift (`hover:-translate-y-0.5 hover:shadow-lg dark:hover:shadow-black/50`).
  - Files verified: `components/machines/MachineListClient.tsx` (quick-filter pills + snapshot cards), `components/machines/MobileMachineCard.tsx` (grid cards).
  - `npx tsc --noEmit` clean (TSC_PASS).
- **UserMenu Dropdown Tab & `/users?action=create` Modal UI/UX Redesign** (page feedback on `/users?action=create`):
  - **`components/layout/PublicNavbar.tsx`**:
    - Completely redesigned `<UserMenu>` popup tab dropdown (`motion.div`) into a structured Geist profile card (`w-72 sm:w-80 shadow-2xl rounded-[var(--radius-lg)] border border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)] p-3 text-[var(--color-ink)] backdrop-blur-md`).
    - Added user avatar circle, full name in bold ink text, email in muted text, and phone row.
    - Added high-contrast role pills with icons (Super Admin = Red `<ShieldAlert />`, Admin = Amber `<ShieldCheck />`, Engineer = Blue `<Shield />`) and active status badge with pulsing green indicator dot, visible in both light & dark themes.
    - Added quick app navigation items (`Dashboard Overview`, `Machines Directory`, `User Management`, `Audit Security Logs`) with icon indicators and subtle hover transitions.
    - Redesigned Sign Out button with `<LogOut />` icon and rose hover wash.
  - **`app/(app)/users/users-client.tsx`**:
    - Added `useSearchParams` hook and `useEffect` to automatically open `UserCreateModal` when `action=create` query parameter is present in URL (`/users?action=create`).
  - **`app/(app)/users/UserCreateModal.tsx`**:
    - Enhanced user creation modal with clear field labels, placeholders (`Rahul Sharma`, `rahul@company.com`, `+91 98765 43210`), permission role descriptions, and granted role badge preview.
  - **`app/(app)/users/UserDetailSheet.tsx`**:
    - Updated `getRoleBadge` and header status badge to use high-contrast role pills and active status pill with pulsing dot indicator for clear visibility across light and dark themes.
- **Command Palette Navigation Coverage, Keyword Search Engine & Search Shortcut Badge** (page feedback on `/users`):
  - **`components/ui/CommandPalette.tsx`**:
    - Extended `CommandItem` with `keywords?: string[]` (synonym/alias search terms) and `roles?: string[]` (per-command role gating).
    - Rebuilt the command list into a single declarative array filtered by `userRole`, mirroring the real app navigation (`appNavItems`). Fixed a coverage bug where **Audit Logs** was previously hidden from `admin` — it is now visible to both `admin` and `super_admin` (matching `appNavItems`). All destinations covered: Dashboard, Machines, My Services, Notifications, Users, Audit Logs, Settings, plus Create Machine / Invite User quick actions.
    - Added keyword aliases per command (e.g. Machines → "equipment/inventory/assets", Notifications → "alerts/reminders/inbox", Audit Logs → "logs/history/activity", Users → "team/staff/people") so intent-based queries match.
    - Replaced the naive `every(token => includes)` filter with a **relevance-scored search engine**: every token must match, but matches are weighted (title prefix 100, title word-boundary 60, title substring 40, keyword 25, subtitle 10, category 5) with a +200 whole-query title-prefix boost; results sorted by descending score for fast, correct ranking.
  - **`components/layout/PublicNavbar.tsx`**:
    - Re-added the keyboard shortcut hint to the header search button as a `<kbd>` badge, **platform-aware** (`⌘K` on Mac, `Ctrl K` on Windows/Linux) via a `navigator.platform`/`userAgent` check in a `useEffect` (`isMac` state). Widened the search button (`w-36 sm:w-48`) and updated the `title` tooltip to match the detected platform.
  - `npx tsc --noEmit`: unable to run in this session (no shell tool available); changes reviewed manually and are type-consistent with existing `CommandPalette`/`PublicNavbar` types.


  - **`components/machines/MachineListClient.tsx`**:
    - **Overdue Filter Pill ("Overdue3")**: Styled in bold, high-contrast Red (`bg-red-100 dark:bg-red-950/80 text-red-700 dark:text-red-300 border-red-300/80 dark:border-red-800/80 font-extrabold`) with matching red count badge (`bg-red-200/80 dark:bg-red-900/70 text-red-900 dark:text-red-100 border-red-300/80 dark:border-red-700/80 font-black`), visible in both light & dark themes.
    - **Due Tomorrow Filter Pill ("Due Tomorrow1")**: Styled in bold, high-contrast Light Blue (`bg-blue-100 dark:bg-blue-950/80 text-blue-700 dark:text-blue-300 border-blue-300/80 dark:border-blue-800/80 font-extrabold`) with matching light blue count badge (`bg-blue-200/80 dark:bg-blue-900/70 text-blue-900 dark:text-blue-100 border-blue-300/80 dark:border-blue-700/80 font-black`), visible in both light & dark themes.
    - **Due Today Filter Pill ("Due Today0")**: Styled in bold, high-contrast Yellow/Amber (`bg-amber-100 dark:bg-amber-950/80 text-amber-800 dark:text-amber-300 border-amber-300/80 dark:border-amber-800/80 font-extrabold`) with matching yellow/amber count badge (`bg-amber-200/80 dark:bg-amber-900/70 text-amber-900 dark:text-amber-100 border-amber-300/80 dark:border-amber-700/80 font-black`), visible in both light & dark themes.
    - **Top Quick Stats Cards**: Updated stats cards to match red, light blue, yellow/amber, and ink active/inactive color palettes.
  - **`components/machines/MobileMachineCard.tsx`**:
    - **Machine Card Grid**: Harmonized card constituent colors, background canvas gradient (`from-[var(--color-canvas-elevated)] via-[var(--color-canvas-elevated)] to-[var(--color-canvas)]`), status-aware top hairline sheen hover overlay (`sheenGradientClass`: red for overdue, amber for today, blue for tomorrow, link blue for normal), status urgency left border accents (`border-l-4`), inset details box (`bg-[var(--color-canvas)] border border-[var(--color-hairline)]`), and card hover lift (`hover:-translate-y-0.5 hover:shadow-lg dark:hover:shadow-black/50`) matching `/notifications`.
  - `npx tsc --noEmit` clean (0 errors).
- **Users Page Grid, Role/Status Filter Pills & Approve/Reject Button UI Refinement** (page feedback on `/users`):
  - **`app/(app)/users/users-client.tsx`**:
    - **Pending Approvals Card Grid**: Harmonized card constituent color, subtle background gradient (`from-[var(--color-canvas-elevated)] via-[var(--color-canvas-elevated)] to-[var(--color-canvas)]`), hover hairline sheen overlay (`via-amber-500/40`), left urgency border accent (`border-l-4 border-l-amber-500 dark:border-l-amber-400`), and hover lift matching `/notifications`.
    - **Approve & Reject Buttons**: Updated Approve button (`variant="success-sm"`, `<Check />` icon, tight 6px radius, `shadow-xs`, active tap animation) and Reject button (`variant="danger-sm"`, `<X />` icon, tight 6px radius, `shadow-xs`, active tap animation) per `DESIGN.md` button UI/UX.
    - **Role Filter Pills**: Color-coded per role (Engineers = Blue, Admins = Amber/Yellow, Super Admins = Red) with status indicator dots and active text contrast in both light and dark themes.
    - **Status Filter Pills**: Color-coded per status (Active = Emerald, Inactive = Slate/Neutral) with status indicator dots and active text contrast in both light and dark themes.
  - **`app/(app)/users/MobileUserCard.tsx`**:
    - Harmonized grid cards with subtle canvas gradient background (`from-[var(--color-canvas-elevated)] via-[var(--color-canvas-elevated)] to-[var(--color-canvas)]`), top hairline sheen overlay on hover (`via-[var(--color-link)]/40`), left border role accents (`border-l-4`), and card hover lift matching `/notifications` and `/machines`.
    - Enhanced role badges with semantic dots and color contrast for both dark and light mode.
  - `npx tsc --noEmit` clean (0 errors).
- **Search Tab & CommandPalette Hover Icon Contrast & Fast Indexing Fix** (page feedback on `/dashboard`):
  - **`app/globals.css`**: Added `--color-primary: var(--color-primary);` to Tailwind v4 `@theme inline` bridge so `bg-primary`, `text-primary`, and `text-primary-foreground` resolve accurately across light and dark mode themes.
  - **`components/ui/CommandPalette.tsx`**: Added multi-token fast query search indexing logic (`tokens.every(...)`) and updated item hover state styling with explicit `group` and `group-hover:bg-primary group-hover:text-primary-foreground` to eliminate missing/invisible icons on hover.
  - **`components/layout/PublicNavbar.tsx`**: Updated search tab button with `group` and `group-hover:text-foreground` to ensure search icon is visible in both light & dark themes when hovered.
  - **`components/machines/MachineListClient.tsx`**, **`app/(app)/users/users-client.tsx`**, **`components/notifications/NotificationListClient.tsx`**, **`components/services/ServicesClient.tsx`**, **`components/audit-logs/AuditLogsClient.tsx`**: Updated search inputs with `group` focus-within/hover icon transitions for high contrast visibility.
  - `npx tsc --noEmit` clean (0 errors).
- **Machines Page Quick-Filter & Card Grid UI Refinement** (page feedback on `/machines`):
  - **`components/machines/MachineListClient.tsx`**: Updated quick-filter status pill buttons:
    - Button **"Overdue"**: Styled in red (`text-red-700 dark:text-red-400 font-semibold`, `bg-red-100/90 dark:bg-red-950/70 text-red-800 dark:text-red-200 border border-red-300/60 dark:border-red-800/60 font-bold`) visible in both light & dark themes.
    - Button **"Due Tomorrow"**: Styled in light blue (`text-blue-700 dark:text-blue-400 font-semibold`, `bg-blue-100/90 dark:bg-blue-950/70 text-blue-800 dark:text-blue-200 border border-blue-300/60 dark:border-blue-800/60 font-bold`) visible in both light & dark themes.
    - Button **"Due Today"**: Styled in yellow/amber (`text-amber-700 dark:text-amber-400 font-semibold`, `bg-amber-100/90 dark:bg-amber-950/70 text-amber-800 dark:text-amber-200 border border-amber-300/60 dark:border-amber-800/60 font-bold`) visible in both light & dark themes.
  - **`components/machines/MobileMachineCard.tsx`**: Harmonized card grid styling to match `/notifications` cards — added top hairline sheen overlay (`via-[var(--color-link)]/40`), subtle background gradient (`from-[var(--color-canvas-elevated)] via-[var(--color-canvas-elevated)] to-[var(--color-canvas)]`), dark/light theme urgency left border accents (`border-l-4`), and card hover lift.
  - `npx tsc --noEmit` clean (0 errors).
- **Machines & Users Page Grid UI/UX Harmonization** (page feedback on `/notifications`):
  - **`components/machines/MobileMachineCard.tsx`**: Redesigned machine card structure to mirror `NotificationMobileCard` — initial avatar circle (`bg-[var(--color-hairline-soft-surface)]`), copyable machine code pill, model tag, status badge with dot, inset details box (`bg-[var(--color-canvas)] border border-[var(--color-hairline)] p-2.5 rounded-lg text-xs`), overdue alert banner, and one-tap action pills (Call, WhatsApp, Edit, Deactivate, Details). Added card hover elevation (`hover:border-[var(--color-ink)]/30 hover:shadow-md`).
  - **`components/machines/MachineListClient.tsx`**: Upgraded bucket quick-filter chips to a Vercel Geist spring sliding pill container (`layoutId="activeMachineBucketPill"`) and updated card grid container to `grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4`.
  - **`app/(app)/users/MobileUserCard.tsx`**: Migrated all legacy Tailwind token classes to native Geist tokens (`bg-[var(--color-canvas-elevated)]`, `border-[var(--color-hairline)]`, `text-[var(--color-ink)]`, `text-[var(--color-mute)]`, `bg-[var(--color-canvas)]`). Added initial avatar circle with role icon badge, inset details container (`bg-[var(--color-canvas)]`), action footer (Email, Call, Reset Password key button, Toggle status button), and card hover elevation (`hover:border-[var(--color-ink)]/30 hover:shadow-md`).
  - **`app/(app)/users/users-client.tsx`**: Converted Role and Status filter chips to spring-sliding pill containers (`layoutId="activeUserRolePill"`, `layoutId="activeUserStatusPill"`) and expanded card grid view to `grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4`.
  - `npx tsc --noEmit` clean (0 errors).
- **Sent real service due notification email** — Dispatched a genuine "Service Due Tomorrow" notification to `vaibhav1chauhan12353@gmail.com` using the original ServiceCentric email template (`getServiceReminderEmailHtml` via `sendNotification`), not the test template. Email included full details: machine code `MCH-2024-001` (Hydraulic Press HM-500), customer (Sharma Industries Pvt Ltd), due date (2026-08-07), location (Plot 45, GIDC Phase 2, Vapi, Gujarat - 396195), and assigned engineer. SendGrid accepted (status 202), message ID `K-LFTihGRROYfBgYbJ8SEg`. Temporary script `send-due-notification.ts` created and removed after successful send.
- **Landing Page Feedback Enhancements**:
  - **`HeroSection.tsx`**: Removed top inline badge `"Live Enterprise-ready service platform"`. Replaced color circle placeholders in social proof row with generated profile photos (`avatar-1.jpg` through `avatar-4.jpg`).
  - **`EngineerMobileSection.tsx`**: Removed collapsed Dynamic Island text `"WO-4471"`, removed top inline pill `"Field-First iOS App Experience"`, updated description paragraph to explicitly state support for both Android and iOS ("...on both Android and iOS devices."), and removed `"iOS 18/19 & Android Compatible"` tag text.
  - **`TestimonialsSection.tsx`**: Replaced initial badges ("SM", "FE", "OD") with real user profile photos (`avatar-1.jpg`, `avatar-2.jpg`, `avatar-3.jpg`).
  - **`CtaSection.tsx`**: Removed bottom trust line flex element ("SOC2 Type II · Zero configuration").
  - `tsc --noEmit` clean.
- **iPhone 17 Pro Max Mobile UI/UX redesign** (page feedback on `/`):
  - **`components/landing/EngineerMobileSection.tsx`**: Completely overhauled into an authentic, ultra-premium iPhone 17 Pro Max device chassis.
    - **Display & Ratio**: 6.9-inch 19.5:9 flagship aspect ratio (`w-[340px] sm:w-[355px] h-[720px] sm:h-[750px]`) with ~1.5mm uniform micro-bezel border and titanium metallic outer highlight frame.
    - **Hardware Details**: Modeled left side Action Button and Volume Up/Down buttons, right side Power Button and capacitive Camera Control button, and top speaker slit.
    - **Dynamic Island**: Interactive pill component (`w-[122px]` to `w-[240px]` spring morph) housing TrueDepth sensor lenses, live work order badge `#WO-4471`, and expandable live service activity indicator.
    - **iOS Status Bar**: Real-time 9:41 time font, location activity dot, 5G signal bars, Wi-Fi 7 icon, and battery status capsule with interior green fill level.
    - **Mobile App UI/UX**: Translucent backdrop-blur header, interactive tap-to-toggle maintenance checklist items with animated completion counter, photo evidence upload grid, primary sign-off CTA, draft/report issue buttons, and iOS gesture Home Indicator.
  - `tsc --noEmit` clean.

- **Landing page navbar missing sections added** (page feedback on `/`):
  - **`components/layout/PublicNavbar.tsx`**: Updated `defaultPublicNavLinks` to include all landing page sections: Equipment (`#equipment`), Workflow (`#workflow`), Features (`#features`), Analytics (`#analytics`), Reminders (`#reminders`), Mobile App (`#mobile`), Security (`#security`), Reviews (`#testimonials`), and FAQ (`#faq`). Updated desktop navigation bar container styling (`gap-0.5 xl:gap-1`) and link horizontal padding (`px-2 xl:px-3 whitespace-nowrap`) to fit all 9 links responsively with smooth scroll spy active tracking and hover pills.
  - **`components/landing/LandingFooter.tsx`**: Updated legacy/dead `#showcase` link to `#equipment` ("Equipment Gallery") and `#engineers` link to `#mobile` ("Field Workspace").
  - `tsc --noEmit` clean.

- **Landing navbar + theme toggle redesign** (page feedback on `/`):
  - **`components/layout/PublicNavbar.tsx`**: `defaultPublicNavLinks` cut from 6 → 4. Removed `Platform Showcase` (`#showcase`) and `Engineers` (`#engineers`) — dead anchors with no matching section id in `components/landing/*` (real ids: trusted/equipment/workflow/features/analytics/reminders/mobile/security/testimonials/faq). Reordered to match page flow: Workflow → Features → Analytics → Security. Added a spring-sliding **hover pill** on the desktop nav: new `hoveredLink` state, `onMouseEnter` per link + `onMouseLeave` on `<nav>`, and a `motion.div layoutId="public-navbar-hover-pill"` (`bg-muted/70`, stiffness 500/damping 34) rendered only when hovered and not active — coexists with the existing active pill.
  - **`components/theme/ThemeToggle.tsx`**: modernized the toggle button. Removed the perpetual pulsing sparkle dot, the tri-color (sky/violet/amber) gradient glow halo, and the heavy per-icon `drop-shadow` glows. New icon transition is a vertical slide + slight rotate (`y: 8→0→-8`, rotate ±45, spring 400/28) instead of scale+90°-spin; icons bumped to 18px; added a subtle `bg-primary/5` hover wash and `hover:bg-muted/60`. Right-click theme menu unchanged.
  - `tsc --noEmit` clean.

## 2026-08-06 (earlier)
- **Landing page feedback — Pricing removed + Hero rebuilt**:
  - **Removed Pricing**: deleted `components/landing/PricingSection.tsx` and unwired it from `app/page.tsx` (import + render). No nav/footer anchor referenced `#pricing`. New `<main>` order ends … → EnterpriseSecurity → Testimonials → FAQ → CTA.
  - **Hero from scratch** (`components/landing/HeroSection.tsx`): replaced centered stack with an asymmetric `lg:grid-cols-12` layout (left `col-span-5`, right `col-span-7`). Left column: pulsing "Live" badge, headline with gradient-clipped "service deadline" keyword, value-focused sub-copy, dual CTAs (primary with shine-sweep overlay + secondary glass), overlapping avatar social proof, count-up stat row (500+/99.9%/3) using framer-motion `animate` + `useInView`. Right column: existing `DashboardPreviewMockup` with radial glow underlay, two floating backdrop-blur glass cards (zero-missed + multi-channel dispatch), and a live "48 engineers on duty" pill. Section-wide **mouse-parallax** via `useMotionValue`/`useSpring`/`useTransform` driving layered offsets on visual, cards, and conic mesh orb; grid-texture + radial-glow background decoration. Fully tokenized, dark/light correct, reduced-motion inherits globals. `tsc --noEmit` clean.

## 2026-08-05
- **Landing Page Ground-Up Redesign — Phase 2 (strict Vercel Geist, visual-first)**:
  - **Decisions locked**: (1) imagery = vector/CSS/line-art only, no raster photos or external URLs; (2) strict Geist color restraint — ink-on-canvas everywhere, mesh gradient the only decoration, status colors (`--color-success/warning/error` + `-deep`) confined to product mockups; (3) reuse strong assets (theme system, `ui/*`, `AnimatedBackground`, header/footer, `DashboardPreviewMockup`); (4) structured placeholders (Starter/Growth/Enterprise pricing, role-based testimonials with no fabricated company names, common FAQs).
  - **New shared primitives**: `components/landing/_shared/Section.tsx` (standard section shell + `Reveal` scroll-in wrapper on framer-motion `whileInView`) and `_shared/MachineIcon.tsx` (ink line-art SVG set: excavator/bulldozer/loader/crane/forklift/dump-truck).
  - **New sections**: `EquipmentGallery.tsx` (category tabs → line-art machine cards across construction/mining/industrial/manufacturing/agriculture), `PricingSection.tsx` (3 tiers, highlighted via ink border not color fill), `TestimonialsSection.tsx` (Service Manager / Field Engineer / Ops Director role quotes, initials avatars), `FaqSection.tsx` (`useState` accordion, animated height, hairline dividers).
  - **Rebuilt onto tokens**: `HeroSection` (ink `.display-xl` headline, two pill CTAs, floating mockup, trust pills — removed rainbow gradient text), `TrustedSection` (greyscale wordmark strip + `AnimatedCounter` stats), `WorkflowSection` (5-step ink timeline), `FeatureShowcaseSection` (hairline capability tiles), `AnalyticsShowcaseSection` (Recharts colors driven by `useTheme()` + tokens, replacing `#0070f3`), `NotificationEngineSection` (email/whatsapp/sms preview card), `EngineerMobileSection` (phone frame on `--color-ink`), `CtaSection` (single `.mesh-gradient` flourish + ink headline); `EnterpriseSecuritySection` copy trimmed.
  - **`DashboardPreviewMockup.tsx` color scrub**: replaced all hardcoded `sky/rose/amber/emerald/slate-900` + rainbow glow with semantic tokens — status via `--color-error/warning/success` (+ `-deep`), `color-mix` tints for badges/chips (theme-correct in both modes), chrome/accents → `--color-ink`, filter/toast → `--color-primary`/`--color-on-primary`. Live count + dispatch toast behavior preserved.
  - **`app/page.tsx` rewired**: new `<main>` order Hero → Trusted → EquipmentGallery → Workflow → FeatureShowcase → Analytics → NotificationEngine → EngineerMobile → EnterpriseSecurity → Pricing → Testimonials → FAQ → CTA. Server shell (metadata/JSON-LD/`getCurrentUserOrNull`/`AnimatedBackground`/`LandingHeader`/`LandingFooter`) unchanged.
  - **Deleted** (value folded into gallery + mockup): `ScrollStorySection.tsx`, `PlatformShowcaseSection.tsx`, `DeviceShowcaseSection.tsx` (grep-confirmed no source importers).
  - **Verified**: `tsc --noEmit` clean; banned-literal grep across `components/landing/` → 0 matches. `npm run build` deferred (transient Bash-classifier outage).

## 2026-08-05 (earlier)
- **Vercel Geist Design Redesign — Phase 1 (Token Foundation, from scratch)**:
  - **`app/globals.css` full rewrite** to a single-source-of-truth Geist token sheet. Light `:root` + dark `.dark` palettes with exact DESIGN.md hex values: `--color-ink` #171717, `--color-canvas` #fafafa, `--color-canvas-elevated`, grey ladder (`--color-body`/`--color-mute`/`--color-faint`), hairline set (`--color-hairline`, `--color-hairline-soft`, alias `--color-hairline-soft-surface`), `--color-link` #0070f3 (+ deep/soft), accents (violet/cyan/pink/magenta), semantic error/warning/success (+ deep/soft), and gradient stops. Dark palette: canvas #0a0a0a, elevated #171717, ink #fafafa, body #a3a3a3, hairline #262626, link #3b82f6.
  - **Typography**: 11 type tokens (`--text-*-size/-line/-spacing/-weight`) + utility classes `.display-xl` `.heading-lg` `.heading-md` `.label-sm` `.eyebrow` `.body-lg` `.body-md` `.body-sm`.
  - **Spacing** (4→128 + section), **bimodal radius** (`--radius-sm` 6px app chrome … `--radius-pill` 100px marketing), **3-level elevation** (`--shadow-none/whisper/floating`), **motion suite** (`--motion-instant/fast/normal/slow/slower`, `--ease-out-cubic/spring/smooth`).
  - **`@theme inline` bridge**: maps shadcn-style semantic utilities (`bg-background`/`text-foreground`/`bg-card`/`bg-muted`/`text-muted-foreground`/`border-border`/`bg-primary`/`text-primary`/`ring-ring`/`bg-secondary`/`bg-destructive`) + `--text-*` + radius onto Geist tokens, so the 341 existing semantic-class usages across 24 files keep resolving.
  - **Component base classes** rewritten to consume only tokens: `.card-base`, `.card-elevated`, `.card-hover` / `.card-hover-system`, `.btn-primary/-secondary/-primary-sm/-ghost-sm/-success/-success-sm/-danger/-danger-sm`, `.input-base` (focus ring), `.badge-base`.
  - **Micro-interactions & motion**: `.mesh-gradient` (light + dark, `@keyframes meshFloat`), theme cross-fade (`:root.theme-transitioning *` transitions color props), keyframes `modalScaleIn/toastSpring/staggerReveal/shimmerWave/formErrorEnter/overlayFadeIn/rowExitSlide`, classes `.modal-enter/.modal-overlay-fade/.modal-content-scale/.nav-pill-active/.row-exit-slide/.toast-gpu-enter/.tabular-nums/.stagger-item/.skeleton-shimmer(-active)/.focus-ring/.form-error-enter`, restored 404 face animation block verbatim, scrollbar styling, `prefers-reduced-motion` guard.
  - **`components/theme/ThemeProvider.tsx`**: added smooth theme cross-fade — `setTheme` adds `theme-transitioning` to `documentElement`, applies theme immediately, removes class after 250ms (matches `--motion-normal`). `useTheme()` still returns `defaultContext` outside provider.
  - **`components/ui/Button.tsx`**: consolidated all 8 variants onto token base classes (`btn-primary` etc.), removed inline color strings; preserved `ButtonProps`/`LinkProps`/`Props` types, href-based `Link` rendering, loading spinner.
  - **Verified**: `npx tsc --noEmit` clean; `npm run build` clean (16 routes).
  - **Note**: audit confirmed the existing `components/ui/*` primitives (Card, Input, MetricCard, Modal, Toast, Spinner, EmptyState, Badge, Skeleton), `ThemeToggle`, and `components/layout/MobileBottomNav` already consume the Geist token system with premium framer-motion micro-interactions — the token foundation was the real gap. Per-file rewrites of remaining leaf surfaces (landing + app domain) are pending an Agent-classifier outage.
- **Automated Daily Summary Email System (Super Admin + Engineer)**:
  - **Migration `008_daily_summary_notifications.sql`**: Made `notifications.machine_id` nullable (summary emails are not machine-bound), added `engineer_summary` alert type to the CHECK constraint, added `payload` and `provider_response` jsonb columns, created a partial unique index `idx_notifications_summary_idempotency` on `(recipient_id, alert_type, alert_date, channel) WHERE machine_id IS NULL AND alert_type IN (daily_summary, engineer_summary, weekly_report, monthly_report)` for idempotency, and added `idx_notifications_recipient_id` / `idx_notifications_alert_type` indexes.
  - **`lib/email.ts`**: Upgraded to `sendEmailWithTracking()` — returns real SendGrid `X-Message-Id`, provider response (statusCode/body/headers), attempt count, and error. Configurable retry (default 2 retries with 1.5s delay). `sendEmail()` kept as a boolean wrapper for legacy auth/import emails.
  - **`lib/notifications/email-templates.tsx`**: Added full ServiceCentric-branded responsive super admin daily summary HTML/text templates (`getAdminDailySummaryEmailHtml`, `getAdminDailySummaryEmailText`) with KPI cards (Active Machines, Added Today, Completed Today, Due Today, Due Tomorrow, Overdue, Alerts Sent, Alerts Failed), Machines Added Today table, Machines Due Tomorrow table (with customer + engineer phone/email), Overdue table (longest overdue first, last service date), Services Completed Today table, per-channel notification summary, dark-mode support, and "Open Dashboard" CTA. Added engineer summary templates (`getEngineerDailySummaryEmailHtml`, `getEngineerDailySummaryEmailText`) with due-tomorrow machines, overdue machines, completed services today, and a friendly reminder box. HTML escaping uses char-code constants to survive editor auto-formatting.
  - **`lib/notifications/daily-summary.ts`** (NEW): Batched Supabase data fetchers (`fetchAdminDailySummaryData`, `fetchEngineerDailySummaryData`) using the admin client — active machines, new machines today, services completed today (with machine + engineer joins), notification stats by channel for today, engineer assigned machines. Includes `getDailySummaryContext()` (date helpers) and `hasSummaryNotification()` idempotency check.
  - **`app/actions/send-reminders.ts`**: Rewritten orchestration. PART 1: per-machine service reminders (engineer + customer emails) with `provider_response` + `retry_count` captured from the new `sendNotification` result. PART 2: super-admin daily summaries — only `role = super_admin` + active, idempotency-checked, payload stored for retry. PART 3: engineer daily summaries — individual data fetched per engineer, only sent when relevant data exists (due tomorrow / overdue / completed today), idempotency-checked, payload stored. PART 4: audit log with per-group sent/failed/skipped counts. Cache tags revalidated.
  - **`app/actions/notifications.ts`**: `resendNotification()` now detects summary alert types and replays the stored HTML/text payload via `sendEmailWithTracking`, persisting the new provider response alongside `retry_count` and status.
  - **`lib/queries/notifications.ts`**: Search now covers recipient email/name, machine code/name, message IDs, plus error messages. Added `date_from` / `date_to` filters on `alert_date`. Select now includes `payload` + `provider_response`.
  - **`app/(app)/notifications/page.tsx`**: Passes `date_from` / `date_to` searchParams through to the query + client.
  - **`components/notifications/NotificationListClient.tsx`**: Alert-type filter options expanded to include Today, Tomorrow, Overdue, Daily Summary, Engineer Summary, New Machine, System Error; added date-range filter inputs; search placeholder widened to "Search recipient / machine...".
  - **`components/notifications/NotificationPreviewModal.tsx`**: Summary notifications now render the actual stored HTML email via `dangerouslySetInnerHTML` (scrollable preview) instead of the generic chat bubble; added a Provider Delivery Response viewer that pretty-prints the stored `provider_response` jsonb.
  - **`lib/types/database.ts`**: `machine_id` now `string | null`; added `payload` + `provider_response` to `Notification`; added `engineer_summary` to `AlertType`.
- **Theme Engine Resilience & Minimal MetricCard Refinement**:
  - **React 19 / Next 16 Script Warning Fix**: Added `suppressHydrationWarning` to the `<script>` tag in `ThemeScript.tsx`.
  - **ThemeProvider Resilience**: Updated `useTheme()` in `ThemeProvider.tsx` to safely return `defaultContext` instead of throwing an unhandled exception if called outside `ThemeProvider`.
  - **MetricCard UI Simplification**: Removed `.inline-flex` trend badge and `"View details"` flex item from `MetricCard.tsx` and `Skeleton.tsx` per user feedback, leaving a clean, high-contrast metric value display.
  - **Uniform Equal Grid Sizing**: Fixed lopsided/uneven metric cards on `/dashboard` by replacing mixed flex/grid classes with responsive CSS grid (`grid-cols-2 md:grid-cols-4` for admin / `grid-cols-2 sm:grid-cols-3 lg:grid-cols-6` for non-admin) with `items-stretch`.
  - **MetricCard & Skeleton Alignment**: Updated `MetricCard.tsx` and `Skeleton.tsx` so `<motion.div>` and `<Card>` fill 100% height and width (`h-full w-full flex flex-col justify-between`) and added uniform spacer footers (`h-4 mt-auto pt-1`) when `href` is absent.
  - **Growth/Loss Percentage Indicators**: Calculated real-time percentage indicators on metric cards: Month-over-Month service completion growth/loss rate (`+14.2% MoM` / `-5.0% MoM`), 30-day overdue reduction rate (`-20% 30d`), active fleet uptime percentage (`92% active`), and alert delivery success rate (`98% rate`).
- **Dashboard 8-Metric Dynamic Single-Row Layout**: Restored all 8 metric cards (`Total Fleet`, `Active`, `Due Today`, `Due Tomorrow`, `Overdue`, `Completed`, `Alerts Sent`, `Alerts Failed`) to `/dashboard`. Configured layout to fit in **1 single row on desktop** (`lg:flex lg:w-full lg:items-stretch lg:flex-1`) with dynamic width distribution, and **2 rows of 4 cards on mobile** (`grid-cols-4`).
  - **Dashboard Header & Recent Activity Removal**: Removed welcome title ("Welcome back...") and subtitle from `/dashboard` across all roles. Removed `DashboardRecentActivitySection` & `getRecentActivity()` data fetching from `/dashboard` (audit logs accessible on `/audit-logs`).
  - **Dashboard Single-Row Executive KPI Grid**: Streamlined top KPI metrics into a single-row desktop grid (`grid-cols-2 md:grid-cols-4`) featuring 4 high-level KPI cards (Total Fleet, Active Operating, Due Today, Overdue).
  - **PublicNavbar Logo Dual-Theme Outline**: Added a thin black outline in light theme and thin white outline in dark theme (`filter drop-shadow-[0_0_1px_rgba(0,0,0,0.85)] dark:drop-shadow-[0_0_1px_rgba(255,255,255,0.85)]`) to the brand logo in `PublicNavbar.tsx`.
  - **MachineModal Streamlining**: Cleaned up `MachineModal.tsx` by removing redundant hints, long verbose description paragraphs, and 5 heavy wrapper cards, converting it into a clean, compact 2-column modal layout.
  - **Dark Mode Token Contrast Fixes**: Replaced hardcoded white-on-white text tokens (`bg-[var(--color-ink)] text-white`) with adaptive theme tokens (`bg-[var(--color-ink)] text-[var(--color-canvas)]`) across `MachineListClient.tsx` (all-filter button, stat cards, FAB), `users-client.tsx` ("All Roles", "All Status", avatar circles, FAB), and `UserDetailSheet.tsx` (avatar circle).
- **Enterprise Dual-Theme System (Light + Dark)**:
  - **Design Token System (`globals.css`)**: Overhauled OKLCH color token architecture. Mapped standard CSS color pairs (`--background`, `--foreground`, `--card`, `--card-foreground`, `--popover`, `--popover-foreground`, `--primary`, `--primary-foreground`, `--muted`, `--muted-foreground`, `--border`, `--input`, `--ring`) alongside existing `--color-*` variables to ensure backward compatibility and dark mode theme switching.
  - **Anti-FOUC Head Script (`ThemeScript.tsx`)**: Created synchronous inline head script that reads `localStorage` or `prefers-color-scheme: dark` before page paint, injecting `.dark` or `.light` classes and `color-scheme` to eliminate flash of unstyled content.
  - **Theme Provider (`ThemeProvider.tsx`)**: Created React Context provider supporting `"light" | "dark" | "system"` modes, system theme media query listeners, and `localStorage` key `servicecentric-theme`.
  - **Animated Theme Toggle (`ThemeToggle.tsx`)**: Created Framer Motion 12 spring-animated theme toggle button featuring Sun <-> Moon morphing icons, particle glow halo, and popover theme selection menu. Integrated into `PublicNavbar.tsx`, `MobileBottomNav.tsx`, `LoginPage`, `SignupPage`, and `ForgotPasswordPage`.
  - **Core UI Primitives Migration**: Updated `Table.tsx`, `SearchableSelect.tsx`, `Badge.tsx`, `Tooltip.tsx`, `MetricCard.tsx`, `CommandPalette.tsx`, and `CookieConsent.tsx` to use semantic theme tokens.
  - **Recharts Dynamic Dark Mode (`Charts.tsx`)**: Integrated `useTheme()` hook into Recharts `MonthlyServicesChart` and `OverdueTrendChart`, dynamically updating SVG tooltip background (`#161D27` / `#ffffff`), borders, gridlines (`rgba(255,255,255,0.08)`), and tick text colors.
  - **Feature Views & Pages**: Updated `MobileDashboardHeader`, `MobileDueBuckets`, `ServicesClient`, `AuditLogsClient`, `UserRow`, `MobileUserCard`, `NotificationPreviewModal`, `LoginPage`, `SignupPage`, `ForgotPasswordPage`, and `NotFound` 404 page for dark mode compatibility.

## 2026-08-04
- **Code Quality Pass & Performance Optimization (Full Codebase Audit)**:
  - **Lint & TypeScript Cleanup**: Fixed all 24 TypeScript errors and 58 ESLint warnings across the entire codebase.
  - **Removed Unused Imports/Variables**: `UserX` in `app/(app)/users/users-client.tsx`; `ReactNode` in `components/ui/Select.tsx`; `metadata` parameter in `lib/notifications/sms.ts` (`sendSMS`) and `lib/notifications/whatsapp.ts` (`sendWhatsAppMessage`); `today`/`tomorrow` variables in `lib/notifications/templates.ts`.
  - **Aligned Function Signatures**: Updated `sendNotification` in `lib/notifications/index.ts` to call `sendSMS` and `sendWhatsAppMessage` with 2 args (matching the removed `metadata` parameter), eliminating TypeScript errors.
  - **Dashboard Cache Lookup Optimization**: `DashboardChartsSection` now calls `getDashboardCharts()` once (via `Promise.all` → single `cache()` call) instead of two separate `getMonthlyServices()` + `getOverdueTrend()` calls. `DashboardDueListsSection` now calls `getDashboardDueLists()` once instead of three separate `getDueMachines()` calls. This reduces redundant `unstable_cache` lookups from 5 to 2 per request.
  - **MobileDueBuckets Memoization**: Added `useMemo` for the tab configuration array and `useCallback` for `renderItemList` in `components/dashboard/MobileDueBuckets.tsx` to prevent unnecessary array reconstruction and function recreation on re-renders.
  - **Files Changed**: `app/(app)/users/users-client.tsx`, `components/ui/Select.tsx`, `lib/notifications/sms.ts`, `lib/notifications/templates.ts`, `lib/notifications/whatsapp.ts`, `lib/notifications/index.ts`, `app/(app)/dashboard/page.tsx`, `components/dashboard/MobileDueBuckets.tsx`.
- **Bulk Machine Import Feature (`/machines`)**:
  - Implemented Excel bulk import with drag-and-drop upload, auto-generated machine codes (MCH-XXXXXX), comprehensive validation (required fields, Indian mobile numbers, engineer name matching), detailed error reporting with row numbers, sample template download, audit logging, and cache invalidation.
  - Created `components/machines/MachineImportModal.tsx` for the import UI and `app/actions/machine-import.ts` with `importMachinesFromExcel()` server action and `getSampleExcelTemplate()` helper.
- **Mobile & Header UI/UX Feedback Polish (`/machines`, `/users`, `MobileBottomNav`)**:
  - **Mobile Profile Drawer Search Button**: Removed redundant "Search Command Palette ⌘K" button from the mobile profile slide-up drawer in `MobileBottomNav.tsx`.
  - **Machine List Header Description & Add Button**: Removed description paragraph from `PageHeader` in `MachineListClient.tsx` and hidden the `Add Machine` header button on mobile screens (`hidden sm:inline-flex`).
  - **Machine List Mobile FAB**: Updated the mobile floating action button (FAB) in `MachineListClient.tsx` to trigger the `MachineModal` for adding a machine.
  - **Users Management Header Invite Button**: Added responsive hiding (`hidden sm:inline-flex`) to the `Invite New User` button in `PageHeader` in `users-client.tsx`.
- **Audit Log Email Tracking & Super Admin Role-Based Privacy Protection (`/audit-logs`)**:
  - **Auth & User Action Metadata Enrichment**: Updated `app/actions/auth.ts` and `app/actions/users.ts` to capture full actor and target user metadata.
  - **Super Admin Role-Based Privacy Redaction**: Added server-side sanitization in `lib/queries/audit-logs.ts` (`getAuditLogsFiltered`).
  - **Rich Event Descriptions**: Updated `getAuditLogDescription` in `lib/audit-helpers.ts` to output complete contextual sentences.
  - **UI Email Display**: Updated `AuditLogsClient.tsx` row header line to display actor email IDs.
- **Audit Log Action Formatting & User-Friendly UX (`/audit-logs` & `/dashboard`)**:
  - Created `lib/audit-helpers.ts` containing a central map of all audit action codes, dynamic fallback humanizer, color badge variant generator, and contextual metadata summary sentence generator.
  - Replaced dot-separated raw action keys with clean, human-readable titles across `/audit-logs` and `/dashboard` Recent Activity feed.
- **Navbar Layout Alignment, KBD Shortcut Badge Removal & Machine Table Cell Refinements**:
  - **Machine Name & Code Table Column**: Updated `EnterpriseTable` column definition in `MachineListClient.tsx`.
  - **Machine Detail Page Hero Header**: Updated `machine-client-view.tsx` hero banner.
  - **PublicNavbar Search Button**: Removed the `<kbd>⌘K</kbd>` keyboard shortcut badge element from the search button.
  - **Navbar Alignment**: Updated `PublicNavbar` container width to `max-w-[1400px] px-4 lg:px-6`.
- **Users Page Approval Button UX Fixes**:
  - Added `success` / `success-sm` button variants to `components/ui/Button.tsx`.
  - Changed Approve button in pending approvals section to `success-sm`.
  - Fixed shared loading state bug in `app/(app)/users/users-client.tsx`.
- **Users Page Deactivate Button Enhancement**:
  - Added `Power` icon to the Deactivate/Activate button in `UserRow.tsx`.
- **Mobile Dashboard Header & Navbar Search Button Polish**:
  - Removed `<RefreshButton>` from `MobileDashboardHeader.tsx`.
  - Expanded search button width in `PublicNavbar.tsx`.
- **Dashboard Header, Public Navbar & Command Palette UI Polish**:
  - Removed "Open Command Palette Search" button and "Live Engine Active" badge from `MobileDashboardHeader.tsx`.
  - Removed "Live Engine Active" badge from desktop `PageHeader` on `/dashboard`.
- **Page Caching System & Targeted Database Refresh Buttons**:
  - Configured Next.js App Router client router cache (`staleTimes: { dynamic: 60, static: 180 }`) in `next.config.ts`.
  - Created `refreshPageDataAction` server action (`app/actions/refresh.ts`).
  - Created reusable `RefreshButton` client component.
- **Top 10 Dashboard Activity Feed & Dedicated Audit Logs Page (`/audit-logs` & `/dashboard/logs`)**:
  - Limited Recent Activity feed card on `/dashboard` to top 10 newest logs.
  - Built server-side filtered data access layer query in `lib/queries/audit-logs.ts`.
  - Created `AuditLogsClient.tsx` interactive UI.
- **Signup Mobile Number + Error Handling Improvements**:
  - Added Mobile Number input to `/signup`.
  - Improved signup error handling and user-facing messages.
- **Production-Grade Audit & Security Enhancements**:
  - Audited all Server Actions (`app/actions/*`) and API endpoints (`api/cron`).
  - Secured cron route and resend actions.
- **JS Bundle Size Optimization (Dynamic Imports)**:
  - Dynamically loaded heavy React components using `next/dynamic` with `ssr: false`.
