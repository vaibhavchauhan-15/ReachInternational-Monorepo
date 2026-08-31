import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 1. Load .env
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

const dataDir = path.resolve(__dirname, '../../../scratch/data/relational');

async function runPipeline() {
  console.log("================================================================================");
  console.log("  REACH INTERNATIONAL — MASTER RELATIONAL LOCATION SEEDING PIPELINE");
  console.log("================================================================================");
  console.log(`Connecting to: ${supabaseUrl}`);

  // 1. Seed States
  const states = JSON.parse(fs.readFileSync(path.join(dataDir, 'states.json'), 'utf8'));
  console.log(`\n[1/5] Seeding ${states.length} States & Union Territories...`);
  const { error: stErr } = await supabase.from('states').upsert(states, { onConflict: 'id' });
  if (stErr) {
    console.error("❌ Error inserting states:", stErr);
    process.exit(1);
  }
  console.log(`  ✓ ${states.length} states seeded successfully.`);

  // 2. Seed Districts
  const districts = JSON.parse(fs.readFileSync(path.join(dataDir, 'districts.json'), 'utf8'));
  console.log(`\n[2/5] Seeding ${districts.length} Administrative Districts...`);
  const CHUNK_SIZE = 500;
  for (let i = 0; i < districts.length; i += CHUNK_SIZE) {
    const chunk = districts.slice(i, i + CHUNK_SIZE);
    const { error: dErr } = await supabase.from('districts').upsert(chunk, { onConflict: 'id' });
    if (dErr) {
      console.error(`❌ Error inserting districts batch ${i}:`, dErr);
      process.exit(1);
    }
  }
  console.log(`  ✓ ${districts.length} districts seeded successfully.`);

  // 3. Seed Cities
  const cities = JSON.parse(fs.readFileSync(path.join(dataDir, 'cities.json'), 'utf8'));
  console.log(`\n[3/5] Seeding ${cities.length} Municipal Corporations & Major Cities...`);
  for (let i = 0; i < cities.length; i += CHUNK_SIZE) {
    const chunk = cities.slice(i, i + CHUNK_SIZE);
    const { error: cErr } = await supabase.from('cities').upsert(chunk, { onConflict: 'id' });
    if (cErr) {
      console.error(`❌ Error inserting cities batch ${i}:`, cErr);
      process.exit(1);
    }
  }
  console.log(`  ✓ ${cities.length} cities seeded successfully.`);

  // 4. Seed Towns
  const towns = JSON.parse(fs.readFileSync(path.join(dataDir, 'towns.json'), 'utf8'));
  console.log(`\n[4/5] Seeding ${towns.length.toLocaleString()} Municipal Councils, Nagar Panchayats, Census Towns & Tehsils...`);
  for (let i = 0; i < towns.length; i += CHUNK_SIZE) {
    const chunk = towns.slice(i, i + CHUNK_SIZE);
    const { error: tErr } = await supabase.from('towns').upsert(chunk, { onConflict: 'id' });
    if (tErr) {
      console.error(`❌ Error inserting towns batch ${i}:`, tErr);
      process.exit(1);
    }
    const done = Math.min(i + CHUNK_SIZE, towns.length);
    process.stdout.write(`  Inserted ${done.toLocaleString()}/${towns.length.toLocaleString()} towns\r`);
  }
  console.log(`\n  ✓ ${towns.length.toLocaleString()} towns seeded successfully.`);

  // 5. Seed Villages
  const villages = JSON.parse(fs.readFileSync(path.join(dataDir, 'villages.json'), 'utf8'));
  console.log(`\n[5/5] Seeding ${villages.length.toLocaleString()} Census Revenue Villages in concurrent streams...`);
  const V_CHUNK = 2000;
  const CONCURRENCY = 4;
  for (let i = 0; i < villages.length; i += V_CHUNK * CONCURRENCY) {
    const promises = [];
    for (let c = 0; c < CONCURRENCY; c++) {
      const start = i + c * V_CHUNK;
      if (start < villages.length) {
        const chunk = villages.slice(start, start + V_CHUNK);
        promises.push(
          supabase.from('villages').upsert(chunk, { onConflict: 'id' }).then(({ error }) => {
            if (error) console.error(`Error in chunk ${start}:`, error);
          })
        );
      }
    }
    await Promise.all(promises);
    const completed = Math.min(i + V_CHUNK * CONCURRENCY, villages.length);
    process.stdout.write(`  Inserted ${completed.toLocaleString()}/${villages.length.toLocaleString()} villages\r`);
  }
  console.log(`\n  ✓ ${villages.length.toLocaleString()} villages seeded successfully.`);

  console.log("\n================================================================================");
  console.log("  PIPELINE COMPLETE: ALL 5 RELATIONAL HIERARCHY TABLES SEEDED LIVE IN SUPABASE");
  console.log("================================================================================");
}

runPipeline().catch(err => {
  console.error("Fatal pipeline error:", err);
  process.exit(1);
});
