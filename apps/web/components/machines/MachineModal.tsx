"use client";

import { useState, useTransition } from "react";
import { Modal, Input, Select, Button, useToast, SearchableSelect } from "@/components/ui";
import { createMachine, updateMachine } from "@/app/actions/machines";
import type { Machine, User } from "@/lib/types/database";
import { AnimatedWrench, AnimatedCpu, AnimatedShieldCheck } from "@/components/ui/animated-icons";
import { AlertCircle } from "lucide-react";

interface MachineModalProps {
  open: boolean;
  onClose: () => void;
  machine?: Machine | null;
  supervisors?: User[];
  operators?: User[];
  userRole?: string;
  onSuccess: () => void;
}

export function MachineModal({ open, onClose, machine, supervisors = [], operators = [], userRole, onSuccess }: MachineModalProps) {
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string>("");

  const isEdit = !!machine;

  const [supervisorId, setSupervisorId] = useState<string>(() => machine?.current_supervisor_id || "");
  const [operatorId, setOperatorId] = useState<string>(() => machine?.current_operator_id || "");

  // Sync state when machine prop changes
  const [prevMachine, setPrevMachine] = useState(machine);
  if (machine !== prevMachine) {
    setPrevMachine(machine);
    setSupervisorId(machine?.current_supervisor_id || "");
    setOperatorId(machine?.current_operator_id || "");
  }

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
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
      setFormError("All 4 machine specification fields (Model, Serial Number, YUM, Manufacturer) are mandatory.");
      return;
    }

    startTransition(async () => {
      let res;
      if (isEdit && machine) {
        res = await updateMachine(machine.id, {}, formData);
      } else {
        res = await createMachine({}, formData);
      }

      if (res?.error) {
        setFormError(res.error);
        if (res.fieldErrors) setFieldErrors(res.fieldErrors);
        toast("error", "Failed to save machine", res.error);
      } else {
        toast("success", isEdit ? "Machine updated" : "Machine registered successfully");
        onSuccess();
        onClose();
      }
    });
  };

  // Ensure assigned current supervisor is included in options if present
  const allSupervisors: Array<{ id: string; full_name: string; phone?: string | null; email?: string | null }> = [...supervisors];
  if (machine?.current_supervisor && machine.current_supervisor_id) {
    if (!allSupervisors.some((s) => s.id === machine.current_supervisor_id)) {
      allSupervisors.push(machine.current_supervisor);
    }
  }

  const supervisorOptions = [
    { value: "", label: "-- Unassigned Supervisor --", description: "No supervisor assigned" },
    ...allSupervisors.map((s) => ({
      value: s.id,
      label: s.full_name,
      description: s.phone ? `+91 ${s.phone.replace(/^\+91/, "")}` : s.email || undefined,
    })),
  ];

  // Ensure assigned current operator is included in options if present
  const allOperators: Array<{ id: string; full_name: string; phone?: string | null; email?: string | null }> = [...operators];
  if (machine?.current_operator && machine.current_operator_id) {
    if (!allOperators.some((o) => o.id === machine.current_operator_id)) {
      allOperators.push(machine.current_operator);
    }
  }

  const operatorOptions = [
    { value: "", label: "-- Unassigned Operator --", description: "No operator assigned" },
    ...allOperators.map((o) => ({
      value: o.id,
      label: o.full_name,
      description: o.phone ? `+91 ${o.phone.replace(/^\+91/, "")}` : o.email || undefined,
    })),
  ];

  const healthStatusOptions = [
    { value: "active", label: "Active" },
    { value: "under_maintenance", label: "Under Maintenance" },
    { value: "breakdown", label: "Breakdown" },
  ];

  const statusOptions = [
    { value: "available", label: "Available" },
    { value: "rented", label: "Rented" },
  ];

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isEdit ? `Edit Machine (${machine.machine_id})` : "Register New Machine"}
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
          <div className="flex items-center gap-2 pb-2 border-b border-[var(--color-hairline)]">
            <AnimatedWrench size={16} className="text-[var(--color-link)]" />
            <h4 className="text-xs font-semibold uppercase tracking-wider text-[var(--color-ink)]">
              Machine Identification & Specifications
            </h4>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <Input
              label="Model *"
              name="model"
              placeholder="e.g. CAT-320 / JCB-430 / S3246"
              defaultValue={machine?.model || ""}
              error={fieldErrors.model}
              required
              disabled={isPending}
            />

            <Input
              label="Serial Number *"
              name="serial_number"
              placeholder="e.g. SN-98745612"
              defaultValue={machine?.serial_number || ""}
              error={fieldErrors.serial_number}
              required
              disabled={isPending}
            />

            <Input
              label="Year of Manufacture (YUM) *"
              name="year_of_mfg"
              placeholder="e.g. 2024 / 2025"
              defaultValue={machine?.year_of_mfg || ""}
              error={fieldErrors.year_of_mfg}
              required
              disabled={isPending}
            />

            <Input
              label="Manufacturer *"
              name="manufacturer"
              placeholder="e.g. Toyota / Linde / Komatsu / CAT"
              defaultValue={machine?.manufacturer || ""}
              error={fieldErrors.manufacturer}
              required
              disabled={isPending}
            />
          </div>
        </div>

        {/* SECTION 2: Metering & Fleet Assignment */}
        <div className="rounded-xl border border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)] p-4 flex flex-col gap-3.5">
          <div className="flex items-center gap-2 pb-2 border-b border-[var(--color-hairline)]">
            <AnimatedCpu size={16} className="text-[var(--color-link)]" />
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
              disabled={isPending}
            />

            <Input
              label="Service Count"
              name="service_count"
              type="number"
              min="0"
              placeholder="e.g. 3"
              defaultValue={machine?.service_count ?? 0}
              error={fieldErrors.service_count}
              disabled={isPending}
            />

            <div>
              <SearchableSelect
                label="Current Supervisor"
                options={supervisorOptions}
                value={supervisorId}
                onChange={setSupervisorId}
                placeholder="Select Supervisor"
              />
              <input type="hidden" name="current_supervisor_id" value={supervisorId} />
            </div>

            <div>
              <SearchableSelect
                label="Current Operator"
                options={operatorOptions}
                value={operatorId}
                onChange={setOperatorId}
                placeholder="Select Operator"
              />
              <input type="hidden" name="current_operator_id" value={operatorId} />
            </div>
          </div>
        </div>

        {/* SECTION 3: Status & Health */}
        <div className="rounded-xl border border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)] p-4 flex flex-col gap-3.5">
          <div className="flex items-center gap-2 pb-2 border-b border-[var(--color-hairline)]">
            <AnimatedShieldCheck size={16} className="text-[var(--color-link)]" />
            <h4 className="text-xs font-semibold uppercase tracking-wider text-[var(--color-ink)]">
              Status & Health Tracking
            </h4>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <Select
              label="Health Status"
              name="health_status"
              options={healthStatusOptions}
              defaultValue={machine?.health_status || "active"}
              disabled={isPending}
            />

            <Select
              label="Rental Status"
              name="status"
              options={statusOptions}
              defaultValue={machine?.status || "available"}
              disabled={isPending}
            />
          </div>
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-3 pt-2">
          <Button type="button" variant="secondary" onClick={onClose} disabled={isPending}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" loading={isPending}>
            {isEdit ? "Update Machine" : "Register Machine"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
