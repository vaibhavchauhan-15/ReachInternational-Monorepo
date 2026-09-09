import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function loadEnv(filePath) {
  if (fs.existsSync(filePath)) {
    const content = fs.readFileSync(filePath, 'utf-8');
    for (const line of content.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const idx = trimmed.indexOf('=');
      if (idx !== -1) {
        const key = trimmed.slice(0, idx).trim();
        let val = trimmed.slice(idx + 1).trim();
        if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
          val = val.slice(1, -1);
        }
        if (!process.env[key]) {
          process.env[key] = val;
        }
      }
    }
  }
}

loadEnv(path.resolve(__dirname, '../../.env'));
loadEnv(path.resolve(__dirname, '../../.env.local'));
loadEnv(path.resolve(__dirname, '../../apps/web/.env.local'));

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://dhbbgfzbyatzvqafnsqp.supabase.co';
const supabaseKey = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Error: Missing Supabase credentials in environment.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

function sanitizeAndEscapeSearch(search) {
  return search
    .replace(/[,()"]/g, "")
    .replace(/[\\%_]/g, "\\$&")
    .trim();
}

function applyOptimizedUserSearch(query, search) {
  if (!search) return query;
  const trimmed = search.trim();
  if (trimmed.length === 0) return query;

  const sanitized = sanitizeAndEscapeSearch(trimmed);
  if (!sanitized) return query;

  // Single-character fast prefix search: hits B-Tree index on prefix without full table scan
  if (trimmed.length === 1) {
    return query.or(`full_name.ilike.${sanitized}%,email.ilike.${sanitized}%,role.ilike.${sanitized}%`);
  }

  // 1. Phone or Aadhaar search: input consists mostly of numbers, +, -, spaces, ()
  const isDigitsOnly = /^[0-9+\s\-()]+$/.test(trimmed);
  const digits = trimmed.replace(/\D/g, "");

  if (isDigitsOnly && digits.length >= 3) {
    let phoneDigits = digits;
    if (digits.length === 12 && digits.startsWith("91")) {
      phoneDigits = digits.slice(2);
    } else if (digits.length === 11 && digits.startsWith("0")) {
      phoneDigits = digits.slice(1);
    }

    const conditions = [];
    if (phoneDigits.length >= 3) {
      conditions.push(`phone.ilike.%${phoneDigits}%`);
    }
    if (digits.length >= 4) {
      conditions.push(`aadhaar_number.ilike.%${digits}%`);
    }
    conditions.push(`license_number.ilike.%${sanitized}%`);
    conditions.push(`full_name.ilike.%${sanitized}%`);

    return query.or(conditions.join(","));
  }

  // 2. Email search: contains @ or domain ending
  if (trimmed.includes("@") || trimmed.endsWith(".com") || trimmed.endsWith(".in")) {
    return query.or(`email.ilike.%${sanitized}%,full_name.ilike.%${sanitized}%`);
  }

  // 3. Multi-token or Role search
  const words = trimmed.split(/\s+/).map(sanitizeAndEscapeSearch).filter((w) => w.length >= 2);
  const roleSlug = sanitized.toLowerCase().replace(/\s+/g, "_");
  const isKnownRole = [
    "super_admin",
    "admin",
    "service_manager",
    "service_engineer",
    "engineer",
    "supervisor",
    "store_manager",
    "hr_manager",
    "operator",
    "mechanic",
    "manager",
    "branch_manager",
  ].some((r) => r === roleSlug || r.includes(roleSlug) || roleSlug.includes(r));

  if (words.length > 1) {
    if (isKnownRole) {
      return query.or(`role.ilike.%${roleSlug}%,full_name.ilike.%${sanitized}%,email.ilike.%${sanitized}%`);
    }

    // Composite multi-token AND matching across name, role, city, district, state, email
    for (const word of words) {
      const wRole = word.toLowerCase().replace(/s$/, "");
      query = query.or(
        `full_name.ilike.%${word}%,role.ilike.%${wRole}%,city.ilike.%${word}%,district.ilike.%${word}%,state.ilike.%${word}%,email.ilike.%${word}%`
      );
    }
    return query;
  }

  // 4. Single-token text search
  const roleVariant = sanitized.toLowerCase().replace(/s$/, "");
  const conditions = [
    `full_name.ilike.%${sanitized}%`,
    `email.ilike.%${sanitized}%`,
    `role.ilike.%${sanitized}%`,
    `city.ilike.%${sanitized}%`,
    `district.ilike.%${sanitized}%`,
    `state.ilike.%${sanitized}%`,
    `license_number.ilike.%${sanitized}%`,
  ];

  if (roleVariant !== sanitized.toLowerCase()) {
    conditions.push(`role.ilike.%${roleVariant}%`);
  }

  if (digits.length >= 3) {
    conditions.push(`phone.ilike.%${digits}%`);
    conditions.push(`aadhaar_number.ilike.%${digits}%`);
  }

  return query.or(conditions.join(","));
}

async function runTestSuite() {
  console.log('=================================================================');
  console.log('🚀 RUNNING AUTOMATED TEST SUITE: USERS GLOBAL SEARCH, FILTER & SORT');
  console.log('=================================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition, testName, extraInfo = '') {
    if (condition) {
      console.log(`✅ PASS: ${testName}`);
      passed++;
    } else {
      console.error(`❌ FAIL: ${testName} ${extraInfo}`);
      failed++;
    }
  }

  // --- SUITE 1: Baseline Dataset Verification ---
  console.log('--- SUITE 1: Baseline Dataset Verification ---');
  const { data: allUsers, count: totalUserCount, error: baseErr } = await supabase
    .from('users')
    .select('id, full_name, email, role, status, created_at', { count: 'exact' })
    .order('created_at', { ascending: false })
    .order('id', { ascending: true });

  assert(!baseErr, 'Initial database query succeeds without errors', baseErr?.message);
  assert(allUsers && allUsers.length > 0, `Users exist in database (found: ${allUsers?.length || 0})`);
  assert(totalUserCount === allUsers?.length, `Exact count matches total retrieved rows (${totalUserCount})`);

  // --- SUITE 2: Search Match on Non-First Page ---
  console.log('\n--- SUITE 2: Search Match on Non-First Page ---');
  if (allUsers && allUsers.length >= 2) {
    // Pick the last user which would definitely be on page 2+ when pageSize=1
    const targetUser = allUsers[allUsers.length - 1];
    const searchTerm = targetUser.full_name || targetUser.email;
    const s = sanitizeAndEscapeSearch(searchTerm);

    const { data: searchResults, count: searchCount, error: searchErr } = await supabase
      .from('users')
      .select('id, full_name, email, role', { count: 'exact' })
      .order('created_at', { ascending: false })
      .order('id', { ascending: true })
      .or(`full_name.ilike.%${s}%,email.ilike.%${s}%,role.ilike.%${s}%`)
      .range(0, 9); // First page

    assert(!searchErr, 'Search query executed without errors', searchErr?.message);
    assert(searchCount > 0, `Found at least 1 match for target user "${searchTerm}"`);
    const containsTarget = searchResults?.some((u) => u.id === targetUser.id);
    assert(containsTarget, `Target user from end of dataset appears on page 1 of search results`);
  } else {
    console.log('⚠️ Skipping non-first-page test: dataset has fewer than 2 users.');
  }

  // --- SUITE 3: Search by Role (PostgREST .or() with role.ilike) ---
  console.log('\n--- SUITE 3: Search by Role Column ---');
  const testRole = 'admin';
  const roleSearchTerm = sanitizeAndEscapeSearch(testRole);
  const { data: roleMatches, count: roleMatchCount, error: roleErr } = await supabase
    .from('users')
    .select('id, full_name, email, role', { count: 'exact' })
    .order('created_at', { ascending: false })
    .order('id', { ascending: true })
    .or(`full_name.ilike.%${roleSearchTerm}%,email.ilike.%${roleSearchTerm}%,role.ilike.%${roleSearchTerm}%`);

  assert(!roleErr, 'Role search query executed cleanly', roleErr?.message);
  assert(roleMatches && roleMatches.length > 0, `Role search found matches for "${testRole}" (found: ${roleMatches?.length})`);
  const allMatchRoleOrText = roleMatches?.every(
    (u) =>
      u.role.toLowerCase().includes(testRole) ||
      u.full_name?.toLowerCase().includes(testRole) ||
      u.email?.toLowerCase().includes(testRole)
  );
  assert(allMatchRoleOrText, 'Every returned record matches the search keyword in role, full_name, or email');

  // --- SUITE 4: Zero-Result Search ---
  console.log('\n--- SUITE 4: Zero-Result Search ---');
  const ghostTerm = sanitizeAndEscapeSearch('nonexistent_user_query_xyz987654321');
  const { data: emptyData, count: emptyCount, error: emptyErr } = await supabase
    .from('users')
    .select('id, full_name, email, role', { count: 'exact' })
    .or(`full_name.ilike.%${ghostTerm}%,email.ilike.%${ghostTerm}%,role.ilike.%${ghostTerm}%`);

  assert(!emptyErr, 'Zero-result query executed cleanly without error', emptyErr?.message);
  assert(emptyData?.length === 0, 'Zero-result search returns empty array');
  assert(emptyCount === 0, 'Zero-result search returns count = 0');

  // --- SUITE 5: Combined Filters with AND Semantics ---
  console.log('\n--- SUITE 5: Combined Filters (Search + Role + Status) ---');
  if (allUsers && allUsers.length > 0) {
    const sampleUser = allUsers[0];
    const s = sanitizeAndEscapeSearch(sampleUser.full_name?.slice(0, 3) || 'a');

    let combinedQuery = supabase
      .from('users')
      .select('id, full_name, email, role, status', { count: 'exact' })
      .eq('status', sampleUser.status)
      .eq('role', sampleUser.role)
      .order('created_at', { ascending: false })
      .order('id', { ascending: true });

    if (s) {
      combinedQuery = combinedQuery.or(`full_name.ilike.%${s}%,email.ilike.%${s}%,role.ilike.%${s}%`);
    }

    const { data: combinedData, error: combErr } = await combinedQuery;
    assert(!combErr, 'Combined filters query executed successfully', combErr?.message);
    if (combinedData && combinedData.length > 0) {
      const allSatisfy = combinedData.every(
        (u) => u.status === sampleUser.status && u.role === sampleUser.role
      );
      assert(allSatisfy, 'All returned records strictly satisfy both status and role equality filters (AND semantics)');
    } else {
      console.log('ℹ️ No records matched the strict 3-way combined filter.');
    }
  }

  // --- SUITE 6: Deterministic Secondary Sort & Boundary Stability ---
  console.log('\n--- SUITE 6: Deterministic Secondary Sort with ID Tiebreaker ---');
  // Fetch page 1 with pageSize 2, then page 2 with pageSize 2
  const pageSize = 2;
  const { data: page1, error: p1Err } = await supabase
    .from('users')
    .select('id, full_name, created_at')
    .order('created_at', { ascending: false })
    .order('id', { ascending: true })
    .range(0, pageSize - 1);

  const { data: page2, error: p2Err } = await supabase
    .from('users')
    .select('id, full_name, created_at')
    .order('created_at', { ascending: false })
    .order('id', { ascending: true })
    .range(pageSize, (pageSize * 2) - 1);

  assert(!p1Err && !p2Err, 'Paging queries executed successfully');
  if (page1 && page2 && page1.length > 0 && page2.length > 0) {
    const page1Ids = new Set(page1.map((u) => u.id));
    const overlap = page2.filter((u) => page1Ids.has(u.id));
    assert(overlap.length === 0, `Page 1 and Page 2 are strictly disjoint (zero duplicate IDs across boundary, overlap count: ${overlap.length})`);
  }

  // Test name sorting with ID tiebreaker
  const { data: namePage1, error: np1Err } = await supabase
    .from('users')
    .select('id, full_name')
    .order('full_name', { ascending: true })
    .order('id', { ascending: true })
    .range(0, pageSize - 1);

  const { data: namePage2, error: np2Err } = await supabase
    .from('users')
    .select('id, full_name')
    .order('full_name', { ascending: true })
    .order('id', { ascending: true })
    .range(pageSize, (pageSize * 2) - 1);

  assert(!np1Err && !np2Err, 'Name-sorted paging queries executed successfully');
  if (namePage1 && namePage2 && namePage1.length > 0 && namePage2.length > 0) {
    const namePage1Ids = new Set(namePage1.map((u) => u.id));
    const nameOverlap = namePage2.filter((u) => namePage1Ids.has(u.id));
    assert(nameOverlap.length === 0, `Name-sorted pages are strictly disjoint (overlap count: ${nameOverlap.length})`);
  }

  // --- SUITE 7: Wildcard & Special Character Escaping ---
  console.log('\n--- SUITE 7: Wildcard & Grammar Token Escaping ---');
  const problematicInputs = [
    { input: '%', label: 'Percent wildcard' },
    { input: '_', label: 'Underscore wildcard' },
    { input: '\\', label: 'Backslash escape character' },
    { input: 'admin, engineer', label: 'Comma PostgREST separator' },
    { input: '(super)', label: 'Parentheses PostgREST grouping' },
    { input: '"quoted"', label: 'Double quote PostgREST token' },
    { input: 'super_admin', label: 'Literal underscore in role name' },
    { input: '100%', label: 'Trailing percent sign' },
  ];

  for (const { input, label } of problematicInputs) {
    const s = sanitizeAndEscapeSearch(input);
    if (!s) {
      assert(true, `Sanitization stripped invalid syntax from "${input}" cleanly without errors`);
      continue;
    }
    const { data, error } = await supabase
      .from('users')
      .select('id, full_name, role')
      .or(`full_name.ilike.%${s}%,email.ilike.%${s}%,role.ilike.%${s}%`)
      .limit(5);

    assert(!error, `Query with ${label} ("${input}" -> "${s}") succeeded without SQL/PostgREST error`, error?.message);
  }

  // Verify literal underscore matching:
  const superAdminSearch = sanitizeAndEscapeSearch('super_admin');
  const { data: superAdminMatches, error: saErr } = await supabase
    .from('users')
    .select('id, role')
    .or(`role.ilike.%${superAdminSearch}%`);

  assert(!saErr, 'Escaped literal underscore search executed cleanly');
  if (superAdminMatches && superAdminMatches.length > 0) {
    const allSuperAdmin = superAdminMatches.every((u) => u.role === 'super_admin');
    assert(allSuperAdmin, 'Escaped underscore strictly matched "super_admin" rows');
  }

  // --- SUITE 8: Dataset-Wide Export Simulation ---
  console.log('\n--- SUITE 8: Dataset-Wide Unpaginated Export Simulation ---');
  // exportUsersFilteredAction executes getUserList({ ...params, page: 1, pageSize: 10000 })
  const { data: exportData, count: exportCount, error: exportErr } = await supabase
    .from('users')
    .select('id, full_name, email, role, status', { count: 'exact' })
    .order('created_at', { ascending: false })
    .order('id', { ascending: true })
    .range(0, 9999);

  assert(!exportErr, 'Unpaginated export query executed cleanly', exportErr?.message);
  assert(exportData?.length === exportCount, `Export retrieves entire filtered dataset in single request (${exportData?.length} rows = ${exportCount} count)`);

  // --- SUITE 9: Pattern-Aware & Multi-Token Search Verification ---
  console.log('\n--- SUITE 9: Pattern-Aware & Multi-Token Search Optimization ---');

  // Test 9.1: Formatted Aadhaar number search with spaces
  let qAadhaar = supabase.from('users').select('id, full_name, aadhaar_number');
  qAadhaar = applyOptimizedUserSearch(qAadhaar, '4102 0541');
  const { data: aadhaarResults, error: aadhErr } = await qAadhaar;
  assert(!aadhErr, 'Formatted Aadhaar search query executed cleanly', aadhErr?.message);
  assert(aadhaarResults && aadhaarResults.length > 0, `Formatted Aadhaar search ("4102 0541") matched user with digits "41020541..." (found: ${aadhaarResults?.length})`);

  // Test 9.2: Formatted Phone number search with +91 and spaces
  let qPhone = supabase.from('users').select('id, full_name, phone');
  qPhone = applyOptimizedUserSearch(qPhone, '+91 97133 12692');
  const { data: phoneResults, error: phErr } = await qPhone;
  assert(!phErr, 'Formatted phone search query executed cleanly', phErr?.message);
  assert(phoneResults && phoneResults.length > 0, `Formatted phone search ("+91 97133 12692") matched user phone (found: ${phoneResults?.length})`);

  // Test 9.3: Role search with space ("super admin")
  let qRoleSpace = supabase.from('users').select('id, full_name, role');
  qRoleSpace = applyOptimizedUserSearch(qRoleSpace, 'super admin');
  const { data: roleSpaceResults, error: rsErr } = await qRoleSpace;
  assert(!rsErr, 'Space-separated role search executed cleanly', rsErr?.message);
  assert(roleSpaceResults && roleSpaceResults.length > 0, `Role search "super admin" successfully matched "super_admin" (found: ${roleSpaceResults?.length})`);

  // Test 9.4: Multi-token search (Name + Location)
  let qMulti = supabase.from('users').select('id, full_name, state, role');
  qMulti = applyOptimizedUserSearch(qMulti, 'Kalicharan Gujarat');
  const { data: multiResults, error: multiErr } = await qMulti;
  assert(!multiErr, 'Multi-token composite search executed cleanly', multiErr?.message);
  assert(multiResults && multiResults.length > 0, `Multi-token search ("Kalicharan Gujarat") matched expected user across name and state (found: ${multiResults?.length})`);

  // Test 9.5: Fast 1-character prefix search (hits B-tree index on name/email/role prefix)
  let qSingle = supabase.from('users').select('id, full_name, role, email');
  qSingle = applyOptimizedUserSearch(qSingle, 's');
  const { data: singleResults, error: singleErr } = await qSingle;
  assert(!singleErr, 'Single-character prefix search query executed cleanly', singleErr?.message);
  assert(singleResults && singleResults.length > 0, `Single-character prefix search "s" returned matching users via prefix index (found: ${singleResults?.length})`);
  const allMatchPrefix = singleResults.every((u) =>
    (u.full_name && u.full_name.toLowerCase().startsWith('s')) ||
    (u.email && u.email.toLowerCase().startsWith('s')) ||
    (u.role && u.role.toLowerCase().startsWith('s'))
  );
  assert(allMatchPrefix, 'All users returned by single-char prefix search start with prefix "s"');

  console.log('\n=================================================================');
  console.log(`🏁 TEST SUITE COMPLETED: ${passed} PASSED, ${failed} FAILED`);
  console.log('=================================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runTestSuite().catch((err) => {
  console.error('Fatal error in test suite:', err);
  process.exit(1);
});
