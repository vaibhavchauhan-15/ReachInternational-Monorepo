# Incident: Storage Bucket & Media Upload Failures

## Purpose
This runbook provides diagnostic and recovery procedures for media upload failures, missing Supabase Storage buckets, Row Level Security (RLS) upload denials, expired signed URLs, and storage quota exhaustion.

## Impact
- **Systems Affected**: Supabase Storage (`storage.buckets`, `storage.objects`), Mobile Media Handler (`apps/mobile/lib/media.ts`), Web Document Viewers (`apps/web/components/**`).
- **User Impact**: Mobile service technicians cannot upload Field Service Report (FSR) photos or breakdown damage snapshots. Administrative users cannot preview customer contracts or employee KYC documents.
- **Operational Impact**: FSR submission may be blocked if mandatory photo attachments fail upload validation. Core database shift logs remain unblocked.

## Symptoms
- **HTTP 403 / 404 on Uploads**:
  ```text
  Upload failed: 403 Forbidden on storage.from("machine-photos")
  or:
  Bucket not found: 'fsr-photos'
  ```
- **Client-Side Validation Failures (`apps/mobile/lib/media.ts`)**:
  ```text
  Invalid file type 'image/heic'. Allowed types: JPEG, PNG, WEBP, PDF.
  or:
  File size (14.2MB) exceeds maximum limit of 10MB.
  ```
- **Broken Media Previews Due to Expired Signed URLs**:
  Image previews fail with HTTP 400 / 403 `ExpiredToken` on private buckets (`employee-documents`, `customer-documents`, `delivery-documents`).
- **Storage Volume Saturation**:
  Supabase Console reports storage usage approaching plan limits (e.g. >95%).

## Severity
**P2 (Medium)** — Uploads degraded; core database transactions continue.

## Immediate Actions
1. **Verify Bucket Status in Supabase Console (< 2 min)** `[SAFE AUTOMATION]`:
   Navigate to [Supabase Storage](https://supabase.com/dashboard/project/dhbbgfzbyatzvqafnsqp) and confirm the existence of all 5 canonical buckets:
   - `machine-photos` (Public)
   - `fsr-photos` (Public)
   - `employee-documents` (Private)
   - `customer-documents` (Private)
   - `delivery-documents` (Private)
2. **Probe Public Bucket CDN Endpoint (< 3 min)** `[SAFE AUTOMATION]`:
   ```bash
   curl -I "https://dhbbgfzbyatzvqafnsqp.supabase.co/storage/v1/object/public/machine-photos/"
   ```
   *Expected: HTTP 400 or 404 (endpoint responding), NOT HTTP 500 / 502 / 503.*
3. **Notify Field Service Dispatch (< 5 min)**:
   Instruct technicians to store photos locally in their mobile device gallery if upload errors persist until resolved.

## Diagnosis
1. **Query Storage Bucket Configuration** `[SAFE AUTOMATION]`:
   Execute in Supabase SQL Editor:
   ```sql
   SELECT 
     id, 
     name, 
     public, 
     file_size_limit, 
     allowed_mime_types, 
     created_at
   FROM storage.buckets;
   ```
   *Verify all 5 canonical buckets exist and public flags match requirements.*
2. **Inspect Storage Object RLS Policies** `[SAFE AUTOMATION]`:
   ```sql
   SELECT 
     policyname, 
     cmd, 
     roles, 
     qual, 
     with_check
   FROM pg_policies
   WHERE schemaname = 'storage' 
     AND tablename = 'objects';
   ```
   *Check for missing `INSERT` policies for the `authenticated` role.*
3. **Check Signed URL Expiration Duration** `[SAFE AUTOMATION]`:
   Inspect signed URL generation calls in code. URLs for mobile preview should use at least 3,600s (1 hr); download links for customer reports should use 86,400s (24 hrs).

## Recovery
1. **Re-create Missing Canonical Storage Buckets** `[REQUIRES HUMAN APPROVAL]`:
   If any bucket was accidentally dropped, re-create it via the SQL Editor:
   ```sql
   -- Public Media Buckets
   INSERT INTO storage.buckets (id, name, public, file_size_limit)
   VALUES 
     ('machine-photos', 'machine-photos', true, 10485760),
     ('fsr-photos', 'fsr-photos', true, 10485760)
   ON CONFLICT (id) DO UPDATE 
   SET public = true, file_size_limit = 10485760;

   -- Private Document Buckets
   INSERT INTO storage.buckets (id, name, public, file_size_limit)
   VALUES 
     ('employee-documents', 'employee-documents', false, 15728640),
     ('customer-documents', 'customer-documents', false, 15728640),
     ('delivery-documents', 'delivery-documents', false, 15728640)
   ON CONFLICT (id) DO UPDATE 
   SET public = false, file_size_limit = 15728640;
   ```
2. **Re-apply Canonical Storage RLS Policies** `[REQUIRES HUMAN APPROVAL]`:
   ```sql
   DO $$
   BEGIN
     -- Allow authenticated users to upload to canonical buckets
     IF NOT EXISTS (
       SELECT 1 FROM pg_policies 
       WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'Allow authenticated uploads'
     ) THEN
       CREATE POLICY "Allow authenticated uploads" ON storage.objects
       FOR INSERT TO authenticated
       WITH CHECK (bucket_id IN ('machine-photos', 'fsr-photos', 'employee-documents', 'customer-documents', 'delivery-documents'));
     END IF;

     -- Allow public reads on machine and FSR photos
     IF NOT EXISTS (
       SELECT 1 FROM pg_policies 
       WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'Allow public reads on public buckets'
     ) THEN
       CREATE POLICY "Allow public reads on public buckets" ON storage.objects
       FOR SELECT TO public
       USING (bucket_id IN ('machine-photos', 'fsr-photos'));
     END IF;

     -- Allow authenticated reads on private documents
     IF NOT EXISTS (
       SELECT 1 FROM pg_policies 
       WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'Allow authenticated reads on private documents'
     ) THEN
       CREATE POLICY "Allow authenticated reads on private documents" ON storage.objects
       FOR SELECT TO authenticated
       USING (bucket_id IN ('employee-documents', 'customer-documents', 'delivery-documents'));
     END IF;
   END $$;
   ```
3. **Purge Orphaned Multipart Uploads** `[REQUIRES HUMAN APPROVAL]`:
   If incomplete client uploads accumulated, purge abandoned chunks via the Supabase Storage settings dashboard.

## Validation
1. **Verify Storage API Connectivity via Node.js**:
   Run verification from the project root:
   ```bash
   node -e "
     import('@supabase/supabase-js').then(async ({ createClient }) => {
       const client = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY);
       const { data, error } = await client.storage.getBucket('machine-photos');
       if (error) { console.error('FAIL:', error); process.exit(1); }
       console.log('PASS: Bucket machine-photos is online (public: ' + data.public + ')');
     });
   "
   ```
   *Pass Condition: `PASS: Bucket machine-photos is online (public: true)`.*
2. **Verify Mobile Media Upload**:
   In the mobile app, navigate to any machine detail screen and upload a test photo. Confirm upload completes with HTTP 200 and image renders cleanly.

## Rollback
- **Storage Configuration Rollback**: "No verified rollback mechanism found."  
  *(Supabase Storage does not provide one-click bucket rollback. If policies or bucket settings were misconfigured, revert by re-executing the canonical SQL script in the Recovery section).*

## Escalation
- Escalate to Supabase Support if the Storage API returns persistent HTTP 500/502/503 errors unrelated to RLS or configuration.
- Escalate to Lead Database Administrator if storage quota limits require immediate volume expansion.

## Do Not
- **DO NOT** disable Row Level Security on `storage.objects` (`ALTER TABLE storage.objects DISABLE ROW LEVEL SECURITY`).
- **DO NOT** convert private document buckets (`employee-documents`, `customer-documents`, `delivery-documents`) to public; this would expose confidential KYC and customer contracts.
- **DO NOT** delete `storage.objects` rows manually without cleaning up corresponding foreign key references in `public.machine_photos` or `public.fsrs`.
- **DO NOT** raise `file_size_limit` beyond 20MB without reviewing client compression and bandwidth constraints.

## Root Cause Follow-Up
- Audit mobile upload retry logic in `apps/mobile/lib/media.ts` for automatic offline queueing.
- Record incident in `public.audit_logs`:
  ```sql
  INSERT INTO public.audit_logs (action, category, severity, details, created_at)
  VALUES ('STORAGE_RECOVERY_COMPLETED', 'storage', 'MEDIUM', '{"buckets_verified": 5}', now());
  ```
- File incident summary in [`performance/monitoring/incidents.md`](../performance/monitoring/incidents.md).
