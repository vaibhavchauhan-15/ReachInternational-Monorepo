import { z } from "zod";

export const PartIssueSchema = z.object({
  branch_id: z.string().min(1, "Branch is required"),
  machine_id: z.string().optional().nullable(),
  complaint_id: z.string().optional().nullable(),
  service_record_id: z.string().optional().nullable(),
  issued_to_user_id: z.string().optional().nullable(),
  issued_to_name: z.string().min(2, "Recipient name is required"),
  issue_date: z.string().optional(),
  is_returnable: z.boolean().optional().default(false),
  expected_return_date: z.string().optional().nullable(),
  remarks: z.string().optional().nullable(),
  items: z.array(z.object({
    product_id: z.string().min(1, "Product is required"),
    quantity_issued: z.number().positive("Issued quantity must be greater than zero"),
    unit: z.string().optional().default("Pcs"),
    machine_code: z.string().optional().nullable(),
    is_returnable: z.boolean().optional().default(false),
  })).min(1, "At least one item is required"),
});

export const PartReturnSchema = z.object({
  issue_id: z.string().min(1, "Part issue reference is required"),
  returned_by_name: z.string().min(2, "Returned by name is required"),
  return_date: z.string().optional(),
  remarks: z.string().optional().nullable(),
  items: z.array(z.object({
    product_id: z.string().min(1, "Product is required"),
    quantity_returned: z.number().positive("Returned quantity must be greater than zero"),
    condition: z.enum(["good", "damaged", "scrap"]).optional().default("good"),
    remarks: z.string().optional().nullable(),
  })).min(1, "At least one return item is required"),
});

export const PurchaseRequestSchema = z.object({
  branch_id: z.string().min(1, "Branch is required"),
  sent_to_manager_id: z.string().min(1, "Target manager is required"),
  priority: z.enum(["normal", "high", "urgent"]).optional().default("normal"),
  reason: z.string().min(5, "Reason for purchase is required"),
  items: z.array(z.object({
    product_id: z.string().min(1, "Product is required"),
    requested_quantity: z.number().positive("Requested quantity must be positive"),
    unit: z.string().optional().default("Pcs"),
    estimated_unit_cost: z.number().min(0).optional().default(0),
    remarks: z.string().optional().nullable(),
  })).min(1, "At least one item required"),
});

export type PartIssueInput = z.infer<typeof PartIssueSchema>;
export type PartReturnInput = z.infer<typeof PartReturnSchema>;
export type PurchaseRequestInput = z.infer<typeof PurchaseRequestSchema>;
