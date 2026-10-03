# Shared Validation Package Rules — `packages/validation`

> **Inherits from**: Root `AGENTS.md` (global engineering rules)

---

## Purpose

`@reachinternational/validation` provides **Zod v4 schemas** shared across Web (server actions) and Mobile (form validation). These schemas are the **single source of truth** for input validation.

## Rules

### 1. Schema Ownership

- Form validation schemas are defined here.
- Server action input schemas are defined here.
- API request/response schemas are defined here.
- Database-specific constraints (CHECK, NOT NULL) live in migrations — schemas here validate *before* the database.

### 2. Naming Conventions

- Schemas: `[entity][Action]Schema` (e.g., `userCreateSchema`, `machineUpdateSchema`)
- Inferred types: `[Entity][Action]Input` (e.g., `UserCreateInput`)

### 3. Validation Layers

This package is the **middle layer** of the 3-layer validation strategy:

```
Frontend (UX) → @reachinternational/validation (API protection) → Database (integrity)
```

- Schemas must be strict enough to catch invalid input.
- Schemas must not be so strict that they duplicate database constraints unnecessarily.
- Custom error messages should be user-friendly.

### 4. Export Rules

- All schemas MUST be exported through the canonical barrel `index.ts`.
- Deep imports are **prohibited**.

### 5. Prohibitions

- **NEVER** import from `apps/*`.
- **NEVER** include database queries or side effects.
- **NEVER** duplicate a schema that already exists — extend it.
- **NEVER** remove validation rules without understanding the business reason.
