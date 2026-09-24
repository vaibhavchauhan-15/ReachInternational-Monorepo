"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  Modal,
  Button,
  Input,
  Select,
  useToast,
  MultiUserSelect,
  ClientSelect,
  type ClientSelectItem,
} from "@/components/ui";
import {
  updateMachineInfoAction,
  updateMachineSupervisorsAction,
  updateMachineOperatorsAction,
  updateMachineClientAssignmentAction,
  checkMachineSerialNumberAvailable,
  getMachineModalOptionsAction,
  getClientSelectOptionsAction,
  getMachinePersonnelFreshAction,
} from "@/app/actions/machines";
import type { MachineWithEngineer } from "@/lib/types/database";
import type { User, UserRole } from "@reachinternational/types";
import { isManagerOrAbove } from "@reachinternational/permissions";
import {
  AnimatedShield,
  AnimatedWrench,
  AnimatedAlertCircle,
  AnimatedBuilding,
  AnimatedInfo,
} from "@/components/ui/animated-icons";
import { Shield, Wrench, AlertCircle } from "lucide-react";

const HEALTH_STATUS_OPTIONS = [
  { value: "active", label: "Active" },
  { value: "spare", label: "Spare" },
  { value: "under_maintenance", label: "Under Maintenance" },
  { value: "breakdown", label: "Breakdown" },
];

// ═════════════════════════════════════════════════════════════════
// 1. MACHINE INFO MODAL (Specifications, Engine Readings, Registry)
// ═════════════════════════════════════════════════════════════════
export interface MachineInfoModalProps {
  isOpen: boolean;
  onClose: () => void;
  machine: MachineWithEngineer;
  onMachineUpdated?: (updated: Partial<MachineWithEngineer>) => void;
}

export function MachineInfoModal({
  isOpen,
  onClose,
  machine,
  onMachineUpdated,
}: MachineInfoModalProps) {
  const router = useRouter();
  const { toast } = useToast();

  const [model, setModel] = useState<string>(machine.model || "");
  const [serialNumber, setSerialNumber] = useState<string>(machine.serial_number || "");
  const [yearOfMfg, setYearOfMfg] = useState<string>(machine.year_of_mfg ? String(machine.year_of_mfg) : "");
  const [manufacturer, setManufacturer] = useState<string>(machine.manufacturer || "");
  const [hourMeter, setHourMeter] = useState<string>(String(machine.hour_meter ?? 0));
  const [healthStatus, setHealthStatus] = useState<string>(machine.health_status || "active");
  const [infoErrors, setInfoErrors] = useState<Record<string, string>>({});
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setModel(machine.model || "");
      setSerialNumber(machine.serial_number || "");
      setYearOfMfg(machine.year_of_mfg ? String(machine.year_of_mfg) : "");
      setManufacturer(machine.manufacturer || "");
      setHourMeter(String(machine.hour_meter ?? 0));
      setHealthStatus(machine.health_status || "active");
      setInfoErrors({});
    }
  }, [isOpen, machine]);

  const isDirty =
    model.trim() !== (machine.model || "").trim() ||
    serialNumber.trim() !== (machine.serial_number || "").trim() ||
    yearOfMfg.trim() !== (machine.year_of_mfg ? String(machine.year_of_mfg) : "").trim() ||
    manufacturer.trim() !== (machine.manufacturer || "").trim() ||
    (parseFloat(hourMeter) || 0) !== (machine.hour_meter ?? 0) ||
    healthStatus !== (machine.health_status || "active");

  const lastAttemptRef = useRef<number>(0);

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
    if (now - lastAttemptRef.current > 1200) {
      lastAttemptRef.current = now;
      toast("error", "Cannot edit Machine ID", "Machine ID cannot be edited.");
    }
  };

  const handleSerialBlur = async () => {
    const val = serialNumber.trim();
    if (!val || val.toLowerCase() === (machine.serial_number || "").toLowerCase().trim()) {
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

  const handleSave = async () => {
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

    setIsSaving(true);
    try {
      const res = await updateMachineInfoAction(machine.id, {
        machine_id: machine.machine_id,
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
        const updatedFields = {
          machine_id: res.machine?.machine_id || machine.machine_id,
          model: model.trim(),
          serial_number: serialNumber.trim(),
          year_of_mfg: yearOfMfg.trim(),
          manufacturer: manufacturer.trim(),
          hour_meter: parsedHmr || 0,
          health_status: healthStatus as any,
        };
        onMachineUpdated?.(updatedFields);
        router.refresh();
        toast("success", "Machine specifications updated", `Info for ${res.machine?.machine_id || machine.machine_id} saved successfully.`);
        onClose();
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "An unexpected error occurred.";
      toast("error", "Failed to update machine", msg);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Modal
      open={isOpen}
      onClose={onClose}
      preventAutoFocus={true}
      title="Edit Machine Info"
      size="lg"
    >
      <div className="space-y-4">
        <div
          data-hover-parent
          className="rounded-xl border border-[var(--color-hairline)] bg-[var(--color-canvas)] p-3.5 space-y-3 transition-colors"
        >
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-[var(--color-mute)] pb-2 border-b border-[var(--color-hairline)]">
            <AnimatedInfo size={16} className="w-4 h-4 text-sky-600 dark:text-sky-400 shrink-0" />
            <span>Specifications & Meter Readings</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 pt-1">
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
              value={machine.machine_id || ""}
              readOnly
              tabIndex={-1}
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
            disabled={isSaving}
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
            disabled={isSaving}
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
            disabled={isSaving}
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
              disabled={isSaving}
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
            disabled={isSaving}
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
            disabled={isSaving}
          />
        </div>
      </div>

        <div className="pt-3 border-t border-[var(--color-hairline)] flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="text-xs text-[var(--color-mute)] empty:hidden">
            {isDirty && (
              <span
                data-hover-parent
                className="text-amber-500 dark:text-amber-400 font-medium inline-flex items-center gap-1.5 px-2 py-1 rounded-md bg-amber-500/10 border border-amber-500/20 text-xs transition-colors cursor-default"
              >
                <AnimatedAlertCircle size={14} className="w-3.5 h-3.5 shrink-0" />
                <span>Unsaved changes</span>
              </span>
            )}
          </div>
          <div className="grid grid-cols-2 gap-2.5 w-full sm:w-auto sm:flex sm:items-center sm:gap-2 sm:ml-auto">
            <Button
              type="button"
              variant="secondary"
              onClick={onClose}
              disabled={isSaving}
              className="w-full sm:w-auto h-11 min-h-[44px] px-4 text-sm font-medium justify-center"
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="primary"
              loading={isSaving}
              disabled={!isDirty || isSaving}
              onClick={handleSave}
              className="w-full sm:w-auto h-11 min-h-[44px] px-5 text-sm font-semibold justify-center"
            >
              Save Machine Info
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  );
}

// ═════════════════════════════════════════════════════════════════
// 2. MACHINE PERSONNEL MODAL (Supervisor & Operator Assignments)
// ═════════════════════════════════════════════════════════════════
export interface MachinePersonnelModalProps {
  isOpen: boolean;
  onClose: () => void;
  machine: MachineWithEngineer;
  supervisors?: User[];
  operators?: User[];
  userRole?: UserRole | string;
  onMachineUpdated?: (updated: Partial<MachineWithEngineer>) => void;
}

export function MachinePersonnelModal({
  isOpen,
  onClose,
  machine,
  supervisors = [],
  operators = [],
  userRole = "admin",
  onMachineUpdated,
}: MachinePersonnelModalProps) {
  const router = useRouter();
  const { toast } = useToast();

  const canEditSupervisor = isManagerOrAbove(userRole as any);

  const initialSupervisorIds = Array.isArray(machine.supervisor_ids)
    ? machine.supervisor_ids
    : machine.current_supervisor_id ? [machine.current_supervisor_id] : [];

  const initialOperatorIds = Array.isArray(machine.operator_ids)
    ? machine.operator_ids
    : machine.current_operator_id ? [machine.current_operator_id] : [];

  const [supervisorIds, setSupervisorIds] = useState<string[]>(initialSupervisorIds);
  const [operatorIds, setOperatorIds] = useState<string[]>(initialOperatorIds);
  const [isSaving, setIsSaving] = useState(false);

  // Lazy-loaded options state with props fallback
  const [lazySupervisors, setLazySupervisors] = useState<User[]>(() => supervisors || []);
  const [lazyOperators, setLazyOperators] = useState<User[]>(() => operators || []);
  const [isLoadingOptions, setIsLoadingOptions] = useState(false);

  useEffect(() => {
    if (supervisors && supervisors.length > 0) {
      setLazySupervisors(supervisors);
    }
  }, [supervisors]);

  useEffect(() => {
    if (operators && operators.length > 0) {
      setLazyOperators(operators);
    }
  }, [operators]);

  // On-demand fetch when modal is open and options are empty
  useEffect(() => {
    if (!isOpen) return;
    if (lazySupervisors.length > 0 && lazyOperators.length > 0) return;

    let isMounted = true;
    setIsLoadingOptions(true);
    getMachineModalOptionsAction()
      .then((data) => {
        if (!isMounted) return;
        if (data.supervisors && data.supervisors.length > 0) {
          setLazySupervisors(data.supervisors);
        }
        if (data.operators && data.operators.length > 0) {
          setLazyOperators(data.operators);
        }
      })
      .catch((err) => {
        console.error("Failed to load personnel options for MachinePersonnelModal", err);
      })
      .finally(() => {
        if (isMounted) setIsLoadingOptions(false);
      });

    return () => {
      isMounted = false;
    };
  }, [isOpen, lazySupervisors.length, lazyOperators.length]);

  useEffect(() => {
    if (isOpen) {
      const supIds = Array.isArray(machine.supervisor_ids)
        ? machine.supervisor_ids
        : machine.current_supervisor_id ? [machine.current_supervisor_id] : [];
      setSupervisorIds(supIds);

      const opIds = Array.isArray(machine.operator_ids)
        ? machine.operator_ids
        : machine.current_operator_id ? [machine.current_operator_id] : [];
      setOperatorIds(opIds);
    }
  }, [isOpen, machine]);

  // Option Lists Hydration
  const allSupervisors: Array<{
    id: string;
    full_name: string;
    phone?: string | null;
    email?: string | null;
    shift_time?: string | null;
    role?: string | null;
    status?: string | null;
  }> = (lazySupervisors || []).map((s) => ({
    ...s,
    full_name: s.full_name || (s as any).name || "Supervisor",
    role: s.role || "supervisor",
    status: s.status || "active",
  }));

  if (Array.isArray(machine.supervisors)) {
    machine.supervisors.forEach((s) => {
      if (s && !allSupervisors.some((item) => item.id === s.id)) {
        allSupervisors.push({
          id: s.id,
          full_name: s.full_name || (s as any).name || "Supervisor",
          phone: s.phone,
          email: s.email,
          shift_time: s.shift_time,
          role: "supervisor",
          status: "active",
        });
      }
    });
  }
  if (machine.current_supervisor && machine.current_supervisor_id) {
    if (!allSupervisors.some((s) => s.id === machine.current_supervisor_id)) {
      allSupervisors.push({
        id: machine.current_supervisor_id,
        full_name: machine.current_supervisor.full_name || (machine.current_supervisor as any).name || "Supervisor",
        phone: machine.current_supervisor.phone,
        email: machine.current_supervisor.email,
        shift_time: machine.current_supervisor.shift_time,
        role: "supervisor",
        status: "active",
      });
    }
  }

  const allOperators: Array<{
    id: string;
    full_name: string;
    phone?: string | null;
    email?: string | null;
    shift_time?: string | null;
    role?: string | null;
    status?: string | null;
  }> = (lazyOperators || [])
    .filter((o) => (!o.role || o.role === "operator") && o.status !== "inactive")
    .map((o) => ({
      ...o,
      full_name: o.full_name || (o as any).name || "Operator",
      role: "operator",
      status: o.status || "active",
    }));

  if (Array.isArray(machine.operators)) {
    machine.operators.forEach((o) => {
      if (o && (!(o as any).role || (o as any).role === "operator") && !allOperators.some((item) => item.id === o.id)) {
        allOperators.push({
          id: o.id,
          full_name: o.full_name || (o as any).name || "Operator",
          phone: o.phone,
          email: o.email,
          shift_time: o.shift_time,
          role: "operator",
          status: "active",
        });
      }
    });
  }
  if (machine.current_operator && machine.current_operator_id) {
    const currOp = machine.current_operator;
    if ((!(currOp as any).role || (currOp as any).role === "operator") && !allOperators.some((o) => o.id === machine.current_operator_id)) {
      allOperators.push({
        id: machine.current_operator_id,
        full_name: currOp.full_name || (currOp as any).name || "Operator",
        phone: currOp.phone,
        email: currOp.email,
        shift_time: currOp.shift_time,
        role: "operator",
        status: "active",
      });
    }
  }

  const savedSupIds = Array.isArray(machine.supervisor_ids)
    ? machine.supervisor_ids
    : machine.current_supervisor_id ? [machine.current_supervisor_id] : [];
  const isSupervisorsDirty =
    JSON.stringify([...supervisorIds].sort()) !== JSON.stringify([...savedSupIds].sort());

  const savedOpIds = Array.isArray(machine.operator_ids)
    ? machine.operator_ids
    : machine.current_operator_id ? [machine.current_operator_id] : [];
  const isOperatorsDirty =
    JSON.stringify([...operatorIds].sort()) !== JSON.stringify([...savedOpIds].sort());

  const isSupervisor = userRole === "supervisor";
  const isDirty = canEditSupervisor ? (isSupervisorsDirty || isOperatorsDirty) : isOperatorsDirty;

  const handleSavePersonnel = async () => {
    setIsSaving(true);
    try {
      const promises: Promise<any>[] = [];
      const updatedFields: Partial<MachineWithEngineer> = {};

      if (isSupervisorsDirty && canEditSupervisor) {
        promises.push(
          updateMachineSupervisorsAction(machine.id, supervisorIds).then((res) => {
            if (res.error) throw new Error(res.error);
            const freshSups = res.supervisors && res.supervisors.length > 0
              ? res.supervisors
              : (supervisorIds.length === 0 ? [] : allSupervisors.filter((s) => supervisorIds.includes(s.id)));
            updatedFields.supervisor_ids = res.supervisor_ids !== undefined ? res.supervisor_ids : supervisorIds;
            updatedFields.current_supervisor_id = res.current_supervisor_id !== undefined ? res.current_supervisor_id : null;
            updatedFields.supervisors = freshSups as any;
            updatedFields.current_supervisor = (freshSups[0] as any) || null;
          })
        );
      }

      if (isOperatorsDirty) {
        promises.push(
          updateMachineOperatorsAction(machine.id, operatorIds).then((res) => {
            if (res.error) throw new Error(res.error);
            const freshOps = res.operators && res.operators.length > 0
              ? res.operators
              : (operatorIds.length === 0 ? [] : allOperators.filter((o) => operatorIds.includes(o.id)));
            updatedFields.operator_ids = res.operator_ids !== undefined ? res.operator_ids : operatorIds;
            updatedFields.current_operator_id = res.current_operator_id !== undefined ? res.current_operator_id : null;
            updatedFields.operators = freshOps as any;
            updatedFields.current_operator = (freshOps[0] as any) || null;
          })
        );
      }

      await Promise.all(promises);

      // Immediately invalidate and update assignment component with fresh database response
      onMachineUpdated?.(updatedFields);

      // Dedicated background verification query directly to DB without blocking UI or reloading
      void getMachinePersonnelFreshAction(machine.id).then((freshRes) => {
        if (freshRes.success && freshRes.data) {
          onMachineUpdated?.(freshRes.data as any);
        }
      });

      toast(
        "success",
        isSupervisor ? "Operator assignment updated" : "Personnel assignments updated",
        isSupervisor
          ? "Machine operator assignments saved successfully."
          : "Supervisors and operators updated successfully."
      );
      onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to update personnel";
      toast("error", "Update failed", msg);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Modal
      open={isOpen}
      onClose={onClose}
      title={
        <div className="flex items-center gap-2 flex-wrap min-w-0">
          <span className="font-bold text-sm sm:text-base text-[var(--color-ink)]">
            {isSupervisor ? "Assign Machine Operator" : "Assign Shift Personnel"}
          </span>
          <span className="font-mono text-xs px-2 py-0.5 rounded bg-[var(--color-hairline-soft-surface)] text-[var(--color-mute)] border border-[var(--color-hairline)] font-normal">
            {machine.machine_id}
          </span>
          {(machine.model || machine.serial_number) && (
            <span className="text-xs text-[var(--color-mute)] font-normal flex items-center gap-1">
              <span>•</span>
              {machine.model && <span className="font-medium text-[var(--color-ink)]">{machine.model}</span>}
              {machine.model && machine.serial_number && <span>-</span>}
              {machine.serial_number && <span className="font-mono">{machine.serial_number}</span>}
            </span>
          )}
        </div>
      }
      size="lg"
    >
      <div className="space-y-4">
        {/* Supervisors Section */}
        <div
          data-hover-parent
          className="rounded-xl border border-[var(--color-hairline)] bg-[var(--color-canvas)] p-3.5 space-y-3 transition-colors"
        >
          <div className="flex items-center justify-between pb-2 border-b border-[var(--color-hairline)]">
            <div className="flex items-center gap-2">
              <AnimatedShield size={16} className="w-4 h-4 text-teal-600 dark:text-teal-400 shrink-0" />
              <span className="text-xs font-semibold uppercase tracking-wider text-[var(--color-ink)]">
                Assigned Supervisors (Multi-Shift Oversight)
              </span>
            </div>
            {!canEditSupervisor && (
              <span className="text-[10px] text-[var(--color-mute)] font-medium">
                Managed by Administrators
              </span>
            )}
          </div>
          {canEditSupervisor ? (
            <MultiUserSelect
              label=""
              users={allSupervisors}
              values={supervisorIds}
              onChange={setSupervisorIds}
              placeholder={isLoadingOptions && allSupervisors.length === 0 ? "Loading supervisors from database..." : "Search & assign supervisors..."}
              disabled={isSaving}
            />
          ) : (
            <div className="space-y-2 text-xs">
              {allSupervisors.filter((s) => supervisorIds.includes(s.id)).length > 0 ? (
                <div className="flex flex-wrap gap-1.5">
                  {allSupervisors
                    .filter((s) => supervisorIds.includes(s.id))
                    .map((s) => (
                      <span
                        key={s.id}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold bg-[var(--color-canvas-elevated)] border border-[var(--color-hairline)] text-[var(--color-ink)] shadow-2xs"
                      >
                        <span className="w-1.5 h-1.5 rounded-full bg-teal-500" />
                        <span>{s.full_name}</span>
                      </span>
                    ))}
                </div>
              ) : (
                <p className="text-[11px] text-[var(--color-mute)] italic">No supervisors designated</p>
              )}
            </div>
          )}
        </div>

        {/* Operators Section */}
        <div
          data-hover-parent
          className="rounded-xl border border-[var(--color-hairline)] bg-[var(--color-canvas)] p-3.5 space-y-3 transition-colors"
        >
          <div className="flex items-center justify-between pb-2 border-b border-[var(--color-hairline)]">
            <div className="flex items-center gap-2">
              <AnimatedWrench size={16} className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
              <span className="text-xs font-semibold uppercase tracking-wider text-[var(--color-ink)]">
                Assigned Operators (24h Shift Execution)
              </span>
            </div>
            <span className="text-[10px] text-[var(--color-mute)] font-medium">
              Only active operators eligible
            </span>
          </div>
          <MultiUserSelect
            label=""
            users={allOperators}
            values={operatorIds}
            onChange={setOperatorIds}
            placeholder={isLoadingOptions && allOperators.length === 0 ? "Loading operators from database..." : "Search & assign operators..."}
            disabled={isSaving}
          />
        </div>

        {/* Footer Actions */}
        <div className="pt-3 border-t border-[var(--color-hairline)] flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="text-xs text-[var(--color-mute)] empty:hidden">
            {isDirty && (
              <span
                data-hover-parent
                className="text-amber-500 dark:text-amber-400 font-medium inline-flex items-center gap-1.5 px-2 py-1 rounded-md bg-amber-500/10 border border-amber-500/20 text-xs transition-colors cursor-default"
              >
                <AnimatedAlertCircle size={14} className="w-3.5 h-3.5 shrink-0" />
                <span>Unsaved roster changes</span>
              </span>
            )}
          </div>
          <div className="grid grid-cols-2 gap-2.5 w-full sm:w-auto sm:flex sm:items-center sm:gap-2 sm:ml-auto">
            <Button
              type="button"
              variant="secondary"
              onClick={onClose}
              disabled={isSaving}
              className="w-full sm:w-auto h-11 min-h-[44px] px-4 text-sm font-medium justify-center"
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="primary"
              loading={isSaving}
              disabled={!isDirty || isSaving}
              onClick={handleSavePersonnel}
              className="w-full sm:w-auto h-11 min-h-[44px] px-5 text-sm font-semibold justify-center"
            >
              {isSupervisor ? "Save Operator Assignment" : "Update Personnel"}
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  );
}

// ═════════════════════════════════════════════════════════════════
// 3. MACHINE CLIENT MODAL (Client Assignment & Rental Deployment)
// ═════════════════════════════════════════════════════════════════
export interface MachineClientModalProps {
  isOpen: boolean;
  onClose: () => void;
  machine: MachineWithEngineer;
  clients?: ClientSelectItem[];
  onMachineUpdated?: (updated: Partial<MachineWithEngineer>) => void;
}

export function MachineClientModal({
  isOpen,
  onClose,
  machine,
  clients = [],
  onMachineUpdated,
}: MachineClientModalProps) {
  const router = useRouter();
  const { toast } = useToast();

  const [clientId, setClientId] = useState<string>(machine.client_id || "");
  const [isSaving, setIsSaving] = useState(false);
  const [lazyClients, setLazyClients] = useState<ClientSelectItem[]>(() => clients || []);
  const [isLoadingClients, setIsLoadingClients] = useState(false);

  useEffect(() => {
    if (clients && clients.length > 0) {
      setLazyClients(clients);
    }
  }, [clients]);

  useEffect(() => {
    if (!isOpen) return;
    if (lazyClients.length > 0) return;

    let isMounted = true;
    setIsLoadingClients(true);
    getClientSelectOptionsAction()
      .then((data) => {
        if (!isMounted) return;
        if (data && data.length > 0) {
          setLazyClients(data as unknown as ClientSelectItem[]);
        }
      })
      .catch((err) => {
        console.error("Failed to load clients for MachineClientModal", err);
      })
      .finally(() => {
        if (isMounted) setIsLoadingClients(false);
      });

    return () => {
      isMounted = false;
    };
  }, [isOpen, lazyClients.length]);

  useEffect(() => {
    if (isOpen) {
      setClientId(machine.client_id || "");
    }
  }, [isOpen, machine]);

  const allClients: ClientSelectItem[] = [...lazyClients];
  if (machine.client && machine.client_id) {
    if (!allClients.some((c) => c.id === machine.client_id)) {
      allClients.push(machine.client as ClientSelectItem);
    }
  }

  const assignedClient = allClients.find((c) => c.id === clientId);
  const assignedClientName = assignedClient?.company_name || assignedClient?.name || (clientId ? "Assigned Client" : "");

  const isDirty = (clientId || "") !== (machine.client_id || "");

  const handleSaveClient = async () => {
    setIsSaving(true);
    try {
      const res = await updateMachineClientAssignmentAction(machine.id, clientId || null);
      if (res.error) {
        toast("error", "Failed to update client assignment", res.error);
      } else {
        const selectedClientObj = allClients.find((c) => c.id === clientId);
        const updatedFields: Partial<MachineWithEngineer> = {
          client_id: res.client_id || null,
          status: res.status || "available",
          client: (selectedClientObj as any) || null,
        };
        onMachineUpdated?.(updatedFields);
        router.refresh();
        toast(
          "success",
          res.client_id ? "Client assigned" : "Machine set to available",
          res.client_id
            ? `Machine deployed to ${assignedClientName} (Status: Rented).`
            : "Client assignment cleared. Machine is now Available in fleet."
        );
        onClose();
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to update client assignment";
      toast("error", "Failed to update client assignment", msg);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Modal
      open={isOpen}
      onClose={onClose}
      title={
        <div className="flex items-center gap-2 flex-wrap min-w-0">
          <span className="font-bold text-sm sm:text-base text-[var(--color-ink)]">
            Client Assignment
          </span>
          <span className="font-mono text-xs px-2 py-0.5 rounded bg-[var(--color-hairline-soft-surface)] text-[var(--color-mute)] border border-[var(--color-hairline)] font-normal">
            {machine.machine_id}
          </span>
          {(machine.model || machine.serial_number) && (
            <span className="text-xs text-[var(--color-mute)] font-normal flex items-center gap-1">
              <span>•</span>
              {machine.model && <span className="font-medium text-[var(--color-ink)]">{machine.model}</span>}
              {machine.model && machine.serial_number && <span>-</span>}
              {machine.serial_number && <span className="font-mono">{machine.serial_number}</span>}
            </span>
          )}
        </div>
      }
      size="md"
    >
      <div className="space-y-4">
        <div
          data-hover-parent
          className="rounded-xl border border-[var(--color-hairline)] bg-[var(--color-canvas)] p-3.5 space-y-3 transition-colors"
        >
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-[var(--color-mute)] pb-2 border-b border-[var(--color-hairline)]">
            <AnimatedBuilding size={16} className="w-4 h-4 text-sky-600 dark:text-sky-400 shrink-0" />
            <span>Client Assignment & Rental Status</span>
          </div>

          <div className="space-y-3">
            <ClientSelect
              label=""
              clients={allClients}
              value={clientId}
              onChange={(selectedId) => setClientId(selectedId || "")}
              placeholder={isLoadingClients && allClients.length === 0 ? "Loading clients from database..." : "Search and select client renting this machine..."}
              clearable
              disabled={isSaving}
            />

            <div className="p-2.5 rounded-lg border border-[var(--color-hairline)] bg-[var(--color-hairline-soft-surface)]/50 flex items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-2">
                <span
                  className={`w-2.5 h-2.5 rounded-full ${
                    clientId ? "bg-sky-500 animate-pulse" : "bg-emerald-500"
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
        </div>

        <div className="pt-3 border-t border-[var(--color-hairline)] flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="text-xs text-[var(--color-mute)] empty:hidden">
            {isDirty && (
              <span
                data-hover-parent
                className="text-amber-500 dark:text-amber-400 font-medium inline-flex items-center gap-1.5 px-2 py-1 rounded-md bg-amber-500/10 border border-amber-500/20 text-xs transition-colors cursor-default"
              >
                <AnimatedAlertCircle size={14} className="w-3.5 h-3.5 shrink-0" />
                <span>Unsaved client assignment</span>
              </span>
            )}
          </div>
          <div className="grid grid-cols-2 gap-2.5 w-full sm:w-auto sm:flex sm:items-center sm:gap-2 sm:ml-auto">
            <Button
              type="button"
              variant="secondary"
              onClick={onClose}
              disabled={isSaving}
              className="w-full sm:w-auto h-11 min-h-[44px] px-4 text-sm font-medium justify-center"
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="primary"
              loading={isSaving}
              disabled={!isDirty || isSaving}
              onClick={handleSaveClient}
              className="w-full sm:w-auto h-11 min-h-[44px] px-4 text-sm font-semibold justify-center"
            >
              {clientId ? "Update Client Assignment" : "Confirm Available"}
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
