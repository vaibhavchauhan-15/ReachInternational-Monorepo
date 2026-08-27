import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_SECRET_KEY = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SECRET_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SECRET_KEY env var. Set them in .env or the environment before running the seed script.');
  process.exit(1);
}

const admin = createClient(SUPABASE_URL, SUPABASE_SECRET_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

import crypto from 'crypto';

const adminEmail = process.env.SEED_ADMIN_EMAIL || 'admin@reachinternation.com';
const adminPassword = process.env.SEED_ADMIN_PASSWORD || `${crypto.randomBytes(10).toString('hex')}A1!`;
const adminPhone = process.env.SEED_ADMIN_PHONE || '+91 98765 00002';

const users = [
  {
    email: adminEmail,
    password: adminPassword,
    email_confirm: true,
    user_metadata: {
      full_name: 'Administrator',
      phone: adminPhone,
      role: 'admin',
      city: 'Delhi',
      district: 'New Delhi',
      state: 'Delhi',
    },
  },
];

const results = [];

for (const u of users) {
  const { data, error } = await admin.auth.admin.createUser(u);
  if (error) {
    console.log(`FAILED: ${u.email} -> ${error.message}`);
    continue;
  }
  results.push({
    email: u.email,
    password: u.password,
    role: u.user_metadata.role,
    auth_id: data.user.id,
    profile_id: null,
  });
  console.log(`CREATED AUTH USER: ${u.email} (${u.user_metadata.role}) id=${data.user.id}`);
}

// Verify the trigger created the public.users profiles
if (results.length > 0) {
  const { data: profiles, error: profileError } = await admin
    .from('users')
    .select('id, full_name, phone, role, status');

  if (profileError) {
    console.log('PROFILE CHECK FAILED:', profileError.message);
  } else {
    console.log('\n===== PUBLIC.USERS PROFILES (from handle_new_user trigger) =====');
    for (const p of profiles) {
      console.log(`${p.role.padEnd(12)} | ${p.full_name} | ${p.status} | id=${p.id}`);
      const match = results.find((r) => r.email.split('@')[0].includes(p.role));
      if (match) match.profile_id = p.id;
    }
  }
}

console.log('\n===== LOGIN CREDENTIALS =====');
for (const r of results) {
  console.log(`\nEmail:    ${r.email}\nPassword: ${r.password}\nRole:     ${r.role}\nUser ID:  ${r.auth_id}`);
}