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

const dataDir = path.resolve(__dirname, '../../../scratch/data');

async function seed() {
  console.log("Starting location master seed...");
  console.log(`Connecting to ${supabaseUrl}`);

  // 1. Seed States
  const states = JSON.parse(fs.readFileSync(path.join(dataDir, 'states.json'), 'utf8'));
  console.log(`\n1. Seeding ${states.length} states/UTs...`);
  const stateRecords = states.map(s => ({
    name: s.name,
    type: s.type,
    state_code: s.code || null,
    lgd_code: s.lgd || null,
    census_code: s.census || null,
    status: 'active'
  }));

  const { error: stErr } = await supabase.from('master_states').upsert(stateRecords, { onConflict: 'name' });
  if (stErr) {
    console.error("Error inserting states:", stErr);
    process.exit(1);
  }
  console.log(`✓ Seeded ${states.length} states successfully.`);

  // 2. Seed Districts
  const districts = JSON.parse(fs.readFileSync(path.join(dataDir, 'districts.json'), 'utf8'));
  console.log(`\n2. Seeding ${districts.length} districts in batches...`);
  const distRecords = districts.map(d => ({
    state_name: d.state_name,
    district_name: d.district_name,
    district_lgd_code: d.district_lgd_code || null,
    short_name: d.short_name || null,
    census_code: d.census_code || null,
    status: 'active'
  }));

  const CHUNK_SIZE = 300;
  for (let i = 0; i < distRecords.length; i += CHUNK_SIZE) {
    const chunk = distRecords.slice(i, i + CHUNK_SIZE);
    const { error: dErr } = await supabase.from('master_districts').upsert(chunk, { onConflict: 'state_name,district_name' });
    if (dErr) {
      console.error(`Error inserting district batch ${i}:`, dErr);
      process.exit(1);
    }
    process.stdout.write(`  Inserted districts ${i + chunk.length}/${distRecords.length}\r`);
  }
  console.log(`\n✓ Seeded ${districts.length} districts successfully.`);

  // 3. Seed Cities
  const cities = JSON.parse(fs.readFileSync(path.join(dataDir, 'cities.json'), 'utf8'));
  console.log(`\n3. Seeding ${cities.length} cities, towns & tehsils in batches...`);
  
  // Clean existing master_cities for complete fresh replacement
  await supabase.from('master_cities').delete().neq('id', '00000000-0000-0000-0000-000000000000');

  const cityRecords = cities.map(c => ({
    state_name: c.state_name,
    district_name: c.district_name,
    city_name: c.city_name,
    town_type: c.town_type || 'Town',
    town_code: c.town_code || null,
    status: 'active'
  }));

  for (let i = 0; i < cityRecords.length; i += CHUNK_SIZE) {
    const chunk = cityRecords.slice(i, i + CHUNK_SIZE);
    const { error: cErr } = await supabase.from('master_cities').insert(chunk);
    if (cErr) {
      console.error(`Error inserting cities batch ${i}:`, cErr);
      process.exit(1);
    }
    process.stdout.write(`  Inserted cities ${i + chunk.length}/${cityRecords.length}\r`);
  }
  console.log(`\n✓ Seeded ${cities.length} cities & towns successfully.`);

  // 4. Seed Unified master_location
  console.log(`\n4. Seeding ${cities.length} unified master_location search records in batches...`);
  const utSet = new Set(states.filter(s => s.type === 'union_territory').map(s => s.name));

  // Truncate/delete existing master_location to rebuild clean
  await supabase.from('master_location').delete().neq('id', '00000000-0000-0000-0000-000000000000');

  const locRecords = cities.map(c => {
    const isUt = utSet.has(c.state_name);
    return {
      state: c.state_name,
      union_territory: isUt ? c.state_name : null,
      location_type: isUt ? 'union_territory' : 'state',
      district: c.district_name,
      city_town: c.city_name,
      town_type: c.town_type || 'Town',
      town_code: c.town_code || null,
      district_code: c.dist_code || null,
      state_code: c.st_code || null,
      status: 'active'
    };
  });

  for (let i = 0; i < locRecords.length; i += CHUNK_SIZE) {
    const chunk = locRecords.slice(i, i + CHUNK_SIZE);
    const { error: lErr } = await supabase.from('master_location').insert(chunk);
    if (lErr) {
      console.error(`Error inserting master_location batch ${i}:`, lErr);
      process.exit(1);
    }
    process.stdout.write(`  Inserted master_location ${i + chunk.length}/${locRecords.length}\r`);
  }
  console.log(`\n✓ Seeded ${locRecords.length} master_location rows successfully.`);
  console.log("\n========================================");
  console.log("MASTER LOCATION DATABASE SEED COMPLETED");
  console.log("========================================");
}

seed().catch(err => {
  console.error("Fatal seed error:", err);
  process.exit(1);
});
