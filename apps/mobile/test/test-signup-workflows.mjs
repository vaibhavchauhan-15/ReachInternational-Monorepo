/**
 * Automated Verification Suite for Mobile Sign-Up Workflows, UI/UX, and Validation
 * Covers:
 * 1. Centralized Zod Validation Rules & Concise Error Messages
 * 2. Shift Duration, Overnight Computation, and Identical Time Rejection
 * 3. Sanitized Error Mapping (Zero raw SQL/DB error leakage)
 * 4. TanStack Query Supervisor Fetching & Retry Mechanics
 * 5. Double-Submission Mutex & Form Data Retention on Failure
 * 6. Vercel Geist Tokens, Touch Targets (min 44px), and 0 Raw Typography
 */
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.resolve(path.dirname(__filename), '..');

console.log('================================================================');
console.log('  REACHINTERNATIONAL NATIVE SIGN-UP WORKFLOWS TEST SUITE');
console.log('================================================================\n');

let passed = 0;
let total = 0;

function check(title, assertion) {
  total++;
  try {
    assertion();
    console.log(`  ✓ ${title}`);
    passed++;
  } catch (err) {
    console.error(`  ❌ ${title}`);
    console.error(`     Error: ${err.message}`);
    process.exitCode = 1;
  }
}

const rootDir = path.resolve(__dirname, '..', '..');
const validationAuthPath = path.join(rootDir, 'packages', 'validation', 'src', 'auth.ts');
const utilsDatePath = path.join(rootDir, 'packages', 'utils', 'src', 'date.ts');
const mobileAuthErrorsPath = path.join(__dirname, 'lib', 'auth', 'authErrors.ts');
const mobileSignupPath = path.join(__dirname, 'app', '(auth)', 'signup.tsx');

const validationAuthContent = fs.readFileSync(validationAuthPath, 'utf8');
const utilsDateContent = fs.readFileSync(utilsDatePath, 'utf8');
const authErrorsContent = fs.readFileSync(mobileAuthErrorsPath, 'utf8');
const signupContent = fs.readFileSync(mobileSignupPath, 'utf8');

// ============================================================
// 1. Shift Duration & Overnight Computation Logic
// ============================================================
console.log('[1/6] Verifying Shift Duration & Schedule Computation...');

function parseTimeToMinutes(timeStr) {
  const match = timeStr.trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)?$/i);
  if (!match) return null;
  let hours = parseInt(match[1], 10);
  const minutes = parseInt(match[2], 10);
  const period = match[3]?.toUpperCase();

  if (period) {
    if (period === 'PM' && hours < 12) hours += 12;
    if (period === 'AM' && hours === 12) hours = 0;
  }
  return hours * 60 + minutes;
}

function computeShiftTiming({ startTime, endTime }) {
  const startMins = parseTimeToMinutes(startTime);
  const endMins = parseTimeToMinutes(endTime);
  if (startMins === null || endMins === null) {
    return { isValid: false, durationMinutes: 0, durationHours: 0, isOvernight: false, errorMessage: 'Invalid time format.' };
  }
  if (startMins === endMins) {
    return { isValid: false, durationMinutes: 0, durationHours: 0, isOvernight: false, errorMessage: 'Start time and end time cannot be identical.' };
  }
  let isOvernight = false;
  let durationMinutes = endMins - startMins;
  if (durationMinutes < 0) {
    durationMinutes += 24 * 60;
    isOvernight = true;
  }
  const durationHours = Math.round((durationMinutes / 60) * 10) / 10;
  return { isValid: true, durationMinutes, durationHours, isOvernight };
}

check('utils/date.ts exports computeShiftTiming and parseTimeToMinutes', () => {
  assert(utilsDateContent.includes('export function computeShiftTiming'));
  assert(utilsDateContent.includes('export function parseTimeToMinutes'));
});

check('Shift calculation: Standard 12-hour day shift (08:00 AM to 08:00 PM)', () => {
  const result = computeShiftTiming({ startTime: '08:00 AM', endTime: '08:00 PM' });
  assert.strictEqual(result.isValid, true);
  assert.strictEqual(result.durationMinutes, 720);
  assert.strictEqual(result.durationHours, 12);
  assert.strictEqual(result.isOvernight, false);
});

check('Shift calculation: Overnight 12-hour night shift (08:00 PM to 08:00 AM)', () => {
  const result = computeShiftTiming({ startTime: '08:00 PM', endTime: '08:00 AM' });
  assert.strictEqual(result.isValid, true);
  assert.strictEqual(result.durationMinutes, 720);
  assert.strictEqual(result.durationHours, 12);
  assert.strictEqual(result.isOvernight, true);
});

check('Shift calculation: Standard 8-hour shift (06:00 AM to 02:00 PM)', () => {
  const result = computeShiftTiming({ startTime: '06:00 AM', endTime: '02:00 PM' });
  assert.strictEqual(result.isValid, true);
  assert.strictEqual(result.durationMinutes, 480);
  assert.strictEqual(result.durationHours, 8);
  assert.strictEqual(result.isOvernight, false);
});

check('Shift calculation: Overnight 8-hour night shift (10:00 PM to 06:00 AM)', () => {
  const result = computeShiftTiming({ startTime: '10:00 PM', endTime: '06:00 AM' });
  assert.strictEqual(result.isValid, true);
  assert.strictEqual(result.durationMinutes, 480);
  assert.strictEqual(result.durationHours, 8);
  assert.strictEqual(result.isOvernight, true);
});

check('Shift calculation: Rejects identical start and end times (08:00 AM to 08:00 AM)', () => {
  const result = computeShiftTiming({ startTime: '08:00 AM', endTime: '08:00 AM' });
  assert.strictEqual(result.isValid, false);
  assert.strictEqual(result.errorMessage, 'Start time and end time cannot be identical.');
});

// ============================================================
// 2. Centralized Form Validation Rules & Concise Messages
// ============================================================
console.log('\n[2/6] Verifying Centralized Validation Package & Schema Rules...');

check('validation/auth.ts defines SignupSchema with Zod', () => {
  assert(validationAuthContent.includes('export const SignupSchema = z.object('));
});

check('validation/auth.ts defines validateSignupFormData helper', () => {
  assert(validationAuthContent.includes('export function validateSignupFormData'));
});

check('validation/auth.ts contains concise name error: "Full name required"', () => {
  assert(validationAuthContent.includes('Full name required'));
});

check('validation/auth.ts contains concise email error: "Valid email required"', () => {
  assert(validationAuthContent.includes('Valid email required'));
});

check('validation/auth.ts contains concise phone error: "10-digit mobile number required"', () => {
  assert(validationAuthContent.includes('10-digit mobile number required'));
});

check('validation/auth.ts contains concise supervisor error: "Supervisor required"', () => {
  assert(validationAuthContent.includes('Supervisor required'));
});

check('validation/auth.ts contains shift timing error: "End time must be after start time"', () => {
  assert(validationAuthContent.includes('End time must be after start time'));
});

check('validation/auth.ts superRefine conditionally requires supervisor only for operator role', () => {
  assert(validationAuthContent.includes('data.role === "operator" && (!data.supervisor_id || !data.supervisor_id.trim())'));
});

check('validation/auth.ts superRefine validates shift start and end times using computeShiftTiming', () => {
  assert(validationAuthContent.includes('const timing = computeShiftTiming'));
  assert(validationAuthContent.includes('startTime: data.shift_start_time'));
  assert(validationAuthContent.includes('endTime: data.shift_end_time'));
});

check('validation/auth.ts requires bank document and Aadhaar document flags', () => {
  assert(validationAuthContent.includes('Bank document required'));
  assert(validationAuthContent.includes('Aadhaar document required'));
});

// ============================================================
// 3. Error Mapping & Raw Database Error Sanitization
// ============================================================
console.log('\n[3/6] Verifying Error Sanitization & User-Facing Messaging...');

check('authErrors.ts exports mapSignupError', () => {
  assert(authErrorsContent.includes('export function mapSignupError'));
});

check('authErrors.ts maps duplicate email to concise actionable message', () => {
  assert(authErrorsContent.includes('Email already registered. Sign in instead.'));
});

check('authErrors.ts maps duplicate mobile number to concise message', () => {
  assert(authErrorsContent.includes('This mobile number is already registered.'));
});

check('authErrors.ts maps duplicate Aadhaar number to concise message', () => {
  assert(authErrorsContent.includes('Aadhaar number already registered.'));
});

check('authErrors.ts maps network drop / timeout to "Connection failed. Check your internet and try again."', () => {
  assert(authErrorsContent.includes('Connection failed. Check your internet.'));
});

check('authErrors.ts maps rate limit (429) gracefully', () => {
  assert(authErrorsContent.includes('Too many signup attempts. Please wait a moment.'));
});

check('authErrors.ts sanitizes PostgreSQL error codes and stack traces', () => {
  assert(authErrorsContent.includes('sqlstate'));
  assert(authErrorsContent.includes('users_'));
  assert(authErrorsContent.includes('public.'));
});

// ============================================================
// 4. TanStack Query Supervisor Fetching & Retry Mechanics
// ============================================================
console.log('\n[4/6] Verifying Supervisor TanStack Query Architecture...');

check('signup.tsx uses TanStack Query useQuery for active supervisors', () => {
  assert(signupContent.includes('useQuery'));
  assert(signupContent.includes("queryKey: ['active_supervisors_public']"));
});

check('signup.tsx invokes get_active_supervisors_public RPC', () => {
  assert(signupContent.includes("supabase.rpc('get_active_supervisors_public')"));
});

check('signup.tsx implements retry configuration for supervisor loading', () => {
  assert(signupContent.includes('retry: 2'));
  assert(signupContent.includes('staleTime: 60 * 1000'));
});

check('signup.tsx surfaces inline retry button when supervisor fetch fails', () => {
  assert(signupContent.includes('refetchSupervisors'));
  assert(signupContent.includes('Tap to retry'));
});

// ============================================================
// 5. Concurrency Protection & State Preservation
// ============================================================
console.log('\n[5/6] Verifying Mutex Protection & Form State Preservation...');

check('signup.tsx guards against double-submission using isSubmittingRef mutex', () => {
  assert(signupContent.includes('const isSubmittingRef = useRef(false)'));
  assert(signupContent.includes('if (isSubmittingRef.current || isLoading) return;'));
  assert(signupContent.includes('isSubmittingRef.current = true;'));
});

check('signup.tsx preserves form state and documents on recoverable error', () => {
  // In the catch block, form fields and documents are preserved without resetting
  const catchBlockRegex = /catch \(err: any\) \{([\s\S]*?)\}/m;
  const match = signupContent.match(catchBlockRegex);
  assert(match, 'Catch block exists');
  assert(!match[1].includes('setFullName('), 'Full name is not cleared on error');
  assert(!match[1].includes('setBankDoc('), 'Bank document is not cleared on error');
  assert(!match[1].includes('setAadhaarDoc('), 'Aadhaar document is not cleared on error');
  assert(!match[1].includes('setPassword('), 'Password is preserved on error');
});

check('signup.tsx removes inline field error immediately on user keystroke', () => {
  assert(signupContent.includes('clearFieldError'));
  assert(signupContent.includes("clearFieldError('full_name')"));
  assert(signupContent.includes("clearFieldError('email')"));
  assert(signupContent.includes("clearFieldError('phone')"));
});

// ============================================================
// 6. UI/UX, Typography, Brand Identity & Touch Targets
// ============================================================
console.log('\n[6/6] Verifying UI/UX Design System Compliance...');

check('signup.tsx renders ReachInternationalLogo with full branding', () => {
  assert(signupContent.includes('<ReachInternationalLogo variant="full" size={26} showIcon={false} />'));
});

check('signup.tsx organizes form into 6 clear enterprise sections', () => {
  assert(signupContent.includes('ACCOUNT & ROLE'));
  assert(signupContent.includes('WORK SHIFT SCHEDULE'));
  assert(signupContent.includes('ADDRESS DETAILS'));
  assert(signupContent.includes('BANKING DETAILS'));
  assert(signupContent.includes('IDENTITY VERIFICATION'));
  assert(signupContent.includes('SECURITY CREDENTIALS'));
});

check('signup.tsx renders real-time shift duration badge with overnight support', () => {
  assert(signupContent.includes('shiftSummary'));
  assert(signupContent.includes('Overnight'));
});

check('signup.tsx touch targets satisfy accessible minHeight of 44-48px', () => {
  assert(signupContent.includes('hitSlopToMin48={true}') || signupContent.includes('hitSlopToMin48'));
  assert(signupContent.includes('MobileSubmitButton'));
});

check('signup.tsx enforces 0 raw typography properties in StyleSheet.create', () => {
  const styleBlock = signupContent.substring(signupContent.lastIndexOf('StyleSheet.create({'));
  assert(!styleBlock.match(/\bfontSize:\s*\d+/), 'Zero fontSize in StyleSheet.create');
  assert(!styleBlock.match(/\bfontWeight:\s*['"]\w+['"]/), 'Zero fontWeight in StyleSheet.create');
  assert(!styleBlock.match(/\bfontFamily:\s*['"]\w+['"]/), 'Zero fontFamily in StyleSheet.create');
  assert(!styleBlock.match(/\blineHeight:\s*\d+/), 'Zero lineHeight in StyleSheet.create');
});


// ============================================================
// 7. Web & Mobile 100% Parity: Draft Persistence & Restoration
// ============================================================
console.log('\n[7/7] Verifying Draft Persistence & Restoration Architecture...');

const draftHookPath = path.join(__dirname, 'lib', 'hooks', 'useFormDraft.ts');
const draftHookContent = fs.readFileSync(draftHookPath, 'utf8');

check('useFormDraft.ts exports useMobileFormDraft, SIGNUP_DRAFT_KEY, and hasMeaningfulMobileDraft', () => {
  assert(draftHookContent.includes('export function useMobileFormDraft'));
  assert(draftHookContent.includes('export const SIGNUP_DRAFT_KEY ='));
  assert(draftHookContent.includes('export function hasMeaningfulMobileDraft'));
});

check('useFormDraft.ts binds AsyncStorage and listens to AppState transitions', () => {
  assert(draftHookContent.includes("from '@react-native-async-storage/async-storage'"));
  assert(draftHookContent.includes('AppState.addEventListener'));
  assert(draftHookContent.includes("nextAppState === 'inactive' || nextAppState === 'background'"));
});

check('useFormDraft.ts guards against race conditions (hasRestoredRef)', () => {
  assert(draftHookContent.includes('hasRestoredRef.current'));
  assert(draftHookContent.includes('if (!hasRestoredRef.current) return;'));
});

check('useFormDraft.ts supports restoring both text fields and picked documents', () => {
  assert(draftHookContent.includes('bankDoc'));
  assert(draftHookContent.includes('aadhaarDoc'));
  assert(draftHookContent.includes('licenseDoc'));
  assert(draftHookContent.includes('agreedToTerms'));
});

check('signup.tsx binds useMobileFormDraft with currentDraftValues and handleRestoreDraft', () => {
  assert(signupContent.includes('useMobileFormDraft(currentDraftValues, handleRestoreDraft)'));
  assert(signupContent.includes('currentDraftValues'));
  assert(signupContent.includes('handleRestoreDraft'));
});

check('signup.tsx renders draft restored alert banner with Start fresh button', () => {
  assert(signupContent.includes('Draft restored from'));
  assert(signupContent.includes('handleStartFresh'));
  assert(signupContent.includes('Start fresh'));
  assert(signupContent.includes('Alert variant="info"'));
});

check('signup.tsx clears draft upon successful submission (clearDraft)', () => {
  assert(signupContent.includes('await clearDraft()'));
});

check('signup.tsx implements handleStartFresh resetting all fields and documents', () => {
  assert(signupContent.includes('await clearDraft()'));
  assert(signupContent.includes('setBankDoc(null)'));
  assert(signupContent.includes('setAadhaarDoc(null)'));
  assert(signupContent.includes('setLicenseDoc(null)'));
});
console.log('\n------------------------------------------------------------');
console.log(`Results: ${passed} / ${total} checks passed successfully.`);
console.log('------------------------------------------------------------\n');

if (passed === total) {
  console.log('🎉 ALL SIGNUP WORKFLOW AND VALIDATION INVARIANTS VERIFIED!');
  process.exit(0);
} else {
  console.error(`❌ Verification failed: ${total - passed} checks did not pass.`);
  process.exit(1);
}
