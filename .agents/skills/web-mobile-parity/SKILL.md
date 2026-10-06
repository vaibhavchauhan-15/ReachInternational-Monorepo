---
name: web-mobile-parity
description: Enforce and audit 100% parity between Web (apps/web) and Native Mobile (apps/mobile) across UI/UX, behavior, responsiveness, design, layout, color, theme, and typography. Use whenever building, modifying, reviewing, or debugging features across Web and Mobile.
---

# Web & Mobile 100% Parity Enforcement Skill

> **Golden Rule**: Web and Mobile are two interfaces for **ONE SINGLE PRODUCT**.
> They must feel like one application adapted to screen sizes, NOT two separately designed apps.

---

## 1. When to Use This Skill
Activate this workflow whenever:
- Adding, refactoring, or fixing any screen, component, or workflow in `apps/web` or `apps/mobile`.
- Conducting a cross-platform design, layout, or behavioral audit.
- Verifying color, typography, or theme consistency between Web and Native.
- Reviewing PRs or changes for cross-platform drift.

---

## 2. The 8 Dimensions of 100% Parity

Every feature existing on Web and Mobile must achieve 100% parity across all 8 dimensions:

| Dimension | Standard | Enforcement Rule |
| :--- | :--- | :--- |
| **1. UI/UX** | Identical visual components and interaction affordances | Same buttons, cards, badges, modal dialogs, segmented toggles, and status pills. |
| **2. Behavior** | Identical states and lifecycle flows | Same loading skeletons, empty states, error handling, form validations, and toast notifications. |
| **3. Responsiveness** | 3-tier viewport protocol | Mobile (≤640px touch cards), Tablet (641–1023px 2-col grids), Desktop (≥1024px tables). |
| **4. Design** | Vercel Geist design system | 1px hairline borders (`#ebebeb`), whisper shadows, bimodal radius (6px app / 64px tab / 100px pill). |
| **5. Layout** | Identical information hierarchy | Same visual grouping, card metadata order, and primary action placement. |
| **6. Color** | Identical color tokens | Primary `#0284c7`, Link `#0070f3`, Success `#10b981`, Warning `#f5a623`, Error `#ee0000`, Info `#3b82f6`. |
| **7. Theme** | Identical Light & Dark modes | Light: `#fafafa` canvas / `#ffffff` cards / `#171717` ink. Dark: `#0a0a0a` canvas / `#171717` cards / `#fafafa` ink. |
| **8. Typography** | Geist Sans & Geist Mono | Exact matching font scale, line heights, and negative letter tracking (-2.4px display). |

---

## 3. Platform Architecture Specialization

While the **visuals, behavior, and design are 100% identical**, the underlying technical architecture is optimized for each platform:

### Web Platform (`apps/web`)
- **Rendering**: React Server Components (RSC) by default; `'use client'` strictly at leaf nodes.
- **Data Access**: Data Access Layer (`lib/dal.ts` and `lib/queries/*`) via `@supabase/ssr` cookies.
- **Mutations**: Next.js Server Actions (`app/actions/*`) with Zod validation, role authorization, and cache revalidation (`revalidateTag`).
- **Auth**: Supabase SSR HTTP-only session cookies.

### Native Mobile Platform (`apps/mobile`)
- **Rendering**: React Native primitives (`View`, `Text`, `Pressable`, `ScrollView`, `FlatList`).
- **Data Access**: **TanStack Query (`@tanstack/react-query`)** with centralized hooks in `lib/hooks/` and `lib/queries/` (30s stale time).
- **Mutations**: Direct Supabase client calls with offline queue fallback (`AsyncStorage`) and auto-sync on reconnect.
- **Auth**: Hardware-backed **`expo-secure-store`** (iOS Keychain / Android KeyStore).
- **Mobile Ergonomics**: Minimum 44px touch targets (`minHeight: 44`), bottom sheets instead of popovers, scrollable horizontal filter strips, and tactile haptic feedback (`Haptics.selectionAsync()`).
- **Typography Safety**: Canonical `<Text variant="...">` and `useTypeStyle()` with **zero raw typography properties in `StyleSheet.create`**.

---

## 4. Step-by-Step Parity Implementation Procedure

```text
[STEP 1: INSPECT WEB]      →  Read Web component in apps/web/
                                    ↓
[STEP 2: INSPECT MOBILE]   →  Read corresponding Mobile component in apps/mobile/
                                    ↓
[STEP 3: COMPARE & AUDIT]  →  Identify differences in color, typography, layout, states
                                    ↓
[STEP 4: STANDARDIZE TOKENS]→ Ensure both consume @reachinternational/design-tokens
                                    ↓
[STEP 5: IMPLEMENT PARITY] →  Apply platform-appropriate adaptations without visual divergence
                                    ↓
[STEP 6: VERIFY BOTH]      →  Run typecheck & test suite across both apps
```

### Detailed Steps:
1. **Inspect Web Implementation First**:
   - Locate the route in `apps/web/app/(app)/`.
   - Inspect components in `apps/web/components/[module]/`.
   - Check the tokens used (`bg-[var(--color-...)]`, `text-[var(--color-...)]`).
2. **Inspect Native Mobile Implementation**:
   - Locate the screen in `apps/mobile/app/(app)/`.
   - Inspect components in `apps/mobile/components/[module]/`.
   - Verify usage of `theme.colors` from `ThemeProvider` and `<Text variant="...">`.
3. **Compare & Standardize**:
   - **Color**: If Web uses `#10b981` (emerald) for success, Mobile MUST use `theme.colors.success` (`#10b981`).
   - **Typography**: Match heading weights and relative sizes. Use `TYPE_VARIANTS` from `@reachinternational/design-tokens`.
   - **Badges**: Use pill styling with 1px hairline border and soft background wash.
   - **Icons**: Ensure the exact same Lucide icon name is used on both platforms (`lucide-react` vs `lucide-react-native`).
   - **Terminology**: Exact same labels (e.g. "Historical Machine Logs", "Submit Daily Log", "Breakdown Details").
4. **Enforce Native Touch Ergonomics**:
   - Ensure all touchable areas have `minHeight: 44` or appropriate `hitSlop`.
   - Add haptic feedback (`Haptics.selectionAsync()`) on button presses, tab switches, and confirmations.
   - Add `RefreshControl` on scrollable lists.

---

## 5. Verification Commands

Run these automated checks to confirm 100% compliance:

```bash
# 1. Check Typography Compliance (0 raw properties allowed)
node scripts/check-typography.mjs

# 2. Check Design Tokens Invariants
pnpm --filter @reachinternational/design-tokens test

# 3. Check Permissions & Navigation Reachability
pnpm --filter @reachinternational/permissions test

# 4. Mobile Automated Verification Suite
node apps/mobile/run-tests.mjs

# 5. Mobile TypeScript Check
pnpm --filter @reachinternational/mobile typecheck

# 6. Web TypeScript Check
pnpm --filter @reachinternational/web typecheck

# 7. Monorepo-Wide Typecheck
pnpm typecheck
```

---

## 6. Prohibited Anti-Patterns

- ❌ **Inventing mobile-only colors**: Never create custom colors for mobile that don't match Web design tokens.
- ❌ **Raw font styles in Mobile**: Never write `fontSize`, `fontWeight`, `lineHeight` in `StyleSheet.create`. Always use `<Text variant="...">`.
- ❌ **Ignoring Web when editing Mobile**: Never modify Mobile without verifying Web parity.
- ❌ **Ignoring Mobile when editing Web**: Never complete a Web feature without mirroring it into Mobile.
- ❌ **Desktop UI on Mobile without touch adaptation**: Never shrink a 12-column table onto a phone screen without reflowing to touch cards.
- ❌ **Sub-44px touch targets**: Never build mobile interactive elements smaller than 44px.
