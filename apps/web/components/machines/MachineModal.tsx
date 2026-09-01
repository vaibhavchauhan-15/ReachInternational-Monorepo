"use client";

import { useState, useTransition } from "react";
import { Modal, Input, Select, Button, useToast, SearchableSelect, UserSelect, ClientSelect, type ClientSelectItem } from "@/components/ui";
import { createMachine, updateMachine, checkMachineSerialNumberAvailable } from "@/app/actions/machines";
import type { Machine, User } from "@/lib/types/database";
import { isManagerOrAbove } from "@reachinternational/permissions";
import { AlertCircle } from "lucide-react";

interface MachineModalProps {
  open: boolean;
  onClose: () => void;
  machine?: Machine | null;
  supervisors?: User[];
  operators?: User[];
  clients?: ClientSelectItem[];
  userRole?: string;
  onSuccess: () => void;
}

export function MachineModal({ open, onClose, machine, supervisors = [], operators = [], clients = [], userRole, onSuccess }: MachineModalProps) {
  const { toast } = useToast();
  const [isSaving, setIsSaving] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string>("");

  const isSupervisor = userRole === "supervisor";
  const canEditSupervisor = (!userRole || isManagerOrAbove(userRole)) && !isSupervisor;
  const canEditSpecs = !isSupervisor;

  const isEdit = !!machine;

  const [supervisorId, setSupervisorId] = useState<string>(() => machine?.current_supervisor_id || "");
  const [operatorId, setOperatorId] = useState<string>(() => machine?.current_operator_id || "");
  const [rentalStatus, setRentalStatus] = useState<string>(() => machine?.status || "available");
  const [healthStatus, setHealthStatus] = useState<string>(() => machine?.health_status || "active");
  const [clientId, setClientId] = useState<string>(() => machine?.client_id || "");

  // Sync state when machine prop changes
  const [prevMachine, setPrevMachine] = useState(machine);
  if (machine !== prevMachine) {
    setPrevMachine(machine);
    setSupervisorId(machine?.current_supervisor_id || "");
    setOperatorId(machine?.current_operator_id || "");
    setRentalStatus(machine?.status || "available");
    setHealthStatus(machine?.health_status || "active");
    setClientId(machine?.client_id || "");
    setFieldErrors({});
    setFormError("");
  }

  const handleSerialBlur = async (e: React.FocusEvent<HTMLInputElement>) => {
    if (isSupervisor) return;
    const val = e.target.value.trim();
    if (!val) return;
    if (isEdit && machine?.serial_number && machine.serial_number.toLowerCase().trim() === val.toLowerCase()) {
      setFieldErrors((prev) => {
        const next = { ...prev };
        delete next.serial_number;
        return next;
      });
      return;
    }
    const check = await checkMachineSerialNumberAvailable(val, machine?.id);
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

    if (!isSupervisor) {
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
        setFormError("All 4 machine specification fields (Model, Serial Number, YUM, Manufacturer) are mandatory.");
        return;
      }
    }

    setIsSaving(true);
    try {
      let res;
      if (isEdit && machine) {
        res = await updateMachine(machine.id, {}, formData);
      } else {
        res = await createMachine({}, formData);
      }

      if (res?.error) {
        setIsSaving(false);
        setFormError(res.error);
        if (res.fieldErrors) setFieldErrors(res.fieldErrors);
        toast("error", "Failed to save machine", res.error);
      } else {
        toast(
          "success",
          isSupervisor
            ? "Machine status & assignments updated successfully"
            : isEdit
            ? "Machine updated successfully"
            : "Machine registered successfully"
        );
        setIsSaving(false);
        onSuccess();
        onClose();
      }
    } catch (err: unknown) {
      setIsSaving(false);
      const msg = err instanceof Error ? err.message : "An unexpected error occurred while saving machine details.";
      setFormError(msg);
      toast("error", "Failed to save machine", msg);
    }
  };

  // Ensure assigned current supervisor is included in options if present
  const allSupervisors: Array<{ id: string; full_name: string; phone?: string | null; email?: string | null }> = [...supervisors];
  if (machine?.current_supervisor && machine.current_supervisor_id) {
    if (!allSupervisors.some((s) => s.id === machine.current_supervisor_id)) {
      allSupervisors.push(machine.current_supervisor);
    }
  }

  // Ensure assigned current operator is included in options if present
  const allOperators: Array<{ id: string; full_name: string; phone?: string | null; email?: string | null }> = [...operators];
  if (machine?.current_operator && machine.current_operator_id) {
    if (!allOperators.some((o) => o.id === machine.current_operator_id)) {
      allOperators.push(machine.current_operator);
    }
  }

  // Ensure assigned client is included in options if present
  const allClients: ClientSelectItem[] = [...clients];
  if (machine?.client && machine.client_id) {
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

  const modalTitle = isSupervisor
    ? `Update Status (${machine?.machine_id || ""})`
    : isEdit
    ? `Edit Machine (${machine?.machine_id})`
    : "Register New Machine";

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={modalTitle}
      size="lg"
    >
      <form id="machine-form" onSubmit={handleSubmit} className="flex flex-col gap-4">
        {formError && (
          <div className="p-3.5 text-xs rounded-xl bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20 flex items-start gap-2.5 shadow-xs">
            <AlertCircle size={16} className="shrink-0 mt-0.5" />
            <div className="flex-1 leading-relaxed font-medium">{formError}</div>
          </div>
        )}

        {/* SECTION 1: Machine Identity & Specifications */}
        <div className="rounded-xl border border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)] p-4 flex flex-col gap-3.5">
          <div className="pb-2 border-b border-[var(--color-hairline)] flex items-center justify-between gap-2">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-[var(--color-ink)]">
              MACHINE INFO
            </h4>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <Input
              label={`Model ${canEditSpecs ? "*" : ""}`}
              name="model"
              placeholder="e.g. CAT-320 / JCB-430 / S3246"
              defaultValue={machine?.model || ""}
              error={fieldErrors.model}
              required={canEditSpecs}
              disabled={!canEditSpecs || isSaving}
            />

            <Input
              label={`Serial Number ${canEditSpecs ? "*" : ""}`}
              name="serial_number"
              placeholder="e.g. SN-98745612"
              defaultValue={machine?.serial_number || ""}
              error={fieldErrors.serial_number}
              onBlur={handleSerialBlur}
              required={canEditSpecs}
              disabled={!canEditSpecs || isSaving}
            />

            <Input
              label={`Year of Manufacture (YUM) ${canEditSpecs ? "*" : ""}`}
              name="year_of_mfg"
              placeholder="e.g. 2024 / 2025"
              defaultValue={machine?.year_of_mfg || ""}
              error={fieldErrors.year_of_mfg}
              required={canEditSpecs}
              disabled={!canEditSpecs || isSaving}
            />

            <Input
              label={`Manufacturer ${canEditSpecs ? "*" : ""}`}
              name="manufacturer"
              placeholder="e.g. Toyota / Linde / Komatsu / CAT"
              defaultValue={machine?.manufacturer || ""}
              error={fieldErrors.manufacturer}
              required={canEditSpecs}
              disabled={!canEditSpecs || isSaving}
            />
          </div>
        </div>

        {/* SECTION 2: Metering & Fleet Assignment */}
        <div className="rounded-xl border border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)] p-4 flex flex-col gap-3.5">
          <div className="pb-2 border-b border-[var(--color-hairline)]">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-[var(--color-ink)]">
              Meter Readings & Personnel Assignment
            </h4>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <Input
              label="Hour Meter Reading (HMR)"
              name="hour_meter"
              type="number"
              step="0.1"
              min="0"
              placeholder="e.g. 1250.5"
              defaultValue={machine?.hour_meter ?? 0}
              error={fieldErrors.hour_meter}
              disabled={isSaving}
            />

            <div>
              <UserSelect
                label="Current Supervisor"
                users={allSupervisors}
                value={supervisorId}
                onChange={setSupervisorId}
                placeholder="Select Supervisor"
                clearable={canEditSupervisor}
                disabled={!canEditSupervisor || isSaving}
              />
              <input type="hidden" name="current_supervisor_id" value={supervisorId} />
            </div>

            <div>
              <UserSelect
                label="Current Operator"
                users={allOperators}
                value={operatorId}
                onChange={setOperatorId}
                placeholder="Search or assign active operator..."
                clearable
                disabled={isSaving}
              />
              <input type="hidden" name="current_operator_id" value={operatorId} />
            </div>
          </div>
        </div>

        {/* SECTION 3: Status & Health */}
        <div className="rounded-xl border border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)] p-4 flex flex-col gap-3.5">
          <div className="pb-2 border-b border-[var(--color-hairline)]">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-[var(--color-ink)]">
              Status & Health Tracking
            </h4>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <Select
              label="Health Status"
              name="health_status"
              options={healthStatusOptions}
              value={healthStatus}
              onChange={(val) => {
                const nextVal = typeof val === "string" ? val : val?.target?.value || "active";
                setHealthStatus(nextVal);
              }}
              disabled={isSaving}
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
              disabled={isSaving}
            />

            {rentalStatus === "rented" && (
              <div className="sm:col-span-2 pt-0.5 animate-in fade-in slide-in-from-top-2 duration-200">
                <ClientSelect
                  label="Assigned Client"
                  clients={allClients}
                  value={clientId}
                  onChange={(selectedId) => setClientId(selectedId)}
                  placeholder="Search and select client renting this machine..."
                  clearable
                  disabled={isSaving}
                  error={fieldErrors.client_id}
                />
                <input type="hidden" name="client_id" value={clientId} />
              </div>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2.5 sm:gap-3 pt-2">
          <Button
            type="button"
            variant="secondary"
            onClick={onClose}
            disabled={isSaving}
            className="h-10 sm:h-9 text-xs sm:text-sm font-semibold justify-center"
          >
            Cancel
          </Button>
          <Button
            type="submit"
            variant="primary"
            loading={isSaving}
            className="h-10 sm:h-9 text-xs sm:text-sm font-semibold justify-center"
          >
            {isSupervisor ? "Save Updates" : isEdit ? "Update Machine" : "Register Machine"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
