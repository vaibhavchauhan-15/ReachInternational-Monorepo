# Repository-Wide Security Documentation Architecture

> **AUTHORITATIVE SECURITY DIRECTORY — REACHINTERNATIONAL MONOREPO**  
> *This directory forms the central repository of security policies, threat models, attack surface mappings, secrets handling protocols, compliance checklists, and incident response procedures for ReachInternational.*

---

## 1. Documentation Structure & Responsibility

The security documentation is organized into a two-tier hierarchy: **Monorepo Baseline Policies** (this directory) and **Platform-Scoped Security Policies** (`apps/web/security/` and `apps/mobile/security/`).

```text
repository-root/
├── SECURITY.md                             # Public vulnerability disclosure policy
├── AGENTS.md                               # Global engineering rules (Security Lifecycle Gate)
├── security/                               # [TIER 1] MONOREPO BASELINE POLICIES
│   ├── README.md                           # This document: navigation, lifecycle, & maintenance
│   ├── SECURITY-RULES.md                   # Mandatory non-negotiable security requirements
│   ├── ATTACK-SURFACE.md                   # Monorepo entry points, trust boundaries, & verification
│   ├── THREAT-MODEL.md                     # STRIDE threat model, severity matrix, & mitigations
│   ├── SECRETS.md                          # Secret storage, client/server boundaries, rotation
│   ├── SECURITY-CHECKLIST.md               # Actionable pre-implementation & pre-release checklists
│   ├── AUTHENTICATION-AUTHORIZATION.md     # 6 canonical roles, DAL, Server Actions, RLS, PKCE
│   ├── DATA-PRIVACY.md                     # Sensitive data inventory, PII masking, retention
│   ├── DEPENDENCY-SECURITY.md              # pnpm audit, lockfile locking, supply chain controls
│   ├── INCIDENT-RESPONSE.md                # Containment, token revocation, & post-mortem steps
│   └── SECURITY-TESTING.md                 # Security test standards, negative test cases, test accounts
├── apps/
│   ├── web/security/                       # [TIER 2] WEB-SPECIFIC POLICIES (Next.js 16 App Router)
│   │   ├── README.md                       # Web security scope & architecture references
│   │   ├── ATTACK-SURFACE.md               # Next.js routes, Server Actions, edge proxy, CSRF/XSS
│   │   ├── THREAT-MODEL.md                 # Web STRIDE threats, BOLA, SSRF, cache leakage
│   │   ├── SECURITY-CHECKLIST.md           # Web-specific actionable verification checklist
│   │   └── SECURITY-RULES.md               # Web mandatory rules referencing root
│   └── mobile/security/                    # [TIER 2] MOBILE-SPECIFIC POLICIES (Expo SDK 57)
│       ├── README.md                       # Mobile security scope & architecture references
│       ├── ATTACK-SURFACE.md               # Deep links, SecureStore, NetInfo, offline queue
│       ├── THREAT-MODEL.md                 # Mobile STRIDE threats, device tampering, local queue
│       ├── SECURITY-CHECKLIST.md           # Mobile-specific actionable verification checklist
│       └── SECURITY-RULES.md               # Mobile mandatory rules referencing root
```

---

## 2. Applicability Matrix: When to Consult Each Document

Every developer and AI agent MUST consult the relevant security documents based on the task type:

| Task Type | Mandatory Baseline Documents | Platform-Specific Documents |
|---|---|---|
| **Feature Development** | [`SECURITY-RULES.md`](./SECURITY-RULES.md), [`AUTHENTICATION-AUTHORIZATION.md`](./AUTHENTICATION-AUTHORIZATION.md), [`SECURITY-CHECKLIST.md`](./SECURITY-CHECKLIST.md) | Web: [`apps/web/security/SECURITY-RULES.md`](../apps/web/security/SECURITY-RULES.md)<br>Mobile: [`apps/mobile/security/SECURITY-RULES.md`](../apps/mobile/security/SECURITY-RULES.md) |
| **Bug Fixes & Refactoring** | [`SECURITY-RULES.md`](./SECURITY-RULES.md), [`ATTACK-SURFACE.md`](./ATTACK-SURFACE.md) | Web/Mobile matching [`SECURITY-CHECKLIST.md`](./SECURITY-CHECKLIST.md) |
| **Authentication & RBAC** | [`AUTHENTICATION-AUTHORIZATION.md`](./AUTHENTICATION-AUTHORIZATION.md), [`SECURITY-RULES.md`](./SECURITY-RULES.md) | Web: [`apps/web/security/THREAT-MODEL.md`](../apps/web/security/THREAT-MODEL.md)<br>Mobile: [`apps/mobile/security/THREAT-MODEL.md`](../apps/mobile/security/THREAT-MODEL.md) |
| **Database & Migrations** | [`AUTHENTICATION-AUTHORIZATION.md`](./AUTHENTICATION-AUTHORIZATION.md), [`DATA-PRIVACY.md`](./DATA-PRIVACY.md), `supabase/AGENTS.md` | Dev target `vlmxciuogczumumrwyot` verification |
| **API & Server Actions** | [`ATTACK-SURFACE.md`](./ATTACK-SURFACE.md), [`SECURITY-RULES.md`](./SECURITY-RULES.md), [`DATA-PRIVACY.md`](./DATA-PRIVACY.md) | Web: [`apps/web/security/ATTACK-SURFACE.md`](../apps/web/security/ATTACK-SURFACE.md) |
| **Secret & Config Changes**| [`SECRETS.md`](./SECRETS.md) | [`apps/mobile/security/SECURITY-RULES.md`](../apps/mobile/security/SECURITY-RULES.md) |
| **Dependency Updates** | [`DEPENDENCY-SECURITY.md`](./DEPENDENCY-SECURITY.md) | CI workflow verification (`.github/workflows/ci.yml`) |
| **Pre-Release & QA** | [`SECURITY-CHECKLIST.md`](./SECURITY-CHECKLIST.md), [`SECURITY-TESTING.md`](./SECURITY-TESTING.md) | Web/Mobile [`SECURITY-CHECKLIST.md`](./SECURITY-CHECKLIST.md) |
| **Incident Response** | [`INCIDENT-RESPONSE.md`](./INCIDENT-RESPONSE.md), [`SECRETS.md`](./SECRETS.md) | Triage and credential revocation |

---

## 3. How AI Agents Must Use These Documents

AI agents operating in this repository are bound by the **Primary Security Principle**:
> **NO SECURITY CONTROL MAY BE ASSUMED, BYPASSED, OR SUPPRESSED.**

Before beginning any code modification, every AI agent must execute this three-phase workflow:

### Phase A: Pre-Change Discovery & Threat Assessment
1. Identify the target surface (Web, Mobile, Shared Package, Database).
2. Read the baseline [`SECURITY-RULES.md`](./SECURITY-RULES.md) and the scoped app security file.
3. Check the affected boundaries against [`ATTACK-SURFACE.md`](./ATTACK-SURFACE.md) and [`THREAT-MODEL.md`](./THREAT-MODEL.md).
4. Review applicable items in [`SECURITY-CHECKLIST.md`](./SECURITY-CHECKLIST.md).

### Phase B: Implementation Discipline
1. Apply **deny-by-default** and **least privilege** authorization.
2. Enforce validation using shared Zod schemas (`@reachinternational/validation`).
3. Ensure server-side validation and database-level RLS policies back every UI constraint.
4. Keep server secrets out of client code.
5. Record structured audit logs for elevated operations via `logAudit()`.

### Phase C: Verification & Reporting
1. Run static type checking (`pnpm typecheck`).
2. Run targeted test suites (permissions, mobile tests, typography guards).
3. Verify zero unhandled exceptions, no secret leakage in diff, and no suppressed security checks.
4. Report executed checks, skipped checks, and unresolved risks using the standard table format in `AGENTS.md`.

---

## 4. Cross-Platform Links

- **Web Security Documentation**: [`apps/web/security/README.md`](../apps/web/security/README.md)
  - Next.js 16.2 App Router architecture, React Server Components (RSC), Data Access Layer (DAL), Server Actions, Turbopack Edge Proxy (`proxy.ts`), and HTTP-only cookie session handling.
- **Native Mobile Security Documentation**: [`apps/mobile/security/README.md`](../apps/mobile/security/README.md)
  - Expo SDK 57 / React Native 0.86 architecture, `expo-secure-store` hardware keystore, offline queue resilience, deep-link route sanitization, and Android permission stripping.

---

## 5. Maintenance & Documentation Update Protocol

Security documentation MUST evolve synchronously with the codebase. Whenever any of the following events occur, the engineer or AI agent implementing the change MUST update the documentation in the same PR/commit:

1. **New Route, Endpoint, or Server Action Added**: Update [`ATTACK-SURFACE.md`](./ATTACK-SURFACE.md) and the corresponding app attack surface document.
2. **New Role or Permission Added**: Update [`AUTHENTICATION-AUTHORIZATION.md`](./AUTHENTICATION-AUTHORIZATION.md), `@reachinternational/permissions`, and `packages/types`.
3. **Database Schema or RLS Policy Modified**: Update [`AUTHENTICATION-AUTHORIZATION.md`](./AUTHENTICATION-AUTHORIZATION.md) and `AI/DATABASE.md`.
4. **New Secret or External API Introduced**: Update [`SECRETS.md`](./SECRETS.md) with classification and rotation procedure.
5. **New Sensitive Data Field Collected**: Update [`DATA-PRIVACY.md`](./DATA-PRIVACY.md).
