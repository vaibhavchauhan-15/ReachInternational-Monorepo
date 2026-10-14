# Secrets Management & Environment Variable Policy

> **CRITICAL SECURITY REQUIREMENT: ZERO SERVER SECRETS IN CLIENT ARTIFACTS**  
> *This document establishes the binding rules for secret classification, storage, rotation, and exposure prevention across ReachInternational. Real secrets must NEVER be committed to Git or pasted into documentation.*

---

## 1. Secrets Classification Matrix

| Classification | Definition | Target Scope | Permitted Storage | Examples |
|---|---|---|---|---|
| **Tier 1: Privileged Server Secrets** | Grants full administrative bypass, database access, or external infrastructure control. | Server-Only (`import "server-only"`) | Vercel Environment Variables, GitHub Actions Secrets | `SUPABASE_SECRET_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `DATABASE_URL`, `INTERNAL_AUTH_SECRET`, `UPSTASH_REDIS_REST_TOKEN`, `SENDGRID_API_KEY`, `TWILIO_AUTH_TOKEN`, `CRON_SECRET` |
| **Tier 2: Public Client Configuration** | Publicly accessible metadata required by client applications to connect to standard gateways. Protected by RLS / CORS. | Web Browser & Mobile Client | `.env`, `.env.example`, `eas.json` (public profiles) | `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_APP_URL`, `NEXT_PUBLIC_GA_MEASUREMENT_ID` |
| **Tier 3: Transient User Credentials** | User session tokens and encryption keys generated at runtime. | User Device Storage | Web: `HttpOnly` Cookies<br>Mobile: `expo-secure-store` Keystore | Supabase Auth Access Token, Refresh Token, Biometric Keys |

---

## 2. Server-Side Protection Mechanisms

### Web Application (`apps/web`)
1. **Server-Only Guard**: All server secrets are read exclusively through `apps/web/lib/env/server.ts`, which enforces:
   ```ts
   import "server-only";
   ```
   Any accidental import into a client component (`'use client'`) causes an immediate **build-time compiler failure**.
2. **Naming Convention**: Variables lacking the `NEXT_PUBLIC_` prefix are excluded from browser JavaScript bundles by Next.js. Never prefix privileged secrets with `NEXT_PUBLIC_`.
3. **Internal Auth HMAC Secret**: `INTERNAL_AUTH_SECRET` is used by `proxy.ts` and `lib/dal.ts` to cryptographically sign edge-verified user credentials. It must remain strictly server-side.

### Native Mobile Application (`apps/mobile`)
1. **Zero Server Secrets**: Mobile binaries (APKs/IPAs) can be easily reverse-engineered. **NO privileged server secrets (`SUPABASE_SERVICE_ROLE_KEY`, `SENDGRID_API_KEY`) may ever exist in the mobile codebase, `.env`, or `eas.json`**.
2. **Automated Leak Guard**: `apps/mobile/lib/security.ts` provides `verifyClientSecurityEnvironment()` which scans `process.env` at initialization and throws an immediate fatal error if any server secret key is detected.
3. **Hardware-Backed Keystore**: User session tokens are saved using `expo-secure-store` backed by Android KeyStore and iOS Keychain. They are never written to unencrypted `AsyncStorage`.

---

## 3. Environment File Structure & Safe Placeholders

Use `.env.example` as the canonical template across all projects. Use standard dummy placeholders:

```bash
# Correct safe placeholder format in documentation and examples:
NEXT_PUBLIC_SUPABASE_URL="https://your-project.supabase.co"
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY="sb_publishable_placeholder_token"
SUPABASE_SECRET_KEY="sb_secret_placeholder_service_role_key"
INTERNAL_AUTH_SECRET="your-32-byte-hex-secret-placeholder"
UPSTASH_REDIS_REST_URL="https://your-upstash-redis.upstash.io"
UPSTASH_REDIS_REST_TOKEN="your-upstash-token-placeholder"
```

### Monorepo `.gitignore` Enforcement
The root `.gitignore` strictly blocks all local environment files:
```gitignore
.env
.env*.local
.env.development
.env.production
*.pem
*.key
```
Never force-add (`git add -f`) any `.env` file containing real credentials.

---

## 4. Secret Rotation & Revocation Protocol

If a privileged credential is suspected to be compromised:
1. **Immediate Revocation**:
   - **Supabase Service Role Key**: Generate a new API secret via the Supabase Dashboard (`Settings -> API -> Reset Secret Key`).
   - **SendGrid / Twilio API Key**: Revoke the compromised API key in the provider console and generate a replacement.
   - **Database Password**: Reset the PostgreSQL database password via Supabase settings.
2. **Update Secrets in Platforms**:
   - Update Vercel project environment variables for `apps/web`.
   - Update GitHub Actions Repository Secrets for CI/CD pipelines.
3. **Redeploy**: Trigger a clean production build (`pnpm build`) to replace running container instances.
4. **Post-Mortem**: Document the incident per [`security/INCIDENT-RESPONSE.md`](./INCIDENT-RESPONSE.md).

---

## 5. Mobile EAS Build Environment Hygiene

In `apps/mobile/eas.json`:
- Development, Preview, and Production build profiles must use only `EXPO_PUBLIC_*` configuration.
- Dev profiles must point to the **Development Supabase Project** (`vlmxciuogczumumrwyot`), not Production.
- Never commit production keystore passwords or release signing keys into `eas.json` or source control.
