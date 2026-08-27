# Client Components Audit (Phase 1)

> **SCOPE**: Audit of all 131 `"use client"` components across `apps/web`.

---

## 1. Client Boundary Distribution

In Next.js App Router, `"use client"` marks the boundary where server code ends and client hydration begins. ReachInternational has 131 files with `"use client"`.

### Primary Client Hub Categories:

```text
CATEGORY                           COUNT   PURPOSE / RATIONALE
──────────────────────────────────────────────────────────────────────────────────────────
• Domain Client Hubs (*Client.tsx)     16   Stateful tabs, URL search filters, modal management
• Modals & Drawers (*Modal.tsx)        34   Form state, Zod validation, submission hooks
• Interactive UI Leaf Components       42   Dropdowns, tooltips, dialogs, custom time pickers
• Navigation & Shell Components        12   Sidebar collapse, theme toggle, command palette
• Print / Export Overlays              8    A4 layout canvas, browser window.print() trigger
• Auth & Registration Forms            6    Form submission, error banners, password visibility
• Other / Utility Components           13   Client notifications, clipboard handlers
```

---

## 2. Detailed Audit of Core Client Components

| Component File | Size | Why Client Component? | Can it become Server Component? | State / Browser APIs Used | Optimization Recommendation | Priority |
| :--- | :---: | :--- | :---: | :--- | :--- | :---: |
| `components/operations/OperationsClient.tsx` | 100.8 KB | Manages active tab (`logs`, `assignments`), site location filter, search input, assignment modal | No (Interactive UI hub) | `useState`, `useMemo`, `useCallback`, `useTransition`, `router.refresh` | Lazy-load `PrintableSupervisorLogsModal`; split tabs into sub-components | 🔴 P0 |
| `components/dashboard/OperatorDashboard.tsx` | 98.4 KB | Daily log multi-section form (A/B/C), real-time HMR calculations, time picker state | No (Interactive multi-step form) | `useState`, `useEffect`, `useMemo`, `crypto.randomUUID`, `window.print` | Lazy-load `PrintableOperatorLogsModal` and `xlsx` | 🔴 P0 |
| `app/(app)/machines/[id]/machine-client-view.tsx` | 59.4 KB | Tab navigation (`overview`, `services`, `specs`), modal triggers | No (Interactive view) | `useState`, `useTransition` | Move static specs well into RSC wrapper | 🟠 P1 |
| `components/operations/PrintableSupervisorLogsModal.tsx` | 40.9 KB | A4 PDF / Print layout preview, pagination calculation, `window.print()` | No (Print & DOM engine) | `window.print()`, `@base-ui/react/dialog`, `useMemo` | **Must be dynamically imported via `next/dynamic`** | 🟠 P1 |
| `components/machines/MachineListClient.tsx` | 39.6 KB | Fleet search, status filter pills, add/edit/delete modals | No (Filterable table & modal host) | `useState`, `useMemo`, `useTransition`, `router.refresh` | Eliminate `router.refresh()`; lazy-load `AddMachineModal` & `EditMachineModal` | 🟠 P1 |
| `app/(app)/users/users-client.tsx` | 32.9 KB | User search, role filter, 1-tap approval/reject, status toggle | No (Interactive directory & quick actions) | `useState`, `useMemo`, `useTransition`, `router.refresh` | Replace 8 `router.refresh()` calls with optimistic updates | 🟠 P1 |
| `components/dashboard/PrintableOperatorLogsModal.tsx` | 23.4 KB | A4 Operator log printable layout | No (Print engine) | `window.print()`, `useMemo` | **Must be dynamically imported via `next/dynamic`** | 🟠 P1 |
| `components/ui/CustomTimePicker.tsx` | 23.4 KB | 1-Click grid time selector (HH, MM, AM/PM, shift presets) | No (Interactive popup) | `useState`, `useRef`, `useEffect`, `ReactPortal` | Retain as optimized leaf client component | 🟢 P3 |
| `components/layout/AppSidebar.tsx` | 18.2 KB | Navigation items, collapsible sidebar state, mobile drawer | No (Navigation state) | `useState`, `usePathname`, `useMemo` | Retain as optimized shell component | 🟢 P3 |
| `components/auth/LoginFormClient.tsx` | 12.8 KB | Login inputs, password toggle, URL error param display | No (Form state) | `useActionState`, `useSearchParams`, `useState` | Retain as leaf form inside `<Suspense>` | 🟢 P3 |
| `components/auth/SignupFormClient.tsx` | 16.4 KB | Signup inputs, password confirm, role selection | No (Form state) | `useActionState`, `useState` | Retain as leaf form inside `<Suspense>` | 🟢 P3 |

---

## 3. Client Component Optimization Opportunities (Phase 2+)

1. **Heavy Modal Lazy-Loading**: Currently, all modals (Add Machine, Edit Machine, User Details, Create User, Supervisor PDF Modal, Operator PDF Modal) are statically imported at the top of their parent client files. Lazy loading them via `next/dynamic` will reduce the initial page JS bundle by **~180 KB**.
2. **Elimination of `router.refresh()` Cascades**: Switching from `router.refresh()` to optimistic UI updates in `users-client.tsx` and `MachineListClient.tsx` eliminates re-rendering the entire page tree on simple mutations.
3. **Restricting `'use client'` to Leaf Nodes**: Isolate static data presentation (e.g. machine specifications table) into RSC wrappers so only dynamic buttons and modals carry JavaScript to the browser.
