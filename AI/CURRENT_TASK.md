# Current Task

## Task: 89 — Autofill & Credential Suggestion Suppression on HMR & General Inputs (/operations)
**Status**: 🟢 IMPLEMENTATION COMPLETE / VERIFIED
**Date**: 2026-10-12
**Type**: Bug Fix, Autofill / Input Security, Cross-Platform Parity
**Surfaces**:
- `apps/mobile/components/ui/Input.tsx`
- `apps/mobile/components/operations/MobileOperatorEntryCard.tsx`
- `apps/mobile/components/work/MeterLogModal.tsx`
- `apps/mobile/components/ui/textarea.tsx`
- `apps/mobile/components/ui/SearchInput.tsx`
- `apps/mobile/components/ui/TimeInput.tsx`
- `apps/web/components/operations/entry/HMRInputs.tsx`

---

### Issues Addressed

1. **Email and Password Autofill on HMR Inputs (`/operations`)** — When tapping or focusing the Start Meter and End Meter (HMR) inputs in the mobile app, browser heuristics and mobile OS autofill engines suggested saved emails and passwords because the inputs lacked explicit `autoComplete="off"`, `textContentType="none"`, `importantForAutofill="no"`, and numeric/decimal `inputMode`.
2. **App-wide Generic Inputs Lacking Safe Autofill Defaults** — The shared `Input.tsx` component previously passed `autoComplete`, `textContentType`, and `importantForAutofill` as undefined unless explicitly passed by callers. By default, browsers and OS autofill treated unidentified text fields on logged-in domains as credential/account candidates.
3. **Web-Mobile Parity on HMR Inputs** — `HMRInputs.tsx` on Web lacked explicit `autoComplete="off"` and password-manager ignore attributes (`data-lpignore`, `data-1p-ignore`), leaving desktop browsers susceptible to password autofill prompts on meter number inputs.

---

### Delivered

1. **Global Reusable Input Autofill Hardening (`apps/mobile/components/ui/Input.tsx`)**:
   - `isPassword === false` (default): Defaults `autoComplete="off"`, `textContentType="none"`, `importantForAutofill="no"`, `autoCorrect={false}`, `spellCheck={false}`, `aria-autocomplete="none"`.
   - `isPassword === true`: Defaults `autoComplete="current-password"`, `textContentType="password"`, `importantForAutofill="yes"`, `secureTextEntry={!isPasswordVisible}`.
   - Automatically derives `inputMode` from `keyboardType` (e.g., `decimal-pad` → `decimal`, `numeric` / `number-pad` → `numeric`, `email-address` → `email`, `phone-pad` → `tel`, `url` → `url`) when `inputMode` is omitted.
2. **Operations HMR Input Hardening (`apps/mobile/components/operations/MobileOperatorEntryCard.tsx`)**:
   - Explicitly configured `keyboardType="decimal-pad"`, `inputMode="decimal"`, `autoComplete="off"`, `textContentType="none"`, `importantForAutofill="no"`, `autoCorrect={false}`, `spellCheck={false}`, `aria-autocomplete="none"` on Start Meter and End Meter inputs.
3. **Work Meter Log Modal Hardening (`apps/mobile/components/work/MeterLogModal.tsx`)**:
   - Explicitly configured `inputMode="decimal"`, `autoComplete="off"`, `textContentType="none"`, `importantForAutofill="no"`, `autoCorrect={false}`, `spellCheck={false}`, `aria-autocomplete="none"` on Start Meter and End Meter inputs.
   - Added autofill prevention on `location`, `overtimeHours`, and `remarks` inputs.
4. **Input Primitives Hardening (`textarea.tsx`, `SearchInput.tsx`, `TimeInput.tsx`)**:
   - `Textarea.tsx`: Defaulted `autoComplete="off"`, `textContentType="none"`, `importantForAutofill="no"`, `autoCorrect={false}`, `spellCheck={false}`, `aria-autocomplete="none"`.
   - `SearchInput.tsx`: Inner TextInput configured with `inputMode="search"`, `autoComplete="off"`, `textContentType="none"`, `importantForAutofill="no"`, `autoCorrect={false}`, `spellCheck={false}`, `aria-autocomplete="none"`.
   - `TimeInput.tsx`: Hour and Minute TextInputs configured with `inputMode="numeric"`, `autoComplete="off"`, `textContentType="none"`, `importantForAutofill="no"`, `autoCorrect={false}`, `spellCheck={false}`, `aria-autocomplete="none"`.
5. **100% Web Parity on HMR Inputs (`apps/web/components/operations/entry/HMRInputs.tsx`)**:
   - Added `autoComplete="off"`, `data-lpignore="true"`, `data-1p-ignore="true"`, `name`, and `id` to both Start Meter and End Meter inputs.

---

### Verification Summary
- **Typography Compliance**: `node scripts/check-typography.mjs` → 0 raw typography instances (PASS).
- **Touch Haptics Guards**: `node scripts/test-touch-haptics.mjs` → all guards verified (PASS).
- **Parity Rules & Skills Suite**: `node scripts/test-parity-rules-and-skills.mjs` → 95/95 tests passed, 100% (PASS).
- **Mobile Automated Verification Suite**: `node apps/mobile/run-tests.mjs` → 63/63 scenarios verified, 100% (PASS).
- **Mobile TypeScript Check**: `pnpm --filter @reachinternational/mobile typecheck` → Exit Code 0 (PASS).
- **Web TypeScript Check**: `pnpm --filter @reachinternational/web typecheck` → Exit Code 0 (PASS).
