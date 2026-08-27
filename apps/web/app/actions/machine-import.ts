"use server";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { logAudit } from "@/lib/audit";
import { TAGS } from "@/lib/cache";
import { requireRole } from "@/lib/dal";
import { revalidateTag } from "next/cache";
import * as XLSX from "xlsx";
import { formatMachineDatabaseError } from "@/lib/utils/machine-errors";

export interface BulkImportResult {
  success: number;
  failed: number;
  errors: Array<{ row: number; reason: string }>;
}

export async function importMachinesFromExcel(formData: FormData): Promise<BulkImportResult> {
  await requireRole("admin", "super_admin");
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("Unauthorized.");
  }

  const file = formData.get("excel_file") as File;
  if (!file) {
    throw new Error("No file uploaded.");
  }

  // SECURITY (F07): Validate file size boundary (Max 10MB) and non-empty content
  const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10MB
  if (file.size <= 0) {
    throw new Error("Uploaded file is empty.");
  }
  if (file.size > MAX_FILE_SIZE_BYTES) {
    throw new Error("File size exceeds 10MB limit. Please upload a smaller spreadsheet.");
  }

  // SECURITY (F07): Validate file extension allowlist
  const fileName = (file.name || "").toLowerCase();
  const allowedExtensions = [".xlsx", ".xls", ".csv"];
  const hasValidExtension = allowedExtensions.some((ext) => fileName.endsWith(ext));
  if (!hasValidExtension) {
    throw new Error("Invalid file type. Please upload a valid Excel (.xlsx, .xls) or CSV (.csv) spreadsheet.");
  }

  // SECURITY (F07): Validate MIME type allowlist
  const allowedMimeTypes = [
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "application/vnd.ms-excel",
    "text/csv",
    "application/csv",
    "text/plain",
    "application/octet-stream",
  ];
  if (file.type && !allowedMimeTypes.includes(file.type.toLowerCase())) {
    throw new Error("Invalid MIME type for spreadsheet file.");
  }

  // Read Excel file
  const buffer = Buffer.from(await file.arrayBuffer());
  const workbook = XLSX.read(buffer, { type: "buffer" });
  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];
  const rows: unknown[][] = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as unknown[][];

  if (rows.length < 2) {
    throw new Error("Excel file is empty or has no data rows.");
  }

  // Expected headers (first row)
  const headers = rows[0].map((h) => String(h ?? "").trim().toLowerCase());
  
  // Map header variations
  const headerMap: Record<string, string> = {
    "machine id": "machine_id",
    "machine_id": "machine_id",
    "id": "machine_id",
    "code": "machine_id",
    "machine code": "machine_id",
    "model": "model",
    "model number": "model",
    "machine name": "model",
    "name": "model",
    "serial no": "serial_number",
    "serial_number": "serial_number",
    "serial number": "serial_number",
    "serial": "serial_number",
    "serial_no": "serial_number",
    "yum": "year_of_mfg",
    "year of mfg": "year_of_mfg",
    "year_of_mfg": "year_of_mfg",
    "year": "year_of_mfg",
    "manufacturing year": "year_of_mfg",
    "manufacturer": "manufacturer",
    "mfg": "manufacturer",
    "make": "manufacturer",
    "brand": "manufacturer",
    "hmr": "hour_meter",
    "hour meter": "hour_meter",
    "hour_meter": "hour_meter",
    "hour meter (hmr)": "hour_meter",
    "hour meter reading (hmr)": "hour_meter",
    "hours": "hour_meter",
    "service count": "service_count",
    "service_count": "service_count",
    "services": "service_count",
    "total services": "service_count",
    "health status": "health_status",
    "health_status": "health_status",
    "health": "health_status",
    "status": "status",
    "machine status": "status",
  };

  const mappedHeaders = headers.map((h) => headerMap[h] || h);

  const getColIndex = (colName: string) => mappedHeaders.indexOf(colName);

  const colMachineId = getColIndex("machine_id");
  const colModel = getColIndex("model");
  const colSerialNumber = getColIndex("serial_number");
  const colYearOfMfg = getColIndex("year_of_mfg");
  const colManufacturer = getColIndex("manufacturer");
  const colHourMeter = getColIndex("hour_meter");
  const colServiceCount = getColIndex("service_count");
  const colHealthStatus = getColIndex("health_status");
  const colStatus = getColIndex("status");

  const result: BulkImportResult = {
    success: 0,
    failed: 0,
    errors: [],
  };

  // Process each data row (skip header)
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    const rowNum = i + 1;

    try {
      const machineIdVal = colMachineId >= 0 ? String(row[colMachineId] || "").trim() : "";
      const model = colModel >= 0 ? String(row[colModel] || "").trim() : "";
      const serialNumber = colSerialNumber >= 0 ? String(row[colSerialNumber] || "").trim() : "";
      const yearOfMfg = colYearOfMfg >= 0 ? String(row[colYearOfMfg] || "").trim() : "";
      const manufacturer = colManufacturer >= 0 ? String(row[colManufacturer] || "").trim() : "";
      const hourMeter = colHourMeter >= 0 ? parseFloat(String(row[colHourMeter] || "0")) || 0 : 0;
      const serviceCount = colServiceCount >= 0 ? parseInt(String(row[colServiceCount] || "0"), 10) || 0 : 0;
      
      const rawHealthStatus = colHealthStatus >= 0
        ? String(row[colHealthStatus] || "").trim().toLowerCase().replace(/[\s-]+/g, "_")
        : "active";
      
      const rawStatus = colStatus >= 0
        ? String(row[colStatus] || "").trim().toLowerCase().replace(/[\s-]+/g, "_")
        : "available";

      let healthStatus = "active";
      if (["active", "under_maintenance", "breakdown"].includes(rawHealthStatus)) {
        healthStatus = rawHealthStatus;
      } else if (rawHealthStatus === "maintenance") {
        healthStatus = "under_maintenance";
      }

      let status = "available";
      if (["available", "rented"].includes(rawStatus)) {
        status = rawStatus;
      } else if (["on_rent", "in_use", "rent"].includes(rawStatus)) {
        status = "rented";
      } else if (["idle", "free"].includes(rawStatus)) {
        status = "available";
      }

      const insertPayload: Record<string, any> = {
        model: model || null,
        serial_number: serialNumber || null,
        year_of_mfg: yearOfMfg || null,
        manufacturer: manufacturer || null,
        hour_meter: hourMeter,
        service_count: serviceCount,
        health_status: healthStatus,
        status,
        created_by: user.id,
      };

      if (machineIdVal) {
        insertPayload.machine_id = machineIdVal;
      }

      const { error } = await supabase.from("machines").insert(insertPayload);

      if (error) {
        result.failed++;
        const formatted = formatMachineDatabaseError(error);
        result.errors.push({ row: rowNum, reason: formatted.error });
      } else {
        result.success++;
      }
    } catch (err: unknown) {
      result.failed++;
      const rawMsg = err instanceof Error ? err.message : "Unknown error";
      const friendlyReason = rawMsg.includes("row-level security")
        ? "Permission denied: Account role unauthorized to add machines."
        : rawMsg;
      result.errors.push({ row: rowNum, reason: friendlyReason });
    }
  }

  await logAudit({
    action: "machine.bulk_import",
    entity_type: "machine",
    metadata: {
      total_rows: rows.length - 1,
      success: result.success,
      failed: result.failed,
    },
  });

  revalidateTag(TAGS.machines, "max");
  revalidateTag(TAGS.machinesMeta, "max");
  revalidateTag(TAGS.dashboardKpis, "max");

  return result;
}
