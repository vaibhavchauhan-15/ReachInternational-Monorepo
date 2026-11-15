#!/usr/bin/env node
/**
 * Idempotent & Comprehensive Backfill: All Legacy Pending Approvals -> Central Approval Engine
 * Target: Reach International Dev (vlmxciuogczumumrwyot)
 * 
 * Flows Backfilled:
 * 1. New User Registrations (public.users WHERE status = 'pending')
 * 2. Identity Document Initial Verifications (public.user_documents WHERE verification_status = 'pending')
 * 3. Profile Detail Change Requests (public.profile_change_requests WHERE status = 'pending')
 * 4. Account Deletion Requests (public.account_deletion_requests WHERE status = 'pending')
 * 5. Document Replacement Requests (public.document_change_requests WHERE status = 'pending')
 * 
 * Usage:
 *   node supabase/scripts/backfill_all_approvals.mjs [--dry-run]
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

// Safety gate: never run against production
if (SUPABASE_URL.includes('dhbbgfzbyatzvqafnsqp')) {
  console.error('🛑 FATAL: Production database dhbbgfzbyatzvqafnsqp is protected.');
  process.exit(1);
}

const isDryRun = process.argv.includes('--dry-run');

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function main() {
  console.log('\n================================================================');
  console.log('  CENTRAL APPROVAL ENGINE: MASTER BACKFILL PIPELINE');
  console.log(`  Target: ${SUPABASE_URL}`);
  console.log(`  Mode:   ${isDryRun ? 'DRY-RUN (Simulated)' : 'LIVE EXECUTION'}`);
  console.log('================================================================\n');

  // Verify approval_requests table exists
  const { data: testReqs, error: tableErr } = await supabase
    .from('approval_requests')
    .select('id')
    .limit(1);

  if (tableErr) {
    console.error('❌ FATAL: public.approval_requests is not in schema cache.');
    console.error('   Please apply migration 200_unified_approval_engine.sql to the database first.');
    console.error(`   Error details: ${tableErr.message}\n`);
    process.exit(1);
  }

  let totalBackfilled = 0;

  // 1. Backfill Pending Registrations
  console.log('--- 1. Checking Pending User Registrations ---');
  const { data: pendingUsers, error: usersErr } = await supabase
    .from('users')
    .select('id, full_name, email, phone, role, supervisor_id, street, city, district, state, machine_category, created_at')
    .eq('status', 'pending');

  if (usersErr) {
    console.warn(`  ⚠️ Failed to fetch pending users: ${usersErr.message}`);
  } else {
    console.log(`  Found ${pendingUsers?.length || 0} pending users in public.users.`);
    for (const u of pendingUsers || []) {
      const { data: existing } = await supabase
        .from('approval_requests')
        .select('id')
        .eq('type_key', 'registration')
        .eq('subject_id', u.id)
        .eq('status', 'pending')
        .maybeSingle();

      if (!existing) {
        if (!isDryRun) {
          await supabase.from('approval_requests').insert({
            type_key: 'registration',
            subject_type: 'user',
            subject_id: u.id,
            subject_label: `${u.full_name || 'User'} (${u.role})`,
            requested_by: u.id,
            status: 'pending',
            summary: `New registration: ${u.full_name || 'User'} (${u.role})`,
            payload: u,
            created_at: u.created_at || new Date().toISOString(),
          });
        }
        console.log(`  [+] Backfilled registration: ${u.full_name || u.id} (${u.role})`);
        totalBackfilled++;
      } else {
        console.log(`  [=] Already tracked: ${u.full_name || u.id}`);
      }
    }
  }

  // 2. Backfill Pending Document Verifications
  console.log('\n--- 2. Checking Pending Document Initial Verifications ---');
  const { data: pendingDocs, error: docsErr } = await supabase
    .from('user_documents')
    .select('id, user_id, document_type_code, storage_path, thumb_path, mime_type, file_size_bytes, file_name, created_at')
    .eq('verification_status', 'pending');

  if (docsErr) {
    console.warn(`  ⚠️ Failed to fetch pending documents: ${docsErr.message}`);
  } else {
    console.log(`  Found ${pendingDocs?.length || 0} pending documents in public.user_documents.`);
    for (const doc of pendingDocs || []) {
      const { data: existing } = await supabase
        .from('approval_requests')
        .select('id')
        .eq('type_key', 'document_verify')
        .eq('subject_id', doc.id)
        .eq('status', 'pending')
        .maybeSingle();

      if (!existing) {
        if (!isDryRun) {
          await supabase.from('approval_requests').insert({
            type_key: 'document_verify',
            subject_type: 'document',
            subject_id: doc.id,
            subject_label: `${doc.document_type_code.toUpperCase()} (${doc.user_id})`,
            requested_by: doc.user_id,
            status: 'pending',
            summary: `Initial verification for ${doc.document_type_code}`,
            payload: {
              document_id: doc.id,
              user_id: doc.user_id,
              document_type_code: doc.document_type_code,
              storage_path: doc.storage_path,
              thumb_path: doc.thumb_path,
              mime_type: doc.mime_type,
              file_size_bytes: doc.file_size_bytes,
            },
            created_at: doc.created_at || new Date().toISOString(),
          });
        }
        console.log(`  [+] Backfilled document verify: ${doc.document_type_code} (Doc ${doc.id})`);
        totalBackfilled++;
      } else {
        console.log(`  [=] Already tracked: Doc ${doc.id}`);
      }
    }
  }

  // 3. Backfill Pending Profile Change Requests
  console.log('\n--- 3. Checking Pending Profile Change Requests ---');
  const { data: profileReqs, error: pErr } = await supabase
    .from('profile_change_requests')
    .select('id, user_id, requester_role, current_data, requested_data, target_approver_role, created_at')
    .eq('status', 'pending');

  if (pErr) {
    console.warn(`  ⚠️ Failed to fetch profile change requests: ${pErr.message}`);
  } else {
    console.log(`  Found ${profileReqs?.length || 0} pending profile change requests.`);
    for (const pr of profileReqs || []) {
      const { data: existing } = await supabase
        .from('approval_requests')
        .select('id')
        .eq('type_key', 'profile_change')
        .eq('subject_id', pr.id)
        .eq('status', 'pending')
        .maybeSingle();

      if (!existing) {
        if (!isDryRun) {
          await supabase.from('approval_requests').insert({
            type_key: 'profile_change',
            subject_type: 'user',
            subject_id: pr.id,
            subject_label: `Profile changes for user ${pr.user_id}`,
            requested_by: pr.user_id,
            status: 'pending',
            summary: `Profile change request for user ${pr.user_id}`,
            payload: {
              legacy_request_id: pr.id,
              target_user_id: pr.user_id,
              changes: pr.requested_data,
              current_snapshot: pr.current_data,
            },
            created_at: pr.created_at || new Date().toISOString(),
          });
        }
        console.log(`  [+] Backfilled profile change: Request ${pr.id}`);
        totalBackfilled++;
      }
    }
  }

  // 4. Backfill Pending Account Deletion Requests
  console.log('\n--- 4. Checking Pending Account Deletion Requests ---');
  const { data: deletionReqs, error: dErr } = await supabase
    .from('account_deletion_requests')
    .select('id, user_id, email, full_name, phone, role, reason, source, created_at')
    .eq('status', 'pending');

  if (dErr) {
    console.warn(`  ⚠️ Failed to fetch account deletion requests: ${dErr.message}`);
  } else {
    console.log(`  Found ${deletionReqs?.length || 0} pending account deletion requests.`);
    for (const dr of deletionReqs || []) {
      const { data: existing } = await supabase
        .from('approval_requests')
        .select('id')
        .eq('type_key', 'account_deletion')
        .eq('subject_id', dr.id)
        .eq('status', 'pending')
        .maybeSingle();

      if (!existing) {
        if (!isDryRun) {
          await supabase.from('approval_requests').insert({
            type_key: 'account_deletion',
            subject_type: 'user',
            subject_id: dr.id,
            subject_label: `${dr.full_name || dr.email} (${dr.email})`,
            requested_by: dr.user_id || dr.id,
            status: 'pending',
            summary: `Account deletion request: ${dr.full_name || dr.email}`,
            payload: dr,
            created_at: dr.created_at || new Date().toISOString(),
          });
        }
        console.log(`  [+] Backfilled account deletion: Request ${dr.id}`);
        totalBackfilled++;
      }
    }
  }

  // 5. Backfill Pending Document Replacements
  console.log('\n--- 5. Checking Pending Document Replacement Requests ---');
  const { data: replaceReqs, error: rErr } = await supabase
    .from('document_change_requests')
    .select('id, user_id, document_type_code, staging_path, staging_thumb_path, created_at')
    .eq('status', 'pending');

  if (rErr) {
    console.warn(`  ⚠️ Failed to fetch document change requests: ${rErr.message}`);
  } else {
    console.log(`  Found ${replaceReqs?.length || 0} pending document replacement requests.`);
    for (const rr of replaceReqs || []) {
      const { data: existing } = await supabase
        .from('approval_requests')
        .select('id')
        .eq('type_key', 'document_replace')
        .eq('subject_id', rr.id)
        .eq('status', 'pending')
        .maybeSingle();

      if (!existing) {
        if (!isDryRun) {
          await supabase.from('approval_requests').insert({
            type_key: 'document_replace',
            subject_type: 'document',
            subject_id: rr.id,
            subject_label: `${rr.document_type_code.toUpperCase()} replacement`,
            requested_by: rr.user_id,
            status: 'pending',
            summary: `Document replacement request for ${rr.document_type_code}`,
            payload: rr,
            created_at: rr.created_at || new Date().toISOString(),
          });
        }
        console.log(`  [+] Backfilled document replacement: Request ${rr.id}`);
        totalBackfilled++;
      }
    }
  }

  console.log('\n================================================================');
  console.log(`  COMPLETED: ${totalBackfilled} pending items backfilled to approval engine.`);
  console.log('================================================================\n');
}

main().catch(console.error);
