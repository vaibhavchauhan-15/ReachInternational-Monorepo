"use server";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { logAudit } from "@/lib/audit";
import { CACHE_TAGS } from "@/lib/cache";
import { requireRole } from "@/lib/dal";
import { revalidateTag } from "next/cache";
import * as XLSX from "xlsx";

export interface BulkImportResult {
  success: number;
  failed: number;
  errors: Array<{ row: number; reason: string }>;
}

function normalizeIndianPhone(input: string): { phone: string; isValid: boolean } {
  if (!input) return { phone: "", isValid: false };
  const cleaned = input.trim().replace(/\s+/g, "");
  if (/^[6-9]\d{9}$/.test(cleaned)) {
    return { phone: `+91${cleaned}`, isValid: true };
  }
  if (/^\+91[6-9]\d{9}$/.test(cleaned)) {
    return { phone: cleaned, isValid: true };
  }
  if (/^\+?[0-9]{10,15}$/.test(cleaned)) {
    return { phone: cleaned, isValid: true };
  }
  return { phone: cleaned, isValid: false };
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
  
  // Map common header variations
  const headerMap: Record<string, string> = {
    "machine name": "machine_name",
    "name": "machine_name",
    "model": "model",
    "model number": "model",
    "customer name": "customer_name",
    "client name": "customer_name",
    "company": "customer_name",
    "customer mobile": "customer_mobile",
    "mobile": "customer_mobile",
    "phone": "customer_mobile",
    "contact": "customer_mobile",
    "customer email": "customer_email",
    "email": "customer_email",
    "city": "city",
    "state": "state",
    "address": "customer_address",
    "customer address": "customer_address",
    "site address": "customer_address",
    "engineer": "engineer_name",
    "assigned engineer": "engineer_name",
    "field engineer": "engineer_name",
    "service interval": "service_interval_days",
    "interval": "service_interval_days",
    "days": "service_interval_days",
    "service interval days": "service_interval_days",
    "notes": "notes",
    "additional notes": "notes",
    "technical specs": "notes",
  };

  const mappedHeaders = headers.map((h) => headerMap[h] || h);

  // Validate required columns
  const requiredColumns = ["machine_name", "customer_name", "customer_mobile", "city", "state"];
  const missingColumns = requiredColumns.filter((col) => !mappedHeaders.includes(col));
  if (missingColumns.length > 0) {
    throw new Error(`Missing required columns: ${missingColumns.join(", ")}`);
  }

  // Get column indices
  const getColIndex = (colName: string) => mappedHeaders.indexOf(colName);

  const colMachineName = getColIndex("machine_name");
  const colModel = getColIndex("model");
  const colCustomerName = getColIndex("customer_name");
  const colCustomerMobile = getColIndex("customer_mobile");
  const colCustomerEmail = getColIndex("customer_email");
  const colCity = getColIndex("city");
  const colState = getColIndex("state");
  const colAddress = getColIndex("customer_address");
  const colEngineer = getColIndex("engineer_name");
  const colInterval = getColIndex("service_interval_days");
  const colNotes = getColIndex("notes");

  // Fetch all active engineers for name/email matching
  const { data: engineers } = await supabase
    .from("users")
    .select("id, full_name, email")
    .eq("role", "engineer")
    .eq("status", "active");

  const engineerMapByName = new Map(
    (engineers || []).map((e) => [e.full_name.toLowerCase().trim(), e.id])
  );

  const engineerMapByEmail = new Map(
    (engineers || []).map((e) => [e.email.toLowerCase().trim(), e.id])
  );

  const result: BulkImportResult = {
    success: 0,
    failed: 0,
    errors: [],
  };

  const now = new Date();

  // Process each data row (skip header)
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    const rowNum = i + 1; // Excel row number (1-based, header is row 1)

    try {
      const machineName = String(row[colMachineName] || "").trim();
      const customerName = String(row[colCustomerName] || "").trim();
      const rawMobile = String(row[colCustomerMobile] || "").trim();
      const city = String(row[colCity] || "").trim();
      const state = String(row[colState] || "").trim();

      // Validate required fields
      if (!machineName) {
        result.failed++;
        result.errors.push({ row: rowNum, reason: "Machine name is required" });
        continue;
      }
      if (!customerName) {
        result.failed++;
        result.errors.push({ row: rowNum, reason: "Customer name is required" });
        continue;
      }
      if (!rawMobile) {
        result.failed++;
        result.errors.push({ row: rowNum, reason: "Customer mobile is required" });
        continue;
      }
      if (!city) {
        result.failed++;
        result.errors.push({ row: rowNum, reason: "City is required" });
        continue;
      }
      if (!state) {
        result.failed++;
        result.errors.push({ row: rowNum, reason: "State is required" });
        continue;
      }

      // Normalize phone
      const phoneRes = normalizeIndianPhone(rawMobile);
      if (!phoneRes.isValid) {
        result.failed++;
        result.errors.push({ row: rowNum, reason: "Invalid mobile number" });
        continue;
      }

      // Parse optional fields
      const model = colModel >= 0 ? String(row[colModel] || "").trim() : "";
      const customerEmail = colCustomerEmail >= 0 ? String(row[colCustomerEmail] || "").trim() : "";
      const customerAddress = colAddress >= 0 ? String(row[colAddress] || "").trim() : "";
      const notes = colNotes >= 0 ? String(row[colNotes] || "").trim() : "";

      // Engineer name/email to ID
      let engineerId: string | null = null;
      if (colEngineer >= 0) {
        const engineerValue = String(row[colEngineer] || "").trim();
        if (engineerValue) {
          engineerId =
            engineerMapByName.get(engineerValue.toLowerCase()) ||
            engineerMapByEmail.get(engineerValue.toLowerCase()) ||
            null;
          if (!engineerId) {
            result.failed++;
            result.errors.push({ row: rowNum, reason: `Engineer "${engineerValue}" not found` });
            continue;
          }
        }
      }

      // Service interval
      let serviceInterval = 90;
      if (colInterval >= 0) {
        const intervalVal = Number(row[colInterval]);
        if (!isNaN(intervalVal) && intervalVal > 0) {
          serviceInterval = intervalVal;
        }
      }

      // Calculate next due date
      const nextDue = new Date(now.getTime() + serviceInterval * 86400000);
      const nextDueStr = nextDue.toISOString().split("T")[0];

      // Generate machine code
      const machineCode = `MCH-${Math.floor(100000 + Math.random() * 900000)}`;

      // Insert machine
      const { error } = await supabase
        .from("machines")
        .insert({
          machine_code: machineCode,
          machine_name: machineName,
          model: model || null,
          customer_name: customerName,
          customer_mobile: phoneRes.phone,
          customer_email: customerEmail || null,
          customer_address: customerAddress || null,
          city,
          state,
          engineer_id: engineerId,
          last_service_date: null,
          next_service_due_date: nextDueStr,
          service_interval_days: serviceInterval,
          status: "active",
          notes: notes || null,
          created_by: user.id,
        });

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

  // Log audit
  await logAudit({
    action: "machine.bulk_import",
    entity_type: "machine",
    metadata: {
      total_rows: rows.length - 1,
      success: result.success,
      failed: result.failed,
    },
  });

  // Revalidate caches
  revalidateTag(CACHE_TAGS.machines, "max");
  revalidateTag(CACHE_TAGS.machineMeta, "max");
  revalidateTag(CACHE_TAGS.dashboard, "max");

  return result;
}
