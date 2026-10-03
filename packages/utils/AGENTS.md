# Shared Utilities Package Rules — `packages/utils`

> **Inherits from**: Root `AGENTS.md` (global engineering rules)

---

## Purpose

`@reachinternational/utils` provides **pure utility functions** shared across Web and Mobile: formatting, date handling, address utilities, calculations, etc.

## Rules

### 1. Function Requirements

- All functions must be **pure** (no side effects, no database calls, no API calls).
- All functions must be **fully typed** (no `any`).
- All functions must handle edge cases (null, undefined, empty strings).

### 2. Existing Utilities — Check First

- `formatDate()` — deterministic date formatting
- `formatCurrency()` — INR currency formatting
- Address utilities (`@reachinternational/utils/address`)
- String utilities (truncation, capitalization)
- Number utilities (rounding, percentage calculation)

### 3. Export Rules

- Export through canonical barrel `index.ts`.
- Sub-path exports (e.g., `@reachinternational/utils/address`) are allowed for domain-specific utilities.

### 4. Prohibitions

- **NEVER** import from `apps/*`.
- **NEVER** include side effects (API calls, database queries, logging).
- **NEVER** duplicate a utility that already exists — extend it.
- **NEVER** add platform-specific code (React Native or Next.js specific).
