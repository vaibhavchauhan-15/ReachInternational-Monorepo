# AI Persistent Memory System — `AI/`

This directory serves as the persistent software engineering memory and authoritative rulebook for AI coding agents developing in the ReachInternational monorepo.

## Memory Architecture

```text
AI/
├── README.md                              ← YOU ARE HERE (AI Memory system index)
│
├── Persistent Session State:
│   ├── PROJECT_MEMORY.md                  ← Core architecture, domain model & non-negotiables
│   ├── STATE.md                           ← Current live state & recent verified implementations
│   ├── CURRENT_TASK.md                    ← Active task scope, objectives & acceptance criteria
│   ├── CHANGELOG_AI.md                    ← Monorepo engineering changelog & change log
│   ├── FILE_INDEX.md                      ← Feature-to-file path mapping index
│   └── ROUTING_MAP.md                     ← Web and Mobile routing and deep-linking map
│
├── Domain & Architecture Knowledge:
│   ├── DATABASE.md                        ← Supabase Postgres tables, triggers, RPCs & RLS
│   ├── DECISIONS.md                       ← Architectural Decision Records (ADRs)
│   ├── KNOWN_ISSUES.md                    ← Known issues, edge cases & mitigations
│   ├── CODING_RULES.md                    ← Core coding conventions & type safety rules
│   ├── PERFORMANCE_RULES.md               ← Query budgets, RSC standards & render limits
│   ├── SECURITY_RULES.md                  ← ASVS baseline, authorization & RLS guards
│   └── TESTING_RULES.md                   ← Mandatory quality gates & verification protocols
│
├── RULES/                                 ← 15 Authoritative System Rules (MANDATORY READING)
│   ├── ARCHITECTURE.md                    ← Monorepo layering, imports & dependency DAG
│   ├── AUTHENTICATION-AUTHORIZATION.md    ← 6 canonical roles, DAL, Server Actions & RLS
│   ├── DATA-PROTECTION-PRIVACY.md         ← PII masking, data retention & storage buckets
│   ├── DEPLOYMENT-DEVOPS-RELEASE.md       ← Multi-stage release validation & zero secrets
│   ├── DESIGN-SYSTEM.md                   ← Vercel Geist tokens & 100% web/native parity
│   ├── GLOBAL-RESPONSIVE-DESIGN.md        ← 3-tier viewports (Mobile, Tablet, Desktop)
│   ├── MULTI-AGENT-ENGINEERING-TEAM.md    ← Agent collaboration protocols & specializations
│   ├── OBSERVABILITY-MONITORING-LOGGING.md ← Structured audit logging & log sanitation
│   ├── PERFORMANCE.md                     ← Database p95, bundle limits & RSC rules
│   ├── SECURITY.md                        ← Zero-trust architecture & input sanitization
│   ├── SEO-METADATA-DISCOVERABILITY.md    ← Metadata, Open Graph, Sitemap & Robots
│   ├── TESTING-QA.md                      ← Quality gate lifecycle & verification gates
│   ├── UI-UX.md                           ← Reusable components & touch target ergonomics
│   ├── VALIDATION-ERROR-RESILIENCE.md     ← Canonical Zod schemas & retry resilience
│   └── WEB-MOBILE-PARITY.md               ← 100% parity across all 8 dimensions
│
├── FEATURES/                              ← Feature Specifications & Domain Models
│   ├── attendance.md                      ← Attendance logging, shifts & daily rollups
│   ├── AUDIT_LOGS.md                      ← Audit logging architecture & schema
│   ├── auth.md                            ← Supabase SSR auth & session management
│   ├── clients.md                         ← Client organizations, sites & billing
│   ├── dashboard.md                       ← 6-role dashboard compositions & KPIs
│   ├── finance.md                         ← Financial reports, billing & rates
│   ├── hr.md                              ← HR operations, onboarding & profiles
│   ├── machine.md                         ← Machinery fleet management & HMR tracking
│   ├── machine-native-rbac-audit.md       ← Mobile machine module RBAC audit
│   ├── MOBILE-SHELL.md                    ← Native mobile shell & WebView bridge
│   ├── operations.md                      ← Shift operations, daily roster & logging
│   ├── rental.md                          ← Equipment rental tracking & status
│   ├── service.md                         ← Machinery maintenance & service logs
│   ├── user.md                            ← User management & role assignment
│   └── user-documents.md                  ← KYC document upload, verification & viewer
│
├── HISTORY/                               ← Historical Sprint Records
│   └── sprint1.md                         ← Initial sprint record & architecture baseline
│
└── TESTING/                               ← Dedicated Test Plans
    └── OPERATIONS-TEST-PLAN.md            ← Operations shift entry comprehensive test plan
```
