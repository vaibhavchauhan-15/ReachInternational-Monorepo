# Mobile Application Agent Rules — `apps/mobile`

> **Inherits from**: Root `AGENTS.md` (global engineering rules)
>
> These rules EXTEND the global rules. When a module rule conflicts with a global rule, the **STRICTER** rule wins.

---

## Technology Stack

- **Framework**: Expo SDK 57, React Native
- **Routing**: Expo Router (file-based, mirrors Next.js App Router patterns)
- **Language**: TypeScript 5 (Strict Mode)
- **UI**: React Native core components, custom design system components
- **Animations**: React Native Reanimated, Expo Linear Gradient
- **State**: Zustand (client state), TanStack Query (server state / data fetching)
- **Validation**: Zod v4 via `@reachinternational/validation`
- **Auth**: Supabase Auth via `@supabase/supabase-js`

---

## Directory Structure

```text
apps/mobile/
├── app/                    # Expo Router screens
│   ├── (app)/              # Protected screens (authenticated)
│   ├── (auth)/             # Auth screens (login, signup, onboarding)
│   ├── _layout.tsx         # Root layout & providers
│   └── index.tsx           # Entry redirect
├── components/             # Mobile UI components
│   ├── ui/                 # Design system primitives
│   ├── forms/              # Form components
│   ├── documents/          # Document upload components
│   ├── profile/            # Profile-related components
│   └── [module]/           # Module-specific components
├── lib/                    # Utilities & Supabase client
├── store-assets/           # App store screenshots & metadata
├── assets/                 # Images, fonts
├── app.json                # Expo config
├── app.config.js           # Dynamic Expo config
├── eas.json                # EAS Build config
├── metro.config.js         # Metro bundler config
├── tsconfig.json
└── package.json
```

---

## Mobile-Specific Rules

### 0. 100% Web & Native Parity Mandate
- **PRIMARY AUTHORITY**: Root `DESIGN.md`, `ARCHITECTURE.md`, `AI/RULES/DESIGN-SYSTEM.md`, and `AI/RULES/WEB-MOBILE-PARITY.md`.
- **AUTHORITATIVE PARITY RULES & SKILLS**: `.agents/rules/web_mobile_ui_consistency.md` and `.agents/skills/web-mobile-parity/SKILL.md`.
- **100% WEB & MOBILE PARITY ACROSS ALL 8 DIMENSIONS**:
  1. **UI/UX**: Identical components, empty states (`EmptyState`), confirmation dialogs (`ConfirmDialog`), segmented toggles, badges, status pills.
  2. **Behavior**: Identical loading skeleton loaders, toast feedback, error retry, real-time form validation.
  3. **Responsiveness**: 3-tier viewport protocol (Mobile ≤640px touch cards, Tablet 641–1023px 2-col grids, Desktop ≥1024px split layouts).
  4. **Design**: Vercel Geist design system (1px hairline borders `#ebebeb` / `#262626`, bimodal radius 6px app / 64px pill).
  5. **Layout**: Identical visual hierarchy, card metadata order, action placement.
  6. **Color**: 100% exact hex tokens (Reach Sky Blue `#0284c7` / `#0ea5e9`, Success `#10b981`, Warning `#f5a623`, Error `#ee0000`).
  7. **Theme**: 100% synchronized Light (`#fafafa` canvas / `#ffffff` cards) and Dark (`#0a0a0a` canvas / `#171717` cards) modes.
  8. **Typography**: Geist Sans & Geist Mono, canonical `<Text variant="...">` and `useTypeStyle()` with **zero raw typography properties in `StyleSheet.create`**.

### 1. Platform-Aware Components & Architecture
- Use React Native primitives (`View`, `Text`, `Pressable`, `ScrollView`, `FlatList`).
- **Minimum 44px touch targets** on all interactive elements (`minHeight: 44` / `hitSlop`).
- Bottom sheets instead of desktop modals for mobile-first ergonomics.
- Scrollable horizontal filter strips (`ScrollView horizontal`) for status filters.
- Tactile haptic feedback via `expo-haptics` (`Haptics.selectionAsync()`) on critical actions.

### 2. Native Backend & Data Layer Architecture
- **TanStack Query (`@tanstack/react-query`)**: Exclusively used for all server state, background caching (30s stale time), and query invalidation.
- **Hardware-Backed Keystore**: Authentication tokens MUST be stored via `expo-secure-store` backed by Android KeyStore / iOS Keychain.
- **Offline-First Synchronization**: Mutations must queue into persistent local storage in `AsyncStorage` when offline, with real-time NetInfo network detection and auto-sync on reconnect.

### 3. Three-Tier Responsive Design (Web Export)

- Mobile screens MUST also render correctly when exported to web via Expo:
  - **Mobile (≤640px)**: Single-column, touch-optimized cards.
  - **Tablet (641–1023px)**: Centered elevated cards, generous padding.
  - **Desktop (≥1024px)**: Two-column split layouts (showcase panel + form workspace).
- Use `useWindowDimensions()` or `Dimensions.get('window')` for breakpoint detection.

### 3. Data Fetching

- Use **TanStack Query** for all server state.
- Supabase client calls go through `lib/` utility functions.
- Cache keys must be consistent and predictable.
- Implement pull-to-refresh on list screens.
- Handle offline/network-error states gracefully.

### 4. Authentication & Navigation Guards

- Auth state managed via Supabase `onAuthStateChange` listener.
- Root `_layout.tsx` handles auth routing:
  - Unauthenticated → `(auth)/login`
  - Authenticated + `complete_profile === false` → `(auth)/onboarding`
  - Authenticated + `complete_profile === true` → `(app)/dashboard`
- **Never** allow navigation to protected screens without auth check.

### 5. Shared Business Logic

- Import shared types from `@reachinternational/types`.
- Import shared validation schemas from `@reachinternational/validation`.
- Import shared permissions from `@reachinternational/permissions`.
- Import shared utilities from `@reachinternational/utils`.
- **Business logic must remain identical to web** — only UI adaptation differs.

### 6. Reusable Components

- Check `components/ui/` and `components/forms/` before creating new primitives.
- Key reusable primitives:
  - `SearchableSelect` — universal picker with search, badges, status dots
  - `MobileFormSectionCard` — section wrapper for forms
  - `MobileDocumentUploadCard` — canonical document upload field
  - `MobileSubmitButton` — gated submit with validation state
  - `MobileAddressFields` — address form section
  - `MobileSalaryField` — salary input with formatting
  - `TimeInput` — time picker input

### 7. Performance

- Use `FlatList` (not `ScrollView` with `.map()`) for lists > 20 items.
- Memoize expensive computations with `useMemo` / `useCallback`.
- Avoid inline styles in render — use `StyleSheet.create` or style objects.
- Image assets must be optimized (WebP where supported).
- Minimize re-renders — profile with React DevTools if suspected.

### 8. Build & Verification Commands

```bash
# TypeScript check
pnpm --filter @reachinternational/mobile exec tsc --noEmit

# Lint
pnpm --filter @reachinternational/mobile lint

# Expo doctor
cd apps/mobile && npx expo-doctor

# EAS build (development)
cd apps/mobile && eas build --profile development --platform android

# Full monorepo typecheck
pnpm typecheck
```

### 9. Mobile-Specific Prohibitions

- **NEVER** use web-only APIs (`window`, `document`, `localStorage`) without platform checks.
- **NEVER** use `ScrollView` with `.map()` for unbounded lists — use `FlatList`.
- **NEVER** hardcode pixel dimensions — use responsive calculations or flex.
- **NEVER** import from `apps/web` into `apps/mobile`.
- **NEVER** skip the `complete_profile` check in navigation guards.
- **NEVER** use `console.log` in production builds — use proper logging.
- **NEVER** store sensitive tokens in `AsyncStorage` without encryption considerations.
- **NEVER** bypass the EAS build pipeline for release builds.
