---
name: web-mobile-parity
description: Enforce and audit 100% parity between Web (apps/web) and Native Mobile (apps/mobile) across UI/UX, behavior, responsiveness, design, layout, color, theme, and typography. Use whenever building, modifying, reviewing, or debugging features across Web and Mobile.
---

# STRICT MONOREPO RULE: WEB & NATIVE APP PARITY

> **ONE MONOREPO = ONE PRODUCT = ONE SOURCE OF TRUTH = CONSISTENT WEB & NATIVE EXPERIENCE.**
>
> **ABSOLUTE RULE**: Any change that affects shared product functionality, business logic, UI/UX, user workflows, API integration, data handling, validation, permissions, or application behavior in one platform MUST be evaluated and implemented consistently in the other platform.
>
> The web and native applications must remain functionally equivalent, visually consistent, and behaviorally aligned. No AI agent is exempt from this rule.

---

## 1. When to Use This Skill
Activate this workflow whenever:
- Adding, refactoring, or fixing any screen, component, or workflow in `apps/web` or `apps/mobile`.
- Conducting a cross-platform design, layout, or behavioral audit.
- Verifying color, typography, or theme consistency between Web and Native.
- Reviewing PRs or changes for cross-platform drift.
- Evaluating backend, database, validation, or permission changes for cross-platform impact.

---

## 2. Core Monorepo Policy (10-Point Directive)

1. **Mandatory Cross-Platform Consistency**: Any change affecting product functionality, logic, UI/UX, workflows, APIs, data, validation, or permissions in one platform MUST be evaluated and implemented consistently in the other.
2. **Mandatory Codebase Audit**: Before modifying ANY code, read the relevant architecture, identify implementations in both Web and Native, examine database models, inspect existing logs, and evaluate necessity and regressions.
3. **Cross-Platform Change Classification**:
   - **UI/UX**: Equivalent functionality, platform-appropriate components, identical design tokens.
   - **Backend / Business Logic**: Both clients consume updated contracts; zero outdated rules or APIs left behind.
   - **Data and State**: Both platforms correctly read, write, validate, display, and synchronize data.
4. **No Platform Left Behind**: Strictly prohibit implementing on one platform while ignoring the other, fixing bugs in only one client, or using divergent business logic.
5. **Exceptions Only When Justified**: Platform-specific implementations (e.g. native device APIs, responsive table vs card reflow) are permitted, but **never justify platform-specific business behavior**.
6. **Strict 8-Step Workflow**: UNDERSTAND → AUDIT → EVALUATE → IMPACT ANALYSIS → PLAN → IMPLEMENT → VERIFY → REPORT.
7. **Shared Code & Architecture**: Maximize reuse from `@reachinternational/*` (types, permissions, validation, design-tokens, utils).
8. **Testing Requirements**: Run web checks, native checks, backend tests, type checking, and workflow tests before declaring completion. Disclose unexecuted tests; never claim false passes.
9. **Non-Negotiable Completion Gate**: A task is NOT complete until both platforms are audited, updated, tested, and verified against identical business rules.
10. **Final Directive**: One monorepo = One product = One source of truth. Parity is a mandatory engineering requirement.

---

## 3. The 8 Dimensions of 100% Parity

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

## 4. Platform Architecture Specialization

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

## 5. Step-by-Step Parity Implementation Procedure

```text
[STEP 1: INSPECT WEB]      →  Read Web component in apps/web/
                                    ↓
[STEP 2: INSPECT MOBILE]   →  Read corresponding Mobile component in apps/mobile/
                                    ↓
[STEP 3: COMPARE & AUDIT]  →  Identify differences in color, typography, layout, states, APIs
                                    ↓
[STEP 4: STANDARDIZE]      →  Ensure shared packages (@reachinternational/*) are consumed
                                    ↓
[STEP 5: IMPLEMENT PARITY] →  Apply platform-appropriate adaptations without visual or behavioral divergence
                                    ↓
[STEP 6: VERIFY BOTH]      →  Run typecheck & test suite across both apps & mark completion gate
```

---

## 6. Verification Commands

Run these automated checks to confirm 100% compliance:

```bash
# 1. Typecheck both applications and all shared packages
pnpm typecheck

# 2. Check native mobile typography invariants
node apps/mobile/scripts/check-typography.mjs

# 3. Run mobile automated test suites
node apps/mobile/test/run-tests.mjs

# 4. Run monorepo comprehensive test suites
node scripts/run-all-tests.mjs
```
