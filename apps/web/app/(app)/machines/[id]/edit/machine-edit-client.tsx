"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  Button,
  Input,
  Select,
  useToast,
  MultiUserSelect,
  ClientSelect,
  ConfirmationDialog,
  Breadcrumb,
  Badge,
  type ClientSelectItem,
} from "@/components/ui";
import {
  AnimatedTrash,
  AnimatedArrowLeft,
} from "@/components/ui/animated-icons";
import {
  updateMachineInfoAction,
  updateMachineSupervisorsAction,
  updateMachineOperatorsAction,
  updateMachineClientAssignmentAction,
  checkMachineSerialNumberAvailable,
  deleteMachine,
} from "@/app/actions/machines";
import type { Machine, User, UserRole } from "@/lib/types/database";
import { isManagerOrAbove } from "@reachinternational/permissions";
import { AlertCircle } from "lucide-react";

export interface MachineEditClientProps {
  machine: Machine;
  supervisors?: User[];
  operators?: User[];
  clients?: ClientSelectItem[];
  userRole: UserRole;
  canDelete: boolean;
}

const HEALTH_STATUS_OPTIONS = [
  { value: "active", label: "Active" },
  { value: "spare", label: "Spare" },
  { value: "under_maintenance", label: "Under Maintenance" },
  { value: "breakdown", label: "Breakdown" },
];

export function MachineEditClient({
  machine,
  supervisors = [],
  operators = [],
  clients = [],
  userRole,
  canDelete,
}: MachineEditClientProps) {
  const router = useRouter();
  const { toast } = useToast();

  // Authoritative local state representing saved database record
  const [savedMachine, setSavedMachine] = useState<Machine>(machine);

  // Deletion dialog state
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);

  const canEditSupervisor = isManagerOrAbove(userRole);

  // -------------------------------------------------------------
  // CARD 1: Machine Information & Specifications
  // -------------------------------------------------------------
  const [model, setModel] = useState<string>(machine.model || "");
  const [serialNumber, setSerialNumber] = useState<string>(machine.serial_number || "");
  const [yearOfMfg, setYearOfMfg] = useState<string>(machine.year_of_mfg ? String(machine.year_of_mfg) : "");
  const [manufacturer, setManufacturer] = useState<string>(machine.manufacturer || "");
  const [hourMeter, setHourMeter] = useState<string>(String(machine.hour_meter ?? 0));
  const [healthStatus, setHealthStatus] = useState<string>(machine.health_status || "active");
  const [infoErrors, setInfoErrors] = useState<Record<string, string>>({});
  const [isSavingInfo, setIsSavingInfo] = useState(false);

  // -------------------------------------------------------------
  // CARD 2: Supervisor Assignment
  // -------------------------------------------------------------
  const initialSupervisorIds = Array.isArray(machine.supervisor_ids) && machine.supervisor_ids.length > 0
    ? machine.supervisor_ids
    : machine.current_supervisor_id ? [machine.current_supervisor_id] : [];

  const [supervisorIds, setSupervisorIds] = useState<string[]>(initialSupervisorIds);
  const [isSavingSupervisors, setIsSavingSupervisors] = useState(false);

  // -------------------------------------------------------------
  // CARD 3: Operator Assignment
  // -------------------------------------------------------------
  const initialOperatorIds = Array.isArray(machine.operator_ids) && machine.operator_ids.length > 0
    ? machine.operator_ids
    : machine.current_operator_id ? [machine.current_operator_id] : [];

  const [operatorIds, setOperatorIds] = useState<string[]>(initialOperatorIds);
  const [isSavingOperators, setIsSavingOperators] = useState(false);

  // -------------------------------------------------------------
  // CARD 4: Client Assignment & Rental Status
  // -------------------------------------------------------------
  const [clientId, setClientId] = useState<string>(machine.client_id || "");
  const [isSavingClient, setIsSavingClient] = useState(false);

  // -------------------------------------------------------------
  // Option Lists Hydration (Supervisors, Operators, Clients)
  // -------------------------------------------------------------
  const allSupervisors: Array<{ id: string; full_name: string; phone?: string | null; email?: string | null; shift_time?: string | null }> = [...supervisors];
  if (Array.isArray(machine.supervisors)) {
    machine.supervisors.forEach((s) => {
      if (s && !allSupervisors.some((item) => item.id === s.id)) {
        allSupervisors.push(s);
      }
    });
  }
  if (machine.current_supervisor && machine.current_supervisor_id) {
    if (!allSupervisors.some((s) => s.id === machine.current_supervisor_id)) {
      allSupervisors.push(machine.current_supervisor);
    }
  }

  const allOperators: Array<{ id: string; full_name: string; phone?: string | null; email?: string | null; shift_time?: string | null }> = [...operators];
  if (Array.isArray(machine.operators)) {
    machine.operators.forEach((o) => {
      if (o && !allOperators.some((item) => item.id === o.id)) {
        allOperators.push(o);
      }
    });
  }
  if (machine.current_operator && machine.current_operator_id) {
    if (!allOperators.some((o) => o.id === machine.current_operator_id)) {
      allOperators.push(machine.current_operator);
    }
  }

  const allClients: ClientSelectItem[] = [...clients];
  if (machine.client && machine.client_id) {
    if (!allClients.some((c) => c.id === machine.client_id)) {
      allClients.push(machine.client as ClientSelectItem);
    }
  }

  const assignedClient = allClients.find((c) => c.id === clientId);
  const assignedClientName = assignedClient?.company_name || assignedClient?.name || (clientId ? "Assigned Client" : "");

  // Standardized Title: Machine Model - Serial no (with graceful fallbacks)
  const machineTitle =
    [model, serialNumber].filter(Boolean).join(" - ") ||
    savedMachine.machine_id ||
    "Machine Details";

  // -------------------------------------------------------------
  // Dirty Checking for Independent Saves
  // -------------------------------------------------------------
  const isInfoDirty =
    model.trim() !== (savedMachine.model || "").trim() ||
    serialNumber.trim() !== (savedMachine.serial_number || "").trim() ||
    yearOfMfg.trim() !== (savedMachine.year_of_mfg ? String(savedMachine.year_of_mfg) : "").trim() ||
    manufacturer.trim() !== (savedMachine.manufacturer || "").trim() ||
    (parseFloat(hourMeter) || 0) !== (savedMachine.hour_meter ?? 0) ||
    healthStatus !== (savedMachine.health_status || "active");

  const savedSupIds = Array.isArray(savedMachine.supervisor_ids) && savedMachine.supervisor_ids.length > 0
    ? savedMachine.supervisor_ids
    : savedMachine.current_supervisor_id ? [savedMachine.current_supervisor_id] : [];
  const isSupervisorsDirty =
    JSON.stringify([...supervisorIds].sort()) !== JSON.stringify([...savedSupIds].sort());

  const savedOpIds = Array.isArray(savedMachine.operator_ids) && savedMachine.operator_ids.length > 0
    ? savedMachine.operator_ids
    : savedMachine.current_operator_id ? [savedMachine.current_operator_id] : [];
  const isOperatorsDirty =
    JSON.stringify([...operatorIds].sort()) !== JSON.stringify([...savedOpIds].sort());

  const isClientDirty = (clientId || "") !== (savedMachine.client_id || "");

  const lastMachineIdAttemptRef = useRef<number>(0);

  const handleLockedMachineIdAttempt = (e?: React.SyntheticEvent) => {
    if (e && "key" in e && (e as React.KeyboardEvent).key === "Tab") {
      return;
    }
    if (e && "preventDefault" in e) {
      e.preventDefault();
    }
    setInfoErrors((prev) => ({
      ...prev,
      machine_id: "Machine ID cannot be edited.",
    }));

    const now = Date.now();
    if (now - lastMachineIdAttemptRef.current > 1200) {
      lastMachineIdAttemptRef.current = now;
      toast("error", "Cannot edit Machine ID", "Machine ID cannot be edited.");
    }
  };

  const handleSerialBlur = async () => {
    const val = serialNumber.trim();
    if (!val || val.toLowerCase() === (savedMachine.serial_number || "").toLowerCase().trim()) {
      setInfoErrors((prev) => {
        const next = { ...prev };
        delete next.serial_number;
        return next;
      });
      return;
    }
    const check = await checkMachineSerialNumberAvailable(val, machine.id);
    if (!check.available) {
      setInfoErrors((prev) => ({
        ...prev,
        serial_number: `Serial number already registered to machine ${check.existingMachineId}.`,
      }));
    } else {
      setInfoErrors((prev) => {
        const next = { ...prev };
        delete next.serial_number;
        return next;
      });
    }
  };

  // -------------------------------------------------------------
  // Independent Save Handlers
  // -------------------------------------------------------------

  // 1. Save Machine Info
  const handleSaveMachineInfo = async () => {
    setInfoErrors({});
    const errors: Record<string, string> = {};
    if (!model.trim()) errors.model = "Model is mandatory.";
    if (!serialNumber.trim()) errors.serial_number = "Serial Number is mandatory.";
    if (!yearOfMfg.trim()) errors.year_of_mfg = "Year of Manufacture is mandatory.";
    if (!manufacturer.trim()) errors.manufacturer = "Manufacturer is mandatory.";
    const parsedHmr = parseFloat(hourMeter);
    if (isNaN(parsedHmr) || parsedHmr < 0) {
      errors.hour_meter = "HMR cannot be negative.";
    }

    if (Object.keys(errors).length > 0) {
      setInfoErrors(errors);
      toast("error", "Validation error", "Please complete all mandatory machine specification fields.");
      return;
    }

    setIsSavingInfo(true);
    try {
      const res = await updateMachineInfoAction(machine.id, {
        machine_id: savedMachine.machine_id,
        model: model.trim(),
        serial_number: serialNumber.trim(),
        year_of_mfg: yearOfMfg.trim(),
        manufacturer: manufacturer.trim(),
        hour_meter: parsedHmr || 0,
        health_status: healthStatus as any,
      });

      if (res.error) {
        toast("error", "Failed to update machine info", res.error);
        if (res.fieldErrors) setInfoErrors(res.fieldErrors);
      } else {
        setSavedMachine((prev) => ({
          ...prev,
          ...(res.machine as any),
          machine_id: res.machine?.machine_id || savedMachine.machine_id,
        }));
        toast("success", "Machine specifications updated", `Info for ${res.machine?.machine_id || savedMachine.machine_id} saved successfully.`);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "An unexpected error occurred while updating machine details.";
      toast("error", "Failed to update machine", msg);
    } finally {
      setIsSavingInfo(false);
    }
  };

  // 2. Save Supervisors
  const handleSaveSupervisors = async () => {
    setIsSavingSupervisors(true);
    try {
      const res = await updateMachineSupervisorsAction(machine.id, supervisorIds);
      if (res.error) {
        toast("error", "Failed to update supervisors", res.error);
      } else {
        setSavedMachine((prev) => ({
          ...prev,
          supervisor_ids: res.supervisor_ids,
          current_supervisor_id: res.current_supervisor_id || null,
        }));
        toast(
          "success",
          "Supervisors updated",
          `${supervisorIds.length} supervisor${supervisorIds.length === 1 ? "" : "s"} assigned to this machine.`
        );
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to update supervisors";
      toast("error", "Failed to update supervisors", msg);
    } finally {
      setIsSavingSupervisors(false);
    }
  };

  // 3. Save Operators
  const handleSaveOperators = async () => {
    setIsSavingOperators(true);
    try {
      const res = await updateMachineOperatorsAction(machine.id, operatorIds);
      if (res.error) {
        toast("error", "Failed to update operators", res.error);
      } else {
        setSavedMachine((prev) => ({
          ...prev,
          operator_ids: res.operator_ids,
          current_operator_id: res.current_operator_id || null,
        }));
        toast(
          "success",
          "Operators updated",
          `${operatorIds.length} operator${operatorIds.length === 1 ? "" : "s"} assigned for shift execution.`
        );
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to update operators";
      toast("error", "Failed to update operators", msg);
    } finally {
      setIsSavingOperators(false);
    }
  };

  // 4. Save Client Assignment
  const handleSaveClient = async () => {
    setIsSavingClient(true);
    try {
      const res = await updateMachineClientAssignmentAction(machine.id, clientId || null);
      if (res.error) {
        toast("error", "Failed to update client assignment", res.error);
      } else {
        setSavedMachine((prev) => ({
          ...prev,
          client_id: res.client_id || null,
          status: res.status || "available",
        }));
        toast(
          "success",
          res.client_id ? "Client assigned" : "Machine set to available",
          res.client_id
            ? `Machine deployed to ${assignedClientName} (Status: Rented).`
            : "Client assignment cleared. Machine is now Available in fleet."
        );
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to update client assignment";
      toast("error", "Failed to update client assignment", msg);
    } finally {
      setIsSavingClient(false);
    }
  };

  // Delete Machine
  const handleDeleteMachine = async () => {
    setIsDeleting(true);
    try {
      const res = await deleteMachine(machine.id);
      if (res?.error) {
        setIsDeleting(false);
        toast("error", "Failed to delete machine", res.error);
        setDeleteConfirmOpen(false);
      } else {
        toast("success", "Machine deleted", `${machine.machine_id} has been permanently deleted.`);
        setDeleteConfirmOpen(false);
        router.push("/machines");
      }
    } catch (err: unknown) {
      setIsDeleting(false);
      const msg = err instanceof Error ? err.message : "An unexpected error occurred while deleting machine.";
      toast("error", "Failed to delete machine", msg);
      setDeleteConfirmOpen(false);
    }
  };

  return (
    <div className="w-full max-w-6xl mx-auto space-y-4 sm:space-y-5 px-3 sm:px-6 py-3 sm:py-6 pb-24 sm:pb-8">
      {/* Top Breadcrumb & Back Action */}
      <div className="flex items-center justify-between gap-2 sm:gap-3">
        <div className="min-w-0 flex-1 overflow-hidden">
          <Breadcrumb
            items={[
              { label: "Machines", href: "/machines" },
              { label: savedMachine.machine_id, href: `/machines/${machine.id}` },
              { label: "Edit Machine" },
            ]}
          />
        </div>
        <Button
          variant="secondary"
          size="sm"
          responsive
          mobileIconOnly
          icon={<AnimatedArrowLeft size={14} />}
          href={`/machines/${machine.id}`}
          title="Back to Machine Details"
        >
          Back to Details
        </Button>
      </div>

      {/* Hero Header Card */}
      <div className="rounded-2xl border border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)] p-3.5 sm:p-5 md:p-6 shadow-xs relative overflow-hidden">
        <div className="flex items-center justify-between gap-3 relative z-10">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-base sm:text-xl md:text-2xl font-bold tracking-tight text-[var(--color-ink)] truncate">
                {machineTitle}
              </h1>
              <Badge
                variant={
                  savedMachine.health_status === "breakdown"
                    ? "overdue"
                    : savedMachine.health_status === "under_maintenance"
                    ? "warning"
                    : savedMachine.health_status === "spare"
                    ? "spare"
                    : "success"
                }
                dot
              >
                <span className="capitalize font-semibold text-[11px] sm:text-xs">
                  {savedMachine.health_status === "breakdown"
                    ? "Breakdown"
                    : savedMachine.health_status === "under_maintenance"
                    ? "Under Maintenance"
                    : savedMachine.health_status === "spare"
                    ? "Spare"
                    : "Active"}
                </span>
              </Badge>
              <span
                className={`px-2 py-0.5 text-xs font-medium rounded-md border ${
                  savedMachine.status === "rented"
                    ? "bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-500/20"
                    : "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20"
                }`}
              >
                {savedMachine.status === "rented" ? "Rented" : "Available"}
              </span>
            </div>
          </div>

          {canDelete && (
            <div className="shrink-0">
              <Button
                variant="destructive"
                size="sm"
                responsive
                mobileIconOnly
                icon={<AnimatedTrash size={14} />}
                onClick={() => setDeleteConfirmOpen(true)}
                disabled={isSavingInfo || isSavingSupervisors || isSavingOperators || isSavingClient || isDeleting}
                title="Delete Machine"
              >
                Delete Machine
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* 2-Column Responsive Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-5 items-start">
        {/* ============================================================= */}
        {/* CARD 1: Machine Information & Specifications */}
        {/* ============================================================= */}
        <div className="space-y-4 sm:space-y-5">
          <div className="rounded-2xl border border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)] p-3.5 sm:p-5 md:p-6 shadow-xs space-y-4">
            <div className="pb-3 border-b border-[var(--color-hairline)] flex items-center justify-between flex-wrap gap-2">
              <h2 className="text-xs sm:text-sm font-semibold uppercase tracking-wider text-[var(--color-ink)]">
                1. Machine Information & Specifications
              </h2>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
              {/* Machine Code / ID (Immutable) */}
              <div
                className="w-full cursor-not-allowed group/locked-machine"
                onClick={handleLockedMachineIdAttempt}
                onTouchStart={handleLockedMachineIdAttempt}
                title="Machine ID cannot be edited"
              >
                <Input
                  label={
                    <span className="flex items-center gap-1.5 cursor-not-allowed">
                      <span>Machine Code / ID</span>
                      <span className="text-[10px] font-semibold text-[var(--color-mute)] px-1.5 py-0.2 rounded border border-[var(--color-hairline)] bg-[var(--color-hairline-soft-surface)] uppercase tracking-wider select-none">
                        Locked
                      </span>
                    </span>
                  }
                  name="machine_id"
                  value={savedMachine.machine_id || ""}
                  readOnly
                  tabIndex={0}
                  className={`cursor-not-allowed select-none font-mono focus:ring-0 ${
                    infoErrors.machine_id
                      ? "border-rose-500 dark:border-rose-400 bg-rose-500/10 text-rose-600 dark:text-rose-400"
                      : "bg-[var(--color-hairline-soft-surface)]/60 text-[var(--color-mute)] border-[var(--color-hairline)]"
                  }`}
                  error={infoErrors.machine_id}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleLockedMachineIdAttempt(e);
                  }}
                  onTouchStart={(e) => {
                    e.stopPropagation();
                    handleLockedMachineIdAttempt(e);
                  }}
                  onKeyDown={handleLockedMachineIdAttempt}
                />
              </div>

              {/* Model */}
              <Input
                label="Model *"
                name="model"
                placeholder="e.g. CAT-320 / JCB-430 / S3246"
                value={model}
                onChange={(e) => {
                  setModel(e.target.value);
                  if (infoErrors.model) {
                    setInfoErrors((prev) => {
                      const n = { ...prev };
                      delete n.model;
                      return n;
                    });
                  }
                }}
                error={infoErrors.model}
                required
                disabled={isSavingInfo}
              />

              {/* Serial Number */}
              <Input
                label="Serial Number *"
                name="serial_number"
                placeholder="e.g. SN-98745612"
                value={serialNumber}
                onChange={(e) => {
                  setSerialNumber(e.target.value);
                  if (infoErrors.serial_number) {
                    setInfoErrors((prev) => {
                      const n = { ...prev };
                      delete n.serial_number;
                      return n;
                    });
                  }
                }}
                onBlur={handleSerialBlur}
                error={infoErrors.serial_number}
                required
                disabled={isSavingInfo}
              />

              {/* Year of Manufacture */}
              <Input
                label="Year of Manufacture (YUM) *"
                name="year_of_mfg"
                placeholder="e.g. 2024 / 2025"
                value={yearOfMfg}
                onChange={(e) => {
                  setYearOfMfg(e.target.value);
                  if (infoErrors.year_of_mfg) {
                    setInfoErrors((prev) => {
                      const n = { ...prev };
                      delete n.year_of_mfg;
                      return n;
                    });
                  }
                }}
                error={infoErrors.year_of_mfg}
                required
                disabled={isSavingInfo}
              />

              {/* Manufacturer */}
              <div className="sm:col-span-2">
                <Input
                  label="Manufacturer *"
                  name="manufacturer"
                  placeholder="e.g. Toyota / Linde / Komatsu / Caterpillar / JLG"
                  value={manufacturer}
                  onChange={(e) => {
                    setManufacturer(e.target.value);
                    if (infoErrors.manufacturer) {
                      setInfoErrors((prev) => {
                        const n = { ...prev };
                        delete n.manufacturer;
                        return n;
                      });
                    }
                  }}
                  error={infoErrors.manufacturer}
                  required
                  disabled={isSavingInfo}
                />
              </div>

              {/* Hour Meter Reading (HMR) */}
              <Input
                label="Hour Meter Reading (HMR)"
                name="hour_meter"
                type="number"
                step="0.1"
                min="0"
                placeholder="e.g. 1250.5"
                value={hourMeter}
                onChange={(e) => {
                  setHourMeter(e.target.value);
                  if (infoErrors.hour_meter) {
                    setInfoErrors((prev) => {
                      const n = { ...prev };
                      delete n.hour_meter;
                      return n;
                    });
                  }
                }}
                error={infoErrors.hour_meter}
                disabled={isSavingInfo}
              />

              {/* Health Status */}
              <Select
                label="Health Status"
                name="health_status"
                options={HEALTH_STATUS_OPTIONS}
                value={healthStatus}
                onChange={(val) => {
                  const nextVal = typeof val === "string" ? val : val?.target?.value || "active";
                  setHealthStatus(nextVal);
                }}
                disabled={isSavingInfo}
              />

              {/* Rental Status - Automatically linked to Client Assignment */}
              <div className="sm:col-span-2 flex flex-col gap-1 w-full">
                <label className="text-[12px] sm:text-[13px] font-medium text-[var(--color-ink)] select-none">
                  Rental Status (Linked to Client Assignment)
                </label>
                <div className="h-[42px] sm:h-[44px] min-h-[42px] sm:min-h-[44px] px-3.5 rounded-lg border border-[var(--color-hairline)] bg-[var(--color-canvas)] flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span
                      className={`w-2.5 h-2.5 rounded-full ${
                        clientId ? "bg-sky-500 animate-pulse" : "bg-emerald-500"
                      }`}
                    />
                    <span className="text-xs sm:text-[13px] font-semibold text-[var(--color-ink)]">
                      {clientId ? "Rented" : "Available"}
                    </span>
                    {clientId && assignedClientName && (
                      <span className="text-xs text-[var(--color-mute)] truncate max-w-[200px] sm:max-w-[320px]">
                        — Assigned to {assignedClientName}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Dedicated Action for Machine Info */}
            <div className="pt-3 border-t border-[var(--color-hairline)] flex items-center justify-between flex-wrap gap-2">
              <div className="text-xs text-[var(--color-mute)]">
                {isInfoDirty && (
                  <span className="text-amber-500 dark:text-amber-400 font-medium flex items-center gap-1.5">
                    <AlertCircle size={14} /> Unsaved changes in specifications
                  </span>
                )}
              </div>
              <Button
                type="button"
                variant="primary"
                size="sm"
                loading={isSavingInfo}
                disabled={!isInfoDirty || isSavingInfo}
                onClick={handleSaveMachineInfo}
                className="min-h-[38px] px-4 font-semibold ml-auto"
              >
                Save Machine Info
              </Button>
            </div>
          </div>
        </div>

        {/* ============================================================= */}
        {/* COLUMN 2: Personnel & Client Assignment */}
        {/* ============================================================= */}
        <div className="space-y-4 sm:space-y-5">
          {/* ============================================================= */}
          {/* CARD 2: Supervisor Assignment */}
          {/* ============================================================= */}
          <div className="rounded-2xl border border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)] p-3.5 sm:p-5 md:p-6 shadow-xs space-y-4">
            <div className="pb-3 border-b border-[var(--color-hairline)] flex items-center justify-between flex-wrap gap-2">
              <h2 className="text-xs sm:text-sm font-semibold uppercase tracking-wider text-[var(--color-ink)]">
                2. Supervisor Assignment (Multi-Shift Oversight)
              </h2>
            </div>

            <div>
              <MultiUserSelect
                label="Assigned Supervisors"
                users={allSupervisors}
                values={supervisorIds}
                onChange={setSupervisorIds}
                placeholder="Search & assign supervisors..."
                disabled={!canEditSupervisor || isSavingSupervisors}
              />
            </div>

            {/* Dedicated Action for Supervisors */}
            <div className="pt-3 border-t border-[var(--color-hairline)] flex items-center justify-between flex-wrap gap-2">
              <div className="text-xs text-[var(--color-mute)]">
                {isSupervisorsDirty && (
                  <span className="text-amber-500 dark:text-amber-400 font-medium flex items-center gap-1.5">
                    <AlertCircle size={14} /> Unsaved supervisor roster changes ({supervisorIds.length} selected)
                  </span>
                )}
              </div>
              <Button
                type="button"
                variant="primary"
                size="sm"
                loading={isSavingSupervisors}
                disabled={!isSupervisorsDirty || isSavingSupervisors || !canEditSupervisor}
                onClick={handleSaveSupervisors}
                className="min-h-[38px] px-4 font-semibold ml-auto"
              >
                Update Supervisors
              </Button>
            </div>
          </div>

          {/* ============================================================= */}
          {/* CARD 3: Operator Assignment */}
          {/* ============================================================= */}
          <div className="rounded-2xl border border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)] p-3.5 sm:p-5 md:p-6 shadow-xs space-y-4">
            <div className="pb-3 border-b border-[var(--color-hairline)] flex items-center justify-between flex-wrap gap-2">
              <h2 className="text-xs sm:text-sm font-semibold uppercase tracking-wider text-[var(--color-ink)]">
                3. Operator Assignment (24h Shift Execution)
              </h2>
            </div>

            <div>
              <MultiUserSelect
                label="Assigned Operators"
                users={allOperators}
                values={operatorIds}
                onChange={setOperatorIds}
                placeholder="Search & assign operators..."
                disabled={isSavingOperators}
              />
            </div>

            {/* Dedicated Action for Operators */}
            <div className="pt-3 border-t border-[var(--color-hairline)] flex items-center justify-between flex-wrap gap-2">
              <div className="text-xs text-[var(--color-mute)]">
                {isOperatorsDirty && (
                  <span className="text-amber-500 dark:text-amber-400 font-medium flex items-center gap-1.5">
                    <AlertCircle size={14} /> Unsaved operator roster changes ({operatorIds.length} selected)
                  </span>
                )}
              </div>
              <Button
                type="button"
                variant="primary"
                size="sm"
                loading={isSavingOperators}
                disabled={!isOperatorsDirty || isSavingOperators}
                onClick={handleSaveOperators}
                className="min-h-[38px] px-4 font-semibold ml-auto"
              >
                Update Operators
              </Button>
            </div>
          </div>

          {/* ============================================================= */}
          {/* CARD 4: Client Assignment & Rental Deployment */}
          {/* ============================================================= */}
          <div className="rounded-2xl border border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)] p-3.5 sm:p-5 md:p-6 shadow-xs space-y-4">
            <div className="pb-3 border-b border-[var(--color-hairline)] flex items-center justify-between flex-wrap gap-2">
              <h2 className="text-xs sm:text-sm font-semibold uppercase tracking-wider text-[var(--color-ink)]">
                4. Client Assignment & Rental Deployment
              </h2>
            </div>

            <div className="space-y-3">
              <ClientSelect
                label="Assigned Client"
                clients={allClients}
                value={clientId}
                onChange={(selectedId) => setClientId(selectedId || "")}
                placeholder="Search and select client renting this machine..."
                clearable
                disabled={isSavingClient}
              />

              <div className="p-3 rounded-xl border border-[var(--color-hairline)] bg-[var(--color-canvas)] flex items-center justify-between gap-3 text-xs">
                <div className="flex items-center gap-2">
                  <span
                    className={`w-2 h-2 rounded-full ${
                      clientId ? "bg-sky-500" : "bg-emerald-500"
                    }`}
                  />
                  <span className="font-semibold text-[var(--color-ink)]">
                    {clientId ? "Status upon update: RENTED" : "Status upon update: AVAILABLE"}
                  </span>
                </div>
                <span className="text-[var(--color-mute)] hidden sm:inline">
                  {clientId ? `Deploying to ${assignedClientName}` : "Returning to unassigned fleet"}
                </span>
              </div>
            </div>

            {/* Dedicated Action for Client Assignment */}
            <div className="pt-3 border-t border-[var(--color-hairline)] flex items-center justify-between flex-wrap gap-2">
              <div className="text-xs text-[var(--color-mute)]">
                {isClientDirty && (
                  <span className="text-amber-500 dark:text-amber-400 font-medium flex items-center gap-1.5">
                    <AlertCircle size={14} /> Unsaved client assignment ({clientId ? "Will set to Rented" : "Will set to Available"})
                  </span>
                )}
              </div>
              <Button
                type="button"
                variant="primary"
                size="sm"
                loading={isSavingClient}
                disabled={!isClientDirty || isSavingClient}
                onClick={handleSaveClient}
                className="min-h-[38px] px-4 font-semibold ml-auto"
              >
                {clientId ? "Update Client Assignment" : "Confirm Available in Fleet"}
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Delete Confirmation Dialog */}
      <ConfirmationDialog
        isOpen={deleteConfirmOpen}
        onClose={() => setDeleteConfirmOpen(false)}
        onConfirm={handleDeleteMachine}
        title="Delete Machine"
        description={`Are you sure you want to permanently delete machine ${savedMachine.machine_id} (${savedMachine.model || "Unknown Model"})? This action cannot be undone and will remove related logs.`}
        confirmLabel="Delete Machine"
        cancelLabel="Keep Machine"
        variant="danger"
        loading={isDeleting}
      />
    </div>
  );
}
