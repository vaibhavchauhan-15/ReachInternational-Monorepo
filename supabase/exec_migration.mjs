import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://dhbbgfzbyatzvqafnsqp.supabase.co';
const SUPABASE_SECRET_KEY = process.env.SUPABASE_SECRET_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRoYmJnZnpieWF0enZxYWZuc3FwIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NTY1NDI0NywiZXhwIjoyMTAxMjMwMjQ3fQ.DJeNtob56FDLCjgCN2bV3vNIl2Sutg1CbN_ZjvXBi6k';

const admin = createClient(SUPABASE_URL, SUPABASE_SECRET_KEY);

async function run() {
  console.log("Checking database connection...");
  const sql = fs.readFileSync(path.resolve(process.cwd(), 'supabase/migrations/027_rental_manager_role_refinements.sql'), 'utf8');

  // Try RPC if available
  const { data, error } = await admin.rpc('exec_sql', { sql_query: sql });
  if (error) {
    console.log("RPC exec_sql error:", error.message);
  } else {
    console.log("RPC exec_sql success!");
  }
}

run();
