#!/usr/bin/env node
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');

console.log('================================================================');
console.log('  VERCEL CRON CONFIGURATION & HOBBY PLAN COMPLIANCE AUDIT       ');
console.log('================================================================\n');

const rootVercelPath = path.join(ROOT_DIR, 'vercel.json');
const webVercelPath = path.join(ROOT_DIR, 'apps/web/vercel.json');

assert(fs.existsSync(rootVercelPath), 'root vercel.json must exist');
assert(fs.existsSync(webVercelPath), 'apps/web/vercel.json must exist');

const rootConfig = JSON.parse(fs.readFileSync(rootVercelPath, 'utf8'));
const webConfig = JSON.parse(fs.readFileSync(webVercelPath, 'utf8'));

console.log('1. Verifying synchronization between root vercel.json and apps/web/vercel.json...');
assert.deepStrictEqual(
  rootConfig.crons,
  webConfig.crons,
  'root vercel.json and apps/web/vercel.json crons must be 100% identical'
);
console.log('   ✓ Configs are 100% synchronized.\n');

console.log('2. Auditing each cron expression for Vercel Hobby Plan compliance (Max 1 run/day)...');

/**
 * Checks if a standard 5-token cron expression is strictly daily (at most once per day).
 * Format: minute hour day-of-month month day-of-week
 * On Vercel Hobby:
 * - Must NOT run hourly or sub-hourly.
 * - Hour must be a fixed integer (0-23).
 * - Minute must be a fixed integer (0-59).
 */
function isDailyHobbyCompliant(schedule) {
  const parts = schedule.trim().split(/\s+/);
  if (parts.length !== 5) return false;

  const [min, hour, dom, mon, dow] = parts;

  // Minute must be a single integer 0-59 (not *, not */n, not lists)
  if (!/^\d+$/.test(min)) return false;
  const minNum = parseInt(min, 10);
  if (minNum < 0 || minNum > 59) return false;

  // Hour must be a single integer 0-23 (not *, not */n, not lists)
  if (!/^\d+$/.test(hour)) return false;
  const hourNum = parseInt(hour, 10);
  if (hourNum < 0 || hourNum > 23) return false;

  return true;
}

let testedCount = 0;
for (const cron of rootConfig.crons) {
  testedCount++;
  console.log(`   [Cron ${testedCount}] Path: ${cron.path}`);
  console.log(`      Schedule: "${cron.schedule}"`);

  // Verify schedule compliance
  const compliant = isDailyHobbyCompliant(cron.schedule);
  assert(
    compliant,
    `Cron expression "${cron.schedule}" for "${cron.path}" violates Vercel Hobby plan! Hobby accounts only permit daily cron jobs (fixed minute and hour).`
  );
  console.log(`      ✓ Schedule is daily and Vercel Hobby compliant.`);

  // Verify target route exists
  const routePath = path.join(ROOT_DIR, 'apps/web/app', cron.path.replace(/^\//, ''), 'route.ts');
  assert(
    fs.existsSync(routePath),
    `Route handler does not exist at ${routePath} for cron ${cron.path}`
  );
  console.log(`      ✓ Route handler exists at apps/web/app${cron.path}/route.ts.\n`);
}

console.log('----------------------------------------------------------------');
console.log(`  SUCCESS: All ${testedCount} Vercel Cron jobs verified 100% Hobby-compliant!`);
console.log('================================================================\n');
process.exit(0);
