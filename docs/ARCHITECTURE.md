# ReachInternational Architecture Documentation — `docs/ARCHITECTURE.md`

> Reference specification for monorepo topology, Next.js Web App Router architecture, Expo Native Mobile architecture, and Supabase PostgreSQL persistence layer.

For the binding authoritative policy, see [ARCHITECTURE.md](file:///c:/Users/vaibh/PROGRAMMING/PROJECTS/ReachInternational-Monorepo/ARCHITECTURE.md) and [AI/RULES/ARCHITECTURE.md](file:///c:/Users/vaibh/PROGRAMMING/PROJECTS/ReachInternational-Monorepo/AI/RULES/ARCHITECTURE.md).

---

## 1. Monorepo Structure

- **`apps/web`**: Next.js 16.2 App Router web application with React 19 Server Components (RSC), Data Access Layer (`lib/dal.ts`), Server Actions (`app/actions/*`), and Supabase SSR Auth.
- **`apps/mobile`**: Expo SDK 57 React Native 0.86 application with Expo Router, TanStack Query, SecureStore hardware keystore, and offline mutation queue.
- **`packages/types`**: TypeScript type definitions for Supabase tables, DTOs, and domain models.
- **`packages/validation`**: Universal Zod v4 schemas for all domain entities and mutations.
- **`packages/permissions`**: Universal RBAC definitions for 6 canonical roles (`super_admin`, `admin`, `manager`, `supervisor`, `hr`, `operator`).
- **`packages/design-tokens`**: Platform-neutral tokens (colors, typography, spacing, radius, motion) with CSS variables and React Native theme adapters.
- **`packages/utils`**: Pure platform-neutral utilities (INR currency formatting, date helpers, string helpers).
- **`packages/api-client`**: Standardized API response envelopes and error types.
- **`packages/config`**: Monorepo tooling and ESLint configs.

---

## 2. Web App Data Architecture
- **Reads**: Server Components invoke DAL queries in `lib/dal.ts` and `lib/queries/*` with per-request Supabase clients.
- **Writes**: Client components submit forms via Next.js Server Actions in `app/actions/*`. Actions validate inputs using Zod, enforce RBAC permissions, log mutations to `audit_logs`, and trigger cache revalidations via `revalidateTag` / `revalidatePath`.
- **Auth**: Managed using `@supabase/ssr` with secure HTTP-only cookies.

---

## 3. Native App Data Architecture
- **Reads & Cache**: TanStack Query (`@tanstack/react-query`) with hooks in `lib/hooks/` and `lib/queries/` managing caching, background refreshing (30s stale time), and query invalidations.
- **Auth**: Hardware-backed `expo-secure-store` storing access/refresh tokens in iOS Keychain / Android KeyStore.
- **Offline**: Network connectivity monitored via NetInfo; pending mutations queued in AsyncStorage and synced automatically when back online.
- **Touch & Motion**: Reanimated spring animations, Haptic feedback via `expo-haptics`, and minimum 44px touch targets.
