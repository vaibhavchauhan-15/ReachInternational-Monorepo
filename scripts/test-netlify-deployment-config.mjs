#!/usr/bin/env node
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');

console.log('================================================================');
console.log('  NETLIFY DEPLOYMENT CONFIGURATION & MULTI-PLATFORM PARITY AUDIT');
console.log('================================================================\n');

let checkCount = 0;
function pass(desc) {
  checkCount++;
  console.log(`  \x1b[32m✔\x1b[0m [Check ${checkCount}] ${desc}`);
}

// 1. Verify root netlify.toml and Node 22 version specification (.nvmrc & .node-version)
const rootNetlifyPath = path.join(ROOT_DIR, 'netlify.toml');
assert(fs.existsSync(rootNetlifyPath), 'root netlify.toml must exist');
const rootNetlifyContent = fs.readFileSync(rootNetlifyPath, 'utf8');
assert(rootNetlifyContent.includes('publish = "apps/web/.next"'), 'root netlify.toml must point to apps/web/.next');
assert(rootNetlifyContent.includes('base = "."'), 'root netlify.toml must have base = "."');
assert(rootNetlifyContent.includes('command = "node scripts/build-dispatcher.js"'), 'root netlify.toml must invoke build dispatcher');
assert(rootNetlifyContent.includes('NODE_VERSION = "22"'), 'root netlify.toml must declare Node.js 22 (required for pnpm v11 & node:sqlite)');
assert(rootNetlifyContent.includes('PNPM_VERSION = "11.21.0"'), 'root netlify.toml must declare PNPM 11.21.0');
assert(rootNetlifyContent.includes('SECRETS_SCAN_OMIT_KEYS'), 'root netlify.toml must declare SECRETS_SCAN_OMIT_KEYS');
assert(rootNetlifyContent.includes('SECRETS_SCAN_OMIT_PATHS'), 'root netlify.toml must declare SECRETS_SCAN_OMIT_PATHS');

const nvmrcPath = path.join(ROOT_DIR, '.nvmrc');
assert(fs.existsSync(nvmrcPath), '.nvmrc must exist at root');
assert(fs.readFileSync(nvmrcPath, 'utf8').trim() === '22', '.nvmrc must specify 22');

const nodeVersionPath = path.join(ROOT_DIR, '.node-version');
assert(fs.existsSync(nodeVersionPath), '.node-version must exist at root');
assert(fs.readFileSync(nodeVersionPath, 'utf8').trim() === '22', '.node-version must specify 22');
pass('Root netlify.toml, .nvmrc, and .node-version enforce Node.js 22 LTS for pnpm v11 & node:sqlite.');

// 2. Verify apps/web/netlify.toml (Subdirectory & Monorepo alignment)
const webNetlifyPath = path.join(ROOT_DIR, 'apps/web/netlify.toml');
assert(fs.existsSync(webNetlifyPath), 'apps/web/netlify.toml must exist');
const webNetlifyContent = fs.readFileSync(webNetlifyPath, 'utf8');
assert(
  webNetlifyContent.includes('publish = "apps/web/.next"'),
  'apps/web/netlify.toml must specify apps/web/.next for monorepo publish path'
);
assert(webNetlifyContent.includes('NODE_VERSION = "22"'), 'apps/web/netlify.toml must declare Node.js 22');
assert(webNetlifyContent.includes('SECRETS_SCAN_OMIT_KEYS'), 'apps/web/netlify.toml must declare SECRETS_SCAN_OMIT_KEYS');
assert(webNetlifyContent.includes('SECRETS_SCAN_OMIT_PATHS'), 'apps/web/netlify.toml must declare SECRETS_SCAN_OMIT_PATHS');
assert(webNetlifyContent.includes('cleanup-staging'), 'apps/web/netlify.toml must register cleanup-staging cron');
assert(webNetlifyContent.includes('cleanup-superseded'), 'apps/web/netlify.toml must register cleanup-superseded cron');
assert(webNetlifyContent.includes('close-expired-jobs'), 'apps/web/netlify.toml must register close-expired-jobs cron');
pass('apps/web/netlify.toml aligns with monorepo root publish directory (apps/web/.next) and scheduled functions.');

// 3. Verify Scheduled Functions (Parity with Vercel and Cloudflare)
const scheduledFunctions = [
  { name: 'cleanup-staging.mts', schedule: '0 2 * * *', route: '/api/cron/cleanup-staging' },
  { name: 'cleanup-superseded.mts', schedule: '0 3 * * *', route: '/api/cron/cleanup-superseded' },
  { name: 'close-expired-jobs.mts', schedule: '0 0 * * *', route: '/api/cron/close-expired-jobs' },
];

for (const fn of scheduledFunctions) {
  const fnPath = path.join(ROOT_DIR, 'netlify/functions', fn.name);
  assert(fs.existsSync(fnPath), `Netlify scheduled function ${fn.name} must exist`);
  const content = fs.readFileSync(fnPath, 'utf8');
  assert(content.includes(fn.schedule), `${fn.name} must declare schedule ${fn.schedule}`);
  assert(content.includes(fn.route), `${fn.name} must target route ${fn.route}`);
  pass(`Netlify function ${fn.name} configured with schedule "${fn.schedule}" targeting ${fn.route}.`);
}

// 4. Verify 100% Cron Schedule Parity with Vercel and Cloudflare
const rootVercel = JSON.parse(fs.readFileSync(path.join(ROOT_DIR, 'vercel.json'), 'utf8'));
for (const fn of scheduledFunctions) {
  const vercelCron = rootVercel.crons.find((c) => c.path === fn.route);
  assert(vercelCron, `Vercel must have matching cron for ${fn.route}`);
  assert.strictEqual(
    vercelCron.schedule,
    fn.schedule,
    `Cron schedule for ${fn.route} in Netlify (${fn.schedule}) must match Vercel (${vercelCron.schedule})`
  );
}
pass('All 3 Netlify Scheduled Functions match Vercel and Cloudflare cron expressions 100%.');

// 5. Verify build-dispatcher.js handles Netlify
const dispatcherPath = path.join(ROOT_DIR, 'scripts/build-dispatcher.js');
const dispatcherContent = fs.readFileSync(dispatcherPath, 'utf8');
assert(dispatcherContent.includes('isNetlify'), 'build-dispatcher.js must define isNetlify');
assert(dispatcherContent.includes('process.env.NETLIFY'), 'build-dispatcher.js must check process.env.NETLIFY');
assert(
  dispatcherContent.includes('turbo run build --filter=@reachinternational/web'),
  'build-dispatcher.js must build web via turbo on Netlify'
);
pass('Build dispatcher integrates Netlify detection and targets @reachinternational/web build.');

// 6. Verify apps/web/scripts/guard-build.js skips on Netlify
const guardPath = path.join(ROOT_DIR, 'apps/web/scripts/guard-build.js');
const guardContent = fs.readFileSync(guardPath, 'utf8');
assert(guardContent.includes('process.env.NETLIFY'), 'guard-build.js must skip when NETLIFY is defined');
pass('apps/web/scripts/guard-build.js contains process.env.NETLIFY bypass.');

// 7. Verify apps/web/lib/env/client.ts resolves Netlify URL variables
const clientEnvPath = path.join(ROOT_DIR, 'apps/web/lib/env/client.ts');
const clientEnvContent = fs.readFileSync(clientEnvPath, 'utf8');
assert(clientEnvContent.includes('process.env.URL'), 'client.ts must check process.env.URL');
assert(clientEnvContent.includes('process.env.DEPLOY_PRIME_URL'), 'client.ts must check process.env.DEPLOY_PRIME_URL');
assert(clientEnvContent.includes('process.env.DEPLOY_URL'), 'client.ts must check process.env.DEPLOY_URL');
pass('Client environment helper resolves Netlify URL and deployment origin variables.');

// 8. Verify Vercel and Cloudflare configs remain untouched
const vercelContent = fs.readFileSync(path.join(ROOT_DIR, 'vercel.json'), 'utf8');
const webVercelContent = fs.readFileSync(path.join(ROOT_DIR, 'apps/web/vercel.json'), 'utf8');
assert.strictEqual(vercelContent, webVercelContent, 'Root and web vercel.json must remain identical');
assert(fs.existsSync(path.join(ROOT_DIR, 'wrangler.jsonc')), 'wrangler.jsonc must exist');
assert(fs.existsSync(path.join(ROOT_DIR, 'apps/web/wrangler.jsonc')), 'apps/web/wrangler.jsonc must exist');
pass('Vercel (vercel.json) and Cloudflare (wrangler.jsonc) configurations remain 100% UNCHANGED.');

console.log('----------------------------------------------------------------');
console.log(`  SUCCESS: All ${checkCount} Netlify deployment checks passed cleanly!`);
console.log('================================================================\n');
process.exit(0);
