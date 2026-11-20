# Current Task

## Task: Netlify Monorepo Deployment & Publish Directory Resolution
**Status**: 🟢 COMPLETED & VERIFIED
**Date**: 2026-11-20

### Objective
Resolve Netlify CI deployment errors for the ReachInternational monorepo:
1. **Fix 1 (Node.js 22 LTS Engine & Builtin Module `node:sqlite`)**:
   - `pnpm@11.21.0` requires Node.js >= 22.13.0 for native `node:sqlite`. Netlify defaulted to Node v20.20.2 which crashed with `ERR_UNKNOWN_BUILTIN_MODULE`.
   - Created root `.nvmrc` and `.node-version` containing `22`, set `NODE_VERSION = "22"` in root and app `netlify.toml`.
2. **Fix 2 (Monorepo Publish Directory Path Resolution in `@netlify/plugin-nextjs`)**:
   - When Netlify executes the build from `/opt/build/repo` (the repository root), `@netlify/plugin-nextjs` reads `publish` and resolves it relative to the build base directory.
   - `apps/web/netlify.toml` previously specified `publish = ".next"`, causing the plugin to search for `/opt/build/repo/.next` (which does not exist; Next.js Turbopack outputs to `/opt/build/repo/apps/web/.next`).
   - Aligned `apps/web/netlify.toml` with `publish = "apps/web/.next"` and added the scheduled cron functions block (`[functions]`).
3. **Multi-Platform Parity Contract Maintained**:
   - Vercel (`vercel.json` and `apps/web/vercel.json`) left 100% UNCHANGED.
   - Cloudflare Workers (`wrangler.jsonc` and `apps/web/wrangler.jsonc`) left 100% UNCHANGED.

### Files Modified & Synchronized
- `apps/web/netlify.toml`: Set `publish = "apps/web/.next"` and configured `[functions]` with 3 scheduled cron jobs.
- `scripts/test-netlify-deployment-config.mjs`: Added assertions for `apps/web/netlify.toml` publish path, Node 22, and cron functions.
- `docs/NETLIFY_DEPLOYMENT.md`: Clarified Netlify Package Directory configuration and monorepo publish path.
- `AI/STATE.md`: Recorded Netlify monorepo publish directory alignment.
- `AI/CHANGELOG_AI.md`: Documented resolution.

### Verification Evidence
- `node scripts/test-netlify-deployment-config.mjs`: 10/10 checks passed.
- `node scripts/run-all-tests.mjs`: 29/29 suites passed (100% clean).
- `pnpm typecheck`: 7/7 packages clean (0 errors).
- `npx wrangler deploy --dry-run`: 340 assets read, 12 bindings verified.
- `node scripts/test-vercel-cron-hobby-compliance.mjs`: 100% compliant.
