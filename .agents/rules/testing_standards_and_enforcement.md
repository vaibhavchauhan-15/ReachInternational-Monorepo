# Mandatory Testing Standards & Quality Gate Enforcement Rule

> **WORKSPACE CUSTOMIZATION RULE — ENFORCED FOR ALL ANTIGRAVITY AGENTS**  
> *Every AI coding agent and subagent operating in this workspace MUST strictly adhere to the Centralized Testing Standards defined in `rules/testing/`.*

---

## 1. Authoritative Testing Standards Location

The single source of truth for all monorepo testing, verification, accessibility, security negative testing, and test reporting is:

**[`rules/testing/`](file:///c:/Users/vaibh/PROGRAMMING/PROJECTS/ReachInternational-Monorepo/rules/testing/README.md)**

```text
rules/testing/
├── README.md                           ← Testing index, navigation & rule hierarchy
├── 00-testing-policy.md                ← Mandatory global testing policy & quality gates
├── 01-test-selection.md                ← Change-impact analysis & test selection matrix
├── 02-code-quality-types.md            ← TypeScript, lint, formatting & dependency checks
├── 03-unit-component-testing.md        ← Unit, component & business logic tests
├── 04-integration-api-database.md      ← APIs, Server Actions, Supabase, Postgres, RPC, RLS
├── 05-web-e2e-testing.md               ← Marketing and Admin browser E2E tests
├── 06-ui-ux-responsive-visual.md       ← 3-tier viewports, Geist tokens & data tables
├── 07-accessibility-testing.md         ← WCAG 2.2 AA, keyboard, screen readers, ARIA
├── 08-security-testing.md              ← ASVS, negative authorization, RLS & secrets
├── 09-performance-testing.md           ← Web Vitals, bundles, query p95 & Hermes
├── 10-native-mobile-testing.md         ← Expo SDK 57, iOS/Android, SecureStore & Touch
├── 11-marketing-seo-testing.md         ← Public marketing SEO, Sitemap & Robots
├── 12-marketing-ai-crawler-llm.md      ← AI crawler policies & LLM discoverability
├── 13-regression-release-testing.md    ← Level 3 release acceptance battery
└── 14-test-reporting.md                ← Standardized test evidence report format
```

---

## 2. Mandatory Agent Workflow for Every Task

For EVERY task involving code, styling, API, database, or configuration changes, the AI agent MUST:

1. **Consult `rules/testing/README.md`** before planning or executing code modifications.
2. **Determine the Testing Level** (Level 1, Level 2, or Level 3) using [`01-test-selection.md`](file:///c:/Users/vaibh/PROGRAMMING/PROJECTS/ReachInternational-Monorepo/rules/testing/01-test-selection.md).
3. **Execute Relevant Tests** against affected workspace packages after coding.
4. **Fix Any Regressions** immediately before proceeding.
5. **Report Test Outcomes** using the mandatory schema from [`14-test-reporting.md`](file:///c:/Users/vaibh/PROGRAMMING/PROJECTS/ReachInternational-Monorepo/rules/testing/14-test-reporting.md).

---

## 3. Strict Non-Negotiable Rules

1. **Zero Untested Completions**: Never declare an implementation complete without running the relevant typecheck, lint, and test scripts.
2. **Never Fabricate Test Results**: Never claim a test passed without running it. Report `NOT RUN` with clear justification if an environment constraint prevents execution.
3. **Separate Android from iOS**: Never claim iOS tests passed when only Android tests were run.
4. **Development Database Isolation**: All database and migration tests MUST target the **Development Project** (`vlmxciuogczumumrwyot`). Never target Production (`dhbbgfzbyatzvqafnsqp`).
5. **Web & Mobile 100% Parity**: Any operational change on Web MUST be accompanied by synchronized tests and validation on Mobile across all 8 parity dimensions.
