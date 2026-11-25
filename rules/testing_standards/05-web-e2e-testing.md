# Web End-to-End (E2E) Testing Standards

> **BROWSER WORKFLOW TESTING FOR MARKETING AND OPERATIONAL ADMIN SUITES**  
> *End-to-end tests validate that the entire web application—from browser interaction to edge proxy, Server Components, Server Actions, and Supabase database—operates seamlessly under real user workflows.*

---

## 1. Purpose

The purpose of ReachInternational's Web E2E Testing standards is to verify that **critical multi-step user journeys complete reliably without broken links, unhandled JavaScript exceptions, rendering flickers, or session drops** across all supported desktop and mobile browser engines.

---

## 2. Applicable Applications & Packages

- `apps/web`:
  * Public Marketing Routes: Landing page (`/`), Equipment catalog (`/equipment`), Brands, Industry solutions, Contact/Enquiry.
  * Auth Routes: Login (`/login`), Session recovery, Onboarding.
  * Operational Admin Routes: Dashboard (`/dashboard`), Fleet Machines (`/machines`), Tasks (`/tasks`), Shift Logging (`/operations`), Service & Maintenance (`/service`), Finance & Payroll (`/finance`), HR & Attendance (`/hr`).

---

## 3. Testing Targets

### A. Marketing User Journeys
1. **First-Load Experience**: Fast server-rendered initial view with zero layout shifts (CLS < 0.1).
2. **Catalog Discovery & Navigation**: Browsing equipment categories, filtering by brand (JCB, Toyota, Genie, BYD), searching model numbers, and viewing equipment details.
3. **Lead & Equipment Enquiry**: Submitting the enquiry form, validating Zod input constraints, displaying interactive feedback, and confirming form reset.
4. **Link & Asset Health**: Zero broken internal links (`404`), zero missing brand SVG/PNG logos, and zero console JavaScript errors.

### B. Admin & Operational User Journeys
1. **Authentication Flow**: Credential entry, Supabase SSR cookie issuance, redirect to role-specific dashboard home, and session logout.
2. **Fleet Machines Management**: Loading machine table, filtering by status (Active, Rented, Maintenance), sorting by hour meter, and searching by serial number.
3. **Operator Shift Logging**: Submitting shift hour logs, selecting machine and client site, entering starting and ending meter readings, and verifying instant optimistic/revalidated table updates.
4. **Data Tables & Pagination**: Page size switching, multi-column sorting, sticky header stability during scroll, and CSV export generation.

### C. Cross-Browser Engine Compatibility
- **Chromium**: Primary enterprise desktop and Android Chrome engine.
- **WebKit**: macOS Safari and iOS Safari browser engine (critical for font rendering and CSS layout).
- **Firefox**: Gecko rendering engine (ensuring standard CSS compatibility).

---

## 4. Required Testing Approach

```text
[ SETUP BROWSER CONTEXT ]
  ├── Initialize browser session (Desktop 1440x900 or Mobile 390x844 viewport)
  └── For Admin tests: inject valid authenticated test cookie / session

[ EXECUTE USER JOURNEY ]
  ├── Navigate to target route (e.g., /equipment or /machines)
  ├── Fill form fields and trigger user interactions (clicks, keyboard inputs)
  └── Await server response, optimistic update, or modal display

[ ASSERT WORKFLOW SUCCESS ]
  ├── Confirm URL transition or DOM state update
  ├── Confirm network requests return HTTP 200/302 (no 500 server errors)
  └── Confirm zero unhandled runtime console errors
```

---

## 5. Recommended Tools

- **Playwright**: End-to-end browser automation for modern web apps.
- **Node-based Browser/Workflow Runners**: Specialized verification scripts in `apps/web/scripts/` (e.g. `test-navigation-feedback.mjs`, `verify-landing-feedback.mjs`).

---

## 6. Actual Project Commands

```bash
# 1. Run web dev server for E2E exploration
pnpm --filter @reachinternational/web dev

# 2. Run landing page feedback & brand verification
node apps/web/scripts/verify-landing-feedback.mjs
node apps/web/scripts/verify-brand-logos.mjs

# 3. Run navigation & interactive feedback verification
node apps/web/scripts/test-navigation-feedback.mjs

# 4. Run CORS & API security tests
node apps/web/scripts/test-cors-security.mjs

# 5. Production web build validation (ensures all routes compile statically/dynamically)
pnpm --filter @reachinternational/web build
```

---

## 7. Success Criteria

1. **Journey Completion**: All critical user actions (submitting a form, navigating between pages, searching a table) complete with appropriate visual feedback.
2. **Zero Broken Assets**: All brand SVGs, hero imagery, and favicon icons load with HTTP 200.
3. **No Auth Leaks**: Attempting to access `/dashboard` or `/machines` without an authenticated session immediately redirects to `/login`.

---

## 8. Failure Handling

- If a form submission fails: inspect the Network tab for the Server Action response payload. Check if Zod rejected a field or if an unexpected database error occurred.
- If a route fails to render: verify that Server Components properly handle empty data from `lib/dal.ts` without throwing `undefined` access errors.

---

## 9. Evidence & Reporting

The test report must include:
- Routes verified.
- User journeys executed (e.g. "Equipment Catalog Filter", "Shift Entry Modal").
- Browser viewports tested.
- Status of navigation, forms, and network requests.
