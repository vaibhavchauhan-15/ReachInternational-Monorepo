import ExcelJS from "exceljs";
import {
  LOGSHEET_IMPORT_COLUMNS,
  LOGSHEET_IMPORT_DATA_SHEET,
  LOGSHEET_IMPORT_DICTIONARY_SHEET,
  LOGSHEET_IMPORT_HEADERS,
  LOGSHEET_IMPORT_INSTRUCTIONS_SHEET,
  LOGSHEET_IMPORT_MAX_FILE_BYTES,
  LOGSHEET_IMPORT_MAX_ROWS,
  LOGSHEET_IMPORT_TEMPLATE_VERSION,
} from "@reachinternational/validation";
import { LOGSHEET_IMPORT_EXAMPLE_MARKER } from "./parse.ts";

/**
 * Generates the standardized import workbook from the canonical column model
 * (the same model that drives parsing, validation and the data dictionary).
 *
 * Sheets:
 *   1. "Logsheet Data"     — importable records (headers + clearly marked examples)
 *   2. "Instructions"      — how to fill the template
 *   3. "Data Dictionary"   — per-field documentation
 */

const HEADER_FILL: ExcelJS.Fill = {
  type: "pattern",
  pattern: "solid",
  fgColor: { argb: "FF0284C7" },
};
const HEADER_FONT: Partial<ExcelJS.Font> = {
  bold: true,
  color: { argb: "FFFFFFFF" },
  size: 11,
  name: "Calibri",
};
const TITLE_FONT: Partial<ExcelJS.Font> = {
  bold: true,
  size: 14,
  color: { argb: "FF171717" },
  name: "Calibri",
};
const EXAMPLE_FONT: Partial<ExcelJS.Font> = {
  italic: true,
  color: { argb: "FF8A8A8A" },
  size: 10,
  name: "Calibri",
};
const THIN_BORDER: Partial<ExcelJS.Borders> = {
  top: { style: "thin", color: { argb: "FFE0E0E0" } },
  left: { style: "thin", color: { argb: "FFE0E0E0" } },
  bottom: { style: "thin", color: { argb: "FFE0E0E0" } },
  right: { style: "thin", color: { argb: "FFE0E0E0" } },
};

const EXAMPLE_ROWS: Array<Record<string, unknown>> = [
  {
    log_date: new Date(Date.UTC(2025, 0, 15)),
    operator_employee_id: "EMP-0338",
    operator_name: "Rohit Singh",
    shift_code: "S1",
    start_time: 8 / 24,
    end_time: 16 / 24,
    start_meter: 1500.5,
    end_meter: 1508.5,
    overtime_hours: 0,
    machine_condition: "good",
    is_breakdown: "No",
    breakdown_start_time: null,
    breakdown_end_time: null,
    remarks: `Routine operation — EXAMPLE — DELETE THIS ROW`,
  },
  {
    log_date: new Date(Date.UTC(2025, 0, 15)),
    operator_employee_id: "EMP-0328",
    operator_name: "Deepak Patel",
    shift_code: "S2",
    start_time: 16 / 24,
    end_time: 0,
    start_meter: 1508.5,
    end_meter: 1514,
    overtime_hours: 1.5,
    machine_condition: "breakdown",
    is_breakdown: "Yes",
    breakdown_start_time: 18 / 24,
    breakdown_end_time: 18.75 / 24,
    remarks: `Belt replacement — EXAMPLE — DELETE THIS ROW`,
  },
];

/**
 * exceljs 4.4 exposes worksheet.dataValidations at runtime but its bundled
 * typings omit it — this adapter documents the real API without using `any`.
 */
interface WorksheetDataValidations {
  add(range: string, validation: ExcelJS.DataValidation): void;
}

function dataValidations(sheet: ExcelJS.Worksheet): WorksheetDataValidations {
  return (sheet as unknown as { dataValidations: WorksheetDataValidations }).dataValidations;
}

function buildDataSheet(workbook: ExcelJS.Workbook): void {
  const sheet = workbook.addWorksheet(LOGSHEET_IMPORT_DATA_SHEET, {
    views: [{ state: "frozen", ySplit: 2 }],
    properties: { defaultRowHeight: 18 },
  });

  // Row 1 — title + template version marker (parsed for version enforcement)
  sheet.mergeCells(1, 1, 1, LOGSHEET_IMPORT_HEADERS.length);
  const title = sheet.getCell(1, 1);
  title.value = `Reach International — Machine Logsheet Import Template v${LOGSHEET_IMPORT_TEMPLATE_VERSION}`;
  title.font = TITLE_FONT;
  title.alignment = { vertical: "middle", horizontal: "left" };
  sheet.getRow(1).height = 26;

  // Row 2 — canonical headers
  LOGSHEET_IMPORT_HEADERS.forEach((header, idx) => {
    const cell = sheet.getCell(2, idx + 1);
    cell.value = header;
    cell.font = HEADER_FONT;
    cell.fill = HEADER_FILL;
    cell.border = THIN_BORDER;
    cell.alignment = { vertical: "middle", horizontal: "left", wrapText: true };
  });
  sheet.getRow(2).height = 22;

  // Example rows (clearly marked; never importable)
  EXAMPLE_ROWS.forEach((example, rIdx) => {
    const rowNumber = 3 + rIdx;
    LOGSHEET_IMPORT_COLUMNS.forEach((col, cIdx) => {
      const cell = sheet.getCell(rowNumber, cIdx + 1);
      cell.value = (example[col.key] ?? null) as ExcelJS.CellValue;
      cell.font = EXAMPLE_FONT;
      cell.border = THIN_BORDER;
      applyColumnFormat(cell, col.key);
    });
    sheet.getRow(rowNumber).height = 16;
  });

  // Column widths
  const widths: Record<string, number> = {
    log_date: 13,
    operator_employee_id: 20,
    operator_name: 22,
    shift_code: 11,
    start_time: 11,
    end_time: 11,
    start_meter: 11,
    end_meter: 11,
    overtime_hours: 14,
    machine_condition: 18,
    is_breakdown: 12,
    breakdown_start_time: 15,
    breakdown_end_time: 15,
    remarks: 40,
  };
  LOGSHEET_IMPORT_COLUMNS.forEach((col, idx) => {
    sheet.getColumn(idx + 1).width = widths[col.key] || 16;
  });

  // Filters on the header row
  sheet.autoFilter = {
    from: { row: 2, column: 1 },
    to: { row: 2, column: LOGSHEET_IMPORT_HEADERS.length },
  };

  // Excel data validations over the full importable area
  const lastRow = 2 + LOGSHEET_IMPORT_MAX_ROWS;
  LOGSHEET_IMPORT_COLUMNS.forEach((col, idx) => {
    const colLetter = sheet.getColumn(idx + 1).letter;
    const range = `${colLetter}3:${colLetter}${lastRow}`;
    if (col.key === "machine_condition") {
      dataValidations(sheet).add(range, {
        type: "list",
        allowBlank: true,
        formulae: ['"good,fair,needs_attention,breakdown"'],
        showErrorMessage: true,
        errorTitle: "Invalid machine condition",
        error: "Choose good, fair, needs_attention or breakdown.",
      });
    } else if (col.key === "is_breakdown") {
      dataValidations(sheet).add(range, {
        type: "list",
        allowBlank: true,
        formulae: ['"Yes,No"'],
        showErrorMessage: true,
        errorTitle: "Invalid breakdown flag",
        error: "Choose Yes or No.",
      });
    } else if (col.type === "number") {
      dataValidations(sheet).add(range, {
        type: "decimal",
        operator: "greaterThanOrEqual",
        allowBlank: true,
        formulae: [0],
        showErrorMessage: true,
        errorTitle: "Invalid number",
        error: "Enter a non-negative number (max 2 decimal places).",
      });
    }
  });

}

function applyColumnFormat(cell: ExcelJS.Cell, key: string): void {
  switch (key) {
    case "log_date":
      cell.numFmt = "yyyy-mm-dd";
      break;
    case "start_time":
    case "end_time":
    case "breakdown_start_time":
    case "breakdown_end_time":
      cell.numFmt = "hh:mm";
      break;
    case "start_meter":
    case "end_meter":
    case "overtime_hours":
      cell.numFmt = "0.00";
      break;
    default:
      break;
  }
}

function buildInstructionsSheet(workbook: ExcelJS.Workbook): void {
  const sheet = workbook.addWorksheet(LOGSHEET_IMPORT_INSTRUCTIONS_SHEET);
  sheet.getColumn(1).width = 4;
  sheet.getColumn(2).width = 110;

  const lines: Array<{ t: "title" | "h" | "p" | "bullet"; text: string }> = [
    { t: "title", text: `Machine Logsheet Import — Instructions (Template v${LOGSHEET_IMPORT_TEMPLATE_VERSION})` },
    { t: "p", text: "This workbook lets administrators back-fill historical machine operation records that were kept on paper. Every row is validated before import — invalid data can never enter the system silently." },
    { t: "h", text: "1. How to fill the template" },
    { t: "bullet", text: "Fill records ONLY on the \"Logsheet Data\" sheet, below the header row." },
    { t: "bullet", text: `Delete the two clearly marked example rows (they contain "${LOGSHEET_IMPORT_EXAMPLE_MARKER}") before uploading.` },
    { t: "bullet", text: "Keep all three worksheets and the exact column headers unchanged." },
    { t: "bullet", text: "Do not add, rename or reorder columns. Unsupported columns block the import." },
    { t: "h", text: "2. Date and time formats" },
    { t: "bullet", text: "Log Date: YYYY-MM-DD (also accepts DD/MM/YYYY, DD-MM-YYYY, DD Mon YYYY). Must not be in the future — historical dates are allowed." },
    { t: "bullet", text: "Times: HH:MM in 24-hour format (e.g. 08:00, 20:30) or HH:MM AM/PM (e.g. 08:00 PM)." },
    { t: "bullet", text: "Overnight shifts are supported: if End Time is earlier than Start Time the shift ends the next calendar day." },
    { t: "h", text: "3. Numeric units and readings" },
    { t: "bullet", text: "Start HMR / End HMR: hour meter readings in machine-hours (non-negative, up to 2 decimals). Running hours = End HMR − Start HMR and cannot exceed 24 per log." },
    { t: "bullet", text: "Overtime Hours: optional. Leave blank to auto-calculate hours beyond 8 per shift (same rule as the manual entry form)." },
    { t: "h", text: "4. Required fields" },
    { t: "bullet", text: "Mandatory: Log Date, Operator Employee ID (or exact Operator Name), Start Time, End Time, Start HMR, End HMR." },
    { t: "bullet", text: "Optional: Shift Code (auto-derived from Start Time when blank), Overtime Hours, Machine Condition, Breakdown fields, Remarks." },
    { t: "h", text: "5. Operator identification" },
    { t: "bullet", text: "Use the Employee ID exactly as on the employee record (e.g. EMP-0338). It must match exactly one operator." },
    { t: "bullet", text: "Operator Name is a cross-check only. Partial name matches are never accepted — if the name and Employee ID disagree the row is flagged for review." },
    { t: "h", text: "6. Historical records and missing readings" },
    { t: "bullet", text: "Historical dates can be imported to back-fill paper records. Records already in the system are never overwritten." },
    { t: "bullet", text: "Missing readings are never invented or treated as zero. A row without its mandatory readings is reported as invalid and must be corrected or removed." },
    { t: "h", text: "7. Breakdowns" },
    { t: "bullet", text: "Set Breakdown? to Yes and fill both Breakdown Start and Breakdown End. The breakdown window must fit inside the shift duration." },
    { t: "h", text: "8. Common validation errors" },
    { t: "bullet", text: "Duplicate rows: the same Machine + Date + Shift (or Operator + Date + Shift) already exists or appears twice in the file. Duplicates are excluded from the import." },
    { t: "bullet", text: "Overlapping shift times: shift timelines may not overlap for the same machine or the same operator." },
    { t: "bullet", text: "End HMR less than Start HMR, running hours over 24, future dates, and unresolvable operators all block the import until corrected." },
    { t: "h", text: "9. Limits" },
    { t: "bullet", text: `Maximum ${LOGSHEET_IMPORT_MAX_ROWS} data rows and ${Math.round(LOGSHEET_IMPORT_MAX_FILE_BYTES / (1024 * 1024))}MB file size per import. Format: .xlsx only.` },
  ];

  let row = 1;
  for (const line of lines) {
    const cell = sheet.getCell(row, 2);
    cell.value = line.text;
    if (line.t === "title") {
      cell.font = { bold: true, size: 14, color: { argb: "FF171717" }, name: "Calibri" };
      row += 2;
      continue;
    }
    if (line.t === "h") {
      cell.font = { bold: true, size: 11, color: { argb: "FF0284C7" }, name: "Calibri" };
    } else if (line.t === "bullet") {
      cell.value = `• ${line.text}`;
      cell.font = { size: 10, color: { argb: "FF404040" }, name: "Calibri" };
    } else {
      cell.font = { size: 10, color: { argb: "FF404040" }, name: "Calibri" };
    }
    cell.alignment = { wrapText: true, vertical: "top" };
    row += 1;
  }
}

function buildDictionarySheet(workbook: ExcelJS.Workbook): void {
  const sheet = workbook.addWorksheet(LOGSHEET_IMPORT_DICTIONARY_SHEET);
  const headers = [
    "Column Name",
    "Description",
    "Required",
    "Data Type",
    "Accepted Format",
    "Validation Rule",
    "Example",
  ];
  const widths = [22, 45, 14, 12, 42, 60, 22];
  headers.forEach((h, idx) => {
    const cell = sheet.getCell(1, idx + 1);
    cell.value = h;
    cell.font = HEADER_FONT;
    cell.fill = HEADER_FILL;
    cell.border = THIN_BORDER;
    sheet.getColumn(idx + 1).width = widths[idx];
  });

  LOGSHEET_IMPORT_COLUMNS.forEach((col, rIdx) => {
    const row = sheet.getRow(rIdx + 2);
    const requiredLabel = col.conditionallyRequired
      ? "Conditional"
      : col.required
        ? "Mandatory"
        : "Optional";
    const values = [
      col.header,
      col.description,
      requiredLabel,
      col.type,
      col.format,
      col.validationRule,
      col.example,
    ];
    values.forEach((v, cIdx) => {
      const cell = row.getCell(cIdx + 1);
      cell.value = v;
      cell.border = THIN_BORDER;
      cell.font = { size: 10, name: "Calibri" };
      cell.alignment = { wrapText: true, vertical: "top" };
    });
    row.height = 42;
  });
}

export async function buildLogsheetImportTemplate(): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Reach International";
  workbook.created = new Date();
  buildDataSheet(workbook);
  buildInstructionsSheet(workbook);
  buildDictionarySheet(workbook);
  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}
