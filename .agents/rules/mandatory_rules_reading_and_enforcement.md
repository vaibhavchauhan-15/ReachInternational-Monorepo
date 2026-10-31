# AI Agent Mandatory Rule Reading & Strict Compliance Protocol

## 1. Non-Negotiable Core Principle
Before undertaking ANY action, planning, analysis, code creation, bug fixing, refactoring, database migration, or documentation modification in this workspace, **every AI agent MUST read and strictly adhere to all rule files** located in the following directories without exception:

1. **Authoritative Domain Rules**:
   `C:\Users\vaibh\PROGRAMMING\PROJECTS\ReachInternational-Monorepo\AI\RULES`
   - `ARCHITECTURE.md`
   - `AUTHENTICATION-AUTHORIZATION.md`
   - `DATA-PROTECTION-PRIVACY.md`
   - `DEPLOYMENT-DEVOPS-RELEASE.md`
   - `DESIGN-SYSTEM.md`
   - `OBSERVABILITY-MONITORING-LOGGING.md`
   - `PERFORMANCE.md`
   - `SECURITY.md`
   - `SEO-METADATA-DISCOVERABILITY.md`
   - `TESTING-QA.md`
   - `UI-UX.md`
   - `VALIDATION-ERROR-RESILIENCE.md`
   - `MULTI-AGENT-ENGINEERING-TEAM.md`
   - `WEB-MOBILE-PARITY.md`

2. **Cross-Platform UI & Agent System Rules**:
   `C:\Users\vaibh\PROGRAMMING\PROJECTS\ReachInternational-Monorepo\.agents\rules`
   - `mandatory_rules_reading_and_enforcement.md`
   - `multi_agent_engineering_team.md`
   - `responsive_cross_platform_design.md`
   - `global_responsive_design.md`
   - `web_mobile_ui_consistency.md`
   - `web_mobile_parity.md`
   - `native_backend_architecture.md`

3. **Cross-Platform & Native Agent Skills**:
   `C:\Users\vaibh\PROGRAMMING\PROJECTS\ReachInternational-Monorepo\.agents\skills`
   - `web-mobile-parity\SKILL.md` (100% Web & Mobile parity across UI/UX, behavior, responsiveness, design, layout, color, theme, typography)
   - `native-backend-architecture\SKILL.md` (Native mobile backend, TanStack Query, SecureStore, touch ergonomics)

4. **Authoritative Security Baseline (`security/`)**:
   `C:\Users\vaibh\PROGRAMMING\PROJECTS\ReachInternational-Monorepo\security`
   - `README.md` (Architecture, applicability matrix, & maintenance)
   - `SECURITY-RULES.md` (Mandatory non-negotiable security requirements)
   - `ATTACK-SURFACE.md` (Entry points, trust boundaries, & verification status)
   - `THREAT-MODEL.md` (STRIDE threat matrix, severity, & mitigations)
   - `SECRETS.md` (Secret storage, client/server boundaries, rotation)
   - `SECURITY-CHECKLIST.md` (Pre-implementation & pre-release checklists)
   - `AUTHENTICATION-AUTHORIZATION.md` (6 canonical roles, DAL, Server Actions, RLS)
   - `DATA-PRIVACY.md` (Sensitive data inventory, PII masking, retention)
   - `DEPENDENCY-SECURITY.md` (pnpm audit, lockfile locking, supply chain)
   - `INCIDENT-RESPONSE.md` (Containment, token revocation, & post-mortem)
   - `SECURITY-TESTING.md` (Test standards, negative tests, test accounts)

5. **Scoped Application Security Policies**:
   - Web: `apps/web/security/` (`README.md`, `SECURITY-RULES.md`, `ATTACK-SURFACE.md`, `THREAT-MODEL.md`, `SECURITY-CHECKLIST.md`)
   - Mobile: `apps/mobile/security/` (`README.md`, `SECURITY-RULES.md`, `ATTACK-SURFACE.md`, `THREAT-MODEL.md`, `SECURITY-CHECKLIST.md`)

6. **Centralized Testing Standards (`rules/testing/`)**:
   `C:\Users\vaibh\PROGRAMMING\PROJECTS\ReachInternational-Monorepo\rules\testing`
   - `README.md` (Testing index, navigation & rule hierarchy)
   - `00-testing-policy.md` (Mandatory global testing policy & quality gates)
   - `01-test-selection.md` (Change-impact analysis & test selection matrix)
   - `02-code-quality-types.md` (TypeScript strictness, linting, imports & dead code)
   - `03-unit-component-testing.md` (Unit tests, Zod schemas, business logic, components)
   - `04-integration-api-database.md` (Server Actions, DAL, Supabase, Postgres, RPC, RLS)
   - `05-web-e2e-testing.md` (Playwright web E2E, journeys, auth, data tables)
   - `06-ui-ux-responsive-visual.md` (3-tier viewports, Geist tokens, responsive tables)
   - `07-accessibility-testing.md` (WCAG 2.2 AA, axe-core, keyboard, contrast, ARIA)
   - `08-security-testing.md` (ASVS, RBAC, RLS, BOLA/IDOR, secrets, pnpm audit)
   - `09-performance-testing.md` (Web Vitals, bundles, query p95, Hermes, lists)
   - `10-native-mobile-testing.md` (Expo SDK 57, React Native, iOS/Android, Touch/Haptics)
   - `11-marketing-seo-testing.md` (Public marketing SEO, Open Graph, Sitemap, Robots)
   - `12-marketing-ai-crawler-llm.md` (AI crawlers, LLM discoverability, llms.txt, privacy)
   - `13-regression-release-testing.md` (Level 3 release acceptance, EAS, migration replay)
   - `14-test-reporting.md` (Test evidence format, PASS/FAIL/BLOCKED statuses)

---

## 2. Mandatory Session & Task Execution Flow

Every AI session, task, user prompt, and code edit MUST strictly adhere to the following 4-phase execution flow:

### Phase 1: Rule Ingestion & Alignment (Mandatory Step 0)
- Read all active rule documents in `AI/RULES/`, `.agents/rules/`, and `rules/testing/`.
- Cross-reference the user's prompt against domain rules to identify all applicable constraints (e.g., Security, UI/UX tokens, Database schemas, API structure, Accessibility, Testing).

### Phase 2: Strict Rule Compliance Planning
- Any proposed modification or plan MUST explicitly conform to all design system tokens (`DESIGN.md` / Geist tokens), architectural conventions, security protocols, and 3-tier viewport responsiveness (Mobile ≤640px, Tablet 641px–1023px, Desktop ≥1024px).
- Bypassing, overriding, or omitting any rule is strictly forbidden.

### Phase 3: Implementation with Zero-Tolerance Enforcement
- Implement changes making the minimum required edits while maintaining full backward compatibility and strict rule compliance.
- **Mandatory Web-to-Mobile Synchronization**: Whenever ANY feature, component, style, theme, color, modal, drawer, page, module, form field, status badge, or workflow is added or modified in the Web App (`apps/web`), the AI agent MUST MANDATORILY apply and synchronize the exact same change in the Mobile App (`apps/mobile`) with mobile-compatible adaptations in the same session/task.
- Never hardcode dynamic layout dimensions, never swallow errors silently, never introduce unverified state mutations, and never ignore responsive design specifications.

### Phase 4: Compliance Verification & Test Evidence Reporting
- Run automated verification (`pnpm typecheck`, linters, unit tests, mobile runners) as mandated by `rules/testing/`.
- Conclude task response with a complete Test Execution Report conforming to `rules/testing/14-test-reporting.md`.
- Automatically update persistent project memory (`AI/STATE.md`, `AI/CURRENT_TASK.md`, `AI/CHANGELOG_AI.md`, and `README.md` if features/schemas/roles changed).

---

## 3. Strict Audit & Enforcement Rules

1. **Zero Shortcuts**: AI agents must never assume rules are optional or skip reading rule files based on prior context.
2. **Ground Truth Consistency**: If code or documentation conflicts with rule files, the AI agent must resolve the ambiguity while upholding the strict standard defined in the authoritative rules.
3. **Continuous Enforcement**: All generated code, migrations, API routes, components, and documentation are subject to strict compliance auditing against `AI/RULES/` and `.agents/rules/`.

---

## 4. Strict Supabase Environment Isolation & Project Protection Policy

- **Organization**: `ljzofzlvjtfiqoffaaua`
- **Development Project (Target)**: `vlmxciuogczumumrwyot` (`Reach International Dev`)
- **Production Project (Protected)**: `dhbbgfzbyatzvqafnsqp` (`Reach International Production`) — **STRICTLY UNTOUCHED DURING DEVELOPMENT**.

### Binding Operational Rules:
1. **Never Touch Production in Development**: During feature development, debugging, testing, data seeding, SQL script execution, migration creation, or stored procedure testing, AI agents MUST **NEVER execute queries, mutations, DDL, or migrations on the Production project (`dhbbgfzbyatzvqafnsqp`)**.
2. **Exclusively Target Development**: All database mutations, schema migrations, seed scripts, SQL statements, and RPC tests MUST ONLY be executed against the Development project (`vlmxciuogczumumrwyot`).
3. **Mandatory MCP Argument Verification**: Any invocation of Supabase MCP tools (`execute_sql`, `apply_migration`, `deploy_edge_function`, etc.) MUST explicitly specify `project_id: "vlmxciuogczumumrwyot"`. Targeting `dhbbgfzbyatzvqafnsqp` during development tasks is strictly prohibited.

