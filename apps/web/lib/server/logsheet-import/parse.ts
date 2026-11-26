import * as XLSX from "xlsx";
import {
  LOGSHEET_IMPORT_COLUMNS,
  LOGSHEET_IMPORT_DATA_SHEET,
  LOGSHEET_IMPORT_DICTIONARY_SHEET,
  LOGSHEET_IMPORT_HEADERS,
  LOGSHEET_IMPORT_INSTRUCTIONS_SHEET,
  LOGSHEET_IMPORT_MAX_FILE_BYTES,
  LOGSHEET_IMPORT_MAX_ROWS,
  LOGSHEET_IMPORT_TEMPLATE_VERSION,
  type LogsheetImportColumnKey,
  type LogsheetImportIssue,
  type LogsheetImportRawRow,
} from "@reachinternational/validation";

/** Maximum accepted upload size (bytes) — canonical value lives in @reachinternational/validation. */
export { LOGSHEET_IMPORT_MAX_FILE_BYTES };

/** Only the modern workbook format is accepted. */
export const LOGSHEET_IMPORT_ALLOWED_EXTENSIONS = [".xlsx"] as const;

/** Marker embedded in template example rows — never importable. */
export const LOGSHEET_IMPORT_EXAMPLE_MARKER = "EXAMPLE — DELETE THIS ROW";

export interface ParsedLogsheetRow {
  rowNumber: number;
  cells: LogsheetImportRawRow;
  isExampleRow: boolean;
}

export interface ParsedLogsheetWorkbook {
  ok: boolean;
  error?: string;
  templateVersion: string;
  rows: ParsedLogsheetRow[];
  structuralIssues: LogsheetImportIssue[];
  sheetNames: string[];
}

function fileIssue(
  message: string,
  code: string,
  expected: string,
  severity: "error" | "warning" = "error"
): LogsheetImportIssue {
  return {
    rowNumber: 0,
    columnKey: "",
    columnLabel: "Workbook",
    value: "",
    severity,
    code,
    message,
    expected,
  };
}

/**
 * Structural parsing of the uploaded workbook: sheet names, template version,
 * exact column headers (missing / duplicate / unsupported), empty worksheets,
 * row budget and the example-row marker. No business validation happens here.
 */
export function parseLogsheetWorkbook(buffer: Buffer): ParsedLogsheetWorkbook {
  const structuralIssues: LogsheetImportIssue[] = [];

  // Actual format check: .xlsx workbooks are ZIP containers ("PK" magic bytes).
  // Rejects renamed CSV/text payloads that SheetJS would otherwise sniff-parse.
  if (buffer.length < 4 || buffer[0] !== 0x50 || buffer[1] !== 0x4b) {
    return {
      ok: false,
      error: "The file is not a real .xlsx workbook (invalid file signature).",
      templateVersion: "",
      rows: [],
      structuralIssues: [
        fileIssue(
          "The file is not a real .xlsx workbook (invalid file signature).",
          "unreadable_workbook",
          "A valid .xlsx workbook generated from the official template"
        ),
      ],
      sheetNames: [],
    };
  }

  let workbook: XLSX.WorkBook;
  try {
    workbook = XLSX.read(buffer, { type: "buffer" });
  } catch {
    return {
      ok: false,
      error: "The file could not be read as an Excel workbook (.xlsx). The file may be corrupt or not a real .xlsx file.",
      templateVersion: "",
      rows: [],
      structuralIssues: [
        fileIssue(
          "The file could not be read as an Excel workbook (.xlsx).",
          "unreadable_workbook",
          "A valid .xlsx workbook generated from the official template"
        ),
      ],
      sheetNames: [],
    };
  }

  const sheetNames = workbook.SheetNames.map((n) => n.trim());
  const findSheet = (name: string) =>
    workbook.SheetNames.find((n) => n.trim().toLowerCase() === name.toLowerCase());

  const dataSheetName = findSheet(LOGSHEET_IMPORT_DATA_SHEET);
  if (!dataSheetName) {
    structuralIssues.push(
      fileIssue(
        `Worksheet "${LOGSHEET_IMPORT_DATA_SHEET}" was not found. Found: ${sheetNames.join(", ") || "(none)"}.`,
        "missing_data_sheet",
        `A worksheet named "${LOGSHEET_IMPORT_DATA_SHEET}"`
      )
    );
    return {
      ok: false,
      error: `Worksheet "${LOGSHEET_IMPORT_DATA_SHEET}" was not found.`,
      templateVersion: "",
      rows: [],
      structuralIssues,
      sheetNames,
    };
  }
  if (!findSheet(LOGSHEET_IMPORT_INSTRUCTIONS_SHEET)) {
    structuralIssues.push(
      fileIssue(
        `Worksheet "${LOGSHEET_IMPORT_INSTRUCTIONS_SHEET}" is missing — the file was modified outside the official template.`,
        "missing_instructions_sheet",
        `Keep the "${LOGSHEET_IMPORT_INSTRUCTIONS_SHEET}" worksheet from the official template`,
        "warning"
      )
    );
  }
  if (!findSheet(LOGSHEET_IMPORT_DICTIONARY_SHEET)) {
    structuralIssues.push(
      fileIssue(
        `Worksheet "${LOGSHEET_IMPORT_DICTIONARY_SHEET}" is missing — the file was modified outside the official template.`,
        "missing_dictionary_sheet",
        `Keep the "${LOGSHEET_IMPORT_DICTIONARY_SHEET}" worksheet from the official template`,
        "warning"
      )
    );
  }

  const worksheet = workbook.Sheets[dataSheetName];
  const grid = XLSX.utils.sheet_to_json(worksheet, {
    header: 1,
    raw: true,
    defval: null,
  }) as unknown[][];

  if (grid.length === 0) {
    structuralIssues.push(
      fileIssue(
        `Worksheet "${LOGSHEET_IMPORT_DATA_SHEET}" is empty.`,
        "empty_worksheet",
        "A header row plus at least one data row"
      )
    );
    return {
      ok: false,
      error: "The data worksheet is empty.",
      templateVersion: "",
      rows: [],
      structuralIssues,
      sheetNames,
    };
  }

  // --- Template version marker (scanned in the rows above the header) ---
  let templateVersion = "";
  for (let r = 0; r < Math.min(3, grid.length); r++) {
    const joined = (grid[r] || []).map((c) => (c === null || c === undefined ? "" : String(c))).join(" ");
    const m = joined.match(/\bv(\d+\.\d+(?:\.\d+)?)\b/i);
    if (m) {
      templateVersion = m[1];
      break;
    }
  }
  if (!templateVersion) {
    structuralIssues.push(
      fileIssue(
        "No template version marker was found in the worksheet header.",
        "missing_template_version",
        `Template v${LOGSHEET_IMPORT_TEMPLATE_VERSION} generated from the official download`,
        "warning"
      )
    );
    templateVersion = LOGSHEET_IMPORT_TEMPLATE_VERSION;
  } else if (templateVersion !== LOGSHEET_IMPORT_TEMPLATE_VERSION) {
    structuralIssues.push(
      fileIssue(
        `Unexpected template version v${templateVersion}. This system imports template v${LOGSHEET_IMPORT_TEMPLATE_VERSION}.`,
        "unexpected_template_version",
        `Template v${LOGSHEET_IMPORT_TEMPLATE_VERSION}`
      )
    );
  }

  // --- Header row (exact canonical headers, located within the first 10 rows) ---
  const normalizedHeaders = (v: unknown) =>
    v === null || v === undefined ? "" : String(v).trim().toLowerCase();

  let headerRowIndex = -1;
  for (let r = 0; r < Math.min(10, grid.length); r++) {
    const row = (grid[r] || []).map(normalizedHeaders);
    const matches = LOGSHEET_IMPORT_HEADERS.filter((h) => row.includes(h.toLowerCase())).length;
    if (matches >= 3 && matches > (LOGSHEET_IMPORT_HEADERS.length / 2)) {
      headerRowIndex = r;
      break;
    } else if (matches >= 3) {
      headerRowIndex = r;
      break;
    }
  }

  if (headerRowIndex === -1) {
    structuralIssues.push(
      fileIssue(
        "The expected column headers were not found in the data worksheet.",
        "missing_headers",
        `The exact header row of template v${LOGSHEET_IMPORT_TEMPLATE_VERSION}: ${LOGSHEET_IMPORT_HEADERS.join(", ")}`
      )
    );
    return {
      ok: false,
      error: "The expected column headers were not found.",
      templateVersion,
      rows: [],
      structuralIssues,
      sheetNames,
    };
  }

  const headerRow = (grid[headerRowIndex] || []).map(normalizedHeaders);

  // Duplicate header detection (any non-empty header appearing twice)
  const headerCounts = new Map<string, number>();
  for (const h of headerRow) {
    if (h) headerCounts.set(h, (headerCounts.get(h) || 0) + 1);
  }
  for (const [h, count] of headerCounts) {
    if (count > 1) {
      structuralIssues.push(
        fileIssue(
          `Duplicate column header "${h}" appears ${count} times in row ${headerRowIndex + 1}.`,
          "duplicate_header",
          "Each column header must be unique",
        )
      );
    }
  }

  // Map canonical columns to their indexes; report missing + unsupported columns
  const columnOrder = {} as Record<LogsheetImportColumnKey, number>;
  const missingHeaders: string[] = [];
  for (const col of LOGSHEET_IMPORT_COLUMNS) {
    const idx = headerRow.indexOf(col.header.toLowerCase());
    if (idx === -1) missingHeaders.push(col.header);
    else columnOrder[col.key] = idx;
  }
  if (missingHeaders.length > 0) {
    structuralIssues.push(
      fileIssue(
        `Missing required column(s): ${missingHeaders.join(", ")}.`,
        "missing_columns",
        `All template columns must be present: ${LOGSHEET_IMPORT_HEADERS.join(", ")}`
      )
    );
  }

  const knownHeaders = new Set(LOGSHEET_IMPORT_HEADERS.map((h) => h.toLowerCase()));
  const unsupportedHeaders = headerRow
    .map((h, idx) => ({ h, idx }))
    .filter(({ h }) => h && !knownHeaders.has(h))
    .map(({ h, idx }) => `"${(grid[headerRowIndex] || [])[idx] ?? h}"`);
  if (unsupportedHeaders.length > 0) {
    structuralIssues.push(
      fileIssue(
        `Unsupported column(s) found: ${unsupportedHeaders.join(", ")}. Unsupported columns are never silently ignored.`,
        "unsupported_columns",
        "Remove non-template columns or download a fresh template"
      )
    );
  }

  const hasBlockingStructural = structuralIssues.some((i) => i.severity === "error");
  if (hasBlockingStructural) {
    return {
      ok: false,
      error: "The workbook structure is invalid.",
      templateVersion,
      rows: [],
      structuralIssues,
      sheetNames,
    };
  }

  // --- Data rows ---
  const rows: ParsedLogsheetRow[] = [];
  let overflow = false;
  for (let r = headerRowIndex + 1; r < grid.length; r++) {
    const rawRow = grid[r] || [];
    const rowNumber = r + 1; // Excel 1-based row number

    // Fully empty rows are not records — skip without inventing data
    const hasAnyValue = rawRow.some(
      (c) => c !== null && c !== undefined && String(c).trim() !== ""
    );
    if (!hasAnyValue) continue;

    const cells: LogsheetImportRawRow = {};
    for (const col of LOGSHEET_IMPORT_COLUMNS) {
      const idx = columnOrder[col.key];
      cells[col.key] = idx === undefined ? null : rawRow[idx];
    }

    const rowText = rawRow
      .map((c) => (c === null || c === undefined ? "" : String(c)))
      .join(" ");

    rows.push({
      rowNumber,
      cells,
      isExampleRow: rowText.includes(LOGSHEET_IMPORT_EXAMPLE_MARKER),
    });

    if (rows.length > LOGSHEET_IMPORT_MAX_ROWS) {
      overflow = true;
      break;
    }
  }

  if (overflow) {
    structuralIssues.push(
      fileIssue(
        `The workbook exceeds the maximum of ${LOGSHEET_IMPORT_MAX_ROWS} data rows.`,
        "too_many_rows",
        `At most ${LOGSHEET_IMPORT_MAX_ROWS} data rows per import`
      )
    );
    return {
      ok: false,
      error: `The workbook exceeds the maximum of ${LOGSHEET_IMPORT_MAX_ROWS} data rows.`,
      templateVersion,
      rows: [],
      structuralIssues,
      sheetNames,
    };
  }

  if (rows.length === 0) {
    structuralIssues.push(
      fileIssue(
        "The workbook contains no data rows below the header.",
        "no_data_rows",
        "At least one machine log record"
      )
    );
    return {
      ok: false,
      error: "The workbook contains no data rows.",
      templateVersion,
      rows: [],
      structuralIssues,
      sheetNames,
    };
  }

  return {
    ok: true,
    templateVersion,
    rows,
    structuralIssues,
    sheetNames,
  };
}
