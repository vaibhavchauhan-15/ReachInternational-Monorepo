# ReachInternational Centralized Testing Standards & Engineering Rules

> **AUTHORITATIVE CENTRALIZED TESTING MANUAL & QUALITY ASSURANCE DIRECTORY**  
> *This directory defines the mandatory, industry-aligned testing standards, quality gates, test selection protocols, cross-platform verification suites, and reporting requirements for all applications (`apps/web`, `apps/mobile`), shared workspace packages (`packages/*`), APIs, database migrations, and operational workflows across the ReachInternational monorepo.*  
>
> **Every AI coding agent and subagent MUST consult and enforce these testing standards for EVERY task before declaring completion.**

---

## 1. Rule Hierarchy & Monorepo Navigation

Testing standards operate within the two-level repository rule hierarchy defined in [`AGENTS.md`](file:///c:/Users/vaibh/PROGRAMMING/PROJECTS/ReachInternational-Monorepo/AGENTS.md):

```text
AGENTS.md                                   ← Global Engineering Rules & Mandatory Testing Invariant
│
├── rules/testing/                          ← YOU ARE HERE (Centralized Testing Standards)
│   ├── README.md                           ← Testing index, navigation & rule hierarchy
│   ├── 00-testing-policy.md                ← Mandatory global testing policy & quality gates
│   ├── 01-test-selection.md                ← Change-impact analysis & test selection matrix
│   ├── 02-code-quality-types.md            ← TypeScript, ESLint, package boundaries, dead code
│   ├── 03-unit-component-testing.md        ← Unit tests, Zod schemas, business logic, components
│   ├── 04-integration-api-database.md      ← Server Actions, DAL, Supabase, Postgres, RPC, RLS
│   ├── 05-web-e2e-testing.md               ← Playwright web E2E, journeys, auth, data tables
│   ├── 06-ui-ux-responsive-visual.md       ← 3-tier viewports, Geist tokens, responsive tables
│   ├── 07-accessibility-testing.md         ← WCAG 2.2 AA, axe-core, keyboard, contrast, ARIA
│   ├── 08-security-testing.md              ← ASVS, RBAC, RLS, BOLA/IDOR, secrets, pnpm audit
│   ├── 09-performance-testing.md           ← Web Vitals, bundles, query p95, Hermes, lists
│   ├── 10-native-mobile-testing.md         ← Expo SDK 57, React Native, iOS/Android, Touch/Haptics
│   ├── 11-marketing-seo-testing.md         ← Public marketing SEO, Open Graph, Sitemap, Robots
│   ├── 12-marketing-ai-crawler-llm.md      ← AI crawlers, LLM discoverability, llms.txt, privacy
│   ├── 13-regression-release-testing.md    ← Level 3 release acceptance, EAS, migration replay
│   └── 14-test-reporting.md                ← Test evidence format, PASS/FAIL/BLOCKED statuses
│
├── security/                               ← Monorepo-Wide Baseline Security Policies
│   └── SECURITY-TESTING.md                 ← Security negative test standards & test accounts
│
├── apps/web/
│   ├── AGENTS.md                           ← Next.js 16.2 App Router engineering rules
│   └── security/SECURITY-RULES.md          ← Web-scoped security & SSR auth policies
│
├── apps/mobile/
│   ├── AGENTS.md                           ← Expo SDK 57 / React Native engineering rules
│   └── security/SECURITY-RULES.md          ← Mobile hardware SecureStore & offline rules
│
└── supabase/
    └── AGENTS.md                           ← Database migrations, RLS policies & RPC rules
```

---

## 2. Directory Index & Rule Cross-Reference

| Document | Primary Domain | Applicability | Key Monorepo Verification Command |
|---|---|---|---|
| [**00-testing-policy.md**](file:///c:/Users/vaibh/PROGRAMMING/PROJECTS/ReachInternational-Monorepo/rules/testing/00-testing-policy.md) | Global Testing Policy | Monorepo-wide | Quality gate lifecycle (Understand → Plan → Test → Report) |
| [**01-test-selection.md**](file:///c:/Users/vaibh/PROGRAMMING/PROJECTS/ReachInternational-Monorepo/rules/testing/01-test-selection.md) | Test Selection & Impact | All Tasks | Impact matrix (Level 1, Level 2, Level 3) |
| [**02-code-quality-types.md**](file:///c:/Users/vaibh/PROGRAMMING/PROJECTS/ReachInternational-Monorepo/rules/testing/02-code-quality-types.md) | Types & Linting | Monorepo-wide | `pnpm typecheck` & `pnpm lint` |
| [**03-unit-component-testing.md**](file:///c:/Users/vaibh/PROGRAMMING/PROJECTS/ReachInternational-Monorepo/rules/testing/03-unit-component-testing.md) | Unit & Components | Packages, Web, Mobile | `pnpm --filter @reachinternational/permissions test` |
| [**04-integration-api-database.md**](file:///c:/Users/vaibh/PROGRAMMING/PROJECTS/ReachInternational-Monorepo/rules/testing/04-integration-api-database.md) | API & Database | DAL, Actions, Supabase | `node supabase/verify_seed.mjs` |
| [**05-web-e2e-testing.md**](file:///c:/Users/vaibh/PROGRAMMING/PROJECTS/ReachInternational-Monorepo/rules/testing/05-web-e2e-testing.md) | Web End-to-End | `apps/web` | Playwright journey verification |
| [**06-ui-ux-responsive-visual.md**](file:///c:/Users/vaibh/PROGRAMMING/PROJECTS/ReachInternational-Monorepo/rules/testing/06-ui-ux-responsive-visual.md) | UI/UX & Responsive | Web, Mobile | 3-tier viewport audit & token checks |
| [**07-accessibility-testing.md**](file:///c:/Users/vaibh/PROGRAMMING/PROJECTS/ReachInternational-Monorepo/rules/testing/07-accessibility-testing.md) | Accessibility | Web, Mobile | WCAG 2.2 AA audit (`axe-core`, keyboard) |
| [**08-security-testing.md**](file:///c:/Users/vaibh/PROGRAMMING/PROJECTS/ReachInternational-Monorepo/rules/testing/08-security-testing.md) | Security & RBAC | Server Actions, RLS | Negative authorization tests & `pnpm audit` |
| [**09-performance-testing.md**](file:///c:/Users/vaibh/PROGRAMMING/PROJECTS/ReachInternational-Monorepo/rules/testing/09-performance-testing.md) | Performance | Web, Database, Mobile | Web Vitals (LCP/INP/CLS) & Query p95 |
| [**10-native-mobile-testing.md**](file:///c:/Users/vaibh/PROGRAMMING/PROJECTS/ReachInternational-Monorepo/rules/testing/10-native-mobile-testing.md) | Native Mobile | `apps/mobile` | `node apps/mobile/test/run-tests.mjs` |
| [**11-marketing-seo-testing.md**](file:///c:/Users/vaibh/PROGRAMMING/PROJECTS/ReachInternational-Monorepo/rules/testing/11-marketing-seo-testing.md) | Public SEO | Public Marketing Only | Sitemap, Robots, Metadata & JSON-LD validation |
| [**12-marketing-ai-crawler-llm.md**](file:///c:/Users/vaibh/PROGRAMMING/PROJECTS/ReachInternational-Monorepo/rules/testing/12-marketing-ai-crawler-llm.md) | AI Crawler & LLM | Public Marketing Only | AI crawler rules, SSR extraction, zero private leaks |
| [**13-regression-release-testing.md**](file:///c:/Users/vaibh/PROGRAMMING/PROJECTS/ReachInternational-Monorepo/rules/testing/13-regression-release-testing.md) | Regression & Release | Full Monorepo | `pnpm build` & parity verification |
| [**14-test-reporting.md**](file:///c:/Users/vaibh/PROGRAMMING/PROJECTS/ReachInternational-Monorepo/rules/testing/14-test-reporting.md) | Test Reporting Format | All AI Tasks | Mandatory report schema (PASS / FAIL / BLOCKED) |

---

## 3. Mandatory AI Agent Workflow

Every AI agent and subagent operating in this repository MUST follow this sequence for every code modification:

```text
1. DISCOVERY        → Read rules/testing/README.md and the applicable detailed testing rules
2. IMPACT ANALYSIS  → Classify task risk into Level 1, Level 2, or Level 3 (01-test-selection.md)
3. IMPLEMENTATION   → Write code with built-in testability, type safety, and error handling
4. EXECUTION        → Run actual test commands against the affected workspace modules
5. VERIFICATION     → Confirm 0 errors, 0 broken invariants, and 0 security bypasses
6. REPORTING        → Generate standardized test report in prompt output (14-test-reporting.md)
```

---

## 4. Fundamental Testing Invariants

1. **Zero Untested Completions**: No task is complete until affected modules have executed relevant tests and passed with exit code 0.
2. **Never Disable Checks to Pass**: Never silence TypeScript with `any`, never skip tests with `.skip()`, never remove Zod validations, and never disable Supabase RLS.
3. **Environment Isolation**: All database tests, migrations, and mutation tests MUST target the **Development Project** (`vlmxciuogczumumrwyot`). The Production Project (`dhbbgfzbyatzvqafnsqp`) is strictly protected.
4. **100% Web & Mobile Parity**: Any operational change on Web MUST be accompanied by synchronized tests and validation on Mobile across all 8 parity dimensions.
5. **No Fabricated Results**: Agents must never claim "Tested successfully" unless commands were actually executed and outputs verified. If a test cannot be executed, it must be reported as `NOT RUN` with the explicit reason.
