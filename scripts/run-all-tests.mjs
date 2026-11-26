#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');

const SUITES = [
  {
    name: 'Security & Rules Link Integrity',
    cmd: 'node',
    args: ['scripts/verify-security-links.mjs'],
    domain: 'Documentation, Rules & Link Integrity',
  },
  {
    name: 'Parity Rules & Skills Compliance',
    cmd: 'node',
    args: ['scripts/test-parity-rules-and-skills.mjs'],
    domain: '100% Web/Mobile Parity, Design Tokens & Skills',
  },
  {
    name: 'Mobile Typography Guard',
    cmd: 'node',
    args: ['scripts/check-typography.mjs'],
    domain: 'Native Mobile Typography (<Text variant="...">)',
  },
  {
    name: 'Mobile Touch & Soft Haptics Guard',
    cmd: 'node',
    args: ['scripts/test-touch-haptics.mjs'],
    domain: 'Native Touch Targets (44px) & Haptics',
  },
  {
    name: 'Shared Permissions RBAC Suite',
    cmd: 'pnpm',
    args: ['--filter', '@reachinternational/permissions', 'test'],
    domain: '6 Canonical Roles, Route Guards & Operations',
  },
  {
    name: 'Shared Validation Schemas Suite',
    cmd: 'pnpm',
    args: ['--filter', '@reachinternational/validation', 'test'],
    domain: 'Zod Schemas, Payloads, Passwords & Validation',
  },
  {
    name: 'Bulk Logsheet Import Engine Suite',
    cmd: 'node',
    args: ['--test', '--experimental-strip-types', 'tests/logsheet-import/test-logsheet-import-engine.mjs'],
    domain: 'XLSX Parsing, Field Validation & Duplicate Detection',
  },
  {
    name: 'Bulk Logsheet Import Security Suite',
    cmd: 'node',
    args: ['--test', 'tests/logsheet-import/test-logsheet-import-security.mjs'],
    domain: 'Admin-Only RBAC, Credential Hygiene & Server Enforcement',
  },
  {
    name: 'Bulk Logsheet Import Database Suite',
    cmd: 'node',
    args: ['tests/logsheet-import/test-logsheet-import-db.mjs'],
    domain: 'Atomic Import RPC, Idempotency, Rollback & Audit (Live Dev DB)',
  },
  {
    name: 'Shared Utils Suite',
    cmd: 'pnpm',
    args: ['--filter', '@reachinternational/utils', 'test'],
    domain: 'Calculations, Overlaps, Sanitization & Errors',
  },
  {
    name: 'Unified Approval Engine Exhaustive Verification Suite',
    cmd: 'node',
    args: ['tests/approvals/test-approval-engine-exhaustive.mjs'],
    domain: 'State Machine, Dual-Control, Concurrency, RBAC & Outbox',
  },
  {
    name: 'Native Mobile Unified Approvals Suite',
    cmd: 'node',
    args: ['apps/mobile/test/test-unified-approval-engine.mjs'],
    domain: 'Universal Queue, BottomSheet, Touch Targets, Haptics & Parity',
  },
  {
    name: 'Admin-Only Approvals & Scalability Verification Suite',
    cmd: 'node',
    args: ['tests/approvals/test-admin-only-approvals.mjs'],
    domain: 'Admin-Only Route Guards, Dual Auth, RLS & Composite Indexes',
  },
  {
    name: 'Bulk Approve All Engine & Document Invariants Suite',
    cmd: 'node',
    args: ['tests/approvals/test-approve-all-engine.mjs'],
    domain: 'Approve All, User Activation, Documents Pending Invariant & Parity',
  },
  {
    name: 'Mobile Unit & Integration Suite',
    cmd: 'node',
    args: ['apps/mobile/test/run-tests.mjs'],
    domain: 'Native Mobile Components, Screens & Workflows (357 tests)',
  },
  {
    name: 'Web CORS Security Verification',
    cmd: 'node',
    args: ['apps/web/scripts/test-cors-security.mjs'],
    domain: 'Web API Boundaries, Allowed Origins & Credentials',
  },
  {
    name: 'Web Navigation Feedback Suite',
    cmd: 'node',
    args: ['apps/web/scripts/test-navigation-feedback.mjs'],
    domain: 'Web Navigation, Actions & LiquidMetal CTA',
  },
  {
    name: 'Sidebar Collapsed Alignment Suite',
    cmd: 'node',
    args: ['scripts/test-sidebar-collapsed-alignment.mjs'],
    domain: 'Sidebar Collapsed Vertical Icon Alignment & Submenu Parity',
  },
  {
    name: 'RFQ System & Database Verification',
    cmd: 'node',
    args: ['supabase/tests/run_rfq_test.mjs'],
    domain: 'RFQ Schema, RLS, Buckets, RPC & Idempotency',
  },
  {
    name: 'Web Running Logs & Client Select Suite',
    cmd: 'node',
    args: ['apps/web/scripts/test-running-logs-remarks-and-client-select.mjs'],
    domain: 'Remarks Filtering, S00 Client Site Integration & UI Parity',
  },
  {
    name: 'Web Assignment Standardization Suite',
    cmd: 'node',
    args: ['apps/web/scripts/test-assignment-standardization.mjs'],
    domain: 'Assignment Dialogs, Roles, Overlap Guards & Error Handling',
  },
  {
    name: 'Web Shift Filter & Timing Sort Suite',
    cmd: 'node',
    args: ['apps/web/scripts/test-shift-filter-and-timing-sort.mjs'],
    domain: 'Shift Filter, Timing Sort, Active Roster Sync & Optimistic UI',
  },
  {
    name: 'Web Dashboard Standardization Suite',
    cmd: 'node',
    args: ['apps/web/scripts/test-dashboard-standardization.mjs'],
    domain: 'Dashboard Layout, High-Contrast CTAs & 6 Role Views',
  },
  {
    name: 'Web Machine Client Modal Suite',
    cmd: 'node',
    args: ['apps/web/scripts/test-machine-client-modal.mjs'],
    domain: 'Machine/Client Hierarchy & Multi-Site Auto Assignment',
  },
  {
    name: 'Web Machines RBAC Guard Suite',
    cmd: 'node',
    args: ['apps/web/scripts/test-machines-web-rbac.mjs'],
    domain: 'Capability Matrix, Route/Action 403, UI Mounting & Migration Guards',
  },
  {
    name: 'Web Contact & SEO Discoverability Suite',
    cmd: 'node',
    args: ['apps/web/scripts/test-contact-page.mjs'],
    domain: 'Contact Information, Schema.org JSON-LD & SEO Meta',
  },
  {
    name: 'Push Notifications Dispatcher Suite',
    cmd: 'node',
    args: ['apps/web/scripts/test-push-dispatcher.mjs'],
    domain: 'Bearer Auth, Channels, Payloads, Kill-Switches & Outbox Status',
  },
  {
    name: 'Push Notifications Phase 1 SQL Pipeline Suite',
    cmd: 'node',
    args: ['supabase/tests/test_push_notifications_phase1_sql.mjs'],
    domain: 'Outbox Schema, Slot Detection, Dedupe, Recheck, Quiet Hours & RPCs (26 tests)',
  },
  {
    name: 'Push Notifications Reminders, Producers & Observability Suite',
    cmd: 'node',
    args: ['supabase/tests/test_push_notifications_phase5_6.mjs'],
    domain: 'Reminder Scanners, BD1/AS1 Triggers, RLS Denial & Observability Views',
  },
  {
    name: 'Web Push Notifications Full Lifecycle Suite',
    cmd: 'node',
    args: ['apps/web/test/test-web-push-notifications.mjs'],
    domain: 'Service Worker /sw.js, WebPush VAPID, Tab Focus & Shell Skip',
  },
  {
    name: 'Native Mobile Push Notifications Lifecycle Suite',
    cmd: 'node',
    args: ['apps/mobile/test/test-mobile-push-notifications.mjs'],
    domain: '4 Android Channels, Notification Icon, Deep Linking & Device RPCs',
  },
  {
    name: 'Push Notifications Live End-to-End Pipeline Suite',
    cmd: 'node',
    args: ['scripts/test-push-end-to-end.mjs'],
    domain: 'Dual-Platform Registration, Enqueue, Batch Claim, Dispatch & Outbox Status',
  },
  {
    name: 'Cross-Platform Shift Assignment Push Suite',
    cmd: 'node',
    args: ['scripts/test-cross-platform-shift-assignment-push.mjs'],
    domain: 'Web/Mobile Supervisor to Web/Mobile Operator Shift Assignment & Dual Delivery',
  },
  {
    name: 'Push Notifications Hardening & Negative Security Suite',
    cmd: 'node',
    args: ['tests/push/test-push-hardening.mjs'],
    domain: 'SSRF Guards, Claim Concurrency, Multi-Device Independence, TTL, Quiet Hours & Zero-PII',
  },
  {
    name: 'Vercel Cron Hobby Plan Compliance Suite',
    cmd: 'node',
    args: ['scripts/test-vercel-cron-hobby-compliance.mjs'],
    domain: 'Vercel Free Tier Cron Schedules (<=1/day) & Route Integrity',
  },
  {
    name: 'Netlify Deployment Configuration Suite',
    cmd: 'node',
    args: ['scripts/test-netlify-deployment-config.mjs'],
    domain: 'Netlify Monorepo Build, Scheduled Functions & Platform Parity',
  },
  {
    name: 'Shift Entry Comprehensive Verification Suite',
    cmd: 'node',
    args: ['tests/operations/test-shift-entry-comprehensive.mjs'],
    domain: 'Multi-Shift, Multi-Machine, Date Independence & Unassigned Guard (16 tests)',
  },
  {
    name: 'Date-Based Operator Assignment Suite',
    cmd: 'node',
    args: ['tests/operations/test-date-based-assignment.mjs'],
    domain: 'Date Picker (Today..+7), Per-Date Independence, Duplicate Prevention & Web/Native Parity',
  },
  {
    name: 'In-App Notifications RBAC & Keyset Suite',
    cmd: 'node',
    args: ['supabase/tests/test_notifications_rbac_negatives.mjs'],
    domain: 'In-App Inbox RLS, Keyset Cursor, Keyset Tie-Breaker & Unread Count',
  },
];

console.log('\n================================================================');
console.log('  REACHINTERNATIONAL MONOREPO — COMPREHENSIVE TEST RUNNER       ');
console.log('================================================================\n');

let passedCount = 0;
let failedCount = 0;
const results = [];

for (const suite of SUITES) {
  process.stdout.write(`▶ Running: ${suite.name} (${suite.domain})... `);
  const start = Date.now();
  const res = spawnSync(suite.cmd, suite.args, {
    cwd: ROOT_DIR,
    shell: true,
    encoding: 'utf8',
  });
  const duration = ((Date.now() - start) / 1000).toFixed(2);

  if (res.status === 0) {
    passedCount++;
    console.log(`\x1b[32mPASS\x1b[0m [${duration}s]`);
    results.push({ name: suite.name, status: 'PASS', duration });
  } else {
    failedCount++;
    console.log(`\x1b[31mFAIL\x1b[0m [${duration}s]`);
    console.error(res.stdout || res.stderr);
    results.push({ name: suite.name, status: 'FAIL', duration, error: res.stderr || res.stdout });
  }
}

console.log('\n================================================================');
console.log(`  TEST RESULTS: ${passedCount}/${SUITES.length} SUITES PASSED`);
console.log('================================================================');

if (failedCount > 0) {
  console.log(`\x1b[31m  FAILURE: ${failedCount} suite(s) failed.\x1b[0m\n`);
  process.exit(1);
} else {
  console.log('\x1b[32m  SUCCESS: 100% SUITES PASSED CLEANLY ACROSS ALL PACKAGES & MODULES.\x1b[0m\n');
  process.exit(0);
}
