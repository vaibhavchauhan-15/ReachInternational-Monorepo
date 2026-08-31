import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env
const envPath = path.resolve(__dirname, '../.env');
const envContent = fs.readFileSync(envPath, 'utf8');
const env = {};
for (const line of envContent.split('\n')) {
  const trimmed = line.trim();
  if (trimmed && !trimmed.startsWith('#')) {
    const idx = trimmed.indexOf('=');
    if (idx !== -1) {
      const k = trimmed.slice(0, idx).trim();
      let v = trimmed.slice(idx + 1).trim();
      if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
        v = v.slice(1, -1);
      }
      env[k] = v;
    }
  }
}

const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL || env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseKey = env.SUPABASE_SECRET_KEY || env.SUPABASE_SERVICE_ROLE_KEY || env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing Supabase credentials in .env");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { persistSession: false }
});

const dataFile = path.resolve(__dirname, '../../../scratch/data/relational/villages.json');

async function seed() {
  console.log("Starting villages table seed...");
  console.log("Reading villages dataset...");
  const villages = JSON.parse(fs.readFileSync(dataFile, 'utf8'));
  console.log(`Total villages to seed: ${villages.length.toLocaleString()}`);

  const CHUNK_SIZE = 2000;
  const CONCURRENCY = 4;

  for (let i = 0; i < villages.length; i += CHUNK_SIZE * CONCURRENCY) {
    const batchPromises = [];
    for (let c = 0; c < CONCURRENCY; c++) {
      const start = i + c * CHUNK_SIZE;
      if (start < villages.length) {
        const chunk = villages.slice(start, start + CHUNK_SIZE);
        batchPromises.push(
          supabase.from('villages').upsert(chunk, { onConflict: 'id' }).then(({ error }) => {
            if (error) {
              console.error(`Error in chunk ${start}:`, error);
            }
          })
        );
      }
    }
    await Promise.all(batchPromises);
    const completed = Math.min(i + CHUNK_SIZE * CONCURRENCY, villages.length);
    process.stdout.write(`  Inserted ${completed.toLocaleString()}/${villages.length.toLocaleString()} villages\r`);
  }

  console.log(`\n✓ Seeded all ${villages.length.toLocaleString()} villages successfully.`);
}

seed().catch(err => {
  console.error("Fatal seed error:", err);
  process.exit(1);
});
