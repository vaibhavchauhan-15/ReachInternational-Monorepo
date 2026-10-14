# Security Policy — ReachInternational

> **Monorepo-Wide Security Policy & Vulnerability Reporting**  
> *ReachInternational is an enterprise machinery fleet and operations management platform. We take the security of our infrastructure, operational telemetry, employee PII, and customer data seriously.*

---

## 1. Supported Versions

Security updates and patches are actively applied only to the primary development and production branches of this monorepo:

| Component | Target Runtime / Branch | Supported | Notes |
|---|---|---|---|
| **Web Application (`apps/web`)** | Next.js 16.2.x / Node.js 22 LTS | :white_check_mark: | Deployed to Vercel production |
| **Native Mobile (`apps/mobile`)** | Expo SDK 57 / React Native 0.86 | :white_check_mark: | Android APK / EAS Build channels |
| **Shared Packages (`packages/*`)** | TypeScript 5 Strict Mode | :white_check_mark: | Monorepo internal workspace |
| **Database & Auth (`supabase/`)** | Supabase Managed PostgreSQL | :white_check_mark: | RLS enabled across all migrations |

---

## 2. Reporting a Vulnerability

If you discover a security vulnerability within ReachInternational, **please do NOT create a public GitHub issue**.

### Reporting Process:
1. **Email**: Send a detailed advisory to the security team at **`security@reachinternational.co.in`**.
2. **Details to Include**:
   - Description of the vulnerability and attack vector.
   - Affected component(s) (`apps/web`, `apps/mobile`, `packages/*`, or `supabase`).
   - Step-by-step reproduction instructions or proof of concept (PoC).
   - Expected vs. actual behavior and potential security impact.
   - Suggested remediation or patch, if available.
3. **Acknowledgment & Response**:
   - Initial triage acknowledgment within **48 hours**.
   - Status update with planned remediation timeline within **5 business days**.
   - Notification when the vulnerability is patched.

---

## 3. Authoritative Security Architecture & Documentation

All engineering staff and automated AI coding agents MUST consult and adhere to the canonical security documentation tree:

```text
repository-root/
├── SECURITY.md                        # This document (vulnerability reporting & policy)
├── AGENTS.md                          # Mandatory agent engineering rules (includes Security Gate)
├── security/                          # Repository-Wide Baseline Security Documentation
│   ├── README.md                      # Security documentation architecture & usage guide
│   ├── SECURITY-RULES.md              # Mandatory non-negotiable security requirements
│   ├── ATTACK-SURFACE.md              # Monorepo entry points, trust boundaries, & verification
│   ├── THREAT-MODEL.md                # STRIDE threat model, severity matrix, & mitigations
│   ├── SECRETS.md                     # Secrets management, client vs server isolation
│   ├── SECURITY-CHECKLIST.md          # Pre-implementation, implementation, release checklists
│   ├── AUTHENTICATION-AUTHORIZATION.md# 6 canonical roles, DAL, Server Actions, RLS
│   ├── DATA-PRIVACY.md                # Sensitive data inventory, PII masking, retention
│   ├── DEPENDENCY-SECURITY.md         # pnpm audit, lockfile locking, supply chain security
│   ├── INCIDENT-RESPONSE.md           # Triage, containment, revocation, & post-mortem steps
│   └── SECURITY-TESTING.md            # Security test standards, negative tests, test accounts
├── apps/
│   ├── web/security/                  # Next.js Web-Specific Security Documentation
│   │   ├── README.md                  # Web security scope & architecture
│   │   ├── ATTACK-SURFACE.md          # Routes, Server Actions, proxy, CSRF/XSS, headers
│   │   ├── THREAT-MODEL.md            # Web-specific STRIDE threats & mitigations
│   │   ├── SECURITY-CHECKLIST.md      # Web-specific pre-release & PR checklist
│   │   └── SECURITY-RULES.md          # Web-specific mandatory rules referencing root
│   └── mobile/security/               # Expo React Native Mobile-Specific Security Documentation
│       ├── README.md                  # Mobile security scope & architecture
│       ├── ATTACK-SURFACE.md          # Deep links, SecureStore, NetInfo, offline queue
│       ├── THREAT-MODEL.md            # Mobile-specific STRIDE threats & device security
│       ├── SECURITY-CHECKLIST.md      # Mobile-specific pre-release & EAS checklist
│       └── SECURITY-RULES.md          # Mobile-specific mandatory rules referencing root
```

---

## 4. Fundamental Security Guarantees

1. **Deny-by-Default Access Control**: Every server action, API route, and database query denies access unless authentication and explicit role permissions are verified.
2. **Hardware-Backed Mobile Secrets**: Mobile auth tokens are stored exclusively in `expo-secure-store` backed by Android Keystore / iOS Keychain. Unencrypted `AsyncStorage` token storage is strictly prohibited.
3. **Server-Only Privileged Execution**: Service-role keys (`SUPABASE_SECRET_KEY`) are protected by `import "server-only"` and never exposed to browser bundles or mobile binaries.
4. **Database-Enforced Row Level Security**: All user-facing tables enforce PostgreSQL RLS policies; frontend route guards are usability aids, never security boundaries.
5. **No Bypass for Testing**: AI agents and developers must never disable authentication, authorization, or RLS checks to make tests or builds pass.
