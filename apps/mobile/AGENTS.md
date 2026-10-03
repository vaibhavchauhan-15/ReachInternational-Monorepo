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

### 1. Platform-Aware Components

- Use React Native primitives (`View`, `Text`, `Pressable`, `ScrollView`, `FlatList`).
- **Minimum 44px touch targets** on all interactive elements.
- Bottom sheets instead of modals for mobile-first interactions.
- Scrollable horizontal filter strips (`ScrollView horizontal`) instead of dropdowns where applicable.
- Haptic feedback on critical interactions (submission, deletion).

### 2. Three-Tier Responsive Design (Web Export)

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
