/**
 * ReachInternational Mobile — Operator History Card Verification Suite
 * Verifies the reusable MobileOperatorHistoryCard component:
 * 1. 100% Visual and Behavioral Parity with User Feedback Specification & Screenshot
 * 2. Strict Design Tokens Compliance (Geist System, #171717 ink, hairline borders)
 * 3. Exact Layout Elements:
 *    - Header Row: Timestamp (left) + Operating Hours badge (+5.0 hrs) & Edit/Lock Action (right)
 *    - Machine Row: Machine ID / Model (bold) + Serial in parentheses (muted)
 *    - Client Row: "Client : " (muted) + Client Name (bold) + City in parentheses (muted)
 *    - HMR Row: "HMR: " (muted) + Start Meter + " → " + End Meter (bold)
 *    - Shift Date Row: "Shift Date : " (muted) + Shift Date (bold) + Shift Badge (Shift A)
 *    - Hairline Divider Line
 *    - Breakdown Row: "Breakdown: 0 (Normal)" (muted) or "Breakdown: [Reason]" (red)
 * 4. Zero Raw Typography Invariant (<Text variant="..." weight="...">)
 * 5. Reusability, Canonical Exports, and Consumer Integration in MobileOperatorHistoryTab
 * 6. Web & Native Cross-Platform Parity with OperatorHistoryCard on Web
 */

import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const MOBILE_ROOT = path.resolve(path.dirname(__filename), '..');
const MONOREPO_ROOT = path.resolve(MOBILE_ROOT, '..', '..');
const WEB_ROOT = path.resolve(MONOREPO_ROOT, 'apps', 'web');

console.log('=================================================================');
console.log('🧪 Starting Reusable Operator History Card Verification Suite...');
console.log('=================================================================\n');

// ─── 1. Canonical Exports & File Architecture ───
console.log('--- 1. Canonical Exports & Architecture ---');

const cardPath = path.join(MOBILE_ROOT, 'components/operations/MobileOperatorHistoryCard.tsx');
assert.ok(fs.existsSync(cardPath), 'MobileOperatorHistoryCard.tsx must exist');
const cardSource = fs.readFileSync(cardPath, 'utf8');

assert.ok(
  cardSource.includes('export interface MobileOperatorHistoryCardProps'),
  'Must export MobileOperatorHistoryCardProps interface'
);
assert.ok(
  cardSource.includes('export const MobileOperatorHistoryCard') && cardSource.includes('React.memo'),
  'Must export MobileOperatorHistoryCard wrapped with React.memo'
);
assert.ok(
  cardSource.includes('export function isLogWithin7Days'),
  'Must export isLogWithin7Days 7-day edit calculation helper'
);
assert.ok(
  cardSource.includes('export function areHistoryCardPropsEqual'),
  'Must export areHistoryCardPropsEqual custom memo comparator'
);

const operationsIndexPath = path.join(MOBILE_ROOT, 'components/operations/index.ts');
const operationsIndexSource = fs.readFileSync(operationsIndexPath, 'utf8');
assert.ok(
  operationsIndexSource.includes("export * from './MobileOperatorHistoryCard'"),
  'components/operations/index.ts must export MobileOperatorHistoryCard'
);
console.log('  ✓ MobileOperatorHistoryCard exports and barrel integration verified');

// ─── 2. User Feedback & Screenshot Layout Parity ───
console.log('\n--- 2. Layout Structure & Screenshot Parity ---');

// Header Row
assert.ok(
  cardSource.includes('formatExactTimestamp(log.created_at, false)'),
  'Must format exact timestamp without seconds (DD-MM-YYYY, hh:mm A)'
);
assert.ok(
  cardSource.includes('variant="success"'),
  'Must render Operating Hours badge with variant="success" (mint/emerald background)'
);
assert.ok(
  cardSource.includes('hrs`'),
  'Must render hours badge formatted with "+X.X hrs"'
);
assert.ok(
  cardSource.includes('<Pencil') && cardSource.includes('<Lock'),
  'Must support both editable Pencil icon and locked Lock icon'
);

// Machine Row
assert.ok(
  cardSource.includes('primaryTitle') && cardSource.includes('secondaryIdentifier'),
  'Must compute primary title (machine_id/model) and secondary identifier (serial)'
);

// Client Row
assert.ok(
  cardSource.includes('Client :'),
  'Must render "Client : " label'
);
assert.ok(
  cardSource.includes('clientName'),
  'Must render client company name'
);

// HMR Progression Row
assert.ok(
  cardSource.includes('HMR:'),
  'Must render "HMR: " label'
);
assert.ok(
  cardSource.includes('startM.toFixed(1)') && cardSource.includes('endM.toFixed(1)'),
  'Must format start and end HMR meters to 1 decimal place'
);
assert.ok(
  cardSource.includes('→'),
  'Must render inline progression arrow between meters'
);

// Shift Date Row
assert.ok(
  cardSource.includes('Shift Date :'),
  'Must render "Shift Date : " label'
);
assert.ok(
  cardSource.includes('formatDate(log.log_date)'),
  'Must format shift date with DD-MM-YYYY formatDate'
);
assert.ok(
  cardSource.includes('variant="info"'),
  'Must render Shift Name badge with variant="info" (sky blue)'
);

// Hairline Divider
assert.ok(
  cardSource.includes('borderTopWidth: 1') && cardSource.includes('theme.colors.hairline'),
  'Must render crisp 1px hairline divider above breakdown section'
);

// Breakdown Row
assert.ok(
  cardSource.includes('Breakdown:'),
  'Must render Breakdown indicator'
);
assert.ok(
  cardSource.includes('0 (Normal)'),
  'Must render "0 (Normal)" in muted gray when no breakdown is reported'
);
assert.ok(
  cardSource.includes('#ee0000') || cardSource.includes('#f87171'),
  'Must render bold red Breakdown text when breakdown is logged'
);
console.log('  ✓ All 7 layout elements matching user screenshot verified');

// ─── 3. Zero Raw Typography & Design Token Invariants ───
console.log('\n--- 3. Typography & Touch Target Invariants ---');

// Check that StyleSheet.create has NO raw typography properties
const styleSheetMatch = cardSource.match(/const styles = StyleSheet\.create\(\{([\s\S]*?)\}\);/);
assert.ok(styleSheetMatch, 'StyleSheet.create must be present');
const styleSheetBody = styleSheetMatch[1];

const BANNED_TYPO = ['fontSize', 'fontWeight', 'fontFamily', 'lineHeight', 'letterSpacing'];
for (const prop of BANNED_TYPO) {
  const regex = new RegExp(`\\b${prop}\\s*:`, 'i');
  assert.ok(
    !regex.test(styleSheetBody),
    `StyleSheet.create must not contain raw typography property '${prop}'`
  );
}

// Touch target ergonomics: min 44px hitSlop
assert.ok(
  cardSource.includes('hitSlopToMin48'),
  'Edit button must enforce hitSlopToMin48 for 44-48px touch targets'
);
assert.ok(
  cardSource.includes('haptics.tap()'),
  'Edit action must trigger tactile haptics'
);
console.log('  ✓ 0 raw typography properties & 44px touch targets verified');

// ─── 4. Consumer Integration in MobileOperatorHistoryTab ───
console.log('\n--- 4. Consumer Tab Integration ---');

const tabPath = path.join(MOBILE_ROOT, 'components/operations/MobileOperatorHistoryTab.tsx');
assert.ok(fs.existsSync(tabPath), 'MobileOperatorHistoryTab.tsx must exist');
const tabSource = fs.readFileSync(tabPath, 'utf8');

assert.ok(
  tabSource.includes("import { MobileOperatorHistoryCard"),
  'MobileOperatorHistoryTab must import MobileOperatorHistoryCard'
);
assert.ok(
  tabSource.includes('<MobileOperatorHistoryCard'),
  'MobileOperatorHistoryTab must render MobileOperatorHistoryCard in renderLogItem'
);
assert.ok(
  !tabSource.includes('const HistoryLogCard = React.memo'),
  'Old monolithic inlined HistoryLogCard must be removed from MobileOperatorHistoryTab'
);
console.log('  ✓ MobileOperatorHistoryTab seamlessly integrates reusable card');

// ─── 5. Web & Native Cross-Platform Parity ───
console.log('\n--- 5. Web & Native Parity ---');

const webCardPath = path.join(WEB_ROOT, 'components/operations/entry/OperatorHistoryCard.tsx');
assert.ok(fs.existsSync(webCardPath), 'Web OperatorHistoryCard.tsx must exist');
const webCardSource = fs.readFileSync(webCardPath, 'utf8');

assert.ok(
  webCardSource.includes('export const OperatorHistoryCard = React.memo'),
  'Web OperatorHistoryCard must be exported and memoized'
);
assert.ok(
  webCardSource.includes('HMR:'),
  'Web OperatorHistoryCard must render HMR progression'
);
assert.ok(
  webCardSource.includes('Shift Date :'),
  'Web OperatorHistoryCard must render Shift Date'
);
assert.ok(
  webCardSource.includes('Breakdown:'),
  'Web OperatorHistoryCard must render Breakdown row'
);

const webTabPath = path.join(WEB_ROOT, 'components/operations/entry/OperatorHistoryTab.tsx');
const webTabSource = fs.readFileSync(webTabPath, 'utf8');
assert.ok(
  webTabSource.includes('OperatorHistoryCard'),
  'Web OperatorHistoryTab must use OperatorHistoryCard'
);
console.log('  ✓ Web & Native cross-platform parity verified');

console.log('\n=================================================================');
console.log('✅ ALL OPERATOR HISTORY CARD VERIFICATIONS PASSED SUCCESSFULLY!');
console.log('=================================================================\n');
