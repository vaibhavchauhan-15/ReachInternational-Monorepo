import { z } from "zod";

export const CreateProductSchema = z.object({
  part_number: z.string().min(1, "Part number is required"),
  name: z.string().min(2, "Product name is required"),
  description: z.string().optional().nullable(),
  category: z.string().optional().nullable(),
  subcategory: z.string().optional().nullable(),
  manufacturer: z.string().optional().nullable(),
  brand: z.string().optional().nullable(),
  unit: z.string().optional().default("Pcs"),
  min_stock_level: z.number().min(0).optional().default(0),
  reorder_level: z.number().min(0).optional().default(0),
  unit_cost: z.number().min(0).optional().default(0),
  storage_location: z.string().optional().nullable(),
  part_type: z.enum(["spare", "consumable", "tool", "assembly", "lubricant"]).optional().default("spare"),
  criticality: z.enum(["normal", "high", "critical"]).optional().default("normal"),
  status: z.enum(["active", "inactive", "discontinued"]).optional().default("active"),
});

export const UpdateStockSchema = z.object({
  product_id: z.string().min(1, "Product ID is required"),
  branch_id: z.string().min(1, "Branch ID is required"),
  quantity: z.number(),
  transaction_type: z.enum([
    "OPENING_STOCK",
    "PURCHASE",
    "PURCHASE_RECEIPT",
    "STOCK_IN",
    "STOCK_OUT",
    "PART_ISSUE",
    "PART_RETURN",
    "SERVICE_ISSUE",
    "RETURN",
    "TRANSFER",
    "ADJUSTMENT",
    "DAMAGE",
    "LOSS",
    "REVERSAL",
  ]),
  remarks: z.string().optional().nullable(),
});

export const GoodsReceiptSchema = z.object({
  grn_number: z.string().min(1, "GRN number is required"),
  po_id: z.string().optional().nullable(),
  supplier_name: z.string().min(2, "Supplier name is required"),
  supplier_gstin: z.string().optional().nullable(),
  bill_number: z.string().min(1, "Bill number is required"),
  bill_date: z.string().min(1, "Bill date is required"),
  delivery_date: z.string().min(1, "Delivery date is required"),
  branch_id: z.string().min(1, "Branch is required"),
  remarks: z.string().optional().nullable(),
  items: z.array(z.object({
    product_id: z.string().min(1, "Product is required"),
    quantity_ordered: z.number().min(0),
    quantity_received: z.number().positive("Quantity received must be greater than zero"),
    unit_price: z.number().min(0),
    tax_amount: z.number().min(0).optional().default(0),
    total_amount: z.number().min(0),
    rack: z.string().optional().default(""),
    shelf: z.string().optional().default(""),
    bin: z.string().optional().default(""),
  })).min(1, "At least one item is required"),
});

export const StockTransferSchema = z.object({
  from_branch_id: z.string().min(1, "Source branch is required"),
  to_branch_id: z.string().min(1, "Destination branch is required"),
  product_id: z.string().min(1, "Product is required"),
  quantity: z.number().positive("Transfer quantity must be greater than zero"),
  remarks: z.string().optional().nullable(),
}).refine((data) => data.from_branch_id !== data.to_branch_id, {
  message: "Destination branch cannot be the same as source branch",
  path: ["to_branch_id"],
});

export type CreateProductInput = z.infer<typeof CreateProductSchema>;
export type UpdateStockInput = z.infer<typeof UpdateStockSchema>;
export type GoodsReceiptInput = z.infer<typeof GoodsReceiptSchema>;
export type StockTransferInput = z.infer<typeof StockTransferSchema>;
