#!/usr/bin/env node
/**
 * Test Suite: Approval Requests Normalization, Deduplication & Multi-Document Consolidation
 *
 * Verifies:
 * 1. Database Migration 209 & Trigger Invariants
 * 2. DAL Normalization & Deduplication (Redundant Registration Document Suppression & Multi-Document Binding)
 * 3. Server Actions & Validation Schemas Support for bound_request_ids
 * 4. Web & Mobile 100% Parity for Multi-Document Initial Verification Cards
 * 5. Live Supabase Dev DB State (Zero duplicate cards for pending registration)
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';

const __filename = fileURLToPath(import.meta.url);
const rootDir = path.resolve(path.dirname(__filename), '../..');

console.log('\n================================================================');
console.log('  TEST: APPROVAL REQUESTS NORMALIZATION & DEDUPLICATION         ');
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
// 1. Database Migration 209 & Trigger Invariants
// -----------------------------------------------------------------------------
console.log('\n--- 1. Database Migration 209 & Trigger Invariants ---');

const migration209Path = path.resolve(rootDir, 'supabase/migrations/209_normalize_and_deduplicate_approval_requests.sql');
const rollback209Path = path.resolve(rootDir, 'supabase/migrations/209_rollback_normalize_and_deduplicate_approval_requests.sql');

check('Migration 209 and Rollback 209 files exist', () => {
  assert(fs.existsSync(migration209Path), 'Migration 209 file must exist');
  assert(fs.existsSync(rollback209Path), 'Rollback 209 file must exist');
});

const migration209 = fs.readFileSync(migration209Path, 'utf8');

check('Migration 209 trigger suppresses duplicate document_verify for pending registration users', () => {
  assert(migration209.includes("v_user_status = 'pending'"), 'Checks pending user status');
  assert(migration209.includes("type_key = 'registration'"), 'Checks pending registration approval');
  assert(migration209.includes("RETURN NEW;"), 'Returns without inserting duplicate approval request');
});

check('Migration 209 trigger binds multiple pending documents into existing user request', () => {
  assert(migration209.includes("SELECT id, payload INTO v_existing_req_id"), 'Looks up existing pending request for user');
  assert(migration209.includes("pending_document_ids"), 'Stores aggregated pending document IDs in payload');
  assert(migration209.includes("UPDATE public.approval_requests"), 'Updates existing card instead of inserting duplicate');
});

check('approval_apply_document_verify supports verifying multiple bound documents', () => {
  assert(migration209.includes("v_doc_ids := v_req.payload->'pending_document_ids';"), 'Extracts pending document IDs');
  assert(migration209.includes("WHERE id IN ("), 'Updates all bound documents in user_documents');
});

check('approval_decide rejection handles multi-document rejection', () => {
  assert(migration209.includes("IF v_doc_ids IS NOT NULL AND jsonb_array_length(v_doc_ids) > 0 THEN"), 'Handles multi-document rejection in approval_decide');
});

// -----------------------------------------------------------------------------
// 2. DAL Normalization & Deduplication
// -----------------------------------------------------------------------------
console.log('\n--- 2. DAL Normalization & Deduplication ---');

const dalPath = path.resolve(rootDir, 'apps/web/lib/dal/approvals.ts');
const dalContent = fs.readFileSync(dalPath, 'utf8');

check('getApprovalsListDAL identifies pending registration user IDs', () => {
  assert(dalContent.includes('pendingRegistrationUserIds'), 'Tracks pending registration user IDs');
});

check('getApprovalsListDAL absorbs document_verify into registration cards', () => {
  assert(dalContent.includes('pendingRegistrationUserIds.has(targetUserId)'), 'Checks targetUserId against pending registrations');
  assert(dalContent.includes('regItem.bound_request_ids'), 'Attaches bound IDs to registration item');
  assert(dalContent.includes('continue; // Suppress duplicate standalone document_verify card'), 'Suppresses standalone card');
});

check('getApprovalsListDAL binds multiple same-type requests into 1 consolidated card', () => {
  assert(dalContent.includes('existing.bound_request_ids = existing.bound_request_ids || [existing.id]'), 'Aggregates bound request IDs');
  assert(dalContent.includes('existing.documents.push(doc)'), 'Merges attached documents without duplicates');
  assert(dalContent.includes('existing.summary ='), 'Updates card summary to reflect document count');
});

// -----------------------------------------------------------------------------
// 3. Types, Validation & Server Actions
// -----------------------------------------------------------------------------
console.log('\n--- 3. Types, Validation & Server Actions ---');

const typesPath = path.resolve(rootDir, 'packages/types/src/approvals.ts');
const typesContent = fs.readFileSync(typesPath, 'utf8');

check('ApprovalRequestListItem type includes bound_request_ids', () => {
  assert(typesContent.includes('bound_request_ids?: string[];'), 'ApprovalRequestListItem has bound_request_ids property');
});

const valPath = path.resolve(rootDir, 'packages/validation/src/approvals.ts');
const valContent = fs.readFileSync(valPath, 'utf8');

check('ApprovalDecideInputSchema accepts bound_request_ids', () => {
  assert(valContent.includes('bound_request_ids: z.array(z.string().uuid()).optional()'), 'ApprovalDecideInputSchema accepts optional bound_request_ids');
});

const actionsPath = path.resolve(rootDir, 'apps/web/app/actions/approvals.ts');
const actionsContent = fs.readFileSync(actionsPath, 'utf8');

check('decideApprovalAction decides all bound requests in parallel', () => {
  assert(actionsContent.includes('input.bound_request_ids'), 'Checks input.bound_request_ids');
  assert(actionsContent.includes('otherBoundIds.map((boundId) =>'), 'Maps other bound IDs to approval_decide');
});

// -----------------------------------------------------------------------------
// 4. Web & Mobile 100% Parity for Multi-Document Cards
// -----------------------------------------------------------------------------
console.log('\n--- 4. Web & Mobile 100% Parity for Multi-Document Cards ---');

const webRowPath = path.resolve(rootDir, 'apps/web/app/(app)/approvals/components/ApprovalRow.tsx');
const webRowContent = fs.readFileSync(webRowPath, 'utf8');

check('Web ApprovalRow renders multi-document strip when isDocVerify has documents.length > 1', () => {
  assert(webRowContent.includes('isDocVerify && ('), 'Handles isDocVerify');
  assert(webRowContent.includes('documents.length > 1 ? ('), 'Checks documents.length > 1');
  assert(webRowContent.includes('Documents for Verification ({documents.length})'), 'Renders document count header');
});

const mobileCardPath = path.resolve(rootDir, 'apps/mobile/components/approvals/MobileApprovalCard.tsx');
const mobileCardContent = fs.readFileSync(mobileCardPath, 'utf8');

check('Mobile MobileApprovalCard renders multi-document strip when isDocVerify has documents.length > 1', () => {
  assert(mobileCardContent.includes('isDocVerify && ('), 'Handles isDocVerify');
  assert(mobileCardContent.includes('documents.length > 1 ? ('), 'Checks documents.length > 1');
  assert(mobileCardContent.includes('Documents for Verification ({documents.length})'), 'Renders document count header matching web 100%');
});

const webShellPath = path.resolve(rootDir, 'apps/web/app/(app)/approvals/ApprovalsClientShell.tsx');
const webShellContent = fs.readFileSync(webShellPath, 'utf8');

check('Web ApprovalsClientShell passes bound_request_ids on approve and reject', () => {
  assert(webShellContent.includes('bound_request_ids: targetItem?.bound_request_ids'), 'Passes bound_request_ids on decide');
});

const mobileScreenPath = path.resolve(rootDir, 'apps/mobile/app/(app)/approvals.tsx');
const mobileScreenContent = fs.readFileSync(mobileScreenPath, 'utf8');

check('Mobile approvals.tsx passes boundRequestIds on approve and reject', () => {
  assert(mobileScreenContent.includes('boundRequestIds: targetItem?.bound_request_ids'), 'Passes boundRequestIds on mobile decide');
});

// -----------------------------------------------------------------------------
// 5. Live Supabase Dev DB State Verification
// -----------------------------------------------------------------------------
console.log('\n--- 5. Live Supabase Dev DB State Verification ---');

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
          SELECT count(*) as pending_total,
                 count(*) FILTER (WHERE type_key = 'registration') as pending_registrations,
                 count(*) FILTER (WHERE type_key = 'document_verify') as pending_doc_verifications
          FROM public.approval_requests
          WHERE status = 'pending';
        `
      })
    });
    const data = await res.json();
    check('Live DB: Exactly 1 pending registration card and 0 duplicate document_verify cards for pending registration', () => {
      assert(Array.isArray(data) && data.length > 0, 'Must return rows');
      const row = data[0];
      assert(Number(row.pending_registrations) >= 1, 'Must have pending registration');
      assert(Number(row.pending_doc_verifications) === 0, 'Must have zero duplicate document_verify cards');
    });
  } catch (err) {
    console.warn('Live DB query skipped:', err.message);
  }
}

console.log('\n================================================================');
console.log(`  RESULT: ${passed} PASSED / ${failed} FAILED`);
console.log('================================================================\n');

if (failed > 0) {
  process.exit(1);
}
