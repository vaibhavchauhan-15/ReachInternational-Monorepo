import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_SECRET_KEY = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SECRET_KEY) {
  console.error("Missing SUPABASE_URL or SUPABASE_SECRET_KEY environment variable. Set them before running.");
  process.exit(1);
}

const admin = createClient(SUPABASE_URL, SUPABASE_SECRET_KEY);

async function run() {
  console.log("Checking database connection and running migration 033_todo_task_management.sql...");
  const sql = fs.readFileSync(path.resolve(process.cwd(), 'supabase/migrations/033_todo_task_management.sql'), 'utf8');

  // Try RPC if available
  const { data, error } = await admin.rpc('exec_sql', { sql_query: sql });
  if (error) {
    console.log("RPC exec_sql error:", error.message);
  } else {
    console.log("RPC exec_sql success!");
  }
}

run();
