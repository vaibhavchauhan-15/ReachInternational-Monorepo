"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  DollarSign,
  TrendingUp,
  TrendingDown,
  FileText,
  CreditCard,
  AlertTriangle,
  CheckCircle,
  Plus,
  Search,
  Filter,
  Download,
  Printer,
  X,
  Clock,
  ShieldCheck,
  Building2,
  Users,
  Eye,
  Lock,
  RotateCcw,
  Check,
  Send,
  FileCheck,
  AlertCircle,
  ChevronRight,
  PieChart,
  Sliders,
  Percent,
} from "lucide-react";
import type {
  FinanceInvoice,
  FinancePayment,
  FinanceExpense,
  FinanceExpenseCategory,
  Finance3WayMatchingReview,
  FinanceVendorPayment,
  FinanceDashboardMetrics,
  User,
} from "@/lib/types/database";
import {
  createInvoiceAction,
  updateInvoiceAction,
  finalizeInvoiceAction,
  recordPaymentAction,
  createCreditDebitNoteAction,
  createExpenseAction,
  approveExpenseAction,
  review3WayMatchAction,
  recordVendorPaymentAction,
  addReceivableFollowupAction,
  updateFinanceSettingsAction,
} from "@/app/actions/finance";

interface FinanceClientProps {
  user: User;
  metrics: FinanceDashboardMetrics;
  invoices: FinanceInvoice[];
  payments: FinancePayment[];
  expenses: FinanceExpense[];
  expenseCategories: FinanceExpenseCategory[];
  threeWayMatches: Finance3WayMatchingReview[];
  vendorPayments: FinanceVendorPayment[];
  receivablesAging: {
    totalOutstanding: number;
    buckets: {
      "0_30": { label: string; amount: number; count: number; items: FinanceInvoice[] };
      "31_60": { label: string; amount: number; count: number; items: FinanceInvoice[] };
      "61_90": { label: string; amount: number; count: number; items: FinanceInvoice[] };
      "90_plus": { label: string; amount: number; count: number; items: FinanceInvoice[] };
    };
    unpaidInvoices: FinanceInvoice[];
  };
  financeSettings: Record<string, unknown>;
}

export function FinanceClient({
  user,
  metrics,
  invoices: initialInvoices,
  payments: initialPayments,
  expenses: initialExpenses,
  expenseCategories,
  threeWayMatches: initialMatches,
  vendorPayments: initialVendorPayments,
  receivablesAging,
  financeSettings,
}: FinanceClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const activeTab = searchParams.get("tab") || "dashboard";

  const [invoices, setInvoices] = useState<FinanceInvoice[]>(initialInvoices);
  const [payments, setPayments] = useState<FinancePayment[]>(initialPayments);
  const [expenses, setExpenses] = useState<FinanceExpense[]>(initialExpenses);
  const [threeWayMatches, setThreeWayMatches] = useState<Finance3WayMatchingReview[]>(initialMatches);
  const [vendorPayments, setVendorPayments] = useState<FinanceVendorPayment[]>(initialVendorPayments);

  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [toastMessage, setToastMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Modals state
  const [showCreateInvoiceModal, setShowCreateInvoiceModal] = useState(false);
  const [showRecordPaymentModal, setShowRecordPaymentModal] = useState(false);
  const [showCreditDebitModal, setShowCreditDebitModal] = useState(false);
  const [showExpenseModal, setShowExpenseModal] = useState(false);
  const [show3WayMatchModal, setShow3WayMatchModal] = useState(false);
  const [showVendorPaymentModal, setShowVendorPaymentModal] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<FinanceInvoice | null>(null);

  // Form states
  const [invoiceForm, setInvoiceForm] = useState({
    invoice_type: "sales" as "sales" | "rental" | "service" | "custom",
    customer_name: "",
    customer_gstin: "",
    billing_address: "",
    due_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
    item_description: "",
    unit_price: 0,
    quantity: 1,
    tax_rate: 18,
    notes: "",
  });

  const [paymentForm, setPaymentForm] = useState({
    invoice_id: "",
    amount: 0,
    payment_method: "bank_transfer" as "bank_transfer" | "upi" | "cheque" | "cash" | "card" | "other",
    transaction_reference: "",
    remarks: "",
  });

  const [creditNoteForm, setCreditNoteForm] = useState({
    note_type: "credit_note" as "credit_note" | "debit_note",
    amount: 0,
    reason: "",
  });

  const [expenseForm, setExpenseForm] = useState({
    category: expenseCategories[0]?.name || "Fuel",
    amount: 0,
    vendor_name: "",
    payment_method: "bank_transfer",
    remarks: "",
  });

  const [matchForm, setMatchForm] = useState({
    po_id: "po-101",
    po_number: "PO-2026-0042",
    supplier_invoice_number: "INV-SUP-8821",
    po_amount: 150000,
    supplier_invoice_amount: 150000,
    po_quantity: 10,
    grn_quantity: 10,
    invoice_quantity: 10,
    hold_reason: "",
  });

  const showToast = (text: string, type: "success" | "error" = "success") => {
    setToastMessage({ type, text });
    setTimeout(() => setToastMessage(null), 4000);
  };

  const handleTabChange = (tab: string) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("tab", tab);
    router.push(`/finance?${params.toString()}`);
  };

  // Action Handlers
  const handleCreateInvoice = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    const res = await createInvoiceAction({
      invoice_type: invoiceForm.invoice_type,
      customer_name: invoiceForm.customer_name,
      customer_gstin: invoiceForm.customer_gstin,
      billing_address: invoiceForm.billing_address,
      due_date: invoiceForm.due_date,
      notes: invoiceForm.notes,
      items: [
        {
          description: invoiceForm.item_description || "Standard Billing Service",
          item_type: "item",
          quantity: Number(invoiceForm.quantity),
          unit_price: Number(invoiceForm.unit_price),
          discount_percent: 0,
          tax_rate: Number(invoiceForm.tax_rate),
        },
      ],
    });

    setIsSubmitting(false);
    if (res.success && res.invoice) {
      showToast(`Invoice ${res.invoice.invoice_number} created as Draft successfully.`);
      setShowCreateInvoiceModal(false);
      setInvoices([res.invoice as FinanceInvoice, ...invoices]);
    } else {
      showToast(res.error || "Failed to create invoice", "error");
    }
  };

  const handleFinalizeInvoice = async (invoiceId: string) => {
    setIsSubmitting(true);
    const res = await finalizeInvoiceAction(invoiceId);
    setIsSubmitting(false);
    if (res.success) {
      showToast("Invoice finalized and locked against direct edits.");
      setInvoices(
        invoices.map((inv) =>
          inv.id === invoiceId ? { ...inv, is_finalized: true, status: "finalized" } : inv
        )
      );
    } else {
      showToast(res.error || "Failed to finalize invoice", "error");
    }
  };

  const handleRecordPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    const res = await recordPaymentAction({
      invoice_id: paymentForm.invoice_id,
      amount: Number(paymentForm.amount),
      payment_method: paymentForm.payment_method,
      transaction_reference: paymentForm.transaction_reference,
      remarks: paymentForm.remarks,
    });

    setIsSubmitting(false);
    if (res.success && res.payment) {
      showToast(`Payment of ₹${paymentForm.amount.toLocaleString("en-IN")} recorded successfully.`);
      setShowRecordPaymentModal(false);
      setPayments([res.payment as FinancePayment, ...payments]);
      router.refresh();
    } else {
      showToast(res.error || "Failed to record payment", "error");
    }
  };

  const handleIssueCreditDebitNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedInvoice) return;
    setIsSubmitting(true);
    const res = await createCreditDebitNoteAction({
      invoice_id: selectedInvoice.id,
      note_type: creditNoteForm.note_type,
      amount: Number(creditNoteForm.amount),
      tax_amount: 0,
      reason: creditNoteForm.reason,
    });

    setIsSubmitting(false);
    if (res.success) {
      showToast(`${creditNoteForm.note_type === "credit_note" ? "Credit Note" : "Debit Note"} issued successfully.`);
      setShowCreditDebitModal(false);
      router.refresh();
    } else {
      showToast(res.error || "Failed to issue note", "error");
    }
  };

  const handleCreateExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    const res = await createExpenseAction({
      category: expenseForm.category,
      amount: Number(expenseForm.amount),
      vendor_name: expenseForm.vendor_name,
      payment_method: expenseForm.payment_method,
      remarks: expenseForm.remarks,
    });

    setIsSubmitting(false);
    if (res.success && res.expense) {
      showToast(
        res.expense.requires_higher_approval
          ? "Expense recorded & escalated for Higher Approval (> ₹50,000 threshold)."
          : "Expense recorded & approved successfully."
      );
      setShowExpenseModal(false);
      setExpenses([res.expense as FinanceExpense, ...expenses]);
    } else {
      showToast(res.error || "Failed to record expense", "error");
    }
  };

  const handleRun3WayMatch = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    const res = await review3WayMatchAction({
      po_id: matchForm.po_id,
      po_number: matchForm.po_number,
      supplier_invoice_number: matchForm.supplier_invoice_number,
      po_amount: Number(matchForm.po_amount),
      supplier_invoice_amount: Number(matchForm.supplier_invoice_amount),
      po_quantity: Number(matchForm.po_quantity),
      grn_quantity: Number(matchForm.grn_quantity),
      invoice_quantity: Number(matchForm.invoice_quantity),
      hold_reason: matchForm.hold_reason || undefined,
    });

    setIsSubmitting(false);
    if (res.success && res.review) {
      if (res.isHold) {
        showToast(`3-Way Mismatch Detected! Payment placed ON HOLD: ${res.holdReason}`, "error");
      } else {
        showToast("3-Way Match Verified! Approved for payment disbursement.");
      }
      setShow3WayMatchModal(false);
      setThreeWayMatches([res.review as Finance3WayMatchingReview, ...threeWayMatches]);
    } else {
      showToast(res.error || "3-Way match evaluation failed", "error");
    }
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Toast Banner */}
      <AnimatePresence>
        {toastMessage && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className={`fixed top-4 right-4 z-50 p-4 rounded-xl shadow-lg border backdrop-blur-md flex items-center gap-3 ${
              toastMessage.type === "error"
                ? "bg-rose-500/10 border-rose-500/30 text-rose-400"
                : "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
            }`}
          >
            {toastMessage.type === "error" ? (
              <AlertTriangle className="h-5 w-5 shrink-0" />
            ) : (
              <CheckCircle className="h-5 w-5 shrink-0" />
            )}
            <span className="text-sm font-medium">{toastMessage.text}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header Banner */}
      <div className="p-6 rounded-2xl border border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)] flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-emerald-500 mb-1">
            <DollarSign className="h-4 w-4" /> Finance & Accounting Lifecycle Manager
          </div>
          <h1 className="text-2xl font-bold text-[var(--color-ink)]">Finance Management Suite</h1>
          <p className="text-sm text-[var(--color-mute)] mt-1">
            Invoices, Payments, Receivables Aging, 3-Way PO Verification, Expenses & Cash Flow
          </p>
        </div>

        {/* Global Finance Actions */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setShowCreateInvoiceModal(true)}
            className="px-4 py-2 text-sm font-medium rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white shadow-md flex items-center gap-2 transition-all"
          >
            <Plus className="h-4 w-4" /> Create Invoice
          </button>
          <button
            onClick={() => setShowRecordPaymentModal(true)}
            className="px-4 py-2 text-sm font-medium rounded-xl bg-sky-600 hover:bg-sky-500 text-white shadow-md flex items-center gap-2 transition-all"
          >
            <CreditCard className="h-4 w-4" /> Record Payment
          </button>
          <button
            onClick={() => setShowExpenseModal(true)}
            className="px-4 py-2 text-sm font-medium rounded-xl bg-purple-600 hover:bg-purple-500 text-white shadow-md flex items-center gap-2 transition-all"
          >
            <DollarSign className="h-4 w-4" /> Record Expense
          </button>
        </div>
      </div>

      {/* 11 Navigation Tabs */}
      <div className="border-b border-[var(--color-hairline)] overflow-x-auto scrollbar-none">
        <div className="flex items-center gap-1 min-w-max pb-2">
          {[
            { id: "dashboard", label: "Dashboard", icon: PieChart },
            { id: "sales-review", label: "Sales & Rental Review", icon: FileText },
            { id: "invoices", label: "Invoices & Notes", icon: FileCheck },
            { id: "payments", label: "Payment Ledger", icon: CreditCard },
            { id: "receivables", label: "Receivables Aging", icon: Clock },
            { id: "payables", label: "Payables & Vendors", icon: Building2 },
            { id: "po-match", label: "3-Way Match Verification", icon: ShieldCheck },
            { id: "expenses", label: "Expenses", icon: TrendingDown },
            { id: "payroll", label: "Payroll Summaries", icon: Users },
            { id: "reports", label: "Financial Reports", icon: TrendingUp },
            { id: "settings", label: "Finance Settings", icon: Sliders },
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => handleTabChange(tab.id)}
                className={`px-3.5 py-2 text-sm font-medium rounded-xl flex items-center gap-2 transition-all ${
                  isActive
                    ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/30"
                    : "text-[var(--color-mute)] hover:text-[var(--color-ink)] hover:bg-[var(--color-hairline-soft-surface)]"
                }`}
              >
                <Icon className="h-4 w-4" />
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* TAB CONTENT RENDER */}

      {/* TAB 1: FINANCE DASHBOARD */}
      {activeTab === "dashboard" && (
        <div className="space-y-6">
          {/* KPI Cards Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="p-5 rounded-2xl border border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)] space-y-2">
              <div className="flex items-center justify-between text-xs text-[var(--color-mute)] font-medium">
                <span>TOTAL REVENUE</span>
                <span className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-400"><TrendingUp className="h-4 w-4" /></span>
              </div>
              <div className="text-2xl font-bold text-[var(--color-ink)]">
                ₹{metrics.totalRevenue.toLocaleString("en-IN")}
              </div>
              <div className="text-xs text-[var(--color-mute)]">
                Sales: ₹{metrics.salesRevenue.toLocaleString("en-IN")} | Rental: ₹{metrics.rentalRevenue.toLocaleString("en-IN")}
              </div>
            </div>

            <div className="p-5 rounded-2xl border border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)] space-y-2">
              <div className="flex items-center justify-between text-xs text-[var(--color-mute)] font-medium">
                <span>OUTSTANDING RECEIVABLES</span>
                <span className="p-1.5 rounded-lg bg-amber-500/10 text-amber-400"><Clock className="h-4 w-4" /></span>
              </div>
              <div className="text-2xl font-bold text-amber-400">
                ₹{metrics.outstandingReceivables.toLocaleString("en-IN")}
              </div>
              <div className="text-xs text-[var(--color-mute)]">
                Overdue Invoices: {metrics.overdueInvoicesCount} | Pending Payments: {metrics.pendingPaymentsCount}
              </div>
            </div>

            <div className="p-5 rounded-2xl border border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)] space-y-2">
              <div className="flex items-center justify-between text-xs text-[var(--color-mute)] font-medium">
                <span>TOTAL EXPENSES</span>
                <span className="p-1.5 rounded-lg bg-rose-500/10 text-rose-400"><TrendingDown className="h-4 w-4" /></span>
              </div>
              <div className="text-2xl font-bold text-rose-400">
                ₹{metrics.totalExpenses.toLocaleString("en-IN")}
              </div>
              <div className="text-xs text-[var(--color-mute)]">
                Pending Vendor Payables: ₹{metrics.pendingVendorPayments.toLocaleString("en-IN")}
              </div>
            </div>

            <div className="p-5 rounded-2xl border border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)] space-y-2">
              <div className="flex items-center justify-between text-xs text-[var(--color-mute)] font-medium">
                <span>NET MONTHLY PROFIT / LOSS</span>
                <span className="p-1.5 rounded-lg bg-sky-500/10 text-sky-400"><DollarSign className="h-4 w-4" /></span>
              </div>
              <div className="text-2xl font-bold text-sky-400">
                ₹{metrics.netProfitLoss.toLocaleString("en-IN")}
              </div>
              <div className="text-xs text-[var(--color-mute)]">
                Monthly Income: ₹{metrics.monthlyIncome.toLocaleString("en-IN")} | Expenses: ₹{metrics.monthlyExpenses.toLocaleString("en-IN")}
              </div>
            </div>
          </div>

          {/* Income vs Expense & Cash Flow Summary */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="p-6 rounded-2xl border border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)] space-y-4">
              <h3 className="text-base font-semibold text-[var(--color-ink)] flex items-center gap-2">
                <PieChart className="h-5 w-5 text-emerald-400" /> Revenue & Cash-Flow Overview
              </h3>
              <div className="space-y-3">
                <div>
                  <div className="flex justify-between text-xs font-medium mb-1">
                    <span className="text-[var(--color-mute)]">Cash Received</span>
                    <span className="text-emerald-400 font-semibold">₹{metrics.cashReceived.toLocaleString("en-IN")}</span>
                  </div>
                  <div className="h-2 rounded-full bg-[var(--color-hairline)] overflow-hidden">
                    <div className="h-full bg-emerald-500 rounded-full" style={{ width: "75%" }} />
                  </div>
                </div>
                <div>
                  <div className="flex justify-between text-xs font-medium mb-1">
                    <span className="text-[var(--color-mute)]">Cash Paid Out</span>
                    <span className="text-rose-400 font-semibold">₹{metrics.cashPaid.toLocaleString("en-IN")}</span>
                  </div>
                  <div className="h-2 rounded-full bg-[var(--color-hairline)] overflow-hidden">
                    <div className="h-full bg-rose-500 rounded-full" style={{ width: "25%" }} />
                  </div>
                </div>
                <div className="p-4 rounded-xl bg-[var(--color-hairline-soft-surface)] flex justify-between items-center">
                  <span className="text-sm font-medium text-[var(--color-ink)]">Net Cash Flow Movement</span>
                  <span className="text-lg font-bold text-emerald-400">₹{metrics.netCashFlow.toLocaleString("en-IN")}</span>
                </div>
              </div>
            </div>

            {/* Quick Actions Panel */}
            <div className="p-6 rounded-2xl border border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)] space-y-4">
              <h3 className="text-base font-semibold text-[var(--color-ink)] flex items-center gap-2">
                <Sliders className="h-5 w-5 text-sky-400" /> Quick Financial Actions
              </h3>
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => setShowCreateInvoiceModal(true)}
                  className="p-3.5 rounded-xl border border-[var(--color-hairline)] hover:bg-emerald-500/10 hover:border-emerald-500/30 text-left transition-all group"
                >
                  <FileText className="h-5 w-5 text-emerald-400 mb-2 group-hover:scale-110 transition-transform" />
                  <div className="text-sm font-semibold text-[var(--color-ink)]">Create Invoice</div>
                  <div className="text-xs text-[var(--color-mute)]">Generate sales or rental invoice</div>
                </button>
                <button
                  onClick={() => setShowRecordPaymentModal(true)}
                  className="p-3.5 rounded-xl border border-[var(--color-hairline)] hover:bg-sky-500/10 hover:border-sky-500/30 text-left transition-all group"
                >
                  <CreditCard className="h-5 w-5 text-sky-400 mb-2 group-hover:scale-110 transition-transform" />
                  <div className="text-sm font-semibold text-[var(--color-ink)]">Record Payment</div>
                  <div className="text-xs text-[var(--color-mute)]">Full or partial customer payment</div>
                </button>
                <button
                  onClick={() => setShowExpenseModal(true)}
                  className="p-3.5 rounded-xl border border-[var(--color-hairline)] hover:bg-purple-500/10 hover:border-purple-500/30 text-left transition-all group"
                >
                  <TrendingDown className="h-5 w-5 text-purple-400 mb-2 group-hover:scale-110 transition-transform" />
                  <div className="text-sm font-semibold text-[var(--color-ink)]">Record Expense</div>
                  <div className="text-xs text-[var(--color-mute)]">Log operational expense</div>
                </button>
                <button
                  onClick={() => setShow3WayMatchModal(true)}
                  className="p-3.5 rounded-xl border border-[var(--color-hairline)] hover:bg-amber-500/10 hover:border-amber-500/30 text-left transition-all group"
                >
                  <ShieldCheck className="h-5 w-5 text-amber-400 mb-2 group-hover:scale-110 transition-transform" />
                  <div className="text-sm font-semibold text-[var(--color-ink)]">3-Way PO Match</div>
                  <div className="text-xs text-[var(--color-mute)]">Verify PO vs GRN vs Invoice</div>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: SALES & RENTAL REVIEW */}
      {activeTab === "sales-review" && (
        <div className="space-y-4">
          <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 text-sm flex items-start gap-3">
            <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
            <div>
              <span className="font-semibold">Financial Verification Mode:</span> Finance Managers can review incoming Sales Orders and Rental Contracts for pricing, tax, and discount verification before generating final invoices. Technical machine specs and operational pipeline remain protected.
            </div>
          </div>

          <div className="rounded-2xl border border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)] overflow-hidden">
            <div className="p-4 border-b border-[var(--color-hairline)] flex items-center justify-between">
              <h3 className="font-semibold text-[var(--color-ink)]">Incoming Orders & Contracts Ready for Billing</h3>
              <span className="text-xs px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                Commercial Terms Approved
              </span>
            </div>
            <div className="p-8 text-center text-sm text-[var(--color-mute)] space-y-3">
              <FileText className="h-10 w-10 mx-auto text-emerald-400 opacity-60" />
              <div className="text-base font-semibold text-[var(--color-ink)]">All incoming Sales & Rental orders verified</div>
              <p className="max-w-md mx-auto">
                No pending unbilled transactions. Click "Create Invoice" above to generate a new custom or contract invoice manually.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: INVOICES & CREDIT/DEBIT NOTES */}
      {activeTab === "invoices" && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="relative w-full sm:w-80">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-[var(--color-mute)]" />
              <input
                type="text"
                placeholder="Search invoice number or customer..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2 text-sm rounded-xl border border-[var(--color-hairline)] bg-[var(--color-canvas)] text-[var(--color-ink)] focus:outline-none focus:border-emerald-500"
              />
            </div>
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-3 py-2 text-sm rounded-xl border border-[var(--color-hairline)] bg-[var(--color-canvas)] text-[var(--color-ink)]"
              >
                <option value="all">All Statuses</option>
                <option value="draft">Draft</option>
                <option value="finalized">Finalized</option>
                <option value="paid">Paid</option>
                <option value="partially_paid">Partially Paid</option>
                <option value="overdue">Overdue</option>
              </select>
            </div>
          </div>

          <div className="rounded-2xl border border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)] overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-[var(--color-hairline-soft-surface)] text-xs uppercase text-[var(--color-mute)] font-medium border-b border-[var(--color-hairline)]">
                  <tr>
                    <th className="p-4">Invoice #</th>
                    <th className="p-4">Customer</th>
                    <th className="p-4">Type</th>
                    <th className="p-4">Due Date</th>
                    <th className="p-4">Total Amount</th>
                    <th className="p-4">Amount Due</th>
                    <th className="p-4">Status</th>
                    <th className="p-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--color-hairline)] text-[var(--color-ink)]">
                  {invoices.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="p-8 text-center text-[var(--color-mute)]">
                        No invoices found. Click "Create Invoice" to generate one.
                      </td>
                    </tr>
                  ) : (
                    invoices.map((inv) => (
                      <tr key={inv.id} className="hover:bg-[var(--color-hairline-soft-surface)] transition-colors">
                        <td className="p-4 font-semibold text-emerald-400">{inv.invoice_number}</td>
                        <td className="p-4">{inv.customer_name}</td>
                        <td className="p-4 uppercase text-xs font-semibold text-[var(--color-mute)]">{inv.invoice_type}</td>
                        <td className="p-4 text-xs">{inv.due_date}</td>
                        <td className="p-4 font-medium">₹{Number(inv.total_amount).toLocaleString("en-IN")}</td>
                        <td className="p-4 font-bold text-amber-400">₹{Number(inv.amount_due).toLocaleString("en-IN")}</td>
                        <td className="p-4">
                          <span
                            className={`px-2.5 py-1 rounded-full text-xs font-semibold ${
                              inv.status === "paid"
                                ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/30"
                                : inv.status === "partially_paid"
                                ? "bg-sky-500/10 text-sky-400 border border-sky-500/30"
                                : inv.status === "finalized"
                                ? "bg-purple-500/10 text-purple-400 border border-purple-500/30"
                                : "bg-amber-500/10 text-amber-400 border border-amber-500/30"
                            }`}
                          >
                            {inv.status}
                          </span>
                        </td>
                        <td className="p-4 text-right space-x-2">
                          {!inv.is_finalized ? (
                            <button
                              onClick={() => handleFinalizeInvoice(inv.id)}
                              className="px-3 py-1 text-xs rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white transition-all"
                            >
                              Finalize Lock
                            </button>
                          ) : (
                            <button
                              onClick={() => {
                                setSelectedInvoice(inv);
                                setShowCreditDebitModal(true);
                              }}
                              className="px-3 py-1 text-xs rounded-lg bg-purple-600 hover:bg-purple-500 text-white transition-all"
                            >
                              Issue Note
                            </button>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: PAYMENT LEDGER */}
      {activeTab === "payments" && (
        <div className="space-y-4">
          <div className="rounded-2xl border border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)] overflow-hidden">
            <div className="p-4 border-b border-[var(--color-hairline)] flex items-center justify-between">
              <h3 className="font-semibold text-[var(--color-ink)]">Customer Payments Ledger</h3>
              <button
                onClick={() => setShowRecordPaymentModal(true)}
                className="px-3 py-1.5 text-xs font-medium rounded-lg bg-sky-600 hover:bg-sky-500 text-white flex items-center gap-1.5"
              >
                <Plus className="h-3.5 w-3.5" /> Record New Payment
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-[var(--color-hairline-soft-surface)] text-xs uppercase text-[var(--color-mute)] font-medium border-b border-[var(--color-hairline)]">
                  <tr>
                    <th className="p-4">Payment #</th>
                    <th className="p-4">Customer</th>
                    <th className="p-4">Invoice #</th>
                    <th className="p-4">Payment Method</th>
                    <th className="p-4">Ref / UTR</th>
                    <th className="p-4">Date</th>
                    <th className="p-4">Amount Paid</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--color-hairline)] text-[var(--color-ink)]">
                  {payments.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="p-8 text-center text-[var(--color-mute)]">
                        No payments recorded yet.
                      </td>
                    </tr>
                  ) : (
                    payments.map((p) => (
                      <tr key={p.id} className="hover:bg-[var(--color-hairline-soft-surface)] transition-colors">
                        <td className="p-4 font-semibold text-sky-400">{p.payment_number}</td>
                        <td className="p-4">{p.customer_name}</td>
                        <td className="p-4 font-mono text-xs">{p.invoice?.invoice_number || "—"}</td>
                        <td className="p-4 uppercase text-xs">{p.payment_method}</td>
                        <td className="p-4 text-xs font-mono">{p.transaction_reference || "—"}</td>
                        <td className="p-4 text-xs">{p.payment_date}</td>
                        <td className="p-4 font-bold text-emerald-400">₹{Number(p.amount).toLocaleString("en-IN")}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 5: RECEIVABLES AGING */}
      {activeTab === "receivables" && (
        <div className="space-y-6">
          {/* Aging Buckets Overview */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {Object.entries(receivablesAging.buckets).map(([key, bucket]) => (
              <div key={key} className="p-5 rounded-2xl border border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)] space-y-2">
                <div className="text-xs font-semibold text-[var(--color-mute)] uppercase">{bucket.label}</div>
                <div className="text-2xl font-bold text-amber-400">₹{bucket.amount.toLocaleString("en-IN")}</div>
                <div className="text-xs text-[var(--color-mute)]">{bucket.count} Pending Invoices</div>
              </div>
            ))}
          </div>

          <div className="rounded-2xl border border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)] overflow-hidden">
            <div className="p-4 border-b border-[var(--color-hairline)] font-semibold text-[var(--color-ink)]">
              Outstanding Accounts & Follow-up Actions
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-[var(--color-hairline-soft-surface)] text-xs uppercase text-[var(--color-mute)] font-medium border-b border-[var(--color-hairline)]">
                  <tr>
                    <th className="p-4">Invoice #</th>
                    <th className="p-4">Customer</th>
                    <th className="p-4">Due Date</th>
                    <th className="p-4">Total</th>
                    <th className="p-4">Balance Due</th>
                    <th className="p-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--color-hairline)] text-[var(--color-ink)]">
                  {receivablesAging.unpaidInvoices.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="p-8 text-center text-[var(--color-mute)]">
                        No outstanding receivables. All invoices paid!
                      </td>
                    </tr>
                  ) : (
                    receivablesAging.unpaidInvoices.map((inv) => (
                      <tr key={inv.id} className="hover:bg-[var(--color-hairline-soft-surface)] transition-colors">
                        <td className="p-4 font-semibold text-emerald-400">{inv.invoice_number}</td>
                        <td className="p-4">{inv.customer_name}</td>
                        <td className="p-4 text-xs">{inv.due_date}</td>
                        <td className="p-4 font-medium">₹{Number(inv.total_amount).toLocaleString("en-IN")}</td>
                        <td className="p-4 font-bold text-amber-400">₹{Number(inv.amount_due).toLocaleString("en-IN")}</td>
                        <td className="p-4 text-right space-x-2">
                          <button
                            onClick={() => {
                              addReceivableFollowupAction({
                                invoice_id: inv.id,
                                action_type: "reminder_sent",
                                notes: "Payment reminder sent to customer contact.",
                              });
                              showToast(`Payment reminder sent for ${inv.invoice_number}`);
                            }}
                            className="px-2.5 py-1 text-xs rounded-lg bg-sky-600 hover:bg-sky-500 text-white"
                          >
                            Send Reminder
                          </button>
                          <button
                            onClick={() => {
                              addReceivableFollowupAction({
                                invoice_id: inv.id,
                                action_type: "disputed",
                                notes: "Marked disputed by finance team.",
                              });
                              showToast(`Invoice ${inv.invoice_number} marked as Disputed`, "error");
                            }}
                            className="px-2.5 py-1 text-xs rounded-lg bg-rose-600 hover:bg-rose-500 text-white"
                          >
                            Mark Disputed
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 6: PAYABLES & VENDORS */}
      {activeTab === "payables" && (
        <div className="space-y-4">
          <div className="p-5 rounded-2xl border border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)] flex justify-between items-center">
            <div>
              <div className="text-xs text-[var(--color-mute)] font-semibold uppercase">Pending Supplier Payables</div>
              <div className="text-2xl font-bold text-rose-400">₹{metrics.pendingVendorPayments.toLocaleString("en-IN")}</div>
            </div>
            <button
              onClick={() => setShow3WayMatchModal(true)}
              className="px-4 py-2 text-sm font-medium rounded-xl bg-amber-600 hover:bg-amber-500 text-white shadow-md flex items-center gap-2"
            >
              <ShieldCheck className="h-4 w-4" /> Run 3-Way PO Match
            </button>
          </div>
        </div>
      )}

      {/* TAB 7: 3-WAY MATCH VERIFICATION */}
      {activeTab === "po-match" && (
        <div className="space-y-4">
          <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm flex items-start gap-3">
            <ShieldCheck className="h-5 w-5 shrink-0 mt-0.5" />
            <div>
              <span className="font-semibold">3-Way PO Matching Protocol (PO ↔ GRN ↔ Supplier Invoice):</span> Automatically verifies quantities and prices across Purchase Orders, Goods Receipt Notes, and Supplier Invoices. Mismatches automatically place payments on hold to protect company capital.
            </div>
          </div>

          <div className="rounded-2xl border border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)] overflow-hidden">
            <div className="p-4 border-b border-[var(--color-hairline)] flex items-center justify-between">
              <h3 className="font-semibold text-[var(--color-ink)]">Verified 3-Way Match Audits</h3>
              <button
                onClick={() => setShow3WayMatchModal(true)}
                className="px-3 py-1.5 text-xs font-medium rounded-lg bg-amber-600 hover:bg-amber-500 text-white flex items-center gap-1.5"
              >
                <Plus className="h-3.5 w-3.5" /> Perform New Match
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-[var(--color-hairline-soft-surface)] text-xs uppercase text-[var(--color-mute)] font-medium border-b border-[var(--color-hairline)]">
                  <tr>
                    <th className="p-4">PO #</th>
                    <th className="p-4">Supplier Invoice #</th>
                    <th className="p-4">PO Qty vs GRN Qty vs Inv Qty</th>
                    <th className="p-4">PO Amount vs Inv Amount</th>
                    <th className="p-4">Match Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--color-hairline)] text-[var(--color-ink)]">
                  {threeWayMatches.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="p-8 text-center text-[var(--color-mute)]">
                        No 3-way match reviews executed yet. Click "Perform New Match" to test.
                      </td>
                    </tr>
                  ) : (
                    threeWayMatches.map((m) => (
                      <tr key={m.id} className="hover:bg-[var(--color-hairline-soft-surface)] transition-colors">
                        <td className="p-4 font-semibold text-emerald-400">{m.po_number}</td>
                        <td className="p-4 font-mono text-xs">{m.supplier_invoice_number || "—"}</td>
                        <td className="p-4 text-xs font-mono">
                          {m.po_quantity} / {m.grn_quantity} / {m.invoice_quantity}
                        </td>
                        <td className="p-4 text-xs font-mono">
                          ₹{Number(m.po_amount).toLocaleString("en-IN")} vs ₹{Number(m.supplier_invoice_amount).toLocaleString("en-IN")}
                        </td>
                        <td className="p-4">
                          <span
                            className={`px-2.5 py-1 rounded-full text-xs font-semibold ${
                              m.match_status === "approved_for_payment" || m.match_status === "matched"
                                ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/30"
                                : "bg-rose-500/10 text-rose-400 border border-rose-500/30"
                            }`}
                          >
                            {m.match_status}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 8: EXPENSES */}
      {activeTab === "expenses" && (
        <div className="space-y-4">
          <div className="rounded-2xl border border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)] overflow-hidden">
            <div className="p-4 border-b border-[var(--color-hairline)] flex items-center justify-between">
              <h3 className="font-semibold text-[var(--color-ink)]">Operational Expenses Ledger</h3>
              <button
                onClick={() => setShowExpenseModal(true)}
                className="px-3 py-1.5 text-xs font-medium rounded-lg bg-purple-600 hover:bg-purple-500 text-white flex items-center gap-1.5"
              >
                <Plus className="h-3.5 w-3.5" /> Record Expense
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-[var(--color-hairline-soft-surface)] text-xs uppercase text-[var(--color-mute)] font-medium border-b border-[var(--color-hairline)]">
                  <tr>
                    <th className="p-4">Expense #</th>
                    <th className="p-4">Category</th>
                    <th className="p-4">Vendor</th>
                    <th className="p-4">Date</th>
                    <th className="p-4">Amount</th>
                    <th className="p-4">Approval Status</th>
                    <th className="p-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--color-hairline)] text-[var(--color-ink)]">
                  {expenses.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="p-8 text-center text-[var(--color-mute)]">
                        No expenses recorded yet.
                      </td>
                    </tr>
                  ) : (
                    expenses.map((exp) => (
                      <tr key={exp.id} className="hover:bg-[var(--color-hairline-soft-surface)] transition-colors">
                        <td className="p-4 font-semibold text-purple-400">{exp.expense_number}</td>
                        <td className="p-4 font-medium">{exp.category}</td>
                        <td className="p-4 text-xs">{exp.vendor_name || "—"}</td>
                        <td className="p-4 text-xs">{exp.expense_date}</td>
                        <td className="p-4 font-bold text-rose-400">₹{Number(exp.amount).toLocaleString("en-IN")}</td>
                        <td className="p-4">
                          <span
                            className={`px-2.5 py-1 rounded-full text-xs font-semibold ${
                              exp.approval_status === "approved"
                                ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/30"
                                : exp.approval_status === "escalated_higher_approval"
                                ? "bg-amber-500/10 text-amber-400 border border-amber-500/30"
                                : "bg-rose-500/10 text-rose-400 border border-rose-500/30"
                            }`}
                          >
                            {exp.approval_status}
                          </span>
                        </td>
                        <td className="p-4 text-right space-x-2">
                          {exp.approval_status !== "approved" && (
                            <button
                              onClick={() => approveExpenseAction(exp.id, "approve")}
                              className="px-2.5 py-1 text-xs rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white"
                            >
                              Approve
                            </button>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 9: PAYROLL SUMMARIES */}
      {activeTab === "payroll" && (
        <div className="space-y-4">
          <div className="p-4 rounded-xl bg-purple-500/10 border border-purple-500/20 text-purple-400 text-sm flex items-start gap-3">
            <Lock className="h-5 w-5 shrink-0 mt-0.5" />
            <div>
              <span className="font-semibold">HR Privacy Protocol (Rule 15):</span> Finance Managers see approved department and branch salary cost totals for financial accounting. Individual employee personal compensation breakdowns remain restricted under HR security bounds.
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-5 rounded-2xl border border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)] space-y-1">
              <div className="text-xs text-[var(--color-mute)] font-semibold uppercase">Total Approved Payroll</div>
              <div className="text-2xl font-bold text-emerald-400">₹8,45,000</div>
              <div className="text-xs text-[var(--color-mute)]">Current Month Expenditure</div>
            </div>
            <div className="p-5 rounded-2xl border border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)] space-y-1">
              <div className="text-xs text-[var(--color-mute)] font-semibold uppercase">Field Operations Payroll</div>
              <div className="text-2xl font-bold text-sky-400">₹5,20,000</div>
              <div className="text-xs text-[var(--color-mute)]">Service & Field Technicians</div>
            </div>
            <div className="p-5 rounded-2xl border border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)] space-y-1">
              <div className="text-xs text-[var(--color-mute)] font-semibold uppercase">Admin & Executive Cost</div>
              <div className="text-2xl font-bold text-purple-400">₹3,25,000</div>
              <div className="text-xs text-[var(--color-mute)]">Management & Office Staff</div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 10: FINANCIAL REPORTS */}
      {activeTab === "reports" && (
        <div className="space-y-6">
          <div className="p-6 rounded-2xl border border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)] space-y-4">
            <h3 className="text-lg font-bold text-[var(--color-ink)]">Generate Financial Reports</h3>
            <p className="text-sm text-[var(--color-mute)]">Export detailed financial ledgers for tax compliance and audit.</p>
            <div className="flex flex-wrap gap-3">
              <button className="px-4 py-2 text-sm font-medium rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white flex items-center gap-2">
                <Download className="h-4 w-4" /> Revenue & Profitability (CSV)
              </button>
              <button className="px-4 py-2 text-sm font-medium rounded-xl bg-sky-600 hover:bg-sky-500 text-white flex items-center gap-2">
                <Download className="h-4 w-4" /> Receivables Aging Report (CSV)
              </button>
              <button className="px-4 py-2 text-sm font-medium rounded-xl bg-purple-600 hover:bg-purple-500 text-white flex items-center gap-2">
                <Download className="h-4 w-4" /> Expense Ledger (CSV)
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TAB 11: SETTINGS */}
      {activeTab === "settings" && (
        <div className="p-6 rounded-2xl border border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)] space-y-6">
          <h3 className="text-lg font-bold text-[var(--color-ink)]">Finance & Document Settings</h3>
          <div className="space-y-4 max-w-md">
            <div>
              <label className="block text-xs font-semibold text-[var(--color-mute)] mb-1">Invoice Prefix Format</label>
              <input
                type="text"
                defaultValue={String(financeSettings.invoice_prefix || "INV-2026-")}
                className="w-full px-3 py-2 text-sm rounded-xl border border-[var(--color-hairline)] bg-[var(--color-canvas)] text-[var(--color-ink)]"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[var(--color-mute)] mb-1">Default GST / Tax Rate (%)</label>
              <input
                type="number"
                defaultValue={18}
                className="w-full px-3 py-2 text-sm rounded-xl border border-[var(--color-hairline)] bg-[var(--color-canvas)] text-[var(--color-ink)]"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[var(--color-mute)] mb-1">Expense Approval Limit (₹)</label>
              <input
                type="number"
                defaultValue={50000}
                className="w-full px-3 py-2 text-sm rounded-xl border border-[var(--color-hairline)] bg-[var(--color-canvas)] text-[var(--color-ink)]"
              />
            </div>
          </div>
        </div>
      )}

      {/* CREATE INVOICE MODAL */}
      {showCreateInvoiceModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="w-full max-w-lg rounded-2xl border border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)] p-6 space-y-4 shadow-2xl"
          >
            <div className="flex items-center justify-between border-b border-[var(--color-hairline)] pb-3">
              <h3 className="font-bold text-[var(--color-ink)] text-lg">Create New Invoice</h3>
              <button onClick={() => setShowCreateInvoiceModal(false)} className="text-[var(--color-mute)] hover:text-[var(--color-ink)]">
                <X className="h-5 w-5" />
              </button>
            </div>
            <form onSubmit={handleCreateInvoice} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-[var(--color-mute)] mb-1">Invoice Type</label>
                <select
                  value={invoiceForm.invoice_type}
                  onChange={(e) => setInvoiceForm({ ...invoiceForm, invoice_type: e.target.value as any })}
                  className="w-full px-3 py-2 text-sm rounded-xl border border-[var(--color-hairline)] bg-[var(--color-canvas)] text-[var(--color-ink)]"
                >
                  <option value="sales">Sales Invoice</option>
                  <option value="rental">Rental Invoice</option>
                  <option value="service">Service Invoice</option>
                  <option value="custom">Custom Invoice</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-[var(--color-mute)] mb-1">Customer Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Apex Industrial Pvt Ltd"
                  value={invoiceForm.customer_name}
                  onChange={(e) => setInvoiceForm({ ...invoiceForm, customer_name: e.target.value })}
                  className="w-full px-3 py-2 text-sm rounded-xl border border-[var(--color-hairline)] bg-[var(--color-canvas)] text-[var(--color-ink)]"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[var(--color-mute)] mb-1">Billing Item Description *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Monthly Machinery Rental & Maintenance Fee"
                  value={invoiceForm.item_description}
                  onChange={(e) => setInvoiceForm({ ...invoiceForm, item_description: e.target.value })}
                  className="w-full px-3 py-2 text-sm rounded-xl border border-[var(--color-hairline)] bg-[var(--color-canvas)] text-[var(--color-ink)]"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-[var(--color-mute)] mb-1">Unit Price (₹) *</label>
                  <input
                    type="number"
                    required
                    value={invoiceForm.unit_price}
                    onChange={(e) => setInvoiceForm({ ...invoiceForm, unit_price: Number(e.target.value) })}
                    className="w-full px-3 py-2 text-sm rounded-xl border border-[var(--color-hairline)] bg-[var(--color-canvas)] text-[var(--color-ink)]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[var(--color-mute)] mb-1">Quantity *</label>
                  <input
                    type="number"
                    required
                    value={invoiceForm.quantity}
                    onChange={(e) => setInvoiceForm({ ...invoiceForm, quantity: Number(e.target.value) })}
                    className="w-full px-3 py-2 text-sm rounded-xl border border-[var(--color-hairline)] bg-[var(--color-canvas)] text-[var(--color-ink)]"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-3 border-t border-[var(--color-hairline)]">
                <button
                  type="button"
                  onClick={() => setShowCreateInvoiceModal(false)}
                  className="px-4 py-2 text-xs font-medium rounded-xl border border-[var(--color-hairline)] text-[var(--color-mute)]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 text-xs font-medium rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white"
                >
                  {isSubmitting ? "Creating..." : "Save Invoice Draft"}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}

      {/* RECORD PAYMENT MODAL */}
      {showRecordPaymentModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="w-full max-w-md rounded-2xl border border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)] p-6 space-y-4 shadow-2xl"
          >
            <div className="flex items-center justify-between border-b border-[var(--color-hairline)] pb-3">
              <h3 className="font-bold text-[var(--color-ink)] text-lg">Record Customer Payment</h3>
              <button onClick={() => setShowRecordPaymentModal(false)} className="text-[var(--color-mute)] hover:text-[var(--color-ink)]">
                <X className="h-5 w-5" />
              </button>
            </div>
            <form onSubmit={handleRecordPayment} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-[var(--color-mute)] mb-1">Select Invoice *</label>
                <select
                  value={paymentForm.invoice_id}
                  onChange={(e) => setPaymentForm({ ...paymentForm, invoice_id: e.target.value })}
                  className="w-full px-3 py-2 text-sm rounded-xl border border-[var(--color-hairline)] bg-[var(--color-canvas)] text-[var(--color-ink)]"
                  required
                >
                  <option value="">-- Choose Invoice --</option>
                  {invoices
                    .filter((inv) => inv.status !== "paid" && inv.status !== "cancelled")
                    .map((inv) => (
                      <option key={inv.id} value={inv.id}>
                        {inv.invoice_number} - {inv.customer_name} (Due: ₹{Number(inv.amount_due).toLocaleString("en-IN")})
                      </option>
                    ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-[var(--color-mute)] mb-1">Payment Amount (₹) *</label>
                <input
                  type="number"
                  required
                  value={paymentForm.amount}
                  onChange={(e) => setPaymentForm({ ...paymentForm, amount: Number(e.target.value) })}
                  className="w-full px-3 py-2 text-sm rounded-xl border border-[var(--color-hairline)] bg-[var(--color-canvas)] text-[var(--color-ink)]"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[var(--color-mute)] mb-1">Payment Method</label>
                <select
                  value={paymentForm.payment_method}
                  onChange={(e) => setPaymentForm({ ...paymentForm, payment_method: e.target.value as any })}
                  className="w-full px-3 py-2 text-sm rounded-xl border border-[var(--color-hairline)] bg-[var(--color-canvas)] text-[var(--color-ink)]"
                >
                  <option value="bank_transfer">Bank Transfer (NEFT/RTGS)</option>
                  <option value="upi">UPI</option>
                  <option value="cheque">Cheque</option>
                  <option value="cash">Cash</option>
                  <option value="card">Credit/Debit Card</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-[var(--color-mute)] mb-1">Transaction Ref / UTR Number</label>
                <input
                  type="text"
                  placeholder="e.g. UTR-998234710"
                  value={paymentForm.transaction_reference}
                  onChange={(e) => setPaymentForm({ ...paymentForm, transaction_reference: e.target.value })}
                  className="w-full px-3 py-2 text-sm rounded-xl border border-[var(--color-hairline)] bg-[var(--color-canvas)] text-[var(--color-ink)]"
                />
              </div>
              <div className="flex justify-end gap-2 pt-3 border-t border-[var(--color-hairline)]">
                <button
                  type="button"
                  onClick={() => setShowRecordPaymentModal(false)}
                  className="px-4 py-2 text-xs font-medium rounded-xl border border-[var(--color-hairline)] text-[var(--color-mute)]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 text-xs font-medium rounded-xl bg-sky-600 hover:bg-sky-500 text-white"
                >
                  {isSubmitting ? "Recording..." : "Record Payment"}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}

      {/* CREDIT/DEBIT NOTE MODAL */}
      {showCreditDebitModal && selectedInvoice && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="w-full max-w-md rounded-2xl border border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)] p-6 space-y-4 shadow-2xl"
          >
            <div className="flex items-center justify-between border-b border-[var(--color-hairline)] pb-3">
              <h3 className="font-bold text-[var(--color-ink)] text-lg">
                Issue Adjustment Note ({selectedInvoice.invoice_number})
              </h3>
              <button onClick={() => setShowCreditDebitModal(false)} className="text-[var(--color-mute)] hover:text-[var(--color-ink)]">
                <X className="h-5 w-5" />
              </button>
            </div>
            <form onSubmit={handleIssueCreditDebitNote} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-[var(--color-mute)] mb-1">Adjustment Type</label>
                <select
                  value={creditNoteForm.note_type}
                  onChange={(e) => setCreditNoteForm({ ...creditNoteForm, note_type: e.target.value as any })}
                  className="w-full px-3 py-2 text-sm rounded-xl border border-[var(--color-hairline)] bg-[var(--color-canvas)] text-[var(--color-ink)]"
                >
                  <option value="credit_note">Credit Note (Reduce Invoice Amount)</option>
                  <option value="debit_note">Debit Note (Increase Invoice Amount)</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-[var(--color-mute)] mb-1">Adjustment Amount (₹) *</label>
                <input
                  type="number"
                  required
                  value={creditNoteForm.amount}
                  onChange={(e) => setCreditNoteForm({ ...creditNoteForm, amount: Number(e.target.value) })}
                  className="w-full px-3 py-2 text-sm rounded-xl border border-[var(--color-hairline)] bg-[var(--color-canvas)] text-[var(--color-ink)]"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[var(--color-mute)] mb-1">Reason for Adjustment *</label>
                <textarea
                  required
                  placeholder="Provide valid business reason for amendment..."
                  value={creditNoteForm.reason}
                  onChange={(e) => setCreditNoteForm({ ...creditNoteForm, reason: e.target.value })}
                  className="w-full px-3 py-2 text-sm rounded-xl border border-[var(--color-hairline)] bg-[var(--color-canvas)] text-[var(--color-ink)] h-20"
                />
              </div>
              <div className="flex justify-end gap-2 pt-3 border-t border-[var(--color-hairline)]">
                <button
                  type="button"
                  onClick={() => setShowCreditDebitModal(false)}
                  className="px-4 py-2 text-xs font-medium rounded-xl border border-[var(--color-hairline)] text-[var(--color-mute)]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 text-xs font-medium rounded-xl bg-purple-600 hover:bg-purple-500 text-white"
                >
                  {isSubmitting ? "Issuing..." : "Issue Note"}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}

      {/* RECORD EXPENSE MODAL */}
      {showExpenseModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="w-full max-w-md rounded-2xl border border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)] p-6 space-y-4 shadow-2xl"
          >
            <div className="flex items-center justify-between border-b border-[var(--color-hairline)] pb-3">
              <h3 className="font-bold text-[var(--color-ink)] text-lg">Record Operational Expense</h3>
              <button onClick={() => setShowExpenseModal(false)} className="text-[var(--color-mute)] hover:text-[var(--color-ink)]">
                <X className="h-5 w-5" />
              </button>
            </div>
            <form onSubmit={handleCreateExpense} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-[var(--color-mute)] mb-1">Expense Category *</label>
                <select
                  value={expenseForm.category}
                  onChange={(e) => setExpenseForm({ ...expenseForm, category: e.target.value })}
                  className="w-full px-3 py-2 text-sm rounded-xl border border-[var(--color-hairline)] bg-[var(--color-canvas)] text-[var(--color-ink)]"
                >
                  {expenseCategories.map((c) => (
                    <option key={c.id} value={c.name}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-[var(--color-mute)] mb-1">Expense Amount (₹) *</label>
                <input
                  type="number"
                  required
                  value={expenseForm.amount}
                  onChange={(e) => setExpenseForm({ ...expenseForm, amount: Number(e.target.value) })}
                  className="w-full px-3 py-2 text-sm rounded-xl border border-[var(--color-hairline)] bg-[var(--color-canvas)] text-[var(--color-ink)]"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[var(--color-mute)] mb-1">Vendor / Payee Name</label>
                <input
                  type="text"
                  placeholder="e.g. Indian Oil Fuel Station"
                  value={expenseForm.vendor_name}
                  onChange={(e) => setExpenseForm({ ...expenseForm, vendor_name: e.target.value })}
                  className="w-full px-3 py-2 text-sm rounded-xl border border-[var(--color-hairline)] bg-[var(--color-canvas)] text-[var(--color-ink)]"
                />
              </div>
              <div className="flex justify-end gap-2 pt-3 border-t border-[var(--color-hairline)]">
                <button
                  type="button"
                  onClick={() => setShowExpenseModal(false)}
                  className="px-4 py-2 text-xs font-medium rounded-xl border border-[var(--color-hairline)] text-[var(--color-mute)]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 text-xs font-medium rounded-xl bg-purple-600 hover:bg-purple-500 text-white"
                >
                  {isSubmitting ? "Saving..." : "Save Expense"}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}

      {/* 3-WAY MATCH MODAL */}
      {show3WayMatchModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="w-full max-w-lg rounded-2xl border border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)] p-6 space-y-4 shadow-2xl"
          >
            <div className="flex items-center justify-between border-b border-[var(--color-hairline)] pb-3">
              <h3 className="font-bold text-[var(--color-ink)] text-lg">3-Way Matching Verification</h3>
              <button onClick={() => setShow3WayMatchModal(false)} className="text-[var(--color-mute)] hover:text-[var(--color-ink)]">
                <X className="h-5 w-5" />
              </button>
            </div>
            <form onSubmit={handleRun3WayMatch} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-[var(--color-mute)] mb-1">PO Number *</label>
                  <input
                    type="text"
                    required
                    value={matchForm.po_number}
                    onChange={(e) => setMatchForm({ ...matchForm, po_number: e.target.value })}
                    className="w-full px-3 py-2 text-sm rounded-xl border border-[var(--color-hairline)] bg-[var(--color-canvas)] text-[var(--color-ink)]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[var(--color-mute)] mb-1">Supplier Invoice #</label>
                  <input
                    type="text"
                    value={matchForm.supplier_invoice_number}
                    onChange={(e) => setMatchForm({ ...matchForm, supplier_invoice_number: e.target.value })}
                    className="w-full px-3 py-2 text-sm rounded-xl border border-[var(--color-hairline)] bg-[var(--color-canvas)] text-[var(--color-ink)]"
                  />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-[var(--color-mute)] mb-1">PO Qty</label>
                  <input
                    type="number"
                    value={matchForm.po_quantity}
                    onChange={(e) => setMatchForm({ ...matchForm, po_quantity: Number(e.target.value) })}
                    className="w-full px-3 py-2 text-sm rounded-xl border border-[var(--color-hairline)] bg-[var(--color-canvas)] text-[var(--color-ink)]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[var(--color-mute)] mb-1">GRN Qty Received</label>
                  <input
                    type="number"
                    value={matchForm.grn_quantity}
                    onChange={(e) => setMatchForm({ ...matchForm, grn_quantity: Number(e.target.value) })}
                    className="w-full px-3 py-2 text-sm rounded-xl border border-[var(--color-hairline)] bg-[var(--color-canvas)] text-[var(--color-ink)]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[var(--color-mute)] mb-1">Invoice Qty</label>
                  <input
                    type="number"
                    value={matchForm.invoice_quantity}
                    onChange={(e) => setMatchForm({ ...matchForm, invoice_quantity: Number(e.target.value) })}
                    className="w-full px-3 py-2 text-sm rounded-xl border border-[var(--color-hairline)] bg-[var(--color-canvas)] text-[var(--color-ink)]"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-[var(--color-mute)] mb-1">PO Amount (₹)</label>
                  <input
                    type="number"
                    value={matchForm.po_amount}
                    onChange={(e) => setMatchForm({ ...matchForm, po_amount: Number(e.target.value) })}
                    className="w-full px-3 py-2 text-sm rounded-xl border border-[var(--color-hairline)] bg-[var(--color-canvas)] text-[var(--color-ink)]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[var(--color-mute)] mb-1">Supplier Invoice Amount (₹)</label>
                  <input
                    type="number"
                    value={matchForm.supplier_invoice_amount}
                    onChange={(e) => setMatchForm({ ...matchForm, supplier_invoice_amount: Number(e.target.value) })}
                    className="w-full px-3 py-2 text-sm rounded-xl border border-[var(--color-hairline)] bg-[var(--color-canvas)] text-[var(--color-ink)]"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-3 border-t border-[var(--color-hairline)]">
                <button
                  type="button"
                  onClick={() => setShow3WayMatchModal(false)}
                  className="px-4 py-2 text-xs font-medium rounded-xl border border-[var(--color-hairline)] text-[var(--color-mute)]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 text-xs font-medium rounded-xl bg-amber-600 hover:bg-amber-500 text-white"
                >
                  {isSubmitting ? "Evaluating..." : "Run Match Evaluation"}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </div>
  );
}
