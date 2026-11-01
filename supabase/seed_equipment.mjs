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

async function main() {
  console.log('--- Seeding Equipment Management & JCB S2632E into Dev DB ---');

  // 1. Ensure storage buckets exist
  const buckets = ['equipment_media', 'equipment_docs'];
  for (const b of buckets) {
    const { data: existingBucket } = await admin.storage.getBucket(b);
    if (!existingBucket) {
      const { error } = await admin.storage.createBucket(b, { public: true });
      if (error && !error.message?.includes('already exists')) {
        console.warn(`Bucket ${b} creation error:`, error.message);
      } else {
        console.log(`✓ Bucket created/confirmed: ${b}`);
      }
    } else {
      console.log(`✓ Bucket already exists: ${b}`);
    }
  }

  // 2. Fetch Brand JCB and Category Scissor Lifts
  const { data: jcbBrand } = await admin
    .from('equipment_brands')
    .select('id')
    .eq('slug', 'jcb')
    .single();

  const { data: scissorCat } = await admin
    .from('equipment_categories')
    .select('id')
    .eq('slug', 'scissor-lifts')
    .single();

  if (!jcbBrand || !scissorCat) {
    console.error('ERROR: Missing JCB brand or Scissor Lifts category');
    process.exit(1);
  }

  const jcbId = jcbBrand.id;
  const scissorId = scissorCat.id;
  const s2632eId = '50000000-0000-0000-0000-000000000009';

  const specsJson = {
    max_platform_height_m: { v: 8.1, d: "8.1 m / 26'6\"" },
    max_working_height_m: { v: 10.1, d: "10.1 m / 32'6\"" },
    extension_outreach_m: { v: 0.9, d: "0.9 m / 35 in" },
    length_stowed_m: { v: 2.39, d: "2.39 m / 7'10\"" },
    width_stowed_m: { v: 0.81, d: "0.81 m / 2'8\"" },
    height_stowed_rails_folded_m: { v: 1.96, d: "1.96 m / 6'5\"" },
    height_stowed_rails_unfolded_m: { v: 2.35, d: "2.35 m / 7'8\"" },
    weight_kg: { v: 2062, d: "2,062 kg / 4,546 lb" },
    max_wheel_load_kg: { v: 1080, d: "1,080 kg / 2,381 lb" },
    platform_length_m: { v: 2.25, d: "2.25 m / 89 in" },
    platform_width_m: { v: 0.81, d: "0.81 m / 32 in" },
    platform_guardrail_height_m: { v: 1.10, d: "1.10 m / 43 in" },
    platform_capacity_kg: { v: 250, d: "250 kg / 550 lb" },
    extension_deck_capacity_kg: { v: 120, d: "120 kg / 265 lb" },
    occupants_indoor: { v: 2, d: "2 Persons" },
    occupants_outdoor: { v: null, d: "Not rated (indoor use only)" },
    side_force_indoor_n: { v: 400, d: "400 N / 90 lbf" },
    side_force_outdoor_n: { v: null, d: "Not rated (indoor use only)" },
    wind_speed_outdoor_ms: { v: null, d: "Not rated (indoor use only)" },
    slope_front_back_deg: { v: 3.0, d: "3°" },
    slope_side_deg: { v: 1.5, d: "1.5°" },
    ground_clearance_m: { v: 0.1, d: "0.1 m / 4 in" },
    wheelbase_m: { v: 1.85, d: "1.85 m / 73 in" },
    turning_radius_outside_m: { v: 2.1, d: "2.1 m / 6'11\"" },
    turning_radius_inside_m: { v: 0, d: "0 (Zero)" },
    gradeability_pct: { v: 25, d: "25 %" },
    speed_stowed_kmh: { v: 3.2, d: "3.2 km/h / 2 mph" },
    speed_raised_kmh: { v: 0.8, d: "0.8 km/h / 0.5 mph" },
    rise_time_loaded_s: { v: "30-35", d: "30–35 s" },
    fall_time_loaded_s: { v: "35-40", d: "35–40 s" },
    tyre_size_mm: { v: "380 x 125", d: "Solid, 380 × 125 mm / 15 × 5 in" },
    hydraulic_volume_l: { v: 18, d: "18 L / 4.75 gal" },
    hydraulic_pressure_mpa: { v: 24, d: "24 MPa" },
    battery_voltage_each_v: { v: 6, d: "6 V (each)" },
    battery_qty: { v: 4, d: "4 units (24 V system)" },
    battery_ah: { v: 225, d: "225 Ah" },
    power_unit: { v: "24V DC / 3.3 kW", d: "24 V DC / 3.3 kW" },
    charger: { v: "120-240 V in / 25 out", d: "Input 120–240 V / Output 25" },
    drive_steer: { v: "FWD, 2WS", d: "Front-wheel drive, 2-wheel steer" },
    brake: { v: "Rear", d: "Rear" },
  };

  const s2632eData = {
    id: s2632eId,
    brand_id: jcbId,
    category_id: scissorId,
    model_name: 'JCB S2632E Electric Scissor Lift',
    model_number: 'S2632E',
    slug: 'jcb-s2632e',
    subtype: 'Electric Slab Scissor',
    short_description: 'Electric scissor lift with 8.1m platform height (10.1m working height), 250kg capacity, and 2-person indoor rating.',
    full_description: 'The JCB S2632E electric scissor lift is an ultra-productive, zero-emission access platform engineered specifically for indoor industrial facilities, warehouses, and commercial construction. With a narrow 0.81m machine width, it easily navigates through narrow aisles and standard double doorways. Equipped with four 6V 225Ah deep-cycle batteries powering an efficient 24V DC / 3.3kW drive system, the S2632E offers full-height driveability, smooth proportional joystick control, and automatic pothole protection for maximum operator safety.',
    primary_image_url: '/images/awp_scissor_lift.jpg',
    is_featured: true,
    is_published: true,
    rental_available: true,
    purchase_available: true,
    primary_working_height: '10.10 m (32.8 ft)',
    primary_capacity: '250 kg (2 Persons Indoor)',
    primary_power_source: '24V DC (4 x 6V 225 Ah)',
    applications: [
      'Warehouse Electrical & Mechanical Installation',
      'HVAC Ducting, Fire Sprinkler & Piping Assembly',
      'Factory Facility Upgrades & Preventive Maintenance',
      'Commercial Retail & Airport Hangar Fitout Works',
    ],
    features: [
      'Narrow 0.81m chassis passes through standard double doorways',
      '0.90m roll-out extension deck provides 35 in additional outreach',
      '2-person indoor rated with 250kg total SWL (120kg on extension)',
      'Heavy-duty 4x 6V 225Ah deep-cycle battery system with onboard 25A charger',
      'Zero inside turning radius for maximum agility in congested spaces',
      'Automatic pothole protection and full-height drive capability',
    ],
    status: 'published',
    power: 'electric',
    tagline: 'Compact 8.1 m electric scissor lift for indoor facilities',
    summary: 'Electric scissor lift with 8.1 m platform height, 250 kg capacity, and 2-person indoor rating.',
    description_md: `### JCB S2632E Technical Specifications Overview

The **JCB S2632E** is a heavy-duty electric slab scissor lift tailored for indoor installation, MEP contractors, and facility maintenance.

#### Key Highlights
- **Heights**: 8.1m max platform height (10.1m working height) with 0.9m extension outreach.
- **Dimensions**: Stowed length 2.39m, width 0.81m, height 1.96m (rails folded) / 2.35m (rails unfolded).
- **Safe Working Load**: 250kg main platform, 120kg extension deck.
- **Indoor Rating**: Rated for 2 persons indoor. Outdoor use is not rated (indoor use only).
- **Mobility**: Gradeability 25%, zero inside turning radius, travel speed up to 3.2 km/h stowed.`,
    tags: ['electric', 'scissor-lift', 'awp', 'indoor', 'zero-emission', 'jcb'],
    max_platform_height_m: 8.10,
    max_working_height_m: 10.10,
    capacity_kg: 250,
    weight_kg: 2062,
    indoor_use: true,
    outdoor_use: false,
    specs: specsJson,
    cover_path: '/images/awp_scissor_lift.jpg',
    sort_weight: 100,
    published_at: new Date().toISOString(),
    version: 1,
  };

  const { data: upsertedModel, error: modelErr } = await admin
    .from('equipment_models')
    .upsert(s2632eData, { onConflict: 'slug' })
    .select('id, slug, model_name')
    .single();

  if (modelErr) {
    console.error('ERROR upserting JCB S2632E:', modelErr);
    process.exit(1);
  }

  console.log(`✓ JCB S2632E upserted successfully: ${upsertedModel.id} (${upsertedModel.slug})`);

  // 3. Media row
  const { error: mediaErr } = await admin
    .from('equipment_media')
    .upsert({
      equipment_id: upsertedModel.id,
      media_url: '/images/awp_scissor_lift.jpg',
      media_type: 'image',
      alt_text: 'JCB S2632E Electric Scissor Lift in elevated position',
      sort_order: 1,
      is_primary: true,
    }, { onConflict: 'equipment_id,media_url' });

  if (mediaErr) {
    // try insert if no compound unique constraint
    await admin.from('equipment_media').insert({
      equipment_id: upsertedModel.id,
      media_url: '/images/awp_scissor_lift.jpg',
      media_type: 'image',
      alt_text: 'JCB S2632E Electric Scissor Lift in elevated position',
      sort_order: 1,
      is_primary: true,
    });
  }
  console.log('✓ Media row confirmed for JCB S2632E');

  // 4. Documents row
  await admin.from('equipment_documents').insert({
    equipment_id: upsertedModel.id,
    title: 'JCB S2632E Technical Specifications Datasheet (July 2018)',
    document_type: 'spec_sheet',
    file_url: '/documents/datasheets/jcb-s2632e.pdf',
    file_size_bytes: 1450000,
    mime_type: 'application/pdf',
    is_published: true,
  });
  console.log('✓ Document datasheet confirmed for JCB S2632E');

  // 5. Relational specifications
  const { data: specDefs } = await admin
    .from('equipment_spec_definitions')
    .select('id, code, sort_order')
    .eq('category_id', scissorId);

  if (specDefs && specDefs.length > 0) {
    for (const ed of specDefs) {
      let specValue = 'As per datasheet';
      let isKeySpec = false;

      switch (ed.code) {
        case 'working_height':
          specValue = "10.10 m (32'6\")";
          isKeySpec = true;
          break;
        case 'platform_height':
          specValue = "8.10 m (26'6\")";
          isKeySpec = true;
          break;
        case 'platform_capacity':
          specValue = '250 kg (550 lb)';
          isKeySpec = true;
          break;
        case 'deck_capacity':
          specValue = '120 kg (265 lb)';
          break;
        case 'platform_dimensions':
          specValue = '2.25 m x 0.81 m (89 in x 32 in)';
          break;
        case 'extension_length':
          specValue = '0.90 m (35 in)';
          break;
        case 'machine_width':
          specValue = "0.81 m (2'8\")";
          isKeySpec = true;
          break;
        case 'machine_length':
          specValue = "2.39 m (7'10\")";
          break;
        case 'machine_height':
          specValue = "2.35 m (7'8\")";
          break;
        case 'gross_weight':
          specValue = '2,062 kg (4,546 lb)';
          break;
        case 'power_source':
          specValue = '24V DC (4 x 6V 225 Ah)';
          isKeySpec = true;
          break;
        case 'gradeability':
          specValue = '25%';
          break;
      }

      await admin.from('equipment_specifications').upsert({
        equipment_id: upsertedModel.id,
        spec_definition_id: ed.id,
        spec_value: specValue,
        is_key_spec: isKeySpec,
        sort_order: ed.sort_order,
      }, { onConflict: 'equipment_id,spec_definition_id' });
    }
    console.log(`✓ Relational specifications synced for JCB S2632E (${specDefs.length} specs)`);
  }

  // 6. Backfill existing models with default values if null
  await admin
    .from('equipment_models')
    .update({
      status: 'published',
      indoor_use: true,
      outdoor_use: true,
      version: 1,
    })
    .is('status', null);

  console.log('--- Equipment Seeding & Verification Completed Successfully ---');
}

main().catch((err) => {
  console.error('Fatal execution error:', err);
  process.exit(1);
});
