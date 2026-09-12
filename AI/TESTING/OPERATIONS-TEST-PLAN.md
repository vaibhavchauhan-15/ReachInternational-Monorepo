# Test Plan — Operations Hub (`/operations`) v1.0

**Status:** Approved QA plan (2026-09-12)
**Module under test:** `/operations` — Daily Running Hours (`tab=logs`, views: machine/client/operator), Assignments, Excel/PDF exports
**Systems:** Web (`apps/web`), Mobile parity (`apps/mobile`), Supabase PostgreSQL (`machine_hour_logs` + relations)
**Scope in:** logs tab end-to-end, filters, search, pagination, Excel/PDF export, RBAC, performance, compatibility, concurrency.
**Scope out:** `tab=entry` operator log creation deep testing (separate plan; regression only), billing/finance.

## 0. Verified Implementation Anchors

- Route: `apps/web/app/(app)/operations/page.tsx` — URL params: `tab, page, view (machine|client|operator), machine, client, site, operator, month (01–12 | all | custom), start, end, search, sort (date-desc|date-asc)`. Server pageSize fixed at **10**.
- Access gate: `requirePermission("machine.view")`; operators forced to `tab=entry`; non-operators forced to `tab=logs` (valid tabs: `logs, assignments, site-movement, operators`).
- Views confirmed: Machine / Client / Operator with `DateRangePicker` custom range; month defaults to current (`"09"` style); clearing range restores current month.
- Data: `machine_hour_logs` via `getOperationsHubData` (`apps/web/lib/queries/operators.ts`); exports via `apps/web/lib/utils/operator-logs-export.ts`, `supervisor-logs-export.ts`, `excel-template.ts`; PDF via `apps/web/components/operations/PrintableSupervisorLogsModal.tsx`; mobile parity `apps/mobile/app/(app)/operations.tsx`.
- Known security findings to re-verify closed: `BUG-OP-07` (RPC identity spoofing), `BUG-OP-05` (client/machine mismatch) — `AI/OPERATOR_BUGS_REPORT.md`.

## 1. Test Environment & Data Setup

| Item | Requirement |
|---|---|
| Env | Staging Supabase mirroring prod schema, all migrations (incl. `065_remove_duplicate_street_and_address_column`) |
| Roles | `super_admin`, `admin`, `service_manager`, `service_engineer`, `supervisor`, `operator`, `client`, `hr_manager` + 1 unauthorized user |
| Seed | Machines covering `active/spare/under_maintenance/breakdown` × `available/rented`; clients with 1/N/multi-site/zero logs; operators with 1 machine, multi-shift, many logs, zero logs; months with 0/max records; future-dated log; deleted/inactive record |
| Tooling | Playwright (UI + URL state + screenshots), SQL runner (ground truth), k6 (perf), Chrome DevTools throttling |
| Ground truth | Every scenario validated via chain: **UI → Network request → SQL result → UI rows → Excel rows → PDF rows** |

Ground-truth SQL pattern (`supabase/tests/qa/operations-ground-truth.sql`):
```sql
SELECT count(*) AS total,
       m.machine_id, m.serial_number, u.full_name AS operator, c.company_name,
       l.log_date, l.start_time, l.end_time, l.hmr_reading,
       l.running_hours, l.normal_hours, l.overtime_hours,
       l.breakdown_duration, l.location
FROM machine_hour_logs l
JOIN machines m   ON m.id = l.machine_id
LEFT JOIN users u   ON u.id = l.operator_id
LEFT JOIN clients c ON c.id = l.client_id
WHERE (@machineId IS NULL OR l.machine_id = @machineId::uuid)
  AND (@clientId   IS NULL OR l.client_id  = @clientId::uuid)
  AND (@operatorId IS NULL OR l.operator_id = @operatorId::uuid)
  AND (@site       IS NULL OR l.location ILIKE '%' || @site || '%' OR @site ILIKE '%' || l.location || '%')
  AND (@month      IS NULL OR @month = 'all' OR to_char(l.log_date, 'MM') = @month)
  AND (@start      IS NULL OR l.log_date >= @start::date)
  AND (@end        IS NULL OR l.log_date <= @end::date)
  AND (@search     IS NULL OR m.machine_id ILIKE '%'||@search||'%' OR m.serial_number ILIKE '%'||@search||'%'
                        OR u.full_name ILIKE '%'||@search||'%' OR l.remarks ILIKE '%'||@search||'%'
                        OR l.location ILIKE '%'||@search||'%')
ORDER BY l.log_date DESC;
```
(AND semantics — mirrors the actual app predicate; the UI must match the exact AND result.)

## 2. Functionality — Machine View (`view=machine`)

| ID | Case | Priority | Expected |
|---|---|---|---|
| FN-M-01 | Logs tab default view fallback (client when no view param) | P1 | Defaults per `page.tsx`; no crash |
| FN-M-02 | "All Machines" selected | P0 | All logs for current month |
| FN-M-03 | Select each machine individually | P0 | Only that machine's logs; overview card shows manufacturer, model, serial, total run hours, breakdown events |
| FN-M-04 | Status matrix (`active/spare/under_maintenance/breakdown` × `available/rented`) | P0 | Badges match DB `status`/`health_status` |
| FN-M-05 | Machine with zero logs | P1 | Empty state, KPIs = 0, no crash |
| FN-M-06 | Machine with multiple operators / multiple clients-sites | P0 | All logs appear; correct client + site per row |
| FN-M-07 | Switch machine mid-session | P0 | Fresh dataset; stale rows gone |
| FN-M-08 | Clear machine filter | P1 | `machine` param removed; dataset resets |

## 3. Functionality — Client View (`view=client`)

| ID | Case | Priority | Expected |
|---|---|---|---|
| FN-C-01 | Default client = most recent active client | P0 | Matches most recent log's client in DB |
| FN-C-02 | "All Clients" | P0 | Count = DB count |
| FN-C-03 | Clients: 1 machine / multiple machines / multiple sites / zero logs | P0 | Correct counts; zero-log client shows empty state, KPIs zeroed |
| FN-C-04 | Overview card: rented machine count, active sites, working hours, working days, CRM contact | P1 | All match SQL aggregates |
| FN-C-05 | Site/location sub-filter incl. punctuation addresses ("CPM |PO : CP Mills") | P0 | Bidirectional containment matching; no PostgREST 400 |
| FN-C-06 | Client isolation — no cross-client rows | P0 | Zero leakage |
| FN-C-07 | Clear client filter | P1 | Recent-client default restored |

## 4. Functionality — Operator View (`view=operator`)

| ID | Case | Priority | Expected |
|---|---|---|---|
| FN-O-01 | Loads; All Operators default | P0 | Full dataset |
| FN-O-02 | Each operator: 1 machine / multi-shift / many logs / zero logs | P0 | Only that operator's rows; 4 KPI cards (Run Hours, OT, Breakdowns, Matching Logs) match SQL SUM/COUNT |
| FN-O-03 | Cross-operator leakage | P0 | Zero rows from other operators |
| FN-O-04 | Clear operator filter | P1 | Reset to all |

## 5. Date & Time Filters

**Custom range (`DateRangePicker`, `month=custom&start&end`):** single day, 2-day, 7-day, full month, `start === end`, `start > end` (prevented or re-anchored), very large range, future range, leap-year Feb 29. NOTE: preset pills (Today / Yesterday / Last 7 / Last 30 / This Month) were REMOVED from `DateRangePicker.tsx` in the 2026-09-12 minimalist popover revision — verify they do not regress back, and do not test them as a feature.
**Month (`month` param):** current month (default), previous, future (empty, no error), January, December, zero-record month, max-record month, `month=all` (all time; preserved in URL and queries).

**Custom range (`DateRangePicker`, `month=custom&start&end`):** single day, 2-day, 7-day, full month, `start === end`, `start > end` (prevented or re-anchored), very large range, future range, leap-year Feb 29; presets Today / Yesterday / Last 7 / Last 30 / This Month.

**Picker interaction:** first-click start, hover provisional ribbon, second-click complete, re-anchor to earlier date, same-day double-click, clear (`AnimatedX`) → resets to current month.

**Combinations (AND, not OR):** machine×month, client×month, operator×month, machine×client, machine×operator, client×operator, all-three+month, each × custom date, all together. UI count must equal exact AND SQL count.

## 6. Database / Data Accuracy

For every combo (~40 sampled; full sweep automated):
- Verify: row count, machine, client, operator, `log_date`, `start_time`, `end_time`, HMR, running hours, normal hours, overtime, breakdown duration, location — vs DB.
- Deleted/inactive records follow expected business rules (excluded or soft-flagged).
- No duplicate rows (`machine_hour_logs.id` unique in render).
- Pagination never loses/duplicates records (all pages collected = SQL set).

## 7. Filter State, URL & UX

- Apply/change/clear-one/clear-all; remaining filters preserved.
- URL-driven state: refresh persistence, Back/Forward, direct-URL load, bookmark/share.
- Invalid params: garbage `view`, `machine=not-a-uuid`, `month=13`/`abc`, `start=banana` → graceful fallback, no 500/crash.
- `page` param: negative, 0, 999999, non-numeric → clamped (`Math.max(1, parseInt)`).
- Loading skeleton (`loading.tsx`), empty state, no-result state render.
- Role redirects: operator → `tab=entry`; non-operator hitting `tab=entry`/`tab=history`/`tab=machines`/invalid → `tab=logs`.

## 8. Search & Sort

`search` (debounced, global across machine, operator, remarks, locations): exact, partial, serial, client name, operator name, location, case-insensitive, numeric, special chars (`% _ ' ;` escaped, no PostgREST error), no-result, clear, search+filters, search+export. `sort=date-desc|date-asc` order verified vs DB.

## 9. Excel Export (`.xlsx`)

All filter combos: file opens (Office + LibreOffice + Google Sheets), filename correct, count = DB count, no missing/extra rows, all fields correct (HMR totals, running hours, normal hours, OT, breakdown duration, dates), headers/formatting per `excel-template.ts`, long strings safe, 10k+ rows complete, consecutive exports work, button loading/disabled states, failed export → toast error, export NOT limited to current page (10 rows) — full range fetched.

## 10. PDF Export (`PrintableSupervisorLogsModal`)

Per view (machine/client/operator) × (all / month / custom / combined): opens without corruption, A4 layout, branding/title, correct client/site & machine/operator metadata, date range, totals, no missing/duplicated rows, no text clipping/overlap, correct page breaks, multi-page and large datasets, print preview, **PDF row count = filtered DB count**.

## 11. Pagination

pageSize=10 server-side: page 1, last page, next/prev, first/last, filter change on last page (reset/clamp), total count correct, no dupes/missing across pages, export unaffected by current page.

## 12. Validation & Error Handling

Invalid filter values, invalid dates, `start > end`, network failure, DB timeout, server error, empty DB, export failure, corrupted DB values (null HMR/operator), rapid filter changes (no race — last request wins), double-click export, refresh mid-request. Never blank page or unhandled exception.

## 13. UI/UX & Responsive (3-tier)

- Mobile ≤640px (touch cards `block sm:hidden`, scrollable strips, ≥44px targets), Tablet 641–1023 (2-col), Desktop ≥1024 (full table).
- Zoom 100–200%, light/dark theme, viewport-aware popover flip (fixed for 1536×695 — verify no regression), dropdown clipping, long names/locations, table overflow, tab states, hover/focus/pressed/disabled/loading/empty/error states, keyboard nav, desktop tooltips (`TooltipWrapper`).
- Geist tokens: `#171717` ink, `#fafafa` canvas, `#ffffff` elevated, `#ebebeb` hairline, `#0070f3` blue, Geist Sans/Mono.
- Mobile parity (`apps/mobile/app/(app)/operations.tsx`): same three views, filters, CSV/PDF export.

## 14. Performance

| Metric | Target |
|---|---|
| Initial page load | ≤ 3s |
| Filter/search response | ≤ 2s |
| Pagination | ≤ 1s |
| Export start / PDF gen | ≤ 2s / ≤ 5s |

Load tests at 100 / 1k / 10k / 50k logs; slow-3G; high DB latency; rapid filter changes; concurrent users; memory check on 30-min session. Verify `PrintableSupervisorLogsModal` and `xlsx` remain lazy-loaded (prior P0 finding RPT-01).

## 15. Security & RBAC

- Roles: all 8 roles + unauthorized + logged-out.
- RLS scoping: operator sees only own logs; client only owned machines' logs; supervisor branch/assignment scoped.
- Direct URL ID tampering (`?machine=<other-tenant-uuid>`) cannot expose unauthorized records.
- Export authorization enforced at action level, not just UI.
- Re-verify BUG-OP-07 and BUG-OP-05 closed.
- SQL injection / XSS / tampering in `search`, `machine`, `month` params; rate limits; session expiry mid-session.

## 16. Concurrency & Compatibility

Two+ users: same filter, different filters, simultaneous exports, edit-while-filter — no races, no stale data beyond documented cache tags, no export corruption.
Browsers: Chrome, Edge, Firefox, Safari (desktop + iOS). Devices: desktop, laptop, tablet, Android, iPhone — verify downloads, Excel, PDF, print behavior.

## 17. Regression & Release Gate

Regression: all 3 views, filters, search, pagination, exports, RBAC, UI tiers, mobile parity + smoke of `/machines`, `/clients`, `/users`, `/dashboard`, `/audit`.

**Release Gate — do not approve unless:**
- 0 critical bugs; 0 high-severity data/export bugs
- No unauthorized data exposure
- Export counts = DB counts = UI counts (Excel AND PDF)
- All three views + all filter combinations pass
- 50k-row performance acceptable; responsive + mobile parity pass
- Full regression pass

## 18. Execution Order

1. DB ground-truth data audit → 2. Functionality FN-M/C/O + dates + combos → 3. URL/state → 4. Exports (Excel → PDF) → 5. Security/RBAC → 6. Error handling → 7. UI/Responsive → 8. Performance → 9. Concurrency/compat → 10. Regression + gate sign-off.

## 19. Current DB Test Baseline (2026-09-12 — automated run: 12/12 PASSED)

Executed via `node supabase/tests/qa/operations-data-integrity.mjs` (T1–T8) against the live Supabase project:

| Finding | Result | Impact on Test Plan |
|---|---|---|
| T1 Duplicates | PASS — 0 duplicate logs | Data accuracy baseline clean |
| T2 Machine statuses | Valid values; **seed gap: no `under_maintenance` machine**; only `active/spare/breakdown` present | **FN-M-04 matrix blocked** for `under_maintenance` — seed a machine before testing |
| T3 Client coverage | Only **2 clients**; 1 single-machine, 1 multi-machine; **no multi-site, no zero-log client** | **FN-C-03/FN-C-05 blocked** — seed multi-site + zero-log clients before testing |
| T4 Operator coverage | 65 operators; 45 zero-log, 8 multi-machine, 14 multi-shift — good classes | FN-O-02 testable for all classes |
| T5 Monthly volume | **All 120 logs in 2026-09 (current month)**; no historical months | Month-filter scenarios (previous month, January, December, zero/max months) have **no DB ground truth** — seed historical months or accept empty-result-only validation |
| T6 Referential integrity | PASS — no orphans, no null machine FK | Data accuracy clean |
| T7 Date sanity | PASS — latest log 2026-09-12, within 1-day grace | Future-month scenario returns empty by design |
| T8 Export baseline | 120 total logs (> pageSize 10) | Export-vs-DB comparisons meaningful; note 120 rows is **small** — large-dataset export tests (10k/50k) require seed expansion |

**Blockers before full plan execution:** (1) seed `under_maintenance` machine; (2) seed multi-site + zero-log clients; (3) seed logs across ≥3 historical months (ideally a zero-record month and a max-record month); (4) expand dataset for large-export/perf tiers.

**Executed tooling so far:** data-integrity suite (T1–T8, 12/12 PASS), `apps/web` typecheck (0 errors). DateRangePicker source verified for preset anti-regression. Remaining tiers (URL state, exports parity, RBAC, UI/perf) require a running app instance (Playwright) — blocked by the standing "don't open in the browser for testing" constraint; execute when approved.
