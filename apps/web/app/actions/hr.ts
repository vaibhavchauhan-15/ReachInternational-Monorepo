"use server";

import { revalidateTag } from "next/cache";
import { getCurrentUser, requirePermission } from "@/lib/dal";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { CACHE_TAGS } from "@/lib/cache";
import { logAudit } from "@/lib/audit";
import type { EmploymentType, EmployeeStatus, UserRole } from "@/lib/types/database";

export async function getEmployeesAction() {
  await requirePermission("employee.view");
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("employees")
    .select("*, branch:branches(id, code, name), user:users(id, email, role)")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Error fetching employees:", error);
    return { success: false, error: error.message, data: [] };
  }

  return { success: true, data };
}

export async function createEmployeeAction(payload: {
  fullName: string;
  phone?: string;
  email?: string;
  designation: string;
  department?: string;
  branchId?: string;
  userId?: string;
  reportingManagerId?: string;
  joiningDate?: string;
  employmentType?: EmploymentType;
  status?: EmployeeStatus;
  salary?: number;
  fixedComponent?: number;
  variableComponent?: number;
  ctc?: number;
  bankName?: string;
  accountNumber?: string;
  ifscCode?: string;
}) {
  const hrUser = await requirePermission("employee.create");
  const supabase = createSupabaseAdminClient();

  const empCode = `EMP-${Math.floor(1000 + Math.random() * 9000)}`;
  const status = payload.status || "active";

  const { data, error } = await supabase
    .from("employees")
    .insert({
      employee_code: empCode,
      full_name: payload.fullName.trim(),
      phone: payload.phone || null,
      email: payload.email || null,
      designation: payload.designation.trim(),
      department: payload.department || null,
      branch_id: payload.branchId || null,
      user_id: payload.userId || null,
      reporting_manager_id: payload.reportingManagerId || null,
      joining_date: payload.joiningDate || new Date().toISOString().split("T")[0],
      employment_type: payload.employmentType || "full_time",
      salary: payload.salary || null,
      bank_name: payload.bankName || null,
      account_number: payload.accountNumber || null,
      ifsc_code: payload.ifscCode || null,
      status,
    })
    .select()
    .single();

  if (error) {
    console.error("Error creating employee:", error);
    return { success: false, error: error.message };
  }

  // If salary is provided, create initial salary history record
  if (payload.salary && payload.salary > 0) {
    await supabase.from("employee_salary_history").insert({
      employee_id: data.id,
      salary: payload.salary,
      fixed_component: payload.fixedComponent || payload.salary,
      variable_component: payload.variableComponent || 0,
      ctc: payload.ctc || payload.salary * 12,
      effective_date: payload.joiningDate || new Date().toISOString().split("T")[0],
      notes: "Initial salary record upon onboarding",
      created_by: hrUser.id,
    });
  }

  await logAudit({
    user_id: hrUser.id,
    action: "employee.created",
    entity_type: "employee",
    entity_id: data.id,
    metadata: { empCode, fullName: data.full_name, designation: data.designation, status },
  });

  revalidateTag(CACHE_TAGS.users, "max");
  return { success: true, data };
}

export async function updateEmployeeAction(payload: {
  id: string;
  fullName: string;
  phone?: string;
  email?: string;
  designation: string;
  department?: string;
  branchId?: string;
  reportingManagerId?: string;
  joiningDate?: string;
  employmentType?: EmploymentType;
  bankName?: string;
  accountNumber?: string;
  ifscCode?: string;
}) {
  const hrUser = await requirePermission("employee.edit");
  const supabase = createSupabaseAdminClient();

  const { data, error } = await supabase
    .from("employees")
    .update({
      full_name: payload.fullName.trim(),
      phone: payload.phone || null,
      email: payload.email || null,
      designation: payload.designation.trim(),
      department: payload.department || null,
      branch_id: payload.branchId || null,
      reporting_manager_id: payload.reportingManagerId || null,
      joining_date: payload.joiningDate,
      employment_type: payload.employmentType,
      bank_name: payload.bankName || null,
      account_number: payload.accountNumber || null,
      ifsc_code: payload.ifscCode || null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", payload.id)
    .select()
    .single();

  if (error) {
    console.error("Error updating employee:", error);
    return { success: false, error: error.message };
  }

  await logAudit({
    user_id: hrUser.id,
    action: "employee.updated",
    entity_type: "employee",
    entity_id: data.id,
    metadata: { fullName: data.full_name, designation: data.designation },
  });

  revalidateTag(CACHE_TAGS.users, "max");
  return { success: true, data };
}

export async function changeEmployeeStatusAction(payload: {
  employeeId: string;
  status: EmployeeStatus;
  notes?: string;
}) {
  const hrUser = await requirePermission("employee.status_change");
  const supabase = createSupabaseAdminClient();

  const { data, error } = await supabase
    .from("employees")
    .update({
      status: payload.status,
      updated_at: new Date().toISOString(),
    })
    .eq("id", payload.employeeId)
    .select()
    .single();

  if (error) {
    console.error("Error changing employee status:", error);
    return { success: false, error: error.message };
  }

  await logAudit({
    user_id: hrUser.id,
    action: "employee.status_changed",
    entity_type: "employee",
    entity_id: payload.employeeId,
    metadata: { newStatus: payload.status, notes: payload.notes },
  });

  revalidateTag(CACHE_TAGS.users, "max");
  return { success: true, data };
}

export async function createSalaryRevisionAction(payload: {
  employeeId: string;
  salary: number;
  fixedComponent?: number;
  variableComponent?: number;
  ctc?: number;
  effectiveDate: string;
  notes?: string;
}) {
  const hrUser = await requirePermission("employee.salary.edit");
  const supabase = createSupabaseAdminClient();

  // 1. Insert historical revision record
  const { data: revision, error: revError } = await supabase
    .from("employee_salary_history")
    .insert({
      employee_id: payload.employeeId,
      salary: payload.salary,
      fixed_component: payload.fixedComponent || payload.salary,
      variable_component: payload.variableComponent || 0,
      ctc: payload.ctc || payload.salary * 12,
      effective_date: payload.effectiveDate,
      notes: payload.notes || "Salary revision",
      created_by: hrUser.id,
    })
    .select()
    .single();

  if (revError) {
    console.error("Error creating salary revision:", revError);
    return { success: false, error: revError.message };
  }

  // 2. Update current salary on employee record
  const { error: empError } = await supabase
    .from("employees")
    .update({
      salary: payload.salary,
      updated_at: new Date().toISOString(),
    })
    .eq("id", payload.employeeId);

  if (empError) {
    console.error("Error updating employee salary record:", empError);
  }

  await logAudit({
    user_id: hrUser.id,
    action: "employee.salary_revision_created",
    entity_type: "employee_salary_history",
    entity_id: revision.id,
    metadata: { employeeId: payload.employeeId, salary: payload.salary, effectiveDate: payload.effectiveDate },
  });

  revalidateTag(CACHE_TAGS.users, "max");
  return { success: true, data: revision };
}

export async function manageDepartmentAction(payload: {
  code: string;
  name: string;
  description?: string;
  isActive?: boolean;
}) {
  const hrUser = await requirePermission("department.manage");
  const supabase = createSupabaseAdminClient();

  const { data, error } = await supabase
    .from("departments")
    .upsert({
      code: payload.code.trim().toUpperCase(),
      name: payload.name.trim(),
      description: payload.description || null,
      is_active: payload.isActive !== undefined ? payload.isActive : true,
      updated_at: new Date().toISOString(),
    }, { onConflict: "code" })
    .select()
    .single();

  if (error) {
    console.error("Error managing department:", error);
    return { success: false, error: error.message };
  }

  await logAudit({
    user_id: hrUser.id,
    action: "department.managed",
    entity_type: "department",
    entity_id: data.id,
    metadata: { code: data.code, name: data.name },
  });

  revalidateTag(CACHE_TAGS.users, "max");
  return { success: true, data };
}

export async function manageDesignationAction(payload: {
  code: string;
  title: string;
  departmentCode?: string;
  description?: string;
  isActive?: boolean;
}) {
  const hrUser = await requirePermission("designation.manage");
  const supabase = createSupabaseAdminClient();

  const { data, error } = await supabase
    .from("designations")
    .upsert({
      code: payload.code.trim().toUpperCase(),
      title: payload.title.trim(),
      department_code: payload.departmentCode || null,
      description: payload.description || null,
      is_active: payload.isActive !== undefined ? payload.isActive : true,
      updated_at: new Date().toISOString(),
    }, { onConflict: "code" })
    .select()
    .single();

  if (error) {
    console.error("Error managing designation:", error);
    return { success: false, error: error.message };
  }

  await logAudit({
    user_id: hrUser.id,
    action: "designation.managed",
    entity_type: "designation",
    entity_id: data.id,
    metadata: { code: data.code, title: data.title },
  });

  revalidateTag(CACHE_TAGS.users, "max");
  return { success: true, data };
}

export async function requestUserAccountAction(payload: {
  employeeId: string;
  requestType: "create_account" | "deactivate_account" | "role_change";
  requestedRole?: UserRole;
  targetBranchId?: string;
  adminNotes?: string;
}) {
  const hrUser = await requirePermission("user_request.create");
  const supabase = createSupabaseAdminClient();

  const { data, error } = await supabase
    .from("user_account_requests")
    .insert({
      employee_id: payload.employeeId,
      requested_by: hrUser.id,
      request_type: payload.requestType,
      requested_role: payload.requestedRole || "service_engineer",
      target_branch_id: payload.targetBranchId || null,
      status: "pending",
      admin_notes: payload.adminNotes || null,
    })
    .select()
    .single();

  if (error) {
    console.error("Error creating user account request:", error);
    return { success: false, error: error.message };
  }

  await logAudit({
    user_id: hrUser.id,
    action: "user_account_request.created",
    entity_type: "user_account_request",
    entity_id: data.id,
    metadata: { employeeId: payload.employeeId, requestType: payload.requestType, requestedRole: payload.requestedRole },
  });

  revalidateTag(CACHE_TAGS.users, "max");
  return { success: true, data };
}

export async function uploadEmployeeDocumentAction(payload: {
  employeeId: string;
  documentType: "joining" | "identity" | "qualification" | "employment" | "offer_letter" | "appointment_letter" | "resignation" | "experience" | "other";
  fileName: string;
  fileUrl: string;
  fileSizeBytes?: number;
}) {
  const hrUser = await requirePermission("employee.document.manage");
  const supabase = createSupabaseAdminClient();

  const { data, error } = await supabase
    .from("employee_documents")
    .insert({
      employee_id: payload.employeeId,
      document_type: payload.documentType,
      file_name: payload.fileName.trim(),
      file_url: payload.fileUrl.trim(),
      file_size_bytes: payload.fileSizeBytes || null,
      uploaded_by: hrUser.id,
    })
    .select()
    .single();

  if (error) {
    console.error("Error uploading employee document metadata:", error);
    return { success: false, error: error.message };
  }

  await logAudit({
    user_id: hrUser.id,
    action: "employee_document.uploaded",
    entity_type: "employee_document",
    entity_id: data.id,
    metadata: { employeeId: payload.employeeId, documentType: payload.documentType, fileName: payload.fileName },
  });

  revalidateTag(CACHE_TAGS.users, "max");
  return { success: true, data };
}
