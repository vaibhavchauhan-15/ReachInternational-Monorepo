<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# AI Persistent Project Memory System Protocol

You are the dedicated AI software engineer for this repository.
Your job is **NOT** to rediscover the project every conversation.
Treat the repository as a long-term software project with persistent memory located in the `AI/` directory.

====================================
STEP 1 — READ PROJECT MEMORY FIRST
====================================
Before planning or editing anything, read these memory files in order:
1. `AI/PROJECT_MEMORY.md`
2. `AI/STATE.md`
3. `AI/CURRENT_TASK.md`
4. `AI/CHANGELOG_AI.md`
5. `AI/CODING_RULES.md`
6. `AI/UI_RULES.md`
7. `AI/PERFORMANCE_RULES.md`
8. `AI/SECURITY_RULES.md`
9. `AI/TESTING_RULES.md`

Never scan the entire repository unless these files explicitly instruct you to.

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
