import { test } from "node:test";
import assert from "node:assert/strict";
import {
  LOGSHEET_IMPORT_COLUMNS,
  LOGSHEET_IMPORT_HEADERS,
  LOGSHEET_IMPORT_TEMPLATE_VERSION,
  LOGSHEET_ISSUE_CODES,
  computeLogsheetRowDerived,
  deriveLogsheetRowStatus,
  deriveShiftCodeFromTime,
  detectLogsheetIntraFileConflicts,
  excelSerialToUtcDate,
  LogsheetImportRowPayloadSchema,
  normalizeLogsheetRow,
  normalizeShiftCode,
  parseImportBooleanCell,
  parseImportDateCell,
  parseImportNumberCell,
  parseImportTextCell,
  parseImportTimeCell,
  shiftCodeKey,
  validateLogsheetRowBusiness,
  matchOperatorToRow,
  formatOperatorCandidates,
  type LogsheetOperatorCandidate,
  type NormalizedLogsheetRow,
} from "./logsheetImport.ts";

const TODAY = "2025-06-15";

function validRaw(overrides: Record<string, unknown> = {}): Record<string, unknown> {
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

function makeRow(overrides: Record<string, unknown> = {}): NormalizedLogsheetRow {
  const { row, issues } = normalizeLogsheetRow(2, validRaw(overrides));
  assert.equal(issues.filter((i) => i.severity === "error").length, 0, JSON.stringify(issues));
  assert.ok(row);
  return row!;
}

// ---------------------------------------------------------------------------
// Template / column model invariants
// ---------------------------------------------------------------------------

test("template version is set and headers are unique and non-empty", () => {
  assert.ok(LOGSHEET_IMPORT_TEMPLATE_VERSION.length > 0);
  const headers = [...LOGSHEET_IMPORT_HEADERS];
  assert.equal(new Set(headers).size, headers.length, "headers must be unique");
  for (const header of headers) assert.ok(header.trim().length > 0);
});

test("columns cover exactly the existing logsheet model (no machine/operator UUIDs)", () => {
  const keys = LOGSHEET_IMPORT_COLUMNS.map((c) => c.key);
  assert.ok(keys.includes("log_date"));
  assert.ok(keys.includes("start_meter"));
  assert.ok(keys.includes("end_meter"));
  assert.ok(keys.includes("remarks"));
  for (const key of keys) {
    assert.ok(
      !/machine_id|operator_id|assignment_id|client_id|site_id|entered_by/.test(key),
      `${key} must not expose trusted database identifiers`
    );
  }
  // Every mandatory column is documented as required
  for (const col of LOGSHEET_IMPORT_COLUMNS) {
    if (col.required) assert.ok(col.validationRule.length > 0);
  }
});

// ---------------------------------------------------------------------------
// Cell parsing
// ---------------------------------------------------------------------------

test("parseImportDateCell accepts ISO, day-first and month-name dates", () => {
  assert.deepEqual(parseImportDateCell("2025-01-15"), { ok: true, value: "2025-01-15" });
  assert.deepEqual(parseImportDateCell("15/01/2025"), { ok: true, value: "2025-01-15" });
  assert.deepEqual(parseImportDateCell("15-01-2025"), { ok: true, value: "2025-01-15" });
  assert.deepEqual(parseImportDateCell("15 Jan 2025"), { ok: true, value: "2025-01-15" });
  assert.deepEqual(parseImportDateCell("2025-01-15 00:00:00"), { ok: true, value: "2025-01-15" });
});

test("parseImportDateCell converts Excel serial numbers", () => {
  // 2025-01-15 = serial 45672
  const d = excelSerialToUtcDate(45672);
  assert.ok(d);
  assert.equal(d!.getUTCFullYear(), 2025);
  assert.equal(d!.getUTCMonth(), 0);
  assert.equal(d!.getUTCDate(), 15);
  assert.deepEqual(parseImportDateCell(45672), { ok: true, value: "2025-01-15" });
});

test("parseImportDateCell rejects impossible and ambiguous dates", () => {
  assert.equal(parseImportDateCell("2025-02-30").ok, false);
  assert.equal(parseImportDateCell("not-a-date").ok, false);
  assert.equal(parseImportDateCell("").ok, false);
  assert.equal(parseImportDateCell(null).ok, false);
  // Month-first input is rejected loudly instead of silently swapped
  assert.equal(parseImportDateCell("13/25/2025").ok, false);
  const mFirst = parseImportDateCell("03/15/2025");
  assert.equal(mFirst.ok, false);
  assert.match(mFirst.ok === false ? mFirst.error : "", /MM\/DD\/YYYY/);
});

test("parseImportTimeCell accepts 24-hour, AM/PM and Excel fractions", () => {
  assert.deepEqual(parseImportTimeCell("08:00"), { ok: true, value: "08:00" });
  assert.deepEqual(parseImportTimeCell("8:05 PM"), { ok: true, value: "20:05" });
  assert.deepEqual(parseImportTimeCell("12:00 AM"), { ok: true, value: "00:00" });
  assert.deepEqual(parseImportTimeCell("08:00:30"), { ok: true, value: "08:00" });
  assert.deepEqual(parseImportTimeCell(0.5), { ok: true, value: "12:00" });
});

test("parseImportTimeCell rejects invalid times", () => {
  assert.equal(parseImportTimeCell("25:00").ok, false);
  assert.equal(parseImportTimeCell("08:75").ok, false);
  assert.equal(parseImportTimeCell("8 AM").ok, false);
  assert.equal(parseImportTimeCell("08:00 XM").ok, false);
  assert.equal(parseImportTimeCell("").ok, false);
});

test("parseImportNumberCell enforces precision and rejects junk", () => {
  assert.deepEqual(parseImportNumberCell(1500.5), { ok: true, value: 1500.5 });
  assert.deepEqual(parseImportNumberCell("1,500.25"), { ok: true, value: 1500.25 });
  const precise = parseImportNumberCell("1500.555");
  assert.equal(precise.ok, false);
  assert.match(precise.ok === false ? precise.error : "", /decimal places/);
  assert.equal(parseImportNumberCell("abc").ok, false);
  assert.equal(parseImportNumberCell("").ok, false);
});

test("parseImportBooleanCell and enum/text helpers behave strictly", () => {
  assert.deepEqual(parseImportBooleanCell("Yes"), { ok: true, value: true });
  assert.deepEqual(parseImportBooleanCell("n"), { ok: true, value: false });
  assert.deepEqual(parseImportBooleanCell(""), { ok: true, value: false });
  assert.equal(parseImportBooleanCell("maybe").ok, false);

  const long = parseImportTextCell("x".repeat(501), 500);
  assert.equal(long.ok, false);
  assert.equal(parseImportTextCell("has\u0000null", 500).ok, false);
  assert.deepEqual(parseImportTextCell("  ok  ", 500), { ok: true, value: "ok" });
});

test("shift code normalization mirrors the database trigger rules", () => {
  assert.equal(normalizeShiftCode("shift a"), "A");
  assert.equal(normalizeShiftCode("S1"), "S1");
  assert.equal(shiftCodeKey("Shift S1"), "s1");
  assert.equal(deriveShiftCodeFromTime("05:59"), "S4");
  assert.equal(deriveShiftCodeFromTime("06:00"), "S1");
  assert.equal(deriveShiftCodeFromTime("12:00"), "S2");
  assert.equal(deriveShiftCodeFromTime("18:30"), "S3");
});

// ---------------------------------------------------------------------------
// Row normalization
// ---------------------------------------------------------------------------

test("normalizeLogsheetRow accepts a fully valid row without issues", () => {
  const { row, issues } = normalizeLogsheetRow(2, validRaw());
  assert.equal(issues.length, 0);
  assert.ok(row);
  assert.equal(row!.logDate, "2025-01-15");
  assert.equal(row!.shiftCode, "S1");
  assert.equal(row!.isBreakdown, false);
});

test("normalizeLogsheetRow flags every missing mandatory field with column + expected", () => {
  const { row, issues } = normalizeLogsheetRow(3, {
    log_date: "",
    operator_employee_id: "",
    operator_name: "",
    start_time: "",
    end_time: "",
    start_meter: "",
    end_meter: "",
  });
  assert.equal(row, null);
  const codes = issues.map((i) => i.code);
  assert.ok(codes.filter((c) => c === LOGSHEET_ISSUE_CODES.REQUIRED).length >= 5);
  for (const issue of issues) {
    assert.ok(issue.rowNumber === 3);
    assert.ok(issue.columnLabel.length > 0);
    assert.ok(issue.expected.length > 0);
    assert.ok(issue.message.length > 0);
  }
});

test("normalizeLogsheetRow never coerces invalid cells into values", () => {
  const { row, issues } = normalizeLogsheetRow(2, validRaw({ end_meter: "abc", start_time: "99:99" }));
  assert.equal(row, null);
  assert.ok(issues.some((i) => i.code === LOGSHEET_ISSUE_CODES.INVALID_NUMBER));
  assert.ok(issues.some((i) => i.code === LOGSHEET_ISSUE_CODES.INVALID_TIME));
});

test("breakdown rows require both breakdown times", () => {
  const { row, issues } = normalizeLogsheetRow(2, validRaw({ is_breakdown: "Yes", breakdown_start_time: "10:30" }));
  assert.equal(row, null);
  assert.ok(issues.some((i) => i.code === LOGSHEET_ISSUE_CODES.REQUIRED));
});

test("unexpected breakdown times produce an explicit warning, not silence", () => {
  const { row, issues } = normalizeLogsheetRow(2, validRaw({ is_breakdown: "No", breakdown_start_time: "10:30", breakdown_end_time: "11:00" }));
  assert.ok(row);
  const business = validateLogsheetRowBusiness(row!, TODAY);
  const warn = business.find((i) => i.code === LOGSHEET_ISSUE_CODES.BREAKDOWN_TIMES_UNEXPECTED);
  assert.ok(warn);
  assert.equal(warn!.severity, "warning");
  assert.equal(deriveLogsheetRowStatus(business), "warning");
});

// ---------------------------------------------------------------------------
// Business validation
// ---------------------------------------------------------------------------

test("meter regression and >24h running hours are rejected", () => {
  const regressed = makeRow({ start_meter: 100, end_meter: 50 });
  const issues = validateLogsheetRowBusiness(regressed, TODAY);
  assert.ok(issues.some((i) => i.code === LOGSHEET_ISSUE_CODES.METER_REGRESSION));

  const tooLong = makeRow({ start_meter: 0, end_meter: 25 });
  const issues2 = validateLogsheetRowBusiness(tooLong, TODAY);
  assert.ok(issues2.some((i) => i.code === LOGSHEET_ISSUE_CODES.RUNNING_HOURS_LIMIT));
});

test("future log dates and future shift ends are rejected", () => {
  const futureDate = makeRow({ log_date: "2025-07-01" });
  const issues = validateLogsheetRowBusiness(futureDate, TODAY);
  assert.ok(issues.some((i) => i.code === LOGSHEET_ISSUE_CODES.FUTURE_DATE));

  // Now = 2025-06-15 10:00 IST: a shift ending 23:30 today has not ended yet
  const nowMs = new Date("2025-06-15T04:30:00.000Z").getTime();
  const futureEnd = makeRow({ log_date: TODAY, start_time: "23:00", end_time: "23:30" });
  const issues2 = validateLogsheetRowBusiness(futureEnd, TODAY, nowMs);
  assert.ok(issues2.some((i) => i.code === LOGSHEET_ISSUE_CODES.FUTURE_SHIFT_END));
});

test("historical dates (the back-fill use case) are accepted", () => {
  const old = makeRow({ log_date: "2023-04-01" });
  const issues = validateLogsheetRowBusiness(old, TODAY);
  assert.equal(issues.length, 0);
});

test("invalid overtime is rejected loudly instead of clamped", () => {
  const tooMuch = makeRow({ overtime_hours: 20 });
  const issues = validateLogsheetRowBusiness(tooMuch, TODAY);
  assert.ok(issues.some((i) => i.code === LOGSHEET_ISSUE_CODES.OVERTIME_INVALID));

  const exceedsDuration = makeRow({ overtime_hours: 10 }); // shift is 8h
  const issues2 = validateLogsheetRowBusiness(exceedsDuration, TODAY);
  assert.ok(issues2.some((i) => i.code === LOGSHEET_ISSUE_CODES.OVERTIME_INVALID));
});

test("breakdown window must be positive and fit within the shift", () => {
  const identical = makeRow({
    is_breakdown: "Yes",
    breakdown_start_time: "10:00",
    breakdown_end_time: "10:00",
  });
  const issues = validateLogsheetRowBusiness(identical, TODAY);
  assert.ok(issues.some((i) => i.code === LOGSHEET_ISSUE_CODES.BREAKDOWN_WINDOW_INVALID));

  const tooBig = makeRow({
    is_breakdown: "Yes",
    breakdown_start_time: "08:30",
    breakdown_end_time: "15:30", // 7h breakdown inside an 8h shift with overtime 0 — fits
    overtime_hours: 0,
    end_meter: 1515.5, // running hours 15 > breakdown; shift duration is 7h (08:00-15:30 window)
    start_time: "08:00",
    end_time: "08:30",
  });
  const issues2 = validateLogsheetRowBusiness(tooBig, TODAY);
  assert.ok(issues2.some((i) => i.code === LOGSHEET_ISSUE_CODES.BREAKDOWN_EXCEEDS_SHIFT));
});

// ---------------------------------------------------------------------------
// Derived values (existing calculation logic)
// ---------------------------------------------------------------------------

test("derived values match the existing manual entry calculations", () => {
  const row = makeRow({ start_meter: 1500.5, end_meter: 1508.5 });
  const derived = computeLogsheetRowDerived(row);
  assert.equal(derived.runningHours, 8);
  assert.equal(derived.overtimeHours, 0);
  assert.equal(derived.normalWorkingHours, 8);
  assert.equal(derived.shiftCode, "S1");
  assert.equal(derived.shiftLabel, "Shift S1");
  assert.equal(derived.machineCondition, "good");
});

test("blank shift code is auto-derived and overtime auto-calculated; overnight end date rolls over", () => {
  const row = makeRow({ shift_code: "", start_time: "20:00", end_time: "04:00", start_meter: 0, end_meter: 8 });
  const derived = computeLogsheetRowDerived(row);
  assert.equal(derived.shiftCode, "S3"); // derived from 20:00 start
  assert.equal(derived.isOvernight, true);
  assert.equal(derived.endDate, "2025-01-16");
  assert.equal(derived.runningHours, 8);
});

test("auto overtime derives hours beyond 8 exactly like the manual flow", () => {
  const row = makeRow({ start_time: "08:00", end_time: "20:00", start_meter: 0, end_meter: 12, overtime_hours: "" });
  const derived = computeLogsheetRowDerived(row);
  assert.equal(derived.overtimeHours, 4);
  assert.equal(derived.normalWorkingHours, 8);
});

test("breakdown rows get the manual-flow remarks prefix and condition override", () => {
  const row = makeRow({
    is_breakdown: "Yes",
    breakdown_start_time: "10:30",
    breakdown_end_time: "11:15",
    machine_condition: "good",
    remarks: "Belt issue",
  });
  const derived = computeLogsheetRowDerived(row);
  assert.equal(derived.machineCondition, "breakdown");
  assert.match(derived.remarks, /^\[Breakdown Duration: .+\] Belt issue$/);
  assert.equal(derived.breakdownHours, 0.75);
});

// ---------------------------------------------------------------------------
// Duplicate / conflict detection (mirrors DB uniqueness rules)
// ---------------------------------------------------------------------------

function candidate(overrides: Partial<Parameters<typeof detectLogsheetIntraFileConflicts>[0][number]> = {}) {
  return {
    rowNumber: 2,
    operatorKey: "op-1",
    logDate: "2025-01-15",
    shiftKey: "s1",
    startDatetimeIso: "2025-01-15T02:30:00.000Z",
    endDatetimeIso: "2025-01-15T10:30:00.000Z",
    ...overrides,
  };
}

test("in-file machine + date + shift duplicates are detected (DB unique key)", () => {
  const issues = detectLogsheetIntraFileConflicts([
    candidate(),
    candidate({ rowNumber: 3, operatorKey: "op-2" }),
  ]);
  const dup = issues.find((i) => i.kind === "machine_date_shift");
  assert.ok(dup);
  assert.equal(dup!.rowNumber, 3);
  assert.equal(dup!.conflictingWith, "2");
});

test("in-file operator + date + shift duplicates are detected across machines", () => {
  const issues = detectLogsheetIntraFileConflicts([
    candidate(),
    candidate({ rowNumber: 4, shiftKey: "s1" }),
  ]);
  assert.ok(issues.some((i) => i.kind === "operator_date_shift" && i.rowNumber === 4));
});

test("overlapping time intervals are detected per machine and per operator", () => {
  const issues = detectLogsheetIntraFileConflicts([
    candidate(),
    candidate({
      rowNumber: 5,
      operatorKey: "op-2",
      shiftKey: "s2",
      startDatetimeIso: "2025-01-15T08:00:00.000Z",
      endDatetimeIso: "2025-01-15T12:00:00.000Z",
    }),
  ]);
  assert.ok(issues.some((i) => i.kind === "machine_interval" && i.rowNumber === 5));
  assert.ok(!issues.some((i) => i.kind === "operator_interval"));

  const sameOp = detectLogsheetIntraFileConflicts([
    candidate(),
    candidate({
      rowNumber: 6,
      operatorKey: "op-1",
      shiftKey: "s2",
      startDatetimeIso: "2025-01-15T10:00:00.000Z",
      endDatetimeIso: "2025-01-15T12:00:00.000Z",
    }),
  ]);
  assert.ok(sameOp.some((i) => i.kind === "operator_interval" && i.rowNumber === 6));
});

test("non-overlapping back-to-back shifts are accepted", () => {
  const issues = detectLogsheetIntraFileConflicts([
    candidate(),
    candidate({
      rowNumber: 3,
      operatorKey: "op-2",
      shiftKey: "s2",
      startDatetimeIso: "2025-01-15T10:30:00.000Z",
      endDatetimeIso: "2025-01-15T18:30:00.000Z",
    }),
  ]);
  assert.equal(issues.length, 0);
});

// ---------------------------------------------------------------------------
// Status derivation + untrusted payload schema
// ---------------------------------------------------------------------------

test("row status precedence: duplicate < review < invalid < warning < valid", () => {
  const mk = (code: string, severity: "error" | "warning" = "error") => ({
    rowNumber: 2,
    columnKey: "" as const,
    columnLabel: "Row",
    value: "",
    severity,
    code,
    message: "m",
    expected: "e",
  });
  assert.equal(deriveLogsheetRowStatus([mk(LOGSHEET_ISSUE_CODES.DUPLICATE_FILE_MACHINE_SHIFT)]), "duplicate");
  assert.equal(deriveLogsheetRowStatus([mk(LOGSHEET_ISSUE_CODES.OPERATOR_AMBIGUOUS)]), "review");
  assert.equal(deriveLogsheetRowStatus([mk(LOGSHEET_ISSUE_CODES.REQUIRED)]), "invalid");
  assert.equal(deriveLogsheetRowStatus([mk(LOGSHEET_ISSUE_CODES.OPERATOR_MATCHED_BY_NAME, "warning")]), "warning");
  assert.equal(deriveLogsheetRowStatus([]), "valid");
});

test("untrusted confirmation payload schema rejects malformed rows", () => {
  const valid = {
    rowNumber: 2,
    logDate: "2025-01-15",
    operatorEmployeeId: "EMP-0338",
    operatorName: "Rohit Singh",
    shiftCode: "S1",
    startTime: "08:00",
    endTime: "16:00",
    startMeter: 1500.5,
    endMeter: 1508.5,
    overtimeHours: null,
    machineCondition: "good" as const,
    isBreakdown: false,
    breakdownStartTime: "",
    breakdownEndTime: "",
    remarks: "",
  };
  assert.equal(LogsheetImportRowPayloadSchema.safeParse(valid).success, true);
  assert.equal(LogsheetImportRowPayloadSchema.safeParse({ ...valid, logDate: "15/01/2025" }).success, false);
  assert.equal(LogsheetImportRowPayloadSchema.safeParse({ ...valid, startMeter: -1 }).success, false);
  assert.equal(LogsheetImportRowPayloadSchema.safeParse({ ...valid, machineCondition: "hack" }).success, false);
  assert.equal(LogsheetImportRowPayloadSchema.safeParse({ ...valid, remarks: "x".repeat(501) }).success, false);
});

test("shiftCodeKey canonicalizes human-readable shift aliases to UI equivalence classes", () => {
  // Existing Operations UI semantics: A↔S1, B↔S2, C↔S3, D↔S4 (getShiftOrderWeight)
  assert.equal(shiftCodeKey("A"), shiftCodeKey("S1"));
  assert.equal(shiftCodeKey("a"), shiftCodeKey("s1"));
  assert.equal(shiftCodeKey("Shift A"), shiftCodeKey("S1"));
  assert.equal(shiftCodeKey("B"), shiftCodeKey("S2"));
  assert.equal(shiftCodeKey("C"), shiftCodeKey("S3"));
  assert.equal(shiftCodeKey("D"), shiftCodeKey("S4"));
  assert.equal(shiftCodeKey("1"), shiftCodeKey("S1"));
  assert.equal(shiftCodeKey("4"), shiftCodeKey("S4"));
  assert.notEqual(shiftCodeKey("A"), shiftCodeKey("S2"));
  assert.equal(shiftCodeKey(""), "");
  assert.equal(shiftCodeKey(null), "");
  // Unknown codes pass through (lowercased), never invented
  assert.equal(shiftCodeKey("X"), "x");
});

const cand = (id: string, name: string, employeeId: string, status = "active"): LogsheetOperatorCandidate => ({
  id,
  name,
  employeeId,
  status,
});

test("matchOperatorToRow resolves a unique Employee ID match (the double-count regression)", () => {
  // Exactly one record — even though the row also carries the matching name,
  // the identity must resolve (previously the same record was indexed twice and
  // falsely flagged as ambiguous).
  const pool = [cand("u1", "Amit Verma", "EMP-0334")];
  const m = matchOperatorToRow(pool, { employeeId: "EMP-0334", name: "Amit Verma" });
  assert.equal(m.kind, "resolved");
  if (m.kind === "resolved") {
    assert.equal(m.operator.id, "u1");
    assert.equal(m.via, "employee_id");
    assert.equal(m.nameMismatch, false);
  }
});

test("matchOperatorToRow disambiguates duplicate Employee IDs using the provided name", () => {
  const pool = [cand("u1", "Amit Verma", "EMP-0334"), cand("u2", "Amit Sharma", "EMP-0334")];
  const m = matchOperatorToRow(pool, { employeeId: "EMP-0334", name: "amit  sharma" }); // case/whitespace-insensitive
  assert.equal(m.kind, "resolved");
  if (m.kind === "resolved") {
    assert.equal(m.operator.id, "u2");
    assert.equal(m.via, "employee_id_disambiguated_by_name");
    assert.equal(m.nameMismatch, false);
  }
});

test("matchOperatorToRow stays ambiguous when the name cannot identify one record — and lists candidates", () => {
  const pool = [cand("u1", "Amit Verma", "EMP-0334"), cand("u2", "Amit Sharma", "EMP-0334")];

  // Name matches none of the candidates
  const m1 = matchOperatorToRow(pool, { employeeId: "EMP-0334", name: "Rakesh Singh" });
  assert.equal(m1.kind, "ambiguous");
  if (m1.kind === "ambiguous") {
    assert.equal(m1.candidates.length, 2);
    const msg = formatOperatorCandidates(m1.candidates);
    assert.ok(msg.includes("Amit Verma") && msg.includes("Amit Sharma") && msg.includes("EMP-0334"));
    assert.ok(msg.includes("status: active"));
  }

  // Name matches BOTH candidates (two records sharing the same ID AND name) — still ambiguous
  const pool2 = [cand("u1", "Amit Verma", "EMP-0334"), cand("u2", "Amit Verma", "EMP-0334")];
  const m2 = matchOperatorToRow(pool2, { employeeId: "EMP-0334", name: "Amit Verma" });
  assert.equal(m2.kind, "ambiguous");

  // No name provided at all
  const m3 = matchOperatorToRow(pool, { employeeId: "EMP-0334", name: "" });
  assert.equal(m3.kind, "ambiguous");
});

test("matchOperatorToRow supports exact unique name matching and flags name mismatches", () => {
  const pool = [cand("u1", "Amit Verma", "EMP-0334"), cand("u2", "Ramesh Kumar", "EMP-0330")];

  const byName = matchOperatorToRow(pool, { employeeId: "", name: "Amit Verma" });
  assert.equal(byName.kind, "resolved");
  if (byName.kind === "resolved") assert.equal(byName.via, "name");

  // Resolved by ID, but provided name belongs to a different record → warning flag
  const mismatch = matchOperatorToRow(pool, { employeeId: "EMP-0334", name: "Ramesh Kumar" });
  assert.equal(mismatch.kind, "resolved");
  if (mismatch.kind === "resolved") {
    assert.equal(mismatch.operator.id, "u1");
    assert.equal(mismatch.nameMismatch, true);
  }
});

test("matchOperatorToRow never guesses on missing or partial identities", () => {
  const pool = [cand("u1", "Amit Verma", "EMP-0334")];

  const badId = matchOperatorToRow(pool, { employeeId: "EMP-9999", name: "Amit Verma" });
  assert.equal(badId.kind, "not_found");
  if (badId.kind === "not_found") assert.equal(badId.via, "employee_id");

  const badName = matchOperatorToRow(pool, { employeeId: "", name: "Amit" }); // partial name never matches
  assert.equal(badName.kind, "not_found");
  if (badName.kind === "not_found") assert.equal(badName.via, "name");

  const empty = matchOperatorToRow(pool, { employeeId: "", name: "" });
  assert.equal(empty.kind, "not_found");
});
