# Security Incident Response Protocol

> **OPERATIONAL GUIDE FOR SECURITY INCIDENTS & CREDENTIAL COMPROMISE**  
> *This document defines the actionable, step-by-step procedures for containing, investigating, remediating, and documenting security incidents across ReachInternational.*

---

## 1. Incident Classification

Security incidents are categorized into five priority levels:

| Incident Type | Description | Initial Response Goal |
|---|---|---|
| **Credential / Secret Exposure** | `SUPABASE_SECRET_KEY`, database credentials, or API tokens committed to Git or leaked in logs. | Immediate revocation within 1 hour. |
| **Unauthorized Access / BOLA** | A user accesses or modifies records outside their permitted role or organization scope. | Immediate session termination & RLS patch. |
| **Data Exfiltration / Leakage** | Sensitive employee KYC, payroll, or customer data accessed without authorization. | Containment, audit review, and scope assessment. |
| **Compromised Dependency** | Malicious package or critical zero-day CVE detected in monorepo dependencies. | Version override or removal within 24 hours. |
| **Compromised Release / Binary** | Compromised web deployment or tampered mobile APK published to users. | Rollback to last known clean build immediately. |

---

## 2. Step-by-Step Response Playbooks

### Playbook A: Privileged Secret Exposure

If a secret (e.g., `SUPABASE_SECRET_KEY`, `INTERNAL_AUTH_SECRET`, `SENDGRID_API_KEY`) is accidentally committed or leaked:

1. **Step 1: Revoke the Compromised Secret Immediately**
   - **Supabase Service Key**: Go to Supabase Dashboard (`Settings -> API -> Reset Service Key`). This immediately invalidates the exposed key across all environments.
   - **SendGrid / Twilio API Key**: Log in to provider console and revoke the affected API key immediately.
   - **Database Password**: Change database password via Supabase settings.
2. **Step 2: Update Environment Variables**
   - Update Vercel project environment variables for production and preview environments.
   - Update repository secrets in GitHub Actions (`Settings -> Secrets and variables -> Actions`).
3. **Step 3: Trigger Clean Deployments**
   - Deploy web application to Vercel to cycle running server instances.
   - For mobile, review whether any published binary was affected.
4. **Step 4: Audit Git History**
   - If committed to Git, rotate the key first, then rewrite history or push a corrective commit.
   - *Remember*: Rotating the key immediately is far more effective than trying to purge Git history after a push.
5. **Step 5: Inspect Audit Logs**
   - Review `public.audit_logs` in Supabase for any unauthorized administrative actions taken during the exposure window.

---

### Playbook B: Unauthorized Data Access or BOLA Exploitation

If a user or attacker accesses data belonging to another user or tenant:

1. **Step 1: Terminate Offending Sessions**
   - In Supabase Auth, revoke the user's active session or ban the account temporarily.
2. **Step 2: Identify the Vulnerable Boundary**
   - Inspect the affected Server Action (`app/actions/*`), API route (`app/api/*`), or database table.
   - Check why RLS or server-side ownership checks failed to stop the request.
3. **Step 3: Deploy Hotfix**
   - Add explicit role or ownership validation:
     ```ts
     if (record.user_id !== session.userId && !isManagerOrAbove(user.role)) {
       throw new Error("Unauthorized");
     }
     ```
   - If database RLS was misconfigured, write an idempotent migration (`supabase/migrations/NNN_patch_rls.sql`) and apply it to Dev, test, and promote.
4. **Step 4: Verify with Negative Tests**
   - Write an automated negative test verifying that unauthorized users are rejected with HTTP 403 / "Permission denied".

---

### Playbook C: Compromised Production Release

If a web deployment or mobile build contains malicious code or an unintended regression:

1. **Step 1: Immediate Web Rollback**
   - In Vercel Dashboard, navigate to Deployments and instantly promote the previous successful deployment to Production (Instant Rollback).
2. **Step 2: Mobile Build Containment**
   - In EAS / Expo Dashboard, halt the deployment channel or update the release channel to point to the previous stable runtime version.
3. **Step 3: Root Cause Investigation**
   - Identify the commit that introduced the compromise. Revert the commit in Git and test locally.

---

## 3. Post-Incident Review & Documentation

Within 72 hours of resolving a security incident, the engineering team must conduct a blameless post-mortem and document:

1. **Root Cause**: What architectural gap, code error, or misconfiguration permitted the incident?
2. **Impact Assessment**: What data, users, or systems were affected during the exposure window?
3. **Timeline**: Exact chronological sequence of detection, containment, remediation, and verification.
4. **Corrective Actions**:
   - Updates to [`security/SECURITY-RULES.md`](./SECURITY-RULES.md) or [`security/ATTACK-SURFACE.md`](./ATTACK-SURFACE.md).
   - New automated tests added to CI to prevent recurrence.
   - Architecture hardening.
