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

const DUMMY_PDF = Buffer.from(
  '%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Count 1/Kids[3 0 R]>>endobj\n3 0 obj<</Type/Page/MediaBox[0 0 612 792]/Parent 2 0 R/Resources<<>>>>endobj\nxref\n0 4\n0000000000 65535 f \n0000000010 00000 n \n0000000053 00000 n \n0000000102 00000 n \ntrailer<</Size 4/Root 1 0 R>>\nstartxref\n180\n%%EOF'
);

async function main() {
  console.log('--- Seeding Careers & Hiring into Dev DB ---');

  // 1. Fetch departments
  const { data: depts, error: deptErr } = await admin
    .from('job_departments')
    .select('id, slug, name');

  if (deptErr || !depts || depts.length === 0) {
    console.error('Failed to fetch departments:', deptErr);
    process.exit(1);
  }

  const deptMap = Object.fromEntries(depts.map((d) => [d.slug, d.id]));

  // 2. Fetch state for Delhi / Maharashtra / Gujarat
  const { data: states } = await admin.from('states').select('id, name');
  const delhiState = states?.find((s) => s.name.toLowerCase().includes('delhi'))?.id || null;
  const gujState = states?.find((s) => s.name.toLowerCase().includes('gujarat'))?.id || null;
  const mhState = states?.find((s) => s.name.toLowerCase().includes('maharashtra'))?.id || null;
  const kaState = states?.find((s) => s.name.toLowerCase().includes('karnataka'))?.id || null;

  const sampleJobs = [
    {
      title: 'Senior Heavy Equipment Mechanic',
      slug: 'senior-heavy-equipment-mechanic',
      department_id: deptMap['service-maintenance'] || depts[0].id,
      employment_type: 'full_time',
      workplace_type: 'onsite',
      experience_level: 'senior',
      min_experience_years: 5,
      max_experience_years: 10,
      openings: 3,
      city: 'New Delhi',
      district: 'South Delhi',
      state_id: delhiState,
      country_code: 'IN',
      site_note: 'Work at central workshop with periodic metro site deployments.',
      salary_min: 45000,
      salary_max: 65000,
      salary_currency: 'INR',
      salary_period: 'month',
      show_salary: true,
      summary: 'Diagnose, overhaul, and maintain modern articulating boom lifts, scissor lifts, and rough-terrain telehandlers.',
      description_md: `### Role Overview\nReach International is expanding its core fleet maintenance division. We are seeking senior technicians experienced in mobile elevated work platforms (MEWP).\n\n### Work Environment\nYou will lead diagnostic activities at our central yard and deploy to flagship metro and industrial sites when technical escalation is required. All safety gear and specialized toolsets are provided.`,
      responsibilities: [
        'Perform scheduled 250h / 500h / 1000h preventive maintenance on boom lifts and scissor lifts.',
        'Diagnose complex hydraulic and electrical circuit faults using manufacturer schematics.',
        'Supervise junior mechanics and ensure strict compliance with toolbox safety standards.',
        'Maintain accurate digital machine work orders and spare parts requisitions.',
      ],
      requirements: [
        'Diploma / ITI in Automobile or Mechanical Engineering.',
        'Minimum 5 years hands-on experience on MEWP or heavy mobile plant.',
        'Proficiency with hydraulic proportional valves, load-sensing systems, and CAN-bus diagnostics.',
        'Valid heavy commercial driving license preferred.',
      ],
      nice_to_have: [
        'OEM factory certifications from JLG, Genie, or Haulotte.',
        'Basic welding and structural repair capability.',
      ],
      benefits: [
        'Company subsidized accommodation near regional yard.',
        'Full ESIC/PF coverage + annual medical check-up.',
        'Punctual monthly salary disbursed on the 1st of every month.',
        'Certified OEM skill enhancement training.',
      ],
      skills: ['Hydraulics', 'CAN-Bus', 'Boom Lifts', 'Diesel Engines', 'Troubleshooting'],
      status: 'published',
      is_featured: true,
      apply_by: '2026-12-31',
      published_at: new Date().toISOString(),
      seo_title: 'Senior Heavy Equipment Mechanic in New Delhi | Reach Careers',
      seo_description: 'Join Reach International as a Senior Mechanic. Diagnose and maintain modern boom lifts and scissor lifts with competitive pay.',
    },
    {
      title: 'Certified Boom Lift & Scissor Lift Operator',
      slug: 'certified-boom-lift-scissor-lift-operator',
      department_id: deptMap['operations'] || depts[0].id,
      employment_type: 'full_time',
      workplace_type: 'onsite',
      experience_level: 'mid',
      min_experience_years: 3,
      max_experience_years: 7,
      openings: 8,
      city: 'Ahmedabad',
      district: 'Ahmedabad',
      state_id: gujState,
      country_code: 'IN',
      site_note: 'Deputation to smart city and infrastructure projects across Gujarat.',
      salary_min: 28000,
      salary_max: 38000,
      salary_currency: 'INR',
      salary_period: 'month',
      show_salary: true,
      summary: 'Operate telescopic and articulated boom lifts (up to 150ft) and rough-terrain scissors on major infrastructure sites.',
      description_md: `### About the Opportunity\nWe are recruiting skilled, certified access equipment operators for our expanding operations in Gujarat.\n\n### Safety Culture\nReach enforces a strict zero-tolerance safety protocol. Harness anchor inspection, daily pre-shift logbooks, and ground clearance checks are mandatory for all shifts.`,
      responsibilities: [
        'Safely operate articulated/telescopic boom lifts and electric/diesel scissor lifts.',
        'Conduct daily pre-shift walkaround checks and complete digital shift logs.',
        'Coordinate closely with site safety marshals and client supervisors.',
        'Report minor fluid leaks or abnormal vibrations immediately to the service desk.',
      ],
      requirements: [
        'Valid commercial driving license with valid MEWP / IPAF or equivalent operator certification.',
        'At least 3 years verifiable operating experience on boom lifts above 60ft.',
        'Strict commitment to 100% harness tie-off and site PPE rules.',
      ],
      nice_to_have: [
        'Basic Hindi / Gujarati communication skills.',
        'Familiarity with rough-terrain telehandler operations.',
      ],
      benefits: [
        'Overtime compensation paid transparently at 1.5x hourly rate.',
        'Full statutory PF and medical insurance.',
        'Site allowance and performance bonuses.',
      ],
      skills: ['Boom Lift', 'Scissor Lift', 'MEWP Safety', 'Pre-shift Inspection'],
      status: 'published',
      is_featured: false,
      apply_by: '2026-11-30',
      published_at: new Date().toISOString(),
      seo_title: 'Boom Lift & Scissor Lift Operators in Ahmedabad | Reach International',
      seo_description: 'Immediate openings for certified access platform operators in Gujarat. Steady pay, safety equipment, and overtime benefits.',
    },
    {
      title: 'Heavy Equipment Key Accounts Sales Manager',
      slug: 'heavy-equipment-key-accounts-sales-manager',
      department_id: deptMap['sales-marketing'] || depts[0].id,
      employment_type: 'full_time',
      workplace_type: 'hybrid',
      experience_level: 'lead',
      min_experience_years: 6,
      max_experience_years: 12,
      openings: 2,
      city: 'Mumbai',
      district: 'Mumbai Suburban',
      state_id: mhState,
      country_code: 'IN',
      salary_min: 75000,
      salary_max: 110000,
      salary_currency: 'INR',
      salary_period: 'month',
      show_salary: true,
      summary: 'Drive B2B equipment rental and sales contracts with Tier-1 EPC contractors, infrastructure developers, and industrial hubs.',
      description_md: `### Position Overview\nLead corporate account growth across Western India. Build strategic partnerships with premier contractors (L&T, Tata Projects, Shapoorji Pallonji) for high-capacity access equipment rentals.`,
      responsibilities: [
        'Grow rental asset utilization through strategic contract closures with infrastructure clients.',
        'Prepare technical quotation proposals and negotiate framework agreements.',
        'Coordinate with fleet operations to ensure prompt machine mobilization.',
      ],
      requirements: [
        'Bachelor’s Degree in Engineering or Business Administration.',
        '6+ years experience in heavy machinery, construction equipment, or commercial fleet rental.',
        'Proven track record of managing large enterprise accounts in Western India.',
      ],
      nice_to_have: ['Existing relationship network with major metro & highway EPC contractors.'],
      benefits: [
        'Attractive incentive structure linked to quarterly revenue milestones.',
        'Company car / travel allowance.',
        'Executive health insurance plan.',
      ],
      skills: ['B2B Sales', 'Key Account Management', 'Equipment Rental', 'EPC Contracts'],
      status: 'published',
      is_featured: false,
      apply_by: '2026-12-15',
      published_at: new Date().toISOString(),
    },
    {
      title: 'Field Safety & HSE Inspector',
      slug: 'field-safety-hse-inspector',
      department_id: deptMap['safety-hse'] || depts[0].id,
      employment_type: 'full_time',
      workplace_type: 'onsite',
      experience_level: 'mid',
      min_experience_years: 4,
      openings: 2,
      city: 'Bengaluru',
      state_id: kaState,
      country_code: 'IN',
      salary_min: 40000,
      salary_max: 55000,
      salary_currency: 'INR',
      salary_period: 'month',
      show_salary: true,
      summary: 'Ensure compliance with height safety standards and conduct risk audits across high-tech construction sites in South India.',
      description_md: `Lead site audits, tool-box safety briefings, and equipment condition reviews across customer work zones.`,
      responsibilities: [
        'Conduct unannounced safety audits on deployed machines and operator compliance.',
        'Investigate safety observations and conduct root-cause analysis.',
        'Train site teams on emergency descent procedures.',
      ],
      requirements: [
        'Diploma in Industrial Safety (DIS / NEBOSH IGC preferred).',
        '4+ years safety experience on construction sites or equipment yards.',
      ],
      nice_to_have: ['Knowledge of OSHA and Indian Factories Act rules on height work.'],
      benefits: ['Travel allowances', 'Medical coverage', 'Professional certification sponsorship'],
      skills: ['HSE Audits', 'NEBOSH', 'Fall Protection', 'Accident Prevention'],
      status: 'published',
      is_featured: false,
      apply_by: '2026-11-25',
      published_at: new Date().toISOString(),
    },
    {
      title: 'Assistant Yard Supervisor',
      slug: 'assistant-yard-supervisor',
      department_id: deptMap['operations'] || depts[0].id,
      employment_type: 'full_time',
      workplace_type: 'onsite',
      experience_level: 'junior',
      min_experience_years: 2,
      openings: 2,
      city: 'Pune',
      state_id: mhState,
      country_code: 'IN',
      summary: 'Coordinate machine dispatch, return inspections, yard staging, and fuel inventory at Pune central depot.',
      description_md: `Manage day-to-day yard logistics, machine wash bays, and pre-delivery inspection handovers.`,
      responsibilities: [
        'Inspect machines upon return from customer sites and document damage or missing parts.',
        'Coordinate transport trailer loading and tie-down checks.',
      ],
      requirements: ['Graduate or Diploma in any field.', '2+ years logistics or yard experience.'],
      nice_to_have: [],
      benefits: ['Subsidized meals', 'ESIC/PF benefits'],
      skills: ['Yard Management', 'Logistics', 'Inventory Control'],
      status: 'draft',
      is_featured: false,
    },
    {
      title: 'Mobile Hydraulics Specialist',
      slug: 'mobile-hydraulics-specialist',
      department_id: deptMap['service-maintenance'] || depts[0].id,
      employment_type: 'contract',
      workplace_type: 'onsite',
      experience_level: 'senior',
      min_experience_years: 7,
      openings: 1,
      city: 'Chennai',
      country_code: 'IN',
      summary: 'Specialized hydraulic pump rebuilding and proportional valve calibration for heavy boom lifts.',
      description_md: `Overhaul hydrostatic transmissions, hydraulic wheel motors, and main manifold blocks.`,
      responsibilities: ['Overhaul hydraulic pumps and cylinders.'],
      requirements: ['7+ years experience with high-pressure hydraulic circuits.'],
      nice_to_have: [],
      benefits: [],
      skills: ['Hydraulics', 'Pumps', 'Manifolds'],
      status: 'draft',
      is_featured: false,
    },
    {
      title: 'Junior Telehandler Operator',
      slug: 'junior-telehandler-operator',
      department_id: deptMap['operations'] || depts[0].id,
      employment_type: 'full_time',
      workplace_type: 'onsite',
      experience_level: 'junior',
      min_experience_years: 1,
      openings: 4,
      city: 'Hyderabad',
      country_code: 'IN',
      summary: 'Operate 14m and 17m telescopic handlers for warehouse erection and palletized material movement.',
      description_md: `Position has been filled for Hyderabad logistics park.`,
      responsibilities: ['Material handling and pallet positioning.'],
      requirements: ['Valid heavy vehicle driving license.'],
      nice_to_have: [],
      benefits: [],
      skills: ['Telehandler', 'Material Handling'],
      status: 'closed',
      close_reason: 'filled',
      is_featured: false,
      closed_at: new Date().toISOString(),
    },
  ];

  const createdJobs = [];

  for (const job of sampleJobs) {
    const { data: existing } = await admin
      .from('job_postings')
      .select('id, slug')
      .eq('slug', job.slug)
      .maybeSingle();

    if (existing) {
      console.log(`Job "${job.title}" already exists (${existing.id}). Skipping insert.`);
      createdJobs.push(existing);
      continue;
    }

    const { data: inserted, error: insertErr } = await admin
      .from('job_postings')
      .insert(job)
      .select('id, slug, title, job_code, status')
      .single();

    if (insertErr) {
      console.error(`Failed to insert job "${job.title}":`, insertErr);
    } else {
      console.log(`✓ Inserted job: [${inserted.job_code}] ${inserted.title} (${inserted.status})`);
      createdJobs.push(inserted);
    }
  }

  // 3. Upload a sample resume to career_resumes bucket
  const sampleResumePath = `resumes/seed/sample_candidate_resume.pdf`;
  const { error: uploadErr } = await admin.storage
    .from('career_resumes')
    .upload(sampleResumePath, DUMMY_PDF, {
      contentType: 'application/pdf',
      upsert: true,
    });

  if (uploadErr) {
    console.warn('Resume upload note:', uploadErr.message);
  } else {
    console.log(`✓ Uploaded sample resume to storage bucket: ${sampleResumePath}`);
  }

  // 4. Seed sample candidate applications
  const activeJobId = createdJobs.find((j) => j.status === 'published')?.id || null;

  const sampleApps = [
    {
      job_id: activeJobId,
      full_name: 'Vikas Sharma',
      email: 'vikas.sharma@example.com',
      phone: '9811223344',
      current_city: 'New Delhi',
      total_experience_yrs: 6,
      current_ctc: 42000,
      expected_ctc: 55000,
      notice_period_days: 15,
      cover_note: '6 years experience with JLG boom lifts at Delhi Metro phase 4 site. Can join on 15 days notice.',
      resume_path: sampleResumePath,
      resume_file_name: 'Vikas_Sharma_Resume.pdf',
      resume_mime: 'application/pdf',
      resume_size_bytes: DUMMY_PDF.length,
      source: 'careers_site',
      consent_given_at: new Date().toISOString(),
      consent_version: '2026-10',
      status: 'interview',
      rating: 5,
      hr_notes: 'Strong candidate. Recommended by Delhi workshop supervisor. Technical trade test scheduled for Friday.',
    },
    {
      job_id: activeJobId,
      full_name: 'Anil Kumar Yadav',
      email: 'anil.yadav@example.com',
      phone: '9871122334',
      current_city: 'Gurugram',
      total_experience_yrs: 4.5,
      current_ctc: 38000,
      expected_ctc: 48000,
      notice_period_days: 30,
      cover_note: 'Specialized in hydraulic overhaul for Genie articulating lifts.',
      resume_path: sampleResumePath,
      resume_file_name: 'Anil_Yadav_CV.pdf',
      resume_mime: 'application/pdf',
      resume_size_bytes: DUMMY_PDF.length,
      source: 'careers_site',
      consent_given_at: new Date().toISOString(),
      consent_version: '2026-10',
      status: 'shortlisted',
      rating: 4,
      hr_notes: 'Screened on phone. Good hydraulic knowledge. Awaiting workshop manager availability.',
    },
    {
      job_id: activeJobId,
      full_name: 'Deepak Patel',
      email: 'deepak.patel@example.com',
      phone: '9825012345',
      current_city: 'Ahmedabad',
      total_experience_yrs: 3,
      current_ctc: 26000,
      expected_ctc: 34000,
      notice_period_days: 0,
      cover_note: 'Immediate joiner. Certified IPAF operator with valid commercial license.',
      resume_path: sampleResumePath,
      resume_file_name: 'Deepak_Patel_Operator.pdf',
      resume_mime: 'application/pdf',
      resume_size_bytes: DUMMY_PDF.length,
      source: 'careers_site',
      consent_given_at: new Date().toISOString(),
      consent_version: '2026-10',
      status: 'new',
      rating: null,
      hr_notes: null,
    },
    {
      job_id: null, // General Application
      full_name: 'Sunil Rao',
      email: 'sunil.rao@example.com',
      phone: '9448123456',
      current_city: 'Bengaluru',
      total_experience_yrs: 8,
      current_ctc: 65000,
      expected_ctc: 85000,
      notice_period_days: 30,
      cover_note: 'General application for Yard Operations Manager or Fleet Maintenance Supervisor in Karnataka.',
      resume_path: sampleResumePath,
      resume_file_name: 'Sunil_Rao_General_App.pdf',
      resume_mime: 'application/pdf',
      resume_size_bytes: DUMMY_PDF.length,
      source: 'careers_site',
      consent_given_at: new Date().toISOString(),
      consent_version: '2026-10',
      status: 'screening',
      rating: 4,
      hr_notes: 'Experienced yard manager from rental background. Retain profile for Bengaluru depot expansion.',
    },
    {
      job_id: activeJobId,
      full_name: 'Pooja Verma',
      email: 'pooja.verma@example.com',
      phone: '9899012345',
      current_city: 'Noida',
      total_experience_yrs: 2,
      current_ctc: 28000,
      expected_ctc: 35000,
      notice_period_days: 15,
      cover_note: 'Mechanical engineering graduate with 2 years plant maintenance experience.',
      resume_path: sampleResumePath,
      resume_file_name: 'Pooja_Verma_Resume.pdf',
      resume_mime: 'application/pdf',
      resume_size_bytes: DUMMY_PDF.length,
      source: 'careers_site',
      consent_given_at: new Date().toISOString(),
      consent_version: '2026-10',
      status: 'offered',
      rating: 5,
      hr_notes: 'Candidate accepted offer letter. Joining date confirmed for 15th next month.',
    },
  ];

  for (const app of sampleApps) {
    const { data: existingApp } = await admin
      .from('job_applications')
      .select('id, application_code')
      .eq('email', app.email)
      .maybeSingle();

    if (existingApp) {
      console.log(`Application from ${app.email} already exists (${existingApp.application_code}). Skipping.`);
      continue;
    }

    const { data: insertedApp, error: appErr } = await admin
      .from('job_applications')
      .insert(app)
      .select('id, application_code, full_name, status')
      .single();

    if (appErr) {
      console.error(`Failed to insert application for ${app.full_name}:`, appErr.message);
    } else {
      console.log(`✓ Inserted application: [${insertedApp.application_code}] ${insertedApp.full_name} (${insertedApp.status})`);
    }
  }

  console.log('\n✅ Careers & Hiring Seeding Completed Successfully!');
}

main().catch((err) => {
  console.error('Fatal seeding error:', err);
  process.exit(1);
});
