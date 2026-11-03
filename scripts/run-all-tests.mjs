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
    name: 'Shared Utils Suite',
    cmd: 'pnpm',
    args: ['--filter', '@reachinternational/utils', 'test'],
    domain: 'Calculations, Overlaps, Sanitization & Errors',
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
    name: 'Web Contact & SEO Discoverability Suite',
    cmd: 'node',
    args: ['apps/web/scripts/test-contact-page.mjs'],
    domain: 'Contact Information, Schema.org JSON-LD & SEO Meta',
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
