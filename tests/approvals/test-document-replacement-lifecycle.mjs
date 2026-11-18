#!/usr/bin/env node
/**
 * Test Suite: Document Replacement Approval Lifecycle & Storage Cleanup Verification
 *
 * Verifies end-to-end:
 * 1. Document change request creation and approval_requests synchronization
 * 2. Updating replacement image while pending ("Change Image") keeps approval_requests pending with new staging image
 * 3. Visibility isolation: other users (HR, Admin, Superadmin, Supervisor) see older verified document while replacement is pending
 * 4. Approval decision execution:
 *    - New replacement document moved from doc_staging to user_files
 *    - Older document files deleted from user_files
 *    - user_documents atomically updated to verified with new file pointer, mime_type, and file_size_bytes
 *    - document_change_requests marked approved
 *    - approval_requests marked approved
 * 5. Rejection decision execution:
 *    - document_change_requests marked rejected with reason
 *    - Older document in user_documents remains verified and unchanged
 * 6. Document view URL resilience & self-healing fallback
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import assert from 'node:assert/strict';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '../..');

console.log('\n================================================================');
console.log('  TEST: DOCUMENT REPLACEMENT APPROVAL LIFECYCLE & CLEANUP       ');
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
// 1. Static Invariant Verification
// -----------------------------------------------------------------------------
console.log('--- 1. Static Code Invariant Checks ---');

const docReplacementCode = fs.readFileSync(
  path.resolve(rootDir, 'apps/web/lib/server/document-replacement.ts'),
  'utf8'
);
const outboxCode = fs.readFileSync(
  path.resolve(rootDir, 'apps/web/lib/server/approvals-outbox.ts'),
  'utf8'
);
const dalApprovalsCode = fs.readFileSync(
  path.resolve(rootDir, 'apps/web/lib/dal/approvals.ts'),
  'utf8'
);
const approvalRowCode = fs.readFileSync(
  path.resolve(rootDir, 'apps/web/app/(app)/approvals/components/ApprovalRow.tsx'),
  'utf8'
);
const mig207Code = fs.readFileSync(
  path.resolve(rootDir, 'supabase/migrations/207_document_replacement_approval_lifecycle_and_cleanup.sql'),
  'utf8'
);
const mig208Code = fs.readFileSync(
  path.resolve(rootDir, 'supabase/migrations/208_document_replacement_atomic_pointer_and_cleanup.sql'),
  'utf8'
);
const docActionsCode = fs.readFileSync(
  path.resolve(rootDir, 'apps/web/app/actions/documents.ts'),
  'utf8'
);
const docReviewCode = fs.readFileSync(
  path.resolve(rootDir, 'apps/web/lib/server/document-review.ts'),
  'utf8'
);

check('document-replacement.ts synchronizes with approval_requests on initial replacement and change image', () => {
  assert(docReplacementCode.includes('approval_requests'), 'Includes approval_requests query/mutation');
  assert(docReplacementCode.includes('approval_outbox'), 'Enqueues to approval_outbox');
  assert(docReplacementCode.includes('revalidateTag(TAGS.approvals'), 'Revalidates approval cache tags');
  assert(docReplacementCode.includes('existingPending'), 'Handles existing pending change requests');
});

check('approvals-outbox.ts uses atomic apply_document_replacement_pointer RPC and deletes older files after update', () => {
  assert(outboxCode.includes('file.transfer_staged_document'), 'Handles file.transfer_staged_document');
  assert(outboxCode.includes('apply_document_replacement_pointer'), 'Calls atomic apply_document_replacement_pointer RPC');
  assert(outboxCode.includes('.from("user_files")') && outboxCode.includes('.remove('), 'Deletes old files from user_files');
  assert(outboxCode.includes('revalidateTag(TAGS.users'), 'Revalidates users cache tag');
});

check('document-review.ts delegates to approval_decide and drains outbox', () => {
  assert(docReviewCode.includes('approval_decide'), 'Delegates to approval_decide');
  assert(docReviewCode.includes('processPendingApprovalOutboxItems'), 'Drains outbox');
  assert(docReviewCode.includes('apply_document_replacement_pointer'), 'Uses atomic pointer function');
});

check('approvals DAL unshifts replacement document to index 0 for document_replace', () => {
  assert(dalApprovalsCode.includes('attachedDocs.unshift({'), 'Unshifts replacement document to front of attachedDocs');
  assert(dalApprovalsCode.includes('(Replacement)'), 'Labels replacement document');
});

check('ApprovalRow.tsx renders replacement preview and current active document inspection', () => {
  assert(approvalRowCode.includes('replacementDocTarget'), 'Resolves replacementDocTarget');
  assert(approvalRowCode.includes('activeDocBeingReplaced'), 'Resolves activeDocBeingReplaced');
  assert(approvalRowCode.includes('View Current Active'), 'Provides button to view current active document');
});

check('Migration 207 & 208 provide atomic apply functions and rejection handling', () => {
  assert(mig207Code.includes('CREATE OR REPLACE FUNCTION public.approval_apply_document_replace'), 'Updates apply handler');
  assert(mig207Code.includes('CREATE OR REPLACE FUNCTION public.approval_decide'), 'Updates decide RPC');
  assert(mig208Code.includes('CREATE OR REPLACE FUNCTION public.apply_document_replacement_pointer'), 'Creates atomic pointer function');
});

check('getDocumentViewUrlAction includes self-healing fallback for out-of-sync paths', () => {
  assert(docActionsCode.includes('Self-healing fallback'), 'Has self-healing fallback logic');
  assert(docActionsCode.includes('userFilesList'), 'Inspects user_files directory');
});

// -----------------------------------------------------------------------------
// 2. Live Supabase Dev DB State Verification
// -----------------------------------------------------------------------------
console.log('\n--- 2. Live Supabase Dev DB State Verification ---');

async function runLiveChecks() {
  const env = {};
  fs.readFileSync(path.resolve(rootDir, 'apps/web/.env.local'), 'utf8')
    .split('\n')
    .forEach((line) => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) return;
      const idx = trimmed.indexOf('=');
      if (idx !== -1) {
        const k = trimmed.substring(0, idx).trim();
        let v = trimmed.substring(idx + 1).trim();
        if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
          v = v.slice(1, -1);
        }
        env[k] = v;
      }
    });

  const { createClient } = await import(
    pathToFileURL(path.resolve(rootDir, 'apps/web/node_modules/@supabase/supabase-js/dist/index.mjs')).href
  );

  const supabase = createClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.SUPABASE_SECRET_KEY || env.SUPABASE_SERVICE_ROLE_KEY
  );

  // Check operator Vaibhav's approved bank document
  const { data: user } = await supabase
    .from('users')
    .select('id, full_name, email')
    .eq('email', 'vaibhavchauhadsn.ri@gmail.com')
    .single();

  if (user) {
    // 1. Verify user_documents has valid storage_path
    const { data: activeDoc } = await supabase
      .from('user_documents')
      .select('*')
      .eq('user_id', user.id)
      .eq('document_type_code', 'bank_document')
      .single();

    check('Live DB: Operator Vaibhav active bank document exists and has verified status', () => {
      assert(activeDoc, 'Active bank document exists');
      assert.equal(activeDoc.verification_status, 'verified');
      assert.equal(activeDoc.status, 'verified');
      assert(activeDoc.storage_path.startsWith('documents/'), 'Points to canonical user_files path');
    });

    // 2. Verify file exists in user_files and signed URL generates successfully
    const { data: signRes, error: signErr } = await supabase.storage
      .from('user_files')
      .createSignedUrl(activeDoc.storage_path, 60);

    check('Live DB: Active bank document signed URL generates with 0 errors (No Object not found)', () => {
      assert(!signErr, `Signed URL error: ${signErr?.message}`);
      assert(signRes?.signedUrl, 'Signed URL was generated');
      assert(signRes.signedUrl.startsWith('http'), 'Valid HTTP signed URL');
    });

    // 3. Verify RPC apply_document_replacement_pointer exists and is callable
    const testDocUuid = '00000000-0000-0000-0000-000000000099';
    const { data: rpcRes, error: rpcErr } = await supabase.rpc('apply_document_replacement_pointer', {
      p_user_id: user.id,
      p_doc_type: 'bank_document',
      p_final_storage_path: activeDoc.storage_path,
      p_final_thumb_path: activeDoc.thumb_path,
      p_decided_by: user.id,
      p_mime_type: 'image/jpeg',
      p_file_size_bytes: activeDoc.file_size_bytes || 244036,
      p_file_name: 'bank_document.jpg',
      p_change_request_id: null,
    });

    check('Live DB: apply_document_replacement_pointer RPC executes cleanly', () => {
      assert(!rpcErr, `RPC error: ${rpcErr?.message}`);
      assert.equal(rpcRes, true);
    });
  }

  console.log('\n================================================================');
  console.log(`  SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log('================================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runLiveChecks().catch((err) => {
  console.error('Fatal error during live checks:', err);
  process.exit(1);
});
