import { z } from "zod";

export const PartIssueSchema = z.object({
  branch_id: z.string().min(1, "Branch is required").max(100),
  machine_id: z.string().max(100).optional().nullable(),
  complaint_id: z.string().max(100).optional().nullable(),
  service_record_id: z.string().max(100).optional().nullable(),
  issued_to_user_id: z.string().max(100).optional().nullable(),
  issued_to_name: z.string().min(2, "Recipient name is required").max(100, "Recipient name cannot exceed 100 characters"),
  issue_date: z.string().max(50).optional(),
  is_returnable: z.boolean().optional().default(false),
  expected_return_date: z.string().max(50).optional().nullable(),
  remarks: z.string().max(500, "Remarks cannot exceed 500 characters").optional().nullable(),
  items: z.array(z.object({
    product_id: z.string().min(1, "Product is required").max(100),
    quantity_issued: z.number().positive("Issued quantity must be greater than zero"),
    unit: z.string().max(20).optional().default("Pcs"),
    machine_code: z.string().max(50).optional().nullable(),
    is_returnable: z.boolean().optional().default(false),
  })).min(1, "At least one item is required"),
});

export const PartReturnSchema = z.object({
  issue_id: z.string().min(1, "Part issue reference is required").max(100),
  returned_by_name: z.string().min(2, "Returned by name is required").max(100, "Name cannot exceed 100 characters"),
  return_date: z.string().max(50).optional(),
  remarks: z.string().max(500, "Remarks cannot exceed 500 characters").optional().nullable(),
  items: z.array(z.object({
    product_id: z.string().min(1, "Product is required").max(100),
    quantity_returned: z.number().positive("Returned quantity must be greater than zero"),
    condition: z.enum(["good", "damaged", "scrap"]).optional().default("good"),
    remarks: z.string().max(500).optional().nullable(),
  })).min(1, "At least one return item is required"),
});

export const PurchaseRequestSchema = z.object({
  branch_id: z.string().min(1, "Branch is required").max(100),
  sent_to_manager_id: z.string().min(1, "Target manager is required").max(100),
  priority: z.enum(["normal", "high", "urgent"]).optional().default("normal"),
  reason: z.string().min(5, "Reason for purchase is required").max(500, "Reason cannot exceed 500 characters"),
  items: z.array(z.object({
    product_id: z.string().min(1, "Product is required").max(100),
    requested_quantity: z.number().positive("Requested quantity must be positive"),
    unit: z.string().max(20).optional().default("Pcs"),
    estimated_unit_cost: z.number().min(0).optional().default(0),
    remarks: z.string().max(500).optional().nullable(),
  })).min(1, "At least one item required"),
});

export type PartIssueInput = z.infer<typeof PartIssueSchema>;
export type PartReturnInput = z.infer<typeof PartReturnSchema>;
export type PurchaseRequestInput = z.infer<typeof PurchaseRequestSchema>;
