import { z } from "zod";

export const CreateEmployeeSchema = z.object({
  employee_code: z.string().min(1, "Employee code is required"),
  full_name: z.string().min(2, "Full name is required"),
  phone: z.string().optional().nullable(),
  email: z.string().email().optional().nullable().or(z.literal("")),
  designation: z.string().min(1, "Designation is required"),
  department: z.string().optional().nullable(),
  user_id: z.string().optional().nullable(),
  joining_date: z.string().min(1, "Joining date is required"),
  employment_type: z.enum(["full_time", "contract", "part_time"]).optional().default("full_time"),
  reporting_manager_id: z.string().optional().nullable(),
  salary: z.number().min(0).optional().nullable(),
  status: z.enum(["pending_onboarding", "active", "on_leave", "notice_period", "resigned", "terminated", "retired", "inactive", "archived"]).optional().default("active"),
});

export const UpdateEmployeeSchema = CreateEmployeeSchema.partial().extend({
  id: z.string().min(1, "Employee ID is required"),
});

export const DepartmentSchema = z.object({
  code: z.string().min(1, "Department code is required"),
  name: z.string().min(2, "Department name is required"),
  description: z.string().optional().nullable(),
});

export const DesignationSchema = z.object({
  code: z.string().min(1, "Designation code is required"),
  title: z.string().min(2, "Designation title is required"),
  department_code: z.string().optional().nullable(),
  description: z.string().optional().nullable(),
});

export type CreateEmployeeInput = z.infer<typeof CreateEmployeeSchema>;
export type UpdateEmployeeInput = z.infer<typeof UpdateEmployeeSchema>;
export type DepartmentInput = z.infer<typeof DepartmentSchema>;
export type DesignationInput = z.infer<typeof DesignationSchema>;
