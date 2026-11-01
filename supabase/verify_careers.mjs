import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

function loadEnv() {
  const envFiles = [
    path.resolve(process.cwd(), '.env'),
    path.resolve(process.cwd(), 'apps/web/.env.local'),
  ];
  for (const envPath of envFiles) {
    if (fs.existsSync(envPath)) {
      const content = fs.readFileSync(envPath, 'utf8');
      content.split('\n').forEach((line) => {
        const trimmed = line.trim();
        if (trimmed && !trimmed.startsWith('#')) {
          const [key, ...vals] = trimmed.split('=');
          if (key && vals.length > 0) {
            const k = key.trim();
            const v = vals.join('=').trim().replace(/^["']|["']$/g, '');
            if (!process.env[k]) {
              process.env[k] = v;
            }
          }
        }
      });
    }
  }
}

loadEnv();

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const SUPABASE_SECRET_KEY = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

const anonClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const adminClient = createClient(SUPABASE_URL, SUPABASE_SECRET_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function runVerification() {
  console.log('--- Verifying Careers & Hiring Database & RPCs ---');

  // Test 1: Direct anon query on job_postings should return empty or fail due to RLS
  const { data: directJobs, error: directErr } = await anonClient
    .from('job_postings')
    .select('id, title');

  console.log('1. Direct anon select on job_postings:', {
    rowCount: directJobs?.length || 0,
    hasError: Boolean(directErr),
    error: directErr?.message || null,
  });

  // Test 2: Public RPC get_public_jobs
  const { data: publicJobs, error: publicJobsErr } = await anonClient.rpc('get_public_jobs', {
    p_page: 1,
    p_page_size: 10,
  });

  console.log('2. get_public_jobs() RPC response:');
  if (publicJobsErr) {
    console.error('   RPC error:', publicJobsErr);
  } else {
    const jobList = publicJobs?.rows || publicJobs?.jobs || [];
    console.log(`   Total open jobs: ${publicJobs?.total}`);
    console.log(`   Returned count: ${jobList.length}`);
    for (const j of jobList) {
      console.log(`   - [${j.job_code}] ${j.title} (${j.city})`);
    }
  }

  // Test 3: Public RPC get_public_job_by_slug
  const testSlug = 'senior-heavy-equipment-mechanic';
  const { data: singleJob, error: singleErr } = await anonClient.rpc('get_public_job_by_slug', {
    p_slug: testSlug,
  });

  console.log(`3. get_public_job_by_slug("${testSlug}"):`);
  if (singleErr) {
    console.error('   Error:', singleErr);
  } else {
    console.log(`   Found: ${singleJob?.title} | Status: ${singleJob?.availability} | Resp count: ${singleJob?.responsibilities?.length}`);
  }

  // Test 4: Public RPC get_public_job_filters
  const { data: filters, error: filtersErr } = await anonClient.rpc('get_public_job_filters');
  console.log('4. get_public_job_filters():', {
    total: filters?.total,
    departments: filters?.departments?.map((d) => `${d.name} (${d.count})`),
  });

  // Test 5: Admin RPC get_hiring_summary
  const { data: summary, error: sumErr } = await adminClient.rpc('get_hiring_summary');
  console.log('5. get_hiring_summary():', summary || sumErr);

  console.log('\n--- Verification completed ---');
}

runVerification().catch(console.error);
