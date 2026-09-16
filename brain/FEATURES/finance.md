# Feature Documentation — Role 13: Finance Manager

## Overview
The **Finance Manager** role owns the complete **financial transaction lifecycle**: invoices, payments, receivables aging, payables, expenses, 3-way matching (PO ↔ GRN ↔ Supplier Invoice), financial verification, and financial reporting.

---

## Access Scope & Core Governance Rules

- **Scope Level**: `ORGANIZATION` / Authorized Branches
- **Core Governance Rule**:
  Finance Manager owns financial records and monetary ledgers. They can financially review transactions from Sales, Rental, and Store, but **cannot control operational activities** (e.g. machine service complaint handling, inventory stock movements, rental machine dispatch, employee master HR records, or system RBAC).

### Key Rules Enforced
1. **Invoice Finalization Lock**: Unfinalized draft invoices can be modified before finalization. Once finalized (`is_finalized = true`), direct editing is strictly blocked. Amendments must be issued via **Credit Note** or **Debit Note**.
2. **3-Way PO Matching Protocol (PO ↔ GRN ↔ Supplier Invoice)**:
   Matching PO quantities and amounts vs GRN received quantities vs Supplier Invoice. Mismatches automatically set status to `on_hold` / `mismatch_quantity` / `mismatch_amount`, triggering an automated Payment Hold.
3. **Expense Threshold & Approval Governance**:
   Expenses exceeding ₹50,000 threshold are automatically flagged for `escalated_higher_approval` (Admin / Super Admin).
4. **HR Salary Data Protection**:
   Finance Manager can view approved payroll totals, department salary costs, and branch salary costs for financial reporting, but individual employee personal salary details remain protected.

---

## DB Schema (`029_finance_manager_role_refinements.sql`)

1. `public.finance_invoices`: Invoices header table.
2. `public.finance_invoice_items`: Invoice line items.
3. `public.finance_payments`: Payments ledger supporting partial payments.
4. `public.finance_credit_debit_notes`: Credit Note & Debit Note adjustments linked to finalized invoices.
5. `public.finance_expense_categories`: Expense category master.
6. `public.finance_expenses`: Operational expense entries with approval limit checks.
7. `public.finance_3way_matching_reviews`: PO ↔ GRN ↔ Supplier Invoice 3-way verification log.
8. `public.finance_vendor_payments`: Supplier payment vouchers.
9. `public.finance_receivable_followups`: Aging follow-up log, payment reminders, disputed flags.
10. `public.finance_settings`: Financial parameters, invoice numbering rules, tax rates.

---

## Server Actions (`app/actions/finance.ts`)

- `createInvoiceAction`: Generates sales, rental, service, or custom invoice draft.
- `updateInvoiceAction`: Modifies invoice draft (blocked on finalized invoices!).
- `finalizeInvoiceAction`: Finalizes invoice (`is_finalized = true`).
- `recordPaymentAction`: Records payment against invoice (recalculates amount_due and sets status to `partially_paid` or `paid`).
- `createCreditDebitNoteAction`: Issues Credit/Debit note against finalized invoice.
- `createExpenseAction`: Records expense entry with threshold check.
- `approveExpenseAction`: Approves or rejects operational expense.
- `review3WayMatchAction`: Evaluates PO vs GRN vs Supplier Invoice for payment clearance or hold.
- `recordVendorPaymentAction`: Executes vendor disbursement voucher.
- `addReceivableFollowupAction`: Adds follow-up note, sends reminder, or marks invoice disputed.
- `updateFinanceSettingsAction`: Saves finance configurations.

---

## Frontend Hub (`components/finance/FinanceClient.tsx`, `app/(app)/finance/page.tsx`)

11-Tab Finance Suite:
1. **Dashboard**: Revenue & Expense KPI cards, Net Profit/Loss, Cash Flow Summary, Quick Actions.
2. **Sales & Rental Review**: Review incoming commercial terms for billing.
3. **Invoices & Notes**: Invoice directory, draft/finalized lock, Credit/Debit Note generator.
4. **Payment Ledger**: Payments history, Record Payment modal with partial payment calculator.
5. **Receivables Aging**: 0–30, 31–60, 61–90, 90+ Days aging cards, payment reminders, dispute flags.
6. **Payables & Vendors**: Pending supplier payables, vendor payments.
7. **3-Way Match Verification**: Interactive PO ↔ GRN ↔ Supplier Invoice comparison matrix.
8. **Expenses**: Categorized operational expenses, approval workflow.
9. **Payroll Summaries**: Department & Branch aggregated salary expenditure summaries.
10. **Financial Reports**: Revenue, Receivables, Payables, Expenses, Profitability, and Tax CSV exports.
11. **Finance Settings**: Document numbering format, default GST rate, expense approval threshold.
