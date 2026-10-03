# Shared Config Package Rules — `packages/config`

> **Inherits from**: Root `AGENTS.md` (global engineering rules)

---

## Purpose

`@reachinternational/config` provides shared TypeScript, ESLint, and Tailwind configurations for consistent tooling across the monorepo.

## Rules

- Config changes affect the **entire monorepo** — verify all workspace projects after modification.
- **NEVER** loosen TypeScript strict mode settings.
- **NEVER** disable ESLint rules to make code pass — fix the code.
- **NEVER** import from `apps/*`.
- After config changes, run `pnpm typecheck` across all workspaces.
