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

const dataDir = path.resolve(__dirname, '../../../scratch/data/relational');

async function seed() {
  console.log("Starting relational locations hierarchy seed (states, districts, cities, towns, villages)...");
  console.log(`Connecting to ${supabaseUrl}`);

  // 1. Seed States
  const states = JSON.parse(fs.readFileSync(path.join(dataDir, 'states.json'), 'utf8'));
  console.log(`\n1. Seeding ${states.length} states/UTs...`);
  const { error: stErr } = await supabase.from('states').upsert(states, { onConflict: 'id' });
  if (stErr) {
    console.error("Error inserting states:", stErr);
    process.exit(1);
  }
  console.log(`✓ Seeded ${states.length} states successfully.`);

  // 2. Seed Districts
  const districts = JSON.parse(fs.readFileSync(path.join(dataDir, 'districts.json'), 'utf8'));
  console.log(`\n2. Seeding ${districts.length} districts in batches...`);
  const CHUNK_SIZE = 500;
  for (let i = 0; i < districts.length; i += CHUNK_SIZE) {
    const chunk = districts.slice(i, i + CHUNK_SIZE);
    const { error: dErr } = await supabase.from('districts').upsert(chunk, { onConflict: 'id' });
    if (dErr) {
      console.error(`Error inserting district batch ${i}:`, dErr);
      process.exit(1);
    }
    process.stdout.write(`  Inserted districts ${i + chunk.length}/${districts.length}\r`);
  }
  console.log(`\n✓ Seeded ${districts.length} districts successfully.`);

  // 3. Seed Cities
  const cities = JSON.parse(fs.readFileSync(path.join(dataDir, 'cities.json'), 'utf8'));
  console.log(`\n3. Seeding ${cities.length} cities in batches...`);
  for (let i = 0; i < cities.length; i += CHUNK_SIZE) {
    const chunk = cities.slice(i, i + CHUNK_SIZE);
    const { error: cErr } = await supabase.from('cities').upsert(chunk, { onConflict: 'id' });
    if (cErr) {
      console.error(`Error inserting cities batch ${i}:`, cErr);
      process.exit(1);
    }
    process.stdout.write(`  Inserted cities ${i + chunk.length}/${cities.length}\r`);
  }
  console.log(`\n✓ Seeded ${cities.length} cities successfully.`);

  // 4. Seed Towns
  const towns = JSON.parse(fs.readFileSync(path.join(dataDir, 'towns.json'), 'utf8'));
  console.log(`\n4. Seeding ${towns.length} towns in batches...`);
  for (let i = 0; i < towns.length; i += CHUNK_SIZE) {
    const chunk = towns.slice(i, i + CHUNK_SIZE);
    const { error: tErr } = await supabase.from('towns').upsert(chunk, { onConflict: 'id' });
    if (tErr) {
      console.error(`Error inserting towns batch ${i}:`, tErr);
      process.exit(1);
    }
    process.stdout.write(`  Inserted towns ${i + chunk.length}/${towns.length}\r`);
  }
  console.log(`\n✓ Seeded ${towns.length} towns successfully.`);

  console.log("\n========================================================");
  console.log("RELATIONAL LOCATIONS HIERARCHY SEED COMPLETED (36 States, 784 Districts, 466 Cities, 15,081 Towns)");
  console.log("========================================================");
}

seed().catch(err => {
  console.error("Fatal seed error:", err);
  process.exit(1);
});
