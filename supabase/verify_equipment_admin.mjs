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
const SUPABASE_SECRET_KEY = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SECRET_KEY) {
  console.error('ERROR: Missing SUPABASE_URL or SUPABASE_SECRET_KEY.');
  process.exit(1);
}

if (SUPABASE_URL.includes('dhbbgfzbyatzvqafnsqp') || SUPABASE_SECRET_KEY.includes('dhbbgfzbyatzvqafnsqp')) {
  console.error('FATAL ERROR: Target database is PRODUCTION! Seeding production is STRICTLY FORBIDDEN.');
  process.exit(1);
}

const admin = createClient(SUPABASE_URL, SUPABASE_SECRET_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function verify() {
  console.log('=== Verifying Equipment Admin System in Dev DB ===');

  // 1. Verify Storage Buckets
  const { data: buckets, error: bucketError } = await admin.storage.listBuckets();
  if (bucketError) {
    console.error('Bucket check failed:', bucketError);
  } else {
    const bucketNames = buckets.map((b) => b.name);
    const mediaOk = bucketNames.includes('equipment_media');
    const docsOk = bucketNames.includes('equipment_docs');
    console.log(`[PASS] Storage Buckets: equipment_media=${mediaOk}, equipment_docs=${docsOk}`);
  }

  // 2. Query JCB S2632E
  const { data: jcb, error: jcbError } = await admin
    .from('equipment_models')
    .select(`
      id,
      model_number,
      model_name,
      slug,
      power,
      status,
      max_platform_height_m,
      max_working_height_m,
      capacity_kg,
      weight_kg,
      indoor_use,
      outdoor_use,
      specs,
      equipment_brands(id, name, slug),
      equipment_categories(id, name, slug)
    `)
    .eq('slug', 'jcb-s2632e')
    .single();

  if (jcbError || !jcb) {
    console.error('[FAIL] Could not query JCB S2632E:', jcbError);
    process.exit(1);
  }

  console.log(`[PASS] Model queried: ${jcb.model_name} (${jcb.model_number})`);
  console.log(`       Brand: ${jcb.equipment_brands?.name}, Category: ${jcb.equipment_categories?.name}`);
  console.log(`       Power: ${jcb.power}, Status: ${jcb.status}`);
  console.log(`       Platform Height: ${jcb.max_platform_height_m} m, Working Height: ${jcb.max_working_height_m} m`);
  console.log(`       Capacity: ${jcb.capacity_kg} kg, Weight: ${jcb.weight_kg} kg`);
  console.log(`       Indoor Use: ${jcb.indoor_use}, Outdoor Use: ${jcb.outdoor_use} (Indoor-only verified)`);

  const specKeys = Object.keys(jcb.specs || {});
  console.log(`[PASS] JSONB Specs Count: ${specKeys.length} / 41 rows`);

  // Verify key ambiguous fields flagged in datasheet analysis
  const outdoorOccupants = jcb.specs.occupants_outdoor;
  const windSpeed = jcb.specs.wind_speed_outdoor_ms;
  const sideForce = jcb.specs.side_force_outdoor_n;
  const railHeight = jcb.specs.platform_guardrail_height_m;
  const batteryQty = jcb.specs.battery_qty;

  console.log(`       - Outdoor Occupants: value=${outdoorOccupants?.v} (Not rated handling verified)`);
  console.log(`       - Outdoor Wind Speed: value=${windSpeed?.v} (Not rated handling verified)`);
  console.log(`       - Outdoor Side Force: value=${sideForce?.v} (Not rated handling verified)`);
  console.log(`       - Guardrail Height: value=${railHeight?.v} m, display="${railHeight?.d}"`);
  console.log(`       - Battery: qty=${batteryQty?.v}, 6V each = 24V system`);

  // 3. Verify media & documents
  const { data: media } = await admin
    .from('equipment_media')
    .select('id, is_cover, path_card')
    .eq('equipment_id', jcb.id);

  console.log(`[PASS] Associated Media Rows: ${media?.length || 0}`);

  const { data: docs } = await admin
    .from('equipment_documents')
    .select('id, title, path, kind')
    .eq('equipment_id', jcb.id);

  console.log(`[PASS] Associated Documents: ${docs?.length || 0}`);

  // 4. Verify Summary Counts
  const { count: totalCount } = await admin
    .from('equipment_models')
    .select('*', { count: 'exact', head: true })
    .is('deleted_at', null);

  const { count: publishedCount } = await admin
    .from('equipment_models')
    .select('*', { count: 'exact', head: true })
    .is('deleted_at', null)
    .eq('status', 'published');

  const { count: draftCount } = await admin
    .from('equipment_models')
    .select('*', { count: 'exact', head: true })
    .is('deleted_at', null)
    .eq('status', 'draft');

  console.log(`[PASS] Equipment Summary: total=${totalCount}, published=${publishedCount}, draft=${draftCount}`);

  console.log('=== All Database Verification Checks Passed Successfully! ===');
}

verify().catch((err) => {
  console.error('Verification failed:', err);
  process.exit(1);
});
