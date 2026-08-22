"use server";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { logAudit } from "@/lib/audit";
import { TAGS } from "@/lib/cache";
import { requireRole } from "@/lib/dal";
import { revalidateTag } from "next/cache";
import * as XLSX from "xlsx";

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
    "serial no": "serial_number",
    "serial_number": "serial_number",
    "serial number": "serial_number",
    "yum": "year_of_mfg",
    "year of mfg": "year_of_mfg",
    "year_of_mfg": "year_of_mfg",
    "year": "year_of_mfg",
    "manufacturer": "manufacturer",
    "mfg": "manufacturer",
    "make": "manufacturer",
    "hmr": "hour_meter",
    "hour meter": "hour_meter",
    "hour_meter": "hour_meter",
    "service count": "service_count",
    "health status": "health_status",
    "status": "status",
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
      const rawHealthStatus = colHealthStatus >= 0 ? String(row[colHealthStatus] || "").trim().toLowerCase() : "active";
      const rawStatus = colStatus >= 0 ? String(row[colStatus] || "").trim().toLowerCase() : "available";

      const healthStatus = ["active", "under_maintenance", "breakdown"].includes(rawHealthStatus)
        ? rawHealthStatus
        : "active";
      const status = ["available", "rented"].includes(rawStatus)
        ? rawStatus
        : "available";

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
        result.errors.push({ row: rowNum, reason: error.message });
      } else {
        result.success++;
      }
    } catch (err: unknown) {
      result.failed++;
      const errorMsg = err instanceof Error ? err.message : "Unknown error";
      result.errors.push({ row: rowNum, reason: errorMsg });
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
