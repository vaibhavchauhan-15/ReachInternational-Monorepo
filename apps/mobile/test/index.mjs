#!/usr/bin/env node
/**
 * ReachInternational Mobile Automated Test Runner
 *
 * Central test runner providing categorized execution, regex filtering,
 * formatted output, duration tracking, and unified exit status.
 *
 * Usage:
 *   node test/index.mjs                  # Run all test suites
 *   node test/index.mjs --category=auth  # Run suites in a specific category
 *   node test/index.mjs <filter>         # Run suites matching a filter regex (e.g. 'badge', 'modal')
 *   node test/index.mjs --list           # List all available test suites
 *   node test/index.mjs --help           # Show help
 */

import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const testDir = path.dirname(__filename);
const mobileDir = path.resolve(testDir, '..');

// ─── SUITE REGISTRY & CATEGORIZATION ───
export const SUITES = [
  // Core Verification Suite
  {
    id: 'core',
    file: 'run-tests.mjs',
    name: 'Core Verification Suite',
    category: 'core',
    description: '357 monorepo assertions (app.json, eas.json, root layout, RLS, DAL, typography)',
  },

  // Auth & Security
  {
    id: 'auth',
    file: 'test-auth-workflows.mjs',
    name: 'Authentication & Keystore',
    category: 'auth',
    description: 'Hardware keystore persistence, login throttling, user enumeration defense',
  },
  {
    id: 'signup',
    file: 'test-signup-workflows.mjs',
    name: 'Sign-up & Validation',
    category: 'auth',
    description: 'Zod password rules, Indian phone validation, role constraints, error mappings',
  },

  // Operations & Fleet
  {
    id: 'shifts',
    file: 'test-shift-workflows.mjs',
    name: 'Today Shift Monitor & Roster',
    category: 'operations',
    description: 'Shift rosters, supervisor assignment, time calculations, shift cards',
  },
  {
    id: 'machines',
    file: 'test-machines-workflows.mjs',
    name: 'Machines Fleet Management',
    category: 'operations',
    description: 'Fleet inventory, category filters, machine detail modals, deletion dialogs',
  },
  {
    id: 'running-logs',
    file: 'test-running-logs-workflows.mjs',
    name: 'Running Logs & HMR Meter',
    category: 'operations',
    description: 'Operational meter logs, breakdown reporting, date range pickers',
  },
  {
    id: 'assign-modal',
    file: 'test-assign-operator-modal.mjs',
    name: 'Assign Personnel Modal',
    category: 'operations',
    description: 'Operator machine allocation, supervisor multi-select, optimistic UI feedback',
  },
  {
    id: 'standardized-assignment-ui',
    file: 'test-standardized-assignment-ui.mjs',
    name: 'Standardized Assignment UI Suite',
    category: 'operations',
    description: 'Modular assignment components, monochromatic avatars, 24h capacity, conflict validation, optimistic rollback',
  },
  {
    id: 'operator-dashboard',
    file: 'test-operator-dashboard-optimizations.mjs',
    name: 'Operator Dashboard Workflows',
    category: 'operations',
    description: 'Shift meter input cards, active shift detection, quick HMR logger',
  },
  {
    id: 'dashboard-states',
    file: 'test-dashboard-states.mjs',
    name: 'Multi-Role Dashboard States',
    category: 'operations',
    description: 'Role-gated dashboards (super_admin, admin, manager, supervisor, hr, operator)',
  },
  {
    id: 'payroll',
    file: 'test-payroll-workflows.mjs',
    name: 'Payroll & Salary Statement',
    category: 'operations',
    description: 'Workforce payroll, 4-col KPI grid, operator cards, salary slip, edit statement modal',
  },
  {
    id: 'clients',
    file: 'test-client-details-workflows.mjs',
    name: 'Client Details & Information Architecture',
    category: 'operations',
    description: 'Dedicated client details screen, modal eradication, 7-tab lazy loading, deep-link routing',
  },
  {
    id: 'client-directory',
    file: 'test-client-directory-standardization.mjs',
    name: 'Client Directory UI & Infinite Pagination',
    category: 'operations',
    description: 'Infinite scroll pagination, KPI spacing, 2-col details grid, compact header, side-by-side actions',
  },
  {
    id: 'client-supervisor-rbac',
    file: 'test-client-supervisor-rbac.mjs',
    name: 'Client Supervisor Assignment & Inherited RBAC',
    category: 'operations',
    description: 'Client-level supervisor assignment, inherited equipment oversight, 2-section assignments tab, zero raw typography',
  },

  // User Management
  {
    id: 'users',
    file: 'test-users-workflows.mjs',
    name: 'Users Administration',
    category: 'users',
    description: 'User roster, role badges, status toggle, assign machine/supervisor sheets',
  },
  {
    id: 'users-infinite',
    file: 'test-users-detail-infinite-pagination.mjs',
    name: 'User Detail Infinite Pagination',
    category: 'users',
    description: '6 tab infinite queries, skeleton loading, SegmentedToggle APK width safety',
  },

  // Documents & Storage
  {
    id: 'document-crud',
    file: 'test-document-crud-workflows.mjs',
    name: 'Document Upload & Delete CRUD',
    category: 'documents',
    description: 'Self-healing extensions, RLS storage policies, instant UI optimistic updates',
  },
  {
    id: 'document-viewer',
    file: 'test-document-viewer-workflows.mjs',
    name: 'In-App Native PDF & Image Viewer',
    category: 'documents',
    description: '@kishannareshpal/expo-pdf, continuous scroll, zero Google Drive redirects',
  },

  // Offline & Synchronization
  {
    id: 'offline',
    file: 'test-offline-duplicate-prevention.mjs',
    name: 'Offline Queue & Duplicate Prevention',
    category: 'offline',
    description: 'AsyncStorage persistent mutation queue, NetInfo connectivity, idempotency',
  },

  // Navigation & Lifecycle
  {
    id: 'header-back',
    file: 'test-header-back-navigation.mjs',
    name: 'Header Back Button & Stack Unwind',
    category: 'navigation',
    description: 'Stack history awareness (router.canGoBack), fallback routes, 48px touch targets',
  },
  {
    id: 'navigation',
    file: 'test-navigation-transitions.mjs',
    name: 'Navigation Transitions',
    category: 'navigation',
    description: 'Smooth slide animation stack, safe-area wrapping, stack header eradication',
  },
  {
    id: 'splash',
    file: 'test-splash-screen.mjs',
    name: 'Theme-Aware Animated Splash',
    category: 'navigation',
    description: 'GPU-accelerated fade in/out, light/dark LongLogo, anti-flicker lifecycle',
  },
  {
    id: 'quick-access',
    file: 'test-quick-access.mjs',
    name: 'Quick Access Command Palette',
    category: 'navigation',
    description: '38 searchable destinations, single modal bottom-sheet, touch close button',
  },

  // UI System & Primitives
  {
    id: 'badge',
    file: 'test-badge-component.mjs',
    name: 'Badge Token System',
    category: 'ui',
    description: 'Vercel Geist status pills, soft vs solid fills, high-contrast readability',
  },
  {
    id: 'button',
    file: 'test-button-optimizations.mjs',
    name: 'Button & CTA Optimizations',
    category: 'ui',
    description: 'Bimodal border radiuses, loading spinners, min 44px touch targets',
  },
  {
    id: 'press-feedback',
    file: 'test-press-feedback.mjs',
    name: 'Press Feedback & Touch Ergonomics',
    category: 'ui',
    description: 'Active opacity, Android ripple surfaces, micro-scale safety, tactile haptics',
  },
  {
    id: 'search-filter',
    file: 'test-search-filter-layout.mjs',
    name: 'Search & Filter Toolbar Layout',
    category: 'ui',
    description: 'SearchInput 36px height, flex shrink safety, filter chip typography',
  },
  {
    id: 'segmented-toggle',
    file: 'test-segmented-toggle.mjs',
    name: 'Segmented Toggle Control',
    category: 'ui',
    description: 'Sliding spring pills, APK shrink prevention, responsive tablet/mobile fit',
  },
  {
    id: 'timepicker',
    file: 'test-timepicker-workflows.mjs',
    name: 'TimePicker Dialog',
    category: 'ui',
    description: '12-hour AM/PM dialog, 48px stepper touch targets, shift boundary clamping',
  },
  {
    id: 'filter-components',
    file: 'test-optimized-filter-components.mjs',
    name: 'Filter Drawer & Overlays',
    category: 'ui',
    description: 'Drawer animation, backdrop tap dismiss, multi-criteria filter state',
  },
  {
    id: 'ui-states',
    file: 'test-ui-states.mjs',
    name: 'Empty & Loading UI States',
    category: 'ui',
    description: 'Vercel Geist empty states, skeleton loaders, error retry cards',
  },
  {
    id: 'about-logo',
    file: 'test-about-and-longlogo.mjs',
    name: 'Brand Assets & About Screen',
    category: 'ui',
    description: 'ReachLongLogo 2:1 aspect ratio, authentic transparent PNGs, About Us page',
  },
  {
    id: 'whats-new',
    file: 'test-whats-new-system.mjs',
    name: "What's New System",
    category: 'ui',
    description: 'Semantic version manifest, persistent viewed tags, release announcement sheet',
  },
  {
    id: 'settings',
    file: 'test-settings-workflows.mjs',
    name: 'Settings Screen Workflows',
    category: 'ui',
    description: 'Account settings, notification toggles, theme switcher, account deletion',
  },
];

export const CATEGORIES = {
  core: 'Core System Verification',
  auth: 'Authentication & Security',
  operations: 'Operations & Fleet Management',
  users: 'User Management & Personnel',
  documents: 'Documents & Storage',
  offline: 'Offline Queue & Synchronization',
  navigation: 'Navigation, Transitions & Lifecycle',
  ui: 'UI System, Layout & Components',
};

// ─── CLI ARGUMENT PARSER ───
const args = process.argv.slice(2);

if (args.includes('--help') || args.includes('-h')) {
  console.log(`
ReachInternational Mobile Test Suite Runner

Usage:
  node test/index.mjs [options] [filter]

Options:
  --category=<cat>, -c <cat>   Run only suites in specified category
  --filter=<pattern>, -f <pat> Filter suites by regex pattern
  --list, -l                   List all registered suites and categories
  --help, -h                   Show this help message

Available Categories:
  ${Object.entries(CATEGORIES)
    .map(([key, name]) => `${key.padEnd(12)} - ${name}`)
    .join('\n  ')}

Examples:
  node test/index.mjs                     # Run all 29 test suites
  node test/index.mjs --category=auth     # Run auth & sign-up suites
  node test/index.mjs machines            # Run machine fleet tests
  node test/index.mjs badge               # Run badge component tests
`);
  process.exit(0);
}

if (args.includes('--list') || args.includes('-l')) {
  console.log('\n======================================================');
  console.log('  REGISTERED MOBILE TEST SUITES (29 SUITES TOTAL)');
  console.log('======================================================\n');

  for (const [catKey, catName] of Object.entries(CATEGORIES)) {
    console.log(`\n📂 [${catKey.toUpperCase()}] ${catName}`);
    const catSuites = SUITES.filter((s) => s.category === catKey);
    for (const suite of catSuites) {
      console.log(`   • ${suite.file.padEnd(42)} ${suite.description}`);
    }
  }
  console.log('\n');
  process.exit(0);
}

// Category filter
let categoryFilter = null;
const categoryArg = args.find((a) => a.startsWith('--category=') || a.startsWith('-c='));
if (categoryArg) {
  categoryFilter = categoryArg.split('=')[1].toLowerCase();
} else {
  const cIndex = args.indexOf('-c');
  if (cIndex !== -1 && args[cIndex + 1]) {
    categoryFilter = args[cIndex + 1].toLowerCase();
  }
}

// Positional filter
let patternFilter = null;
const positional = args.filter((a) => !a.startsWith('-'));
if (positional.length > 0) {
  patternFilter = positional[0].toLowerCase();
}

// ─── FILTER SELECTION ───
let selectedSuites = SUITES;

if (categoryFilter) {
  selectedSuites = selectedSuites.filter((s) => s.category === categoryFilter);
  if (selectedSuites.length === 0) {
    console.error(`Unknown or empty category: "${categoryFilter}".`);
    console.error(`Available categories: ${Object.keys(CATEGORIES).join(', ')}`);
    process.exit(1);
  }
}

if (patternFilter) {
  selectedSuites = selectedSuites.filter(
    (s) =>
      s.id.toLowerCase().includes(patternFilter) ||
      s.file.toLowerCase().includes(patternFilter) ||
      s.name.toLowerCase().includes(patternFilter) ||
      s.category.toLowerCase().includes(patternFilter)
  );
  if (selectedSuites.length === 0) {
    console.error(`No test suites matching pattern: "${patternFilter}".`);
    process.exit(1);
  }
}

// ─── EXECUTION RUNNER ───
console.log('\n================================================================');
console.log('  REACH OPS — NATIVE MOBILE VERIFICATION RUNNER');
console.log(`  Selected Suites: ${selectedSuites.length} of ${SUITES.length}`);
if (categoryFilter) console.log(`  Category Filter: ${CATEGORIES[categoryFilter] || categoryFilter}`);
if (patternFilter) console.log(`  Pattern Filter:  ${patternFilter}`);
console.log('================================================================\n');

const startTime = Date.now();
const results = [];
let totalPassed = 0;
let totalFailed = 0;

for (let i = 0; i < selectedSuites.length; i++) {
  const suite = selectedSuites[i];
  const suitePath = path.join(testDir, suite.file);
  const suiteStart = Date.now();

  process.stdout.write(`[${i + 1}/${selectedSuites.length}] Running ${suite.file}... `);

  const proc = spawnSync(process.execPath, [suitePath], {
    cwd: mobileDir,
    encoding: 'utf8',
    env: { ...process.env, NODE_ENV: 'test' },
  });

  const durationMs = Date.now() - suiteStart;
  const isPass = proc.status === 0;

  if (isPass) {
    totalPassed++;
    console.log(`\x1b[32mPASS\x1b[0m (${durationMs}ms)`);
    results.push({ suite, pass: true, durationMs });
  } else {
    totalFailed++;
    console.log(`\x1b[31mFAIL\x1b[0m (${durationMs}ms)`);
    results.push({
      suite,
      pass: false,
      durationMs,
      stdout: proc.stdout,
      stderr: proc.stderr,
    });
  }
}

const totalDuration = ((Date.now() - startTime) / 1000).toFixed(2);

// ─── SUMMARY REPORT ───
console.log('\n================================================================');
console.log('  TEST EXECUTION SUMMARY');
console.log('================================================================');
console.log(`  Total Suites:   ${selectedSuites.length}`);
console.log(`  Passed:         \x1b[32m${totalPassed}\x1b[0m`);
console.log(`  Failed:         ${totalFailed > 0 ? `\x1b[31m${totalFailed}\x1b[0m` : '0'}`);
console.log(`  Total Duration: ${totalDuration}s`);
console.log('================================================================\n');

if (totalFailed > 0) {
  console.log('❌ FAILURES SUMMARY:');
  for (const r of results.filter((r) => !r.pass)) {
    console.log(`\n--- Failed: ${r.suite.file} (${r.suite.name}) ---`);
    if (r.stderr) console.error(r.stderr);
    if (r.stdout) console.log(r.stdout.slice(-1000));
  }
  process.exit(1);
} else {
  console.log('✅ ALL TEST SUITES PASSED SUCCESSFULLY!\n');
  process.exit(0);
}
