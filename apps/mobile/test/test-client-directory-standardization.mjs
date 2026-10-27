#!/usr/bin/env node
/**
 * Test Suite: Client Directory UI Standardization, Infinite Pagination & Card Redesign
 * 
 * Verifies:
 * 1. Total eradication of <Pagination> component from /clients/index.tsx
 * 2. Virtualized FlatList with onEndReached and onEndReachedThreshold for infinite scrolling
 * 3. KPI to Search box spacing: kpiContainer with marginBottom: spacingNumeric.md
 * 4. Redesigned MobileClientCard format:
 *    - Compact header with client name, ID and status pill with dot indicator
 *    - Inset 2-column details grid: GST | PAN, Contact Person | Contact Number, Sites | Maintenance Allowance
 *    - Side-by-side Assign Supervisor and Assign Machine actions with 3-dot compact square button
 *    - Inner padding 12-16dp and vertical gaps 12-16dp without oversized dividers
 * 5. ClientActionsModal bottom sheet actions for 3-dot menu
 * 6. ClientCardSkeleton matching layout to prevent CLS
 * 7. Zero occurrences of sample/illustrative layout footers
 */

import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const mobileRoot = path.resolve(__dirname, '..');

let totalPassed = 0;
let totalFailed = 0;

function runAssertion(name, fn) {
  try {
    fn();
    console.log(`  ✓ ${name}`);
    totalPassed++;
  } catch (err) {
    console.error(`  ✗ ${name}: ${err.message}`);
    totalFailed++;
  }
}

console.log('\n[Client Directory Suite]: Running UI Standardization & Infinite Pagination Verification...');

// ─── 1. PAGINATION COMPONENT ERADICATION & INFINITE SCROLLING ────────────────

runAssertion('clients/index.tsx has completely eradicated <Pagination> component', () => {
  const filePath = path.join(mobileRoot, 'app', '(app)', 'clients', 'index.tsx');
  const content = fs.readFileSync(filePath, 'utf8');
  assert.ok(!content.includes('<Pagination'), 'clients/index.tsx must not render <Pagination>');
  assert.ok(!content.includes('Pagination,'), 'clients/index.tsx must not import Pagination');
});

runAssertion('clients/index.tsx implements FlatList with onEndReached for infinite scroll', () => {
  const filePath = path.join(mobileRoot, 'app', '(app)', 'clients', 'index.tsx');
  const content = fs.readFileSync(filePath, 'utf8');
  assert.ok(content.includes('<FlatList'), 'clients/index.tsx must render FlatList');
  assert.ok(content.includes('onEndReached={handleLoadMore}'), 'FlatList must wire onEndReached');
  assert.ok(content.includes('onEndReachedThreshold={0.4}'), 'FlatList must define onEndReachedThreshold');
  assert.ok(content.includes('ListFooterComponent={renderListFooter}'), 'FlatList must render loading/end-of-list footer');
});

// ─── 2. KPI TO SEARCH BOX SPACING ───────────────────────────────────────────

runAssertion('clients/index.tsx provides clean 16dp spacing between KPI grid and search toolbar', () => {
  const filePath = path.join(mobileRoot, 'app', '(app)', 'clients', 'index.tsx');
  const content = fs.readFileSync(filePath, 'utf8');
  assert.ok(content.includes('kpiContainer: {'), 'Must have kpiContainer style');
  assert.ok(
    content.includes('marginBottom: spacingNumeric.md'),
    'kpiContainer must apply marginBottom: spacingNumeric.md to separate search box from KPI cards'
  );
});

// ─── 3. REDESIGNED CLIENT CARD FORMAT ────────────────────────────────────────

runAssertion('MobileClientCard.tsx implements compact header with name, code, and status dot pill', () => {
  const cardPath = path.join(mobileRoot, 'components', 'clients', 'MobileClientCard.tsx');
  const content = fs.readFileSync(cardPath, 'utf8');
  assert.ok(content.includes('headerArea'), 'Must have headerArea container');
  assert.ok(content.includes('statusPill'), 'Must have statusPill style');
  assert.ok(content.includes('statusDot'), 'Must have statusDot element');
});

runAssertion('MobileClientCard.tsx implements 2-column grid for GST, PAN, Contact, Phone, Sites & Allowance', () => {
  const cardPath = path.join(mobileRoot, 'components', 'clients', 'MobileClientCard.tsx');
  const content = fs.readFileSync(cardPath, 'utf8');
  assert.ok(content.includes('detailsWell'), 'Must have detailsWell inset box');
  assert.ok(content.includes('FileText'), 'Must render FileText icon for GST & PAN');
  assert.ok(content.includes('Contact Person'), 'Must have Contact Person row');
  assert.ok(content.includes('Contact Number'), 'Must have Contact Number row');
  assert.ok(content.includes('Sites'), 'Must have Sites row');
  assert.ok(content.includes('Maintenance allowance'), 'Must have Maintenance allowance row');
  assert.ok(!content.includes('specDivider'), 'Oversized spec dividers must be eradicated');
});

runAssertion('MobileClientCard.tsx implements side-by-side action buttons with 3-dot compact square', () => {
  const cardPath = path.join(mobileRoot, 'components', 'clients', 'MobileClientCard.tsx');
  const content = fs.readFileSync(cardPath, 'utf8');
  assert.ok(content.includes('Assign Supervisor'), 'Must render Assign Supervisor action');
  assert.ok(content.includes('Assign Machine'), 'Must render Assign Machine action');
  assert.ok(content.includes('threeDotButton'), 'Must have threeDotButton style');
  assert.ok(content.includes('MoreVertical'), 'Must render MoreVertical icon for 3-dot button');
});

// ─── 4. CLIENT ACTIONS MODAL & CONTEXTUAL MENU ──────────────────────────────

runAssertion('ClientActionsModal exists and provides full contextual actions', () => {
  const modalPath = path.join(mobileRoot, 'components', 'clients', 'ClientActionsModal.tsx');
  assert.ok(fs.existsSync(modalPath), 'ClientActionsModal.tsx must exist');
  const content = fs.readFileSync(modalPath, 'utf8');
  assert.ok(content.includes('View Client Profile & Fleet'), 'Must have View Details action');
  assert.ok(content.includes('Edit Client Information'), 'Must have Edit action');
  assert.ok(content.includes('Add Operational Site'), 'Must have Add Site action');
  assert.ok(content.includes('Copy Client Identifier'), 'Must have Copy ID action');
  assert.ok(content.includes('Archive Client Account'), 'Must have Soft Delete action');
});

// ─── 5. SKELETON ALIGNMENT & CLS PREVENTION ─────────────────────────────────

runAssertion('ClientCardSkeleton.tsx matches redesigned 2-column grid and button row', () => {
  const skelPath = path.join(mobileRoot, 'components', 'clients', 'ClientCardSkeleton.tsx');
  const content = fs.readFileSync(skelPath, 'utf8');
  assert.ok(content.includes('specsWell'), 'Skeleton must have specsWell');
  assert.ok(content.includes('twoColGrid'), 'Skeleton must have 2-column grid');
  assert.ok(content.includes('cardActions'), 'Skeleton must have cardActions matching button row');
});

// ─── 6. ZERO SAMPLE / ILLUSTRATIVE FOOTERS ──────────────────────────────────

runAssertion('Zero occurrences of illustrative or sample client data footers', () => {
  const filesToCheck = [
    path.join(mobileRoot, 'app', '(app)', 'clients', 'index.tsx'),
    path.join(mobileRoot, 'components', 'clients', 'MobileClientCard.tsx'),
    path.join(mobileRoot, 'components', 'clients', 'ClientDetailView.tsx'),
  ];
  for (const f of filesToCheck) {
    if (fs.existsSync(f)) {
      const c = fs.readFileSync(f, 'utf8');
      assert.ok(!c.includes('Illustrative layout'), `${f} must not contain Illustrative layout footer`);
      assert.ok(!c.includes('sample client data'), `${f} must not contain sample client data footer`);
    }
  }
});

console.log(`\nResults: ${totalPassed} passed, ${totalFailed} failed.`);
if (totalFailed > 0) process.exit(1);
