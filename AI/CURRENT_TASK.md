# Current Task

## Task: 22 — Fix TransformError SyntaxError in `apps/mobile/app/(app)/settings/index.tsx` (Mismatched JSX tags between `<Pressable>` and `</TouchableOpacity>`)
**Status**: 🟢 IMPLEMENTATION COMPLETE / VERIFIED
**Date**: 2026-10-08
**Type**: Bug Fix, Mobile App JSX Syntax, Clean Imports & Typography Alignment
**Surfaces**:
- `apps/mobile/app/(app)/settings/index.tsx`

### Problem Summary
The user encountered a syntax transformation error in the Metro bundler:
```
TransformError: SyntaxError: C:\Users\vaibh\PROGRAMMING\PROJECTS\ReachInternational-Monorepo\apps\mobile\app\(app)\settings\index.tsx: Expected corresponding JSX closing tag for <Pressable>. (192:8)

  190 |             </View>
  191 |           </View>
> 192 |         </TouchableOpacity>
      |         ^
  193 |
  194 |         {/* Section Heading */}
  195 |         <Text style={[styles.sectionGroupTitle, { color: theme.colors.mute }]}>
    at ? (app:///entry.bundle:71155:5)
```

### Root Cause Analysis
1. During refactoring of the hero profile card in `apps/mobile/app/(app)/settings/index.tsx` from `TouchableOpacity` to the canonical `@reachinternational` `Pressable` primitive, the opening tag was changed to `<Pressable>`, but the closing tag at line 192 was left as `</TouchableOpacity>`.
2. This syntax error caused Babel/SWC transformation inside Metro to fail, breaking Hot Module Replacement (HMR) and caching the TransformError in the developer's Metro / Expo session.

### Delivered Work
1. **JSX Tag Pair Correction**:
   - Guaranteed exact pair alignment with `<Pressable variant="card" haptic="select" ...> ... </Pressable>` around the hero profile card.
2. **Import Sanitation & Pruning**:
   - Cleaned up imports in `apps/mobile/app/(app)/settings/index.tsx`: removed unused `Alert`, `Shield`, and `Sparkles`.
   - Unified imports from `../../../components/ui` for `Pressable`, `Text`, `ConfirmDialog`, `Card`, `Badge`, `Button`, `useTheme`, `MobileHeader`, and `ReachInternationalLogo`.
3. **Typography Variant Alignment**:
   - Enhanced `<Text>` components across `index.tsx` with explicit design system variants (`variant="heading"`, `variant="subheading"`, `variant="caption"`, `variant="label"`, `variant="micro"`), ensuring zero raw typography properties and strict Geist scale adherence.
4. **Comprehensive AST & Syntax Validation**:
   - Ran AST parse verification across all `.tsx` and `.jsx` files in `apps/mobile` confirming 0 syntax errors across the entire codebase.

### Verification Results
- Mobile TypeScript Check: **PASS** (`pnpm --filter @reachinternational/mobile typecheck` -> 0 errors, exit code 0).
- AST Parse Verification: **PASS** (100% of `.tsx` and `.jsx` files in `apps/mobile` parsed with 0 errors).
- Typography Compliance Audit: **PASS** (`node scripts/check-typography.mjs` -> 0 raw typography properties).
- Touch Feedback & Soft Haptics Guards: **PASS** (`node scripts/test-touch-haptics.mjs` -> all guards passed).
- Parity Rules & Skills Suite: **PASS** (`node scripts/test-parity-rules-and-skills.mjs` -> 95/95 passed).
- Mobile Automated Test Suite: **PASS** (`node apps/mobile/run-tests.mjs` -> 63/63 scenarios passed).
