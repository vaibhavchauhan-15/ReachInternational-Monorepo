import { z } from "zod";

export const CreateInvoiceSchema = z.object({
  invoice_type: z.enum(["sales", "rental", "service", "custom"]),
  customer_id: z.string().optional().nullable(),
  customer_name: z.string().min(2, "Customer name is required"),
  customer_gstin: z.string().optional().nullable(),
  billing_address: z.string().optional().nullable(),
  reference_type: z.string().optional().nullable(),
  reference_id: z.string().optional().nullable(),
  branch_id: z.string().optional().nullable(),
  issue_date: z.string().optional(),
  due_date: z.string().min(1, "Due date is required"),
  payment_terms: z.string().optional(),
  items: z.array(
    z.object({
      description: z.string().min(1, "Item description required"),
      item_type: z.string().optional().default("item"),
      quantity: z.number().positive("Quantity must be greater than zero"),
      unit_price: z.number().min(0, "Unit price must be non-negative"),
      discount_percent: z.number().min(0).max(100).optional().default(0),
      tax_rate: z.number().min(0).optional().default(18),
    })
  ).min(1, "At least one item is required"),
  notes: z.string().optional().nullable(),
});

export const UpdateInvoiceSchema = CreateInvoiceSchema.partial().extend({
  id: z.string().min(1, "Invoice ID is required"),
});

export const RecordPaymentSchema = z.object({
  invoice_id: z.string().min(1, "Invoice is required"),
  amount: z.number().positive("Payment amount must be greater than zero"),
  payment_method: z.enum(["bank_transfer", "upi", "cheque", "cash", "card", "other"]),
  transaction_reference: z.string().optional().nullable(),
  payment_date: z.string().optional(),
  remarks: z.string().optional().nullable(),
  proof_document_url: z.string().optional().nullable(),
});

export const CreditDebitNoteSchema = z.object({
  invoice_id: z.string().min(1, "Invoice reference is required"),
  note_type: z.enum(["credit_note", "debit_note"]),
  amount: z.number().positive("Note amount must be positive"),
  tax_amount: z.number().min(0).optional().default(0),
  reason: z.string().min(3, "Reason is required"),
});

export const RecordExpenseSchema = z.object({
  category: z.string().min(1, "Expense category is required"),
  amount: z.number().positive("Expense amount must be positive"),
  expense_date: z.string().optional(),
  branch_id: z.string().optional().nullable(),
  department_id: z.string().optional().nullable(),
  vendor_name: z.string().optional().nullable(),
  vendor_id: z.string().optional().nullable(),
  payment_method: z.string().optional().default("bank_transfer"),
  supporting_document_url: z.string().optional().nullable(),
  remarks: z.string().optional().nullable(),
});

export const VendorPaymentSchema = z.object({
  vendor_id: z.string().optional().nullable(),
  po_id: z.string().optional().nullable(),
  amount: z.number().positive("Payment amount must be positive"),
  payment_method: z.string().optional().default("bank_transfer"),
  transaction_reference: z.string().optional().nullable(),
  payment_date: z.string().optional(),
  remarks: z.string().optional().nullable(),
});

export type CreateInvoiceInput = z.infer<typeof CreateInvoiceSchema>;
export type UpdateInvoiceInput = z.infer<typeof UpdateInvoiceSchema>;
export type RecordPaymentInput = z.infer<typeof RecordPaymentSchema>;
export type CreditDebitNoteInput = z.infer<typeof CreditDebitNoteSchema>;
export type RecordExpenseInput = z.infer<typeof RecordExpenseSchema>;
export type VendorPaymentInput = z.infer<typeof VendorPaymentSchema>;
