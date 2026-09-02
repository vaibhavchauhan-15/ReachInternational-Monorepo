<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# AI Persistent Project Memory System Protocol

You are the dedicated AI software engineer for this repository.
Your job is **NOT** to rediscover the project every conversation.
Treat the repository as a long-term software project with persistent memory located in the `AI/` directory.

====================================
STEP 1 — READ PROJECT MEMORY & ALL RULES FIRST (MANDATORY EVERY TASK / SESSION)
====================================
Before planning, editing, analyzing, or executing anything in ANY session or task, every AI agent MUST read and strictly adhere to all rule files located in both:
- `C:\Users\vaibh\PROGRAMMING\PROJECTS\ReachInternational-Monorepo\AI\RULES`
- `C:\Users\vaibh\PROGRAMMING\PROJECTS\ReachInternational-Monorepo\.agents\rules`

Read these memory and rule files in order:
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
6. **Cross-Platform UI & Agent Rules (`.agents/rules/`)**:
   - `.agents/rules/mandatory_rules_reading_and_enforcement.md`
   - `.agents/rules/responsive_cross_platform_design.md`
   - `.agents/rules/global_responsive_design.md`
   - `.agents/rules/web_mobile_ui_consistency.md`

Never scan the entire repository unless these files explicitly instruct you to. All AI coding agents MUST strictly follow and enforce all rules in both `AI/RULES/` and `.agents/rules/` without exception on EVERY single task, session, and change.

====================================
STEP 2 — UNDERSTAND TASK & CATEGORY
====================================
Identify task category:
- Feature | Bug | Refactor | Performance | UI | Database | API | Animation | Testing | Security

Determine exactly which modules/features are required.

====================================
STEP 3 — READ ONLY REQUIRED FILES
====================================
Read only the source files necessary for this task.
Use `AI/FILE_INDEX.md`, `AI/ROUTING_MAP.md`, `AI/DATABASE.md`, `AI/API_MAP.md`, `AI/COMPONENT_MAP.md`, or relevant files in `AI/FEATURES/*.md` to locate them.
Never read unrelated codebase files.

====================================
STEP 4 — PLAN
====================================
Before writing code produce:
- Problem & Root Cause
- Files to edit & Dependencies
- Risk, Migration, Performance Impact
- Expected result

====================================
STEP 5 — IMPLEMENT
====================================
- Make the smallest possible change.
- Do NOT rewrite unrelated code.
- Reuse existing components (`components/ui/*`), hooks, utilities (`lib/*`), and styles.
- **STRICT UI/UX & RESPONSIVE RULE**: Every page, component, and module MUST strictly adhere to `DESIGN.md` (Vercel Geist System tokens: `#171717` ink, `#fafafa` canvas, `#ffffff` elevated, `#ebebeb` 1px hairline border, `#0070f3` link blue, Geist Sans/Mono fonts) and `AI/RULES/UI-UX.md` / `.agents/rules/responsive_cross_platform_design.md` / `.agents/rules/web_mobile_ui_consistency.md`.
- **MANDATORY WEB-TO-MOBILE CHANGE SYNCHRONIZATION**: Whenever ANY change, feature, component, style, theme, color, modal, drawer, page, module, status badge, form field, or workflow is added or modified in the Web App (`apps/web`), every AI agent **MUST MANDATORILY apply and synchronize the exact same change in the Mobile App (`apps/mobile`)** with mobile-compatible adaptations (touch cards, bottom sheets, scrollable filter strips, min 44px touch targets) in the same task. Web and Mobile MUST NEVER drift out of sync.
- **3-TIER VIEWPORT RESPONSIVENESS**: Every feature MUST be highly optimized for Mobile (≤640px touch card views `block sm:hidden`, scrollable filter strips `overflow-x-auto`, min 44px touch targets), Tablet (641px–1023px 2-col grids `grid-cols-1 sm:grid-cols-2`, adaptive modals), and Desktop (≥1024px high-density tables `hidden sm:block`, full multi-col grid, hover tooltips `<TooltipWrapper>`), maintaining identical visual identity, colors, and theme.
- Respect existing architecture.

====================================
STEP 6 — VERIFY
====================================
Before finishing, check:
- No TypeScript errors (`npx tsc --noEmit` if needed)
- No lint errors
- No duplicated logic or dead code
- No leftover `console.log`
- No breaking changes or security issues

====================================
STEP 7 — UPDATE MEMORY & DOCUMENTATION
====================================
After implementation, automatically update:
- `AI/STATE.md`
- `AI/CHANGELOG_AI.md`
- `AI/CURRENT_TASK.md`
- `README.md` (MUST update whenever adding or modifying features, operational modules, roles, or database schemas)
- Relevant feature file in `AI/FEATURES/*.md` if functionality changed.

Record: Date, Task completed, Files changed, New/Deleted components, API/DB changes, Known issues.

====================================
STEP 8 — CONTEXT OPTIMIZATION
====================================
When a future conversation starts:
- Never reread the whole repository.
- Use the `AI/` memory files first.
- Only read additional source files if required.

====================================
STEP 9 — IF MEMORY IS OUTDATED
====================================
If code differs from memory:
- Update the memory file.
- Trust the source code as ground truth.
- Never leave memory outdated.

====================================
STEP 10 — OUTPUT FORMAT
====================================
Always structure responses as:
1. Analysis
2. Plan
3. Files to edit
4. Implementation
5. Verification
6. Memory updated
7. Next recommendations
