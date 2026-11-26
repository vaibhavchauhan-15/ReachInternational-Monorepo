import "server-only";
import {
  getISTDateString,
} from "@reachinternational/utils";
import {
  LOGSHEET_ISSUE_CODES,
  LOGSHEET_IMPORT_COLUMN_BY_KEY,
  LOGSHEET_IMPORT_MAX_ROWS,
  LOGSHEET_IMPORT_TEMPLATE_VERSION,
  computeLogsheetRowDerived,
  deriveLogsheetRowStatus,
  detectLogsheetIntraFileConflicts,
  formatOperatorCandidates,
  matchOperatorToRow,
  normalizeLogsheetRow,
  shiftCodeKey,
  validateLogsheetRowBusiness,
  type LogsheetConflictCandidate,
  type LogsheetImportIssue,
  type NormalizedLogsheetRow,
} from "@reachinternational/validation";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import {
  LOGSHEET_IMPORT_EXAMPLE_MARKER,
  LOGSHEET_IMPORT_MAX_FILE_BYTES,
  parseLogsheetWorkbook,
  type ParsedLogsheetRow,
} from "./parse.ts";
import type {
  LogsheetImportPreview,
  LogsheetImportSummary,
  LogsheetPreviewRow,
} from "./types.ts";

/**
 * Complete pre-import validation pipeline. Pure READ-ONLY against the database:
 * nothing is inserted — the only write path is the atomic
 * `import_machine_hour_logs_bulk` RPC invoked from the confirmed import action.
 *
 * Performance: bounded batched queries (machine, operators, existing logs,
 * assignments) regardless of row count — no N+1 access.
 */

interface ResolvedOperator {
  id: string;
  name: string;
  employeeId: string;
  status: string;
}

function operatorLabel(op: { name: string; employeeId: string }): string {
  return `${op.name || "Unknown"}${op.employeeId ? ` (${op.employeeId})` : ""}`;
}

interface MachineRecord {
  id: string;
  machine_id: string | null;
  machine_name: string | null;
  model: string | null;
  client_id: string | null;
  site_id: string | null;
}

function issue(
  rowNumber: number,
  columnKey: LogsheetImportIssue["columnKey"],
  value: string,
  code: string,
  message: string,
  expected: string,
  severity: "error" | "warning" = "error"
): LogsheetImportIssue {
  return {
    rowNumber,
    columnKey,
    columnLabel: columnKey ? LOGSHEET_IMPORT_COLUMN_BY_KEY[columnKey].header : "Row",
    value,
    severity,
    code,
    message,
    expected,
  };
}

export function emptySummary(): LogsheetImportSummary {
  return {
    totalRows: 0,
    validRows: 0,
    warningRows: 0,
    invalidRows: 0,
    duplicateRows: 0,
    reviewRows: 0,
    readyRows: 0,
    dateRangeStart: "",
    dateRangeEnd: "",
    totalRunningHours: 0,
  };
}

export async function fetchImportMachine(machineId: string): Promise<MachineRecord | null> {
  if (!machineId || !/^[0-9a-f-]{36}$/i.test(machineId)) return null;
  const supabase = createSupabaseAdminClient();
  const { data } = await supabase
    .from("machines")
    .select("id, machine_id, machine_name, model, client_id, site_id")
    .eq("id", machineId)
    .maybeSingle();
  return (data as MachineRecord | null) ?? null;
}

export function machineDisplayLabel(machine: MachineRecord): string {
  const code = machine.machine_id || machine.id;
  const name = machine.machine_name || machine.model || "";
  return name ? `${code} — ${name}` : code;
}

/**
 * Resolves operator identities EXACTLY (employee ID first, otherwise exact full
 * name). Ambiguous or partial matches are never guessed — rows are marked for
 * administrator correction instead.
 */
async function resolveOperators(
  rows: NormalizedLogsheetRow[]
): Promise<Map<number, { operator: ResolvedOperator | null; issues: LogsheetImportIssue[] }>> {
  const supabase = createSupabaseAdminClient();
  const result = new Map<number, { operator: ResolvedOperator | null; issues: LogsheetImportIssue[] }>();

  const employeeIds = [
    ...new Set(rows.map((r) => r.operatorEmployeeId.trim()).filter(Boolean)),
  ];
  const names = [...new Set(rows.map((r) => r.operatorName.trim()).filter(Boolean))];

  const [byIdRes, byNameRes] = await Promise.all([
    employeeIds.length > 0
      ? supabase
          .from("users")
          .select("id, full_name, employee_id, status")
          .eq("role", "operator")
          .in("employee_id", employeeIds)
      : Promise.resolve({ data: [] as unknown[], error: null }),
    names.length > 0
      ? supabase
          .from("users")
          .select("id, full_name, employee_id, status")
          .eq("role", "operator")
          .in("full_name", names)
      : Promise.resolve({ data: [] as unknown[], error: null }),
  ]);

  // Union the two batched result sets, DE-DUPLICATED BY RECORD ID: the same
  // user can be returned by both queries (matching by Employee ID and by name)
  // and must be counted exactly once. Indexing the same record twice previously
  // produced false "matches 2 operator records" ambiguity on unique Employee IDs.
  const pool = new Map<string, ResolvedOperator>();
  const userRows = [
    ...((byIdRes.data || []) as Array<{
      id: string;
      full_name: string | null;
      employee_id: string | null;
      status: string | null;
    }>),
    ...((byNameRes.data || []) as Array<{
      id: string;
      full_name: string | null;
      employee_id: string | null;
      status: string | null;
    }>),
  ];
  for (const u of userRows) {
    if (!pool.has(u.id)) {
      pool.set(u.id, {
        id: u.id,
        name: u.full_name || "",
        employeeId: u.employee_id || "",
        status: u.status || "unknown",
      });
    }
  }
  const candidates = [...pool.values()];

  for (const row of rows) {
    const issues: LogsheetImportIssue[] = [];
    const empId = row.operatorEmployeeId.trim();
    const name = row.operatorName.trim();

    let operator: ResolvedOperator | null = null;

    const match = matchOperatorToRow(candidates, { employeeId: empId, name });
    if (match.kind === "resolved") {
      operator = match.operator;
      if (match.via === "employee_id_disambiguated_by_name") {
        issues.push(
          issue(
            row.rowNumber,
            "operator_employee_id",
            empId,
            LOGSHEET_ISSUE_CODES.OPERATOR_DISAMBIGUATED_BY_NAME,
            `Employee ID "${empId}" matches multiple operator records; the identity was confirmed by the provided name "${match.operator.name}" (${operatorLabel(match.operator)}). Verify this is the intended operator.`,
            "A unique Employee ID",
            "warning"
          )
        );
      } else if (match.via === "name") {
        issues.push(
          issue(
            row.rowNumber,
            "operator_employee_id",
            "",
            LOGSHEET_ISSUE_CODES.OPERATOR_MATCHED_BY_NAME,
            `Operator matched by exact name (${operatorLabel(match.operator)}). Add the Employee ID next time for a stronger identity check.`,
            "Employee ID e.g. EMP-0338",
            "warning"
          )
        );
      }
      if (match.nameMismatch) {
        issues.push(
          issue(
            row.rowNumber,
            "operator_name",
            name,
            LOGSHEET_ISSUE_CODES.OPERATOR_NAME_MISMATCH,
            `Operator Name "${name}" does not match the record for Employee ID "${empId}" (${match.operator.name}). The Employee ID was used — review before importing.`,
            "The exact full name on the employee record",
            "warning"
          )
        );
      }
    } else if (match.kind === "ambiguous") {
      if (match.via === "employee_id") {
        issues.push(
          issue(
            row.rowNumber,
            "operator_employee_id",
            empId,
            LOGSHEET_ISSUE_CODES.OPERATOR_AMBIGUOUS,
            `Employee ID "${empId}" matches ${match.candidates.length} operator records: ${formatOperatorCandidates(match.candidates)}. Fill the Operator Name to match exactly one of these records — the identity is never guessed.`,
            "A unique Employee ID, or a name matching exactly one of the listed records"
          )
        );
      } else {
        issues.push(
          issue(
            row.rowNumber,
            "operator_name",
            name,
            LOGSHEET_ISSUE_CODES.OPERATOR_AMBIGUOUS,
            `"${name}" matches ${match.candidates.length} operator records: ${formatOperatorCandidates(match.candidates)}. Fill the Operator Employee ID of the intended operator.`,
            "The Employee ID of the intended operator"
          )
        );
      }
    } else if (match.via === "employee_id") {
      issues.push(
        issue(
          row.rowNumber,
          "operator_employee_id",
          empId,
          LOGSHEET_ISSUE_CODES.OPERATOR_NOT_FOUND,
          `No operator record matches Employee ID "${empId}".`,
          "An exact Employee ID of an operator on file"
        )
      );
    } else {
      issues.push(
        issue(
          row.rowNumber,
          "operator_name",
          name,
          LOGSHEET_ISSUE_CODES.OPERATOR_NOT_FOUND,
          `No operator record matches the exact name "${name}". Partial name matches are never accepted — fill the Employee ID instead.`,
          "An exact full name, or preferably the Employee ID"
        )
      );
    }

    if (operator && operator.status !== "active") {
      issues.push(
        issue(
          row.rowNumber,
          "operator_employee_id",
          operatorLabel(operator),
          LOGSHEET_ISSUE_CODES.OPERATOR_INACTIVE,
          `Operator ${operatorLabel(operator)} is not an active user ("${operator.status}"). Historical records can still be imported — verify this is intended.`,
          "An active operator record",
          "warning"
        )
      );
    }

    result.set(row.rowNumber, { operator, issues });
  }

  return result;
}

/** Shift-code-matched assignment resolution — identical rule to the import RPC. */
async function resolveAssignments(
  machineId: string,
  rows: NormalizedLogsheetRow[],
  operatorIdByRow: Map<number, string | null>
): Promise<Map<number, string | null>> {
  const supabase = createSupabaseAdminClient();
  const resolved = new Map<number, string | null>();
  const operatorIds = [...new Set([...operatorIdByRow.values()].filter(Boolean))] as string[];
  if (operatorIds.length === 0) return resolved;

  const minDate = rows.reduce((min, r) => (r.logDate < min ? r.logDate : min), rows[0].logDate);
  const maxDate = rows.reduce((max, r) => (r.logDate > max ? r.logDate : max), rows[0].logDate);

  const { data } = await supabase
    .from("operator_machine_assignments")
    .select("id, operator_id, shift_code, valid_from, valid_to")
    .eq("machine_id", machineId)
    .in("operator_id", operatorIds)
    .lte("valid_from", maxDate)
    .or(`valid_to.is.null,valid_to.gte.${minDate}`);

  const candidates = (data || []) as Array<{
    id: string;
    operator_id: string;
    shift_code: string | null;
    valid_from: string;
    valid_to: string | null;
  }>;

  for (const row of rows) {
    const operatorId = operatorIdByRow.get(row.rowNumber);
    if (!operatorId) {
      resolved.set(row.rowNumber, null);
      continue;
    }
    const shiftKey = shiftCodeKey(row.shiftCode || undefined);
    const match = candidates
      .filter(
        (a) =>
          a.operator_id === operatorId &&
          a.valid_from <= row.logDate &&
          (a.valid_to === null || a.valid_to >= row.logDate) &&
          shiftCodeKey(a.shift_code) === shiftKey
      )
      .sort((a, b) => (a.valid_from < b.valid_from ? 1 : -1))[0];
    resolved.set(row.rowNumber, match ? match.id : null);
  }
  return resolved;
}

/** Row payload resolved for the atomic import RPC (server-side only). */
export interface LogsheetImportRpcRow {
  row_number: number;
  operator_id: string;
  log_date: string;
  shift_code: string;
  start_time: string;
  end_time: string;
  start_meter: number;
  end_meter: number;
  overtime_hours: number;
  normal_working_hours: number;
  machine_condition: string;
  is_breakdown: boolean;
  breakdown_start_time: string | null;
  breakdown_end_time: string | null;
  breakdown_duration: string | null;
  breakdown_hours: number;
  remarks: string | null;
  location: string | null;
}

export interface LogsheetImportPlan {
  machine: MachineRecord;
  machineLabel: string;
  filename: string;
  fileChecksum: string;
  templateVersion: string;
  rpcRows: LogsheetImportRpcRow[];
}

export interface LogsheetImportValidation {
  preview: LogsheetImportPreview;
  plan: LogsheetImportPlan | null;
}

/**
 * Builds the complete validation preview for an uploaded workbook against the
 * selected machine. Read-only: no records are inserted or modified.
 */
export async function buildLogsheetImportPreview(
  machineId: string,
  buffer: Buffer,
  filename: string,
  fileSize: number
): Promise<LogsheetImportPreview> {
  return (await runLogsheetImportValidation(machineId, buffer, filename, fileSize)).preview;
}

export async function runLogsheetImportValidation(
  machineId: string,
  buffer: Buffer,
  filename: string,
  fileSize: number
): Promise<LogsheetImportValidation> {
  const maxRows = LOGSHEET_IMPORT_MAX_ROWS;
  const base: LogsheetImportPreview = {
    ok: false,
    machineId,
    machineLabel: "",
    filename,
    fileSize,
    fileChecksum: "",
    templateVersion: LOGSHEET_IMPORT_TEMPLATE_VERSION,
    rows: [],
    summary: emptySummary(),
    structuralIssues: [],
    blocked: true,
    maxRows,
  };

  // --- File envelope ---
  if (fileSize <= 0) {
    return { preview: { ...base, error: "The uploaded file is empty." }, plan: null };
  }
  if (fileSize > LOGSHEET_IMPORT_MAX_FILE_BYTES) {
    return {
      preview: {
        ...base,
        error: `The file exceeds the ${Math.round(LOGSHEET_IMPORT_MAX_FILE_BYTES / (1024 * 1024))}MB upload limit.`,
        structuralIssues: [
          issue(
            0,
            "",
            "",
            "file_too_large",
            `The file exceeds the ${Math.round(LOGSHEET_IMPORT_MAX_FILE_BYTES / (1024 * 1024))}MB upload limit.`,
            "A workbook of at most 5MB"
          ),
        ],
      },
      plan: null,
    };
  }
  const lowerName = (filename || "").toLowerCase();
  if (!lowerName.endsWith(".xlsx")) {
    return {
      preview: {
        ...base,
        error: "Unsupported file type. Only .xlsx workbooks are accepted.",
        structuralIssues: [
          issue(
            0,
            "",
            filename,
            "unsupported_file_type",
            "Unsupported file type. Only .xlsx workbooks generated from the official template are accepted.",
            "An .xlsx workbook"
          ),
        ],
      },
      plan: null,
    };
  }

  const { createHash } = await import("node:crypto");
  const fileChecksum = createHash("sha256").update(buffer).digest("hex");

  // --- Machine (server-side resolution; spreadsheet can never override it) ---
  const machine = await fetchImportMachine(machineId);
  if (!machine) {
    return { preview: { ...base, fileChecksum, error: "The selected machine could not be found." }, plan: null };
  }

  // --- Structural parse ---
  const parsed = parseLogsheetWorkbook(buffer);
  const structuralIssues = parsed.structuralIssues;
  if (!parsed.ok) {
    return {
      preview: {
        ...base,
        fileChecksum,
        templateVersion: parsed.templateVersion,
        structuralIssues,
        error: parsed.error || "The workbook structure is invalid.",
      },
      plan: null,
    };
  }

  // --- Normalize + field validation ---
  const normalizedRows: NormalizedLogsheetRow[] = [];
  const issuesByRow = new Map<number, LogsheetImportIssue[]>();
  const exampleRows = new Set<number>();

  for (const parsedRow of parsed.rows as ParsedLogsheetRow[]) {
    const { row, issues } = normalizeLogsheetRow(parsedRow.rowNumber, parsedRow.cells);
    const rowIssues = [...issues];
    if (parsedRow.isExampleRow) {
      exampleRows.add(parsedRow.rowNumber);
      rowIssues.push(
        issue(
          parsedRow.rowNumber,
          "",
          LOGSHEET_IMPORT_EXAMPLE_MARKER,
          LOGSHEET_ISSUE_CODES.EXAMPLE_ROW,
          "This is a template example row. Delete example rows before uploading.",
          "Only real logsheet records"
        )
      );
    }
    issuesByRow.set(parsedRow.rowNumber, rowIssues);
    if (row) normalizedRows.push(row);
  }

  // --- Business validation + derived values (existing calculation logic) ---
  const todayIso = getISTDateString();
  const derivedByRow = new Map<number, ReturnType<typeof computeLogsheetRowDerived>>();
  for (const row of normalizedRows) {
    const businessIssues = validateLogsheetRowBusiness(row, todayIso);
    issuesByRow.get(row.rowNumber)!.push(...businessIssues);
    derivedByRow.set(row.rowNumber, computeLogsheetRowDerived(row));
  }

  // --- Operator resolution (batched) ---
  const resolutions = await resolveOperators(normalizedRows);
  const operatorIdByRow = new Map<number, string | null>();
  for (const row of normalizedRows) {
    const res = resolutions.get(row.rowNumber);
    issuesByRow.get(row.rowNumber)!.push(...(res?.issues || []));
    operatorIdByRow.set(row.rowNumber, res?.operator?.id ?? null);
  }

  // --- Assignment linkage (for duplicate accuracy) ---
  const assignmentByRow = await resolveAssignments(machineId, normalizedRows, operatorIdByRow);

  // --- In-file duplicate / overlap detection (exact DB uniqueness semantics) ---
  const candidates: LogsheetConflictCandidate[] = normalizedRows
    .filter((row) => derivedByRow.has(row.rowNumber))
    .map((row) => {
      const derived = derivedByRow.get(row.rowNumber)!;
      return {
        rowNumber: row.rowNumber,
        operatorKey: operatorIdByRow.get(row.rowNumber) || `unresolved:${row.rowNumber}`,
        logDate: row.logDate,
        shiftKey: shiftCodeKey(derived.shiftCode),
        startDatetimeIso: derived.startDatetimeIso,
        endDatetimeIso: derived.endDatetimeIso,
      };
    });

  for (const conflict of detectLogsheetIntraFileConflicts(candidates)) {
    const isDuplicate = conflict.kind === "machine_date_shift" || conflict.kind === "operator_date_shift";
    issuesByRow.get(conflict.rowNumber)!.push(
      issue(
        conflict.rowNumber,
        "",
        conflict.conflictingLabel,
        isDuplicate
          ? conflict.kind === "machine_date_shift"
            ? LOGSHEET_ISSUE_CODES.DUPLICATE_FILE_MACHINE_SHIFT
            : LOGSHEET_ISSUE_CODES.DUPLICATE_FILE_OPERATOR_SHIFT
          : conflict.kind === "machine_interval"
            ? LOGSHEET_ISSUE_CODES.OVERLAP_FILE_MACHINE
            : LOGSHEET_ISSUE_CODES.OVERLAP_FILE_OPERATOR,
        isDuplicate
          ? `Duplicate inside the uploaded file — ${conflict.conflictingLabel}. Duplicate rows are excluded from the import.`
          : `Overlapping shift inside the uploaded file — ${conflict.conflictingLabel}. Overlaps are rejected by the database and must be corrected.`,
        isDuplicate ? "A unique Machine + Date + Shift / Operator + Date + Shift per row" : "Non-overlapping shift times"
      )
    );
  }

  // --- Database duplicate / overlap detection (batched) ---
  const supabase = createSupabaseAdminClient();
  const logDates = normalizedRows.map((r) => r.logDate);
  const minDate = logDates.reduce((min, d) => (d < min ? d : min), logDates[0]);
  const maxDate = logDates.reduce((max, d) => (d > max ? d : max), logDates[0]);
  const operatorIds = [...new Set([...operatorIdByRow.values()].filter(Boolean))] as string[];

  const [machineLogsRes, operatorLogsRes] = await Promise.all([
    supabase
      .from("machine_hour_logs")
      .select("id, log_date, shift_code, operator_id, start_datetime, end_datetime, assignment_id")
      .eq("machine_id", machineId)
      .gte("log_date", minDate)
      .lte("log_date", maxDate),
    operatorIds.length > 0
      ? supabase
          .from("machine_hour_logs")
          .select("id, log_date, shift_code, operator_id, start_datetime, end_datetime, assignment_id")
          .in("operator_id", operatorIds)
          .gte("log_date", minDate)
          .lte("log_date", maxDate)
      : Promise.resolve({ data: [] as unknown[], error: null }),
  ]);

  const existingLogs = [
    ...((machineLogsRes.data || []) as Array<{
      id: string;
      log_date: string;
      shift_code: string | null;
      operator_id: string;
      start_datetime: string | null;
      end_datetime: string | null;
      assignment_id: string | null;
    }>),
    ...((operatorLogsRes.data || []) as Array<{
      id: string;
      log_date: string;
      shift_code: string | null;
      operator_id: string;
      start_datetime: string | null;
      end_datetime: string | null;
      assignment_id: string | null;
    }>),
  ];
  // De-duplicate overlapping query results
  const existingById = new Map(existingLogs.map((l) => [l.id, l]));
  const existing = [...existingById.values()];

  const existingMachineKeys = new Set(existing.map((l) => `${l.log_date}::${shiftCodeKey(l.shift_code)}`));
  const existingOperatorKeys = new Set(
    existing.map((l) => `${l.operator_id}::${l.log_date}::${shiftCodeKey(l.shift_code)}`)
  );
  const existingAssignmentKeys = new Set(
    existing.filter((l) => l.assignment_id).map((l) => `${l.assignment_id}::${l.log_date}`)
  );

  for (const row of normalizedRows) {
    const derived = derivedByRow.get(row.rowNumber)!;
    const operatorId = operatorIdByRow.get(row.rowNumber);
    const rowIssues = issuesByRow.get(row.rowNumber)!;

    const mds = `${row.logDate}::${shiftCodeKey(derived.shiftCode)}`;
    if (existingMachineKeys.has(mds)) {
      rowIssues.push(
        issue(
          row.rowNumber,
          "log_date",
          `${row.logDate} / ${derived.shiftCode}`,
          LOGSHEET_ISSUE_CODES.DUPLICATE_EXISTING_MACHINE_SHIFT,
          `A log for Shift ${derived.shiftCode} on ${row.logDate} already exists for this machine. Duplicate rows are excluded — existing records are never overwritten.`,
          "A Machine + Date + Shift combination not yet logged"
        )
      );
    }
    if (operatorId) {
      const ods = `${operatorId}::${row.logDate}::${shiftCodeKey(derived.shiftCode)}`;
      if (existingOperatorKeys.has(ods)) {
        rowIssues.push(
          issue(
            row.rowNumber,
            "operator_employee_id",
            `${row.operatorEmployeeId || row.operatorName} / ${row.logDate} / ${derived.shiftCode}`,
            LOGSHEET_ISSUE_CODES.DUPLICATE_EXISTING_OPERATOR_SHIFT,
            `The operator already has a log for Shift ${derived.shiftCode} on ${row.logDate}. Duplicate rows are excluded — existing records are never overwritten.`,
            "An Operator + Date + Shift combination not yet logged"
          )
        );
      }
      const assignmentId = assignmentByRow.get(row.rowNumber);
      if (assignmentId && existingAssignmentKeys.has(`${assignmentId}::${row.logDate}`)) {
        rowIssues.push(
          issue(
            row.rowNumber,
            "log_date",
            row.logDate,
            LOGSHEET_ISSUE_CODES.DUPLICATE_EXISTING_ASSIGNMENT,
            `An existing log already covers this operator's assignment for ${row.logDate}. Duplicate rows are excluded.`,
            "A date not yet covered by the assignment's logs"
          )
        );
      }
    }

    // Timeline overlap against existing DB records (exclusion constraint semantics)
    for (const ex of existing) {
      if (!derived.startDatetimeIso || !derived.endDatetimeIso) break;
      if (!ex.start_datetime || !ex.end_datetime) continue;
      const overlaps = derived.startDatetimeIso < ex.end_datetime && ex.start_datetime < derived.endDatetimeIso;
      if (!overlaps) continue;
      const isMachineScope = ex.operator_id === operatorId || true;
      if (isMachineScope) {
        rowIssues.push(
          issue(
            row.rowNumber,
            "start_time",
            `${derived.startDatetimeIso} - ${derived.endDatetimeIso}`,
            LOGSHEET_ISSUE_CODES.OVERLAP_EXISTING_MACHINE,
            `The shift overlaps existing log ${ex.id.slice(0, 8)} (${ex.start_datetime} - ${ex.end_datetime}) on this machine. Overlapping timelines are rejected by the database.`,
            "Non-overlapping shift times for this machine"
          )
        );
      }
      if (operatorId && ex.operator_id === operatorId) {
        rowIssues.push(
          issue(
            row.rowNumber,
            "start_time",
            `${derived.startDatetimeIso} - ${derived.endDatetimeIso}`,
            LOGSHEET_ISSUE_CODES.OVERLAP_EXISTING_OPERATOR,
            `The operator is already logged on overlapping hours (${ex.start_datetime} - ${ex.end_datetime}). An operator cannot operate multiple machines concurrently.`,
            "Non-overlapping shift times for this operator"
          )
        );
      }
      break; // one conflict report per row is enough
    }
  }

  // --- Assemble preview rows + summary ---
  const previewRows: LogsheetPreviewRow[] = [];
  const summary = emptySummary();
  let totalRunningHours = 0;
  let blocked = false;

  const allRows: ParsedLogsheetRow[] = parsed.rows;
  for (const parsedRow of allRows) {
    const rowIssues = issuesByRow.get(parsedRow.rowNumber) || [];
    const row = normalizedRows.find((r) => r.rowNumber === parsedRow.rowNumber) || null;
    const derived = row ? derivedByRow.get(row.rowNumber) : undefined;
    const res = row ? resolutions.get(row.rowNumber) : undefined;

    const status = deriveLogsheetRowStatus(rowIssues);
    if (status === "invalid" || status === "review") blocked = true;

    summary.totalRows++;
    if (status === "valid") summary.validRows++;
    else if (status === "warning") summary.warningRows++;
    else if (status === "duplicate") summary.duplicateRows++;
    else if (status === "review") summary.reviewRows++;
    else summary.invalidRows++;

    const ready = status === "valid" || status === "warning";
    if (ready && row && derived) {
      summary.readyRows++;
      totalRunningHours += derived.runningHours;
      if (!summary.dateRangeStart || row.logDate < summary.dateRangeStart) summary.dateRangeStart = row.logDate;
      if (!summary.dateRangeEnd || row.logDate > summary.dateRangeEnd) summary.dateRangeEnd = row.logDate;
    }

    previewRows.push({
      rowNumber: parsedRow.rowNumber,
      status,
      source: {
        logDate: row?.logDate ?? "",
        operatorEmployeeId: row?.operatorEmployeeId ?? "",
        operatorName: row?.operatorName ?? "",
        shiftCode: row?.shiftCode ?? "",
        startTime: row?.startTime ?? "",
        endTime: row?.endTime ?? "",
        startMeter: row?.startMeter ?? null,
        endMeter: row?.endMeter ?? null,
        overtimeHours: row?.overtimeHours ?? null,
        machineCondition: row?.machineCondition ?? "",
        isBreakdown: row?.isBreakdown ?? false,
        breakdownStartTime: row?.breakdownStartTime ?? "",
        breakdownEndTime: row?.breakdownEndTime ?? "",
        remarks: row?.remarks ?? "",
      },
      resolved: {
        operatorLabel: res?.operator ? operatorLabel(res.operator) : "—",
        shiftCode: derived?.shiftCode ?? "—",
        endDate: derived?.endDate ?? "",
        runningHours: derived?.runningHours ?? 0,
        overtimeHours: derived?.overtimeHours ?? 0,
        normalWorkingHours: derived?.normalWorkingHours ?? 0,
        durationFormatted: derived?.durationFormatted ?? "",
        isOvernight: derived?.isOvernight ?? false,
        machineCondition: derived?.machineCondition ?? "",
        remarks: derived?.remarks ?? "",
        breakdownDuration: derived?.breakdownDuration ?? "",
        isFutureEnd: derived?.isFutureEnd ?? false,
      },
      issues: rowIssues,
    });
  }

  summary.totalRunningHours = Math.round(totalRunningHours * 100) / 100;

  const preview: LogsheetImportPreview = {
    ok: true,
    machineId: machine.id,
    machineLabel: machineDisplayLabel(machine),
    filename,
    fileSize,
    fileChecksum,
    templateVersion: parsed.templateVersion,
    rows: previewRows,
    summary,
    structuralIssues,
    blocked,
    maxRows,
    error: blocked ? "Some rows have blocking validation issues." : undefined,
  };

  // Server-side import plan: resolved rows eligible for the atomic RPC.
  const rpcRows: LogsheetImportRpcRow[] = [];
  if (!blocked) {
    for (const row of normalizedRows) {
      const rowIssues = issuesByRow.get(row.rowNumber) || [];
      const status = deriveLogsheetRowStatus(rowIssues);
      if (status !== "valid" && status !== "warning") continue;
      const derived = derivedByRow.get(row.rowNumber)!;
      const operatorId = operatorIdByRow.get(row.rowNumber);
      if (!operatorId) continue;
      rpcRows.push({
        row_number: row.rowNumber,
        operator_id: operatorId,
        log_date: row.logDate,
        shift_code: derived.shiftCode,
        start_time: row.startTime,
        end_time: row.endTime,
        start_meter: row.startMeter,
        end_meter: row.endMeter,
        overtime_hours: derived.overtimeHours,
        normal_working_hours: derived.normalWorkingHours,
        machine_condition: derived.machineCondition,
        is_breakdown: row.isBreakdown && Boolean(derived.breakdownDuration),
        breakdown_start_time: row.isBreakdown ? row.breakdownStartTime || null : null,
        breakdown_end_time: row.isBreakdown ? row.breakdownEndTime || null : null,
        breakdown_duration: derived.breakdownDuration || null,
        breakdown_hours: derived.breakdownHours,
        remarks: derived.remarks || null,
        location: null,
      });
    }
  }

  const plan: LogsheetImportPlan | null = blocked
    ? null
    : {
        machine,
        machineLabel: machineDisplayLabel(machine),
        filename,
        fileChecksum,
        templateVersion: parsed.templateVersion,
        rpcRows,
      };

  return { preview, plan };
}
