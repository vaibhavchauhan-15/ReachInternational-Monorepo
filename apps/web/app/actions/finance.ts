"use server";

import { revalidatePath } from "next/cache";
import {
  CreateInvoiceSchema,
  RecordPaymentSchema,
  CreditDebitNoteSchema,
  RecordExpenseSchema as CreateExpenseSchema,
  VendorPaymentSchema as RecordVendorPaymentSchema,
  type CreateInvoiceInput,
} from "@reachinternational/validation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/dal";
import { roleHasPermission } from "@/lib/auth/rbac";
import { logAudit } from "@/lib/audit";
import { z } from "zod";

const ThreeWayMatchSchema = z.object({
  po_id: z.string().min(1, "PO is required"),
  po_number: z.string().min(1),
  grn_id: z.string().optional().nullable(),
  grn_number: z.string().optional().nullable(),
  supplier_invoice_number: z.string().optional().nullable(),
  supplier_invoice_amount: z.number().optional().nullable(),
  po_amount: z.number().optional().nullable(),
  grn_quantity: z.number().optional().nullable(),
  po_quantity: z.number().optional().nullable(),
  invoice_quantity: z.number().optional().nullable(),
  hold_reason: z.string().optional().nullable(),
});

// =====================================
// SERVER ACTIONS
// =====================================

/**
 * Create Invoice Action (Draft or Initial Review)
 */
export async function createInvoiceAction(input: CreateInvoiceInput) {
  const user = await getCurrentUser();
  if (!user || !roleHasPermission(user.role, "finance.invoice.create")) {
    return { success: false, error: "Unauthorized. Permission 'finance.invoice.create' required." };
  }

  const parsed = CreateInvoiceSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message || "Invalid input data." };
  }

  const data = parsed.data;
  const supabase = await createSupabaseServerClient();

  try {
    // Generate Invoice Number
    const prefix = "INV-" + new Date().getFullYear() + "-";
    const { count } = await supabase
      .from("finance_invoices")
      .select("*", { count: "exact", head: true });
    
    const seq = (count || 0) + 1;
    const invoiceNumber = `${prefix}${String(seq).padStart(4, "0")}`;

    // Calculate totals
    let subtotal = 0;
    let totalTax = 0;
    let totalDiscount = 0;

    const lineItems = data.items.map((item) => {
      const itemSubtotal = item.quantity * item.unit_price;
      const discount = (itemSubtotal * (item.discount_percent || 0)) / 100;
      const taxable = itemSubtotal - discount;
      const tax = (taxable * (item.tax_rate || 18)) / 100;
      const total = taxable + tax;

      subtotal += itemSubtotal;
      totalDiscount += discount;
      totalTax += tax;

      return {
        description: item.description,
        item_type: item.item_type || "item",
        quantity: item.quantity,
        unit_price: item.unit_price,
        discount_percent: item.discount_percent || 0,
        tax_rate: item.tax_rate || 18,
        tax_amount: tax,
        total_amount: total,
      };
    });

    const grandTotal = subtotal - totalDiscount + totalTax;

    // Insert Invoice Header
    const { data: newInvoice, error: invError } = await supabase
      .from("finance_invoices")
      .insert({
        invoice_number: invoiceNumber,
        invoice_type: data.invoice_type,
        customer_id: data.customer_id || null,
        customer_name: data.customer_name,
        customer_gstin: data.customer_gstin || null,
        billing_address: data.billing_address || null,
        reference_type: data.reference_type || "manual",
        reference_id: data.reference_id || null,
        branch_id: data.branch_id || user.branch_id || null,
        issue_date: data.issue_date || new Date().toISOString().split("T")[0],
        due_date: data.due_date,
        payment_terms: data.payment_terms || "Net 30",
        subtotal: subtotal,
        discount_amount: totalDiscount,
        tax_amount: totalTax,
        total_amount: grandTotal,
        amount_paid: 0,
        amount_due: grandTotal,
        status: "draft",
        is_finalized: false,
        notes: data.notes || null,
        created_by: user.id,
      })
      .select()
      .single();

    if (invError || !newInvoice) {
      throw invError || new Error("Failed to create invoice");
    }

    // Insert Line Items
    const itemsToInsert = lineItems.map((item) => ({
      ...item,
      invoice_id: newInvoice.id,
    }));
    await supabase.from("finance_invoice_items").insert(itemsToInsert);

    await logAudit({
      action: "create_invoice",
      entity_type: "finance_invoice",
      entity_id: newInvoice.id,
      metadata: { invoice_number: invoiceNumber, total_amount: grandTotal, type: data.invoice_type },
      user_id: user.id,
    });

    revalidatePath("/finance");
    return { success: true, invoice: newInvoice };
  } catch (error) {
    console.error("Error in createInvoiceAction:", error);
    return { success: false, error: (error as Error).message || "Failed to create invoice." };
  }
}

/**
 * Update Invoice Action (Only allowed before finalization!)
 */
export async function updateInvoiceAction(invoiceId: string, input: Partial<CreateInvoiceInput>) {
  const user = await getCurrentUser();
  if (!user || !roleHasPermission(user.role, "finance.invoice.edit")) {
    return { success: false, error: "Unauthorized. Permission 'finance.invoice.edit' required." };
  }

  const supabase = await createSupabaseServerClient();

  try {
    // Check if invoice exists and whether it is finalized
    const { data: existing, error: fetchErr } = await supabase
      .from("finance_invoices")
      .select("id, is_finalized, invoice_number, status")
      .eq("id", invoiceId)
      .single();

    if (fetchErr || !existing) {
      return { success: false, error: "Invoice not found." };
    }

    // Direct Modification Restriction per Rule 3!
    if (existing.is_finalized) {
      return {
        success: false,
        error: "Finalized invoices CANNOT be edited directly. Please use Credit Note or Debit Note to make amendments.",
      };
    }

    // Perform update on unfinalized draft
    const updates: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };
    if (input.customer_name) updates.customer_name = input.customer_name;
    if (input.customer_gstin !== undefined) updates.customer_gstin = input.customer_gstin;
    if (input.billing_address !== undefined) updates.billing_address = input.billing_address;
    if (input.due_date) updates.due_date = input.due_date;
    if (input.notes !== undefined) updates.notes = input.notes;

    const { error: updateErr } = await supabase
      .from("finance_invoices")
      .update(updates)
      .eq("id", invoiceId);

    if (updateErr) throw updateErr;

    await logAudit({
      action: "update_invoice",
      entity_type: "finance_invoice",
      entity_id: invoiceId,
      metadata: { invoice_number: existing.invoice_number },
      user_id: user.id,
    });

    revalidatePath("/finance");
    return { success: true };
  } catch (error) {
    console.error("Error in updateInvoiceAction:", error);
    return { success: false, error: (error as Error).message || "Failed to update invoice." };
  }
}

/**
 * Finalize Invoice Action (Locks direct editing)
 */
export async function finalizeInvoiceAction(invoiceId: string) {
  const user = await getCurrentUser();
  if (!user || !roleHasPermission(user.role, "finance.invoice.finalize")) {
    return { success: false, error: "Unauthorized. Permission 'finance.invoice.finalize' required." };
  }

  const supabase = await createSupabaseServerClient();

  try {
    const { data: existing } = await supabase
      .from("finance_invoices")
      .select("id, is_finalized, invoice_number, status")
      .eq("id", invoiceId)
      .single();

    if (!existing) return { success: false, error: "Invoice not found." };
    if (existing.is_finalized) return { success: false, error: "Invoice is already finalized." };

    const { error: finalizeErr } = await supabase
      .from("finance_invoices")
      .update({
        is_finalized: true,
        status: "finalized",
        finalized_by: user.id,
        finalized_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", invoiceId);

    if (finalizeErr) throw finalizeErr;

    await logAudit({
      action: "finalize_invoice",
      entity_type: "finance_invoice",
      entity_id: invoiceId,
      metadata: { invoice_number: existing.invoice_number, status: "finalized" },
      user_id: user.id,
    });

    revalidatePath("/finance");
    return { success: true };
  } catch (error) {
    console.error("Error in finalizeInvoiceAction:", error);
    return { success: false, error: (error as Error).message || "Failed to finalize invoice." };
  }
}

/**
 * Record Customer Payment Action (Supports partial payments)
 */
export async function recordPaymentAction(input: z.infer<typeof RecordPaymentSchema>) {
  const user = await getCurrentUser();
  if (!user || !roleHasPermission(user.role, "finance.payment.record")) {
    return { success: false, error: "Unauthorized. Permission 'finance.payment.record' required." };
  }

  const parsed = RecordPaymentSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message || "Invalid payment details." };
  }

  const data = parsed.data;
  const supabase = await createSupabaseServerClient();

  try {
    // Check target invoice
    const { data: invoice, error: invErr } = await supabase
      .from("finance_invoices")
      .select("*")
      .eq("id", data.invoice_id)
      .single();

    if (invErr || !invoice) return { success: false, error: "Referenced invoice not found." };
    if (invoice.status === "cancelled") return { success: false, error: "Cannot record payment for a cancelled invoice." };

    // Generate Payment Number
    const prefix = "PAY-" + new Date().getFullYear() + "-";
    const { count } = await supabase
      .from("finance_payments")
      .select("*", { count: "exact", head: true });
    
    const seq = (count || 0) + 1;
    const paymentNumber = `${prefix}${String(seq).padStart(4, "0")}`;

    // Insert Payment Entry
    const { data: newPayment, error: payErr } = await supabase
      .from("finance_payments")
      .insert({
        payment_number: paymentNumber,
        invoice_id: invoice.id,
        customer_name: invoice.customer_name,
        amount: data.amount,
        payment_method: data.payment_method,
        transaction_reference: data.transaction_reference || null,
        payment_date: data.payment_date || new Date().toISOString().split("T")[0],
        remarks: data.remarks || null,
        proof_document_url: data.proof_document_url || null,
        status: "completed",
        recorded_by: user.id,
        branch_id: invoice.branch_id || user.branch_id || null,
      })
      .select()
      .single();

    if (payErr || !newPayment) throw payErr || new Error("Failed to insert payment record.");

    // Update Invoice Paid / Due amounts & Status
    const newPaidTotal = (Number(invoice.amount_paid) || 0) + data.amount;
    const newDueTotal = Math.max(0, (Number(invoice.total_amount) || 0) - newPaidTotal);
    const newStatus = newDueTotal <= 0 ? "paid" : "partially_paid";

    await supabase
      .from("finance_invoices")
      .update({
        amount_paid: newPaidTotal,
        amount_due: newDueTotal,
        status: newStatus,
        updated_at: new Date().toISOString(),
      })
      .eq("id", invoice.id);

    await logAudit({
      action: "record_payment",
      entity_type: "finance_payment",
      entity_id: newPayment.id,
      metadata: {
        payment_number: paymentNumber,
        invoice_number: invoice.invoice_number,
        amount: data.amount,
        new_status: newStatus,
      },
      user_id: user.id,
    });

    revalidatePath("/finance");
    return { success: true, payment: newPayment };
  } catch (error) {
    console.error("Error in recordPaymentAction:", error);
    return { success: false, error: (error as Error).message || "Failed to record payment." };
  }
}

/**
 * Issue Credit / Debit Note Action
 */
export async function createCreditDebitNoteAction(input: z.infer<typeof CreditDebitNoteSchema>) {
  const user = await getCurrentUser();
  if (!user || (!roleHasPermission(user.role, "finance.credit_note") && !roleHasPermission(user.role, "finance.debit_note"))) {
    return { success: false, error: "Unauthorized. Permission for credit/debit notes required." };
  }

  const parsed = CreditDebitNoteSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message || "Invalid note data." };
  }

  const data = parsed.data;
  const supabase = await createSupabaseServerClient();

  try {
    const { data: invoice } = await supabase
      .from("finance_invoices")
      .select("*")
      .eq("id", data.invoice_id)
      .single();

    if (!invoice) return { success: false, error: "Invoice not found." };

    const prefix = (data.note_type === "credit_note" ? "CN-" : "DN-") + new Date().getFullYear() + "-";
    const { count } = await supabase
      .from("finance_credit_debit_notes")
      .select("*", { count: "exact", head: true });
    
    const seq = (count || 0) + 1;
    const noteNumber = `${prefix}${String(seq).padStart(4, "0")}`;

    const { data: newNote, error: noteErr } = await supabase
      .from("finance_credit_debit_notes")
      .insert({
        note_number: noteNumber,
        note_type: data.note_type,
        invoice_id: invoice.id,
        amount: data.amount,
        tax_amount: data.tax_amount || 0,
        reason: data.reason,
        status: "issued",
        issued_by: user.id,
        branch_id: invoice.branch_id || user.branch_id || null,
      })
      .select()
      .single();

    if (noteErr || !newNote) throw noteErr || new Error("Failed to issue note.");

    // Update invoice total amount / amount due depending on Credit Note or Debit Note
    let updatedTotal = Number(invoice.total_amount);
    if (data.note_type === "credit_note") {
      updatedTotal = Math.max(0, updatedTotal - data.amount);
    } else {
      updatedTotal += data.amount;
    }
    const updatedDue = Math.max(0, updatedTotal - Number(invoice.amount_paid));

    await supabase
      .from("finance_invoices")
      .update({
        total_amount: updatedTotal,
        amount_due: updatedDue,
        updated_at: new Date().toISOString(),
      })
      .eq("id", invoice.id);

    await logAudit({
      action: `issue_${data.note_type}`,
      entity_type: "finance_credit_debit_note",
      entity_id: newNote.id,
      metadata: { note_number: noteNumber, invoice_number: invoice.invoice_number, amount: data.amount },
      user_id: user.id,
    });

    revalidatePath("/finance");
    return { success: true, note: newNote };
  } catch (error) {
    console.error("Error in createCreditDebitNoteAction:", error);
    return { success: false, error: (error as Error).message || "Failed to create note." };
  }
}

/**
 * Create Expense Action (with limit threshold approval checks)
 */
export async function createExpenseAction(input: z.infer<typeof CreateExpenseSchema>) {
  const user = await getCurrentUser();
  if (!user || !roleHasPermission(user.role, "finance.expense.manage")) {
    return { success: false, error: "Unauthorized. Permission 'finance.expense.manage' required." };
  }

  const parsed = CreateExpenseSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message || "Invalid expense data." };
  }

  const data = parsed.data;
  const supabase = await createSupabaseServerClient();

  try {
    const prefix = "EXP-" + new Date().getFullYear() + "-";
    const { count } = await supabase
      .from("finance_expenses")
      .select("*", { count: "exact", head: true });

    const seq = (count || 0) + 1;
    const expenseNumber = `${prefix}${String(seq).padStart(4, "0")}`;

    // Expense threshold check (e.g. ₹50,000)
    const thresholdLimit = 50000;
    const isExceeded = data.amount > thresholdLimit;
    const initialStatus = isExceeded ? "escalated_higher_approval" : "approved";

    const { data: newExpense, error: expErr } = await supabase
      .from("finance_expenses")
      .insert({
        expense_number: expenseNumber,
        category: data.category,
        amount: data.amount,
        expense_date: data.expense_date || new Date().toISOString().split("T")[0],
        branch_id: data.branch_id || user.branch_id || null,
        department_id: data.department_id || null,
        vendor_name: data.vendor_name || null,
        vendor_id: data.vendor_id || null,
        payment_method: data.payment_method || "bank_transfer",
        supporting_document_url: data.supporting_document_url || null,
        remarks: data.remarks || null,
        approval_status: initialStatus,
        approval_limit_exceeded: isExceeded,
        requires_higher_approval: isExceeded,
        approved_by: isExceeded ? null : user.id,
        recorded_by: user.id,
      })
      .select()
      .single();

    if (expErr || !newExpense) throw expErr || new Error("Failed to record expense.");

    await logAudit({
      action: "create_expense",
      entity_type: "finance_expense",
      entity_id: newExpense.id,
      metadata: { expense_number: expenseNumber, amount: data.amount, approval_status: initialStatus },
      user_id: user.id,
    });

    revalidatePath("/finance");
    return { success: true, expense: newExpense };
  } catch (error) {
    console.error("Error in createExpenseAction:", error);
    return { success: false, error: (error as Error).message || "Failed to create expense." };
  }
}

/**
 * Approve or Reject Expense Action
 */
export async function approveExpenseAction(expenseId: string, action: "approve" | "reject" | "hold") {
  const user = await getCurrentUser();
  if (!user || !roleHasPermission(user.role, "finance.expense.approve")) {
    return { success: false, error: "Unauthorized. Permission 'finance.expense.approve' required." };
  }

  const supabase = await createSupabaseServerClient();

  try {
    const statusMap = {
      approve: "approved",
      reject: "rejected",
      hold: "on_hold",
    };

    const newStatus = statusMap[action];

    const { error } = await supabase
      .from("finance_expenses")
      .update({
        approval_status: newStatus,
        approved_by: action === "approve" ? user.id : null,
      })
      .eq("id", expenseId);

    if (error) throw error;

    await logAudit({
      action: `${action}_expense`,
      entity_type: "finance_expense",
      entity_id: expenseId,
      metadata: { approval_status: newStatus },
      user_id: user.id,
    });

    revalidatePath("/finance");
    return { success: true };
  } catch (error) {
    console.error("Error in approveExpenseAction:", error);
    return { success: false, error: (error as Error).message || "Failed to update expense approval." };
  }
}

/**
 * Perform 3-Way Match Verification (PO ↔ GRN ↔ Supplier Invoice)
 */
export async function review3WayMatchAction(input: z.infer<typeof ThreeWayMatchSchema>) {
  const user = await getCurrentUser();
  if (!user || !roleHasPermission(user.role, "finance.3way_match")) {
    return { success: false, error: "Unauthorized. Permission 'finance.3way_match' required." };
  }

  const parsed = ThreeWayMatchSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message || "Invalid 3-way match data." };
  }

  const data = parsed.data;
  const supabase = await createSupabaseServerClient();

  try {
    // 3-Way Match Rule Check: PO Qty vs GRN Qty vs Invoice Qty & Amounts!
    let matchStatus: string = "matched";
    let holdReason: string | null = null;

    const poQty = data.po_quantity || 0;
    const grnQty = data.grn_quantity || 0;
    const invQty = data.invoice_quantity || 0;

    const poAmt = data.po_amount || 0;
    const invAmt = data.supplier_invoice_amount || 0;

    const isQtyMismatch = poQty !== grnQty || grnQty !== invQty || poQty !== invQty;
    const isAmtMismatch = Math.abs(poAmt - invAmt) > 0.01;

    if (isQtyMismatch && isAmtMismatch) {
      matchStatus = "on_hold";
      holdReason = `Quantity Mismatch (PO: ${poQty}, GRN: ${grnQty}, Inv: ${invQty}) AND Amount Mismatch (PO: ₹${poAmt}, Inv: ₹${invAmt})`;
    } else if (isQtyMismatch) {
      matchStatus = "on_hold";
      holdReason = `Quantity Mismatch detected (PO Quantity: ${poQty}, GRN Received: ${grnQty}, Supplier Invoice Qty: ${invQty}). Payment placed ON HOLD per finance rule.`;
    } else if (isAmtMismatch) {
      matchStatus = "on_hold";
      holdReason = `Price / Amount Mismatch detected (PO Amount: ₹${poAmt}, Supplier Invoice Amount: ₹${invAmt}). Payment placed ON HOLD per finance rule.`;
    } else {
      matchStatus = "approved_for_payment";
      holdReason = null;
    }

    if (data.hold_reason) {
      holdReason = data.hold_reason;
      matchStatus = "on_hold";
    }

    const { data: newMatch, error: matchErr } = await supabase
      .from("finance_3way_matching_reviews")
      .insert({
        po_id: data.po_id,
        po_number: data.po_number,
        grn_id: data.grn_id || null,
        grn_number: data.grn_number || null,
        supplier_invoice_number: data.supplier_invoice_number || null,
        supplier_invoice_amount: data.supplier_invoice_amount || null,
        po_amount: data.po_amount || null,
        grn_quantity: data.grn_quantity || null,
        po_quantity: data.po_quantity || null,
        invoice_quantity: data.invoice_quantity || null,
        match_status: matchStatus,
        hold_reason: holdReason,
        reviewed_by: user.id,
      })
      .select()
      .single();

    if (matchErr || !newMatch) throw matchErr || new Error("Failed to save 3-way match review.");

    await logAudit({
      action: "3way_match_review",
      entity_type: "finance_3way_matching_review",
      entity_id: newMatch.id,
      metadata: { po_number: data.po_number, match_status: matchStatus, hold_reason: holdReason },
      user_id: user.id,
    });

    revalidatePath("/finance");
    return { success: true, review: newMatch, isHold: matchStatus === "on_hold", holdReason };
  } catch (error) {
    console.error("Error in review3WayMatchAction:", error);
    return { success: false, error: (error as Error).message || "Failed to perform 3-way match." };
  }
}

/**
 * Record Vendor Payment Voucher
 */
export async function recordVendorPaymentAction(input: {
  vendor_id?: string;
  po_id?: string;
  amount: number;
  payment_method: string;
  transaction_reference?: string;
  remarks?: string;
}) {
  const user = await getCurrentUser();
  if (!user || !roleHasPermission(user.role, "finance.payable.manage")) {
    return { success: false, error: "Unauthorized. Permission 'finance.payable.manage' required." };
  }

  const supabase = await createSupabaseServerClient();

  try {
    const prefix = "VPV-" + new Date().getFullYear() + "-";
    const { count } = await supabase
      .from("finance_vendor_payments")
      .select("*", { count: "exact", head: true });

    const seq = (count || 0) + 1;
    const voucherNumber = `${prefix}${String(seq).padStart(4, "0")}`;

    const { data: newVP, error: vpErr } = await supabase
      .from("finance_vendor_payments")
      .insert({
        voucher_number: voucherNumber,
        vendor_id: input.vendor_id || null,
        po_id: input.po_id || null,
        amount: input.amount,
        payment_method: input.payment_method,
        transaction_reference: input.transaction_reference || null,
        remarks: input.remarks || null,
        approval_status: "approved",
        approved_by: user.id,
        branch_id: user.branch_id || null,
      })
      .select()
      .single();

    if (vpErr || !newVP) throw vpErr || new Error("Failed to insert vendor payment.");

    await logAudit({
      action: "record_vendor_payment",
      entity_type: "finance_vendor_payment",
      entity_id: newVP.id,
      metadata: { voucher_number: voucherNumber, amount: input.amount },
      user_id: user.id,
    });

    revalidatePath("/finance");
    return { success: true, payment: newVP };
  } catch (error) {
    console.error("Error in recordVendorPaymentAction:", error);
    return { success: false, error: (error as Error).message || "Failed to record vendor payment." };
  }
}

/**
 * Add Receivable Follow-up Note / Mark Disputed
 */
export async function addReceivableFollowupAction(input: {
  invoice_id: string;
  action_type: "reminder_sent" | "disputed" | "escalated" | "note_added";
  notes: string;
}) {
  const user = await getCurrentUser();
  if (!user || !roleHasPermission(user.role, "finance.receivable.manage")) {
    return { success: false, error: "Unauthorized. Permission 'finance.receivable.manage' required." };
  }

  const supabase = await createSupabaseServerClient();

  try {
    const { error: insErr } = await supabase.from("finance_receivable_followups").insert({
      invoice_id: input.invoice_id,
      action_type: input.action_type,
      notes: input.notes,
      performed_by: user.id,
    });

    if (insErr) throw insErr;

    // If marked disputed, update invoice status
    if (input.action_type === "disputed") {
      await supabase
        .from("finance_invoices")
        .update({ status: "disputed", updated_at: new Date().toISOString() })
        .eq("id", input.invoice_id);
    }

    await logAudit({
      action: "add_receivable_followup",
      entity_type: "finance_invoice",
      entity_id: input.invoice_id,
      metadata: { action_type: input.action_type, notes: input.notes },
      user_id: user.id,
    });

    revalidatePath("/finance");
    return { success: true };
  } catch (error) {
    console.error("Error in addReceivableFollowupAction:", error);
    return { success: false, error: (error as Error).message || "Failed to add followup note." };
  }
}

/**
 * Update Finance Settings
 */
export async function updateFinanceSettingsAction(settings: Record<string, unknown>) {
  const user = await getCurrentUser();
  if (!user || !roleHasPermission(user.role, "finance.settings.manage")) {
    return { success: false, error: "Unauthorized. Permission 'finance.settings.manage' required." };
  }

  const supabase = await createSupabaseServerClient();

  try {
    for (const [key, val] of Object.entries(settings)) {
      await supabase
        .from("finance_settings")
        .upsert({ key, value: val, updated_at: new Date().toISOString() });
    }

    await logAudit({
      action: "update_finance_settings",
      entity_type: "finance_settings",
      metadata: settings,
      user_id: user.id,
    });

    revalidatePath("/finance");
    return { success: true };
  } catch (error) {
    console.error("Error in updateFinanceSettingsAction:", error);
    return { success: false, error: (error as Error).message || "Failed to update settings." };
  }
}
