# ReachInternational Documentation Index — `docs/`

Welcome to the centralized documentation repository for the ReachInternational platform. This directory contains architectural specifications, implementation guides, deployment manuals, approvals engine documentation, and QA audit reports.

## Documentation Structure

```text
docs/
├── README.md                              ← YOU ARE HERE (Documentation index)
│
├── architecture/                          ← Monorepo Architecture & Design Specs
│   ├── ARCHITECTURE.md                    ← Monorepo topology, Next.js RSC & Expo native data layer
│   └── DESIGN_SYSTEM.md                   ← Vercel Geist tokens, colors, typography scales & hairlines
│
├── approvals/                             ← Unified Approval Engine
│   ├── README.md                          ← Approvals system index & operational overview
│   ├── 00-discovery-report.md             ← Approval workflow audit, states & dual-control analysis
│   └── 01-design.md                       ← Approval state machine, outbox queue & parity contract
│
├── guides/                                ← Implementation Guides
│   ├── REUSABLE_INSTANT_SEARCH_GUIDE.md   ← Instant search, debounce & filter strip architecture
│   ├── reach-about-page-implementation-plan.md ← Public marketing about page layout & animation plan
│   └── about-page-handoff.md              ← About page component handoff & design tokens
│
├── deployments/                           ← Deployment & Hosting Manuals
│   └── NETLIFY_DEPLOYMENT.md              ← Netlify Next.js App Router monorepo build & scheduled functions
│
└── reports/                               ← QA & Audit Reports
    └── SHIFT_ENTRY_QA_REPORT.md           ← Shift entry feature production readiness & QA audit report
```

## Primary Root Specifications

For binding, monorepo-wide authoritative engineering rules, refer to:
- [`README.md`](../README.md): Master repository documentation
- [`AGENTS.md`](../AGENTS.md): Global engineering rules and development lifecycle
- [`ARCHITECTURE.md`](../ARCHITECTURE.md): Authoritative system architecture and dependency DAG
- [`DESIGN.md`](../DESIGN.md): Authoritative design tokens and Vercel Geist styling standards
- [`SECURITY.md`](../SECURITY.md): Baseline security policies and attack surface controls
- [`NOTIFICATIONS.md`](../NOTIFICATIONS.md): Real-time and push notification architecture
- [`prd.md`](../prd.md): Platform product requirements
