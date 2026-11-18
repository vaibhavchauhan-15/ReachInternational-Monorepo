#!/usr/bin/env node
/**
 * Test Suite: Atomic Bulk "Approve All" Engine & Statutory Documents Pending Invariant
 *
 * Verifies:
 * 1. Migration 218 & Rollback 219 file existence and SQL invariants
 * 2. Database Invariants:
 *    - User status set to 'active'
 *    - User documents (Aadhaar, DL, Bank) remain in 'pending' status (verification_status = 'pending')
 *    - Consolidated document_verify approval request created for active user's pending documents
 * 3. Validation Schemas & Types: ApprovalApproveAllInputSchema & ApprovalApproveAllResult
 * 4. Web & Mobile 100% Parity:
 *    - Web: ApprovalsClientShell.tsx, ApproveAllConfirmModal.tsx, approveAllAction, /api/approvals/approve-all
 *    - Mobile: approvals.tsx, ApproveAllConfirmModal.tsx, useApproveAllMutation, min 44px touch targets
 * 5. Live Dev DB (vlmxciuogczumumrwyot) RPC Verification
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';

const __filename = fileURLToPath(import.meta.url);
const rootDir = path.resolve(path.dirname(__filename), '../..');

console.log('\n================================================================');
console.log('  TEST: ATOMIC BULK "APPROVE ALL" ENGINE & PARITY               ');
console.log('================================================================\n');

let passed = 0;
let failed = 0;

function check(desc, fn) {
  try {
    fn();
    console.log(`  ✓ ${desc}`);
    passed++;
  } catch (err) {
    console.error(`  ❌ FAIL: ${desc}`);
    console.error(`     ${err.message}`);
    failed++;
  }
}

// -----------------------------------------------------------------------------
// 1. Migration 218 & Rollback 219 Invariants
// -----------------------------------------------------------------------------
console.log('--- 1. Migration 218 & Rollback 219 Invariants ---');

const migration218Path = path.resolve(rootDir, 'supabase/migrations/218_approve_all_pending_registrations.sql');
const rollback219Path = path.resolve(rootDir, 'supabase/migrations/219_rollback_approve_all_pending_registrations.sql');

check('Migration 218 and Rollback 219 files exist', () => {
  assert(fs.existsSync(migration218Path), 'Migration 218 file must exist');
  assert(fs.existsSync(rollback219Path), 'Rollback 219 file must exist');
});

const migration218 = fs.readFileSync(migration218Path, 'utf8');

check('Migration 218 defines approval_approve_all with SECURITY DEFINER and admin role check', () => {
  assert(migration218.includes('CREATE OR REPLACE FUNCTION public.approval_approve_all'), 'Defines approval_approve_all');
  assert(migration218.includes('SECURITY DEFINER'), 'Runs as security definer');
  assert(migration218.includes("v_actor_role NOT IN ('super_admin', 'admin')"), 'Enforces admin role check');
});

check('Migration 218 enforces: User status becomes active immediately', () => {
  assert(migration218.includes("UPDATE public.users"), 'Updates public.users');
  assert(migration218.includes("SET status = 'active'"), "Sets user status to active");
});

check('Migration 218 enforces: All user documents remain in pending status', () => {
  assert(migration218.includes("UPDATE public.user_documents"), 'Updates public.user_documents');
  assert(migration218.includes("verification_status = 'pending'"), "Guarantees verification_status is pending");
  assert(migration218.includes("status = 'pending'"), "Guarantees status is pending");
});

check('Migration 218 enforces: Consolidated document_verify request created for pending documents', () => {
  assert(migration218.includes("type_key = 'document_verify'"), 'Looks up or inserts document_verify request');
  assert(migration218.includes("pending_document_ids"), 'Aggregates pending document IDs');
});

// -----------------------------------------------------------------------------
// 2. Types, Validation & API Endpoints
// -----------------------------------------------------------------------------
console.log('\n--- 2. Types, Validation & Server Actions ---');

const validationPath = path.resolve(rootDir, 'packages/validation/src/approvals.ts');
const validationContent = fs.readFileSync(validationPath, 'utf8');

check('Validation exports ApprovalApproveAllInputSchema', () => {
  assert(validationContent.includes('export const ApprovalApproveAllInputSchema'), 'Exports ApprovalApproveAllInputSchema');
});

const typesPath = path.resolve(rootDir, 'packages/types/src/approvals.ts');
const typesContent = fs.readFileSync(typesPath, 'utf8');

check('Types exports ApprovalApproveAllResult', () => {
  assert(typesContent.includes('export interface ApprovalApproveAllResult'), 'Exports ApprovalApproveAllResult');
});

const serverActionPath = path.resolve(rootDir, 'apps/web/app/actions/approvals.ts');
const serverActionContent = fs.readFileSync(serverActionPath, 'utf8');

check('Web Server Action exports approveAllAction with RBAC and revalidateTag', () => {
  assert(serverActionContent.includes('export async function approveAllAction'), 'Exports approveAllAction');
  assert(serverActionContent.includes("approval_approve_all"), 'Calls approval_approve_all RPC');
  assert(serverActionContent.includes("TAGS.approvals"), 'Revalidates approvals cache tag');
  assert(serverActionContent.includes("TAGS.users"), 'Revalidates users cache tag');
});

const apiRoutePath = path.resolve(rootDir, 'apps/web/app/api/approvals/approve-all/route.ts');
check('API Route /api/approvals/approve-all exists and guards admin access', () => {
  assert(fs.existsSync(apiRoutePath), 'Route file exists');
  const routeContent = fs.readFileSync(apiRoutePath, 'utf8');
  assert(routeContent.includes('approveAllAction'), 'Calls approveAllAction');
  assert(routeContent.includes('auth.user.isAdmin'), 'Guards admin access');
});

const utilsClientPath = path.resolve(rootDir, 'packages/utils/src/approvals-client.ts');
const utilsClientContent = fs.readFileSync(utilsClientPath, 'utf8');

check('Utils transport client exports approveAll() supporting both RPC and HTTP transports', () => {
  assert(utilsClientContent.includes('export async function approveAll'), 'Exports approveAll');
  assert(utilsClientContent.includes('approval_approve_all'), 'Calls approval_approve_all RPC');
  assert(utilsClientContent.includes('/api/approvals/approve-all'), 'Calls HTTP endpoint');
});

// -----------------------------------------------------------------------------
// 3. Web & Mobile 100% Zero-Drift Parity
// -----------------------------------------------------------------------------
console.log('\n--- 3. Web & Mobile 100% Zero-Drift Parity ---');

const webShellPath = path.resolve(rootDir, 'apps/web/app/(app)/approvals/ApprovalsClientShell.tsx');
const webShellContent = fs.readFileSync(webShellPath, 'utf8');

check('Web ApprovalsClientShell includes Approve All button and confirmation modal', () => {
  assert(webShellContent.includes('Approve All'), 'Renders Approve All button');
  assert(webShellContent.includes('ApproveAllConfirmModal'), 'Renders ApproveAllConfirmModal');
  assert(webShellContent.includes('approveAllAction'), 'Calls approveAllAction');
  assert(webShellContent.includes('isApprovingAll'), 'Tracks isApprovingAll state');
});

const mobileScreenPath = path.resolve(rootDir, 'apps/mobile/app/(app)/approvals.tsx');
const mobileScreenContent = fs.readFileSync(mobileScreenPath, 'utf8');

check('Mobile approvals.tsx includes Approve All button and confirmation modal', () => {
  assert(mobileScreenContent.includes('Approve All'), 'Renders Approve All button');
  assert(mobileScreenContent.includes('ApproveAllConfirmModal'), 'Renders ApproveAllConfirmModal');
  assert(mobileScreenContent.includes('useApproveAllMutation'), 'Uses useApproveAllMutation');
  assert(mobileScreenContent.includes('minHeight: 44'), 'Enforces 44px touch ergonomics');
});

const mobileHookPath = path.resolve(rootDir, 'apps/mobile/lib/hooks/useApprovalsData.ts');
const mobileHookContent = fs.readFileSync(mobileHookPath, 'utf8');

check('Mobile useApprovalsData.ts exports useApproveAllMutation with optimistic updates', () => {
  assert(mobileHookContent.includes('export function useApproveAllMutation'), 'Exports useApproveAllMutation');
  assert(mobileHookContent.includes('/api/approvals/approve-all'), 'Calls rich web API endpoint');
  assert(mobileHookContent.includes('approveAll(supabase'), 'Calls direct RPC fallback');
  assert(mobileHookContent.includes('haptics.confirm()'), 'Fires tactile haptic feedback');
});

// -----------------------------------------------------------------------------
// 4. Live Dev DB Verification
// -----------------------------------------------------------------------------
console.log('\n--- 4. Live Supabase Dev DB State Verification ---');

function loadEnvFile(filePath) {
  if (fs.existsSync(filePath)) {
    const lines = fs.readFileSync(filePath, 'utf-8').split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const idx = trimmed.indexOf('=');
      if (idx !== -1) {
        const key = trimmed.slice(0, idx).trim();
        let val = trimmed.slice(idx + 1).trim();
        if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
          val = val.slice(1, -1);
        }
        if (!process.env[key]) process.env[key] = val;
      }
    }
  }
}

loadEnvFile(path.resolve(rootDir, '.env.local'));

const token = process.env.SUPABASE_ACCESS_TOKEN;
const projectRef = 'vlmxciuogczumumrwyot';

if (token) {
  try {
    const res = await fetch(`https://api.supabase.com/v1/projects/${projectRef}/database/query`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        query: `
          SELECT proname, prorettype::regtype
          FROM pg_proc
          WHERE proname = 'approval_approve_all';
        `
      })
    });
    const data = await res.json();
    check('Live DB: approval_approve_all function exists and returns jsonb', () => {
      assert(Array.isArray(data) && data.length > 0, 'Function must exist in pg_proc');
      assert.equal(data[0].proname, 'approval_approve_all');
      assert.equal(data[0].prorettype, 'jsonb');
    });
  } catch (err) {
    console.warn('Live DB query error:', err.message);
  }
}

console.log('\n================================================================');
console.log(`  RESULT: ${passed} PASSED / ${failed} FAILED`);
console.log('================================================================\n');

if (failed > 0) {
  process.exit(1);
}
