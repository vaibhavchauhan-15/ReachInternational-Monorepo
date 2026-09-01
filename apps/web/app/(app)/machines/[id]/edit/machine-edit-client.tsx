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
  ConfirmationDialog,
  Breadcrumb,
} from "@/components/ui";
import {
  AnimatedWrench,
  AnimatedCpu,
  AnimatedShieldCheck,
  AnimatedTrash,
  AnimatedArrowLeft,
  AnimatedCheck,
} from "@/components/ui/animated-icons";
import { AlertCircle } from "lucide-react";
import { updateMachine, deleteMachine } from "@/app/actions/machines";
import type { Machine, User, UserRole } from "@/lib/types/database";

interface MachineEditClientProps {
  machine: Machine;
  supervisors?: User[];
  operators?: User[];
  userRole: UserRole;
  canDelete: boolean;
}

export function MachineEditClient({
  machine,
  supervisors = [],
  operators = [],
  userRole,
  canDelete,
}: MachineEditClientProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();
  const [isDeleting, startDeleteTransition] = useTransition();
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string>("");

  const [supervisorId, setSupervisorId] = useState<string>(() => machine.current_supervisor_id || "");
  const [operatorId, setOperatorId] = useState<string>(() => machine.current_operator_id || "");

  // Ensure assigned supervisor/operator are in the options list if present
  const allSupervisors: Array<{ id: string; full_name: string; phone?: string | null; email?: string | null }> = [...supervisors];
  if (machine.current_supervisor && machine.current_supervisor_id) {
    if (!allSupervisors.some((s) => s.id === machine.current_supervisor_id)) {
      allSupervisors.push(machine.current_supervisor);
    }
  }

  const allOperators: Array<{ id: string; full_name: string; phone?: string | null; email?: string | null }> = [...operators];
  if (machine.current_operator && machine.current_operator_id) {
    if (!allOperators.some((o) => o.id === machine.current_operator_id)) {
      allOperators.push(machine.current_operator);
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
      setFormError("Please complete all 4 mandatory machine specification fields (Model, Serial Number, YUM, Manufacturer).");
      return;
    }

    startTransition(async () => {
      const res = await updateMachine(machine.id, {}, formData);
      if (res?.error) {
        setFormError(res.error);
        if (res.fieldErrors) setFieldErrors(res.fieldErrors);
        toast("error", "Failed to update machine", res.error);
      } else {
        toast("success", "Machine updated successfully", `Parameters for ${machine.machine_id} have been updated.`);
        router.push(`/machines/${machine.id}`);
        router.refresh();
      }
    });
  };

  const handleDeleteMachine = () => {
    startDeleteTransition(async () => {
      const res = await deleteMachine(machine.id);
      if (res?.error) {
        toast("error", "Failed to delete machine", res.error);
        setDeleteConfirmOpen(false);
      } else {
        toast("success", "Machine deleted", `${machine.machine_id} has been permanently deleted.`);
        router.push("/machines");
        router.refresh();
      }
    });
  };

  return (
    <div className="w-full max-w-5xl mx-auto space-y-5 px-3 sm:px-6 py-4 sm:py-6">
      {/* Top Breadcrumb & Back Action */}
      <div className="flex items-center justify-between gap-3">
        <Breadcrumb
          items={[
            { label: "Machines", href: "/machines" },
            { label: machine.machine_id, href: `/machines/${machine.id}` },
            { label: "Edit Machine" },
          ]}
        />
        <Button
          variant="secondary"
          size="sm"
          icon={<AnimatedArrowLeft size={14} />}
          href={`/machines/${machine.id}`}
        >
          Back to Details
        </Button>
      </div>

      {/* Hero Header Card */}
      <div className="rounded-2xl border border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)] p-4 sm:p-6 shadow-xs relative overflow-hidden">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-[var(--color-ink)]">
                Edit Machine: <span className="font-mono text-sky-600 dark:text-sky-400">{machine.machine_id}</span>
              </h1>
            </div>
            <p className="text-xs sm:text-sm text-[var(--color-mute)] mt-1">
              Update fleet master specifications, running hour meter, and operational personnel assignments.
            </p>
          </div>

          {canDelete && (
            <div className="shrink-0">
              <Button
                variant="destructive"
                size="sm"
                icon={<AnimatedTrash size={14} />}
                onClick={() => setDeleteConfirmOpen(true)}
                disabled={isPending || isDeleting}
              >
                Delete Machine
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Main Edit Form */}
      <form onSubmit={handleSubmit} className="space-y-5">
        {formError && (
          <div className="p-4 text-xs sm:text-sm rounded-xl bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20 flex items-start gap-3 shadow-xs">
            <AlertCircle size={18} className="shrink-0 mt-0.5" />
            <div className="flex-1 leading-relaxed font-medium">{formError}</div>
          </div>
        )}

        {/* SECTION 1: Machine Identification & Specifications */}
        <div className="rounded-2xl border border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)] p-4 sm:p-6 shadow-xs space-y-4">
          <div className="flex items-center gap-2 pb-3 border-b border-[var(--color-hairline)]">
            <AnimatedWrench size={18} className="text-[var(--color-link)]" />
            <h3 className="text-sm font-semibold uppercase tracking-wider text-[var(--color-ink)]">
              1. Machine Identification & Specifications
            </h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
              disabled={isPending || isDeleting}
            />

            <Input
              label="Serial Number *"
              name="serial_number"
              placeholder="e.g. SN-98745612"
              defaultValue={machine.serial_number || ""}
              error={fieldErrors.serial_number}
              required
              disabled={isPending || isDeleting}
            />

            <Input
              label="Year of Manufacture (YUM) *"
              name="year_of_mfg"
              placeholder="e.g. 2024 / 2025"
              defaultValue={machine.year_of_mfg || ""}
              error={fieldErrors.year_of_mfg}
              required
              disabled={isPending || isDeleting}
            />

            <div className="sm:col-span-2">
              <Input
                label="Manufacturer *"
                name="manufacturer"
                placeholder="e.g. Toyota / Linde / Komatsu / Caterpillar / JLG"
                defaultValue={machine.manufacturer || ""}
                error={fieldErrors.manufacturer}
                required
                disabled={isPending || isDeleting}
              />
            </div>
          </div>
        </div>

        {/* SECTION 2: Metering & Fleet Assignment */}
        <div className="rounded-2xl border border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)] p-4 sm:p-6 shadow-xs space-y-4">
          <div className="flex items-center gap-2 pb-3 border-b border-[var(--color-hairline)]">
            <AnimatedCpu size={18} className="text-[var(--color-link)]" />
            <h3 className="text-sm font-semibold uppercase tracking-wider text-[var(--color-ink)]">
              2. Meter Readings & Personnel Assignment
            </h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Hour Meter Reading (HMR)"
              name="hour_meter"
              type="number"
              step="0.1"
              min="0"
              placeholder="e.g. 1250.5"
              defaultValue={machine.hour_meter ?? 0}
              error={fieldErrors.hour_meter}
              disabled={isPending || isDeleting}
            />

            <Input
              label="Service Count"
              name="service_count"
              type="number"
              min="0"
              placeholder="e.g. 3"
              defaultValue={machine.service_count ?? 0}
              error={fieldErrors.service_count}
              disabled={isPending || isDeleting}
            />

            <div>
              <UserSelect
                label="Current Supervisor"
                users={allSupervisors}
                value={supervisorId}
                onChange={setSupervisorId}
                placeholder="Select Supervisor"
                clearable
              />
              <input type="hidden" name="current_supervisor_id" value={supervisorId} />
            </div>

            <div>
              <UserSelect
                label="Current Operator"
                users={allOperators}
                value={operatorId}
                onChange={setOperatorId}
                placeholder="Select Operator"
                clearable
              />
              <input type="hidden" name="current_operator_id" value={operatorId} />
            </div>
          </div>
        </div>

        {/* SECTION 3: Status & Health Tracking */}
        <div className="rounded-2xl border border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)] p-4 sm:p-6 shadow-xs space-y-4">
          <div className="flex items-center gap-2 pb-3 border-b border-[var(--color-hairline)]">
            <AnimatedShieldCheck size={18} className="text-[var(--color-link)]" />
            <h3 className="text-sm font-semibold uppercase tracking-wider text-[var(--color-ink)]">
              3. Status & Health Tracking
            </h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Select
              label="Health Status"
              name="health_status"
              options={healthStatusOptions}
              defaultValue={machine.health_status || "active"}
              disabled={isPending || isDeleting}
            />

            <Select
              label="Rental Status"
              name="status"
              options={statusOptions}
              defaultValue={machine.status || "available"}
              disabled={isPending || isDeleting}
            />
          </div>
        </div>

        {/* Bottom Pinned Action Bar */}
        <div className="rounded-2xl border border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)] p-4 sm:p-5 shadow-xs flex flex-col-reverse sm:flex-row items-center justify-between gap-3 sticky bottom-4 z-20 backdrop-blur-md">
          <Button
            variant="secondary"
            href={`/machines/${machine.id}`}
            disabled={isPending || isDeleting}
            className="w-full sm:w-auto"
          >
            Cancel
          </Button>

          <div className="flex items-center gap-3 w-full sm:w-auto">
            <Button
              type="submit"
              variant="primary"
              loading={isPending}
              disabled={isDeleting}
              icon={<AnimatedCheck size={16} />}
              className="w-full sm:w-auto px-6 font-semibold"
            >
              Save Machine Details
            </Button>
          </div>
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
