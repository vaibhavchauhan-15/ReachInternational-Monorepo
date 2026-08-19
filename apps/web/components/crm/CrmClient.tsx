"use client";

import { useState, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import {
  AnimatedUsers,
  AnimatedSearch,
  AnimatedPlus,
  AnimatedWrench,
  AnimatedAlertTriangle,
  AnimatedFileText,
  AnimatedPhone,
  AnimatedMail,
  AnimatedMapPin,
  AnimatedEye,
  AnimatedBuilding2,
  AnimatedChevronRight,
  AnimatedX,
  AnimatedDashboard,
  AnimatedClipboardList,
  AnimatedStar,
  AnimatedShoppingBag,
  AnimatedPackage,
  AnimatedSettings,
  AnimatedCheck,
  AnimatedBell,
  AnimatedRefresh,
} from "@/components/ui/animated-icons";
import { MapPin, X, Mail, Phone, Calendar, ArrowRight, ShieldAlert, CheckCircle2, Clock, Layers, DollarSign, Download, Printer, Copy, RotateCcw, AlertCircle, Send, Truck } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import type {
  User,
  SalesLead,
  SalesCustomer,
  SalesInteraction,
  SalesOpportunity,
  SalesQuotation,
  SalesOrder,
  SalesMachineReservation,
  SalesDeliveryCoordination,
  SalesSettings,
  SalesDashboardMetrics,
  Machine,
  LeadStatus,
  OpportunityStage,
} from "@/lib/types/database";
import { TooltipWrapper } from "@/components/ui";
import {
  createSalesLeadAction,
  updateSalesLeadAction,
  convertLeadAction,
  createSalesCustomerAction,
  archiveSalesCustomerAction,
  logSalesInteractionAction,
  createSalesOpportunityAction,
  createSalesQuotationAction,
  reviseSalesQuotationAction,
  createSalesOrderAction,
  reserveMachineForSalesAction,
  requestSalesDeliveryAction,
  completeSalesHandoverAction,
} from "@/app/actions/sales";

interface CrmClientProps {
  user: User;
  initialMetrics?: SalesDashboardMetrics | null;
  initialLeads?: SalesLead[];
  initialCustomers?: SalesCustomer[];
  initialInteractions?: SalesInteraction[];
  initialOpportunities?: SalesOpportunity[];
  initialQuotations?: SalesQuotation[];
  initialOrders?: SalesOrder[];
  initialAvailableMachines?: Machine[];
  initialReservations?: SalesMachineReservation[];
  initialDeliveries?: SalesDeliveryCoordination[];
  initialSettings?: SalesSettings | null;
}

export function CrmClient({
  user,
  initialMetrics,
  initialLeads = [],
  initialCustomers = [],
  initialInteractions = [],
  initialOpportunities = [],
  initialQuotations = [],
  initialOrders = [],
  initialAvailableMachines = [],
  initialReservations = [],
  initialDeliveries = [],
  initialSettings,
}: CrmClientProps) {
  const searchParams = useSearchParams();
  const tabParam = searchParams.get("tab");

  const [activeTab, setActiveTab] = useState<string>(tabParam || "dashboard");
  const [searchQuery, setSearchQuery] = useState("");
  const [statusMessage, setStatusMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // State arrays initialized from server props
  const [leads, setLeads] = useState<SalesLead[]>(initialLeads);
  const [customers, setCustomers] = useState<SalesCustomer[]>(initialCustomers);
  const [interactions, setInteractions] = useState<SalesInteraction[]>(initialInteractions);
  const [opportunities, setOpportunities] = useState<SalesOpportunity[]>(initialOpportunities);
  const [quotations, setQuotations] = useState<SalesQuotation[]>(initialQuotations);
  const [orders, setOrders] = useState<SalesOrder[]>(initialOrders);
  const [reservations, setReservations] = useState<SalesMachineReservation[]>(initialReservations);
  const [deliveries, setDeliveries] = useState<SalesDeliveryCoordination[]>(initialDeliveries);

  // Modal Control States
  const [showLeadModal, setShowLeadModal] = useState(false);
  const [showCustomerModal, setShowCustomerModal] = useState(false);
  const [showInteractionModal, setShowInteractionModal] = useState(false);
  const [showOpportunityModal, setShowOpportunityModal] = useState(false);
  const [showQuotationModal, setShowQuotationModal] = useState(false);
  const [showRevisionModal, setShowRevisionModal] = useState<SalesQuotation | null>(null);
  const [showOrderModal, setShowOrderModal] = useState<SalesQuotation | null>(null);
  const [showReservationModal, setShowReservationModal] = useState<SalesOrder | null>(null);
  const [showDeliveryModal, setShowDeliveryModal] = useState<SalesOrder | null>(null);

  // Detail Drawer
  const [selectedCustomer, setSelectedCustomer] = useState<SalesCustomer | null>(null);

  // Forms State
  const [leadForm, setLeadForm] = useState({
    leadName: "",
    companyName: "",
    contactPerson: "",
    phone: "",
    email: "",
    location: "",
    city: user.branch?.city || "Delhi",
    state: "Delhi",
    requirement: "",
    machineModel: "JCB 3DX Super Backhoe Loader",
    expectedQuantity: 1,
    expectedPurchaseDate: new Date(Date.now() + 14 * 86400000).toISOString().split("T")[0],
    leadSource: "Direct Inquiry",
  });

  const [customerForm, setCustomerForm] = useState({
    companyName: "",
    contactPerson: "",
    phone: "",
    email: "",
    billingAddress: "",
    shippingAddress: "",
    city: "Delhi",
    state: "Delhi",
    gstin: "",
    creditLimit: 1000000,
  });

  const [interactionForm, setInteractionForm] = useState({
    customerId: "",
    leadId: "",
    interactionType: "Phone Call" as const,
    summary: "",
    notes: "",
    followUpDate: new Date(Date.now() + 3 * 86400000).toISOString().split("T")[0],
  });

  const [opportunityForm, setOpportunityForm] = useState({
    title: "",
    customerId: "",
    machineModel: "JCB 3DX Super Backhoe Loader",
    quantity: 1,
    expectedValue: 3500000,
    expectedClosingDate: new Date(Date.now() + 30 * 86400000).toISOString().split("T")[0],
    probability: 60,
    stage: "Qualified" as OpportunityStage,
    competitor: "",
    requirementNotes: "",
  });

  const [quotationForm, setQuotationForm] = useState({
    customerId: "",
    customerName: "",
    machineModel: "JCB 3DX Super Backhoe Loader",
    quantity: 1,
    unitPrice: 3500000,
    discountPercent: 3,
    deliveryCharges: 25000,
    transportCharges: 15000,
    warrantyTerms: "1 Year Standard Manufacturer Warranty",
    paymentTerms: "100% Advance against PI",
    deliveryTerms: "Within 7 Business Days",
    validityPeriod: new Date(Date.now() + 15 * 86400000).toISOString().split("T")[0],
    remarks: "",
  });

  const [revisionForm, setRevisionForm] = useState({
    unitPrice: 3500000,
    discountPercent: 6,
    quantity: 1,
    deliveryTerms: "Within 5 Business Days",
    remarks: "Revised pricing per customer negotiation",
  });

  const [reservationForm, setReservationForm] = useState({
    machineId: "",
    reservedUntil: new Date(Date.now() + 10 * 86400000).toISOString().split("T")[0],
  });

  const [deliveryForm, setDeliveryForm] = useState({
    deliveryLocation: "",
    specialInstructions: "Ensure third-party safety inspection certificate is handed over to site engineer.",
    requestedDeliveryDate: new Date(Date.now() + 5 * 86400000).toISOString().split("T")[0],
  });

  // KPI Metrics Calculation
  const metrics = useMemo(() => {
    const totalLeads = leads.length;
    const newLeads = leads.filter((l) => l.status === "New").length;
    const activeOpps = opportunities.filter((o) => o.stage !== "Order Won" && o.stage !== "Order Lost").length;
    const pipelineValue = opportunities
      .filter((o) => o.stage !== "Order Won" && o.stage !== "Order Lost")
      .reduce((acc, curr) => acc + (Number(curr.expected_value) || 0), 0);
    const quotationPending = quotations.filter((q) => q.status === "pending_approval" || q.status === "draft").length;
    const quotationAccepted = quotations.filter((q) => q.status === "accepted").length;
    const quotationRejected = quotations.filter((q) => q.status === "rejected").length;
    const ordersWon = orders.filter((o) => o.status === "approved" || o.status === "delivered" || o.status === "handover_completed").length;
    const ordersLost = quotations.filter((q) => q.status === "rejected").length;
    const monthlySales = orders.reduce((acc, curr) => acc + (Number(curr.total_amount) || 0), 0);

    return {
      totalLeads: initialMetrics?.totalLeads ?? totalLeads,
      newLeads: initialMetrics?.newLeads ?? newLeads,
      followUpsDue: initialMetrics?.followUpsDue ?? 3,
      activeOpportunities: initialMetrics?.activeOpportunities ?? activeOpps,
      quotationPending: initialMetrics?.quotationPending ?? quotationPending,
      quotationAccepted: initialMetrics?.quotationAccepted ?? quotationAccepted,
      quotationRejected: initialMetrics?.quotationRejected ?? quotationRejected,
      ordersWon: initialMetrics?.ordersWon ?? ordersWon,
      ordersLost: initialMetrics?.ordersLost ?? ordersLost,
      pipelineValue: initialMetrics?.pipelineValue ?? pipelineValue,
      monthlySales: initialMetrics?.monthlySales ?? monthlySales,
      salesTarget: initialMetrics?.salesTarget ?? 5000000,
      customerCount: customers.length,
      reservedMachinesCount: reservations.length,
      pendingDeliveryCount: deliveries.filter((d) => d.delivery_status !== "handover_completed").length,
    };
  }, [leads, opportunities, quotations, orders, customers, reservations, deliveries, initialMetrics]);

  // Handlers
  const handleCreateLead = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await createSalesLeadAction(leadForm);
    if (res.success && res.data) {
      setLeads([res.data as SalesLead, ...leads]);
      setShowLeadModal(false);
      setStatusMessage({ type: "success", text: "New Sales Lead created successfully!" });
    } else {
      setStatusMessage({ type: "error", text: res.error || "Failed to create lead" });
    }
  };

  const handleConvertLead = async (leadId: string) => {
    const res = await convertLeadAction(leadId);
    if (res.success) {
      setStatusMessage({ type: "success", text: "Lead successfully converted to Customer & Opportunity!" });
      setLeads(leads.map((l) => (l.id === leadId ? { ...l, status: "Qualified" } : l)));
    } else {
      setStatusMessage({ type: "error", text: res.error || "Failed to convert lead" });
    }
  };

  const handleCreateCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await createSalesCustomerAction(customerForm);
    if (res.success && res.data) {
      setCustomers([res.data as SalesCustomer, ...customers]);
      setShowCustomerModal(false);
      setStatusMessage({ type: "success", text: "New Sales Customer added successfully!" });
    } else {
      setStatusMessage({ type: "error", text: res.error || "Failed to add customer" });
    }
  };

  const handleArchiveCustomer = async (customerId: string) => {
    const res = await archiveSalesCustomerAction(customerId);
    if (res.success) {
      setStatusMessage({ type: "success", text: res.message || "Customer archived successfully" });
      setCustomers(customers.map((c) => (c.id === customerId ? { ...c, status: "archived" } : c)));
    } else {
      setStatusMessage({ type: "error", text: res.error || "Action failed" });
    }
  };

  const handleLogInteraction = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await logSalesInteractionAction(interactionForm);
    if (res.success && res.data) {
      setInteractions([res.data as SalesInteraction, ...interactions]);
      setShowInteractionModal(false);
      setStatusMessage({ type: "success", text: "Sales Interaction logged!" });
    } else {
      setStatusMessage({ type: "error", text: res.error || "Failed to log interaction" });
    }
  };

  const handleCreateOpportunity = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await createSalesOpportunityAction(opportunityForm);
    if (res.success && res.data) {
      setOpportunities([res.data as SalesOpportunity, ...opportunities]);
      setShowOpportunityModal(false);
      setStatusMessage({ type: "success", text: "Sales Opportunity added to Pipeline!" });
    } else {
      setStatusMessage({ type: "error", text: res.error || "Failed to create opportunity" });
    }
  };

  const handleCreateQuotation = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await createSalesQuotationAction(quotationForm);
    if (res.success && res.data) {
      setQuotations([res.data as SalesQuotation, ...quotations]);
      setShowQuotationModal(false);
      const isPending = res.data.discount_approval_status === "pending_approval";
      setStatusMessage({
        type: "success",
        text: isPending
          ? `Quotation ${res.data.quotation_number} created! (Discount > 5% requires Manager Approval)`
          : `Quotation ${res.data.quotation_number} created and auto-approved!`,
      });
    } else {
      setStatusMessage({ type: "error", text: res.error || "Failed to create quotation" });
    }
  };

  const handleReviseQuotation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!showRevisionModal) return;
    const res = await reviseSalesQuotationAction(showRevisionModal.id, revisionForm);
    if (res.success && res.data) {
      setQuotations([res.data as SalesQuotation, ...quotations]);
      setShowRevisionModal(null);
      setStatusMessage({ type: "success", text: `Revision ${res.data.quotation_number} generated! Original version preserved.` });
    } else {
      setStatusMessage({ type: "error", text: res.error || "Failed to revise quotation" });
    }
  };

  const handleCreateOrder = async (quotation: SalesQuotation) => {
    const res = await createSalesOrderAction({
      quotationId: quotation.id,
      customerId: quotation.customer_id,
      customerName: quotation.customer_name,
      machineId: quotation.machine_id || undefined,
      equipmentDescription: quotation.machine_model || "Industrial Machinery",
      quantity: quotation.quantity,
      unitPrice: quotation.unit_price,
      totalAmount: quotation.grand_total || quotation.unit_price,
      paymentStatus: "pending_advance",
      warrantyTerms: quotation.warranty_terms,
      deliveryInstruction: "Site Location, Delhi NCR",
    });

    if (res.success && res.data) {
      setOrders([res.data as SalesOrder, ...orders]);
      setStatusMessage({ type: "success", text: `Sales Order ${res.data.order_number} created from accepted quotation!` });
    } else {
      setStatusMessage({ type: "error", text: res.error || "Failed to create sales order" });
    }
  };

  const handleReserveMachine = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!showReservationModal) return;
    const res = await reserveMachineForSalesAction(
      showReservationModal.id,
      reservationForm.machineId
    );
    if (res.success && res.data) {
      setReservations([res.data as SalesMachineReservation, ...reservations]);
      setOrders(orders.map((o) => (o.id === showReservationModal.id ? { ...o, machine_reserved: true, status: "machine_reserved" } : o)));
      setShowReservationModal(null);
      setStatusMessage({ type: "success", text: "Machine successfully reserved for confirmed customer sales order!" });
    } else {
      setStatusMessage({ type: "error", text: res.error || "Failed to reserve machine" });
    }
  };

  const handleRequestDelivery = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!showDeliveryModal) return;
    const res = await requestSalesDeliveryAction(showDeliveryModal.id, deliveryForm);
    if (res.success && res.data) {
      setDeliveries([res.data as SalesDeliveryCoordination, ...deliveries]);
      setOrders(orders.map((o) => (o.id === showDeliveryModal.id ? { ...o, status: "delivery_requested" } : o)));
      setShowDeliveryModal(null);
      setStatusMessage({ type: "success", text: "Delivery Request sent to Store & Operations!" });
    } else {
      setStatusMessage({ type: "error", text: res.error || "Failed to request delivery" });
    }
  };

  return (
    <div className="p-4 sm:p-6 md:p-8 max-w-[1400px] mx-auto space-y-6">
      {/* STATUS BANNER */}
      {statusMessage && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className={`p-4 rounded-xl border text-xs font-semibold flex items-center justify-between shadow-xs ${
            statusMessage.type === "success"
              ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-700 dark:text-emerald-300"
              : "bg-rose-500/10 border-rose-500/20 text-rose-700 dark:text-rose-300"
          }`}
        >
          <div className="flex items-center gap-2">
            {statusMessage.type === "success" ? <CheckCircle2 className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
            <span>{statusMessage.text}</span>
          </div>
          <button type="button" onClick={() => setStatusMessage(null)} className="hover:opacity-70">
            <X className="h-4 w-4" />
          </button>
        </motion.div>
      )}

      {/* HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[var(--color-hairline)] pb-5">
        <div>
          <div className="inline-flex items-center gap-2 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 mb-2">
            <AnimatedUsers size={14} />
            Role 12 — Sales & CRM Operations
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-[var(--color-ink)] tracking-tight">
            Sales & Customer Workspace
          </h1>
          <p className="text-xs sm:text-sm text-[var(--color-mute)] mt-1">
            End-to-end sales lifecycle: Leads $\rightarrow$ Customers $\rightarrow$ Opportunities $\rightarrow$ Quotations $\rightarrow$ Discount Approvals $\rightarrow$ Orders $\rightarrow$ Delivery Coordination
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0 flex-wrap">
          <button
            type="button"
            onClick={() => setShowLeadModal(true)}
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-md transition-all cursor-pointer"
          >
            <AnimatedPlus size={16} />
            <span>New Lead</span>
          </button>
          <button
            type="button"
            onClick={() => setShowCustomerModal(true)}
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-md transition-all cursor-pointer"
          >
            <AnimatedUsers size={16} />
            <span>Add Customer</span>
          </button>
          <button
            type="button"
            onClick={() => setShowQuotationModal(true)}
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs shadow-md transition-all cursor-pointer"
          >
            <AnimatedFileText size={16} />
            <span>Create Quotation</span>
          </button>
        </div>
      </div>

      {/* TOP NAVIGATION MODULE TABS (10 TABS) */}
      <div className="flex items-center gap-1.5 overflow-x-auto border-b border-[var(--color-hairline)] pb-3 no-scrollbar">
        {[
          { id: "dashboard", label: "Dashboard", icon: AnimatedDashboard },
          { id: "leads", label: `Leads (${leads.length})`, icon: AnimatedClipboardList },
          { id: "customers", label: `Customers (${customers.length})`, icon: AnimatedUsers },
          { id: "interactions", label: `Interactions (${interactions.length})`, icon: AnimatedBell },
          { id: "opportunities", label: `Pipeline (${opportunities.length})`, icon: AnimatedStar },
          { id: "quotations", label: `Quotations (${quotations.length})`, icon: AnimatedFileText },
          { id: "orders", label: `Orders (${orders.length})`, icon: AnimatedShoppingBag },
          { id: "machine-sales", label: `Machine Inventory (${initialAvailableMachines.length})`, icon: AnimatedWrench },
          { id: "deliveries", label: `Deliveries (${deliveries.length})`, icon: AnimatedPackage },
          { id: "settings", label: "Settings", icon: AnimatedSettings },
        ].map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer ${
                activeTab === tab.id
                  ? "bg-blue-600 text-white shadow-xs"
                  : "text-[var(--color-body)] hover:text-[var(--color-ink)] hover:bg-[var(--color-hairline-soft-surface)]"
              }`}
            >
              <Icon size={14} />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* TAB 1: SALES DASHBOARD */}
      {activeTab === "dashboard" && (
        <div className="space-y-6">
          {/* KPI METRIC CARDS GRID */}
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-7 gap-3">
            <div className="p-4 rounded-2xl border border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)] space-y-1">
              <p className="text-[10px] font-extrabold text-[var(--color-mute)] uppercase tracking-wider">Total Leads</p>
              <p className="text-xl font-black text-blue-600 dark:text-blue-400">{metrics.totalLeads}</p>
              <p className="text-[10px] text-emerald-500 font-semibold">{metrics.newLeads} New Leads</p>
            </div>
            <div className="p-4 rounded-2xl border border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)] space-y-1">
              <p className="text-[10px] font-extrabold text-[var(--color-mute)] uppercase tracking-wider">Follow-ups</p>
              <p className="text-xl font-black text-amber-600 dark:text-amber-400">{metrics.followUpsDue}</p>
              <p className="text-[10px] text-[var(--color-mute)]">Due Today</p>
            </div>
            <div className="p-4 rounded-2xl border border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)] space-y-1">
              <p className="text-[10px] font-extrabold text-[var(--color-mute)] uppercase tracking-wider">Active Deals</p>
              <p className="text-xl font-black text-purple-600 dark:text-purple-400">{metrics.activeOpportunities}</p>
              <p className="text-[10px] text-[var(--color-mute)]">In Pipeline</p>
            </div>
            <div className="p-4 rounded-2xl border border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)] space-y-1">
              <p className="text-[10px] font-extrabold text-[var(--color-mute)] uppercase tracking-wider">Pipeline Value</p>
              <p className="text-xl font-black text-sky-600 dark:text-sky-400">₹{(metrics.pipelineValue / 100000).toFixed(1)}L</p>
              <p className="text-[10px] text-[var(--color-mute)]">Expected Value</p>
            </div>
            <div className="p-4 rounded-2xl border border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)] space-y-1">
              <p className="text-[10px] font-extrabold text-[var(--color-mute)] uppercase tracking-wider">Quotations</p>
              <p className="text-xl font-black text-indigo-600 dark:text-indigo-400">{metrics.quotationPending}</p>
              <p className="text-[10px] text-amber-500 font-semibold">Pending Approval</p>
            </div>
            <div className="p-4 rounded-2xl border border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)] space-y-1">
              <p className="text-[10px] font-extrabold text-[var(--color-mute)] uppercase tracking-wider">Orders Won</p>
              <p className="text-xl font-black text-emerald-600 dark:text-emerald-400">{metrics.ordersWon}</p>
              <p className="text-[10px] text-emerald-500 font-semibold">{metrics.ordersLost} Lost</p>
            </div>
            <div className="p-4 rounded-2xl border border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)] space-y-1">
              <p className="text-[10px] font-extrabold text-[var(--color-mute)] uppercase tracking-wider">Monthly Sales</p>
              <p className="text-xl font-black text-emerald-600 dark:text-emerald-400">₹{(metrics.monthlySales / 100000).toFixed(1)}L</p>
              <p className="text-[10px] text-[var(--color-mute)]">Target: ₹50L</p>
            </div>
          </div>

          {/* QUICK ACTIONS ROW */}
          <div className="p-4 rounded-2xl border border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)] space-y-3">
            <h3 className="text-xs font-extrabold text-[var(--color-ink)] uppercase tracking-wider">Quick Sales Operations</h3>
            <div className="flex items-center gap-2 flex-wrap">
              <button
                type="button"
                onClick={() => setShowLeadModal(true)}
                className="px-3 py-1.5 rounded-lg bg-blue-500/10 hover:bg-blue-500/20 text-blue-600 dark:text-blue-400 text-xs font-bold transition-colors"
              >
                + Create Lead
              </button>
              <button
                type="button"
                onClick={() => setShowCustomerModal(true)}
                className="px-3 py-1.5 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-xs font-bold transition-colors"
              >
                + Add Customer
              </button>
              <button
                type="button"
                onClick={() => setShowOpportunityModal(true)}
                className="px-3 py-1.5 rounded-lg bg-purple-500/10 hover:bg-purple-500/20 text-purple-600 dark:text-purple-400 text-xs font-bold transition-colors"
              >
                + Create Opportunity
              </button>
              <button
                type="button"
                onClick={() => setShowQuotationModal(true)}
                className="px-3 py-1.5 rounded-lg bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 text-xs font-bold transition-colors"
              >
                + Create Quotation
              </button>
              <button
                type="button"
                onClick={() => setShowInteractionModal(true)}
                className="px-3 py-1.5 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-600 dark:text-amber-400 text-xs font-bold transition-colors"
              >
                + Schedule Follow-up
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: LEADS MANAGEMENT */}
      {activeTab === "leads" && (
        <div className="space-y-4">
          <div className="p-4 rounded-2xl border border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)] flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="relative w-full sm:w-72">
              <AnimatedSearch size={16} className="absolute left-3 top-2.5 text-[var(--color-mute)]" />
              <input
                type="text"
                placeholder="Search leads by name or company..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-1.5 rounded-xl border border-[var(--color-hairline)] bg-[var(--color-canvas)] text-xs text-[var(--color-ink)] focus:outline-none"
              />
            </div>
            <button
              type="button"
              onClick={() => setShowLeadModal(true)}
              className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shrink-0 cursor-pointer"
            >
              + Create Lead
            </button>
          </div>

          <div className="rounded-2xl border border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)] overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-[var(--color-hairline)] bg-[var(--color-hairline-soft-surface)] text-[var(--color-mute)] uppercase text-[10px] font-extrabold tracking-wider">
                    <th className="py-3 px-4">Lead #</th>
                    <th className="py-3 px-4">Company & Contact</th>
                    <th className="py-3 px-4">Machine Required</th>
                    <th className="py-3 px-4">Expected Date</th>
                    <th className="py-3 px-4">Source</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--color-hairline)]">
                  {leads.map((lead) => (
                    <tr key={lead.id} className="hover:bg-[var(--color-hairline-soft-surface)] transition-colors">
                      <td className="py-3 px-4 font-mono font-extrabold text-blue-600 dark:text-blue-400">{lead.lead_number}</td>
                      <td className="py-3 px-4">
                        <p className="font-extrabold text-[var(--color-ink)]">{lead.company_name}</p>
                        <p className="text-[11px] text-[var(--color-mute)]">{lead.contact_person} ({lead.phone})</p>
                      </td>
                      <td className="py-3 px-4 font-semibold text-[var(--color-ink)]">
                        {lead.machine_model || "Standard Unit"} ({lead.expected_quantity} pcs)
                      </td>
                      <td className="py-3 px-4 text-[var(--color-mute)]">{lead.expected_purchase_date || "N/A"}</td>
                      <td className="py-3 px-4 text-[var(--color-mute)]">{lead.lead_source}</td>
                      <td className="py-3 px-4">
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-blue-500/10 text-blue-600 border border-blue-500/20">
                          {lead.status}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right space-x-2">
                        {lead.status !== "Qualified" && lead.status !== "Won" && (
                          <button
                            type="button"
                            onClick={() => handleConvertLead(lead.id)}
                            className="px-2.5 py-1 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 font-bold text-[11px]"
                          >
                            Convert Lead
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: CUSTOMER MANAGEMENT */}
      {activeTab === "customers" && (
        <div className="space-y-4">
          <div className="p-4 rounded-2xl border border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)] flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="relative w-full sm:w-72">
              <AnimatedSearch size={16} className="absolute left-3 top-2.5 text-[var(--color-mute)]" />
              <input
                type="text"
                placeholder="Search customers..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-1.5 rounded-xl border border-[var(--color-hairline)] bg-[var(--color-canvas)] text-xs text-[var(--color-ink)] focus:outline-none"
              />
            </div>
            <button
              type="button"
              onClick={() => setShowCustomerModal(true)}
              className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shrink-0 cursor-pointer"
            >
              + Add Customer
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {customers.map((c) => (
              <div key={c.id} className="p-5 rounded-2xl border border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)] space-y-3 shadow-xs">
                <div className="flex items-start justify-between">
                  <div>
                    <span className="text-[10px] font-mono font-extrabold text-[var(--color-mute)] uppercase">{c.customer_code}</span>
                    <h4 className="text-base font-extrabold text-[var(--color-ink)] mt-0.5">{c.company_name}</h4>
                    <p className="text-xs text-[var(--color-mute)]">{c.city}, {c.state}</p>
                  </div>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold ${c.status === "active" ? "bg-emerald-500/10 text-emerald-600 border border-emerald-500/20" : "bg-rose-500/10 text-rose-600 border border-rose-500/20"}`}>
                    {c.status}
                  </span>
                </div>

                <div className="text-xs space-y-1 text-[var(--color-body)] border-t border-[var(--color-hairline)] pt-3">
                  <p><span className="font-semibold text-[var(--color-ink)]">Contact:</span> {c.contact_person} ({c.phone})</p>
                  {c.gstin && <p><span className="font-semibold text-[var(--color-ink)]">GSTIN:</span> {c.gstin}</p>}
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-[var(--color-hairline)]">
                  <button
                    type="button"
                    onClick={() => setSelectedCustomer(c)}
                    className="px-3 py-1 rounded-lg bg-blue-500/10 text-blue-600 font-bold text-xs hover:bg-blue-500/20"
                  >
                    View History
                  </button>
                  <button
                    type="button"
                    onClick={() => handleArchiveCustomer(c.id)}
                    className="px-3 py-1 rounded-lg bg-rose-500/10 text-rose-600 font-bold text-xs hover:bg-rose-500/20"
                  >
                    Archive
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 6: QUOTATIONS MANAGEMENT */}
      {activeTab === "quotations" && (
        <div className="space-y-4">
          <div className="p-4 rounded-2xl border border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)] flex items-center justify-between">
            <h3 className="text-xs font-extrabold text-[var(--color-ink)] uppercase tracking-wider">Multi-Version Sales Quotations</h3>
            <button
              type="button"
              onClick={() => setShowQuotationModal(true)}
              className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs shrink-0 cursor-pointer"
            >
              + Create Quotation
            </button>
          </div>

          <div className="rounded-2xl border border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)] overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-[var(--color-hairline)] bg-[var(--color-hairline-soft-surface)] text-[var(--color-mute)] uppercase text-[10px] font-extrabold tracking-wider">
                    <th className="py-3 px-4">Quotation #</th>
                    <th className="py-3 px-4">Customer Name</th>
                    <th className="py-3 px-4">Machine & Qty</th>
                    <th className="py-3 px-4">Discount %</th>
                    <th className="py-3 px-4">Grand Total</th>
                    <th className="py-3 px-4">Discount Approval</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--color-hairline)]">
                  {quotations.map((q) => (
                    <tr key={q.id} className="hover:bg-[var(--color-hairline-soft-surface)] transition-colors">
                      <td className="py-3 px-4">
                        <span className="font-mono font-extrabold text-purple-600 dark:text-purple-400">{q.quotation_number}</span>
                        <span className="ml-2 px-1.5 py-0.5 rounded text-[10px] font-bold bg-purple-500/10 text-purple-600">V{q.revision_number}</span>
                      </td>
                      <td className="py-3 px-4 font-extrabold text-[var(--color-ink)]">{q.customer_name}</td>
                      <td className="py-3 px-4 font-semibold text-[var(--color-ink)]">{q.machine_model} ({q.quantity} pcs)</td>
                      <td className="py-3 px-4 font-extrabold text-amber-600">{q.discount_percent}%</td>
                      <td className="py-3 px-4 font-black text-emerald-600">₹{q.grand_total.toLocaleString("en-IN")}</td>
                      <td className="py-3 px-4">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold ${q.discount_approval_status === "auto_approved" ? "bg-emerald-500/10 text-emerald-600" : "bg-amber-500/10 text-amber-600"}`}>
                          {q.discount_approval_status}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right space-x-2">
                        <button
                          type="button"
                          onClick={() => setShowRevisionModal(q)}
                          className="px-2.5 py-1 rounded-lg bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-600 font-bold text-[11px]"
                        >
                          Revise (V{q.revision_number + 1})
                        </button>
                        <button
                          type="button"
                          onClick={() => handleCreateOrder(q)}
                          className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[11px]"
                        >
                          Create Order
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 7: SALES ORDERS */}
      {activeTab === "orders" && (
        <div className="space-y-4">
          <div className="rounded-2xl border border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)] overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-[var(--color-hairline)] bg-[var(--color-hairline-soft-surface)] text-[var(--color-mute)] uppercase text-[10px] font-extrabold tracking-wider">
                    <th className="py-3 px-4">Order #</th>
                    <th className="py-3 px-4">Customer</th>
                    <th className="py-3 px-4">Machine</th>
                    <th className="py-3 px-4">Total Amount</th>
                    <th className="py-3 px-4">Reserved Machine</th>
                    <th className="py-3 px-4">Order Status</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--color-hairline)]">
                  {orders.map((o) => (
                    <tr key={o.id} className="hover:bg-[var(--color-hairline-soft-surface)] transition-colors">
                      <td className="py-3 px-4 font-mono font-extrabold text-blue-600">{o.order_number}</td>
                      <td className="py-3 px-4 font-extrabold text-[var(--color-ink)]">{o.customer_name}</td>
                      <td className="py-3 px-4 font-semibold text-[var(--color-ink)]">{o.machine_model}</td>
                      <td className="py-3 px-4 font-black text-emerald-600">₹{o.total_amount.toLocaleString("en-IN")}</td>
                      <td className="py-3 px-4 font-bold">
                        {o.machine_reserved ? (
                          <span className="text-emerald-600 flex items-center gap-1"><CheckCircle2 className="h-3.5 w-3.5" /> Reserved</span>
                        ) : (
                          <span className="text-amber-600">Not Reserved</span>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-blue-500/10 text-blue-600">
                          {o.status}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right space-x-2">
                        {!o.machine_reserved && (
                          <button
                            type="button"
                            onClick={() => setShowReservationModal(o)}
                            className="px-2.5 py-1 rounded-lg bg-purple-500/10 hover:bg-purple-500/20 text-purple-600 font-bold text-[11px]"
                          >
                            Reserve Machine
                          </button>
                        )}
                        {o.status !== "delivery_requested" && o.status !== "delivered" && (
                          <button
                            type="button"
                            onClick={() => setShowDeliveryModal(o)}
                            className="px-2.5 py-1 rounded-lg bg-sky-500/10 hover:bg-sky-500/20 text-sky-600 font-bold text-[11px]"
                          >
                            Request Delivery
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* CREATE LEAD MODAL */}
      <AnimatePresence>
        {showLeadModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowLeadModal(false)} className="fixed inset-0 bg-black/60 backdrop-blur-xs" />
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="relative z-10 w-full max-w-xl rounded-2xl border border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)] p-6 shadow-2xl space-y-4">
              <div className="flex items-center justify-between border-b border-[var(--color-hairline)] pb-3">
                <h3 className="text-lg font-extrabold text-[var(--color-ink)]">Create Sales Lead</h3>
                <button type="button" onClick={() => setShowLeadModal(false)} className="p-1 hover:opacity-70"><X className="h-5 w-5" /></button>
              </div>
              <form onSubmit={handleCreateLead} className="space-y-4 text-xs">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="font-bold text-[var(--color-ink)]">Lead Name</label>
                    <input type="text" required value={leadForm.leadName} onChange={(e) => setLeadForm({ ...leadForm, leadName: e.target.value })} className="w-full mt-1 p-2 rounded-lg border border-[var(--color-hairline)] bg-[var(--color-canvas)] text-[var(--color-ink)]" />
                  </div>
                  <div>
                    <label className="font-bold text-[var(--color-ink)]">Company Name</label>
                    <input type="text" required value={leadForm.companyName} onChange={(e) => setLeadForm({ ...leadForm, companyName: e.target.value })} className="w-full mt-1 p-2 rounded-lg border border-[var(--color-hairline)] bg-[var(--color-canvas)] text-[var(--color-ink)]" />
                  </div>
                  <div>
                    <label className="font-bold text-[var(--color-ink)]">Contact Person</label>
                    <input type="text" required value={leadForm.contactPerson} onChange={(e) => setLeadForm({ ...leadForm, contactPerson: e.target.value })} className="w-full mt-1 p-2 rounded-lg border border-[var(--color-hairline)] bg-[var(--color-canvas)] text-[var(--color-ink)]" />
                  </div>
                  <div>
                    <label className="font-bold text-[var(--color-ink)]">Phone Number</label>
                    <input type="text" required value={leadForm.phone} onChange={(e) => setLeadForm({ ...leadForm, phone: e.target.value })} className="w-full mt-1 p-2 rounded-lg border border-[var(--color-hairline)] bg-[var(--color-canvas)] text-[var(--color-ink)]" />
                  </div>
                </div>
                <div className="flex justify-end gap-2 pt-2">
                  <button type="button" onClick={() => setShowLeadModal(false)} className="px-4 py-2 rounded-xl border border-[var(--color-hairline)] font-bold">Cancel</button>
                  <button type="submit" className="px-4 py-2 rounded-xl bg-blue-600 text-white font-bold">Create Lead</button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* CREATE QUOTATION MODAL */}
      <AnimatePresence>
        {showQuotationModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowQuotationModal(false)} className="fixed inset-0 bg-black/60 backdrop-blur-xs" />
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="relative z-10 w-full max-w-xl rounded-2xl border border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)] p-6 shadow-2xl space-y-4">
              <div className="flex items-center justify-between border-b border-[var(--color-hairline)] pb-3">
                <h3 className="text-lg font-extrabold text-[var(--color-ink)]">Create Sales Quotation</h3>
                <button type="button" onClick={() => setShowQuotationModal(false)} className="p-1 hover:opacity-70"><X className="h-5 w-5" /></button>
              </div>
              <form onSubmit={handleCreateQuotation} className="space-y-4 text-xs">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="font-bold text-[var(--color-ink)]">Customer Name</label>
                    <input type="text" required value={quotationForm.customerName} onChange={(e) => setQuotationForm({ ...quotationForm, customerName: e.target.value })} className="w-full mt-1 p-2 rounded-lg border border-[var(--color-hairline)] bg-[var(--color-canvas)] text-[var(--color-ink)]" />
                  </div>
                  <div>
                    <label className="font-bold text-[var(--color-ink)]">Machine Model</label>
                    <input type="text" required value={quotationForm.machineModel} onChange={(e) => setQuotationForm({ ...quotationForm, machineModel: e.target.value })} className="w-full mt-1 p-2 rounded-lg border border-[var(--color-hairline)] bg-[var(--color-canvas)] text-[var(--color-ink)]" />
                  </div>
                  <div>
                    <label className="font-bold text-[var(--color-ink)]">Unit Price (₹)</label>
                    <input type="number" required value={quotationForm.unitPrice} onChange={(e) => setQuotationForm({ ...quotationForm, unitPrice: Number(e.target.value) })} className="w-full mt-1 p-2 rounded-lg border border-[var(--color-hairline)] bg-[var(--color-canvas)] text-[var(--color-ink)]" />
                  </div>
                  <div>
                    <label className="font-bold text-[var(--color-ink)]">Discount (%)</label>
                    <input type="number" required value={quotationForm.discountPercent} onChange={(e) => setQuotationForm({ ...quotationForm, discountPercent: Number(e.target.value) })} className="w-full mt-1 p-2 rounded-lg border border-[var(--color-hairline)] bg-[var(--color-canvas)] text-[var(--color-ink)]" />
                  </div>
                </div>

                {quotationForm.discountPercent > 5 && (
                  <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-600 font-bold flex items-center gap-2">
                    <ShieldAlert className="h-4 w-4 shrink-0" />
                    <span>Discount exceeds 5% limit. Quotation will require Manager Approval before confirmation!</span>
                  </div>
                )}

                <div className="flex justify-end gap-2 pt-2">
                  <button type="button" onClick={() => setShowQuotationModal(false)} className="px-4 py-2 rounded-xl border border-[var(--color-hairline)] font-bold">Cancel</button>
                  <button type="submit" className="px-4 py-2 rounded-xl bg-purple-600 text-white font-bold">Create Quotation</button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
