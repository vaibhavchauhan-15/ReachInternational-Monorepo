# AI Agent Mandatory Rule Reading & Strict Compliance Protocol

## 1. Non-Negotiable Core Principle
Before undertaking ANY action, planning, analysis, code creation, bug fixing, refactoring, database migration, or documentation modification in this workspace, **every AI agent MUST read and strictly adhere to all rule files** located in the following directories without exception:

1. **Authoritative Domain Rules**:
   `AI/RULES/`
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
   `.agents/rules/`
   - `mandatory_rules_reading_and_enforcement.md`
   - `multi_agent_engineering_team.md`
   - `responsive_cross_platform_design.md`
   - `global_responsive_design.md`
   - `web_mobile_ui_consistency.md`
   - `web_mobile_parity.md`
   - `native_backend_architecture.md`

3. **Cross-Platform & Native Agent Skills**:
   `.agents/skills/`
   - `web-mobile-parity/SKILL.md` (100% Web & Mobile parity across UI/UX, behavior, responsiveness, design, layout, color, theme, typography)
   - `native-backend-architecture/SKILL.md` (Native mobile backend, TanStack Query, SecureStore, touch ergonomics)

4. **Authoritative Security Baseline (`security/`)**:
   `security/`
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
   `rules/testing/`
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

## 4. Strict Supabase Environment Isolation & Production Database Access Policy

- **Organization**: `ljzofzlvjtfiqoffaaua`
- **Development Project (Default Target)**: `vlmxciuogczumumrwyot` (`Reach International Dev`)
- **Production Project (Protected)**: `dhbbgfzbyatzvqafnsqp` (`Reach International Production`)

### Binding Operational Rules:
1. **Read-Only Operations Allowed Anytime on Production**: AI agents can ALWAYS execute READ-ONLY operations (e.g. `SELECT` queries, inspecting schemas, tables, columns, constraints, foreign keys, RPC definitions, triggers, RLS policies, migrations, and querying logs via Supabase CLI or MCP) in the Production DB (`dhbbgfzbyatzvqafnsqp`) at ANY TIME without restriction.
2. **Production Writes Require Explicit User Instruction**: AI agents can ONLY perform WRITE operations (e.g. `INSERT`, `UPDATE`, `DELETE`, `ALTER`, `DROP`, `CREATE`, applying migrations, deploying edge functions, DDL/DML mutations, seeding/backfills) in the Production DB (`dhbbgfzbyatzvqafnsqp`) via Supabase CLI or MCP **WHEN THE USER EXPLICITLY INSTRUCTS TO MAKE CHANGES OR MODIFY SOMETHING IN THE PRODUCTION DB**. Without explicit user instruction, write operations to production are strictly forbidden.
3. **Development is Default for Writes & Testing**: For normal feature development, testing, schema experimentation, local/dev migrations, and seeding, all write operations and migrations MUST default to the Development project (`vlmxciuogczumumrwyot`).
4. **Mandatory MCP Argument Verification**: Any invocation of Supabase MCP tools (`execute_sql`, `apply_migration`, `deploy_edge_function`, etc.) MUST explicitly verify the `project_id`. Default to `"vlmxciuogczumumrwyot"` for development writes and tests; target `"dhbbgfzbyatzvqafnsqp"` for read-only inspection anytime, or for write operations ONLY when explicitly requested by the user.

---

## 5. Strict AI Agent Policy: Mandatory Rules, Skills & Documentation Compliance

### 5.1 Absolute Requirement
Every AI agent working in this monorepo MUST read and follow all relevant project instructions, rules, regulations, engineering standards, and installed skills BEFORE performing any task.
This applies to:
- Every new feature.
- Every bug fix.
- Every UI/UX modification.
- Every frontend or backend change.
- Every database modification.
- Every refactoring task.
- Every performance optimization.
- Every testing task.
- Every deployment or configuration change.
- Every investigation and code review.
**NO TASK IS EXEMPT.** Never start modifying code before completing the required instruction and skill discovery process.

### 5.2 Mandatory Root-Level Instruction Discovery
At the beginning of EVERY task:
1. Locate and read the root `AGENTS.md`.
2. Identify every applicable `AGENTS.md`, `CLAUDE.md`, `GEMINI.md`, `README.md`, contribution guide, architecture document, and other project-specific instruction file.
3. Read the instructions applicable to the directories and packages being modified.
4. Inspect the monorepo structure to identify relevant applications and shared packages.
5. Identify relevant installed AI agent skills and read their complete instructions.
6. Identify relevant coding standards, security policies, testing requirements, and development conventions.

### 5.3 Mandatory Web and Native Rule Discovery
**CRITICAL: EVERY AGENT MUST READ BOTH WEB AND NATIVE APPLICATION RULES BEFORE STARTING A TASK.**
Even when the requested task appears to affect only one platform, inspect the instructions for both platforms:
- Root-level monorepo instructions (`AGENTS.md`)
- Web application instructions (`apps/web/AGENTS.md`)
- Native mobile application instructions (`apps/mobile/AGENTS.md`)
- Backend/database instructions (`supabase/AGENTS.md`)
- Shared packages instructions (`packages/*/AGENTS.md`)
- Relevant feature-specific instructions
Do not skip native instructions because a task is related to web. Do not skip web instructions because a task is related to native. Do not assume instructions are identical.

### 5.4 Mandatory Skills Discovery and Execution
Before implementation:
1. Discover all available AI agent skills.
2. Determine which skills are relevant to the requested task.
3. Read the complete instructions of each relevant skill.
4. Read any required reference documentation bundled with those skills.
5. Follow the prescribed workflow, tools, conventions, and restrictions.

### 5.5 Instruction Priority and Conflict Resolution
1. System and platform safety requirements.
2. Root-level monorepo engineering policies.
3. Applicable application-specific instructions.
4. Relevant package and feature-specific instructions.
5. Relevant installed skill instructions.
6. Existing project architecture and coding conventions.
7. Task-specific user requirements.
If instructions conflict, follow higher-priority requirements and explain unresolved conflicts before implementation. Never invent rules or assume undocumented permissions.

### 5.6 Codebase Understanding Before Implementation
Reading instructions alone is not sufficient. Before editing code:
- Inspect the relevant directory structure.
- Read the existing implementation.
- Inspect corresponding web and native implementations.
- Understand existing API contracts and backend behavior.
- Inspect database schemas and migrations where relevant.
- Identify reusable components and shared utilities.
- Review related tests and logs where available.
- Determine whether the requested change is necessary.
- Identify potential regressions and dependencies.

### 5.7 Cross-Platform Compliance
Follow the mandatory Web & Native App Parity policy across all 8 dimensions (UI/UX, Behavior, Responsiveness, Design, Layout, Color, Theme, Typography). A task must not be marked complete until both platforms have been inspected and their impact has been addressed or justified.

### 5.8 No Shortcuts or Instruction Bypassing
Strictly prohibited:
- Skipping `AGENTS.md` because the task appears simple.
- Reading only the web instructions or only the native instructions.
- Ignoring installed skills.
- Assuming another AI agent has already read the rules.
- Making changes before understanding existing code.
- Ignoring applicable security or testing policies.
- Bypassing existing architecture or conventions without justification.
- Claiming successful verification without running the checks.
- Declaring a task complete while relevant requirements remain unaddressed.

### 5.9 Mandatory Task Execution Checklist
Before implementation:
- [x] Root `AGENTS.md` read.
- [x] All applicable instruction files discovered.
- [x] Web application rules read.
- [x] Native application rules read.
- [x] Backend and shared-package rules read where applicable.
- [x] Relevant installed skills discovered.
- [x] Complete instructions of relevant skills read.
- [x] Required reference documentation reviewed.
- [x] Existing codebase inspected.
- [x] Cross-platform impact evaluated.
- [x] Necessity of the requested changes established.
- [x] Implementation plan prepared.
Before completion:
- [x] All applicable instructions followed.
- [x] Both platforms inspected.
- [x] Required cross-platform changes implemented.
- [x] Relevant tests executed.
- [x] Unexecuted checks and remaining issues disclosed.

### 5.10 Required Final Response Structure
At the end of every task, provide:
1. **Instructions Read**: List the root, web, native, and other relevant instruction files.
2. **Skills Used**: List the relevant skills actually read and applied.
3. **Codebase Audit**: Explain what existing implementations were inspected.
4. **Changes Made**: Summarize frontend, native, backend, and database changes.
5. **Cross-Platform Verification**: Explain whether web and native remain consistent.
6. **Testing**: List checks executed and their actual results.
7. **Exceptions**: Explain any skipped platform changes, unavailable skills, missing instructions, or unexecuted checks.

### 5.11 Final Non-Negotiable Directive
READ RULES → READ SKILLS → UNDERSTAND ARCHITECTURE → AUDIT BOTH PLATFORMS → PLAN → IMPLEMENT → TEST → VERIFY → REPORT.
An AI agent is not authorized to start implementation until it has completed the applicable instruction and skill discovery process.


