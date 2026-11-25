# ReachInternational Monorepo — Repository Structure

## Directory Layout

```
ReachInternational-Monorepo/
├── .agents/               # Agent rules & skills (tool-required discovery directory)
│   ├── rules/             # High-level agent operational & parity rules
│   └── skills/            # Agent skills (e.g., web-mobile-parity)
├── .claude/               # Claude Code configuration, settings, memory & local rules
├── .github/               # GitHub Actions workflows & CI pipelines
├── AI/                    # AI state, logs, current tasks & feature tracking
│   ├── CHANGELOG_AI.md    # AI activity changelog
│   ├── CURRENT_TASK.md    # Active AI engineering focus
│   ├── FEATURES/          # Feature design & audit notes
│   ├── PROJECT_MEMORY.md  # Core project memory & constraints
│   └── STATE.md           # Monorepo health & feature status
├── apps/
│   ├── mobile/            # Expo / React Native mobile application
│   │   ├── app/           # Expo Router navigation screens & layout
│   │   ├── components/    # Mobile UI primitives & feature components
│   │   ├── docs/          # Mobile documentation (store, release notes, audits)
│   │   ├── lib/           # Mobile utilities, hooks & offline state
│   │   └── test/          # Mobile unit & integration tests
│   └── web/               # Next.js web application
│       ├── app/           # Next.js App Router routes & API endpoints
│       ├── components/    # Web UI components & feature layouts
│       ├── docs/          # Web-specific reports & documentation
│       ├── lib/           # Web DAL, state, data fetching & utilities
│       └── scripts/       # Web performance & test verification scripts
├── docs/                  # Central monorepo documentation
│   ├── architecture/      # High-level system & design system architecture
│   ├── deployments/       # Deployment runbooks (Netlify, Vercel, Supabase)
│   ├── guides/            # Feature implementation guides & handoffs
│   ├── reports/           # QA, performance & shift reports
│   └── REPO_STRUCTURE.md  # This document
├── packages/              # Shared monorepo workspace packages
│   ├── permissions/       # Shared RBAC matrix & permissions guard
│   ├── ui/                # Shared design system tokens & primitives
│   ├── utils/             # Shared calculation & formatting utilities
│   └── validation/        # Shared Zod validation schemas
├── rules/                 # Engineering, security, and testing standards
│   └── testing_standards/ # Centralized testing policy & standards
├── runbooks/              # Operational runbooks & troubleshooting
├── scripts/               # Workspace-wide test runners, guards & setup scripts
├── security/              # Authentication & security policies
└── supabase/              # Database migrations, rollbacks, seed scripts & tests
```

## Naming Conventions & Placement Rules

1. **Folder & File Casing**:
   - React components: `PascalCase.tsx` (e.g., `MachineDetailView.tsx`)
   - Utilities, hooks & scripts: `kebab-case.ts` / `camelCase.ts`
   - Documentation: `UPPERCASE.md` or `kebab-case.md`
   - Routes: App router conventions (`page.tsx`, `layout.tsx`, `route.ts`)

2. **Where New Items Belong**:
   - **Shared Logic / Schemas / RBAC**: `packages/`
   - **Cross-Platform Rules & Guidelines**: `rules/`
   - **Architecture & Deployment Docs**: `docs/`
   - **Database Schema Changes**: `supabase/migrations/` (never modify existing ones)
   - **Workspace Verification Scripts**: `scripts/`
