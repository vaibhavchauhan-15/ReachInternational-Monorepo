import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_SECRET_KEY = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SECRET_KEY) {
  console.log("No SUPABASE_URL or SUPABASE_SECRET_KEY found in process.env. Skipping direct SQL RPC.");
  process.exit(0);
}

const admin = createClient(SUPABASE_URL, SUPABASE_SECRET_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function run() {
  const migrationPath = path.resolve(process.cwd(), 'supabase/migrations/049_add_address_to_signup_and_user_profile.sql');
  const sql = fs.readFileSync(migrationPath, 'utf8');

  console.log("Applying migration 049_add_address_to_signup_and_user_profile.sql...");
  const { data, error } = await admin.rpc('exec_sql', { sql_query: sql });
  if (error) {
    console.log("RPC exec_sql response:", error.message);
  } else {
    console.log("Migration 049 applied successfully via exec_sql!");
  }
}

run().catch(console.error);
