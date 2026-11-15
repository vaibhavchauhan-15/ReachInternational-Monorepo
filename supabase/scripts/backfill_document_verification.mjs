#!/usr/bin/env node
/**
 * Idempotent & Reversible Backfill: User Document Initial Verifications -> Unified Approval Engine
 * Target: Reach International Dev (vlmxciuogczumumrwyot)
 * 
 * Usage:
 *   node supabase/scripts/backfill_document_verification.mjs [--dry-run] [--revert]
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '../..');

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

loadEnvFile(path.resolve(rootDir, '.env'));
loadEnvFile(path.resolve(rootDir, '.env.local'));
loadEnvFile(path.resolve(rootDir, 'apps/web/.env.local'));

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://vlmxciuogczumumrwyot.supabase.co';
const SERVICE_KEY = process.env.SUPABASE_SECRET_KEY;

if (!SERVICE_KEY) {
  console.error('❌ FATAL: Missing SUPABASE_SECRET_KEY in environment.');
  process.exit(1);
}

// Strict safety check: never touch production
if (SUPABASE_URL.includes('dhbbgfzbyatzvqafnsqp') || SERVICE_KEY.includes('dhbbgfzbyatzvqafnsqp')) {
  console.error('❌ FATAL: Target is PRODUCTION (dhbbgfzbyatzvqafnsqp). Backfill script blocked.');
  process.exit(1);
}

const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const isDryRun = process.argv.includes('--dry-run');
const isRevert = process.argv.includes('--revert');

async function main() {
  console.log('\n================================================================');
  console.log('  BACKFILL: USER DOCUMENT VERIFICATIONS -> UNIFIED APPROVAL ENGINE');
  console.log(`  Target: ${SUPABASE_URL}`);
  console.log(`  Mode: ${isDryRun ? 'DRY-RUN (no changes written)' : isRevert ? 'REVERT' : 'APPLY'}`);
  console.log('================================================================\n');

  if (isRevert) {
    console.log('Rolling back backfilled document verification approval requests...');
    if (isDryRun) {
      const { count } = await admin
        .from('approval_requests')
        .select('*', { count: 'exact', head: true })
        .eq('type_key', 'document_verify');
      console.log(`[DRY-RUN] Would delete ${count || 0} approval requests of type document_verify.`);
      return;
    }

    const { error: delErr } = await admin
      .from('approval_requests')
      .delete()
      .eq('type_key', 'document_verify');

    if (delErr) {
      console.error('❌ Revert failed:', delErr.message);
      process.exit(1);
    }
    console.log('✅ Revert complete. All document_verify approval requests removed.');
    return;
  }

  // 1. Fetch all documents from user_documents
  const { data: documents, error: docErr } = await admin
    .from('user_documents')
    .select('id, user_id, document_type_code, storage_path, verification_status, verified_by, verified_at, rejection_reason, created_at');

  if (docErr) {
    console.error('❌ Failed to fetch user_documents:', docErr.message);
    process.exit(1);
  }

  console.log(`Found ${documents.length} existing user documents.`);

  // 2. Fetch existing approval_requests with type_key = 'document_verify' to guarantee idempotency
  const { data: existingRequests, error: reqErr } = await admin
    .from('approval_requests')
    .select('subject_id')
    .eq('type_key', 'document_verify');

  if (reqErr) {
    console.error('❌ Failed to fetch existing approval requests:', reqErr.message);
    process.exit(1);
  }

  const existingSubjectIds = new Set((existingRequests || []).map((r) => r.subject_id));
  console.log(`Found ${existingSubjectIds.size} documents already registered in approval_requests.`);

  // 3. Compute missing records
  const toBackfill = documents.filter((doc) => !existingSubjectIds.has(doc.id));
  console.log(`Documents to backfill: ${toBackfill.length}`);

  if (toBackfill.length === 0) {
    console.log('✅ All documents already backfilled into approval engine. Nothing to do.');
    return;
  }

  let pendingCount = 0;
  let approvedCount = 0;
  let rejectedCount = 0;

  const rowsToInsert = toBackfill.map((doc) => {
    let status = 'pending';
    if (doc.verification_status === 'verified') {
      status = 'approved';
      approvedCount++;
    } else if (doc.verification_status === 'rejected') {
      status = 'rejected';
      rejectedCount++;
    } else {
      pendingCount++;
    }

    const typeLabel = doc.document_type_code ? doc.document_type_code.replace(/_/g, ' ').toUpperCase() : 'DOCUMENT';

    return {
      type_key: 'document_verify',
      subject_type: 'document',
      subject_id: doc.id,
      requested_by: doc.user_id,
      status,
      summary: `Verify ${typeLabel}`,
      subject_label: doc.document_type_code,
      payload: {
        document_id: doc.id,
        document_type_code: doc.document_type_code,
        user_id: doc.user_id,
        storage_path: doc.storage_path,
      },
      decided_by: doc.verified_by || null,
      decided_at: doc.verified_at || (status !== 'pending' ? doc.created_at : null),
      decision_note: doc.rejection_reason || null,
      created_at: doc.created_at || new Date().toISOString(),
      updated_at: doc.verified_at || doc.created_at || new Date().toISOString(),
    };
  });

  console.log(`\nBackfill Summary:`);
  console.log(`- Total new requests: ${rowsToInsert.length}`);
  console.log(`  - Pending:  ${pendingCount}`);
  console.log(`  - Approved: ${approvedCount}`);
  console.log(`  - Rejected: ${rejectedCount}`);

  if (isDryRun) {
    console.log('\n[DRY-RUN] Execution skipped. Run without --dry-run to apply.');
    return;
  }

  // Insert in batches of 100
  const BATCH_SIZE = 100;
  for (let i = 0; i < rowsToInsert.length; i += BATCH_SIZE) {
    const chunk = rowsToInsert.slice(i, i + BATCH_SIZE);
    const { error: insErr } = await admin.from('approval_requests').insert(chunk);
    if (insErr) {
      console.error(`❌ Failed to insert batch starting at index ${i}:`, insErr.message);
      process.exit(1);
    }
  }

  console.log(`\n✅ Successfully backfilled ${rowsToInsert.length} documents into approval_requests!`);
}

main().catch((err) => {
  console.error('Fatal error during backfill:', err);
  process.exit(1);
});
