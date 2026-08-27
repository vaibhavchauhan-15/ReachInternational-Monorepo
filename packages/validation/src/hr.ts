import { z } from "zod";

export const CreateEmployeeSchema = z.object({
  employee_code: z.string().min(1, "Employee code is required").max(50, "Employee code cannot exceed 50 characters"),
  full_name: z.string().min(2, "Full name is required").max(100, "Full name cannot exceed 100 characters"),
  phone: z.string().max(15, "Phone cannot exceed 15 characters").optional().nullable(),
  email: z.string().trim().email("Invalid email").max(255, "Email cannot exceed 255 characters").optional().nullable().or(z.literal("")),
  designation: z.string().min(1, "Designation is required").max(100, "Designation cannot exceed 100 characters"),
  department: z.string().max(100, "Department cannot exceed 100 characters").optional().nullable(),
  user_id: z.string().uuid().optional().nullable(),
  joining_date: z.string().min(1, "Joining date is required").max(50, "Joining date cannot exceed 50 characters"),
  employment_type: z.enum(["full_time", "contract", "part_time"]).optional().default("full_time"),
  reporting_manager_id: z.string().uuid().optional().nullable(),
  salary: z.number().min(0).optional().nullable(),
  status: z.enum(["pending_onboarding", "active", "on_leave", "notice_period", "resigned", "terminated", "retired", "inactive", "archived"]).optional().default("active"),
});

export const UpdateEmployeeSchema = CreateEmployeeSchema.partial().extend({
  id: z.string().uuid("Invalid Employee ID"),
});

export const DepartmentSchema = z.object({
  code: z.string().min(1, "Department code is required").max(50, "Department code cannot exceed 50 characters"),
  name: z.string().min(2, "Department name is required").max(100, "Department name cannot exceed 100 characters"),
  description: z.string().max(500, "Description cannot exceed 500 characters").optional().nullable(),
});

export const DesignationSchema = z.object({
  code: z.string().min(1, "Designation code is required").max(50, "Designation code cannot exceed 50 characters"),
  title: z.string().min(2, "Designation title is required").max(100, "Designation title cannot exceed 100 characters"),
  department_code: z.string().max(50, "Department code cannot exceed 50 characters").optional().nullable(),
  description: z.string().max(500, "Description cannot exceed 500 characters").optional().nullable(),
});

export type CreateEmployeeInput = z.infer<typeof CreateEmployeeSchema>;
export type UpdateEmployeeInput = z.infer<typeof UpdateEmployeeSchema>;
export type DepartmentInput = z.infer<typeof DepartmentSchema>;
export type DesignationInput = z.infer<typeof DesignationSchema>;
