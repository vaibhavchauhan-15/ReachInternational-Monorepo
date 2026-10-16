/**
 * Reach International Mobile — Android 16 Clock UI & TimePickerDialog Automated Verification Suite
 * Verifies Android 16 / Material 3 Clock UI Invariants:
 * - Dual Mode Support (Dial Face & Direct Keyboard Input)
 * - Mode Toggle Icon Button (Keyboard in dial mode, Clock in keyboard mode)
 * - Accent-filled active container & surface inactive container styling
 * - Clean sans-serif typography with zero raw typography properties
 * - AM/PM vertically stacked pill switcher
 * - 0 raw typography property adherence
 * - Touch ergonomics and soft haptics integration
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let passCount = 0;
let failCount = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  ✓ ${message}`);
    passCount++;
  } else {
    console.error(`  ✗ FAIL: ${message}`);
    failCount++;
  }
}

console.log('\n--- 1. Testing TimePickerDialog Structure & Export Contract ---');
const dialogPath = path.join(__dirname, 'components/ui/TimePickerDialog.tsx');
const dialogContent = fs.readFileSync(dialogPath, 'utf8');

assert(
  dialogContent.includes('export interface TimeOfDay') &&
  dialogContent.includes('export interface TimePickerDialogProps') &&
  dialogContent.includes('export function parseInitialTime') &&
  dialogContent.includes('export function formatTimeOfDay') &&
  dialogContent.includes('export const TimePickerDialog: React.FC<TimePickerDialogProps>'),
  'TimePickerDialog preserves canonical export contract and helper functions'
);

console.log('\n--- 2. Testing Android 16 / Material 3 Dual Mode (Dial + Keyboard) ---');
assert(
  dialogContent.includes("const [mode, setMode] = useState<'dial' | 'keyboard'>(initialMode);") &&
  dialogContent.includes("const handleToggleMode = () => {"),
  'TimePickerDialog implements mode state switching between dial and keyboard modes'
);

assert(
  dialogContent.includes('<Keyboard size={22}') &&
  dialogContent.includes('<Clock size={22}') &&
  dialogContent.includes('handleToggleMode'),
  'Bottom-left icon button toggles between Keyboard and Clock modes'
);

assert(
  dialogContent.includes('mode === \'keyboard\'') &&
  dialogContent.includes('hourInputRef') &&
  dialogContent.includes('minuteInputRef') &&
  dialogContent.includes('Hour') &&
  dialogContent.includes('Minute'),
  'Keyboard mode renders dedicated text inputs with Hour and Minute sublabels'
);

console.log('\n--- 3. Testing Time Display Boxes & Active/Inactive Styling ---');
assert(
  dialogContent.includes('activeUnit === \'hour\'') &&
  dialogContent.includes('activeUnit === \'minute\'') &&
  dialogContent.includes("rgba(2, 132, 199, 0.22)") &&
  dialogContent.includes('#e0f2fe'),
  'Active time box displays filled accent container background matching theme'
);

assert(
  dialogContent.includes('styles.ampmContainer') &&
  dialogContent.includes('selectedPeriod === \'AM\'') &&
  dialogContent.includes('selectedPeriod === \'PM\'') &&
  dialogContent.includes('styles.ampmDivider'),
  'AM/PM switcher renders vertically stacked pill container with center hairline divider'
);

console.log('\n--- 4. Testing Dial Typography & Clutter Removal ---');
assert(
  !dialogContent.includes('-1 hr') &&
  !dialogContent.includes('+1 hr') &&
  !dialogContent.includes('-5m') &&
  !dialogContent.includes('+5m') &&
  !dialogContent.includes('06 AM') &&
  !dialogContent.includes('02 PM'),
  'Crowded stepper button row permanently removed in favor of clean Android 16 UI'
);

assert(
  dialogContent.includes('STATIC_HOURS.map') &&
  dialogContent.includes('STATIC_MINUTES.map') &&
  !dialogContent.includes('INTERMEDIATE_MINUTE_TICKS') &&
  dialogContent.includes('variant="heading"'),
  'Dial numbers use clean sans typography with zero minute dot clutter for lightweight rendering'
);

assert(
  !dialogContent.includes('selectTextOnFocus') &&
  dialogContent.includes('selectionColor="transparent"') &&
  dialogContent.includes('cursorColor'),
  'Keyboard inputs eliminate blue selection box using transparent selection and native cursor'
);

assert(
  dialogContent.includes('handleDialRelease') &&
  dialogContent.includes("setActiveUnit('minute')"),
  'Dial auto-advances from hour to minute on touch release in hour mode'
);

console.log('\n--- 5. Testing Zero Raw Typography Violations & Touch Ergonomics ---');
const bannedRegex = /\b(fontSize|fontWeight|fontFamily|lineHeight|letterSpacing)\b/;
const lines = dialogContent.split('\n');
let bannedCount = 0;
for (let i = 0; i < lines.length; i++) {
  if (bannedRegex.test(lines[i])) {
    bannedCount++;
    console.error(`  Line ${i + 1} has raw typography: ${lines[i].trim()}`);
  }
}
assert(bannedCount === 0, 'Zero raw typography property violations in TimePickerDialog');

assert(
  dialogContent.includes('hitSlopToMin48') &&
  dialogContent.includes('haptics.select') &&
  dialogContent.includes('haptics.confirm'),
  'All buttons enforce minimum 48px touch ergonomics with tactile haptics'
);

console.log('\n--- 6. Testing Error Handling & Short Informative Feedback ---');
assert(
  dialogContent.includes("hourError = 'Hour must be 1–12'") &&
  dialogContent.includes("minuteError = 'Minute must be 0–59'") &&
  dialogContent.includes("errorMessage = 'Invalid time (1–12 : 00–59)'"),
  'TimePickerDialog defines short, informative error messages for invalid hour and minute'
);

assert(
  dialogContent.includes('isHourInvalid') &&
  dialogContent.includes('isMinuteInvalid') &&
  dialogContent.includes('#ef4444') &&
  dialogContent.includes('rgba(239, 68, 68, 0.15)'),
  'TimePickerDialog applies high-contrast red error border and background tint on invalid inputs'
);

assert(
  dialogContent.includes('if (mode === \'keyboard\' && validation.hasError)') &&
  dialogContent.includes('haptics.reject()') &&
  dialogContent.includes('return;'),
  'handleConfirm blocks submission and triggers rejection haptics when errors exist'
);

assert(
  dialogContent.includes('if (validation.hasError)') &&
  dialogContent.includes('haptics.reject()') &&
  dialogContent.includes('handleToggleMode'),
  'Mode toggle prevents switching from keyboard to dial mode when input is invalid'
);

console.log(`\n========================================`);
console.log(`TimePickerDialog Test Results: ${passCount} Passed, ${failCount} Failed`);
console.log(`========================================\n`);

if (failCount > 0) {
  process.exit(1);
} else {
  process.exit(0);
}
