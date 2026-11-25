# Agent Skills Catalog — `.agents/skills/`

This directory houses the installed, reusable agent skills that extend the capabilities of AI coding agents working on the ReachInternational monorepo. Each skill contains a `SKILL.md` instruction specification with YAML frontmatter, execution playbooks, and specialized reference material.

## Skills by Category

### 1. Mobile & React Native (Expo SDK 58)
- **`add-expo-secure-store-keystore`**: Add hardware keystore backed token storage for iOS Keychain and Android Keystore.
- **`argent-react-native-app-workflow`**: Step-by-step workflows for developing and debugging React Native apps on iOS/Android.
- **`argent-react-native-optimization`**: Performance optimization for Hermes apps: profiling bottlenecks, mechanical sweeps, and re-renders.
- **`argent-react-native-profiler`**: Profile Hermes CPU performance, component render counts, and hotspot analysis.
- **`assess-react-native-migration`**: Assess brownfield vs greenfield migration paths and readiness.
- **`design-mobile-apps`**: Implement mobile UI screens and Sleek designs in React Native.
- **`expo-animation`**: Build smooth 60fps animations with Reanimated, Gesture Handler, and tactile haptics.
- **`expo-ui`**: Real native SwiftUI / Jetpack Compose components via `@expo/ui`.
- **`expo-web-to-native`**: End-to-end migration guidance from web React to native Expo.
- **`imagegen-frontend-mobile`**: Mobile screen mockup generation with consistent design systems.
- **`ios-design`**: Apple Human Interface Guidelines, safe-area layout, typography, and iOS ergonomics.
- **`mobile-app-ui-design`**: High-quality mobile UX screens, touch targets (≥44px), and bottom sheets.
- **`native-backend-architecture`**: Mobile data architecture: TanStack Query, SecureStore, offline queues, and zero raw typography.
- **`react-native-architecture`**: Production React Native architecture with Expo Router and native modules.
- **`react-native-best-practices`**: Performance guidelines for FPS, TTI, bundle size, and memory leak prevention.
- **`vercel-react-native-skills`**: Best practices for mobile list virtualization, FlashList, and animation performance.

### 2. Web & Next.js 16.2 (App Router)
- **`clerk-backend-api`**: Clerk REST API explorer and backend user management.
- **`clerk-nextjs-patterns`**: Next.js middleware, Server Actions, and authentication caching.
- **`nextjs-app-router-patterns`**: Next.js App Router with Server Components, streaming, and parallel routes.
- **`nextjs-authentication`**: Authentication patterns for Next.js App Router.
- **`nextjs-data-fetching`**: Server and client data fetching, ISR, revalidation strategies, and error boundaries.
- **`nextjs-react-typescript`**: TypeScript strictness, Next.js App Router, Radix UI, Base UI, and Tailwind CSS.
- **`nextjs-supabase-auth`**: Supabase Auth integration with Next.js App Router via `@supabase/ssr` cookies.
- **`nextjs-turbopack`**: Turbopack incremental Rust bundling, caching, and dev performance.
- **`nodejs-backend-patterns`**: Production Node.js backend patterns, middleware, error handling, and API design.
- **`react-query`**: React Query guidelines for data fetching, caching, and server state synchronization.
- **`react-query-api`**: Typed transport boundaries, query keys, mutations, cache hydration, and server-state UI.
- **`react-query-best-practices`**: TkDodo's comprehensive TanStack Query patterns and cache invalidation.
- **`syncfusion-react-query-builder`**: Advanced dynamic filter interfaces and rule-based query construction.
- **`vercel-geist-design-system`**: Vercel Geist design system tokens, 1px hairlines, and bimodal border radius.
- **`vercel-react-best-practices`**: React and Next.js performance optimization guidelines from Vercel Engineering.
- **`vercel-react-view-transitions`**: Smooth view transitions and shared element route animations.
- **`web-server-state-react-query`**: Server state management, query options, and typed client caching.

### 3. Cross-Platform Parity
- **`web-mobile-parity`**: Enforces 100% parity between Web (`apps/web`) and Mobile (`apps/mobile`) across all 8 dimensions (UI/UX, Behavior, Responsiveness, Design, Layout, Color, Theme, Typography).

### 4. Database & Persistence
- **`supabase`**: Supabase platform operations: Auth, Database, RLS, Storage, Realtime, and Edge Functions.
- **`supabase-postgres-best-practices`**: PostgreSQL schema design, indexing, RLS security, and EXPLAIN query plans.

### 5. UI/UX & Visual Design Polish
- **`high-end-visual-design`**: Premium visual design standards: typography contrast, micro-interactions, and elegance.
- **`minimalist-ui`**: Clean editorial interfaces, warm monochrome palette, and flat bento layouts.
- **`redesign-existing-projects`**: Upgrade existing interfaces to premium standards without breaking functionality.
- **`remotion-to-hyperframes`**: Convert Remotion compositions to HyperFrames HTML.
- **`ui-taste`**: Anti-ui-slop design system playbooks and visual taste polish.

### 6. Browser Automation & Agent Discovery
- **`agent-browser`**: Browser automation CLI for agent testing and UI verification.
- **`browser-act`**: Programmatic browser workflows, form filling, and visual state capture.
- **`find-skills`**: Discover and install agent skills from the marketplace.
