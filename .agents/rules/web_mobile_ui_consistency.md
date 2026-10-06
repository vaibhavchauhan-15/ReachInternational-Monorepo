# Authoritative Rule: Web & Mobile 100% Parity Across UI/UX, Behavior, Responsiveness, Design, Layout, Color, Theme & Native Backend Architecture

> **MANDATORY ENFORCEMENT RULE FOR ALL AI CODING AGENTS**:
> 
> 1. **100% VISUAL & BEHAVIORAL PARITY**: The Web App (`apps/web`) and Native App (`apps/mobile`) MUST follow the **100% EXACT SAME color tokens, theme adaptations, typography hierarchy, font families, visual layout, UI/UX components, interaction behaviors, and operational terminology**.
> 2. **NATIVE-APPROPRIATE BACKEND & ARCHITECTURE**: The Native App architecture MUST be implemented using native-appropriate patterns (Expo SDK 57, React Native 0.86, Expo Router, TanStack Query, SecureStore hardware keystore, offline queue, touch cards, bottom sheets, haptics, and min 44px touch targets) while Web uses Next.js 16.2 App Router, RSC, DAL, Server Actions, and SSR Auth.
> 3. **ZERO-DRIFT CHANGE SYNCHRONIZATION**: Whenever ANY change, feature, style, theme, color, modal, form field, status badge, or workflow is added or modified on Web, the AI agent **MUST MANDATORILY apply and synchronize the exact same change in the Native App in the same session**.
> 4. **STRICT ENFORCEMENT**: No code change is complete until both Web and Mobile have been synchronized and verified.

---

## 1. Single Source of Truth for Design

Every AI agent must strictly follow:
1. `DESIGN.md` in workspace root.
2. `ARCHITECTURE.md` in workspace root.
3. `AI/RULES/DESIGN-SYSTEM.md`.
4. Shared design tokens in `@reachinternational/design-tokens`.
5. The `web-mobile-parity` skill (`.agents/skills/web-mobile-parity/SKILL.md`).

**NEVER independently invent colors, font sizes, margins, paddings, or icons for Web or Mobile.**

---

## 2. 100% Color & Theme Parity

Web and Native Mobile must use the **exact same color tokens** in both Light and Dark themes:

### 2.1 Foundation Colors
- **Ink Tone (Headings & Primary Text)**:
  - Light: `#171717` (`var(--color-ink)`, `theme.colors.ink`)
  - Dark: `#fafafa` (`var(--color-ink)`, `theme.colors.ink`)
- **Canvas (Page Background)**:
  - Light: `#fafafa` (`var(--color-canvas)`, `theme.colors.canvas`)
  - Dark: `#0a0a0a` (`var(--color-canvas)`, `theme.colors.canvas`)
- **Canvas Elevated (Cards, Modals, Inputs)**:
  - Light: `#ffffff` (`var(--color-canvas-elevated)`, `theme.colors.canvasElevated`)
  - Dark: `#171717` (`var(--color-canvas-elevated)`, `theme.colors.canvasElevated`)
- **Hairline Border (1px crisp structural border)**:
  - Light: `#ebebeb` (`var(--color-hairline)`, `theme.colors.hairline`)
  - Dark: `#262626` (`var(--color-hairline)`, `theme.colors.hairline`)
- **Hairline Soft (Subtle panels, alternating rows)**:
  - Light: `#f2f2f2` (`var(--color-hairline-soft)`, `theme.colors.hairlineSoft`)
  - Dark: `#1a1a1a` (`var(--color-hairline-soft)`, `theme.colors.hairlineSoft`)

### 2.2 Text Ladder
- **Body**: `#4d4d4d` (light) / `#a3a3a3` (dark)
- **Mute**: `#8f8f8f` (light) / `#737373` (dark)
- **Faint**: `#a1a1a1` (light) / `#525252` (dark)

### 2.3 Brand & Interactive Accents
- **Primary / Reach Sky Blue**: `#0284c7` (light) / `#0ea5e9` (dark) — primary CTA buttons, active state highlights.
- **Link / Vercel Blue**: `#0070f3` (light) / `#3b82f6` (dark) — inline links, focus rings, active indicator pills.
- **Link Deep**: `#0761d1` (light) / `#2563eb` (dark) — pressed / active link states.
- **Link Soft**: `#d3e5ff` (light) / `#1e3a8a` (dark) — active category pill background wash.

### 2.4 Semantic Operational Status Colors
- **Success / Operational**: `#10b981` (soft `#ecfdf5`, deep `#059669`) / Dark `#34d399` (soft `#064e3b`).
- **Warning / Caution**: `#f5a623` (soft `#ffefcf`, deep `#ab570a`) / Dark `#fbbf24` (soft `#78350f`).
- **Error / Breakdown**: `#ee0000` (soft `#fef2f2`, deep `#c50000`) / Dark `#f87171` (soft `#450a0a`).
- **Info**: `#3b82f6` (soft `#eff6ff`, deep `#2563eb`) / Dark `#60a5fa` (soft `#1e3a8a`).
- **Pending**: `#f59e0b` (soft `#fffbeb`, deep `#d97706`) / Dark `#fbbf24` (soft `#78350f`).
- **Overdue**: `#e11d48` (soft `#fff1f2`, deep `#be123c`) / Dark `#fb7185` (soft `#4c0519`).

**Rule**: An AI agent MUST NEVER use a different status color or brand color on Mobile than on Web.

---

## 3. 100% Typography & Font Parity

Both Web and Native Mobile run on **Geist Sans** and **Geist Mono**:

- **Web**: Implemented via `@font-face` / next/font, Geist Sans & Geist Mono font variables.
- **Native**: Bundled static `.ttf` font files in `apps/mobile/assets/fonts/`:
  - `Geist-Regular.ttf`
  - `Geist-Medium.ttf`
  - `Geist-SemiBold.ttf`
  - `Geist-Bold.ttf`
  - `GeistMono-Medium.ttf`
- **Mobile Typography Rule**: Native code MUST use `<Text variant="...">` from `components/ui/Text.tsx` or `useTypeStyle(variant)`. Setting raw typography properties (`fontSize`, `fontWeight`, `lineHeight`, etc.) in `StyleSheet.create` is strictly forbidden.

---

## 4. 100% UI/UX & Behavior Parity

Every component and user workflow must maintain identical interaction behaviors and visual aesthetics:

1. **Loading Skeletons**: Both platforms MUST display matching pulse skeleton loaders (`DashboardSkeleton`, `MetricCardSkeleton`) during data loading, preventing layout shift.
2. **Empty States**: If a table or list is empty, both platforms MUST render the canonical `EmptyState` component with identical icon, title, and descriptive subtitle.
3. **Error Handling**: Network and API errors MUST be presented consistently using the same error message wording and retry CTA.
4. **Toast Feedback**: Successful mutations, log submissions, and profile updates MUST show identical toast notifications (e.g. "Shift log submitted successfully").
5. **Confirmation Dialogs**: Destructive actions (sign out, delete machine, cancel shift) MUST use the canonical `ConfirmationDialog` (Web) / `ConfirmDialog` (Mobile) with identical red orb warning icon, title, and cancel/confirm buttons.
6. **SegmentedToggle**: Same sliding pill design, same Geist typography, same active blue highlight, same container background (`#f4f4f5` light / `rgba(255,255,255,0.06)` dark), and count badges.
7. **Form Validation Feedback**: Real-time validation errors MUST highlight the invalid input border in red (`#ee0000`) and display identical error text below the field.
8. **Icons**: Exact same Lucide icon glyphs (`lucide-react` on Web, `lucide-react-native` on Mobile).
9. **Bottom Navigation**: Same 5-slot manifest-driven navigation (`getNavForRole()` from `@reachinternational/permissions`), same icons, and same "Menu" drawer trigger.

---

## 5. 100% Responsiveness & 3-Tier Viewport Parity

Both Web and Native Mobile MUST support the 3-tier viewport protocol:

```text
┌─────────────────────────────────────────────────────────────────────────┐
│                        VIEWPORT RESPONSIVENESS                          │
├────────────────────────┬────────────────────────┬───────────────────────┤
│    MOBILE (≤ 640px)    │   TABLET (641-1023px)   │   DESKTOP (≥ 1024px)  │
├────────────────────────┼────────────────────────┼───────────────────────┤
│ • Touch Card View      │ • 2-Column Grid Reflow │ • High-Density Table  │
│ • Scroll Filter Bar    │ • Adaptive Modals      │ • Fixed Sidebar Nav   │
│ • Bottom Sheet Dialogs │ • Condensed Toolbars   │ • Hover Tooltips      │
│ • Min 44px Touch Target│ • Collapsible Drawers  │ • Multi-Col Dashboards│
└────────────────────────┴────────────────────────┴───────────────────────┘
```

1. **High-Density Table Reflow**: On mobile screens (≤640px), data tables MUST reflow into stacked touch cards with min 44px tap targets.
2. **Horizontal Filter Strips**: Status filters, date pickers, and tab bars MUST support smooth horizontal touch scrolling without text wrapping or layout clipping.
3. **Modal Height Clamping**: Dialogs and sheets MUST clamp to viewport height (`max-h-[calc(100vh-2rem)]` / bottom sheet) with internal scrolling.

---

## 6. Native Backend & Architecture Specifications

While the visual design and behavior are 100% identical, the backend data layer and runtime architecture MUST follow native-platform best practices:

### 6.1 Native Data Layer (TanStack Query)
- Native Mobile MUST use **TanStack Query (`@tanstack/react-query`)** for server state.
- Custom query hooks (e.g. `useOperatorHistoryLogs`, `useMachineData`) must be centralized in `lib/hooks/` and `lib/queries/`.
- Default stale time of 30 seconds to prevent unnecessary network polling.
- Reactive cache invalidation on mutations (e.g. `queryClient.invalidateQueries({ queryKey: [...] })`).
- Pull-to-refresh (`RefreshControl`) implemented on all scrollable list screens.

### 6.2 Native Hardware-Backed Auth Storage
- Native Mobile MUST use **`expo-secure-store`** backed by Android KeyStore and iOS Keychain for storing auth tokens and refresh tokens.
- Never store raw access tokens in unencrypted AsyncStorage.

### 6.3 Offline-First Queue & Syncing
- Native Mobile MUST monitor network connectivity via `@react-native-community/netinfo`.
- Offline mutations (daily HMR logs, shift entries) must save into persistent local queue in `AsyncStorage`.
- Ambient top banner (`OfflineBanner.tsx`) displays when offline, informing the user that changes save locally.
- Automatic queue synchronization and cache invalidation when network connectivity resumes.

### 6.4 Native Touch & Mobile UX Optimization
- **Minimum 44px Touch Targets**: Enforced on all buttons, touchable cards, and menu triggers (`minHeight: 44` / `hitSlop`).
- **Tactile Haptic Feedback**: Critical actions (tab switches, log submissions, deletions) MUST trigger `Haptics.selectionAsync()` or `Haptics.notificationAsync()`.
- **Bottom Sheets & Modals**: Use smooth bottom sheets on mobile viewports rather than desktop centered popovers.
- **Scrollable Horizontal Filter Strips**: Use `ScrollView horizontal showsHorizontalScrollIndicator={false}` for category pills.
- **Safe Area Insets**: Always incorporate `useSafeAreaInsets()` to prevent UI overlap with device notches and home indicator bars.

---

## 7. Web Backend & Architecture Specifications

Web Application architecture leverages Next.js 16.2 App Router capabilities:
1. **React Server Components (RSC)**: Fetch data server-side by default, eliminating client-side loading waterfalls.
2. **Data Access Layer (DAL)**: All reads go through `lib/dal.ts` and `lib/queries/*` using per-request Supabase SSR clients.
3. **Server Actions (`app/actions/*`)**: All mutations go through Server Actions with Zod validation, role authorization, audit logging, and cache revalidation (`revalidateTag`).
4. **SSR Auth**: Supabase Auth managed securely via HTTP-only cookies (`@supabase/ssr`).

---

## 8. Mandatory AI Agent Pre-Completion Verification Checklist

Before completing any task, every AI agent MUST verify:

- [ ] Does the visual design, color tokens, and font hierarchy match `DESIGN.md` 100%?
- [ ] Were any changes in `apps/web` mirrored and synchronized into `apps/mobile`?
- [ ] Are all touch targets in `apps/mobile` ≥ 44px?
- [ ] Does Native Mobile use TanStack Query for data fetching and SecureStore for auth?
- [ ] Does Native Mobile use `<Text variant="...">` with zero raw typography properties?
- [ ] Do both platforms enforce the canonical 6 roles from `@reachinternational/permissions`?
- [ ] Does `pnpm typecheck` pass with 0 errors monorepo-wide?
- [ ] If an agent places Web and Mobile screens side-by-side, do they look like ONE unified product?
