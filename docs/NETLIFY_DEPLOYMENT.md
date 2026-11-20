# ReachInternational — Netlify Deployment Guide

This guide details how to configure and deploy the ReachInternational Next.js 16 App Router web application (`apps/web`) to **Netlify** from this pnpm / Turborepo monorepo.

> [!NOTE]
> This configuration maintains **100% parity** with existing Vercel (`vercel.json`) and Cloudflare Workers (`wrangler.jsonc`) deployments without altering or disrupting either platform.

---

## 1. Quick Setup (Monorepo Root — Recommended)

When connecting the Git repository in the Netlify Dashboard:

| Setting | Value | Description |
| :--- | :--- | :--- |
| **Base directory** | `.` (or leave empty) | Monorepo root where `pnpm-workspace.yaml` and `package.json` reside. |
| **Build command** | `pnpm run build` (or `pnpm run build:netlify`) | Runs `node scripts/build-dispatcher.js` which executes `turbo run build --filter=@reachinternational/web`. |
| **Publish directory** | `apps/web/.next` | Location of the compiled Next.js output relative to monorepo root. |
| **Package directory** | Leave empty | Root package manager manages all workspace packages. |

Netlify reads the root [`netlify.toml`](file:///c:/Users/Reach%20International/Projects/ReachInternational-Monorepo/netlify.toml) automatically.

---

## 2. Package Directory Setup (`packagePath: apps/web`)

If Netlify UI has **Package directory** set to `apps/web` (or if configuring through Netlify monorepo detection):

| Setting | Value | Description |
| :--- | :--- | :--- |
| **Base directory** | Leave empty (repository root) | Allows pnpm workspace lockfile resolution across all packages. |
| **Package directory** | `apps/web` | Directs Netlify to the web application folder and its `netlify.toml`. |
| **Build command** | `pnpm build` | Executes `scripts/build-dispatcher.js` or Turborepo web build. |
| **Publish directory** | `apps/web/.next` | Location of the compiled Next.js output relative to the repository root. |

Both the root [`netlify.toml`](file:///c:/Users/Reach%20International/Projects/ReachInternational-Monorepo/netlify.toml) and [`apps/web/netlify.toml`](file:///c:/Users/Reach%20International/Projects/ReachInternational-Monorepo/apps/web/netlify.toml) explicitly declare `publish = "apps/web/.next"`, preventing any monorepo path resolution mismatch in `@netlify/plugin-nextjs`.

---

## 3. Environment Variables Reference

Configure these in the Netlify UI under **Site configuration > Environment variables**:

### Public Client Variables (Embedded in Client Bundles)

| Variable Name | Production Default / Description |
| :--- | :--- |
| `NEXT_PUBLIC_SUPABASE_URL` | `https://dhbbgfzbyatzvqafnsqp.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | `sb_publishable_FL-1BqCcGNxYByFYzrBWuA_BvHMxVis` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase Anon JWT key |
| `NEXT_PUBLIC_APP_URL` | `https://<your-site>.netlify.app` (or custom domain) |
| `NEXT_PUBLIC_APP_VERSION` | `1.5.0` |
| `NEXT_PUBLIC_GA_MEASUREMENT_ID` | `G-DC126P3SM9` |
| `NEXT_PUBLIC_ENABLE_AGENTATION` | `false` |
| `NEXT_PUBLIC_ENABLE_PULL_TO_REFRESH` | `true` |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | WebPush VAPID Public Key |
| `PUSH_ENABLED` | `true` |
| `VAPID_SUBJECT` | `mailto:support@reachinternational.co.in` |

### Server-Only Secrets (Never Exposed to Browser)

| Secret Name | Description |
| :--- | :--- |
| `SUPABASE_SECRET_KEY` | Supabase Admin / Service Role Secret Key (Server Components & Actions) |
| `CRON_SECRET` | Secret token authorizing scheduled cron jobs and maintenance tasks |
| `UPLOAD_SESSION_SECRET` | Secret for cryptographic staging upload signatures |
| `INTERNAL_AUTH_SECRET` | Secret for cryptographically signing edge-to-server auth headers |
| `NOTIFY_SECRET` | Secret for push notification fast-path dispatch API |
| `VAPID_PRIVATE_KEY` | WebPush VAPID Private Key for browser notifications |

---

## 4. Scheduled Functions (Cron Jobs)

Netlify automatically provisions 3 scheduled functions (located in `netlify/functions/`) to match Vercel Crons and Cloudflare Triggers:

1. **`cleanup-staging`** (`0 2 * * *` — Daily at 02:00 UTC):
   - Purges staging sessions older than 24 hours.
2. **`cleanup-superseded`** (`0 3 * * *` — Daily at 03:00 UTC):
   - Purges unreferenced documents in `user_files` older than 90 days.
3. **`close-expired-jobs`** (`0 0 * * *` — Daily at 00:00 UTC):
   - Closes expired recruitment job postings.

These functions invoke the Next.js API endpoints (`/api/cron/*`) using `CRON_SECRET` authorization.

---

## 5. Local Verification Commands

To verify your configuration locally:

```bash
# Verify Netlify deployment configuration & multi-platform parity
node scripts/test-netlify-deployment-config.mjs

# Verify typecheck across all 7 packages
pnpm typecheck

# Run full monorepo verification suite (29/29 suites)
node scripts/run-all-tests.mjs
```
