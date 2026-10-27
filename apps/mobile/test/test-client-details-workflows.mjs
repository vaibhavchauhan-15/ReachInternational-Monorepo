#!/usr/bin/env node
/**
 * Test Suite: Native Client Details Page — Workflows, Security, & Architecture
 *
 * Verifies:
 * 1. Dedicated route structure: /clients/index and /clients/[id]
 * 2. Total modal eradication: zero remaining traces of ClientDetailModal
 * 3. Unified data hook (useClientDetailData) with TanStack Query, 30s stale time,
 *    exact column projections (zero SELECT *), and canonical client ID resolution
 * 4. Comprehensive information sections: Overview, Contacts, Tax, Locations,
 *    Fleet, Logs, Workforce Assignments, Shift presets, History, and Audit
 * 5. Instant UI first & layout-matched skeleton (ClientDetailSkeleton)
 * 6. Deep link route sanitization & SyncCoordinator offline revalidation
 * 7. Mobile & tablet responsiveness, touch ergonomics, and Geist tokens
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

console.log('\n[Client Details Suite]: Running Native Client Details Verification Tests...');

// ─── 1. ROUTE STRUCTURE & EXPO ROUTER REGISTRATION ──────────────────────────

runAssertion('apps/mobile/app/(app)/clients/index.tsx exists as client directory route', () => {
  const filePath = path.join(mobileRoot, 'app', '(app)', 'clients', 'index.tsx');
  assert.ok(fs.existsSync(filePath), 'Expected clients/index.tsx to exist');
});

runAssertion('apps/mobile/app/(app)/clients/[id].tsx exists as dedicated client details route', () => {
  const filePath = path.join(mobileRoot, 'app', '(app)', 'clients', '[id].tsx');
  assert.ok(fs.existsSync(filePath), 'Expected clients/[id].tsx to exist');
});

runAssertion('Legacy apps/mobile/app/(app)/clients.tsx is completely eradicated', () => {
  const filePath = path.join(mobileRoot, 'app', '(app)', 'clients.tsx');
  assert.ok(!fs.existsSync(filePath), 'Expected legacy clients.tsx to be removed');
});

runAssertion('_layout.tsx registers clients/index tab and clients/[id] screen', () => {
  const layoutPath = path.join(mobileRoot, 'app', '(app)', '_layout.tsx');
  const content = fs.readFileSync(layoutPath, 'utf8');
  assert.ok(
    content.includes('<Tabs.Screen name="clients/index" options={{ title: \'Clients\' }} />'),
    '_layout.tsx should register clients/index'
  );
  assert.ok(
    content.includes('<Tabs.Screen name="clients/[id]" options={{ ...motion.tabsShift, title: \'Client Details\', href: null }} />'),
    '_layout.tsx should register clients/[id] with href: null'
  );
});

// ─── 2. TOTAL MODAL ERADICATION ─────────────────────────────────────────────

runAssertion('ClientDetailModal.tsx file is completely removed from components/clients', () => {
  const modalPath = path.join(mobileRoot, 'components', 'clients', 'ClientDetailModal.tsx');
  assert.ok(!fs.existsSync(modalPath), 'Expected ClientDetailModal.tsx to be deleted');
});

runAssertion('components/clients/index.ts does not export ClientDetailModal', () => {
  const indexPath = path.join(mobileRoot, 'components', 'clients', 'index.ts');
  const content = fs.readFileSync(indexPath, 'utf8');
  assert.ok(!content.includes('ClientDetailModal'), 'index.ts must not export ClientDetailModal');
  assert.ok(content.includes('ClientDetailView'), 'index.ts must export ClientDetailView');
  assert.ok(content.includes('ClientDetailSkeleton'), 'index.ts must export ClientDetailSkeleton');
});

runAssertion('clients/index.tsx has zero occurrences of ClientDetailModal or selectedDetailClient', () => {
  const indexPath = path.join(mobileRoot, 'app', '(app)', 'clients', 'index.tsx');
  const content = fs.readFileSync(indexPath, 'utf8');
  assert.ok(!content.includes('ClientDetailModal'), 'clients/index.tsx must not reference ClientDetailModal');
  assert.ok(!content.includes('selectedDetailClient'), 'clients/index.tsx must not reference selectedDetailClient');
  assert.ok(!content.includes('detailModalVisible'), 'clients/index.tsx must not reference detailModalVisible');
});

runAssertion('clients/index.tsx navigates to dedicated route on client card tap', () => {
  const indexPath = path.join(mobileRoot, 'app', '(app)', 'clients', 'index.tsx');
  const content = fs.readFileSync(indexPath, 'utf8');
  assert.ok(
    content.includes('router.push') && content.includes('/(app)/clients/'),
    'handleOpenDetail must push to /(app)/clients/[id]'
  );
});

// ─── 3. DATA ACCESS LAYER & QUERY OPTIMIZATIONS ─────────────────────────────

runAssertion('lib/hooks/useClientDetailData.ts exists and exports hook and resolver', () => {
  const hookPath = path.join(mobileRoot, 'lib', 'hooks', 'useClientDetailData.ts');
  assert.ok(fs.existsSync(hookPath), 'Expected useClientDetailData.ts to exist');
  const content = fs.readFileSync(hookPath, 'utf8');
  assert.ok(content.includes('export function useClientDetailData'), 'Must export useClientDetailData');
  assert.ok(content.includes('export async function resolveClientId'), 'Must export resolveClientId');
});

runAssertion('resolveClientId handles UUIDs, CLI-0050, and custom client codes', () => {
  const hookPath = path.join(mobileRoot, 'lib', 'hooks', 'useClientDetailData.ts');
  const content = fs.readFileSync(hookPath, 'utf8');
  assert.ok(content.includes('isValidUuid(trimmed)'), 'Should validate UUID format');
  assert.ok(
    content.includes('client_id.ilike') && content.includes('code.ilike'),
    'Should query by client_id or code ILIKE'
  );
});

runAssertion('useClientDetailData enforces 30-second stale time on server queries', () => {
  const hookPath = path.join(mobileRoot, 'lib', 'hooks', 'useClientDetailData.ts');
  const content = fs.readFileSync(hookPath, 'utf8');
  assert.ok(content.includes('staleTime: 30 * 1000'), 'Must enforce 30s stale time');
});

runAssertion('useClientDetailData enforces zero SELECT * with explicit column projections', () => {
  const hookPath = path.join(mobileRoot, 'lib', 'hooks', 'useClientDetailData.ts');
  const content = fs.readFileSync(hookPath, 'utf8');
  // Prohibit select('*')
  const selectStarMatches = content.match(/\.select\(['"]\*['"]\)/g);
  assert.strictEqual(selectStarMatches, null, 'Must have zero SELECT * queries');
});

runAssertion('useClientDetailData supports all 7 operational tabs lazily', () => {
  const hookPath = path.join(mobileRoot, 'lib', 'hooks', 'useClientDetailData.ts');
  const content = fs.readFileSync(hookPath, 'utf8');
  const tabs = ['machines', 'sites', 'logs', 'assignments', 'shifts', 'history', 'audit'];
  for (const t of tabs) {
    assert.ok(content.includes(`activeTab === '${t}'`), `Should lazily enable tab: ${t}`);
  }
});

runAssertion('useClientDetailData implements surgical query invalidation on mutations', () => {
  const hookPath = path.join(mobileRoot, 'lib', 'hooks', 'useClientDetailData.ts');
  const content = fs.readFileSync(hookPath, 'utf8');
  assert.ok(
    content.includes("queryKey: ['clientDetail', clientId, 'summary']") ||
    content.includes("queryKey: ['clientDetail', clientId]"),
    'Must invalidate clientDetail queries'
  );
  assert.ok(
    content.includes("queryKey: ['clients']"),
    'Must invalidate general clients queries on updates'
  );
});

// ─── 4. SKELETON & UI COMPONENTS ────────────────────────────────────────────

runAssertion('ClientDetailSkeleton renders layout-matched shells for instant UI first', () => {
  const skelPath = path.join(mobileRoot, 'components', 'clients', 'ClientDetailSkeleton.tsx');
  assert.ok(fs.existsSync(skelPath), 'Expected ClientDetailSkeleton.tsx to exist');
  const content = fs.readFileSync(skelPath, 'utf8');
  assert.ok(content.includes('styles.heroCard'), 'Should render hero card skeleton');
  assert.ok(content.includes('styles.kpiGrid'), 'Should render KPI grid skeleton');
  assert.ok(content.includes('styles.tabStrip'), 'Should render tab capsule strip skeleton');
});

runAssertion('ClientDetailView renders MobileHeader with back navigation and actions', () => {
  const viewPath = path.join(mobileRoot, 'components', 'clients', 'ClientDetailView.tsx');
  assert.ok(fs.existsSync(viewPath), 'Expected ClientDetailView.tsx to exist');
  const content = fs.readFileSync(viewPath, 'utf8');
  assert.ok(content.includes('<MobileHeader'), 'Must render MobileHeader');
  assert.ok(content.includes('showBack={true}'), 'Must enable back navigation');
  assert.ok(content.includes('onPressBack={onBack}'), 'Must pass onPressBack handler');
});

runAssertion('ClientDetailView renders identity, contact, tax, and address cards', () => {
  const viewPath = path.join(mobileRoot, 'components', 'clients', 'ClientDetailView.tsx');
  const content = fs.readFileSync(viewPath, 'utf8');
  assert.ok(content.includes('Primary Contact'), 'Must include Primary Contact section');
  assert.ok(content.includes('Tax & Statutory Identifiers'), 'Must include Tax section');
  assert.ok(content.includes('Operational & Billing Addresses'), 'Must include Addresses section');
  assert.ok(content.includes('MAINT:'), 'Must include Maintenance Allowance badge');
});

runAssertion('ClientDetailView integrates Edit Client and Add Site modals cleanly', () => {
  const viewPath = path.join(mobileRoot, 'components', 'clients', 'ClientDetailView.tsx');
  const content = fs.readFileSync(viewPath, 'utf8');
  assert.ok(content.includes('<ClientModal'), 'Must integrate ClientModal');
  assert.ok(content.includes('<ClientSiteModal'), 'Must integrate ClientSiteModal');
});

// ─── 5. SECURITY & DEEP LINKING ─────────────────────────────────────────────

runAssertion('sanitizeDeepLinkRoute validates /clients/[id] and blocks unauthorized roles', () => {
  const secPath = path.join(mobileRoot, 'lib', 'security.ts');
  const content = fs.readFileSync(secPath, 'utf8');
  assert.ok(content.includes('CLIENT_DETAIL_REGEX'), 'Should contain regex for client detail');
  assert.ok(
    content.includes('canAccessClients') && content.includes('getMobileRoleHomeRoute'),
    'Should check canAccessClients and redirect unauthorized roles'
  );
});

runAssertion('SyncCoordinator registers clientDetail query domain for offline revalidation', () => {
  const syncPath = path.join(mobileRoot, 'lib', 'offline', 'SyncCoordinator.ts');
  const content = fs.readFileSync(syncPath, 'utf8');
  assert.ok(
    content.includes("clients: [['clients'], ['clientDetail']]"),
    'SyncCoordinator must include clientDetail prefix'
  );
});

// ─── 6. TOUCH ERGONOMICS & TYPOGRAPHY SAFETY ────────────────────────────────

runAssertion('ClientDetailView touch targets enforce minimum 44px ergonomics', () => {
  const viewPath = path.join(mobileRoot, 'components', 'clients', 'ClientDetailView.tsx');
  const content = fs.readFileSync(viewPath, 'utf8');
  assert.ok(content.includes('minHeight: 44'), 'Buttons/tabs must enforce minHeight: 44');
  assert.ok(content.includes('hitSlopToMin48'), 'Interactive buttons must include 48px hitSlop');
});

runAssertion('ClientDetailView triggers tactile haptics on tab changes and actions', () => {
  const viewPath = path.join(mobileRoot, 'components', 'clients', 'ClientDetailView.tsx');
  const content = fs.readFileSync(viewPath, 'utf8');
  assert.ok(content.includes('haptics.select()'), 'Tab selection must trigger select haptic');
  assert.ok(content.includes('haptics.tap()'), 'Copy action must trigger tap haptic');
});

runAssertion('ClientDetailView strictly enforces Text variant with zero raw typography styles', () => {
  const viewPath = path.join(mobileRoot, 'components', 'clients', 'ClientDetailView.tsx');
  const content = fs.readFileSync(viewPath, 'utf8');
  const styleMatch = content.match(/StyleSheet\.create\(\{([\s\S]*?)\}\);/);
  if (styleMatch) {
    const styleBlock = styleMatch[1];
    assert.ok(!styleBlock.includes('fontSize:'), 'Must not declare raw fontSize in StyleSheet');
    assert.ok(!styleBlock.includes('fontWeight:'), 'Must not declare raw fontWeight in StyleSheet');
    assert.ok(!styleBlock.includes('lineHeight:'), 'Must not declare raw lineHeight in StyleSheet');
  }
});

console.log(`\nClient Details Verification Complete: ${totalPassed} passed, ${totalFailed} failed.`);

if (totalFailed > 0) {
  process.exit(1);
}
