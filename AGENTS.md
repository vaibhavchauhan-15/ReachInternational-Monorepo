<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# STRICT AI AGENT DEVELOPMENT RULES — GLOBAL

> **GOLDEN RULE: UNDERSTAND FIRST. PLAN SECOND. IMPLEMENT THIRD. VERIFY LAST.**
>
> **No code change is complete until the affected module and final build have been verified.**

---

## Rule Hierarchy

This project uses a **two-level rule system**. Module-specific rules extend — but never override — these global rules.

```
AGENTS.md                          ← YOU ARE HERE (global engineering rules)
│
├── apps/web/AGENTS.md             ← Next.js / Web-specific rules
├── apps/mobile/AGENTS.md          ← React Native / Expo-specific rules
├── packages/ui/AGENTS.md          ← Shared UI package rules
├── packages/eslint-config/AGENTS.md
├── packages/typescript-config/AGENTS.md
└── supabase/AGENTS.md             ← Database / RLS / RPC / migration rules
```

**When working in a module**, read BOTH this file AND the module's `AGENTS.md`.
**When a module rule conflicts with a global rule**, the STRICTER rule wins.

---

## 0. PRIMARY PRINCIPLE

**DO NOT MODIFY CODE BEFORE UNDERSTANDING THE EXISTING SYSTEM.**

Every task MUST follow this lifecycle — no step may be skipped unless explicitly marked **NOT APPLICABLE** with a reason:

```
REQUEST → CONTEXT → CODEBASE ANALYSIS → EXISTING-RULE ANALYSIS → IMPACT ANALYSIS
→ PLAN → IMPLEMENTATION → SELF-REVIEW → MODULE DEBUG → TEST → BUILD
→ FINAL VERIFICATION → MEMORY UPDATE → REPORT
```

---

## 1. AI PERSISTENT MEMORY PROTOCOL

You are the dedicated AI software engineer for this repository.
Your job is **NOT** to rediscover the project every conversation.
Treat the repository as a long-term software project with persistent memory in the `AI/` directory.

### STEP 1 — READ PROJECT MEMORY & ALL RULES FIRST (MANDATORY EVERY SESSION)

Before planning, editing, analyzing, or executing anything, every AI agent MUST read:

1. `AI/PROJECT_MEMORY.md`
2. `AI/STATE.md`
3. `AI/CURRENT_TASK.md`
4. `AI/CHANGELOG_AI.md`
5. **Authoritative Rules (`AI/RULES/`)**:
   - `AI/RULES/ARCHITECTURE.md`
   - `AI/RULES/DESIGN-SYSTEM.md`
   - `AI/RULES/UI-UX.md`
   - `AI/RULES/GLOBAL-RESPONSIVE-DESIGN.md`
   - `AI/RULES/PERFORMANCE.md`
   - `AI/RULES/SECURITY.md`
   - `AI/RULES/AUTHENTICATION-AUTHORIZATION.md`
   - `AI/RULES/DATA-PROTECTION-PRIVACY.md`
   - `AI/RULES/VALIDATION-ERROR-RESILIENCE.md`
   - `AI/RULES/TESTING-QA.md`
   - `AI/RULES/SEO-METADATA-DISCOVERABILITY.md`
   - `AI/RULES/OBSERVABILITY-MONITORING-LOGGING.md`
   - `AI/RULES/DEPLOYMENT-DEVOPS-RELEASE.md`
   - `AI/RULES/MULTI-AGENT-ENGINEERING-TEAM.md`
6. **Cross-Platform UI & Agent Rules (`.agents/rules/`)**:
   - `.agents/rules/mandatory_rules_reading_and_enforcement.md`
   - `.agents/rules/multi_agent_engineering_team.md`
   - `.agents/rules/responsive_cross_platform_design.md`
   - `.agents/rules/global_responsive_design.md`
   - `.agents/rules/web_mobile_ui_consistency.md`
7. **Module-specific `AGENTS.md`** for the affected module(s).

Never scan the entire repository unless these files explicitly instruct you to.

---

## 2. BEFORE DOING ANYTHING

For every user request:

### MUST:

1. Identify exactly what the user is asking.
2. Identify the affected module(s).
3. Identify whether the task affects:
   - Web (`apps/web`)
   - React Native / Mobile (`apps/mobile`)
   - Backend / Server Actions / API
   - Database / Supabase
   - Authentication
   - RBAC / permissions
   - UI / UX
   - Shared packages (`packages/*`)
   - Routing
   - Reports / exports
   - Performance
   - Analytics
   - Tests
   - Deployment
4. Search the existing codebase for related implementations.
5. Search for existing business rules and validations.
6. Search for existing components/functions/hooks/services before creating new ones.
7. Inspect related database tables, RPCs, triggers, indexes, RLS policies, and migrations when applicable.
8. Inspect both Web and Mobile implementations when the feature exists on both platforms.

### NEVER:

- Assume the architecture.
- Assume a file does not exist.
- Create a duplicate component/function when an existing implementation can be reused.
- Replace an existing architecture without proving why it is necessary.
- Start coding immediately after reading only one file.
- Invent business rules.
- Remove existing validation because it makes implementation easier.

---

## 3. EXISTING CODEBASE ANALYSIS GATE

Before implementation, the agent MUST answer internally:

### Architecture

- Where does this feature currently live?
- What is the current data flow?
- What layer owns the business logic?
- What layer owns validation?
- What layer owns authorization?
- What is shared between Web and Mobile?

### Existing Implementation — Find:

- Existing pages/screens
- Existing components
- Existing hooks
- Existing services
- Existing API/server actions
- Existing RPCs
- Existing database tables
- Existing types
- Existing validators
- Existing tests
- Existing utilities

### Existing Rules — Search for:

- RBAC rules
- RLS policies
- Database constraints
- PostgreSQL triggers
- RPC validation
- Frontend validation
- Backend validation
- Business calculations
- Routing rules
- Environment rules
- Naming conventions
- UI/design-system rules

**Existing rules have priority over creating new rules.**

If an existing rule conflicts with the requested change, **STOP and report the conflict** before implementation.

---

## 4. CHANGE IMPACT ANALYSIS

Before coding, determine:

### Directly affected files

Which files definitely need modification?

### Indirectly affected files

Which files may break because of the change?

### Database impact

Does this require: Schema change? Migration? RPC change? Trigger change? RLS change? Index? Constraint? Seed data? View/read model?

### Cross-platform impact

If Web and Mobile both implement this feature: **the agent MUST inspect both implementations.** Do not implement Web and assume Mobile is unaffected.

### Regression impact

Check whether the change can affect:
- Authentication, RBAC, existing CRUD
- Reports, exports, dashboard
- Assignments, attendance, payroll
- Existing APIs, existing mobile flows

---

## 5. IMPLEMENTATION PLAN GATE

Before modifying code, produce a concise implementation plan containing:

1. Objective
2. Existing implementation discovered
3. Files/modules to change
4. Database changes, if any
5. Business-rule changes, if any
6. Web changes
7. Mobile changes
8. Validation/security changes
9. Tests required
10. Build/verification commands

### Priority order: **REUSE → EXTEND → REFACTOR → CREATE**

Do not create a new abstraction when an existing one can safely handle the requirement.
Do not rewrite an entire module to solve a localized problem.

---

## 6. USER APPROVAL RULE

- If the task is clear and low-risk, proceed after analysis and plan.
- If the task involves **destructive database changes, architecture replacement, security/RBAC changes, production data, migrations with destructive operations, or major refactoring**: **STOP after the plan and request explicit approval.**

Never perform destructive production operations automatically.

---

## 7. IMPLEMENTATION RULES

### Architecture

- Follow existing project architecture, naming conventions, folder structure.
- Reuse existing utilities, components, types, validation, data-access patterns.

### Business Logic Enforcement

Business-critical logic MUST NOT exist only in the UI. Enforce at the appropriate authoritative layer:

**Database → Backend → Frontend**

- Frontend validation improves UX.
- Backend validation protects the API.
- Database constraints/RPCs protect data integrity.

Never rely only on frontend validation for critical business rules.

### UI/UX & Responsive

- **STRICT UI/UX & RESPONSIVE RULE**: Every page, component, and module MUST strictly adhere to `AI/RULES/DESIGN-SYSTEM.md` (Vercel Geist System tokens: `#171717` ink, `#fafafa` canvas, `#ffffff` elevated, `#ebebeb` 1px hairline border, `#0070f3` link blue, Geist Sans/Mono fonts) and `AI/RULES/UI-UX.md`.
- **3-TIER VIEWPORT RESPONSIVENESS**: Mobile (≤640px), Tablet (641–1023px), Desktop (≥1024px) — see `AI/RULES/GLOBAL-RESPONSIVE-DESIGN.md`.

### Web-to-Mobile Synchronization

**MANDATORY**: Whenever ANY change is added or modified in `apps/web`, every AI agent MUST apply and synchronize the same change in `apps/mobile` with mobile-compatible adaptations (touch cards, bottom sheets, scrollable filter strips, min 44px touch targets) in the same task. Web and Mobile MUST NEVER drift out of sync.

### Supabase Environment Isolation

- **Organization**: `ljzofzlvjtfiqoffaaua`
- **Development Project (Target)**: `vlmxciuogczumumrwyot` (`Reach International Dev`)
- **Production Project (PROTECTED)**: `dhbbgfzbyatzvqafnsqp` (`Reach International Production`) — **STRICTLY UNTOUCHED DURING DEVELOPMENT**
- Every AI agent MUST **ONLY USE the Development project** for migrations, SQL, seeding, or testing.
- When using Supabase MCP tools (`execute_sql`, `apply_migration`, etc.), agents MUST explicitly set and verify `project_id: "vlmxciuogczumumrwyot"`.

---

## 8. DATABASE RULES

See also: `supabase/AGENTS.md` for detailed database-specific rules.

### MUST inspect first:

Existing table, foreign keys, indexes, constraints, RLS policies, triggers, RPCs/functions, existing migrations, existing views/read models.

### MUST:

- Create a migration for schema changes.
- Keep migrations sequential and reproducible.
- Avoid duplicate migrations.
- Avoid destructive changes unless explicitly required.
- Add indexes only when justified by actual query patterns.
- Preserve RLS and authorization boundaries.
- Keep business-critical invariants database-enforced.

### NEVER:

- Modify production database when a migration should be used.
- Disable RLS to make a feature work.
- Put service-role credentials in client code.
- Duplicate database business logic unnecessarily.

---

## 9. WEB + MOBILE PARITY RULE

When a feature exists on Web and Mobile:

### MUST:

1. Inspect Web implementation.
2. Inspect Mobile implementation.
3. Identify shared business logic.
4. Keep behavior consistent.
5. Apply platform-specific UI only where necessary.

### Must remain consistent across platforms:

Business rules, permissions, validation, database behavior, API/RPC behavior, error semantics, data models.

UI may differ when required by the platform.

---

## 10. RBAC & SECURITY RULE

Every feature involving data or actions MUST verify:

- **Authentication**: Is the user authenticated?
- **Authorization**: Is the user allowed to perform this action?
- **Scope**: Can the user access all records? Assigned records? Own records only? Specific client/site/machine records?

Authorization must be enforced **server-side / database-side**. Never rely solely on hidden UI buttons.

If a role cannot perform an action, enforce it in: **UI + Server + Database** where applicable.

---

## 11. CODE QUALITY RULE

### MUST CHECK:

Type safety, null/undefined handling, loading states, error states, empty states, race conditions, duplicate requests/submissions, permission boundaries, mobile viewport behavior, accessibility/touch targets, performance, query efficiency, N+1 queries, unnecessary re-renders, dead code, duplicate logic.

### NEVER:

- Leave debug `console.log()` statements.
- Leave commented-out obsolete code.
- Add unnecessary dependencies or abstraction.
- Silence TypeScript errors with `any` or unsafe casts without justification.
- Disable lint/type checks to make a build pass.

---

## 12. AFTER IMPLEMENTATION: SELF-REVIEW

Before running tests, inspect every changed file. Ask:

- **Correctness**: Does the implementation satisfy the requested behavior?
- **Regression**: Could existing behavior break?
- **Architecture**: Did I violate an existing architectural pattern?
- **Security**: Can an unauthorized user bypass this?
- **Data integrity**: Can invalid/duplicate/overlapping data enter the database?
- **Performance**: Did I introduce unnecessary queries or renders?
- **Cross-platform**: Does the corresponding Mobile/Web implementation remain consistent?
- **Maintainability**: Did I create unnecessary duplication?

If a problem is found: **FIX IT BEFORE TESTING.**

---

## 13. MODULE DEBUGGING GATE

After implementation, test the **entire affected module**, not just the changed function.

For each affected workflow check:
- Happy path
- Invalid input / empty input / duplicate input / boundary values
- Unauthorized access
- Existing data / missing data
- Error response / network failure
- Refresh/reload behavior

---

## 14. TESTING GATE

### Minimum verification:

1. TypeScript / typecheck
2. Lint
3. Unit tests where applicable
4. Integration tests where applicable
5. Module-specific tests
6. RBAC/security tests where applicable
7. Database/migration verification where applicable
8. Web build
9. Mobile validation/build where applicable

### NEVER claim "Tested successfully" unless the relevant test/build actually completed successfully.

If a test cannot be run, explicitly state: **NOT RUN — reason**

---

## 15. BUILD VERIFICATION

Before completion:

- **Web**: Run official typecheck/lint/test/build commands.
- **Mobile**: Run official Expo/React Native typecheck/test/build validation.
- **Database**: Verify migration/schema/RLS/RPC changes where applicable.
- **Production Safety**: Ensure development changes are not accidentally connected to production data.

---

## 16. FAILURE RULE

If any verification fails: **DO NOT declare the task complete.**

Follow: **FAIL → READ ERROR → IDENTIFY ROOT CAUSE → FIX → RE-RUN TEST → RE-VERIFY**

Do not: ignore the error, hide the error, remove the test, disable the check, or change the expected behavior merely to make a test pass — unless the requirement itself has changed.

---

## 17. FINAL VERIFICATION GATE

A task is complete ONLY when:

- [ ] Existing code was analyzed
- [ ] Existing rules were analyzed
- [ ] Impact was analyzed
- [ ] Implementation plan was created
- [ ] Code was implemented
- [ ] Changed code was self-reviewed
- [ ] Affected module was debugged
- [ ] Relevant tests passed
- [ ] Typecheck passed
- [ ] Lint passed
- [ ] Web build passed (if affected)
- [ ] Mobile validation/build passed (if affected)
- [ ] Database verification passed (if affected)
- [ ] RBAC/security verified (if affected)
- [ ] No known regression remains
- [ ] No unnecessary code remains

Only then may the agent mark the task: **IMPLEMENTATION COMPLETE**

---

## 18. MEMORY UPDATE (MANDATORY POST-IMPLEMENTATION)

After implementation, automatically update:

- `AI/STATE.md`
- `AI/CHANGELOG_AI.md`
- `AI/CURRENT_TASK.md`
- `README.md` (when adding/modifying features, modules, roles, or database schemas)
- Relevant feature file in `AI/FEATURES/*.md` if functionality changed.

Record: Date, task completed, files changed, new/deleted components, API/DB changes, known issues.

### Context Optimization

- Never reread the whole repository in future conversations.
- Use the `AI/` memory files first; only read additional source files if required.
- If code differs from memory, update the memory file. Trust source code as ground truth.

---

## 19. FINAL RESPONSE FORMAT

Every completed task must report:

| Section | Content |
|---------|---------|
| **Changed** | What was changed |
| **Files** | Files created/modified |
| **Rules** | Existing rules reused/affected |
| **Database** | Schema/RPC/RLS/migration changes |
| **Validation** | Tests/typecheck/lint/build results |
| **Debugging** | Issues found and fixed |
| **Remaining** | Anything not verified or requiring manual testing |
| **Status** | `PASS` — Fully verified, `PARTIAL` — Implementation complete / verification incomplete, or `BLOCKED` — Cannot safely continue |

Never report `PASS` when verification is incomplete.

---

## 20. ABSOLUTE PROHIBITIONS

AI agents MUST NOT:

1. Code before inspecting existing implementation.
2. Ignore existing business rules.
3. Duplicate existing functionality unnecessarily.
4. Rewrite modules without justification.
5. Bypass RBAC/RLS.
6. Put critical business logic only in frontend code.
7. Modify production data casually.
8. Skip migrations for schema changes.
9. Claim tests passed without running them.
10. Hide or suppress errors to achieve a successful build.
11. Remove existing validations without understanding their purpose.
12. Break Web/Mobile behavioral parity.
13. Introduce dependencies without justification.
14. Use mock/fake data to hide implementation problems.
15. Mark incomplete work as complete.
16. Assume a change is isolated without checking dependencies.
17. Delete existing code before confirming it is unused.
18. Change unrelated modules during a focused task.
19. Make architectural decisions based only on the current file.
20. Optimize prematurely without identifying an actual bottleneck.

---

## 21. EMERGENCY STOP CONDITIONS

Immediately **STOP** implementation and report the issue if:

- Existing business rules conflict with the requested behavior.
- Required authorization is unclear.
- Production data may be affected.
- A destructive migration appears necessary.
- Existing architecture cannot safely support the requirement.
- Multiple modules have conflicting implementations.
- The requested behavior would violate database integrity.
- Required information is missing.
- Tests reveal an unrelated critical regression.
- A security boundary would need to be weakened.

**Do not silently choose an interpretation.**
