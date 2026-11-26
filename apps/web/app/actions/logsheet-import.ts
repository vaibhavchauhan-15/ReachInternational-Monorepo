"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { createHash } from "node:crypto";
import { sanitizeUserErrorMessage } from "@reachinternational/utils";
import {
  LOGSHEET_IMPORT_MAX_FILE_BYTES,
  LOGSHEET_IMPORT_TEMPLATE_VERSION,
} from "@reachinternational/validation";
import {
  MACHINE_CAPABILITIES,
  isMachineForbiddenError,
  requireMachineCapability,
} from "@/lib/machines/authorization";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { logAudit } from "@/lib/audit";
import { TAGS } from "@/lib/cache";
import {
  runLogsheetImportValidation,
  emptySummary,
} from "@/lib/server/logsheet-import/validate";
import type {
  LogsheetImportHistoryItem,
  LogsheetImportPreview,
  LogsheetImportResult,
} from "@/lib/server/logsheet-import/types";

/**
 * Admin-only bulk machine logsheet (operation log) Excel import.
 *
 * Security: every action re-verifies the caller's real role server-side via
 * `requireMachineCapability(MACHINE_CAPABILITIES.LOGS_IMPORT)` (super_admin /
 * admin only), the machine is resolved server-side, operator identities are
 * resolved server-side from exact employee records, and the database RPC
 * (`import_machine_hour_logs_bulk`) re-checks the caller role again. Excel
 * values are never trusted as database identifiers.
 */

const MAX_FILE_BYTES = LOGSHEET_IMPORT_MAX_FILE_BYTES;

function forbiddenPreview(): LogsheetImportPreview {
  return {
    ok: false,
    machineId: "",
    machineLabel: "",
    filename: "",
    fileSize: 0,
    fileChecksum: "",
    templateVersion: LOGSHEET_IMPORT_TEMPLATE_VERSION,
    rows: [],
    summary: emptySummary(),
    structuralIssues: [],
    blocked: true,
    maxRows: 0,
    error: "Forbidden: your account role is not authorized to import machine logsheets.",
  };
}

function forbiddenResult(): LogsheetImportResult {
  return {
    success: false,
    importedRows: 0,
    skippedDuplicates: 0,
    rejectedRows: 0,
    totalRunningHours: 0,
    insertedLogIds: [],
    durationMs: 0,
    error: "Forbidden: your account role is not authorized to import machine logsheets.",
  };
}

async function readUpload(
  formData: FormData
): Promise<{ buffer: Buffer; filename: string; error?: string }> {
  const file = formData.get("excel_file");
  if (!(file instanceof File)) {
    return { buffer: Buffer.alloc(0), filename: "", error: "No file uploaded." };
  }
  if (file.size <= 0) {
    return { buffer: Buffer.alloc(0), filename: file.name || "", error: "The uploaded file is empty." };
  }
  if (file.size > MAX_FILE_BYTES) {
    return {
      buffer: Buffer.alloc(0),
      filename: file.name || "",
      error: `The file exceeds the ${Math.round(MAX_FILE_BYTES / (1024 * 1024))}MB upload limit.`,
    };
  }
  const buffer = Buffer.from(await file.arrayBuffer());
  return { buffer, filename: file.name || "upload.xlsx" };
}

/**
 * Step: parse + validate the uploaded workbook against the selected machine.
 * READ-ONLY — nothing is inserted. Returns the full interactive preview.
 */
export async function validateLogsheetImportAction(
  formData: FormData
): Promise<LogsheetImportPreview> {
  try {
    await requireMachineCapability(MACHINE_CAPABILITIES.LOGS_IMPORT);
  } catch (err) {
    if (isMachineForbiddenError(err)) return forbiddenPreview();
    throw err;
  }

  const machineId = String(formData.get("machine_id") || "").trim();
  if (!machineId) {
    return { ...forbiddenPreview(), error: "Please select a machine before uploading." };
  }

  const { buffer, filename, error: readError } = await readUpload(formData);
  if (readError) {
    return { ...forbiddenPreview(), machineId, filename, error: readError };
  }

  try {
    const { preview } = await runLogsheetImportValidation(machineId, buffer, filename, buffer.length);
    return preview;
  } catch (err) {
    return {
      ...forbiddenPreview(),
      machineId,
      filename,
      error: sanitizeUserErrorMessage(err, "Validation failed. Please check the file and try again."),
    };
  }
}

/**
 * Final step: re-validate the uploaded workbook end-to-end and atomically import
 * every ready row via the `import_machine_hour_logs_bulk` RPC (single database
 * transaction). Committed records are verified by their IDs before success is
 * reported. Retries with the same import token are idempotent.
 */
export async function importLogsheetAction(
  formData: FormData
): Promise<LogsheetImportResult> {
  const startedAt = Date.now();
  try {
    await requireMachineCapability(MACHINE_CAPABILITIES.LOGS_IMPORT);
  } catch (err) {
    if (isMachineForbiddenError(err)) return forbiddenResult();
    throw err;
  }

  const machineId = String(formData.get("machine_id") || "").trim();
  const importToken = String(formData.get("import_token") || "").trim();
  const expectedChecksum = String(formData.get("expected_checksum") || "").trim().toLowerCase();

  if (!machineId) {
    return { ...forbiddenResult(), error: "Please select a machine before importing." };
  }
  if (!/^[A-Za-z0-9-]{8,120}$/.test(importToken)) {
    return { ...forbiddenResult(), error: "Missing or invalid import reference. Please re-validate the file." };
  }

  const { buffer, filename, error: readError } = await readUpload(formData);
  if (readError) {
    return { ...forbiddenResult(), error: readError };
  }

  // Re-run the COMPLETE validation pipeline on the exact uploaded file.
  let preview: LogsheetImportPreview;
  let plan: Awaited<ReturnType<typeof runLogsheetImportValidation>>["plan"];
  try {
    const validation = await runLogsheetImportValidation(machineId, buffer, filename, buffer.length);
    preview = validation.preview;
    plan = validation.plan;
  } catch (err) {
    return {
      ...forbiddenResult(),
      error: sanitizeUserErrorMessage(err, "Validation failed. Please check the file and try again."),
    };
  }

  if (preview.blocked || !plan) {
    return {
      success: false,
      importedRows: 0,
      skippedDuplicates: preview.summary.duplicateRows,
      rejectedRows: preview.summary.invalidRows + preview.summary.reviewRows,
      totalRunningHours: 0,
      insertedLogIds: [],
      durationMs: Date.now() - startedAt,
      error: "The import is blocked: correct the highlighted rows and upload the file again.",
      preview,
    };
  }

  // The file must be the one the administrator previewed (checksum binding).
  if (expectedChecksum && plan.fileChecksum !== expectedChecksum) {
    return {
      success: false,
      importedRows: 0,
      skippedDuplicates: preview.summary.duplicateRows,
      rejectedRows: preview.summary.invalidRows + preview.summary.reviewRows,
      totalRunningHours: 0,
      insertedLogIds: [],
      durationMs: Date.now() - startedAt,
      error: "The uploaded file changed after validation. Please run validation again before importing.",
      preview,
    };
  }

  if (plan.rpcRows.length === 0) {
    return {
      success: false,
      importedRows: 0,
      skippedDuplicates: preview.summary.duplicateRows,
      rejectedRows: preview.summary.invalidRows + preview.summary.reviewRows,
      totalRunningHours: 0,
      insertedLogIds: [],
      durationMs: Date.now() - startedAt,
      error: "There are no importable records in the file (every row is invalid or a duplicate).",
      preview,
    };
  }

  // Atomic import via the admin-gated SECURITY DEFINER RPC (user session, so the
  // database re-verifies the caller's real role through auth.uid()).
  const supabase = await createSupabaseServerClient();
  const { data: rpcData, error: rpcError } = await supabase.rpc("import_machine_hour_logs_bulk", {
    p_import: {
      import_token: importToken,
      machine_id: plan.machine.id,
      filename: plan.filename.slice(0, 255),
      file_checksum: plan.fileChecksum.slice(0, 128),
      template_version: plan.templateVersion.slice(0, 20),
      total_file_rows: preview.summary.totalRows,
      skipped_duplicates: preview.summary.duplicateRows,
      rejected_rows: preview.summary.invalidRows + preview.summary.reviewRows,
      rows: plan.rpcRows,
    },
  });

  if (rpcError) {
    return {
      success: false,
      importedRows: 0,
      skippedDuplicates: preview.summary.duplicateRows,
      rejectedRows: preview.summary.invalidRows + preview.summary.reviewRows,
      totalRunningHours: 0,
      insertedLogIds: [],
      durationMs: Date.now() - startedAt,
      error: sanitizeUserErrorMessage(
        rpcError,
        "The import could not be completed. No records were inserted."
      ),
      preview,
    };
  }

  const result = (rpcData || {}) as {
    success?: boolean;
    already_imported?: boolean;
    import_id?: string;
    imported_rows?: number;
    inserted_log_ids?: string[];
    total_running_hours?: number | string;
  };

  const insertedLogIds = Array.isArray(result.inserted_log_ids)
    ? result.inserted_log_ids.filter((id): id is string => typeof id === "string")
    : [];

  // Verify the committed records in the database before reporting success.
  const admin = createSupabaseAdminClient();
  const { data: committed, error: verifyError } = await admin
    .from("machine_hour_logs")
    .select("id, machine_id, running_hours")
    .in("id", insertedLogIds.length > 0 ? insertedLogIds : ["00000000-0000-0000-0000-000000000000"]);

  const committedRows = (committed || []) as Array<{ id: string; machine_id: string }>;
  const verifiedAll =
    !verifyError &&
    committedRows.length === insertedLogIds.length &&
    committedRows.every((r) => r.machine_id === plan!.machine.id);

  const importedRows = Number(result.imported_rows ?? plan.rpcRows.length) || 0;
  const totalRunningHours = Math.round(Number(result.total_running_hours ?? 0) * 100) / 100;
  const durationMs = Date.now() - startedAt;

  if (!verifiedAll) {
    return {
      success: false,
      alreadyImported: Boolean(result.already_imported),
      importId: result.import_id,
      machineId: plan.machine.id,
      machineLabel: plan.machineLabel,
      filename: plan.filename,
      importedRows,
      skippedDuplicates: preview.summary.duplicateRows,
      rejectedRows: preview.summary.invalidRows + preview.summary.reviewRows,
      totalRunningHours,
      insertedLogIds,
      durationMs,
      error: `Import verification failed: ${committedRows.length} of ${insertedLogIds.length} committed records were confirmed. Do not re-run the import — contact support with reference ${result.import_id || "unknown"}.`,
      preview,
    };
  }

  // Audit trail (existing audit log system + dedicated import history record).
  await logAudit({
    action: "machine.logsheet_import",
    entity_type: "machine",
    entity_id: plan.machine.id,
    metadata: {
      importId: result.import_id,
      importToken,
      machineLabel: plan.machineLabel,
      filename: plan.filename,
      fileChecksum: plan.fileChecksum,
      templateVersion: plan.templateVersion,
      totalRows: preview.summary.totalRows,
      importedRows,
      skippedDuplicates: preview.summary.duplicateRows,
      rejectedRows: preview.summary.invalidRows + preview.summary.reviewRows,
      totalRunningHours,
      alreadyImported: Boolean(result.already_imported),
      durationMs,
    },
    severity: "warning",
  });

  revalidateTag(TAGS.operationsLogs, "max");
  revalidateTag(TAGS.operations, "max");
  revalidateTag(TAGS.todayShiftMonitor, "max");
  revalidateTag(TAGS.machines, "max");
  revalidateTag(TAGS.dashboard, "max");
  revalidateTag(TAGS.hourLogs, "max");
  revalidateTag(TAGS.machineOperations(plan.machine.id), "max");
  revalidatePath("/operations");
  revalidatePath("/running-logs");
  revalidatePath("/dashboard");

  return {
    success: true,
    alreadyImported: Boolean(result.already_imported),
    importId: result.import_id,
    machineId: plan.machine.id,
    machineLabel: plan.machineLabel,
    filename: plan.filename,
    importedRows,
    skippedDuplicates: preview.summary.duplicateRows,
    rejectedRows: preview.summary.invalidRows + preview.summary.reviewRows,
    totalRunningHours,
    insertedLogIds,
    durationMs,
  };
}

/**
 * Import history for the machine logsheet importer (admin-only).
 */
export async function getLogsheetImportHistoryAction(
  machineId?: string
): Promise<LogsheetImportHistoryItem[]> {
  try {
    await requireMachineCapability(MACHINE_CAPABILITIES.LOGS_IMPORT);
  } catch (err) {
    if (isMachineForbiddenError(err)) return [];
    throw err;
  }

  const supabase = createSupabaseAdminClient();
  let query = supabase
    .from("machine_log_imports")
    .select(
      "id, import_token, machine_id, filename, template_version, total_rows, imported_rows, skipped_duplicates, rejected_rows, total_running_hours, status, processing_duration_ms, created_at, machines(machine_id, machine_name), users(full_name, employee_id)"
    )
    .order("created_at", { ascending: false })
    .limit(20);

  if (machineId) {
    query = query.eq("machine_id", machineId);
  }

  const { data, error } = await query;
  if (error || !data) return [];

  return (data as unknown as Array<Record<string, unknown>>).map((row) => {
    const machine = row.machines as { machine_id?: string; machine_name?: string } | null;
    const admin = row.users as { full_name?: string; employee_id?: string } | null;
    return {
      id: String(row.id),
      importToken: String(row.import_token),
      machineId: String(row.machine_id),
      machineLabel:
        machine?.machine_id || machine?.machine_name
          ? `${machine.machine_id || ""}${machine.machine_name ? ` — ${machine.machine_name}` : ""}`
          : "—",
      adminName: admin?.full_name || "—",
      filename: (row.filename as string | null) ?? null,
      templateVersion: (row.template_version as string | null) ?? null,
      totalRows: Number(row.total_rows) || 0,
      importedRows: Number(row.imported_rows) || 0,
      skippedDuplicates: Number(row.skipped_duplicates) || 0,
      rejectedRows: Number(row.rejected_rows) || 0,
      totalRunningHours: Number(row.total_running_hours) || 0,
      status: String(row.status),
      processingDurationMs: (row.processing_duration_ms as number | null) ?? null,
      createdAt: String(row.created_at),
    };
  });
}

/** Machine options for the import wizard (admin-only, explicit column projection). */
export async function getLogsheetImportMachinesAction(): Promise<
  Array<{ id: string; machine_id: string | null; machine_name: string | null; model: string | null; status: string | null; health_status: string | null }>
> {
  try {
    await requireMachineCapability(MACHINE_CAPABILITIES.LOGS_IMPORT);
  } catch (err) {
    if (isMachineForbiddenError(err)) return [];
    throw err;
  }

  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("machines")
    .select("id, machine_id, machine_name, model, status, health_status")
    .order("machine_id", { ascending: true })
    .limit(500);
  if (error || !data) return [];
  return data as Array<{
    id: string;
    machine_id: string | null;
    machine_name: string | null;
    model: string | null;
    status: string | null;
    health_status: string | null;
  }>;
}

/** SHA-256 helper used by tests and diagnostics (never exposes raw file bytes). */
export async function checksumLogsheetFileAction(formData: FormData): Promise<string> {
  try {
    await requireMachineCapability(MACHINE_CAPABILITIES.LOGS_IMPORT);
  } catch (err) {
    if (isMachineForbiddenError(err)) return "";
    throw err;
  }
  const { buffer, error } = await readUpload(formData);
  if (error) return "";
  return createHash("sha256").update(buffer).digest("hex");
}
