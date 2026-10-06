# Authoritative Rule: Native Mobile Backend & Architecture Specifications — `.agents/rules/native_backend_architecture.md`

> **MANDATORY ARCHITECTURE RULE FOR NATIVE MOBILE (`apps/mobile`)**:
>
> While visual design, color tokens, typography, layout, and user-facing behavior MUST maintain **100% parity** with the Web App (`apps/web`), the backend data layer and runtime architecture for Native Mobile MUST follow native-appropriate best practices.

---

## 1. Technical Stack & Foundation

- **Platform Framework**: Expo SDK 57 / React Native 0.86
- **Routing**: Expo Router (file-based navigation mirroring Next.js App Router patterns)
- **Language**: TypeScript 5 (Strict Mode, 0 errors permitted)
- **Server State / Data Layer**: TanStack Query (`@tanstack/react-query`)
- **Client State**: Zustand
- **Secure Storage**: `expo-secure-store` backed by Android KeyStore and iOS Keychain
- **Network / Connectivity**: `@react-native-community/netinfo`
- **Offline Persistence**: `@react-native-async-storage/async-storage`
- **Haptics**: `expo-haptics`
- **Typography Primitives**: `<Text variant="...">` from `components/ui/Text.tsx` and `useTypeStyle()`
- **Database / Auth**: `@supabase/supabase-js` targeting Development Project (`vlmxciuogczumumrwyot`)

---

## 2. Native Data Layer (TanStack Query)

1. **Server State Exclusivity**:
   - All server data fetching MUST be managed through **TanStack Query**.
   - Custom query hooks MUST be centralized in `apps/mobile/lib/hooks/` and `apps/mobile/lib/queries/` (e.g., `useOperatorHistoryLogs`, `useMachineData`, `usePayrollData`).
2. **Stale Time Policy**:
   - Default `staleTime` is set to **30 seconds** (`30 * 1000`) across all queries to prevent redundant network requests while preserving snappy tab transitions.
3. **Reactive Cache Invalidation**:
   - Any mutation (e.g., logging a daily machine log, submitting a breakdown ticket, updating user status) MUST invalidate affected query keys:
     ```typescript
     await queryClient.invalidateQueries({ queryKey: ['operatorHistoryLogs'] });
     ```
4. **Pull-to-Refresh Support**:
   - Every scrollable screen displaying server data MUST implement `RefreshControl` tied to query refetching:
     ```tsx
     <ScrollView
       refreshControl={
         <RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor="#0284c7" />
       }
     >
     ```

---

## 3. Hardware-Backed Auth Storage (`expo-secure-store`)

1. **Hardware Keystore Invariant**:
   - All Supabase session tokens, access tokens, and refresh tokens MUST be persisted securely using `expo-secure-store`.
   - On Android: Backed by Android KeyStore with hardware encryption.
   - On iOS: Backed by Apple Keychain.
2. **Prohibited Storage**:
   - **NEVER** store raw JWTs, access tokens, or sensitive credentials in unencrypted `AsyncStorage`.

---

## 4. Offline-First Synchronization Architecture

1. **Connectivity Detection**:
   - Real-time network state monitoring via `@react-native-community/netinfo`.
2. **Offline Mutation Queue**:
   - When the device is offline, critical mutations (e.g. daily HMR logs, shift entries, breakdown reports) MUST be serialized and queued in local `AsyncStorage`.
3. **Ambient User Awareness**:
   - When offline, the ambient top status banner (`OfflineBanner.tsx`) MUST be displayed informing the operator:
     *"You are currently offline. Changes are saved locally and will sync once reconnected."*
4. **Automatic Synchronization**:
   - Upon reconnecting to cellular or Wi-Fi, the queued mutations MUST automatically replay sequentially, followed by cache invalidation.

---

## 5. Touch & Mobile Ergonomics Invariants

1. **Minimum 44px Touch Targets**:
   - Every interactive element (buttons, selectable list cards, filter pills, dropdown rows) MUST enforce `minHeight: 44` or appropriate `hitSlop` (`{ top: 10, bottom: 10, left: 10, right: 10 }`).
2. **Bottom Sheets Over Centered Modals**:
   - On mobile viewports, prefer bottom sheets (or smooth sheet drawers) rather than desktop-style centered popovers.
3. **Scrollable Horizontal Filter Strips**:
   - Use `ScrollView horizontal showsHorizontalScrollIndicator={false}` for status and category filter pills to avoid vertical clutter or wrapped text.
4. **Tactile Haptic Feedback**:
   - Critical user actions (tab switching, log submissions, deletions, confirmations) MUST trigger `Haptics.selectionAsync()` or `Haptics.notificationAsync()`.
5. **Safe Area Inset Handling**:
   - Every full-screen view MUST respect `useSafeAreaInsets()` to prevent UI clipping beneath device notches, camera cutouts, and bottom home indicators.

---

## 6. Strict Typography Safety (Zero Raw Typography Properties)

1. **Canonical Typography Primitive**:
   - Native code MUST use `<Text variant="...">` from `components/ui/Text.tsx` or `useTypeStyle(variant)`.
2. **Enforced Typography Invariant**:
   - AI agents are **STRICTLY PROHIBITED** from defining raw font properties (`fontSize`, `fontWeight`, `lineHeight`, `fontFamily`) directly in `StyleSheet.create`.
   - Verified continuously via `node scripts/check-typography.mjs`.

---

## 7. Canonical Roles & Permissions

- Native app MUST consume the exact same **6 canonical roles** from `@reachinternational/permissions`:
  1. `super_admin`
  2. `admin`
  3. `manager`
  4. `supervisor`
  5. `hr`
  6. `operator`
- Bottom navigation tabs are dynamically driven by role manifests (`getNavForRole()`).
- Bypassing permission checks or inventing roles is strictly forbidden.

---

## 8. Verification Commands for Native Mobile

```bash
# 1. Typography Invariant Verification
node scripts/check-typography.mjs

# 2. Native Mobile Test Suite (21/21 scenarios)
node apps/mobile/run-tests.mjs

# 3. TypeScript Strict Compilation
pnpm --filter @reachinternational/mobile typecheck

# 4. Expo Lint
pnpm --filter @reachinternational/mobile lint
```
