# Current Task: Dev/Prod CI/CD Pipeline Implementation

Status: COMPLETED (2026-09-24)

## Delivered Solution
1. **Supabase Migration Workflow** (`.github/workflows/supabase-migrate.yml`):
   - Single reusable workflow for both environments (`development` and `production`).
   - On push to `development`/`production`: runs `supabase db push` (applies pending migrations).
   - On PR to `production`: runs `supabase db diff --linked` as a dry-run check.
   - Uses GitHub Environments for secret scoping (`development` and `production`).
   - Uses `supabase/setup-cli@v1` (official action).

2. **CI Workflow Update** (`.github/workflows/ci.yml`):
   - Branch targets changed to `development` and `production`.
   - Typecheck + mobile tests remain as required status checks.

3. **Deleted Duplicate Branch**:
   - Remote and local `Production` (capital P) branch deleted.
   - Kept canonical lowercase `production` and `development`.

3. **Deleted** `.github/workflows/deploy-web.yml`:
   - Redundant — Vercel's native Git integration handles deployments.

## Remaining Manual Steps (GitHub/Vercel/Supabase UI)
- Rename `main` → `development`, create `Production` branch
- Create GitHub Environments (`development`, `production`) with Supabase secrets
- Set up Vercel Dev/Prod projects linked to respective branches
- Add branch protection on `Production`
- See setup guide artifact for full instructions.

## Ponytail Simplifications Applied
- Merged two duplicate workflow files into one keyed off `github.ref_name`
- GitHub Environments replace hand-rolled `DEV_`/`PROD_` secret prefixes
- Deleted Vercel deploy workflow (native Git integration)
- `# ponytail: shared Dev Supabase project, per-PR preview branches when PR collisions are real`
- `# ponytail: no pgTAP test framework, supabase db diff dry-run is the safety net`
- `# ponytail: no staging tier, add if "worked in Dev, broke in Prod" recurs`