# Reach Ops — Native Mobile Automated Test Suite

Comprehensive automated test and verification suite for the ReachInternational Native Mobile Application (`apps/mobile`), built with React Native 0.86, Expo SDK 57, TanStack Query, and Vercel Geist design tokens.

---

## 📁 Directory Structure & Organization

All mobile verification scripts and integration test suites are organized centrally in this directory:

```
apps/mobile/test/
├── README.md                                  # Directory documentation & suite index (this file)
├── index.mjs                                  # Central categorized test runner CLI
├── run-tests.mjs                              # Core monorepo verification suite (357 assertions)
│
├── [Auth & Security]
│   ├── test-auth-workflows.mjs                # Hardware Keystore persistence, session hints, enumeration defense
│   └── test-signup-workflows.mjs              # Sign-up validation, password complexity, error mappings
│
├── [Operations & Fleet]
│   ├── test-shift-workflows.mjs               # Today shift monitor, roster calculation, shift cards
│   ├── test-machines-workflows.mjs            # Fleet inventory, category filters, detail modals, delete dialogs
│   ├── test-running-logs-workflows.mjs        # Running logs, HMR meter verification, date range filters
│   ├── test-assign-operator-modal.mjs         # Operator machine allocation, supervisor multi-select
│   ├── test-operator-dashboard-optimizations.mjs # Shift meter entry cards, active shift detection
│   └── test-dashboard-states.mjs              # Multi-role dashboard rendering (6 canonical roles)
│
├── [User Management]
│   ├── test-users-workflows.mjs               # User management screens, role badges, status toggle, sheets
│   └── test-users-detail-infinite-pagination.mjs # 6 tab infinite queries, skeleton loading, SegmentedToggle fit
│
├── [Documents & Storage]
│   ├── test-document-crud-workflows.mjs       # Upload/delete CRUD, self-healing extensions, RLS policies
│   └── test-document-viewer-workflows.mjs     # In-app PDF viewer (@kishannareshpal/expo-pdf), shared caching
│
├── [Offline & Persistence]
│   └── test-offline-duplicate-prevention.mjs  # Persistent mutation queue, NetInfo sync banner, idempotency
│
├── [Navigation & Lifecycle]
│   ├── test-header-back-navigation.mjs        # Stack history awareness (router.canGoBack), fallback routes
│   ├── test-navigation-transitions.mjs        # Slide animation stack, safe-area wrapping, header safety
│   ├── test-splash-screen.mjs                 # Theme-aware animated splash, light/dark LongLogo, lifecycle
│   └── test-quick-access.mjs                  # Command palette, 38 destinations, single-modal architecture
│
└── [UI System & Components]
    ├── test-badge-component.mjs               # Geist badge token resolution, variant matrix, soft/solid fills
    ├── test-button-optimizations.mjs          # Button variants, radiuses, loading states, tactile haptics
    ├── test-press-feedback.mjs                # Active opacity, Android ripple surfaces, micro-scale safety
    ├── test-search-filter-layout.mjs          # SearchInput 36px height, flex shrink safety, filter chip typography
    ├── test-segmented-toggle.mjs              # Segmented sliding toggle, spring physics, APK shrink fix
    ├── test-timepicker-workflows.mjs          # TimePicker dialog, 12-hour AM/PM formatting, 48px touch targets
    ├── test-optimized-filter-components.mjs   # Filter drawer, backdrop dismiss, multi-criteria filter state
    ├── test-ui-states.mjs                     # Empty states, loading skeletons, error retry cards
    ├── test-about-and-longlogo.mjs            # ReachLongLogo 2:1 aspect ratio, authentic transparent PNGs
    ├── test-whats-new-system.mjs              # Release manifest, version gating, feature announcement sheet
    └── test-settings-workflows.mjs            # Settings screen navigation, notification toggles, theme switcher
```

---

## 🚀 Running Tests

### 1. Run All Test Suites (Recommended)
Runs all 29 test suites in sequence with formatted output, timing, and execution summary:
```bash
# From apps/mobile
pnpm test:all
# or directly
node test/index.mjs

# From monorepo root
pnpm --filter @reachinternational/mobile test:all
```

### 2. Run Core Verification Suite
Runs the comprehensive 357-assertion verification suite (app.json, eas.json, root layout, DAL, RLS, typography):
```bash
# From apps/mobile
pnpm test
# or
node test/run-tests.mjs
```

### 3. Run by Category
Filter suites by domain category using `--category=<name>` or `-c`:
```bash
node test/index.mjs --category=auth        # Authentication & security
node test/index.mjs --category=operations  # Operations, shifts, machines & fleet
node test/index.mjs --category=users       # User administration & detail pagination
node test/index.mjs --category=documents   # Documents CRUD & in-app PDF viewer
node test/index.mjs --category=offline     # Offline queue & network sync
node test/index.mjs --category=navigation  # Back navigation, transitions, splash & quick access
node test/index.mjs --category=ui          # Design system tokens, badges, buttons & layout
node test/index.mjs --category=core        # Core monorepo verification
```

### 4. Run by Keyword / Pattern
Filter suites matching any string or regex:
```bash
node test/index.mjs machines               # Runs test-machines-workflows.mjs
node test/index.mjs badge                  # Runs test-badge-component.mjs
node test/index.mjs splash                 # Runs test-splash-screen.mjs
node test/index.mjs users                  # Runs test-users-workflows.mjs & test-users-detail-infinite-pagination.mjs
```

### 5. Run an Individual Test Directly
Every test file is standalone and can be executed directly from either `apps/mobile` or monorepo root:
```bash
# From apps/mobile
node test/test-auth-workflows.mjs
node test/test-shift-workflows.mjs
node test/test-document-viewer-workflows.mjs

# From monorepo root
node apps/mobile/test/test-auth-workflows.mjs
```

### 6. List All Registered Suites
```bash
node test/index.mjs --list
```

---

## 📊 Complete Suite Registry (29 Suites)

| Category | Suite File | Scope & Key Invariants Verified |
| :--- | :--- | :--- |
| **Core** | `run-tests.mjs` | 357 assertions: app.json, eas.json, safe area insets, Supabase singleton, optimistic cache, 0 raw typography properties |
| **Auth** | `test-auth-workflows.mjs` | Hardware Keystore SecureStore, session hints vs authority, login throttling, user enumeration prevention |
| **Auth** | `test-signup-workflows.mjs` | Zod auth schemas, 8+ char complex passwords, Indian phone validation, role constraints, database error mappings |
| **Operations** | `test-shift-workflows.mjs` | Today shift roster, shift time calculations, ShiftCardSelector, OperatorEntryCard layout |
| **Operations** | `test-machines-workflows.mjs` | Fleet machine list, machine categories, detail modals, delete confirmation dialogs |
| **Operations** | `test-running-logs-workflows.mjs` | Running log filters, HMR meter reading validation, shift logs, quiet empty cards |
| **Operations** | `test-assign-operator-modal.mjs` | Machine allocation sheets, supervisor multi-select, optimistic assignment feedback |
| **Operations** | `test-operator-dashboard-optimizations.mjs` | Shift meter entry cards, active shift detection, quick HMR logger, touch responsiveness |
| **Operations** | `test-dashboard-states.mjs` | Multi-role dashboard state isolation across all 6 canonical roles (`super_admin` to `operator`) |
| **Users** | `test-users-workflows.mjs` | User management screens, role badges, status toggle, assign machine/supervisor sheets |
| **Users** | `test-users-detail-infinite-pagination.mjs` | 6 tab infinite queries, skeleton loading, SegmentedToggle APK width safety |
| **Documents** | `test-document-crud-workflows.mjs` | Self-healing extensions, RLS storage policies, instant UI optimistic updates |
| **Documents** | `test-document-viewer-workflows.mjs` | In-app native PDF viewer (@kishannareshpal/expo-pdf), continuous scroll, shared file cache |
| **Offline** | `test-offline-duplicate-prevention.mjs` | AsyncStorage persistent mutation queue, NetInfo connectivity banner, idempotency keys |
| **Navigation** | `test-header-back-navigation.mjs` | Stack history awareness (`router.canGoBack`), fallback routes, 48px touch targets |
| **Navigation** | `test-navigation-transitions.mjs` | Slide animation stack, safe-area wrapping, stack header eradication |
| **Navigation** | `test-splash-screen.mjs` | Theme-aware animated splash, light/dark LongLogo, anti-flicker lifecycle |
| **Navigation** | `test-quick-access.mjs` | Command palette, 38 destinations, single modal bottom-sheet, touch close button |
| **UI** | `test-badge-component.mjs` | Geist badge token resolution, variant matrix, soft vs solid fills, accessibility |
| **UI** | `test-button-optimizations.mjs` | Bimodal border radiuses, loading spinners, min 44px touch targets |
| **UI** | `test-press-feedback.mjs` | Active opacity, Android ripple surfaces, micro-scale safety, tactile haptics |
| **UI** | `test-search-filter-layout.mjs` | SearchInput 36px height, flex shrink safety, filter chip typography |
| **UI** | `test-segmented-toggle.mjs` | Segmented sliding toggle, spring physics, APK shrink fix |
| **UI** | `test-timepicker-workflows.mjs` | TimePicker dialog, 12-hour AM/PM formatting, 48px stepper touch targets |
| **UI** | `test-optimized-filter-components.mjs` | Filter drawer, backdrop dismiss, multi-criteria filter state |
| **UI** | `test-ui-states.mjs` | Empty states, loading skeletons, error retry cards, Geist dark/light tokens |
| **UI** | `test-about-and-longlogo.mjs` | ReachLongLogo 2:1 aspect ratio, authentic transparent PNGs, About Us page |
| **UI** | `test-whats-new-system.mjs` | Release manifest, version gating, feature announcement sheet |
| **UI** | `test-settings-workflows.mjs` | Settings screen navigation, notification toggles, theme switcher, account deletion |

---

## 🛠️ Adding a New Test Suite

When authoring a new test script:
1. Place the test file inside `apps/mobile/test/` using the naming convention `test-<feature>-workflows.mjs`.
2. Anchor all paths using `fileURLToPath(import.meta.url)`:
   ```javascript
   import path from 'node:path';
   import { fileURLToPath } from 'node:url';

   const __filename = fileURLToPath(import.meta.url);
   const testDir = path.dirname(__filename);
   const mobileDir = path.resolve(testDir, '..');
   const rootDir = path.resolve(mobileDir, '../..');
   ```
3. Register the new suite in `SUITES` inside `apps/mobile/test/index.mjs` under the appropriate category.
4. Verify execution: `node test/index.mjs <feature>` and `node test/index.mjs`.
