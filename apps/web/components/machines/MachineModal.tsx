"use client";

import { useState, useTransition } from "react";
import { Modal, Input, Select, Textarea, Button, useToast, SearchableSelect } from "@/components/ui";
import { createMachine, updateMachine } from "@/app/actions/machines";
import type { MachineWithEngineer, User } from "@/lib/types/database";
import { AnimatedSparkles, AnimatedShieldCheck, AnimatedCpu, AnimatedBuilding2, AnimatedWrench } from "@/components/ui/animated-icons";

interface MachineModalProps {
  open: boolean;
  onClose: () => void;
  machine?: MachineWithEngineer | null;
  engineers: User[];
  userRole?: string;
  onSuccess: () => void;
}

function generateUniqueCode(): string {
  const num = Math.floor(100 + Math.random() * 900);
  return `S${num}`;
}

export function MachineModal({ open, onClose, machine, engineers, userRole, onSuccess }: MachineModalProps) {
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string>("");

  const isEdit = !!machine;
  const isRestrictedRole = userRole === "service_manager" || userRole === "supervisor" || userRole === "mechanic" || userRole === "service_engineer" || userRole === "engineer" || userRole === "operator" || userRole === "store_manager" || userRole === "rental_manager";
  const isMasterSpecDisabled = isPending || (isEdit && isRestrictedRole);

  const [machineCode, setMachineCode] = useState<string>(() => {
    if (machine?.machine_code) return machine.machine_code;
    return generateUniqueCode();
  });

  const [mobile, setMobile] = useState<string>(() => {
    if (!machine?.customer_mobile) return "";
    return machine.customer_mobile.replace(/^\+91/, "");
  });

  const [engineerId, setEngineerId] = useState<string>(() => machine?.engineer_id || "");

  // Sync state when the `machine` prop changes
  const [prevMachine, setPrevMachine] = useState(machine);
  if (machine !== prevMachine) {
    setPrevMachine(machine);
    setMachineCode(machine?.machine_code || generateUniqueCode());
    setMobile(machine?.customer_mobile ? machine.customer_mobile.replace(/^\+91/, "") : "");
    setEngineerId(machine?.engineer_id || "");
  }

  const handleRegenerateCode = () => {
    setMachineCode(generateUniqueCode());
  };

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setFieldErrors({});
    setFormError("");

    const formData = new FormData(e.currentTarget);

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
        toast("success", isEdit ? "Machine updated" : "Machine created successfully");
        onSuccess();
        onClose();
      }
    });
  };

  const engineerOptions = [
    { value: "", label: "-- Unassigned --", description: "No engineer assigned" },
    ...engineers.map((e) => ({
      value: e.id,
      label: e.full_name,
      description: e.phone ? `+91 ${e.phone.replace(/^\+91/, "")}` : e.email || undefined,
    })),
  ];

  const statusOptions = [
    { value: "on_rent", label: "On Rent" },
    { value: "active", label: "Active" },
    { value: "under_maintenance", label: "Under Maintenance" },
    { value: "inactive", label: "Inactive" },
  ];

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isEdit ? `Edit Machine (${machine.machine_code})` : "Register New Machine"}
      size="xl"
    >
      <form id="machine-form" onSubmit={handleSubmit} className="flex flex-col gap-5 max-h-[80vh] overflow-y-auto pr-1">
        {formError && (
          <div className="p-3 text-xs rounded-[var(--radius-sm)] bg-[rgba(238,0,0,0.1)] text-[var(--color-error-deep)] border border-[var(--color-error)]">
            {formError}
          </div>
        )}

        {/* SECTION 1: Equipment Specs */}
        <div className="rounded-xl border border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)] p-4 flex flex-col gap-3.5">
          <div className="flex items-center gap-2 pb-2 border-b border-[var(--color-hairline)]">
            <AnimatedWrench size={16} className="text-[var(--color-link)]" />
            <h4 className="text-xs font-semibold uppercase tracking-wider text-[var(--color-ink)]">
              Equipment Details & Specs
            </h4>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
            {/* Machine Category */}
            <div className="flex flex-col gap-1.5 w-full">
              <label htmlFor="category_name" className="label-sm font-medium text-[var(--color-ink)] select-none flex items-center justify-between">
                <span>Machine Category</span>
                <span className="text-[10px] text-[var(--color-mute)]">Required</span>
              </label>
              <select
                id="category_name"
                name="category_name"
                defaultValue={machine?.category_name || "Forklift"}
                disabled={isPending}
                className="input-base w-full bg-[var(--color-canvas)] text-xs font-semibold text-[var(--color-ink)]"
              >
                <option value="Forklift">Forklift</option>
                <option value="Scissor Lift">Scissor Lift</option>
                <option value="Boom Lift">Boom Lift</option>
                <option value="Reach Truck">Reach Truck</option>
                <option value="Pallet Truck">Pallet Truck</option>
                <option value="Generators">Generators</option>
              </select>
            </div>

            {/* Machine No (Code) */}
            <div className="flex flex-col gap-1.5 w-full">
              <label htmlFor="machine_code" className="label-sm font-medium text-[var(--color-ink)] select-none flex items-center justify-between">
                <span>Machine No</span>
                <span className="text-[10px] text-[var(--color-mute)] font-normal">Auto Unique</span>
              </label>
              <div className="flex gap-2">
                <Input
                  id="machine_code"
                  name="machine_code"
                  placeholder="e.g. S374"
                  value={machineCode}
                  onChange={(e) => setMachineCode(e.target.value.toUpperCase())}
                  error={fieldErrors.machine_code}
                  required
                  disabled={isPending}
                  className="uppercase font-mono tracking-wider font-bold"
                />
                <Button
                  type="button"
                  variant="secondary"
                  onClick={handleRegenerateCode}
                  title="Auto-generate unique code"
                  disabled={isPending}
                  className="flex-shrink-0 whitespace-nowrap text-xs h-9 px-2.5"
                >
                  <AnimatedSparkles size={14} className="mr-1 text-amber-500" /> Auto
                </Button>
              </div>
            </div>

            {/* Machine Model */}
            <Input
              name="model"
              label="Machine Model"
              placeholder="e.g. S3246EE"
              defaultValue={machine?.model || ""}
              disabled={isPending}
            />

            {/* Machine Sr No */}
            <Input
              name="serial_number"
              label="Machine Sr No"
              placeholder="e.g. 3605417"
              defaultValue={machine?.serial_number || ""}
              disabled={isPending}
            />

            {/* Machine Hours */}
            <Input
              name="hour_meter"
              type="number"
              step="0.1"
              label="Machine Hours (Meter)"
              placeholder="e.g. 0 or 2337"
              defaultValue={machine?.hour_meter?.toString() || "0"}
              disabled={isPending}
            />

            {/* Manufacturer */}
            <Input
              name="manufacturer"
              label="Manufacturer"
              placeholder="e.g. JCB"
              defaultValue={machine?.manufacturer || ""}
              disabled={isPending}
            />

            {/* Year Of Mfg */}
            <Input
              name="year_of_mfg"
              label="Year Of Mfg"
              placeholder="e.g. 2026"
              defaultValue={machine?.year_of_mfg || "2026"}
              disabled={isPending}
            />

            {/* Machine Name */}
            <Input
              name="machine_name"
              label="Machine Description / Title"
              placeholder="e.g. Electric Scissor Lift S3246EE"
              defaultValue={machine?.machine_name || ""}
              error={fieldErrors.machine_name}
              required
              disabled={isPending}
            />
          </div>
        </div>

        {/* SECTION 2: Engine & Motor Specs */}
        <div className="rounded-xl border border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)] p-4 flex flex-col gap-3.5">
          <div className="flex items-center gap-2 pb-2 border-b border-[var(--color-hairline)]">
            <AnimatedCpu size={16} className="text-[var(--color-link)]" />
            <h4 className="text-xs font-semibold uppercase tracking-wider text-[var(--color-ink)]">
              Engine & Motor Specifications
            </h4>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Engine Serial No */}
            <Input
              name="engine_serial_no"
              label="Engine Serial No"
              placeholder="e.g. Electric or ENG-1029"
              defaultValue={machine?.engine_serial_no || "Electric"}
              disabled={isPending}
            />

            {/* Engine Mot No */}
            <Input
              name="engine_mot_no"
              label="Engine Mot No"
              placeholder="e.g. Electric or MOT-5521"
              defaultValue={machine?.engine_mot_no || "Electric"}
              disabled={isPending}
            />
          </div>
        </div>

        {/* SECTION 3: Compliance & Document Dates */}
        <div className="rounded-xl border border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)] p-4 flex flex-col gap-3.5">
          <div className="flex items-center gap-2 pb-2 border-b border-[var(--color-hairline)]">
            <AnimatedShieldCheck size={16} className="text-[var(--color-link)]" />
            <h4 className="text-xs font-semibold uppercase tracking-wider text-[var(--color-ink)]">
              Compliance & Insurance Certificates
            </h4>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
            {/* Insurance Policy */}
            <Input
              name="insurance_policy_no"
              label="Insurance Policy / Ref"
              placeholder="e.g. INS-887123"
              defaultValue={machine?.insurance_policy_no || ""}
              disabled={isPending}
            />

            {/* Insurance Expiry Date */}
            <Input
              name="insurance_expiry_date"
              type="date"
              label="Insurance Expiry Date"
              defaultValue={machine?.insurance_expiry_date || ""}
              disabled={isPending}
            />

            {/* 3rd Party Certificate */}
            <Input
              name="third_party_certificate"
              label="3rd Party Certificate"
              placeholder="e.g. 3PC-99120"
              defaultValue={machine?.third_party_certificate || ""}
              disabled={isPending}
            />

            {/* 3rd Party Expiry Date */}
            <Input
              name="third_party_expiry_date"
              type="date"
              label="3rd Party Expiry Date"
              defaultValue={machine?.third_party_expiry_date || ""}
              disabled={isPending}
            />

            {/* RTO Tax */}
            <Input
              name="rto_tax"
              label="RTO Tax / Receipt No"
              placeholder="e.g. RTO-TAX-2026"
              defaultValue={machine?.rto_tax || ""}
              disabled={isPending}
            />

            {/* RTO Tax Expiry Date */}
            <Input
              name="rto_tax_expiry_date"
              type="date"
              label="RTO Tax Expiry Date"
              defaultValue={machine?.rto_tax_expiry_date || ""}
              disabled={isPending}
            />
          </div>
        </div>

        {/* SECTION 4: Client & Location Info */}
        <div className="rounded-xl border border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)] p-4 flex flex-col gap-3.5">
          <div className="flex items-center gap-2 pb-2 border-b border-[var(--color-hairline)]">
            <AnimatedBuilding2 size={16} className="text-[var(--color-link)]" />
            <h4 className="text-xs font-semibold uppercase tracking-wider text-[var(--color-ink)]">
              Customer & Site Location
            </h4>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Customer Name */}
            <Input
              name="customer_name"
              label="Customer / Client Company"
              placeholder="e.g. Apex Infrastructure Pvt Ltd"
              defaultValue={machine?.customer_name || ""}
              error={fieldErrors.customer_name}
              required
              disabled={isPending}
            />

            {/* Customer Mobile */}
            <div className="flex flex-col gap-1.5 w-full">
              <label htmlFor="customer_mobile" className="label-sm font-medium text-[var(--color-ink)] select-none">
                Customer Mobile (+91)
              </label>
              <div className="relative flex items-center">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 flex items-center gap-1 px-1.5 py-0.5 rounded bg-[var(--color-hairline-soft-surface)] text-xs font-bold text-[var(--color-ink)] border border-[var(--color-hairline)] select-none pointer-events-none">
                  +91
                </span>
                <input
                  id="customer_mobile"
                  name="customer_mobile"
                  type="tel"
                  placeholder="9876543210"
                  value={mobile}
                  onChange={(e) => setMobile(e.target.value.replace(/\D/g, "").slice(0, 10))}
                  className={`input-base w-full !pl-14 ${
                    fieldErrors.customer_mobile
                      ? "!border-[var(--color-error)] focus:!border-[var(--color-error)]"
                      : ""
                  }`}
                  disabled={isPending}
                  required
                />
              </div>
              {fieldErrors.customer_mobile && (
                <p className="body-sm text-[var(--color-error)]">{fieldErrors.customer_mobile}</p>
              )}
            </div>

            {/* Customer Email */}
            <Input
              name="customer_email"
              type="email"
              label="Customer Email"
              placeholder="e.g. contact@client.com"
              defaultValue={machine?.customer_email || ""}
              error={fieldErrors.customer_email}
              disabled={isPending}
            />

            {/* City */}
            <Input
              name="city"
              label="City"
              placeholder="e.g. Mumbai"
              defaultValue={machine?.city || ""}
              error={fieldErrors.city}
              required
              disabled={isPending}
            />

            {/* State */}
            <Input
              name="state"
              label="State"
              placeholder="e.g. Maharashtra"
              defaultValue={machine?.state || ""}
              error={fieldErrors.state}
              required
              disabled={isPending}
            />

            {/* Customer Address */}
            <Input
              name="customer_address"
              label="Site Address"
              placeholder="e.g. Plot 42, MIDC Industrial Area"
              defaultValue={machine?.customer_address || ""}
              disabled={isPending}
            />
          </div>
        </div>

        {/* SECTION 5: Assignment, Interval & Status */}
        <div className="rounded-xl border border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)] p-4 flex flex-col gap-3.5">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {/* Assigned Field Engineer */}
            <div className="flex flex-col gap-1.5 w-full">
              <SearchableSelect
                label="Assigned Engineer"
                options={engineerOptions}
                value={engineerId}
                onChange={setEngineerId}
                placeholder="-- Select Engineer --"
                disabled={isPending}
                clearable
              />
              <input type="hidden" name="engineer_id" value={engineerId} />
            </div>

            {/* Service Interval (Days) */}
            <Input
              name="service_interval_days"
              type="number"
              label="Service Interval (Days)"
              placeholder="90"
              defaultValue={machine?.service_interval_days?.toString() || "90"}
              required
              disabled={isPending}
            />

            {/* Status */}
            <Select
              name="status"
              label="Machine Status"
              options={statusOptions}
              defaultValue={machine?.status || "on_rent"}
              disabled={isPending}
            />
          </div>

          {/* Notes */}
          <Textarea
            name="notes"
            label="Notes / Instructions"
            placeholder="Enter special maintenance instructions or remarks..."
            defaultValue={machine?.notes || ""}
            rows={2}
            disabled={isPending}
          />
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-end gap-3 pt-3 border-t border-[var(--color-hairline)] mt-1 sticky bottom-0 bg-[var(--color-canvas-elevated)] py-2">
          <Button type="button" variant="secondary" onClick={onClose} disabled={isPending}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" loading={isPending} className="px-6 shadow-sm">
            {isEdit ? "Save Changes" : "Create Machine"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
