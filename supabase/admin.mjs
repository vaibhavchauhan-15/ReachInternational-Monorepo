import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://dhbbgfzbyatzvqafnsqp.supabase.co';
const SUPABASE_SECRET_KEY = process.env.SUPABASE_SECRET_KEY;

if (!SUPABASE_SECRET_KEY) {
  console.error('Missing SUPABASE_SECRET_KEY env var. Set it in .env or the environment before running the seed script.');
  process.exit(1);
}

const admin = createClient(SUPABASE_URL, SUPABASE_SECRET_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const users = [
  
  {
    email: 'vaibhav5chauhan123532@gmail.com',
    password: 'Admin@123456',
    email_confirm: true,
    user_metadata: {
      full_name: 'Vaibhav Chauhan',
      phone: '+91 9867732204',
      role: 'admin',
    },
  }
 
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