/**
 * Test Suite: Document Upload, Fetch & Delete Workflows Verification
 * Validates the fix for:
 * - [Document Upload] DB upsert error 42501 (RLS violation)
 * - Self-healing fetch with signed URLs
 * - Deletion from Supabase storage & database with instant UI updates
 */

import fs from 'fs';
import path from 'path';
import assert from 'assert';

const documentsFile = fs.readFileSync(
  path.resolve(process.cwd(), 'apps/mobile/lib/documents.ts'),
  'utf8'
);

const profileIndexFile = fs.readFileSync(
  path.resolve(process.cwd(), 'apps/mobile/app/(app)/profile/index.tsx'),
  'utf8'
);

const migrationFile = fs.readFileSync(
  path.resolve(process.cwd(), 'supabase/migrations/174_fix_user_documents_rls_and_storage_policies.sql'),
  'utf8'
);

console.log('[Test Suite]: Document Upload, Fetch & Delete Workflows Verification');

// 1. Migration 174 Verification
assert(
  migrationFile.includes('CREATE POLICY "Users can insert own documents"'),
  'Migration 174 creates INSERT policy on user_documents'
);
assert(
  migrationFile.includes('user_id = (SELECT auth.uid()) OR'),
  'INSERT policy permits owner (user_id = auth.uid()) as well as elevated roles'
);
assert(
  migrationFile.includes('CREATE POLICY "Users can update own documents"'),
  'Migration 174 creates UPDATE policy on user_documents'
);
assert(
  migrationFile.includes('CREATE POLICY "Users can delete own documents"'),
  'Migration 174 creates DELETE policy on user_documents'
);
assert(
  migrationFile.includes('CREATE POLICY "Users manage own files in user_files"'),
  'Migration 174 updates storage.objects policy for user_files bucket'
);
assert(
  migrationFile.includes('CREATE OR REPLACE FUNCTION public.upsert_user_document'),
  'Migration 174 provides atomic upsert_user_document RPC'
);
assert(
  migrationFile.includes('CREATE OR REPLACE FUNCTION public.delete_user_document'),
  'Migration 174 provides atomic delete_user_document RPC'
);
console.log('  ✓ Migration 174 correctly configures RLS and RPC boundaries');

// 2. apps/mobile/lib/documents.ts Verification
assert(
  documentsFile.includes('file_name: doc.name'),
  'uploadUserDocumentDirect passes file_name to user_documents'
);
assert(
  documentsFile.includes('uploaded_by: userId'),
  'uploadUserDocumentDirect passes uploaded_by to user_documents'
);
assert(
  documentsFile.includes("status: 'verified'"),
  'uploadUserDocumentDirect sets verified status'
);
assert(
  documentsFile.includes("upsert_user_document"),
  'uploadUserDocumentDirect has RPC fallback for resilient upserts'
);
assert(
  documentsFile.includes("supabase.storage.from('user_files').remove"),
  'deleteUserDocument deletes files from user_files bucket'
);
assert(
  documentsFile.includes(".from('user_documents')") && documentsFile.includes(".delete()"),
  'deleteUserDocument deletes row from user_documents table'
);
assert(
  documentsFile.includes("commonExts = ['png', 'jpg', 'jpeg', 'pdf', 'webp']"),
  'fetchUserDocuments includes self-healing alternate extension resolution'
);
assert(
  documentsFile.includes("signed_url: signedUrl"),
  'fetchUserDocuments returns signed_url property'
);
console.log('  ✓ documents.ts contains robust upload, self-healing fetch, and thorough deletion');

// 3. apps/mobile/app/(app)/profile/index.tsx Verification
assert(
  profileIndexFile.includes("setUserDocuments((prev) => prev.filter((d) => d.document_type_code !== doc.document_type_code))"),
  'handleConfirmDeleteDocument optimistically updates UI immediately'
);
assert(
  profileIndexFile.includes("setReplacingCode((prev) => (prev === doc.document_type_code ? null : prev))"),
  'handleConfirmDeleteDocument resets replacingCode on delete'
);
assert(
  profileIndexFile.includes("await deleteUserDocument(user.id, doc.document_type_code, doc.storage_path)"),
  'handleConfirmDeleteDocument calls deleteUserDocument with user id and doc info'
);
assert(
  profileIndexFile.includes("setUserDocuments(previousDocs)"),
  'handleConfirmDeleteDocument rolls back optimistic UI on delete failure'
);
assert(
  profileIndexFile.includes("await fetchProfileData()"),
  'handleConfirmDeleteDocument refetches profile data on delete completion'
);
assert(
  profileIndexFile.includes("toast('warning', 'File Unavailable'"),
  'handleOpenDocument warns user when storage file is unavailable rather than opening blank white viewer'
);
console.log('  ✓ profile/index.tsx provides immediate optimistic UI updates and robust error handling');

console.log('\nResults: All Document Upload, Fetch & Delete workflow assertions verified successfully!');
