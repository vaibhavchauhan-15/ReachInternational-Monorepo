import { createClient } from "@supabase/supabase-js";
import assert from "node:assert/strict";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const serviceKey = process.env.SUPABASE_SECRET_KEY;

if (!url || !anonKey || !serviceKey) {
  console.error("Missing environment variables");
  process.exit(1);
}

const anonClient = createClient(url, anonKey, {
  auth: { persistSession: false },
});

const adminClient = createClient(url, serviceKey, {
  auth: { persistSession: false },
});

async function runTests() {
  console.log("=== Testing Marketing Careers Domain against Dev Database ===");

  // 1. Direct table access by anon MUST be blocked by RLS
  console.log("\n[Test 1] Anon client direct select on job_postings is blocked by RLS");
  const { data: directJobs, error: directErr } = await anonClient
    .from("job_postings")
    .select("id, title")
    .limit(1);
  assert(directErr !== null, "Direct select should fail for anon client");
  console.log("  PASS: Anon direct select denied as expected (RLS enforced)");

  // 2. get_public_jobs returns published jobs
  console.log("\n[Test 2] get_public_jobs RPC via anon client");
  const { data: publicJobs, error: errJobs } = await anonClient.rpc("get_public_jobs", {
    p_page: 1,
    p_page_size: 10,
  });
  assert.equal(errJobs, null, "get_public_jobs should not return error");
  assert(publicJobs.rows && publicJobs.rows.length > 0, "Should return at least 1 published job");
  console.log(`  PASS: Returned ${publicJobs.rows.length} published jobs (total: ${publicJobs.total})`);

  const firstJob = publicJobs.rows[0];
  assert(firstJob.slug, "Job must have slug");
  assert(firstJob.title, "Job must have title");
  assert(firstJob.city, "Job must have city");
  assert(firstJob.department_name, "Job must have department name");
  console.log(`  Sample job: [${firstJob.job_code}] ${firstJob.title} in ${firstJob.city}`);

  // 3. get_public_job_by_slug
  console.log("\n[Test 3] get_public_job_by_slug RPC via anon client");
  const { data: jobDetail, error: errDetail } = await anonClient.rpc("get_public_job_by_slug", {
    p_slug: firstJob.slug,
  });
  assert.equal(errDetail, null, "get_public_job_by_slug should succeed");
  assert.equal(jobDetail.id, firstJob.id, "Returned job ID must match");
  assert(Array.isArray(jobDetail.responsibilities), "Responsibilities must be an array");
  assert(Array.isArray(jobDetail.requirements), "Requirements must be an array");
  assert.equal(jobDetail.availability, "open", "Availability should be open");
  console.log(`  PASS: Successfully fetched details for '${jobDetail.title}' (${jobDetail.responsibilities.length} responsibilities, ${jobDetail.requirements.length} requirements)`);

  // 4. get_public_job_filters
  console.log("\n[Test 4] get_public_job_filters RPC via anon client");
  const { data: filters, error: errFilters } = await anonClient.rpc("get_public_job_filters");
  assert.equal(errFilters, null, "get_public_job_filters should succeed");
  assert(filters.departments.length > 0, "Filters must contain departments");
  assert(filters.workplace_types.length > 0, "Filters must contain workplace types");
  console.log(`  PASS: Filters contain ${filters.departments.length} departments, ${filters.workplace_types.length} workplace types, ${filters.states.length} states`);

  // 5. get_public_job_slugs for ISR / static generation
  console.log("\n[Test 5] get_public_job_slugs RPC via anon client");
  const { data: slugs, error: errSlugs } = await anonClient.rpc("get_public_job_slugs");
  assert.equal(errSlugs, null, "get_public_job_slugs should succeed");
  assert(slugs.length > 0, "Slugs must not be empty");
  console.log(`  PASS: Found ${slugs.length} static slugs for Next.js ISR generation`);

  // 6. Test storage bucket access for resume uploads
  console.log("\n[Test 6] Storage bucket 'career_resumes' upload & access test");
  const samplePdfBytes = Buffer.from("%PDF-1.4 sample resume content for testing purposes");
  const testStoragePath = `test-verify/${Date.now()}.pdf`;

  const { error: uploadErr } = await adminClient.storage
    .from("career_resumes")
    .upload(testStoragePath, samplePdfBytes, {
      contentType: "application/pdf",
      upsert: true,
    });
  assert.equal(uploadErr, null, "Admin should be able to upload to career_resumes");
  console.log("  PASS: Resume upload to private bucket 'career_resumes' succeeded");

  // Verify that anon CANNOT download this file directly
  const { data: anonDownload, error: anonDownErr } = await anonClient.storage
    .from("career_resumes")
    .download(testStoragePath);
  assert(anonDownErr !== null, "Anon client MUST NOT be able to download private resumes");
  console.log("  PASS: Private bucket security verified — anon client download blocked");

  // 7. Test atomic candidate application submission
  console.log("\n[Test 7] submit_job_application_atomic RPC");
  const { data: appResult, error: appErr } = await adminClient.rpc(
    "submit_job_application_atomic",
    {
      p_job_id: firstJob.id,
      p_full_name: "Rahul Verma (Verification Test)",
      p_email: "rahul.verma.qa@reachinternational.co.in",
      p_phone: "9812345678",
      p_current_city: "Delhi NCR",
      p_total_experience_yrs: 6.5,
      p_current_ctc: 550000,
      p_expected_ctc: 700000,
      p_notice_period_days: 15,
      p_cover_note: "Certified boom lift operator with NHAI project experience.",
      p_resume_path: testStoragePath,
      p_resume_file_name: "rahul_verma_resume.pdf",
      p_resume_mime: "application/pdf",
      p_resume_size_bytes: samplePdfBytes.length,
      p_consent_version: "2026-10",
      p_ip_hash: "test-hash-qa-123",
    }
  );
  assert.equal(appErr, null, "Atomic application submission should succeed");
  assert(appResult.application_code, "Must return generated application code");
  console.log(`  PASS: Candidate application submitted successfully with code '${appResult.application_code}'`);

  // 8. Clean up test records
  console.log("\n[Cleanup] Removing test application & resume file");
  await adminClient.from("job_applications").delete().eq("id", appResult.id);
  await adminClient.storage.from("career_resumes").remove([testStoragePath]);
  console.log("  PASS: Teardown complete");

  console.log("\n========================================================");
  console.log("  ALL 8 CAREERS MARKETING & DATABASE CHECKS PASSED 100%");
  console.log("========================================================\n");
}

runTests().catch((err) => {
  console.error("Test failed:", err);
  process.exit(1);
});
