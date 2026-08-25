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

2. **Cross-Platform UI & Agent System Rules**:
   `C:\Users\vaibh\PROGRAMMING\PROJECTS\ReachInternational-Monorepo\.agents\rules`
   - `responsive_cross_platform_design.md`
   - `web_mobile_ui_consistency.md`
   - `mandatory_rules_reading_and_enforcement.md`

---

## 2. Mandatory Session & Task Execution Flow

Every AI session, task, user prompt, and code edit MUST strictly adhere to the following 4-phase execution flow:

### Phase 1: Rule Ingestion & Alignment (Mandatory Step 0)
- Read all active rule documents in `AI/RULES/` and `.agents/rules/`.
- Cross-reference the user's prompt against domain rules to identify all applicable constraints (e.g., Security, UI/UX tokens, Database schemas, API structure, Accessibility, Testing).

### Phase 2: Strict Rule Compliance Planning
- Any proposed modification or plan MUST explicitly conform to all design system tokens (`DESIGN.md` / Geist tokens), architectural conventions, security protocols, and 3-tier viewport responsiveness (Mobile ≤640px, Tablet 641px–1023px, Desktop ≥1024px).
- Bypassing, overriding, or omitting any rule is strictly forbidden.

### Phase 3: Implementation with Zero-Tolerance Enforcement
- Implement changes making the minimum required edits while maintaining full backward compatibility and strict rule compliance.
- **Mandatory Web-to-Mobile Synchronization**: Whenever ANY feature, component, style, theme, color, modal, drawer, page, module, form field, status badge, or workflow is added or modified in the Web App (`apps/web`), the AI agent MUST MANDATORILY apply and synchronize the exact same change in the Mobile App (`apps/mobile`) with mobile-compatible adaptations in the same session/task.
- Never hardcode dynamic layout dimensions, never swallow errors silently, never introduce unverified state mutations, and never ignore responsive design specifications.

### Phase 4: Compliance Verification & Memory Updates
- Run automated verification (`tsc`, linters, tests) as required by `TESTING-QA.md`.
- Automatically update persistent project memory (`AI/STATE.md`, `AI/CURRENT_TASK.md`, `AI/CHANGELOG_AI.md`, and `README.md` if features/schemas/roles changed).

---

## 3. Strict Audit & Enforcement Rules

1. **Zero Shortcuts**: AI agents must never assume rules are optional or skip reading rule files based on prior context.
2. **Ground Truth Consistency**: If code or documentation conflicts with rule files, the AI agent must resolve the ambiguity while upholding the strict standard defined in the authoritative rules.
3. **Continuous Enforcement**: All generated code, migrations, API routes, components, and documentation are subject to strict compliance auditing against `AI/RULES/` and `.agents/rules/`.
