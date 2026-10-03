# Shared Types Package Rules — `packages/types`

> **Inherits from**: Root `AGENTS.md` (global engineering rules)

---

## Purpose

`@reachinternational/types` is the **single source of truth** for TypeScript type definitions shared across Web, Mobile, and backend.

## Rules

### 1. Type Ownership

- Database entity types (tables, views, RPCs) are defined here.
- Shared request/response types are defined here.
- Module-specific UI types stay in their respective app (`apps/web/types/`, `apps/mobile/types/`).

### 2. Naming Conventions

- Database row types: `[Entity]Row` (e.g., `UserRow`, `MachineRow`)
- Insert types: `[Entity]Insert`
- Update types: `[Entity]Update`
- RPC parameter types: `[RpcName]Params`
- RPC return types: `[RpcName]Result`
- Enums: PascalCase (e.g., `UserRole`, `ShiftStatus`)

### 3. Export Rules

- All types MUST be exported through the canonical barrel `index.ts`.
- Deep imports into package internals are **prohibited**.
- Keep the barrel organized by domain (users, machines, clients, operations, etc.).

### 4. Synchronization

- When a database schema changes, update the corresponding types here.
- When adding a new RPC, add its parameter and return types here.
- Types must match the actual database schema — run `generate types` if available.

### 5. Prohibitions

- **NEVER** define runtime logic in this package — types only.
- **NEVER** import from `apps/*` — packages flow upward.
- **NEVER** use `any` — prefer `unknown` with type guards.
- **NEVER** duplicate a type that already exists.
