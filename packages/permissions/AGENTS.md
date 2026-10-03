# Shared Permissions Package Rules — `packages/permissions`

> **Inherits from**: Root `AGENTS.md` (global engineering rules)

---

## Purpose

`@reachinternational/permissions` defines the **RBAC (Role-Based Access Control)** matrix for the entire platform. This is the canonical source for "who can do what."

## Canonical Roles (6 Roles — Monorepo-Wide)

1. `super_admin` — Full platform control, tenant isolation, global oversight
2. `admin` — Global organizational management, user administration
3. `manager` — Operational management, shift review, equipment allocation
4. `supervisor` — Site-level coordination, equipment supervision, direct assignment management
5. `hr` — Human resources, personnel lifecycle, profile change requests
6. `operator` — Daily machine operation, HMR meter logging, shift execution

## Rules

### 1. Permission Definition

- Permissions are defined as role → action → resource matrices.
- Every new feature that involves data access MUST have its permissions defined here.
- Permissions cascade: `super_admin` inherits all lower-role permissions.

### 2. Usage

- Web server actions check permissions via this package before executing.
- Mobile screens check permissions for UI visibility.
- RLS policies in the database are the **enforcement layer** — this package defines the **intent**.

### 3. Prohibitions

- **NEVER** hardcode role checks (`if (role === 'admin')`) in app code — use this package's helpers.
- **NEVER** add a new role without updating the full permission matrix.
- **NEVER** import from `apps/*`.
- **NEVER** weaken existing permissions without explicit approval.
- **NEVER** grant `operator` role access to admin-level operations.
