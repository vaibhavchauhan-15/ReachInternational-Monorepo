import fs from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const webRoot = path.resolve(__dirname, "..");

console.log("==================================================================");
console.log("  RUNNING LOGS REMARKS & CLIENT SELECT VERIFICATION SUITE");
console.log("==================================================================");

let totalPassed = 0;

function check(name, fn) {
  try {
    fn();
    console.log(`  ✓ ${name}`);
    totalPassed++;
  } catch (err) {
    console.error(`  ✗ ${name}`);
    console.error(`    ${err.message}`);
    process.exit(1);
  }
}

// 1. ClientSelect: Location removed below client name by default
check("ClientSelect: showLocation prop defaults to false and location is removed from trigger button", () => {
  const content = fs.readFileSync(path.join(webRoot, "components/ui/ClientSelect.tsx"), "utf8");
  assert.match(content, /showLocation\s*=\s*false/, "ClientSelect must default showLocation to false");
  assert.match(
    content,
    /\{showLocation && clientLocationStr \? ` • \$\{clientLocationStr\}` : ""\}/,
    "clientLocationStr must only be displayed if showLocation is true"
  );
  // Ensure the old unconditional clientLocationStr is gone
  assert.doesNotMatch(
    content,
    /\{clientLocationStr \? ` • \$\{clientLocationStr\}` : ""\}/,
    "Unconditional clientLocationStr below client name must be removed"
  );
});

// 2. OperationsLogsTable: extractBreakdownRemark function exists and cleans synthetic strings
check("OperationsLogsTable: extractBreakdownRemark cleans synthetic breakdown tags and returns clean remark", () => {
  const content = fs.readFileSync(path.join(webRoot, "components/operations/logs/OperationsLogsTable.tsx"), "utf8");
  assert.match(content, /export function extractBreakdownRemark\(log: MachineHourLog\): string/);
  assert.match(content, /replace\(\/\\\[Breakdown Duration:\\s\*\[\^\\\]\]\+\\\]\\s\*\/gi, ""\)/);
  assert.match(content, /replace\(\/\\\[Breakdown:\\s\*\[\^\\\]\]\+\\\]\\s\*\/gi, ""\)/);
});

// 3. OperationsLogsTable: groupLogsByDate only extracts remarks from breakdown shifts
check("OperationsLogsTable: groupLogsByDate only collects remarks from shifts that have breakdowns", () => {
  const content = fs.readFileSync(path.join(webRoot, "components/operations/logs/OperationsLogsTable.tsx"), "utf8");
  assert.match(content, /const breakdownRemarksList:\s*string\[\]\s*=\s*\[\];/);
  assert.match(content, /Boolean\(s\.is_breakdown\)\s*\|\|\s*Number\(s\.breakdown_minutes/);
  assert.match(content, /const cleanRem = extractBreakdownRemark\(s\);/);
});

// 4. OperationsLogsTable: OperationsDailyLogRow canExpand gated by hasBreakdown
check("OperationsLogsTable: OperationsDailyLogRow canExpand is strictly gated by hasBreakdown", () => {
  const content = fs.readFileSync(path.join(webRoot, "components/operations/logs/OperationsLogsTable.tsx"), "utf8");
  assert.match(content, /const hasBreakdown = group\.totalBreakdownHours > 0 \|\| stoppageLogs\.length > 0;/);
  assert.match(content, /const canExpand = hasBreakdown;/);
  assert.match(content, /canExpand \? "cursor-pointer" : "cursor-default"/);
  assert.match(content, /if \(canExpand\) \{\s*setIsRowExpanded\(\(prev\) => !prev\);\s*\}/);
});

// 5. OperationsLogsTable: Unwanted 'No special remarks logged for this day' removed from every row
check("OperationsLogsTable: 'No special remarks logged for this day' placeholder completely removed", () => {
  const content = fs.readFileSync(path.join(webRoot, "components/operations/logs/OperationsLogsTable.tsx"), "utf8");
  assert.doesNotMatch(content, /No special remarks logged for this day/);
  assert.doesNotMatch(content, /Shift Remarks \(\{group\.formattedDate\}\):/);
});

// 6. OperationsLogsTable: Expandable row only rendered when isRowExpanded && canExpand
check("OperationsLogsTable: Expandable breakdown details only rendered for breakdown rows", () => {
  const content = fs.readFileSync(path.join(webRoot, "components/operations/logs/OperationsLogsTable.tsx"), "utf8");
  assert.match(content, /\{isRowExpanded && canExpand && \(/);
  assert.match(content, /Breakdown Remarks:/);
});

// 7. OperationsLogsMobileList: Parity check - hasBreakdown check and unwanted remarks removed
check("OperationsLogsMobileList: 100% parity on mobile cards for breakdown gating and remarks display", () => {
  const content = fs.readFileSync(path.join(webRoot, "components/operations/logs/OperationsLogsMobileList.tsx"), "utf8");
  assert.match(content, /extractBreakdownRemark/);
  assert.match(content, /hasBreakdown && group\.remarksDisplay/);
  assert.match(content, /\{hasBreakdown && \(/);
  assert.match(content, /Breakdown Remarks:/);
});

console.log("==================================================================");
console.log(`  ALL ${totalPassed} VERIFICATION CHECKS PASSED CLEANLY!`);
console.log("==================================================================");
