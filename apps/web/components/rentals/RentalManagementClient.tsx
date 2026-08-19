"use client";

import { useState } from "react";
import {
  Truck,
  FileText,
  Clock,
  CheckCircle2,
  XCircle,
  Users,
  ShieldAlert,
  DollarSign,
  ClipboardList,
} from "lucide-react";
import type { User, Machine } from "@/lib/types/database";
import type { RentalDashboardKpis } from "@/lib/queries/rentals";
import { MetricCard } from "@/components/ui/MetricCard";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";

import {
  createRentalCustomerAction,
  createRentalRequestAction,
  createRentalAgreementAction,
  dispatchRentalMachineAction,
  recordMachineReturnAction,
} from "@/app/actions/rentals";

interface RentalManagementClientProps {
  user: User;
  initialKpis: RentalDashboardKpis;
  initialRequests: any[];
  initialCustomers: any[];
  initialAgreements: any[];
  initialChallans: any[];
  initialInspections: any[];
  initialDamageReports: any[];
  initialBillingRequests: any[];
  machines: Machine[];
}

export function RentalManagementClient({
  user,
  initialKpis,
  initialRequests,
  initialCustomers,
  initialAgreements,
  initialChallans,
  initialInspections,
  initialDamageReports,
  initialBillingRequests,
  machines,
}: RentalManagementClientProps) {
  const [activeTab, setActiveTab] = useState<
    "dashboard" | "requests" | "customers" | "agreements" | "challans" | "returns" | "damage" | "billing"
  >("dashboard");

  // Modals state
  const [showCustomerModal, setShowCustomerModal] = useState(false);
  const [showRequestModal, setShowRequestModal] = useState(false);
  const [showAgreementModal, setShowAgreementModal] = useState(false);
  const [showDispatchModal, setShowDispatchModal] = useState(false);
  const [showReturnModal, setShowReturnModal] = useState(false);
  const [showExtendModal, setShowExtendModal] = useState(false);

  const [selectedAgreement, setSelectedAgreement] = useState<any>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const clearNotifications = () => {
    setErrorMessage("");
    setSuccessMessage("");
  };

  return (
    <div className="p-4 sm:p-6 md:p-8 max-w-[1400px] mx-auto space-y-6">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[var(--color-hairline)] pb-5">
        <div>
          <div className="inline-flex items-center gap-2 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 mb-2">
            <Truck className="h-3.5 w-3.5" />
            Role 11 — Rental Manager Workspace
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-[var(--color-ink)] tracking-tight">
            Equipment Rental & Fleet Operations
          </h1>
          <p className="text-xs sm:text-sm text-[var(--color-mute)] mt-1">
            Rental requests, customer directory, contract agreements, dispatch challans, return inspections & damage billing
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0 flex-wrap">
          <Button
            variant="secondary"
            onClick={() => {
              clearNotifications();
              setShowCustomerModal(true);
            }}
          >
            + Add Customer
          </Button>
          <Button
            variant="secondary"
            onClick={() => {
              clearNotifications();
              setShowRequestModal(true);
            }}
          >
            + Rental Request
          </Button>
          <Button
            variant="primary"
            onClick={() => {
              clearNotifications();
              setShowAgreementModal(true);
            }}
          >
            + New Agreement
          </Button>
        </div>
      </div>

      {/* Notifications */}
      {errorMessage && (
        <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 text-xs font-medium flex items-center justify-between">
          <span>{errorMessage}</span>
          <button onClick={() => setErrorMessage("")} className="hover:opacity-70">
            <XCircle className="h-4 w-4" />
          </button>
        </div>
      )}
      {successMessage && (
        <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-xs font-medium flex items-center justify-between">
          <span>{successMessage}</span>
          <button onClick={() => setSuccessMessage("")} className="hover:opacity-70">
            <XCircle className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* KPI Cards Strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
        <MetricCard
          label="Available Fleet"
          value={Number(initialKpis?.availableMachines || 0)}
          icon="Wrench"
          variant="success"
          trend={{ value: `${initialKpis?.utilizationRate || 0}%`, isUp: true, label: "Utilization" }}
        />
        <MetricCard
          label="Currently Rented"
          value={Number(initialKpis?.onRentMachines || 0)}
          icon="Clock"
          variant="info"
        />
        <MetricCard
          label="Reserved Machines"
          value={Number(initialKpis?.reservedMachines || 0)}
          icon="CalendarDays"
          variant="default"
        />
        <MetricCard
          label="Due for Return"
          value={Number(initialKpis?.dueForReturn || 0)}
          icon="AlertTriangle"
          variant={(initialKpis?.overdueReturns || 0) > 0 ? "error" : "warning"}
          trend={{ value: Number(initialKpis?.overdueReturns || 0), isUp: false, label: "Overdue" }}
        />
        <MetricCard
          label="Under Inspection"
          value={Number(initialKpis?.underInspection || 0)}
          icon="ShieldCheck"
          variant="default"
        />
        <MetricCard
          label="Active Contracts"
          value={Number(initialKpis?.activeContracts || 0)}
          icon="CheckCircle"
          variant="success"
        />
      </div>

      {/* Navigation Sub-Tabs */}
      <div className="border-b border-[var(--color-hairline)] flex items-center gap-1 overflow-x-auto pb-px">
        {[
          { id: "dashboard", label: "Dashboard Overview", icon: Clock },
          { id: "requests", label: `Requests (${initialRequests.length})`, icon: ClipboardList },
          { id: "customers", label: `Customers (${initialCustomers.length})`, icon: Users },
          { id: "agreements", label: `Agreements (${initialAgreements.length})`, icon: FileText },
          { id: "challans", label: `Challans (${initialChallans.length})`, icon: Truck },
          { id: "returns", label: `Returns (${initialInspections.length})`, icon: CheckCircle2 },
          { id: "damage", label: `Damages (${initialDamageReports.length})`, icon: ShieldAlert },
          { id: "billing", label: `Billing Requests (${initialBillingRequests.length})`, icon: DollarSign },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center gap-2 px-3 py-2 text-xs font-medium rounded-t-lg transition-colors whitespace-nowrap ${
                isActive
                  ? "border-b-2 border-amber-500 text-amber-600 dark:text-amber-400 bg-[var(--color-canvas-elevated)]"
                  : "text-[var(--color-mute)] hover:text-[var(--color-ink)]"
              }`}
            >
              <Icon className="h-3.5 w-3.5" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* TAB CONTENT: DASHBOARD OVERVIEW */}
      {activeTab === "dashboard" && (
        <div className="space-y-6">
          {/* Recent Operations Pipeline */}
          <div className="p-5 rounded-2xl border border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)] space-y-4">
            <h3 className="text-sm font-bold text-[var(--color-ink)]">Active Rental Contracts Lifecycle</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-4 rounded-xl border border-[var(--color-hairline)] bg-[var(--color-canvas)] space-y-2">
                <span className="text-[10px] uppercase font-bold text-amber-500 tracking-wider">Step 1 — Booking / Request</span>
                <p className="text-sm font-bold text-[var(--color-ink)]">{initialRequests.filter((r) => r.status === "pending").length} Pending Requests</p>
                <p className="text-xs text-[var(--color-mute)]">Enquiries awaiting customer qualification and machine allocation.</p>
              </div>
              <div className="p-4 rounded-xl border border-[var(--color-hairline)] bg-[var(--color-canvas)] space-y-2">
                <span className="text-[10px] uppercase font-bold text-sky-500 tracking-wider">Step 2 — Contract & Dispatch</span>
                <p className="text-sm font-bold text-[var(--color-ink)]">{initialAgreements.filter((a) => a.status === "approved").length} Ready for Dispatch</p>
                <p className="text-xs text-[var(--color-mute)]">Agreements approved requiring delivery challan & transport dispatch.</p>
              </div>
              <div className="p-4 rounded-xl border border-[var(--color-hairline)] bg-[var(--color-canvas)] space-y-2">
                <span className="text-[10px] uppercase font-bold text-emerald-500 tracking-wider">Step 3 — Return & Billing</span>
                <p className="text-sm font-bold text-[var(--color-ink)]">{initialInspections.length} Inspection Audits</p>
                <p className="text-xs text-[var(--color-mute)]">Return inspection records and damage billing requests sent to Finance.</p>
              </div>
            </div>
          </div>

          {/* Machine Fleet Availability Matrix */}
          <div className="p-5 rounded-2xl border border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)] space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-[var(--color-ink)]">Machine Fleet Availability Matrix</h3>
                <p className="text-xs text-[var(--color-mute)]">Real-time equipment availability and rental booking status</p>
              </div>
              <span className="text-xs px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-500 font-medium">
                {machines.filter((m) => m.status === "active").length} Available / Active
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {machines.slice(0, 6).map((machine) => {
                const isBookable = machine.status === "active";
                return (
                  <div
                    key={machine.id}
                    className="p-3.5 rounded-xl border border-[var(--color-hairline)] bg-[var(--color-canvas)] flex items-center justify-between"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-xs text-[var(--color-ink)]">{machine.machine_code}</span>
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                            machine.status === "active"
                              ? "bg-emerald-500/10 text-emerald-500"
                              : "bg-amber-500/10 text-amber-500"
                          }`}
                        >
                          {machine.status.toUpperCase()}
                        </span>
                      </div>
                      <p className="text-xs text-[var(--color-mute)] mt-0.5">{machine.machine_name} ({machine.model || "Standard"})</p>
                      <p className="text-[11px] text-[var(--color-mute)]">Meter: {machine.hour_meter || 0} hrs</p>
                    </div>

                    {isBookable ? (
                      <Button
                        variant="secondary"
                        onClick={() => {
                          clearNotifications();
                          setShowAgreementModal(true);
                        }}
                      >
                        Book Machine
                      </Button>
                    ) : (
                      <span className="text-[10px] text-rose-400 font-medium bg-rose-500/5 px-2 py-1 rounded border border-rose-500/10">
                        Unbookable
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* TAB CONTENT: RENTAL AGREEMENTS */}
      {activeTab === "agreements" && (
        <div className="p-5 rounded-2xl border border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)] space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-[var(--color-ink)]">Rental Contracts & Agreements</h3>
            <Button variant="primary" onClick={() => setShowAgreementModal(true)}>
              + New Contract
            </Button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="text-[var(--color-mute)] border-b border-[var(--color-hairline)] bg-[var(--color-canvas)]">
                <tr>
                  <th className="p-3">Contract #</th>
                  <th className="p-3">Customer</th>
                  <th className="p-3">Machine</th>
                  <th className="p-3">Rental Period</th>
                  <th className="p-3">Rate</th>
                  <th className="p-3">Deposit</th>
                  <th className="p-3">Status</th>
                  <th className="p-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--color-hairline)]">
                {initialAgreements.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="p-4 text-center text-[var(--color-mute)]">
                      No active rental agreements found.
                    </td>
                  </tr>
                ) : (
                  initialAgreements.map((agreement) => (
                    <tr key={agreement.id} className="hover:bg-[var(--color-canvas)]">
                      <td className="p-3 font-semibold text-[var(--color-ink)]">{agreement.contract_number}</td>
                      <td className="p-3 font-medium text-[var(--color-ink)]">
                        {agreement.rental_customers?.company_name || "Client"}
                      </td>
                      <td className="p-3">{agreement.machines?.machine_code || "Machine"}</td>
                      <td className="p-3">{agreement.start_date} $\rightarrow$ {agreement.end_date}</td>
                      <td className="p-3 font-semibold">₹{agreement.rental_rate?.toLocaleString("en-IN")}/{agreement.rate_unit}</td>
                      <td className="p-3">₹{agreement.security_deposit?.toLocaleString("en-IN")}</td>
                      <td className="p-3">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/10 text-emerald-500">
                          {agreement.status}
                        </span>
                      </td>
                      <td className="p-3 text-right space-x-2">
                        <Button
                          variant="secondary"
                          onClick={() => {
                            setSelectedAgreement(agreement);
                            setShowDispatchModal(true);
                          }}
                        >
                          Dispatch
                        </Button>
                        <Button
                          variant="secondary"
                          onClick={() => {
                            setSelectedAgreement(agreement);
                            setShowReturnModal(true);
                          }}
                        >
                          Return
                        </Button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* MODAL: CREATE CUSTOMER */}
      <Modal open={showCustomerModal} onClose={() => setShowCustomerModal(false)} title="Create Rental Customer Profile">
        <form
          action={async (formData) => {
            setIsSubmitting(true);
            const res = await createRentalCustomerAction(formData);
            setIsSubmitting(false);
            if (res.success) {
              setSuccessMessage("Rental customer created successfully.");
              setShowCustomerModal(false);
            } else {
              setErrorMessage(res.error || "Failed to create customer.");
            }
          }}
          className="space-y-4 text-xs"
        >
          <div className="grid grid-cols-2 gap-3">
            <Input label="Company Name" name="company_name" required placeholder="ABC Infra Ltd" />
            <Input label="Contact Person" name="contact_person" required placeholder="Rajesh Sharma" />
          </div>
          <Input label="Contact Mobile" name="contact_mobile" required placeholder="+91 98765 43210" />
          <div className="grid grid-cols-2 gap-3">
            <Input label="Contact Email" name="contact_email" type="email" placeholder="john@company.com" />
            <Input label="GSTIN (Optional)" name="gstin" placeholder="27AAACL1682R1ZB" />
          </div>
          <Input label="Billing Address" name="billing_address" placeholder="Plot 12, Industrial Area" />
          <div className="grid grid-cols-2 gap-3">
            <Input label="City" name="city" required placeholder="Mumbai" />
            <Input label="State" name="state" required placeholder="Maharashtra" />
          </div>

          <div className="flex justify-end gap-2 pt-3">
            <Button variant="secondary" type="button" onClick={() => setShowCustomerModal(false)}>
              Cancel
            </Button>
            <Button variant="primary" type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Saving..." : "Create Customer"}
            </Button>
          </div>
        </form>
      </Modal>

      {/* MODAL: CREATE RENTAL AGREEMENT */}
      <Modal open={showAgreementModal} onClose={() => setShowAgreementModal(false)} title="Create Rental Agreement">
        <form
          action={async (formData) => {
            setIsSubmitting(true);
            const res = await createRentalAgreementAction(formData);
            setIsSubmitting(false);
            if (res.success) {
              setSuccessMessage("Rental agreement created successfully.");
              setShowAgreementModal(false);
            } else {
              setErrorMessage(res.error || "Failed to create agreement.");
            }
          }}
          className="space-y-4 text-xs"
        >
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium mb-1">Customer</label>
              <select name="customer_id" required className="w-full p-2 rounded-lg border border-[var(--color-hairline)] bg-[var(--color-canvas)] text-[var(--color-ink)]">
                <option value="">Select Customer</option>
                {initialCustomers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.company_name} ({c.contact_person})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium mb-1">Machine</label>
              <select name="machine_id" required className="w-full p-2 rounded-lg border border-[var(--color-hairline)] bg-[var(--color-canvas)] text-[var(--color-ink)]">
                <option value="">Select Machine</option>
                {machines
                  .filter((m) => m.status === "active")
                  .map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.machine_code} - {m.machine_name} ({m.model})
                    </option>
                  ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Input label="Rental Start Date" name="start_date" type="date" required />
            <Input label="Rental End Date" name="end_date" type="date" required />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <Input label="Rental Rate (₹)" name="rental_rate" type="number" required placeholder="50000" />
            <div>
              <label className="block text-xs font-medium mb-1">Rate Unit</label>
              <select name="rate_unit" className="w-full p-2 rounded-lg border border-[var(--color-hairline)] bg-[var(--color-canvas)] text-[var(--color-ink)]">
                <option value="monthly">Monthly</option>
                <option value="weekly">Weekly</option>
                <option value="daily">Daily</option>
              </select>
            </div>
            <Input label="Security Deposit (₹)" name="security_deposit" type="number" placeholder="25000" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Input label="Discount % (High discounts require approval)" name="discount_percentage" type="number" placeholder="0" />
            <Input label="Delivery / Transport Charges (₹)" name="delivery_charges" type="number" placeholder="5000" />
          </div>

          <div className="flex justify-end gap-2 pt-3">
            <Button variant="secondary" type="button" onClick={() => setShowAgreementModal(false)}>
              Cancel
            </Button>
            <Button variant="primary" type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Generating..." : "Generate Agreement"}
            </Button>
          </div>
        </form>
      </Modal>

      {/* MODAL: DISPATCH MACHINE */}
      <Modal open={showDispatchModal} onClose={() => setShowDispatchModal(false)} title="Dispatch Rental Machine & Delivery Challan">
        <form
          action={async (formData) => {
            setIsSubmitting(true);
            const res = await dispatchRentalMachineAction(formData);
            setIsSubmitting(false);
            if (res.success) {
              setSuccessMessage("Machine dispatched successfully and delivery challan generated.");
              setShowDispatchModal(false);
            } else {
              setErrorMessage(res.error || "Dispatch failed.");
            }
          }}
          className="space-y-4 text-xs"
        >
          <input type="hidden" name="rental_agreement_id" value={selectedAgreement?.id || ""} />

          <div className="p-3 rounded-lg bg-sky-500/10 border border-sky-500/20 text-sky-600 dark:text-sky-400">
            <p className="font-semibold">Pre-Dispatch Inspection Checklist</p>
            <p className="text-[11px]">Verify hour meter, fuel level, accessories, and customer site location before dispatching.</p>
          </div>

          <Input label="Site / Delivery Location" name="site_location" required placeholder="Project Site 4, Navi Mumbai" />
          <div className="grid grid-cols-2 gap-3">
            <Input label="Current Hour Meter Reading" name="start_hour_meter" type="number" required defaultValue={selectedAgreement?.machines?.hour_meter || 0} />
            <Input label="Fuel Level (%)" name="start_fuel_level" type="number" defaultValue={100} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input label="Driver Name" name="driver_name" placeholder="Ramesh Kumar" />
            <Input label="Transport Vehicle Details" name="transport_details" placeholder="MH-04-AB-1234 Trailer" />
          </div>

          <div className="flex justify-end gap-2 pt-3">
            <Button variant="secondary" type="button" onClick={() => setShowDispatchModal(false)}>
              Cancel
            </Button>
            <Button variant="primary" type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Dispatching..." : "Finalize & Dispatch"}
            </Button>
          </div>
        </form>
      </Modal>

      {/* MODAL: RECORD RETURN */}
      <Modal open={showReturnModal} onClose={() => setShowReturnModal(false)} title="Record Machine Return & Inspection">
        <form
          action={async (formData) => {
            setIsSubmitting(true);
            const res = await recordMachineReturnAction(formData);
            setIsSubmitting(false);
            if (res.success) {
              setSuccessMessage("Return recorded successfully.");
              setShowReturnModal(false);
            } else {
              setErrorMessage(res.error || "Return recording failed.");
            }
          }}
          className="space-y-4 text-xs"
        >
          <input type="hidden" name="rental_agreement_id" value={selectedAgreement?.id || ""} />

          <div className="grid grid-cols-2 gap-3">
            <Input label="Return Hour Meter" name="end_hour_meter" type="number" required />
            <Input label="Fuel Level (%)" name="end_fuel_level" type="number" defaultValue={100} />
          </div>

          <div>
            <label className="block text-xs font-medium mb-1">Has Machine Damage?</label>
            <select name="has_damage" className="w-full p-2 rounded-lg border border-[var(--color-hairline)] bg-[var(--color-canvas)] text-[var(--color-ink)]">
              <option value="false">No — Machine OK</option>
              <option value="true">Yes — Create Damage Report</option>
            </select>
          </div>

          <Input label="Damage Description (If any)" name="damage_description" placeholder="Hydraulic hose leakage / tyre puncture" />
          <Input label="Estimated Repair Cost (₹)" name="estimated_repair_cost" type="number" placeholder="0" />

          <div className="flex justify-end gap-2 pt-3">
            <Button variant="secondary" type="button" onClick={() => setShowReturnModal(false)}>
              Cancel
            </Button>
            <Button variant="primary" type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Processing..." : "Submit Return Audit"}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
