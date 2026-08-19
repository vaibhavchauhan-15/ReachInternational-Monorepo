import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

function loadEnv() {
  if (!process.env.SUPABASE_SECRET_KEY) {
    try {
      const envPath = path.resolve(process.cwd(), '.env');
      if (fs.existsSync(envPath)) {
        const content = fs.readFileSync(envPath, 'utf8');
        content.split('\n').forEach((line) => {
          const trimmed = line.trim();
          if (trimmed && !trimmed.startsWith('#')) {
            const [key, ...vals] = trimmed.split('=');
            if (key && vals.length > 0) {
              process.env[key.trim()] = vals.join('=').trim();
            }
          }
        });
      }
    } catch (err) {
      console.warn('Could not read .env file automatically:', err.message);
    }
  }
}

loadEnv();

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://dhbbgfzbyatzvqafnsqp.supabase.co';
const SUPABASE_SECRET_KEY = process.env.SUPABASE_SECRET_KEY;

if (!SUPABASE_SECRET_KEY) {
  console.error('ERROR: Missing SUPABASE_SECRET_KEY env variable.');
  process.exit(1);
}

const admin = createClient(SUPABASE_URL, SUPABASE_SECRET_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

console.log('🚀 Starting Comprehensive Dummy Data Seeding...');
console.log(`Target Supabase URL: ${SUPABASE_URL}\n`);

async function seed() {
  // ====================================================
  // STEP 1: AUTH USERS & PUBLIC PROFILES
  // ====================================================
  console.log('1️⃣ Seeding Auth Users & Profiles...');

  const testUsers = [
    { email: 'superadmin@reachinternation.co.in', password: 'Password@123456', role: 'super_admin', full_name: 'Super Admin User', phone: '+91 98765 00001' },
    { email: 'admin@reachinternation.co.in', password: 'Password@123456', role: 'admin', full_name: 'Rajesh Sharma', phone: '+91 98765 00002' },
    { email: 'branchmanager@reachinternation.co.in', password: 'Password@123456', role: 'branch_manager', full_name: 'Sanjeev Kapoor', phone: '+91 98765 00012' },
    { email: 'servicemanager@reachinternation.co.in', password: 'Password@123456', role: 'service_manager', full_name: 'Pankaj Verma', phone: '+91 98765 00015' },
    { email: 'engineer@reachinternation.co.in', password: 'Password@123456', role: 'service_engineer', full_name: 'Amit Kumar', phone: '+91 98765 00003' },
    { email: 'engineer2@reachinternation.co.in', password: 'Password@123456', role: 'service_engineer', full_name: 'Rohan Verma', phone: '+91 98765 00004' },
    { email: 'supervisor@reachinternation.co.in', password: 'Password@123456', role: 'supervisor', full_name: 'Vikram Singh', phone: '+91 98765 00005' },
    { email: 'storemanager@reachinternation.co.in', password: 'Password@123456', role: 'store_manager', full_name: 'Suresh Gupta', phone: '+91 98765 00006' },
    { email: 'operator@reachinternation.co.in', password: 'Password@123456', role: 'operator', full_name: 'Deepak Patel', phone: '+91 98765 00007' },
    { email: 'mechanic@reachinternation.co.in', password: 'Password@123456', role: 'mechanic', full_name: 'Manoj Yadav', phone: '+91 98765 00008' },
    { email: 'hr@reachinternation.co.in', password: 'Password@123456', role: 'hr_manager', full_name: 'Priya Nair', phone: '+91 98765 00009' },
    { email: 'finance@reachinternation.co.in', password: 'Password@123456', role: 'finance_manager', full_name: 'Animesh Roy', phone: '+91 98765 00010' },
    { email: 'sales@reachinternation.co.in', password: 'Password@123456', role: 'sales_executive', full_name: 'Tarun Joshi', phone: '+91 98765 00013' },
    { email: 'rentalmanager@reachinternation.co.in', password: 'Password@123456', role: 'rental_manager', full_name: 'Neha Saxena', phone: '+91 98765 00014' },
    { email: 'client@reachinternation.co.in', password: 'Password@123456', role: 'client', full_name: 'Ramesh Pushpa', phone: '+91 98765 00011' },
  ];

  const userMap = {}; // role or email -> userId
  const { data: existingUsersData } = await admin.auth.admin.listUsers();
  if (existingUsersData?.users) {
    for (const u of existingUsersData.users) {
      if (u.email) userMap[u.email] = u.id;
      if (u.user_metadata?.role) userMap[u.user_metadata.role] = u.id;
    }
  }

  for (const u of testUsers) {
    let userId = userMap[u.email];
    if (!userId) {
      const { data: created, error } = await admin.auth.admin.createUser({
        email: u.email,
        password: u.password,
        email_confirm: true,
        user_metadata: { full_name: u.full_name, phone: u.phone, role: u.role },
      });
      if (created?.user) {
        userId = created.user.id;
        console.log(`  ✓ Created auth user: ${u.email} (${u.role})`);
      } else {
        console.warn(`  ⚠️ Auth create info for ${u.email}:`, error?.message);
      }
    } else {
      console.log(`  ✓ Existing auth user found: ${u.email} (${u.role})`);
    }

    if (userId) {
      userMap[u.role] = userId;
      userMap[u.email] = userId;

      await admin.from('users').upsert({
        id: userId,
        full_name: u.full_name,
        phone: u.phone,
        role: u.role,
        status: 'active',
        email: u.email,
      });
    }
  }

  const primaryAdminId = userMap['admin'] || userMap['super_admin'] || Object.values(userMap)[0];
  const primaryEngineerId = userMap['service_engineer'] || userMap['engineer'] || primaryAdminId;
  const secondaryEngineerId = userMap['engineer2@reachinternation.com'] || primaryEngineerId;
  const primarySupervisorId = userMap['supervisor'] || primaryAdminId;
  const primaryStoreManagerId = userMap['store_manager'] || primaryAdminId;
  const primaryOperatorId = userMap['operator'] || primaryAdminId;

  // ====================================================
  // STEP 2: BRANCHES & USER_BRANCHES
  // ====================================================
  console.log('\n2️⃣ Seeding Branches & User Branch Mappings...');

  const branchesToInsert = [
    { code: 'DEL-HQ', name: 'Delhi Branch', city: 'Delhi', state: 'Delhi', address: 'Plot 45 GIDC, Okhla Industrial Area Phase III', phone: '+91 98765 43210', email: 'delhi@reachinternational.com', status: 'active' },
  ];

  await admin.from('branches').upsert(branchesToInsert, { onConflict: 'code' });
  const { data: delBranch } = await admin.from('branches').select('id').eq('code', 'DEL-HQ').single();
  const mainBranchId = delBranch ? delBranch.id : null;

  // Clean up any extra branches
  if (mainBranchId) {
    await admin.from('branches').delete().neq('id', mainBranchId);
  }

  const { data: allBranches } = await admin.from('branches').select('*');
  const branchMap = { 'DEL-HQ': mainBranchId };

  const uniqueUserIds = Array.from(new Set(Object.values(userMap))).filter((id) => typeof id === 'string' && id.includes('-'));

  await admin.from('users').update({ branch_id: mainBranchId }).in('id', uniqueUserIds);
  const userBranchRows = uniqueUserIds.map((uid) => ({ user_id: uid, branch_id: mainBranchId }));
  await admin.from('user_branches').upsert(userBranchRows, { onConflict: 'user_id,branch_id' });
  await admin.from('user_branches').delete().neq('branch_id', mainBranchId);

  // ====================================================
  // STEP 3: EMPLOYEES DIRECTORY
  // ====================================================
  console.log('\n3️⃣ Seeding Employees...');

  const employeesData = [
    { employee_code: 'EMP-DEL-001', full_name: 'Rajesh Sharma', designation: 'Branch Manager', department: 'Operations', branch_id: mainBranchId, user_id: userMap['admin'], phone: '+91 98765 00002', email: 'admin@reachinternation.co.in', salary: 120000 },
    { employee_code: 'EMP-DEL-002', full_name: 'Suresh Gupta', designation: 'Store Manager', department: 'Inventory', branch_id: mainBranchId, user_id: userMap['store_manager'], phone: '+91 98765 00006', email: 'storemanager@reachinternation.co.in', salary: 85000 },
    { employee_code: 'EMP-DEL-003', full_name: 'Amit Kumar', designation: 'Senior Service Engineer', department: 'Service', branch_id: mainBranchId, user_id: userMap['service_engineer'], phone: '+91 98765 00003', email: 'engineer@reachinternation.co.in', salary: 75000 },
    { employee_code: 'EMP-DEL-004', full_name: 'Rohan Verma', designation: 'Field Service Engineer', department: 'Service', branch_id: mainBranchId, user_id: userMap['engineer2@reachinternation.co.in'], phone: '+91 98765 00004', email: 'engineer2@reachinternation.co.in', salary: 65000 },
    { employee_code: 'EMP-DEL-005', full_name: 'Vikram Singh', designation: 'Site Supervisor', department: 'Field Operations', branch_id: mainBranchId, user_id: userMap['supervisor'], phone: '+91 98765 00005', email: 'supervisor@reachinternation.co.in', salary: 55000 },
    { employee_code: 'EMP-DEL-006', full_name: 'Sanjeev Kapoor', designation: 'Branch Manager', department: 'Management', branch_id: mainBranchId, user_id: userMap['branch_manager'], phone: '+91 98765 00012', email: 'branchmanager@reachinternation.co.in', salary: 110000 },
    { employee_code: 'EMP-DEL-007', full_name: 'Deepak Patel', designation: 'Machine Operator', department: 'Operations', branch_id: mainBranchId, user_id: userMap['operator'], phone: '+91 98765 00007', email: 'operator@reachinternation.co.in', salary: 35000 },
    { employee_code: 'EMP-DEL-008', full_name: 'Manoj Yadav', designation: 'Repair Technician / Mechanic', department: 'Service', branch_id: mainBranchId, user_id: userMap['mechanic'], phone: '+91 98765 00008', email: 'mechanic@reachinternation.co.in', salary: 45000 },
    { employee_code: 'EMP-DEL-009', full_name: 'Priya Nair', designation: 'HR Manager', department: 'Human Resources', branch_id: mainBranchId, user_id: userMap['hr_manager'], phone: '+91 98765 00009', email: 'hr@reachinternation.co.in', salary: 90000 },
    { employee_code: 'EMP-DEL-010', full_name: 'Animesh Roy', designation: 'Accounts / Finance Manager', department: 'Finance', branch_id: mainBranchId, user_id: userMap['finance_manager'], phone: '+91 98765 00010', email: 'finance@reachinternation.co.in', salary: 95000 },
    { employee_code: 'EMP-DEL-011', full_name: 'Tarun Joshi', designation: 'Sales Executive', department: 'Sales', branch_id: mainBranchId, user_id: userMap['sales_executive'], phone: '+91 98765 00013', email: 'sales@reachinternation.co.in', salary: 70000 },
    { employee_code: 'EMP-DEL-012', full_name: 'Neha Saxena', designation: 'Rental Fleet Manager', department: 'Rental', branch_id: mainBranchId, user_id: userMap['rental_manager'], phone: '+91 98765 00014', email: 'rentalmanager@reachinternation.co.in', salary: 80000 },
  ];

  await admin.from('employees').upsert(employeesData, { onConflict: 'employee_code' });

  // ====================================================
  // STEP 4: MANUFACTURERS, CATEGORIES & MODELS
  // ====================================================
  console.log('\n4️⃣ Seeding Manufacturers, Categories & Models...');

  const mfrData = [
    { name: 'JCB', country: 'United Kingdom' },
    { name: 'Genie', country: 'United States' },
    { name: 'ACE', country: 'India' },
    { name: 'Hyundai', country: 'South Korea' },
    { name: 'Toyota', country: 'Japan' },
    { name: 'Godrej', country: 'India' },
  ];
  await admin.from('manufacturers').upsert(mfrData, { onConflict: 'name' });
  const { data: mfrs } = await admin.from('manufacturers').select('*');
  const mfrMap = {};
  (mfrs || []).forEach((m) => (mfrMap[m.name] = m.id));

  const catData = [
    { name: 'Forklift', description: 'Material handling equipment for lifting and moving heavy loads' },
    { name: 'Scissor Lift', description: 'Aerial work platform with crossing scissor mechanism' },
    { name: 'Boom Lift', description: 'Articulated or telescopic aerial work platform' },
    { name: 'Reach Truck', description: 'Narrow aisle warehouse electric forklift' },
    { name: 'Pallet Truck', description: 'Manual or electric pallet jack equipment' },
    { name: 'Generators', description: 'Industrial diesel power generators' },
  ];
  await admin.from('machine_categories').upsert(catData, { onConflict: 'name' });
  const { data: cats } = await admin.from('machine_categories').select('*');
  const catMap = {};
  (cats || []).forEach((c) => (catMap[c.name] = c.id));

  const modelsData = [
    { manufacturer_id: mfrMap['JCB'], model_name: 'JCB 3DX', category_id: catMap['Forklift'] },
    { manufacturer_id: mfrMap['JCB'], model_name: 'JCB 4DX', category_id: catMap['Forklift'] },
    { manufacturer_id: mfrMap['Genie'], model_name: 'Genie GS-1930', category_id: catMap['Scissor Lift'] },
    { manufacturer_id: mfrMap['Genie'], model_name: 'Genie Z-45/25', category_id: catMap['Boom Lift'] },
    { manufacturer_id: mfrMap['ACE'], model_name: 'ACE FX-150', category_id: catMap['Forklift'] },
    { manufacturer_id: mfrMap['Hyundai'], model_name: 'Hyundai 25L-7A', category_id: catMap['Forklift'] },
    { manufacturer_id: mfrMap['Godrej'], model_name: 'Godrej GX 300D', category_id: catMap['Reach Truck'] },
  ];
  for (const m of modelsData) {
    if (m.manufacturer_id) {
      await admin.from('machine_models').upsert(m, { onConflict: 'manufacturer_id,model_name' });
    }
  }
  const { data: models } = await admin.from('machine_models').select('*');
  const modelMap = {};
  (models || []).forEach((md) => (modelMap[md.model_name] = md.id));

  // ====================================================
  // STEP 5: MACHINES MASTER DATA
  // ====================================================
  console.log('\n5️⃣ Seeding Machines Fleet...');

  const machinesData = [
    {
      machine_code: 'MCH-2026-001',
      machine_name: 'JCB 3DX Heavy Duty Forklift',
      model: 'JCB 3DX',
      customer_name: 'Pushpa Infracon Pvt Ltd',
      customer_mobile: '+91 98112 34567',
      customer_address: 'Plot 12 Sector 62, Noida, UP',
      city: 'Delhi',
      state: 'Delhi',
      engineer_id: primaryEngineerId,
      branch_id: mainBranchId,
      category_id: catMap['Forklift'],
      category_name: 'Forklift',
      manufacturer_id: mfrMap['JCB'],
      model_id: modelMap['JCB 3DX'],
      last_service_date: '2026-05-20',
      next_service_due_date: '2026-08-20',
      service_interval_days: 90,
      hour_meter: 1420.5,
      status: 'active',
      current_operator_id: primaryOperatorId,
      current_supervisor_id: primarySupervisorId,
    },
    {
      machine_code: 'MCH-2026-002',
      machine_name: 'Genie GS-1930 Electric Scissor Lift',
      model: 'Genie GS-1930',
      customer_name: 'L&T Construction Site 4',
      customer_mobile: '+91 98223 45678',
      customer_address: 'Golf Course Extension Road, Gurgaon',
      city: 'Gurgaon',
      state: 'Haryana',
      engineer_id: secondaryEngineerId,
      branch_id: mainBranchId,
      category_id: catMap['Scissor Lift'],
      category_name: 'Scissor Lift',
      manufacturer_id: mfrMap['Genie'],
      model_id: modelMap['Genie GS-1930'],
      last_service_date: '2026-06-15',
      next_service_due_date: '2026-08-15',
      service_interval_days: 60,
      hour_meter: 850.0,
      status: 'active',
      current_supervisor_id: primarySupervisorId,
    },
    {
      machine_code: 'MCH-2026-003',
      machine_name: 'ACE FX-150 Hydraulic Crane',
      model: 'ACE FX-150',
      customer_name: 'DLF Cyber City Ops',
      customer_mobile: '+91 98334 56789',
      customer_address: 'DLF Cyber City Phase II, Gurgaon',
      city: 'Gurgaon',
      state: 'Haryana',
      engineer_id: secondaryEngineerId,
      branch_id: mainBranchId,
      category_id: catMap['Forklift'],
      category_name: 'Forklift',
      manufacturer_id: mfrMap['ACE'],
      model_id: modelMap['ACE FX-150'],
      last_service_date: '2026-05-10',
      next_service_due_date: '2026-08-10',
      service_interval_days: 90,
      hour_meter: 2150.0,
      status: 'active',
      current_supervisor_id: primarySupervisorId,
    },
    {
      machine_code: 'MCH-2026-004',
      machine_name: 'Hyundai 25L-7A Diesel Forklift',
      model: 'Hyundai 25L-7A',
      customer_name: 'Reliance Retail Logistics',
      customer_mobile: '+91 98445 67890',
      customer_address: 'Warehouse Hub 9, Kundli, Haryana',
      city: 'Delhi',
      state: 'Delhi',
      engineer_id: primaryEngineerId,
      branch_id: mainBranchId,
      category_id: catMap['Forklift'],
      category_name: 'Forklift',
      manufacturer_id: mfrMap['Hyundai'],
      model_id: modelMap['Hyundai 25L-7A'],
      last_service_date: '2026-06-01',
      next_service_due_date: '2026-09-01',
      service_interval_days: 90,
      hour_meter: 540.0,
      status: 'active',
    },
    {
      machine_code: 'MCH-2026-005',
      machine_name: 'Godrej GX 300D Warehouse Reach Truck',
      model: 'Godrej GX 300D',
      customer_name: 'Amazon Fulfillment Center',
      customer_mobile: '+91 98556 78901',
      customer_address: 'Bhiwandi Hub Sector 4, Thane',
      city: 'Delhi',
      state: 'Delhi',
      engineer_id: primaryEngineerId,
      branch_id: mainBranchId,
      category_id: catMap['Reach Truck'],
      category_name: 'Reach Truck',
      manufacturer_id: mfrMap['Godrej'],
      model_id: modelMap['Godrej GX 300D'],
      last_service_date: '2026-06-14',
      next_service_due_date: '2026-08-14',
      service_interval_days: 60,
      hour_meter: 3120.0,
      status: 'active',
      current_operator_id: primaryOperatorId,
    },
  ];

  await admin.from('machines').upsert(machinesData, { onConflict: 'machine_code' });
  const { data: allMachines } = await admin.from('machines').select('*');
  const machineMap = {};
  (allMachines || []).forEach((mc) => (machineMap[mc.machine_code] = mc.id));

  // ====================================================
  // STEP 6: MACHINE ASSIGNMENTS & HOUR LOGS
  // ====================================================
  console.log('\n6️⃣ Seeding Machine Assignments & Operator Hour Logs...');

  if (machineMap['MCH-2026-001'] && primaryOperatorId) {
    await admin.from('machine_assignments').insert({
      machine_id: machineMap['MCH-2026-001'],
      operator_id: primaryOperatorId,
      assigned_by: primaryAdminId,
      status: 'active',
      notes: 'Assigned for Pushpa Infracon Noida site ops',
    });

    const logs = [
      { machine_id: machineMap['MCH-2026-001'], operator_id: primaryOperatorId, log_date: '2026-08-10', start_meter: 1400.0, end_meter: 1408.0, location: 'Noida Site' },
      { machine_id: machineMap['MCH-2026-001'], operator_id: primaryOperatorId, log_date: '2026-08-11', start_meter: 1408.0, end_meter: 1415.5, location: 'Noida Site' },
      { machine_id: machineMap['MCH-2026-001'], operator_id: primaryOperatorId, log_date: '2026-08-12', start_meter: 1415.5, end_meter: 1420.5, location: 'Noida Site' },
    ];
    await admin.from('machine_hour_logs').insert(logs);
  }

  // ====================================================
  // STEP 7: BREAKDOWN COMPLAINTS & SERVICE RECORDS
  // ====================================================
  console.log('\n7️⃣ Seeding Complaints & Service Records...');

  if (machineMap['MCH-2026-001']) {
    const complaintsData = [
      {
        complaint_no: 'CMP-2026-001',
        machine_id: machineMap['MCH-2026-001'],
        supervisor_id: primarySupervisorId,
        engineer_id: primaryEngineerId,
        complaint_date: '2026-08-01',
        location: 'Noida Sector 62 Site',
        hour_meter: 1420.5,
        required_part: 'Hydraulic Cylinder Seal Kit',
        part_quantity: 1,
        complaint: 'Hydraulic oil leak from main boom cylinder seal',
        work_done: 'Inspected cylinder, replaced damaged seal kit, pressure tested to 210 bar',
        status: 'closed',
      },
      {
        complaint_no: 'CMP-2026-002',
        machine_id: machineMap['MCH-2026-003'] || machineMap['MCH-2026-001'],
        supervisor_id: primarySupervisorId,
        engineer_id: secondaryEngineerId,
        complaint_date: '2026-08-10',
        location: 'Gurgaon DLF Site',
        hour_meter: 2150.0,
        required_part: 'Engine Oil Filter & Cooling Fan Belt',
        part_quantity: 2,
        complaint: 'Engine overheating during heavy boom extension',
        status: 'in_progress',
      },
      {
        complaint_no: 'CMP-2026-003',
        machine_id: machineMap['MCH-2026-005'] || machineMap['MCH-2026-001'],
        supervisor_id: primarySupervisorId,
        engineer_id: primaryEngineerId,
        complaint_date: '2026-08-12',
        location: 'Amazon Hub Bhiwandi',
        hour_meter: 3120.0,
        required_part: 'Drive Controller PCB Module',
        part_quantity: 1,
        complaint: 'Control joystick intermittent fault during forward movement',
        status: 'pending_parts',
      },
    ];

    await admin.from('machine_complaints').upsert(complaintsData, { onConflict: 'complaint_no' });

    const serviceData = [
      {
        machine_id: machineMap['MCH-2026-001'],
        engineer_id: primaryEngineerId,
        supervisor_id: primarySupervisorId,
        service_date: '2026-05-20',
        notes: 'Full 90-day preventive maintenance completed. Oil replaced, filter cleaned, greasing done.',
        service_category: 'Preventive Maintenance',
        service_status: 'completed',
        hour_meter: 1350.0,
        next_service_due_date: '2026-08-20',
      },
      {
        machine_id: machineMap['MCH-2026-002'] || machineMap['MCH-2026-001'],
        engineer_id: secondaryEngineerId,
        supervisor_id: primarySupervisorId,
        service_date: '2026-06-15',
        notes: '60-day scissor lift hydraulic check & battery load test.',
        service_category: 'Electrical & Hydraulic Inspection',
        service_status: 'completed',
        hour_meter: 800.0,
        next_service_due_date: '2026-08-15',
      },
    ];

    await admin.from('service_records').insert(serviceData);
  }

  // ====================================================
  // STEP 8: NOTIFICATIONS
  // ====================================================
  console.log('\n8️⃣ Seeding Notifications...');

  if (machineMap['MCH-2026-001']) {
    const notifs = [
      {
        machine_id: machineMap['MCH-2026-001'],
        recipient_id: primaryEngineerId,
        alert_type: 'today',
        alert_date: '2026-08-14',
        channel: 'in_app',
        status: 'sent',
        sent_at: new Date().toISOString(),
      },
      {
        machine_id: machineMap['MCH-2026-003'] || machineMap['MCH-2026-001'],
        recipient_id: primaryEngineerId,
        alert_type: 'overdue',
        alert_date: '2026-08-10',
        channel: 'email',
        status: 'pending',
      },
    ];
    await admin.from('notifications').upsert(notifs, { onConflict: 'machine_id,recipient_id,alert_type,alert_date,channel' });
  }

  // ====================================================
  // STEP 9: VENDORS & STORAGE LOCATIONS & INVENTORY
  // ====================================================
  console.log('\n9️⃣ Seeding Vendors, Storage Locations & Inventory Master...');

  const vendorsData = [
    { code: 'VND-001', vendor_name: 'Apex Hydraulics & Spares Ltd', contact_person: 'Ramesh Verma', email: 'sales@apexhydraulics.com', phone: '+91 98111 22233', gstin: '07AAACA1234A1Z1', city: 'Delhi', state: 'Delhi', category: 'Hydraulics', rating: 4.8, status: 'active' },
    { code: 'VND-002', vendor_name: 'Metro Diesel Parts & Filters Co', contact_person: 'Karan Malhotra', email: 'orders@metrodiesel.com', phone: '+91 98222 33344', gstin: '06BBBDB5678B1Z2', city: 'Gurgaon', state: 'Haryana', category: 'Filters & Engine', rating: 4.6, status: 'active' },
    { code: 'VND-003', vendor_name: 'National Bearings & Seals India', contact_person: 'Sunil Mehta', email: 'info@nationalseals.in', phone: '+91 98333 44455', gstin: '07CCCEC9012C1Z3', city: 'Delhi', state: 'Delhi', category: 'Seals & Bearings', rating: 4.9, status: 'active' },
    { code: 'VND-004', vendor_name: 'Genie OEM Spares India Pvt Ltd', contact_person: 'Pooja Sundaram', email: 'spares@genieindia.com', phone: '+91 98444 55566', gstin: '29EEEEF7890E1Z5', city: 'Bengaluru', state: 'Karnataka', category: 'OEM Aerial Parts', rating: 5.0, status: 'active' },
  ];

  await admin.from('vendors').upsert(vendorsData, { onConflict: 'code' });
  const { data: allVendors } = await admin.from('vendors').select('*');
  const vendorMap = {};
  (allVendors || []).forEach((v) => (vendorMap[v.code] = v.id));

  // Storage Locations
  const locationsData = [
    { branch_id: mainBranchId, store_name: 'Main Store', zone: 'ZONE-A', rack: 'R-01', shelf: 'S-01', bin: 'B-01', capacity: 100 },
    { branch_id: mainBranchId, store_name: 'Main Store', zone: 'ZONE-A', rack: 'R-01', shelf: 'S-02', bin: 'B-02', capacity: 100 },
    { branch_id: mainBranchId, store_name: 'Main Store', zone: 'ZONE-B', rack: 'R-02', shelf: 'S-03', bin: 'B-04', capacity: 80 },
    { branch_id: mainBranchId, store_name: 'Main Store', zone: 'ZONE-C', rack: 'R-04', shelf: 'S-01', bin: 'B-02', capacity: 200 },
  ];
  await admin.from('inventory_storage_locations').upsert(locationsData, { onConflict: 'branch_id,store_name,zone,rack,shelf,bin' });

  // Inventory Products (Part Master)
  const productsData = [
    {
      part_number: 'HYD-FLT-001',
      name: 'Hydraulic Oil Filter',
      category: 'Filters',
      manufacturer: 'JCB',
      unit: 'Pcs',
      unit_cost: 1250,
      min_stock_level: 10,
      reorder_level: 10,
      reorder_quantity: 20,
      max_stock_level: 100,
      oem_part_number: 'JCB-32/925346',
      rack_number: 'R-01',
      shelf_number: 'S-01',
      bin_number: 'B-01',
      warehouse_zone: 'ZONE-A',
      part_type: 'spare',
      criticality: 'high',
      status: 'active',
    },
    {
      part_number: 'ENG-FLT-002',
      name: 'Engine Oil Filter',
      category: 'Filters',
      manufacturer: 'JCB',
      unit: 'Pcs',
      unit_cost: 850,
      min_stock_level: 15,
      reorder_level: 15,
      reorder_quantity: 30,
      max_stock_level: 150,
      oem_part_number: 'JCB-02/100073',
      rack_number: 'R-01',
      shelf_number: 'S-02',
      bin_number: 'B-02',
      warehouse_zone: 'ZONE-A',
      part_type: 'consumable',
      criticality: 'normal',
      status: 'active',
    },
    {
      part_number: 'AIR-FLT-003',
      name: 'Air Cleaner Element',
      category: 'Filters',
      manufacturer: 'Caterpillar',
      unit: 'Pcs',
      unit_cost: 2100,
      min_stock_level: 5,
      reorder_level: 5,
      reorder_quantity: 15,
      max_stock_level: 50,
      oem_part_number: 'ACE-AF-902',
      rack_number: 'R-02',
      shelf_number: 'S-01',
      bin_number: 'B-01',
      warehouse_zone: 'ZONE-A',
      part_type: 'spare',
      criticality: 'normal',
      status: 'active',
    },
    {
      part_number: 'HYD-SEAL-01',
      name: 'Hydraulic Cylinder Seal Kit',
      category: 'Seals',
      manufacturer: 'Hyundai',
      unit: 'Set',
      unit_cost: 3400,
      min_stock_level: 8,
      reorder_level: 8,
      reorder_quantity: 15,
      max_stock_level: 40,
      oem_part_number: 'HYU-31Y1-15200',
      rack_number: 'R-02',
      shelf_number: 'S-03',
      bin_number: 'B-04',
      warehouse_zone: 'ZONE-B',
      part_type: 'assembly',
      criticality: 'critical',
      status: 'active',
    },
    {
      part_number: 'ORING-KIT-01',
      name: 'High Pressure O-Ring Set',
      category: 'Seals',
      manufacturer: 'JCB',
      unit: 'Box',
      unit_cost: 950,
      min_stock_level: 20,
      reorder_level: 20,
      reorder_quantity: 50,
      max_stock_level: 200,
      oem_part_number: 'JCB-993/99500',
      rack_number: 'R-03',
      shelf_number: 'S-01',
      bin_number: 'B-01',
      warehouse_zone: 'ZONE-B',
      part_type: 'consumable',
      criticality: 'normal',
      status: 'active',
    },
  ];

  await admin.from('inventory_products').upsert(productsData, { onConflict: 'part_number' });
  const { data: allProds } = await admin.from('inventory_products').select('*');
  const prodMap = {};
  (allProds || []).forEach((p) => (prodMap[p.part_number] = p.id));

  // Seed inventory stock counts
  for (const pid of Object.values(prodMap)) {
    await admin.from('inventory_stock').upsert(
      { product_id: pid, branch_id: mainBranchId, quantity: 45 },
      { onConflict: 'product_id,branch_id' }
    );
  }

  // ====================================================
  // STEP 10: PURCHASE REQUESTS, POs & GOODS RECEIPTS (GRN)
  // ====================================================
  console.log('\n🔟 Seeding Purchase Requests, POs & Goods Receipts (GRN)...');

  // Purchase Request
  const prRes = await admin
    .from('inventory_purchase_requests')
    .upsert(
      {
        request_no: 'PR-2026-001',
        branch_id: mainBranchId,
        requested_by: primaryStoreManagerId,
        sent_to_manager_id: primaryAdminId,
        priority: 'urgent',
        reason: 'Low stock alert for Hydraulic Oil Filters & Cylinder Seal Kits due to breakdown servicing',
        status: 'approved',
        approved_by: primaryAdminId,
        approved_at: new Date().toISOString(),
      },
      { onConflict: 'request_no' }
    )
    .select()
    .single();

  const prId = prRes.data?.id;
  if (prId && prodMap['HYD-FLT-001']) {
    await admin.from('inventory_purchase_request_items').insert({
      request_id: prId,
      product_id: prodMap['HYD-FLT-001'],
      current_stock: 5,
      min_stock: 10,
      requested_quantity: 20,
      approved_quantity: 20,
      estimated_unit_cost: 1250,
    });
  }

  // Purchase Order
  const poRes = await admin
    .from('purchase_orders')
    .upsert(
      {
        po_number: 'PO-2026-001',
        request_id: prId,
        vendor_id_ref: vendorMap['VND-001'],
        vendor_name: 'Apex Hydraulics & Spares Ltd',
        vendor_gstin: '07AAACA1234A1Z1',
        amount: 29500,
        subtotal: 25000,
        tax_amount: 4500,
        grand_total: 29500,
        status: 'APPROVED',
        requested_by: primaryStoreManagerId,
        branch_id: mainBranchId,
        due_date: '2026-08-25',
      },
      { onConflict: 'po_number' }
    )
    .select()
    .single();

  const poId = poRes.data?.id;
  if (poId && prodMap['HYD-FLT-001']) {
    await admin.from('inventory_purchase_order_items').insert({
      po_id: poId,
      product_id: prodMap['HYD-FLT-001'],
      part_number: 'HYD-FLT-001',
      product_description: 'Hydraulic Oil Filter',
      quantity: 20,
      unit_price: 1250,
      gst_percent: 18,
      gst_amount: 4500,
      total_amount: 29500,
    });
  }

  // Goods Receipt (GRN)
  const grnRes = await admin
    .from('inventory_goods_receipts')
    .upsert(
      {
        grn_number: 'GRN-2026-001',
        po_id: poId,
        supplier_id: vendorMap['VND-001'],
        supplier_name: 'Apex Hydraulics & Spares Ltd',
        bill_number: 'INV-APX-8892',
        bill_date: '2026-08-10',
        delivery_date: '2026-08-12',
        branch_id: mainBranchId,
        received_by: primaryStoreManagerId,
        remarks: 'Received 20 pcs Hydraulic filters in good condition. Verified against PO-2026-001.',
      },
      { onConflict: 'grn_number' }
    )
    .select()
    .single();

  const grnId = grnRes.data?.id;
  if (grnId && prodMap['HYD-FLT-001']) {
    await admin.from('inventory_goods_receipt_items').insert({
      grn_id: grnId,
      product_id: prodMap['HYD-FLT-001'],
      quantity_ordered: 20,
      quantity_received: 20,
      unit_price: 1250,
      tax_amount: 4500,
      total_amount: 29500,
      rack: 'R-01',
      shelf: 'S-01',
      bin: 'B-01',
      batch_number: 'BATCH-2026-HYD1',
    });
  }

  // ====================================================
  // STEP 11: PART ISSUANCE, RETURNS & DELIVERY CHALLANS
  // ====================================================
  console.log('\n11️⃣ Seeding Part Issues, Returns & Delivery Challans...');

  const issueRes = await admin
    .from('inventory_part_issues')
    .upsert(
      {
        issue_number: 'PI-2026-001',
        challan_number: '2201',
        branch_id: mainBranchId,
        machine_id: machineMap['MCH-2026-001'],
        issued_by: primaryStoreManagerId,
        issued_to_name: 'Amit Kumar',
        issued_to_user_id: primaryEngineerId,
        issue_date: '2026-08-13',
        is_returnable: false,
        status: 'issued',
        remarks: 'Issued hydraulic seal kit for CMP-2026-001 breakdown repair on JCB 3DX.',
      },
      { onConflict: 'issue_number' }
    )
    .select()
    .single();

  const issueId = issueRes.data?.id;
  if (issueId && prodMap['HYD-SEAL-01']) {
    await admin.from('inventory_part_issue_items').insert({
      issue_id: issueId,
      product_id: prodMap['HYD-SEAL-01'],
      quantity_issued: 1,
      unit: 'Set',
      machine_code: 'MCH-2026-001',
      is_returnable: false,
    });
  }

  // Delivery Challan
  const challanRes = await admin
    .from('challans')
    .upsert(
      {
        challan_number: 'RI/DC/2026-001',
        issue_id: issueId,
        type: 'DELIVERY',
        status: 'ISSUED',
        issue_date: '2026-08-13',
        from_branch_id: mainBranchId,
        from_address: 'Plot 45 GIDC, Okhla Industrial Area Phase III, Delhi',
        from_gstin: '07AALFR3906M1ZS',
        to_customer_name: 'Pushpa Infracon Pvt Ltd',
        client_name: 'Pushpa Infracon Pvt Ltd',
        to_address: 'Plot 12 Sector 62, Noida, UP',
        destination: 'Noida Site',
        approx_value: 3400,
        amount: 3400,
        expected_delivery: '2026-08-14',
      },
      { onConflict: 'challan_number' }
    )
    .select()
    .single();

  const challanId = challanRes.data?.id;
  if (challanId && prodMap['HYD-SEAL-01']) {
    await admin.from('inventory_delivery_challan_items').insert({
      challan_id: challanId,
      product_id: prodMap['HYD-SEAL-01'],
      part_number: 'HYD-SEAL-01',
      description: 'Hydraulic Cylinder Seal Kit',
      quantity: 1,
      unit: 'Set',
      machine_number: 'MCH-2026-001',
      issue_to: 'Amit Kumar',
      returnable_status: 'NON-RETURNABLE',
    });
  }

  // ====================================================
  // STEP 12: IMPORT BATCHES, AUDIT LOGS & SYSTEM SETTINGS
  // ====================================================
  console.log('\n12️⃣ Seeding Import Batches, Audit Logs & System Settings...');

  await admin.from('import_batches').insert({
    uploaded_by: primaryAdminId,
    filename: 'Initial_Machines_Master_2026.xlsx',
    total_rows: 10,
    success_count: 10,
    failed_count: 0,
    status: 'completed',
  });

  // Audit Logs
  const logs = [
    { user_id: primaryAdminId, action: 'USER_SIGNUP', entity_type: 'user', metadata: { role: 'admin', email: 'admin@reachinternation.com' } },
    { user_id: primaryAdminId, action: 'MACHINE_CREATED', entity_type: 'machine', metadata: { code: 'MCH-2026-001', name: 'JCB 3DX Heavy Duty Forklift' } },
    { user_id: primaryStoreManagerId, action: 'PO_CREATED', entity_type: 'purchase_order', metadata: { po_number: 'PO-2026-001', amount: 29500 } },
    { user_id: primaryStoreManagerId, action: 'GRN_RECEIVED', entity_type: 'goods_receipt', metadata: { grn_number: 'GRN-2026-001', items: 20 } },
  ];
  await admin.from('audit_logs').insert(logs);

  // System Settings
  await admin.from('system_settings').upsert({
    id: '00000000-0000-0000-0000-000000000001',
    daily_run_time: '08:00',
    default_service_interval_days: 90,
    email_from_name: 'Reach International',
  });

  // ====================================================
  // STEP 13: RENTAL DOMAIN SEEDING
  // ====================================================
  console.log('\n13️⃣ Seeding Rental Domain Records...');

  const rentalManagerId = userMap['rentalmanager@reachinternation.co.in'] || primaryAdminId;

  // Rental Customer
  const { data: customerData } = await admin.from('rental_customers').upsert({
    customer_code: 'RC-1001',
    company_name: 'Larsen & Toubro Infra Ltd',
    contact_person: 'Anil Mehta',
    contact_mobile: '+91 98765 43210',
    contact_email: 'anil.mehta@ltinfra.com',
    billing_address: 'Plot 45, BKC Commercial Hub',
    city: 'Mumbai',
    state: 'Maharashtra',
    gstin: '27AAACL1682R1ZB',
    status: 'active',
    created_by: rentalManagerId,
  }).select('id').single();

  const customerId = customerData?.id;

  if (customerId) {
    // Rental Request
    const { data: requestData } = await admin.from('rental_requests').upsert({
      request_number: 'RR-1001',
      customer_id: customerId,
      customer_name: 'Larsen & Toubro Infra Ltd',
      contact_mobile: '+91 98765 43210',
      category_name: 'Forklift',
      required_quantity: 1,
      start_date: new Date().toISOString().split('T')[0],
      end_date: new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0],
      site_location: 'Metropolitan Metro Line 4, Thane',
      city: 'Thane',
      state: 'Maharashtra',
      operator_required: true,
      delivery_required: true,
      status: 'converted_to_contract',
      created_by: rentalManagerId,
    }).select('id').single();

    // Fetch a machine for rental
    const { data: machineList } = await admin.from('machines').select('id').limit(1);
    const rentalMachineId = machineList?.[0]?.id;

    if (rentalMachineId) {
      // Rental Agreement
      const { data: contractData } = await admin.from('rental_agreements').upsert({
        contract_number: 'RA-2026-001',
        rental_request_id: requestData?.id,
        customer_id: customerId,
        machine_id: rentalMachineId,
        start_date: new Date().toISOString().split('T')[0],
        end_date: new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0],
        rental_rate: 65000,
        rate_unit: 'monthly',
        allowed_hours_per_day: 8,
        extra_hour_rate: 450,
        security_deposit: 30000,
        delivery_charges: 5000,
        operator_provided: true,
        status: 'active',
        created_by: rentalManagerId,
      }).select('id').single();

      const contractId = contractData?.id;

      if (contractId) {
        // Delivery Challan
        await admin.from('rental_delivery_challans').upsert({
          challan_number: 'RDC-1001',
          rental_agreement_id: contractId,
          customer_id: customerId,
          machine_id: rentalMachineId,
          dispatch_date: new Date().toISOString(),
          site_location: 'Metropolitan Metro Line 4, Thane',
          start_hour_meter: 150,
          start_fuel_level: 100,
          status: 'finalized',
          created_by: rentalManagerId,
        });

        // Return Inspection
        const { data: inspData } = await admin.from('rental_return_inspections').upsert({
          inspection_number: 'RI-1001',
          rental_agreement_id: contractId,
          machine_id: rentalMachineId,
          customer_id: customerId,
          return_date: new Date().toISOString(),
          end_hour_meter: 210,
          end_fuel_level: 85,
          has_damage: false,
          status: 'passed',
          inspected_by: rentalManagerId,
        }).select('id').single();

        // Damage Report
        await admin.from('rental_damage_reports').upsert({
          report_number: 'DR-1001',
          inspection_id: inspData?.id,
          rental_agreement_id: contractId,
          machine_id: rentalMachineId,
          customer_id: customerId,
          damage_details: 'Minor scratch on left fork guard',
          severity: 'minor',
          damage_charge_amount: 1500,
          status: 'reported',
          created_by: rentalManagerId,
        });

        // Extension Request
        await admin.from('rental_extension_requests').upsert({
          request_number: 'RE-1001',
          rental_agreement_id: contractId,
          current_end_date: new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0],
          proposed_end_date: new Date(Date.now() + 45 * 86400000).toISOString().split('T')[0],
          extension_days: 15,
          additional_amount: 32500,
          availability_status: 'available',
          status: 'approved',
          requested_by: rentalManagerId,
          approved_by: rentalManagerId,
        });

        // Billing Request
        await admin.from('rental_billing_requests').upsert({
          request_number: 'RBR-1001',
          rental_agreement_id: contractId,
          customer_id: customerId,
          billing_period_start: new Date().toISOString().split('T')[0],
          billing_period_end: new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0],
          base_rental_amount: 65000,
          additional_hours_amount: 0,
          transport_charges: 5000,
          damage_charges: 1500,
          security_deposit_adjusted: 0,
          total_billable_amount: 71500,
          status: 'submitted_to_finance',
          created_by: rentalManagerId,
        });

        // Accessories Log
        await admin.from('rental_accessories_log').upsert({
          rental_agreement_id: contractId,
          accessory_name: 'Fork Extensions (6ft)',
          quantity: 2,
          dispatch_condition: 'Good',
          is_returned: false,
        });
      }
    }
  }

  console.log('\n✅ DUMMY DATA SEEDING COMPLETED SUCCESSFULLY!');
}

seed().catch((err) => {
  console.error('\n❌ SEED SCRIPT FAILED:', err);
  process.exit(1);
});
