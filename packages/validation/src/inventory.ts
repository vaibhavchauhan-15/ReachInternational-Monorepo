import { z } from "zod";

export const CreateProductSchema = z.object({
  part_number: z.string().min(1, "Part number is required").max(100, "Part number cannot exceed 100 characters"),
  name: z.string().min(2, "Product name is required").max(100, "Product name cannot exceed 100 characters"),
  description: z.string().max(1000, "Description cannot exceed 1000 characters").optional().nullable(),
  category: z.string().max(100, "Category cannot exceed 100 characters").optional().nullable(),
  subcategory: z.string().max(100, "Subcategory cannot exceed 100 characters").optional().nullable(),
  manufacturer: z.string().max(100, "Manufacturer cannot exceed 100 characters").optional().nullable(),
  brand: z.string().max(100, "Brand cannot exceed 100 characters").optional().nullable(),
  unit: z.string().max(20, "Unit string cannot exceed 20 characters").optional().default("Pcs"),
  min_stock_level: z.number().min(0).optional().default(0),
  reorder_level: z.number().min(0).optional().default(0),
  unit_cost: z.number().min(0).optional().default(0),
  storage_location: z.string().max(100, "Storage location cannot exceed 100 characters").optional().nullable(),
  part_type: z.enum(["spare", "consumable", "tool", "assembly", "lubricant"]).optional().default("spare"),
  criticality: z.enum(["normal", "high", "critical"]).optional().default("normal"),
  status: z.enum(["active", "inactive", "discontinued"]).optional().default("active"),
});

export const UpdateStockSchema = z.object({
  product_id: z.string().min(1, "Product ID is required").max(100),
  branch_id: z.string().min(1, "Branch ID is required").max(100),
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
  remarks: z.string().max(500, "Remarks cannot exceed 500 characters").optional().nullable(),
});

export const GoodsReceiptSchema = z.object({
  grn_number: z.string().min(1, "GRN number is required").max(50, "GRN number cannot exceed 50 characters"),
  po_id: z.string().max(100).optional().nullable(),
  supplier_name: z.string().min(2, "Supplier name is required").max(100, "Supplier name cannot exceed 100 characters"),
  supplier_gstin: z.string().max(15, "GSTIN cannot exceed 15 characters").optional().nullable(),
  bill_number: z.string().min(1, "Bill number is required").max(50, "Bill number cannot exceed 50 characters"),
  bill_date: z.string().min(1, "Bill date is required").max(50),
  delivery_date: z.string().min(1, "Delivery date is required").max(50),
  branch_id: z.string().min(1, "Branch is required").max(100),
  remarks: z.string().max(500, "Remarks cannot exceed 500 characters").optional().nullable(),
  items: z.array(z.object({
    product_id: z.string().min(1, "Product is required").max(100),
    quantity_ordered: z.number().min(0),
    quantity_received: z.number().positive("Quantity received must be greater than zero"),
    unit_price: z.number().min(0),
    tax_amount: z.number().min(0).optional().default(0),
    total_amount: z.number().min(0),
    rack: z.string().max(50).optional().default(""),
    shelf: z.string().max(50).optional().default(""),
    bin: z.string().max(50).optional().default(""),
  })).min(1, "At least one item is required"),
});

export const StockTransferSchema = z.object({
  from_branch_id: z.string().min(1, "Source branch is required").max(100),
  to_branch_id: z.string().min(1, "Destination branch is required").max(100),
  product_id: z.string().min(1, "Product is required").max(100),
  quantity: z.number().positive("Transfer quantity must be greater than zero"),
  remarks: z.string().max(500, "Remarks cannot exceed 500 characters").optional().nullable(),
}).refine((data) => data.from_branch_id !== data.to_branch_id, {
  message: "Destination branch cannot be the same as source branch",
  path: ["to_branch_id"],
});

export type CreateProductInput = z.infer<typeof CreateProductSchema>;
export type UpdateStockInput = z.infer<typeof UpdateStockSchema>;
export type GoodsReceiptInput = z.infer<typeof GoodsReceiptSchema>;
export type StockTransferInput = z.infer<typeof StockTransferSchema>;
