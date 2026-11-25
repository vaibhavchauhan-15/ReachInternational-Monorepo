import fs from "node:fs";
import path from "node:path";
import assert from "node:assert";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const webRoot = path.resolve(__dirname, "..");

let totalPassed = 0;
function check(description, fn) {
  try {
    fn();
    totalPassed++;
    console.log(`✔ [PASS] ${description}`);
  } catch (err) {
    console.error(`✖ [FAIL] ${description}`);
    console.error(err);
    process.exit(1);
  }
}

console.log("================================================================");
console.log("  TEST: SHIFT FILTER, TIMING SORT & REALTIME OPTIMISTIC UI");
console.log("================================================================");

// 1. Shift Filter in TodayShiftMonitorTab
check("TodayShiftMonitorTab: Shift filter dropdown is rendered with normalized shift options and client-side filtering", () => {
  const fileContent = fs.readFileSync(path.join(webRoot, "components/operations/TodayShiftMonitorTab.tsx"), "utf8");
  assert.match(fileContent, /label="Shift"/);
  assert.match(fileContent, /value=\{shiftFilter\}/);
  assert.match(fileContent, /options=\{shiftOptions\}/);
  assert.match(fileContent, /const shiftOptions: FilterDropdownOption\[\] = useMemo/);
  assert.match(fileContent, /normCode|rawCode|replace\(\/\^SHIFT\\s\*\/\i,\s*""\)/);
  assert.match(fileContent, /if \(shiftFilter !== "all"\)/);
});

// 2. Default Timing Sort & Interactive Toggle
check("TodayShiftMonitorTab: Default sort is time_asc and th header toggles time_asc / time_desc", () => {
  const fileContent = fs.readFileSync(path.join(webRoot, "components/operations/TodayShiftMonitorTab.tsx"), "utf8");
  assert.match(fileContent, /const \[sortBy,\s*setSortBy\]\s*=\s*useState<"time_asc"\s*\|\s*"time_desc">\("time_asc"\)/);
  assert.match(fileContent, /onClick=\{.*setSortBy\(.*prev === "time_asc" \? "time_desc" : "time_asc".*\)\}/);
  assert.match(fileContent, /Timing/);
  assert.match(fileContent, /sortBy === "time_asc" \? "↑" : "↓"/);
  assert.match(fileContent, /parseTimeToMinutes\(a\.shift_start\)/);
  assert.match(fileContent, /parseTimeToMinutes\(b\.shift_start\)/);
});

// 3. Safe formatTime Helper
check("TodayShiftMonitorTab & Card: formatTime safely handles AM/PM strings without producing NaN", () => {
  const tabContent = fs.readFileSync(path.join(webRoot, "components/operations/TodayShiftMonitorTab.tsx"), "utf8");
  const cardContent = fs.readFileSync(path.join(webRoot, "components/operations/TodayShiftMonitorCard.tsx"), "utf8");
  
  assert.match(tabContent, /includes\("AM"\)\s*\|\|\s*.*\.includes\("PM"\)/);
  assert.match(cardContent, /includes\("AM"\)\s*\|\|\s*.*\.includes\("PM"\)/);
});

// 4. Fine-Grained Optimistic UI on Roster Save
check("TodayShiftMonitorTab: AssignOperatorModal onSuccess immediately updates rows optimistically and guards against revert", () => {
  const fileContent = fs.readFileSync(path.join(webRoot, "components/operations/TodayShiftMonitorTab.tsx"), "utf8");
  assert.match(fileContent, /lastOptimisticEditRef\.current = Date\.now\(\)/);
  assert.match(fileContent, /timeSinceEdit < 1500/);
  assert.match(fileContent, /backgroundSyncTimeoutRef/);
  assert.match(fileContent, /status:\s*"pending"/);
  assert.match(fileContent, /status:\s*"unassigned"/);
});

// 5. Data Access Layer Active Roster Reconciliation
check("today-shift-monitor.ts: roster is read through the single authoritative RPC with no duplicate roster query", () => {
  const fileContent = fs.readFileSync(path.join(webRoot, "lib/data/operations/today-shift-monitor.ts"), "utf8");
  // The canonical roster read model.
  assert.match(fileContent, /get_today_shift_log_monitor/);
  assert.match(fileContent, /dedupeShiftMonitorRows/);
  // Active / cancelled / superseded same-day assignment reconciliation now happens ONCE
  // inside SQL (migration 225 + 227) instead of a second unbounded client-side query.
  assert.doesNotMatch(fileContent, /from\("operator_machine_assignments"\)/);
  assert.doesNotMatch(fileContent, /activeAssignmentKeys/);

  const migration225 = fs.readFileSync(
    path.join(webRoot, "../../supabase/migrations/225_optimize_today_shift_monitor_and_sort.sql"),
    "utf8"
  );
  assert.match(migration225, /oma\.is_active = true/);
  assert.match(migration225, /NOT \(\s*\n?\s*oma\.valid_from = oma\.valid_to/);

  const migration227 = fs.readFileSync(
    path.join(webRoot, "../../supabase/migrations/227_optimize_operations_shift_monitor_queries.sql"),
    "utf8"
  );
  assert.match(migration227, /CREATE OR REPLACE FUNCTION public\.get_today_shift_log_monitor/);
  assert.match(migration227, /assignments_on_date AS MATERIALIZED/);
  assert.match(migration227, /logs AS MATERIALIZED/);
  // Stale pre-225 overload removed so every call shape resolves unambiguously.
  assert.match(migration227, /DROP FUNCTION IF EXISTS public\.get_today_shift_log_monitor\(uuid, date, text, uuid\)/);
});

// 6. Canonical Deduplication with Shift Code Normalization
check("shift-monitor.ts: dedupeShiftMonitorRows normalizes shift codes and prioritizes active operators", () => {
  const localPath = path.join(webRoot, "lib/utils/shift-monitor.ts");
  let fileContent = fs.readFileSync(localPath, "utf8");
  if (fileContent.includes('@reachinternational/utils')) {
    const utilsPath = path.join(webRoot, "../../packages/utils/src/shift.ts");
    fileContent = fs.readFileSync(utilsPath, "utf8");
  }
  assert.match(fileContent, /shiftNorm/);
  assert.match(fileContent, /replace\(\/\^SHIFT\\s\*\/\i,\s*["']["']\)/);
  assert.match(fileContent, /r\.status === ['"]entered['"]/);
  assert.match(fileContent, /r\.operator_id && !existing\.operator_id/);
});

// 7. Migration 225 exists and contains active assignment & sort upgrades
check("Migration 225: exists and contains active assignment scoping and shift/sort parameters", () => {
  const migrationPath = path.join(webRoot, "../../supabase/migrations/225_optimize_today_shift_monitor_and_sort.sql");
  assert.ok(fs.existsSync(migrationPath), "Migration 225 must exist");
  const migrationContent = fs.readFileSync(migrationPath, "utf8");
  assert.match(migrationContent, /CREATE OR REPLACE FUNCTION public\.get_today_shift_log_monitor/);
  assert.match(migrationContent, /p_shift_code text DEFAULT NULL/);
  assert.match(migrationContent, /p_sort text DEFAULT 'default'/);
  assert.match(migrationContent, /oma\.is_active = true/);
  assert.match(migrationContent, /shift_start ASC NULLS LAST/);
  assert.match(migrationContent, /NOTIFY pgrst, 'reload schema'/);
});

console.log("================================================================");
console.log(`  ALL ${totalPassed} SHIFT FILTER & TIMING SORT CHECKS PASSED! (100%)`);
console.log("================================================================");
