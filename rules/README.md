# Monorepo Rules & Engineering Standards — ReachInternational

This directory houses the authoritative centralized engineering standards and quality gate policies for the ReachInternational monorepo.

## Structure

```text
rules/
└── testing/                               ← Centralized Monorepo Testing Standards (00–14)
    ├── README.md                          ← Testing index, navigation & rule hierarchy
    ├── 00-testing-policy.md               ← Mandatory global testing policy & quality gates
    ├── 01-test-selection.md               ← Change-impact analysis & test selection matrix
    ├── 02-code-quality-types.md           ← TypeScript, lint, formatting & dependency checks
    ├── 03-unit-component-testing.md       ← Unit, component & business logic tests
    ├── 04-integration-api-database.md     ← APIs, Server Actions, Supabase, Postgres, RPC, RLS
    ├── 05-web-e2e-testing.md              ← Web E2E, user journeys, auth & data tables
    ├── 06-ui-ux-responsive-visual.md      ← 3-tier viewports, Geist tokens & data tables
    ├── 07-accessibility-testing.md        ← WCAG 2.2 AA, keyboard, screen readers, ARIA
    ├── 08-security-testing.md             ← ASVS, negative authorization, RLS & secrets
    ├── 09-performance-testing.md          ← Web Vitals, bundles, query p95 & Hermes
    ├── 10-native-mobile-testing.md        ← Expo SDK 58, iOS/Android, SecureStore & Touch
    ├── 11-marketing-seo-testing.md        ← Public marketing SEO, Sitemap & Robots
    ├── 12-marketing-ai-crawler-llm.md     ← AI crawler policies & LLM discoverability
    ├── 13-regression-release-testing.md   ← Level 3 release acceptance battery
    └── 14-test-reporting.md               ← Standardized test evidence report format
```

## Related Rule Directories

- **Global Engineering Rules**: [`AGENTS.md`](../AGENTS.md)
- **Authoritative System Rules**: [`AI/RULES/`](../AI/RULES/) (15 core engineering rules)
- **Agent Behavioral Rules**: [`.agents/rules/`](../.agents/rules/) (Cross-platform parity, responsive design, team coordination)
- **Security Baseline**: [`security/`](../security/) (Attack surface, threat model, authentication/authorization)
- **Module Specific Rules**:
  - Web: [`apps/web/AGENTS.md`](../apps/web/AGENTS.md)
  - Mobile: [`apps/mobile/AGENTS.md`](../apps/mobile/AGENTS.md)
  - Database: [`supabase/AGENTS.md`](../supabase/AGENTS.md)
