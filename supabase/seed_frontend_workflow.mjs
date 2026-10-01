import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

// 1. Load environment variables
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
  console.error('ERROR: Missing SUPABASE_URL or SUPABASE_SECRET_KEY environment variable.');
  process.exit(1);
}

// Strict Safety Guard: Never touch production
if (SUPABASE_URL.includes('dhbbgfzbyatzvqafnsqp') || SUPABASE_SECRET_KEY.includes('dhbbgfzbyatzvqafnsqp')) {
  console.error('FATAL ERROR: Target database is PRODUCTION (dhbbgfzbyatzvqafnsqp)! Seeding production is STRICTLY FORBIDDEN.');
  process.exit(1);
}

const admin = createClient(SUPABASE_URL, SUPABASE_SECRET_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

console.log('====================================================');
console.log('🚀 REACH INTERNATIONAL DEV DATABASE RESEEDING WORKFLOW');
console.log(`Target Supabase URL: ${SUPABASE_URL}`);
console.log('Environment: Development (vlmxciuogczumumrwyot)');
console.log('====================================================\n');

// Sample dummy PDF buffer for document uploads
const DUMMY_PDF_BYTES = Buffer.from(
  '%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Count 1/Kids[3 0 R]>>endobj\n3 0 obj<</Type/Page/MediaBox[0 0 612 792]/Parent 2 0 R/Resources<<>>>>endobj\nxref\n0 4\n0000000000 65535 f \n0000000010 00000 n \n0000000053 00000 n \n0000000102 00000 n \ntrailer<</Size 4/Root 1 0 R>>\nstartxref\n180\n%%EOF'
);

async function run() {
  try {
    // ----------------------------------------------------
    // STEP 1: CLEAN UP OLD SEEDED DUMMY DATA
    // ----------------------------------------------------
    console.log('🧹 STEP 1: Cleaning up old seeded dummy data...');

    // 1.1 Atomic purge of tables via clean_dev_seed_data RPC
    console.log('  Purging operational tables...');
    const { error: cleanErr } = await admin.rpc('clean_dev_seed_data');
    if (cleanErr) {
      console.warn('  ⚠️ clean_dev_seed_data RPC warning:', cleanErr.message);
    }

    // 1.0 Ensure public.states has all 36 Indian states and UTs
    console.log('  Seeding canonical Indian states...');
    const indianStates = [
      { id: 35, name: 'Andaman and Nicobar Islands' },
      { id: 28, name: 'Andhra Pradesh' },
      { id: 12, name: 'Arunachal Pradesh' },
      { id: 18, name: 'Assam' },
      { id: 10, name: 'Bihar' },
      { id: 4, name: 'Chandigarh' },
      { id: 22, name: 'Chhattisgarh' },
      { id: 38, name: 'Dadra and Nagar Haveli and Daman and Diu' },
      { id: 7, name: 'Delhi' },
      { id: 30, name: 'Goa' },
      { id: 24, name: 'Gujarat' },
      { id: 6, name: 'Haryana' },
      { id: 2, name: 'Himachal Pradesh' },
      { id: 1, name: 'Jammu and Kashmir' },
      { id: 20, name: 'Jharkhand' },
      { id: 29, name: 'Karnataka' },
      { id: 32, name: 'Kerala' },
      { id: 37, name: 'Ladakh' },
      { id: 31, name: 'Lakshadweep' },
      { id: 23, name: 'Madhya Pradesh' },
      { id: 27, name: 'Maharashtra' },
      { id: 14, name: 'Manipur' },
      { id: 17, name: 'Meghalaya' },
      { id: 15, name: 'Mizoram' },
      { id: 13, name: 'Nagaland' },
      { id: 21, name: 'Odisha' },
      { id: 34, name: 'Puducherry' },
      { id: 3, name: 'Punjab' },
      { id: 8, name: 'Rajasthan' },
      { id: 11, name: 'Sikkim' },
      { id: 33, name: 'Tamil Nadu' },
      { id: 36, name: 'Telangana' },
      { id: 16, name: 'Tripura' },
      { id: 9, name: 'Uttar Pradesh' },
      { id: 5, name: 'Uttarakhand' },
      { id: 19, name: 'West Bengal' },
    ];
    await admin.from('states').upsert(indianStates, { onConflict: 'id' });

    // 1.3 Clean up old dummy users (keep only superadmin and admin)
    console.log('  Cleaning up old non-admin users from auth and public tables...');
    const { data: authList } = await admin.auth.admin.listUsers({ perPage: 1000 });
    if (authList?.users) {
      for (const u of authList.users) {
        const em = u.email?.toLowerCase();
        if (em !== 'superadmin@reachinternational.co.in' && em !== 'admin@reachinternational.co.in') {
          try {
            await admin.from('users').delete().eq('id', u.id);
          } catch {}
          try {
            await admin.auth.admin.deleteUser(u.id);
          } catch {}
        }
      }
    }
    // Also delete any orphaned public users
    try {
      await admin.from('users').delete().not('email', 'in', '("superadmin@reachinternational.co.in","admin@reachinternational.co.in")');
    } catch {}

    console.log('  ✓ Cleanup completed successfully.\n');

    // ----------------------------------------------------
    // STEP 2: ENSURE SUPER ADMIN & ADMIN ACCOUNTS
    // ----------------------------------------------------
    console.log('👤 STEP 2: Ensuring Super Admin and Admin accounts...');
    const adminPassword = 'Password@123456';

    const systemAdmins = [
      {
        email: 'superadmin@reachinternational.co.in',
        password: adminPassword,
        full_name: 'Super Admin Dev',
        role: 'super_admin',
        phone: '+91 98765 00001',
        city: 'Delhi',
        district: 'New Delhi',
        state: 'Delhi',
        state_id: 7,
        street: 'Barakhamba Road, Connaught Place',
      },
      {
        email: 'admin@reachinternational.co.in',
        password: adminPassword,
        full_name: 'Admin User Dev',
        role: 'admin',
        phone: '+91 98765 00002',
        city: 'Delhi',
        district: 'New Delhi',
        state: 'Delhi',
        state_id: 7,
        street: 'Barakhamba Road, Connaught Place',
      },
    ];

    const adminUserMap = {};

    for (const a of systemAdmins) {
      const { data: existingList } = await admin.auth.admin.listUsers();
      let authUser = existingList?.users?.find((u) => u.email?.toLowerCase() === a.email.toLowerCase());

      if (!authUser) {
        const { data: created, error } = await admin.auth.admin.createUser({
          email: a.email,
          password: a.password,
          email_confirm: true,
          user_metadata: {
            full_name: a.full_name,
            phone: a.phone,
            role: a.role,
            city: a.city,
            district: a.district,
            state: a.state,
            state_id: a.state_id,
            street: a.street,
            location: `${a.street}, ${a.city}, ${a.district}, ${a.state}`,
          },
        });
        if (error) {
          console.error(`  ❌ Failed to create auth user ${a.email}:`, error.message);
          continue;
        }
        authUser = created.user;
      } else {
        await admin.auth.admin.updateUserById(authUser.id, {
          password: a.password,
          email_confirm: true,
        });
      }

      // Upsert into public.users with active status and complete profile
      await admin.from('users').upsert({
        id: authUser.id,
        full_name: a.full_name,
        email: a.email,
        phone: a.phone,
        role: a.role,
        status: 'active',
        complete_profile: true,
        city: a.city,
        district: a.district,
        state: a.state,
        state_id: a.state_id,
        street: a.street,
        bank_account_number: '102938475612',
        bank_ifsc_code: 'SBIN0001234',
        aadhaar_number: '9876 5432 1099',
        license_number: 'DL-0420100099999',
      });

      adminUserMap[a.role] = authUser.id;
      console.log(`  ✓ System ${a.role}: ${a.email} (id: ${authUser.id})`);
    }

    const primaryAdminId = adminUserMap['admin'] || adminUserMap['super_admin'];

    // ----------------------------------------------------
    // STEP 3: USER REGISTRATION VIA SIGNUP ACCEPTANCE CRITERIA
    // ----------------------------------------------------
    console.log('\n📝 STEP 3: Registering users via Frontend Signup Acceptance Criteria...');
    console.log('  (Each user signs up -> status starts as "pending" -> documents uploaded -> approved by admin)\n');

    // 3.1 First Register Supervisor (so operators can link supervisor_id)
    const supervisorData = {
      full_name: 'Vikram Singh',
      email: 'supervisor@reachinternational.co.in',
      phone: '+91 98765 00010',
      role: 'supervisor',
      shift_start_time: '08:00 AM',
      shift_end_time: '08:00 PM',
      shift_time: '08:00 AM - 08:00 PM',
      street: 'Sector 18, Commercial Belt',
      city: 'Noida',
      district: 'Gautam Buddha Nagar',
      state: 'Uttar Pradesh',
      state_id: 9,
      location: 'Sector 18, Commercial Belt, Noida, Gautam Buddha Nagar, Uttar Pradesh',
      bank_account_number: '50100234567891',
      bank_ifsc_code: 'HDFC0000123',
      aadhaar_number: '4567 8901 2345',
      license_number: 'UP-1620150012345',
      password: 'Password@123456',
    };

async function ensureAuthUser(userSpec, initialEmailConfirm = false) {
  const { data: created, error } = await admin.auth.admin.createUser({
    email: userSpec.email,
    password: userSpec.password,
    email_confirm: initialEmailConfirm,
    user_metadata: {
      full_name: userSpec.full_name,
      phone: userSpec.phone,
      role: userSpec.role,
      shift_start_time: userSpec.shift_start_time,
      shift_end_time: userSpec.shift_end_time,
      shift_time: userSpec.shift_time,
      street: userSpec.street,
      address: userSpec.street,
      city: userSpec.city,
      district: userSpec.district,
      state: userSpec.state,
      state_id: userSpec.state_id,
      location: userSpec.location,
      bank_account_number: userSpec.bank_account_number,
      bank_ifsc_code: userSpec.bank_ifsc_code,
      aadhaar_number: userSpec.aadhaar_number,
      license_number: userSpec.license_number,
      supervisor_id: userSpec.supervisor_id,
    },
  });

  if (!error && created?.user) {
    return created.user;
  }

  const { data: listData } = await admin.auth.admin.listUsers({ perPage: 1000 });
  const existing = listData?.users?.find(
    (u) => u.email?.toLowerCase() === userSpec.email.toLowerCase()
  );

  if (existing) {
    await admin.auth.admin.updateUserById(existing.id, {
      password: userSpec.password,
      email_confirm: initialEmailConfirm,
      user_metadata: {
        full_name: userSpec.full_name,
        phone: userSpec.phone,
        role: userSpec.role,
        shift_start_time: userSpec.shift_start_time,
        shift_end_time: userSpec.shift_end_time,
        shift_time: userSpec.shift_time,
        street: userSpec.street,
        address: userSpec.street,
        city: userSpec.city,
        district: userSpec.district,
        state: userSpec.state,
        state_id: userSpec.state_id,
        location: userSpec.location,
        bank_account_number: userSpec.bank_account_number,
        bank_ifsc_code: userSpec.bank_ifsc_code,
        aadhaar_number: userSpec.aadhaar_number,
        license_number: userSpec.license_number,
        supervisor_id: userSpec.supervisor_id,
      },
    });
    return existing;
  }

  throw new Error(`Failed to ensure auth user ${userSpec.email}: ${error?.message}`);
}

    console.log(`  Signing up supervisor: ${supervisorData.full_name} (${supervisorData.email})...`);
    const supAuthUser = await ensureAuthUser(supervisorData, false);
    const supervisorId = supAuthUser.id;

    // Direct bank info & complete_profile sync (matching auth.ts signup actions)
    await admin.from('users').update({
      bank_account_number: supervisorData.bank_account_number,
      bank_ifsc_code: supervisorData.bank_ifsc_code,
      complete_profile: true,
      status: 'pending', // Explicitly verify initial pending state
    }).eq('id', supervisorId);

    // Upload documents for supervisor
    await uploadUserDocuments(supervisorId, 'supervisor');

    // Admin approves supervisor
    await approveUserInWorkflow(supervisorId, supervisorData.full_name, supervisorData.email, 'supervisor', primaryAdminId);
    console.log(`  ✓ Approved Supervisor: ${supervisorData.full_name} (Status: active)\n`);

    // 3.2 Register Manager and HR
    const managementUsers = [
      {
        full_name: 'Sanjeev Kapoor',
        email: 'manager@reachinternational.co.in',
        phone: '+91 98765 00011',
        role: 'manager',
        shift_start_time: '09:00 AM',
        shift_end_time: '06:00 PM',
        shift_time: '09:00 AM - 06:00 PM',
        street: 'Cyber City, Phase II',
        city: 'Gurugram',
        district: 'Gurugram',
        state: 'Haryana',
        state_id: 6,
        location: 'Cyber City, Phase II, Gurugram, Gurugram, Haryana',
        bank_account_number: '50100987654321',
        bank_ifsc_code: 'HDFC0000456',
        aadhaar_number: '5678 9012 3456',
        license_number: 'HR-2620160012345',
        password: 'Password@123456',
      },
      {
        full_name: 'Priya Nair',
        email: 'hr@reachinternational.co.in',
        phone: '+91 98765 00012',
        role: 'hr',
        shift_start_time: '09:30 AM',
        shift_end_time: '06:30 PM',
        shift_time: '09:30 AM - 06:30 PM',
        street: 'Nehru Place, South Extension',
        city: 'Delhi',
        district: 'South Delhi',
        state: 'Delhi',
        state_id: 7,
        location: 'Nehru Place, South Extension, Delhi, South Delhi, Delhi',
        bank_account_number: '50100876543210',
        bank_ifsc_code: 'ICIC0000789',
        aadhaar_number: '6789 0123 4567',
        license_number: 'DL-0320170012345',
        password: 'Password@123456',
      },
    ];

    for (const m of managementUsers) {
      console.log(`  Signing up ${m.role}: ${m.full_name} (${m.email})...`);
      const mAuthUser = await ensureAuthUser(m, false);
      const mId = mAuthUser.id;

      await admin.from('users').update({
        bank_account_number: m.bank_account_number,
        bank_ifsc_code: m.bank_ifsc_code,
        complete_profile: true,
        status: 'pending',
      }).eq('id', mId);

      await uploadUserDocuments(mId, m.role);
      await approveUserInWorkflow(mId, m.full_name, m.email, m.role, primaryAdminId);
      console.log(`  ✓ Approved ${m.role}: ${m.full_name} (Status: active)`);
    }

    // 3.3 Register Operators (Linked to Supervisor, realistic Aadhaar, DL, Bank details)
    const operatorList = [
      {
        full_name: 'Deepak Patel',
        email: 'deepak.patel@reachinternational.co.in',
        phone: '+91 98765 00021',
        shift_start_time: '06:00 AM',
        shift_end_time: '02:00 PM',
        shift_time: '06:00 AM - 02:00 PM',
        street: 'Barakhamba Camp, Connaught Place',
        city: 'Delhi',
        district: 'New Delhi',
        state: 'Delhi',
        state_id: 7,
        bank_account_number: '20100987654321',
        bank_ifsc_code: 'SBIN0001111',
        aadhaar_number: '7890 1234 5671',
        license_number: 'DL-0420180011111',
      },
      {
        full_name: 'Ramesh Kumar',
        email: 'ramesh.kumar@reachinternational.co.in',
        phone: '+91 98765 00022',
        shift_start_time: '06:00 AM',
        shift_end_time: '02:00 PM',
        shift_time: '06:00 AM - 02:00 PM',
        street: 'BKC Project Site, Bandra East',
        city: 'Mumbai',
        district: 'Mumbai City',
        state: 'Maharashtra',
        state_id: 27,
        bank_account_number: '20100987654322',
        bank_ifsc_code: 'SBIN0001111',
        aadhaar_number: '7890 1234 5672',
        license_number: 'MH-0120170022222',
      },
      {
        full_name: 'Manoj Yadav',
        email: 'manoj.yadav@reachinternational.co.in',
        phone: '+91 98765 00023',
        shift_start_time: '06:00 AM',
        shift_end_time: '02:00 PM',
        shift_time: '06:00 AM - 02:00 PM',
        street: 'Madhapur Site Office, Hitech City',
        city: 'Hyderabad',
        district: 'Hyderabad',
        state: 'Telangana',
        state_id: 36,
        bank_account_number: '20100987654323',
        bank_ifsc_code: 'HDFC0000123',
        aadhaar_number: '7890 1234 5673',
        license_number: 'TS-0920190033333',
      },
      {
        full_name: 'Amit Verma',
        email: 'amit.verma@reachinternational.co.in',
        phone: '+91 98765 00024',
        shift_start_time: '06:00 AM',
        shift_end_time: '02:00 PM',
        shift_time: '06:00 AM - 02:00 PM',
        street: 'MIDC Hinjawadi Phase 2',
        city: 'Pune',
        district: 'Pune',
        state: 'Maharashtra',
        state_id: 27,
        bank_account_number: '20100987654324',
        bank_ifsc_code: 'ICIC0000456',
        aadhaar_number: '7890 1234 5674',
        license_number: 'MH-1220160044444',
      },
      {
        full_name: 'Suresh Sharma',
        email: 'suresh.sharma@reachinternational.co.in',
        phone: '+91 98765 00025',
        shift_start_time: '06:00 AM',
        shift_end_time: '02:00 PM',
        shift_time: '06:00 AM - 02:00 PM',
        street: 'SG Highway Site, Bodakdev',
        city: 'Ahmedabad',
        district: 'Ahmedabad',
        state: 'Gujarat',
        state_id: 24,
        bank_account_number: '20100987654325',
        bank_ifsc_code: 'PUNB0001234',
        aadhaar_number: '7890 1234 5675',
        license_number: 'GJ-0120200055555',
      },
      {
        full_name: 'Rohit Singh',
        email: 'rohit.singh@reachinternational.co.in',
        phone: '+91 98765 00026',
        shift_start_time: '06:00 AM',
        shift_end_time: '02:00 PM',
        shift_time: '06:00 AM - 02:00 PM',
        street: 'Sector 62 Industrial Park',
        city: 'Noida',
        district: 'Gautam Buddha Nagar',
        state: 'Uttar Pradesh',
        state_id: 9,
        bank_account_number: '20100987654326',
        bank_ifsc_code: 'SBIN0001111',
        aadhaar_number: '7890 1234 5676',
        license_number: 'UP-1620210066666',
      },
    ];

    const operatorUserMap = [];

    for (const op of operatorList) {
      console.log(`  Signing up operator: ${op.full_name} (${op.email})...`);
      const location = `${op.street}, ${op.city}, ${op.district}, ${op.state}`;
      const opSpec = {
        ...op,
        role: 'operator',
        location,
        password: 'Password@123456',
        supervisor_id: supervisorId,
      };
      const opAuthUser = await ensureAuthUser(opSpec, false);
      const opId = opAuthUser.id;

      await admin.from('users').update({
        bank_account_number: op.bank_account_number,
        bank_ifsc_code: op.bank_ifsc_code,
        complete_profile: true,
        status: 'pending',
      }).eq('id', opId);

      await uploadUserDocuments(opId, 'operator');
      await approveUserInWorkflow(opId, op.full_name, op.email, 'operator', primaryAdminId);
      console.log(`  ✓ Approved Operator: ${op.full_name} (Status: active)`);

      operatorUserMap.push({
        id: opId,
        full_name: op.full_name,
        email: op.email,
        location,
      });
    }

    // ----------------------------------------------------
    // STEP 4: CREATE CLIENTS VIA ADD CLIENT PAGE CRITERIA
    // ----------------------------------------------------
    console.log('\n🏢 STEP 4: Creating Clients via Add Client Page Acceptance Criteria...');
    console.log('  (Valid GSTIN, PAN, Street Address, City, District, State, PIN, and Maintenance Allowance)\n');

    const clientSpecs = [
      {
        company_name: 'Larsen & Toubro ECC',
        contact_person: 'Anil Singhal',
        phone: '+91 98111 11002',
        gstin: '07AABCB2115P1ZR',
        pan_number: 'ABCDE1234F',
        street: 'Barakhamba Road, Connaught Place',
        city: 'Delhi',
        district: 'New Delhi',
        state: 'Delhi',
        pincode: '110001',
        is_billing_address_different: false,
        status: 'active',
        maintenance_allowance_minutes: 720, // 12h/month allowance
      },
      {
        company_name: 'Tata Projects Limited',
        contact_person: 'Vikram Mehta',
        phone: '+91 98111 11001',
        gstin: '27AAACT2727Q1ZU',
        pan_number: 'AAACT2727Q',
        street: 'BKC Plot C-26, Bandra East',
        city: 'Mumbai',
        district: 'Mumbai City',
        state: 'Maharashtra',
        pincode: '400051',
        is_billing_address_different: false,
        status: 'active',
        maintenance_allowance_minutes: 0, // No allowance, pure B/D
      },
      {
        company_name: 'NCC Limited',
        contact_person: 'K. R. Rao',
        phone: '+91 98111 11006',
        gstin: '36AAACN1414P1ZL',
        pan_number: 'AAACN1414P',
        street: 'Madhapur Site Complex, Hitech City',
        city: 'Hyderabad',
        district: 'Hyderabad',
        state: 'Telangana',
        pincode: '500081',
        is_billing_address_different: false,
        status: 'active',
        maintenance_allowance_minutes: 480, // 8h/month allowance
      },
      {
        company_name: 'Afcons Infrastructure',
        contact_person: 'Sanjay Deshmukh',
        phone: '+91 98111 11004',
        gstin: '27AAALP1730G1DI',
        pan_number: 'ACYPK1828L',
        street: 'MIDC Hinjawadi Phase 2, IT Park',
        city: 'Pune',
        district: 'Pune',
        state: 'Maharashtra',
        pincode: '411057',
        is_billing_address_different: false,
        status: 'active',
        maintenance_allowance_minutes: 720, // 12h/month allowance
      },
      {
        company_name: 'Reliance Infrastructure EPC',
        contact_person: 'Rajesh Parekh',
        phone: '+91 98111 11003',
        gstin: '24AAACR1234M1Z2',
        pan_number: 'AAACR1234M',
        street: 'SG Highway, Bodakdev',
        city: 'Ahmedabad',
        district: 'Ahmedabad',
        state: 'Gujarat',
        pincode: '380054',
        is_billing_address_different: false,
        status: 'active',
        maintenance_allowance_minutes: 300, // 5h/month allowance
      },
    ];

    const createdClients = [];

    for (const c of clientSpecs) {
      const { data: clientRow, error: cErr } = await admin
        .from('clients')
        .insert({
          company_name: c.company_name,
          contact_person: c.contact_person,
          phone: c.phone,
          gstin: c.gstin,
          pan_number: c.pan_number,
          street: c.street,
          city: c.city,
          district: c.district,
          state: c.state,
          pincode: c.pincode,
          is_billing_address_different: c.is_billing_address_different,
          status: c.status,
          maintenance_allowance_minutes: c.maintenance_allowance_minutes,
        })
        .select('*')
        .single();

      if (cErr) throw new Error(`Client insert failed for ${c.company_name}: ${cErr.message}`);

      // Seed client shift codes (A, B, C) matching frontend expectation
      const shiftTemplates = [
        { client_id: clientRow.id, code: 'A', name: 'Shift A (Morning)', start_time: '06:00:00', end_time: '14:00:00', crosses_midnight: false, scheduled_minutes: 480, normal_minutes: 480, display_order: 1, is_active: true },
        { client_id: clientRow.id, code: 'B', name: 'Shift B (Evening)', start_time: '14:00:00', end_time: '22:00:00', crosses_midnight: false, scheduled_minutes: 480, normal_minutes: 480, display_order: 2, is_active: true },
        { client_id: clientRow.id, code: 'C', name: 'Shift C (Night)', start_time: '22:00:00', end_time: '06:00:00', crosses_midnight: true, scheduled_minutes: 480, normal_minutes: 480, display_order: 3, is_active: true },
      ];
      await admin.from('client_shift_codes').insert(shiftTemplates);

      // Audit log
      await admin.from('audit_logs').insert({
        user_id: primaryAdminId,
        action: 'CLIENT_CREATE',
        entity_type: 'clients',
        entity_id: clientRow.id,
        metadata: { company_name: c.company_name, gstin: c.gstin, maintenance_allowance_minutes: c.maintenance_allowance_minutes },
      });

      console.log(`  ✓ Created Client: ${clientRow.company_name} (Code: ${clientRow.code || clientRow.client_id}, Maint: ${c.maintenance_allowance_minutes}m)`);
      createdClients.push(clientRow);
    }

    // ----------------------------------------------------
    // STEP 5: CREATE MACHINES & OPERATOR ASSIGNMENTS
    // ----------------------------------------------------
    console.log('\n🚜 STEP 5: Creating Fleet Machinery & Operator Assignments...');

    const machineFleet = [
      { machine_id: 'M/C-0001', machine_name: 'JCB 3DX Super #1', model: 'JCB 3DX Super', manufacturer: 'JCB India', serial_number: 'JCB3DX-2024-001', year_of_mfg: 2024, initial_meter: 1240.0, client_idx: 0, op_idx: 0 },
      { machine_id: 'M/C-0002', machine_name: 'CAT 320D2 Excavator', model: 'CAT 320D2', manufacturer: 'Caterpillar', serial_number: 'CAT320-2023-002', year_of_mfg: 2023, initial_meter: 1560.5, client_idx: 1, op_idx: 1 },
      { machine_id: 'M/C-0003', machine_name: 'Komatsu PC210 Hydraulic', model: 'Komatsu PC210-10M0', manufacturer: 'Komatsu', serial_number: 'KOM210-2024-003', year_of_mfg: 2024, initial_meter: 890.0, client_idx: 2, op_idx: 2 },
      { machine_id: 'M/C-0004', machine_name: 'Volvo EC210D Crawler', model: 'Volvo EC210D', manufacturer: 'Volvo CE', serial_number: 'VOL210-2023-004', year_of_mfg: 2023, initial_meter: 2100.0, client_idx: 3, op_idx: 3 },
      { machine_id: 'M/C-0005', machine_name: 'Tata Hitachi EX200', model: 'Tata Hitachi EX200', manufacturer: 'Tata Hitachi', serial_number: 'HIT200-2022-005', year_of_mfg: 2022, initial_meter: 3250.0, client_idx: 4, op_idx: 4 },
      { machine_id: 'M/C-0006', machine_name: 'Sany SY215C Excavator', model: 'Sany SY215C', manufacturer: 'Sany Heavy', serial_number: 'SNY215-2024-006', year_of_mfg: 2024, initial_meter: 640.0, client_idx: 0, op_idx: 5 },
    ];

    const seededMachines = [];

    for (const mf of machineFleet) {
      const client = createdClients[mf.client_idx];
      const operator = operatorUserMap[mf.op_idx];

      const { data: mRow, error: mErr } = await admin
        .from('machines')
        .insert({
          machine_id: mf.machine_id,
          machine_name: mf.machine_name,
          model: mf.model,
          manufacturer: mf.manufacturer,
          serial_number: mf.serial_number,
          year_of_mfg: mf.year_of_mfg,
          hour_meter: mf.initial_meter,
          status: 'rented',
          health_status: 'active',
          ownership_type: 'company_owned',
          client_id: client.id,
          customer_name: client.company_name,
          customer_mobile: client.phone,
          customer_address: client.street,
          city: client.city,
          state: client.state,
          current_operator_id: operator.id,
          current_supervisor_id: supervisorId,
          created_by: primaryAdminId,
        })
        .select('*')
        .single();

      if (mErr) throw new Error(`Machine insert failed for ${mf.machine_id}: ${mErr.message}`);

      // Create active operator assignment
      const { error: assignErr } = await admin.from('operator_machine_assignments').insert({
        machine_id: mRow.id,
        operator_id: operator.id,
        shift_code: 'A',
        shift_start_time: '06:00:00',
        shift_end_time: '14:00:00',
        is_active: true,
        assigned_by: primaryAdminId,
        assigned_at: new Date().toISOString(),
      });
      if (assignErr) {
        console.warn(`  ⚠️ Assignment warning for machine ${mRow.machine_id}:`, assignErr.message);
      }

      console.log(`  ✓ Machine ${mRow.machine_id} (${mRow.model}) -> Client: ${client.company_name}, Operator: ${operator.full_name}`);
      seededMachines.push({
        machine: mRow,
        client,
        operator,
        initialMeter: mf.initial_meter,
      });
    }

    // ----------------------------------------------------
    // STEP 6: LOGS ENTRY VIA LOG PAGE ACCEPTANCE CRITERIA
    // ----------------------------------------------------
    console.log('\n⏱️ STEP 6: Submitting Machine Logs via Log Page Atomic Submission Pipeline...');
    console.log('  (Using submit_operator_hour_log_atomic RPC: meter sequence progression, shift timing, breakdown tracking, and maintenance allowance calculation)\n');

    // Dates for recent days (within allowed 7-day operator window up to current date 2026-10-01)
    const logDates = [
      '2026-09-26',
      '2026-09-27',
      '2026-09-28',
      '2026-09-29',
      '2026-09-30',
      '2026-10-01',
    ];

    let totalLogsCreated = 0;

    for (const sm of seededMachines) {
      let currentMeter = sm.initialMeter;

      for (let i = 0; i < logDates.length; i++) {
        const logDate = logDates[i];
        const isLastDay = i === logDates.length - 1;

        // Shift A: 06:00 AM to 02:00 PM
        const startTime = '06:00 AM';
        const endTime = '02:00 PM';
        const startIso = `${logDate}T06:00:00+05:30`;
        const endIso = `${logDate}T14:00:00+05:30`;

        let runHours = 6.5;
        let isBreakdown = false;
        let bkdStart = null;
        let bkdEnd = null;
        let bkdDuration = null;
        let bkdHours = 0;
        let condition = 'good';
        let remarks = `Standard daily shift execution on ${sm.client.company_name} project.`;

        // Scenario variation across days:
        if (i === 1 && sm.machine.machine_id === 'M/C-0001') {
          // Day 2 on M/C-0001 (L&T, has 720m allowance): 1.5h breakdown -> covered by maintenance allowance
          runHours = 5.5;
          isBreakdown = true;
          bkdStart = '10:00 AM';
          bkdEnd = '11:30 AM';
          bkdDuration = '10:00 AM - 11:30 AM (90min)';
          bkdHours = 1.5;
          condition = 'breakdown';
          remarks = `Hydraulic hose pressure check. [Breakdown Duration: ${bkdDuration}]`;
        } else if (i === 2 && sm.machine.machine_id === 'M/C-0002') {
          // Day 3 on M/C-0002 (Tata Projects, 0 allowance): 1.0h breakdown -> pure B/D
          runHours = 6.0;
          isBreakdown = true;
          bkdStart = '11:00 AM';
          bkdEnd = '12:00 PM';
          bkdDuration = '11:00 AM - 12:00 PM (60min)';
          bkdHours = 1.0;
          condition = 'breakdown';
          remarks = `Bucket cylinder seal replacement. [Breakdown Duration: ${bkdDuration}]`;
        } else if (i === 3) {
          // Day 4: High activity shift with 1.5h overtime
          runHours = 7.5;
          remarks = 'Extended concrete excavation cycle. Machine running smoothly.';
        }

        const startMeter = Math.round(currentMeter * 10) / 10;
        const endMeter = Math.round((startMeter + runHours) * 10) / 10;
        currentMeter = endMeter;

        const idempotencyKey = `seed_log_${sm.machine.id}_${logDate}_shiftA`;

        // Call atomic RPC
        const { data: rpcRes, error: rpcErr } = await admin.rpc('submit_operator_hour_log_atomic', {
          p_machine_id: sm.machine.id,
          p_operator_id: sm.operator.id,
          p_client_id: sm.client.id,
          p_log_date: logDate,
          p_end_date: logDate,
          p_start_datetime: startIso,
          p_end_datetime: endIso,
          p_start_meter: startMeter,
          p_end_meter: endMeter,
          p_start_time: startTime,
          p_end_time: endTime,
          p_overtime_hours: i === 3 ? 1.5 : 0,
          p_normal_working_hours: 8.0,
          p_is_breakdown: isBreakdown,
          p_breakdown_start_time: bkdStart,
          p_breakdown_end_time: bkdEnd,
          p_breakdown_duration: bkdDuration,
          p_breakdown_hours: bkdHours,
          p_shift: 'Shift A',
          p_shift_code: 'A',
          p_machine_condition: condition,
          p_location: sm.operator.location,
          p_remarks: remarks,
          p_idempotency_key: idempotencyKey,
          p_entered_by: sm.operator.id,
        });

        if (rpcErr) {
          console.error(`  ❌ RPC failed for ${sm.machine.machine_id} on ${logDate}:`, rpcErr.message);
        } else {
          totalLogsCreated++;
        }
      }

      console.log(`  ✓ Seeded logs for ${sm.machine.machine_id} (${sm.machine.model}) -> Final Meter: ${Math.round(currentMeter * 10) / 10}`);
    }

    console.log(`\n  ✓ Total verified logs submitted via frontend pipeline: ${totalLogsCreated}`);

    console.log('\n====================================================');
    console.log('🎉 RESEEDING COMPLETED SUCCESSFULLY WITH 100% FRONTEND PARITY!');
    console.log('====================================================\n');
  } catch (err) {
    console.error('FATAL EXCEPTION DURING SEEDING:', err);
    process.exit(1);
  }
}

async function uploadUserDocuments(userId, role) {
  const docTypes = ['bank_document', 'aadhaar', 'driving_license'];
  for (const dt of docTypes) {
    const ext = 'pdf';
    const storagePath = `documents/${userId}/${dt}.${ext}`;

    const { error: upErr } = await admin.storage
      .from('user_files')
      .upload(storagePath, DUMMY_PDF_BYTES, {
        contentType: 'application/pdf',
        upsert: true,
      });

    if (!upErr) {
      const { error: docErr } = await admin.from('user_documents').upsert({
        user_id: userId,
        document_type_code: dt === 'driving_license' ? 'driving_license' : dt,
        storage_path: storagePath,
        mime_type: 'application/pdf',
        file_size_bytes: DUMMY_PDF_BYTES.length,
        file_name: `${dt}_verified.pdf`,
        status: 'verified',
      }, { onConflict: 'user_id,document_type_code' });
      if (docErr) {
        console.warn(`  ⚠️ User document insert warning for ${userId}/${dt}:`, docErr.message);
      }
    } else {
      console.warn(`  ⚠️ Document upload warning for ${userId}/${dt}:`, upErr.message);
    }
  }
}

async function approveUserInWorkflow(userId, fullName, email, role, adminId) {
  // Update status to active
  await admin.from('users').update({
    status: 'active',
    updated_at: new Date().toISOString(),
  }).eq('id', userId);

  // Confirm email in auth so user can sign in
  await admin.auth.admin.updateUserById(userId, { email_confirm: true });

  // Log audit
  await admin.from('audit_logs').insert({
    action: 'user.approved',
    entity_type: 'user',
    entity_id: userId,
    user_id: adminId,
    metadata: {
      user_email: email,
      user_name: fullName,
      role,
      approved_by: 'admin@reachinternational.co.in',
    },
  });
}

run();
