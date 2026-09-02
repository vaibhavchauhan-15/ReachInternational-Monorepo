"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Button,
  Input,
  Select,
  useToast,
  UserSelect,
  MultiUserSelect,
  ClientSelect,
  ConfirmationDialog,
  Breadcrumb,
  type ClientSelectItem,
} from "@/components/ui";
import {
  AnimatedTrash,
  AnimatedArrowLeft,
} from "@/components/ui/animated-icons";
import { AlertCircle } from "lucide-react";
import { updateMachine, deleteMachine, checkMachineSerialNumberAvailable } from "@/app/actions/machines";
import type { Machine, User, UserRole } from "@/lib/types/database";
import { isManagerOrAbove } from "@reachinternational/permissions";

export interface MachineEditClientProps {
  machine: Machine;
  supervisors?: User[];
  operators?: User[];
  clients?: ClientSelectItem[];
  userRole: UserRole;
  canDelete: boolean;
}

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
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string>("");

  const canEditSupervisor = isManagerOrAbove(userRole);

  // Standardized Title: Machine Model - Serial no (with graceful fallbacks)
  const machineTitle =
    [machine.model, machine.serial_number].filter(Boolean).join(" - ") ||
    machine.machine_id ||
    "Machine Details";

  const initialSupervisorIds = Array.isArray(machine.supervisor_ids) && machine.supervisor_ids.length > 0
    ? machine.supervisor_ids
    : machine.current_supervisor_id ? [machine.current_supervisor_id] : [];

  const initialOperatorIds = Array.isArray(machine.operator_ids) && machine.operator_ids.length > 0
    ? machine.operator_ids
    : machine.current_operator_id ? [machine.current_operator_id] : [];

  const [supervisorIds, setSupervisorIds] = useState<string[]>(initialSupervisorIds);
  const [operatorIds, setOperatorIds] = useState<string[]>(initialOperatorIds);
  const [rentalStatus, setRentalStatus] = useState<string>(() => machine.status || "available");
  const [healthStatus, setHealthStatus] = useState<string>(() => machine.health_status || "active");
  const [clientId, setClientId] = useState<string>(() => machine.client_id || "");

  // Ensure assigned supervisors/operators are in the options list if present
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

  // Ensure assigned client is in the options list if present
  const allClients: ClientSelectItem[] = [...clients];
  if (machine.client && machine.client_id) {
    if (!allClients.some((c) => c.id === machine.client_id)) {
      allClients.push(machine.client as ClientSelectItem);
    }
  }

  const healthStatusOptions = [
    { value: "active", label: "Active" },
    { value: "under_maintenance", label: "Under Maintenance" },
    { value: "breakdown", label: "Breakdown" },
  ];

  const statusOptions = [
    { value: "available", label: "Available" },
    { value: "rented", label: "Rented" },
  ];

  const handleSerialBlur = async (e: React.FocusEvent<HTMLInputElement>) => {
    const val = e.target.value.trim();
    if (!val) return;
    if (machine.serial_number && machine.serial_number.toLowerCase().trim() === val.toLowerCase()) {
      setFieldErrors((prev) => {
        const next = { ...prev };
        delete next.serial_number;
        return next;
      });
      return;
    }
    const check = await checkMachineSerialNumberAvailable(val, machine.id);
    if (!check.available) {
      setFieldErrors((prev) => ({
        ...prev,
        serial_number: `Serial number already registered to machine ${check.existingMachineId}.`,
      }));
    } else {
      setFieldErrors((prev) => {
        const next = { ...prev };
        delete next.serial_number;
        return next;
      });
    }
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setFieldErrors({});
    setFormError("");

    const formData = new FormData(e.currentTarget);
    const model = (formData.get("model") as string)?.trim();
    const serial_number = (formData.get("serial_number") as string)?.trim();
    const year_of_mfg = (formData.get("year_of_mfg") as string)?.trim();
    const manufacturer = (formData.get("manufacturer") as string)?.trim();

    const errors: Record<string, string> = {};
    if (!model) errors.model = "Model is mandatory";
    if (!serial_number) errors.serial_number = "Serial Number is mandatory";
    if (!year_of_mfg) errors.year_of_mfg = "Year of Manufacture is mandatory";
    if (!manufacturer) errors.manufacturer = "Manufacturer is mandatory";

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      setFormError("Please complete all 4 mandatory machine specification fields (Model, Serial Number, YUM, Manufacturer).");
      return;
    }

    setIsSaving(true);
    try {
      const res = await updateMachine(machine.id, {}, formData);
      if (res?.error) {
        setIsSaving(false);
        setFormError(res.error);
        if (res.fieldErrors) setFieldErrors(res.fieldErrors);
        toast("error", "Failed to update machine", res.error);
      } else {
        toast("success", "Machine updated successfully", `Parameters for ${machine.machine_id} have been updated.`);
        router.push(`/machines/${machine.id}`);
      }
    } catch (err: unknown) {
      setIsSaving(false);
      const msg = err instanceof Error ? err.message : "An unexpected error occurred while updating machine details.";
      setFormError(msg);
      toast("error", "Failed to update machine", msg);
    }
  };

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
    <div className="w-full max-w-5xl mx-auto space-y-4 sm:space-y-5 px-3 sm:px-6 py-3 sm:py-6 pb-24 sm:pb-8">
      {/* Top Breadcrumb & Back Action */}
      <div className="flex items-center justify-between gap-2 sm:gap-3">
        <div className="min-w-0 flex-1 overflow-hidden">
          <Breadcrumb
            items={[
              { label: "Machines", href: "/machines" },
              { label: machine.machine_id, href: `/machines/${machine.id}` },
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
              <span className="px-2 py-0.5 text-xs font-mono font-medium rounded-md bg-[var(--color-hairline-soft-surface)] text-[var(--color-body)] border border-[var(--color-hairline)]">
                {machine.machine_id}
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
                disabled={isSaving || isDeleting}
                title="Delete Machine"
              >
                Delete Machine
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Main Edit Form */}
      <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-5">
        {formError && (
          <div className="p-3 sm:p-4 text-xs sm:text-sm rounded-xl bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20 flex items-start gap-2.5 sm:gap-3 shadow-xs">
            <AlertCircle size={18} className="shrink-0 mt-0.5" />
            <div className="flex-1 leading-relaxed font-medium">{formError}</div>
          </div>
        )}

        {/* SECTION 1: Machine Identification & Specifications */}
        <div className="rounded-2xl border border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)] p-3.5 sm:p-5 md:p-6 shadow-xs space-y-3.5 sm:space-y-4">
          <div className="pb-2.5 sm:pb-3 border-b border-[var(--color-hairline)] flex items-center justify-between">
            <h3 className="text-xs sm:text-sm font-semibold uppercase tracking-wider text-[var(--color-ink)]">
              1. Machine Identification & Specifications
            </h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
            <Input
              label="Machine Code / ID"
              name="machine_id"
              defaultValue={machine.machine_id}
              disabled
              hint="Unique identifier managed by Reach fleet registry."
            />

            <Input
              label="Model *"
              name="model"
              placeholder="e.g. CAT-320 / JCB-430 / S3246"
              defaultValue={machine.model || ""}
              error={fieldErrors.model}
              required
              disabled={isSaving || isDeleting}
            />

            <Input
              label="Serial Number *"
              name="serial_number"
              placeholder="e.g. SN-98745612"
              defaultValue={machine.serial_number || ""}
              error={fieldErrors.serial_number}
              onBlur={handleSerialBlur}
              required
              disabled={isSaving || isDeleting}
            />

            <Input
              label="Year of Manufacture (YUM) *"
              name="year_of_mfg"
              placeholder="e.g. 2024 / 2025"
              defaultValue={machine.year_of_mfg || ""}
              error={fieldErrors.year_of_mfg}
              required
              disabled={isSaving || isDeleting}
            />

            <div className="sm:col-span-2">
              <Input
                label="Manufacturer *"
                name="manufacturer"
                placeholder="e.g. Toyota / Linde / Komatsu / Caterpillar / JLG"
                defaultValue={machine.manufacturer || ""}
                error={fieldErrors.manufacturer}
                required
                disabled={isSaving || isDeleting}
              />
            </div>
          </div>
        </div>

        {/* SECTION 2: Metering & Fleet Assignment */}
        <div className="rounded-2xl border border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)] p-3.5 sm:p-5 md:p-6 shadow-xs space-y-3.5 sm:space-y-4">
          <div className="pb-2.5 sm:pb-3 border-b border-[var(--color-hairline)] flex items-center justify-between">
            <h3 className="text-xs sm:text-sm font-semibold uppercase tracking-wider text-[var(--color-ink)]">
              2. Meter Readings & Personnel Assignment
            </h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
            <div className="sm:col-span-2">
              <Input
                label="Hour Meter Reading (HMR)"
                name="hour_meter"
                type="number"
                step="0.1"
                min="0"
                placeholder="e.g. 1250.5"
                defaultValue={machine.hour_meter ?? 0}
                error={fieldErrors.hour_meter}
                disabled={isSaving || isDeleting}
              />
            </div>

            <div>
              <MultiUserSelect
                label="Assigned Supervisors (Multi-Shift Oversight)"
                users={allSupervisors}
                values={supervisorIds}
                onChange={setSupervisorIds}
                placeholder="Search & assign supervisors..."
                disabled={!canEditSupervisor || isSaving || isDeleting}
              />
              <input type="hidden" name="supervisor_ids" value={JSON.stringify(supervisorIds)} />
              <input type="hidden" name="current_supervisor_id" value={supervisorIds[0] || ""} />
            </div>

            <div>
              <MultiUserSelect
                label="Assigned Operators (24h Shift Execution)"
                users={allOperators}
                values={operatorIds}
                onChange={setOperatorIds}
                placeholder="Search & assign operators..."
                disabled={isSaving || isDeleting}
              />
              <input type="hidden" name="operator_ids" value={JSON.stringify(operatorIds)} />
              <input type="hidden" name="current_operator_id" value={operatorIds[0] || ""} />
            </div>
          </div>
        </div>

        {/* SECTION 3: Status & Health Tracking */}
        <div className="rounded-2xl border border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)] p-3.5 sm:p-5 md:p-6 shadow-xs space-y-3.5 sm:space-y-4">
          <div className="pb-2.5 sm:pb-3 border-b border-[var(--color-hairline)] flex items-center justify-between">
            <h3 className="text-xs sm:text-sm font-semibold uppercase tracking-wider text-[var(--color-ink)]">
              3. Status & Health Tracking
            </h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
            <Select
              label="Health Status"
              name="health_status"
              options={healthStatusOptions}
              value={healthStatus}
              onChange={(val) => {
                const nextVal = typeof val === "string" ? val : val?.target?.value || "active";
                setHealthStatus(nextVal);
              }}
              disabled={isSaving || isDeleting}
            />

            <Select
              label="Rental Status"
              name="status"
              options={statusOptions}
              value={rentalStatus}
              onChange={(val) => {
                const nextVal = typeof val === "string" ? val : val?.target?.value || "available";
                setRentalStatus(nextVal);
                if (nextVal === "available") {
                  setClientId("");
                }
              }}
              disabled={isSaving || isDeleting}
            />

            {rentalStatus === "rented" && (
              <div className="sm:col-span-2 pt-1 animate-in fade-in slide-in-from-top-2 duration-200">
                <ClientSelect
                  label="Assigned Client"
                  clients={allClients}
                  value={clientId}
                  onChange={(selectedId) => setClientId(selectedId)}
                  placeholder="Search and select client renting this machine..."
                  clearable
                  disabled={isSaving || isDeleting}
                  error={fieldErrors.client_id}
                />
                <input type="hidden" name="client_id" value={clientId} />
              </div>
            )}
          </div>
        </div>

        {/* Bottom Pinned Action Bar */}
        <div className="rounded-2xl border border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)]/95 dark:bg-neutral-900/95 p-3 sm:p-4 md:p-5 shadow-lg flex items-center justify-between gap-2.5 sm:gap-3 sticky bottom-3 sm:bottom-4 z-20 backdrop-blur-md">
          <Button
            variant="secondary"
            href={`/machines/${machine.id}`}
            disabled={isSaving || isDeleting}
            className="w-1/2 sm:w-auto min-h-[42px] sm:min-h-[38px] justify-center"
          >
            Cancel
          </Button>

          <Button
            type="submit"
            variant="primary"
            loading={isSaving}
            disabled={isDeleting}
            className="w-1/2 sm:w-auto min-h-[42px] sm:min-h-[38px] px-4 sm:px-6 font-semibold justify-center"
          >
            Save Machine Details
          </Button>
        </div>
      </form>

      {/* Delete Confirmation Dialog */}
      <ConfirmationDialog
        isOpen={deleteConfirmOpen}
        onClose={() => setDeleteConfirmOpen(false)}
        onConfirm={handleDeleteMachine}
        title="Delete Machine"
        description={`Are you sure you want to permanently delete machine ${machine.machine_id} (${machine.model || "Unknown Model"})? This action cannot be undone and will remove related logs.`}
        confirmLabel="Delete Machine"
        cancelLabel="Keep Machine"
        variant="danger"
        loading={isDeleting}
      />
    </div>
  );
}
