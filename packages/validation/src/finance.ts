import { z } from "zod";

export const CreateInvoiceSchema = z.object({
  invoice_type: z.enum(["sales", "rental", "service", "custom"]),
  customer_id: z.string().max(100).optional().nullable(),
  customer_name: z.string().min(2, "Customer name is required").max(100, "Customer name cannot exceed 100 characters"),
  customer_gstin: z.string().max(15, "GSTIN cannot exceed 15 characters").optional().nullable(),
  billing_address: z.string().max(500, "Billing address cannot exceed 500 characters").optional().nullable(),
  reference_type: z.string().max(50).optional().nullable(),
  reference_id: z.string().max(100).optional().nullable(),
  branch_id: z.string().max(100).optional().nullable(),
  issue_date: z.string().max(50).optional(),
  due_date: z.string().min(1, "Due date is required").max(50),
  payment_terms: z.string().max(200).optional(),
  items: z.array(
    z.object({
      description: z.string().min(1, "Item description required").max(500, "Item description cannot exceed 500 characters"),
      item_type: z.string().max(50).optional().default("item"),
      quantity: z.number().positive("Quantity must be greater than zero"),
      unit_price: z.number().min(0, "Unit price must be non-negative"),
      discount_percent: z.number().min(0).max(100).optional().default(0),
      tax_rate: z.number().min(0).optional().default(18),
    })
  ).min(1, "At least one item is required"),
  notes: z.string().max(1000, "Notes cannot exceed 1000 characters").optional().nullable(),
  idempotency_key: z.string().max(128, "Idempotency key cannot exceed 128 characters").optional().nullable(),
});

export const UpdateInvoiceSchema = CreateInvoiceSchema.partial().extend({
  id: z.string().min(1, "Invoice ID is required").max(100),
});

export const RecordPaymentSchema = z.object({
  invoice_id: z.string().min(1, "Invoice is required").max(100),
  amount: z.number().positive("Payment amount must be greater than zero"),
  payment_method: z.enum(["bank_transfer", "upi", "cheque", "cash", "card", "other"]),
  transaction_reference: z.string().max(100, "Transaction reference cannot exceed 100 characters").optional().nullable(),
  payment_date: z.string().max(50).optional(),
  remarks: z.string().max(500, "Remarks cannot exceed 500 characters").optional().nullable(),
  proof_document_url: z.string().max(2048, "Document URL cannot exceed 2048 characters").optional().nullable(),
  idempotency_key: z.string().max(128, "Idempotency key cannot exceed 128 characters").optional().nullable(),
});

export const CreditDebitNoteSchema = z.object({
  invoice_id: z.string().min(1, "Invoice reference is required").max(100),
  note_type: z.enum(["credit_note", "debit_note"]),
  amount: z.number().positive("Note amount must be positive"),
  tax_amount: z.number().min(0).optional().default(0),
  reason: z.string().min(3, "Reason is required").max(500, "Reason cannot exceed 500 characters"),
});

export const RecordExpenseSchema = z.object({
  category: z.string().min(1, "Expense category is required").max(100),
  amount: z.number().positive("Expense amount must be positive"),
  expense_date: z.string().max(50).optional(),
  branch_id: z.string().max(100).optional().nullable(),
  department_id: z.string().max(100).optional().nullable(),
  vendor_name: z.string().max(100).optional().nullable(),
  vendor_id: z.string().max(100).optional().nullable(),
  payment_method: z.string().max(50).optional().default("bank_transfer"),
  supporting_document_url: z.string().max(2048).optional().nullable(),
  remarks: z.string().max(500).optional().nullable(),
});

export const VendorPaymentSchema = z.object({
  vendor_id: z.string().max(100).optional().nullable(),
  po_id: z.string().max(100).optional().nullable(),
  amount: z.number().positive("Payment amount must be positive"),
  payment_method: z.string().max(50).optional().default("bank_transfer"),
  transaction_reference: z.string().max(100).optional().nullable(),
  payment_date: z.string().max(50).optional(),
  remarks: z.string().max(500).optional().nullable(),
});

export type CreateInvoiceInput = z.infer<typeof CreateInvoiceSchema>;
export type UpdateInvoiceInput = z.infer<typeof UpdateInvoiceSchema>;
export type RecordPaymentInput = z.infer<typeof RecordPaymentSchema>;
export type CreditDebitNoteInput = z.infer<typeof CreditDebitNoteSchema>;
export type RecordExpenseInput = z.infer<typeof RecordExpenseSchema>;
export type VendorPaymentInput = z.infer<typeof VendorPaymentSchema>;
