#!/usr/bin/env node
/**
 * Test Suite: Admin Bulk Machine Logsheet Import — Excel Engine
 *
 * Verifies the real template generation + structural parsing + field/business
 * validation pipeline used by the import feature:
 *   1. Template ↔ parser round-trip (sheets, headers, version, example rows)
 *   2. Structural validation (sheets, duplicate/missing/unsupported headers, empty data)
 *   3. Field validation (dates, times, numbers, precision, booleans, enums)
 *   4. Business validation (meters, future dates, breakdowns, overtime)
 *   5. Duplicate/conflict detection semantics (DB uniqueness rules)
 *
 * Run: node --test --experimental-strip-types tests/logsheet-import/test-logsheet-import-engine.mjs
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { createRequire } from "node:module";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "../..");
const importFromRoot = (rel) => import(pathToFileURL(path.join(rootDir, rel)).href);

// exceljs is a dependency of apps/web — resolve it from there for the test.
const requireFromWeb = createRequire(path.join(rootDir, "apps/web/package.json"));
const ExcelJS = requireFromWeb("exceljs");

const { buildLogsheetImportTemplate } = await importFromRoot(
  "apps/web/lib/server/logsheet-import/template.ts"
);
const { parseLogsheetWorkbook, LOGSHEET_IMPORT_EXAMPLE_MARKER } = await importFromRoot(
  "apps/web/lib/server/logsheet-import/parse.ts"
);
const {
  LOGSHEET_IMPORT_COLUMNS,
  LOGSHEET_IMPORT_HEADERS,
  LOGSHEET_IMPORT_TEMPLATE_VERSION,
  LOGSHEET_ISSUE_CODES,
  normalizeLogsheetRow,
  validateLogsheetRowBusiness,
  computeLogsheetRowDerived,
  detectLogsheetIntraFileConflicts,
  deriveLogsheetRowStatus,
} = await importFromRoot("packages/validation/src/logsheetImport.ts");

const TODAY = "2025-06-15";

async function buildWorkbook(rows, { headers = LOGSHEET_IMPORT_HEADERS, sheetName = "Logsheet Data", includeVersion = true } = {}) {
  const wb = new ExcelJS.Workbook();
  const sheet = wb.addWorksheet(sheetName);
  let rowIdx = 1;
  if (includeVersion) {
    sheet.getCell(1, 1).value = `Reach International — Machine Logsheet Import Template v${LOGSHEET_IMPORT_TEMPLATE_VERSION}`;
    rowIdx = 2;
  }
  headers.forEach((h, i) => {
    sheet.getCell(rowIdx, i + 1).value = h;
  });
  for (const dataRow of rows) {
    rowIdx += 1;
    headers.forEach((h, i) => {
      const key = LOGSHEET_IMPORT_COLUMNS.find((c) => c.header === h)?.key;
      const value = key ? dataRow[key] : undefined;
      if (value !== undefined && value !== null) sheet.getCell(rowIdx, i + 1).value = value;
    });
  }
  return Buffer.from(await wb.xlsx.writeBuffer());
}

function validRow(overrides = {}) {
  return {
    log_date: "2025-01-15",
    operator_employee_id: "EMP-0338",
    operator_name: "Rohit Singh",
    shift_code: "S1",
    start_time: "08:00",
    end_time: "16:00",
    start_meter: 1500.5,
    end_meter: 1508.5,
    overtime_hours: "",
    machine_condition: "good",
    is_breakdown: "No",
    breakdown_start_time: "",
    breakdown_end_time: "",
    remarks: "Routine operation",
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// 1. Template ↔ parser round-trip
// ---------------------------------------------------------------------------

test("generated template round-trips: sheets, headers, version and example rows", async () => {
  const buffer = await buildLogsheetImportTemplate();
  const parsed = parseLogsheetWorkbook(buffer);
  assert.equal(parsed.ok, true, JSON.stringify(parsed.structuralIssues));
  assert.equal(parsed.templateVersion, LOGSHEET_IMPORT_TEMPLATE_VERSION);
  assert.ok(parsed.sheetNames.some((n) => n.toLowerCase() === "logsheet data"));
  assert.ok(parsed.sheetNames.some((n) => n.toLowerCase() === "instructions"));
  assert.ok(parsed.sheetNames.some((n) => n.toLowerCase() === "data dictionary"));
  assert.ok(parsed.structuralIssues.filter((i) => i.severity === "error").length === 0);

  const exampleRows = parsed.rows.filter((r) => r.isExampleRow);
  assert.equal(exampleRows.length, 2, "both template example rows must be recognised");
  assert.ok(parsed.rows.length >= 2);
});

test("template example rows are clearly marked and can never import silently", async () => {
  const buffer = await buildLogsheetImportTemplate();
  const parsed = parseLogsheetWorkbook(buffer);
  const exampleRows = parsed.rows.filter((r) => r.isExampleRow);
  assert.equal(exampleRows.length, 2);
  for (const row of exampleRows) {
    const rowText = Object.values(row.cells)
      .map((v) => String(v ?? ""))
      .join(" ");
    assert.ok(
      rowText.includes(LOGSHEET_IMPORT_EXAMPLE_MARKER),
      `row ${row.rowNumber} must carry the example marker`
    );
  }
});

// ---------------------------------------------------------------------------
// 2. Structural validation
// ---------------------------------------------------------------------------

test("wrong worksheet name is rejected with a clear structural error", async () => {
  const buffer = await buildWorkbook([validRow()], { sheetName: "Sheet1" });
  const parsed = parseLogsheetWorkbook(buffer);
  assert.equal(parsed.ok, false);
  assert.ok(parsed.structuralIssues.some((i) => i.code === "missing_data_sheet"));
});

test("missing columns are reported individually", async () => {
  const headers = LOGSHEET_IMPORT_HEADERS.filter((h) => h !== "Start HMR" && h !== "End HMR");
  const buffer = await buildWorkbook([validRow()], { headers });
  const parsed = parseLogsheetWorkbook(buffer);
  assert.equal(parsed.ok, false);
  const issue = parsed.structuralIssues.find((i) => i.code === "missing_columns");
  assert.ok(issue);
  assert.match(issue.message, /Start HMR/);
  assert.match(issue.message, /End HMR/);
});

test("duplicate column headers are rejected", async () => {
  const headers = [...LOGSHEET_IMPORT_HEADERS];
  headers[headers.length - 1] = "Log Date"; // duplicate an existing header
  const buffer = await buildWorkbook([validRow()], { headers });
  const parsed = parseLogsheetWorkbook(buffer);
  assert.equal(parsed.ok, false);
  assert.ok(parsed.structuralIssues.some((i) => i.code === "duplicate_header"));
});

test("unsupported columns are rejected (never silently dropped)", async () => {
  const headers = [...LOGSHEET_IMPORT_HEADERS, "Machine UUID"];
  const buffer = await buildWorkbook([validRow()], { headers });
  const parsed = parseLogsheetWorkbook(buffer);
  assert.equal(parsed.ok, false);
  const issue = parsed.structuralIssues.find((i) => i.code === "unsupported_columns");
  assert.ok(issue);
  assert.match(issue.message, /Machine UUID/);
});

test("empty data worksheet is rejected", async () => {
  const buffer = await buildWorkbook([]);
  const parsed = parseLogsheetWorkbook(buffer);
  assert.equal(parsed.ok, false);
  assert.ok(parsed.structuralIssues.some((i) => i.code === "no_data_rows" || i.code === "empty_worksheet"));
});

test("unexpected template version is rejected", async () => {
  const wb = new ExcelJS.Workbook();
  const sheet = wb.addWorksheet("Logsheet Data");
  sheet.getCell(1, 1).value = "Reach International — Machine Logsheet Import Template v0.9";
  LOGSHEET_IMPORT_HEADERS.forEach((h, i) => (sheet.getCell(2, i + 1).value = h));
  const row = validRow();
  LOGSHEET_IMPORT_COLUMNS.forEach((c, i) => {
    sheet.getCell(3, i + 1).value = row[c.key] ?? null;
  });
  const buffer = Buffer.from(await wb.xlsx.writeBuffer());
  const parsed = parseLogsheetWorkbook(buffer);
  assert.ok(parsed.structuralIssues.some((i) => i.code === "unexpected_template_version"));
});

test("malformed (non-xlsx) bytes are rejected gracefully", () => {
  const parsed = parseLogsheetWorkbook(Buffer.from("this is not a spreadsheet"));
  assert.equal(parsed.ok, false);
  assert.ok(parsed.structuralIssues.some((i) => i.code === "unreadable_workbook"));
});

// ---------------------------------------------------------------------------
// 3. Field validation
// ---------------------------------------------------------------------------

function normalizeSingle(overrides) {
  const bufferRows = [validRow(overrides)];
  return normalizeLogsheetRow(2, bufferRows[0]);
}

test("invalid dates, times and numbers are rejected without coercion", () => {
  const badDate = normalizeSingle({ log_date: "2025-02-30" });
  assert.equal(badDate.row, null);
  assert.ok(badDate.issues.some((i) => i.code === LOGSHEET_ISSUE_CODES.INVALID_DATE));

  const badTime = normalizeSingle({ start_time: "25:99" });
  assert.equal(badTime.row, null);
  assert.ok(badTime.issues.some((i) => i.code === LOGSHEET_ISSUE_CODES.INVALID_TIME));

  const badNumber = normalizeSingle({ end_meter: "eight" });
  assert.equal(badNumber.row, null);
  assert.ok(badNumber.issues.some((i) => i.code === LOGSHEET_ISSUE_CODES.INVALID_NUMBER));

  const badPrecision = normalizeSingle({ start_meter: "1500.555" });
  assert.equal(badPrecision.row, null);
  assert.ok(badPrecision.issues.some((i) => i.code === LOGSHEET_ISSUE_CODES.DECIMAL_PRECISION));
});

test("mandatory fields are reported with column, value and expected format", () => {
  const { row, issues } = normalizeSingle({
    log_date: "",
    operator_employee_id: "",
    operator_name: "",
    start_time: "",
    end_time: "",
    start_meter: "",
    end_meter: "",
  });
  assert.equal(row, null);
  for (const issue of issues) {
    assert.ok(issue.rowNumber === 2);
    assert.ok(issue.columnLabel.length > 0);
    assert.ok(issue.message.length > 0);
    assert.ok(issue.expected.length > 0);
  }
});

// ---------------------------------------------------------------------------
// 4. Business validation
// ---------------------------------------------------------------------------

test("meter regression, >24h, future dates and future shifts are blocking errors", () => {
  const regressed = normalizeSingle({ start_meter: 100, end_meter: 50 }).row;
  assert.ok(validateLogsheetRowBusiness(regressed, TODAY).some(
    (i) => i.code === LOGSHEET_ISSUE_CODES.METER_REGRESSION
  ));

  const tooLong = normalizeSingle({ start_meter: 0, end_meter: 30 }).row;
  assert.ok(validateLogsheetRowBusiness(tooLong, TODAY).some(
    (i) => i.code === LOGSHEET_ISSUE_CODES.RUNNING_HOURS_LIMIT
  ));

  const future = normalizeSingle({ log_date: "2025-07-01" }).row;
  assert.ok(validateLogsheetRowBusiness(future, TODAY).some(
    (i) => i.code === LOGSHEET_ISSUE_CODES.FUTURE_DATE
  ));

  const nowMs = new Date("2025-06-15T04:30:00.000Z").getTime();
  const futureEnd = normalizeSingle({ log_date: TODAY, start_time: "23:00", end_time: "23:30" }).row;
  assert.ok(validateLogsheetRowBusiness(futureEnd, TODAY, nowMs).some(
    (i) => i.code === LOGSHEET_ISSUE_CODES.FUTURE_SHIFT_END
  ));
});

test("breakdown rows require a positive window inside the shift", () => {
  const identical = normalizeSingle({
    is_breakdown: "Yes",
    breakdown_start_time: "10:00",
    breakdown_end_time: "10:00",
  }).row;
  assert.ok(validateLogsheetRowBusiness(identical, TODAY).some(
    (i) => i.code === LOGSHEET_ISSUE_CODES.BREAKDOWN_WINDOW_INVALID
  ));

  const tooBig = normalizeSingle({
    is_breakdown: "Yes",
    start_time: "08:00",
    end_time: "08:30",
    breakdown_start_time: "08:30",
    breakdown_end_time: "15:30",
    start_meter: 0,
    end_meter: 1,
    overtime_hours: 0,
  }).row;
  assert.ok(validateLogsheetRowBusiness(tooBig, TODAY).some(
    (i) => i.code === LOGSHEET_ISSUE_CODES.BREAKDOWN_EXCEEDS_SHIFT
  ));
});

test("historical dates (the back-fill use case) validate cleanly", () => {
  const old = normalizeSingle({ log_date: "2023-04-01" }).row;
  assert.equal(validateLogsheetRowBusiness(old, TODAY).length, 0);
});

test("derived values match the existing manual entry calculations", () => {
  const row = normalizeSingle({ start_time: "08:00", end_time: "20:00", start_meter: 0, end_meter: 12, overtime_hours: "" }).row;
  const derived = computeLogsheetRowDerived(row);
  assert.equal(derived.overtimeHours, 4); // >8h auto-overtime
  assert.equal(derived.normalWorkingHours, 8);
  assert.equal(derived.runningHours, 12);
  assert.equal(derived.shiftCode, "S1");
});

// ---------------------------------------------------------------------------
// 5. Duplicate / conflict detection (mirrors DB uniqueness rules)
// ---------------------------------------------------------------------------

test("in-file duplicates and overlaps map to the DB uniqueness semantics", () => {
  const base = {
    rowNumber: 2,
    operatorKey: "op-1",
    logDate: "2025-01-15",
    shiftKey: "s1",
    startDatetimeIso: "2025-01-15T02:30:00.000Z",
    endDatetimeIso: "2025-01-15T10:30:00.000Z",
  };
  const dupMachine = detectLogsheetIntraFileConflicts([
    base,
    { ...base, rowNumber: 3, operatorKey: "op-2" },
  ]);
  assert.ok(dupMachine.some((i) => i.kind === "machine_date_shift" && i.rowNumber === 3));

  const dupOperator = detectLogsheetIntraFileConflicts([
    base,
    { ...base, rowNumber: 4, startDatetimeIso: "2025-01-15T12:30:00.000Z", endDatetimeIso: "2025-01-15T14:30:00.000Z" },
  ]);
  assert.ok(dupOperator.some((i) => i.kind === "operator_date_shift" && i.rowNumber === 4));

  const overlap = detectLogsheetIntraFileConflicts([
    base,
    {
      ...base,
      rowNumber: 5,
      operatorKey: "op-2",
      shiftKey: "s2",
      startDatetimeIso: "2025-01-15T08:00:00.000Z",
      endDatetimeIso: "2025-01-15T12:00:00.000Z",
    },
  ]);
  assert.ok(overlap.some((i) => i.kind === "machine_interval" && i.rowNumber === 5));
});

test("row status semantics: duplicates excluded, invalid/review blocking, warnings importable", () => {
  const mk = (code, severity = "error") => ({
    rowNumber: 2,
    columnKey: "",
    columnLabel: "Row",
    value: "",
    severity,
    code,
    message: "m",
    expected: "e",
  });
  assert.equal(deriveLogsheetRowStatus([mk(LOGSHEET_ISSUE_CODES.DUPLICATE_EXISTING_MACHINE_SHIFT)]), "duplicate");
  assert.equal(deriveLogsheetRowStatus([mk(LOGSHEET_ISSUE_CODES.DUPLICATE_EXISTING_ASSIGNMENT)]), "duplicate");
  assert.equal(deriveLogsheetRowStatus([mk(LOGSHEET_ISSUE_CODES.OPERATOR_AMBIGUOUS)]), "review");
  assert.equal(deriveLogsheetRowStatus([mk(LOGSHEET_ISSUE_CODES.REQUIRED)]), "invalid");
  assert.equal(deriveLogsheetRowStatus([mk(LOGSHEET_ISSUE_CODES.OPERATOR_INACTIVE, "warning")]), "warning");
  assert.equal(deriveLogsheetRowStatus([]), "valid");
});
