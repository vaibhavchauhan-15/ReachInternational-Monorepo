"use client";

import { useState, useTransition } from "react";
import { Modal, Input, Select, Textarea, Button, useToast, SearchableSelect } from "@/components/ui";
import { createComplaint, updateComplaint } from "@/app/actions/complaints";
import type { ComplaintWithDetails, MachineWithEngineer, User } from "@/lib/types/database";
import {
  AnimatedAlertTriangle,
  AnimatedWrench,
  AnimatedMapPin,
  AnimatedCalendarClock,
  AnimatedUserCheck,
} from "@/components/ui/animated-icons";


interface MachineComplaintModalProps {
  open: boolean;
  onClose: () => void;
  complaint?: ComplaintWithDetails | null;
  machines: MachineWithEngineer[];
  engineers: User[];
  onSuccess?: () => void;
}

export function MachineComplaintModal({
  open,
  onClose,
  complaint,
  machines,
  engineers,
  onSuccess,
}: MachineComplaintModalProps) {
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();
  const isEdit = !!complaint;

  const [selectedMachineId, setSelectedMachineId] = useState<string>(
    complaint?.machine_id || (machines[0]?.id || "")
  );

  const selectedMachine = machines.find((m) => m.id === selectedMachineId);

  const [selectedEngineerId, setSelectedEngineerId] = useState<string>(
    complaint?.engineer_id || selectedMachine?.engineer_id || ""
  );

  const machineOptions = machines.map((m) => ({
    value: m.id,
    label: `${m.machine_code} - ${m.machine_name}`,
    description: `Model: ${m.model || "N/A"} | Sr: ${m.serial_number || "N/A"} | ${m.city}`,
  }));

  const engineerOptions = [
    { value: "", label: "-- Select Service Engineer --" },
    ...engineers.map((e) => ({
      value: e.id,
      label: e.full_name,
      description: e.phone ? `+91 ${e.phone.replace(/^\+91/, "")}` : e.email || undefined,
    })),
  ];

  const statusOptions = [
    { value: "open", label: "Open (Malfunction Raised)" },
    { value: "in_progress", label: "In Progress (Engineer On Site)" },
    { value: "pending_parts", label: "Pending Spare Parts" },
    { value: "resolved", label: "Resolved" },
    { value: "closed", label: "Closed with FSR" },
  ];

  const handleMachineChange = (machId: string) => {
    setSelectedMachineId(machId);
    const mach = machines.find((m) => m.id === machId);
    if (mach?.engineer_id) {
      setSelectedEngineerId(mach.engineer_id);
    }
  };

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    formData.append("machine_id", selectedMachineId);
    if (selectedEngineerId) formData.append("engineer_id", selectedEngineerId);

    startTransition(async () => {
      let res;
      if (isEdit && complaint) {
        res = await updateComplaint(complaint.id, null, formData);
      } else {
        res = await createComplaint(null, formData);
      }

      if (res?.error) {
        toast("error", "Failed to save complaint", res.error);
      } else {
        toast("success", isEdit ? "Complaint updated" : "Machine complaint raised successfully!");
        if (onSuccess) onSuccess();
        onClose();
      }
    });
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isEdit ? `Edit Machine Complaint (${complaint.complaint_no})` : "Raise Machine Complaint"}
      headerActions={
        <div className="flex items-center gap-1.5">
          <Button type="button" variant="secondary" onClick={onClose} disabled={isPending} className="h-7 px-2.5 text-xs font-medium">
            Cancel
          </Button>
          <Button
            type="submit"
            form="machine-complaint-form"
            variant="primary"
            loading={isPending}
            className="h-7 px-3 text-xs bg-emerald-600 hover:bg-emerald-700 text-white font-bold"
          >
            {isEdit ? "Update Complaint" : "Raise Machine Complaint"}
          </Button>
        </div>
      }
      size="xl"
    >
      <form id="machine-complaint-form" onSubmit={handleSubmit} className="flex flex-col gap-5">
        {/* 2-Column Machine & Site Selection Form */}
        <div className="rounded-xl border border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)] p-4 flex flex-col gap-3.5">
          <div className="flex items-center gap-2 pb-2 border-b border-[var(--color-hairline)]">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-[var(--color-ink)]">
              Machine & Breakdown Details
            </h4>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Machine No */}
            <div className="flex flex-col gap-1.5 w-full">
              <SearchableSelect
                label="Select Machine No"
                options={machineOptions}
                value={selectedMachineId}
                onChange={handleMachineChange}
                placeholder="-- Select Machine --"
                disabled={isPending || isEdit}
              />
            </div>

            {/* Machine Model (Auto filled) */}
            <Input
              name="machine_model"
              label="Machine Model"
              value={selectedMachine?.model || complaint?.machine?.model || ""}
              placeholder="e.g. S4046EE"
              readOnly
              className="bg-[var(--color-hairline-soft-surface)] font-mono font-bold"
            />

            {/* Complaint Date */}
            <Input
              name="complaint_date"
              type="date"
              label="Complaint Date"
              defaultValue={complaint?.complaint_date || new Date().toISOString().split("T")[0]}
              disabled={isPending}
              required
            />

            {/* State Name */}
            <Input
              name="state_name"
              label="State Name"
              placeholder="e.g. Haryana"
              defaultValue={complaint?.state_name || selectedMachine?.state || ""}
              disabled={isPending}
            />

            {/* Location / City */}
            <Input
              name="location"
              label="Location / City"
              placeholder="e.g. Jhajjar / Site 4"
              defaultValue={complaint?.location || selectedMachine?.city || ""}
              disabled={isPending}
            />

            {/* Service Engineer */}
            <div className="flex flex-col gap-1.5 w-full">
              <SearchableSelect
                label="Service Engineer"
                options={engineerOptions}
                value={selectedEngineerId}
                onChange={setSelectedEngineerId}
                placeholder="-- Select Service Engineer --"
                disabled={isPending}
                clearable
              />
            </div>

            {/* Hour Meter */}
            <Input
              name="hour_meter"
              type="number"
              step="0.1"
              label="Hour Meter"
              placeholder="e.g. 02337"
              defaultValue={complaint?.hour_meter?.toString() || selectedMachine?.hour_meter?.toString() || "0"}
              disabled={isPending}
            />

            {/* Required Part */}
            <Input
              name="required_part"
              label="Required Part"
              placeholder="e.g. Hydraulic Pipe / Battery Ladder"
              defaultValue={complaint?.required_part || ""}
              disabled={isPending}
            />

            {/* Part Quantity */}
            <Input
              name="part_quantity"
              type="number"
              label="Part Quantity"
              placeholder="1"
              defaultValue={complaint?.part_quantity?.toString() || "1"}
              disabled={isPending}
            />

            {/* Status */}
            <Select
              name="status"
              label="Status"
              options={statusOptions}
              defaultValue={complaint?.status || "open"}
              disabled={isPending}
            />
          </div>
        </div>

        {/* Complaint Textareas */}
        <div className="rounded-xl border border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)] p-4 flex flex-col gap-3.5">
          <Textarea
            name="complaint"
            label="Complaint Description (What is wrong?)"
            placeholder="Describe the machine breakdown or malfunction in detail..."
            defaultValue={complaint?.complaint || ""}
            rows={2}
            required
            disabled={isPending}
          />

          <Textarea
            name="work_done"
            label="Work Done (Filled by Engineer)"
            placeholder="Describe repair or maintenance work performed..."
            defaultValue={complaint?.work_done || ""}
            rows={2}
            disabled={isPending}
          />

          <Textarea
            name="pending_work"
            label="Pending Work (If any)"
            placeholder="Enter remaining tasks or spare parts required for complete resolution..."
            defaultValue={complaint?.pending_work || ""}
            rows={2}
            disabled={isPending}
          />
        </div>
      </form>
    </Modal>
  );
}
