---
phase: 15-production-release-deployment-verification
plan: 02
subsystem: build-and-release
tags: [turborepo, nextjs, turbopack, expo, eas, hermes, secrets-audit, production]

# Dependency graph
requires:
  - phase: 15-01
    provides: 100% passing backend regression test suite and seed verification
provides:
  - Full monorepo production build with 7/7 workspace packages passing cleanly
  - Hardened web build guard supporting CI and SKIP_BUILD_GUARD bypass
  - Verified Expo EAS packaging configurations for Android APK/AAB and iOS IPA
  - Verified standalone mobile production bundle via Expo export (Android, iOS, Web)
  - Production environment variable templates locked and security audit verified
affects: []

actuals:
  tokens: 3200
  tasks: 2
  commits: 1

tech-stack:
  added: []
  patterns: [Turbopack production compilation, Expo Hermes static bundle export, production secrets isolation]

key-files:
  created: []
  modified:
    - apps/web/scripts/guard-build.js
    - .env.example
    - apps/web/.env.example
    - apps/mobile/.env.example

key-decisions:
  - "Enhanced guard-build.js to immediately bypass port checks when SKIP_BUILD_GUARD, CI, or VERCEL is active"
  - "Sanitized apps/mobile/.env.example and root .env.example to ensure complete placeholder coverage and correct reachinternational scheme"
  - "Verified mobile export with Hermes bytecode compiler generating 6.85MB Android and 6.86MB iOS release bundles"

patterns-established:
  - "Build guard environment bypass pattern allowing automated CI and verification pipelines to bypass local port probing"
  - "Strict client environment boundary: public variables restricted to NEXT_PUBLIC_ and EXPO_PUBLIC_ prefixes with zero server secret leakage"

requirements-completed:
  - MOB-01

coverage:
  - id: D1
    description: "Harden web build guard and execute clean monorepo turbo build and typecheck across all 7 workspace packages"
    requirement: MOB-01
    verification:
      - kind: build
        ref: "pnpm turbo run build"
        status: pass
      - kind: build
        ref: "pnpm turbo run typecheck"
        status: pass
  - id: D2
    description: "Validate Expo EAS packaging profiles, generate mobile production bundles via expo export, and audit environment secrets"
    requirement: MOB-01
    verification:
      - kind: build
        ref: "pnpm --filter @reachinternational/mobile exec expo export --output-dir dist"
        status: pass
      - kind: audit
        ref: "node scripts/audit-env-secrets"
        status: pass
---

# Plan 15-02 Summary: Production Build Packaging, EAS Setup & Secret Lockdown

Plan 15-02 has finalized monorepo production packaging, hardened build guards, verified EAS mobile build configurations, and locked production environment variables with zero secret leaks.

## Accomplishments

1. **Monorepo Build Guard Hardening & Full Production Build**:
   - Updated `apps/web/scripts/guard-build.js` with an automated bypass for `CI`, `VERCEL`, and `SKIP_BUILD_GUARD` flags to ensure automated pipelines build cleanly without local socket probing interference.
   - Executed `pnpm turbo run typecheck` across all 7 workspace packages (`@reachinternational/design-tokens`, `@reachinternational/permissions`, `@reachinternational/types`, `@reachinternational/utils`, `@reachinternational/validation`, `@reachinternational/mobile`, `@reachinternational/web`) with **7/7 passing and 0 errors**.
   - Executed `pnpm turbo run build` across all 7 workspaces. Next.js 16.2.12 compiled all 43 routes with Turbopack and completed static page optimization with **7/7 packages successful and 0 errors**.

2. **Mobile EAS Packaging & Production Export**:
   - Verified `apps/mobile/eas.json` profiles:
     - `development`: `developmentClient: true`, `android.buildType: "apk"`
     - `preview`: `distribution: "internal"`, `android.buildType: "apk"`, `ios.simulator: false`
     - `production`: `autoIncrement: true`, `android.buildType: "app-bundle"`
   - Executed `npx expo export` through Metro bundler, generating production assets:
     - Android Hermes bytecode bundle: **6.85 MB (`.hbc`)** across 2,863 modules
     - iOS Hermes bytecode bundle: **6.86 MB (`.hbc`)** across 2,867 modules
     - Web bundle: **4.31 MB (`.js`)** across 2,492 modules
     - 49 optimized static assets and metadata manifests generated with zero errors.

3. **Production Environment & Security Audit**:
   - Audited `.env.example`, `apps/web/.env.example`, and `apps/mobile/.env.example`.
   - Replaced any specific URLs or tokens with generic placeholders.
   - Verified alignment of deep link scheme `reachinternational` across mobile and root templates.
   - Confirmed `.gitignore` protects all local `.env`, `.env.local`, `.env.*.local` files.
   - Verified that no backend secrets (`SUPABASE_SECRET_KEY`, `TWILIO_AUTH_TOKEN`, `SENDGRID_API_KEY`) are exposed to client-facing environments.
