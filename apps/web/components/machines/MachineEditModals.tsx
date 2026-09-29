"use client";

import { useState, useEffect, useRef, useMemo } from "react";
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
  updateMachinePersonnelAction,
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
  AssignPersonnelModal,
  type AssignPersonnelModalProps,
} from "./AssignPersonnelModal";
import {
  AnimatedAlertCircle,
  AnimatedBuilding,
  AnimatedInfo,
} from "@/components/ui/animated-icons";
import type { ClientShiftCode } from "@reachinternational/types";

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
export type MachinePersonnelModalProps = AssignPersonnelModalProps;

export function MachinePersonnelModal(props: MachinePersonnelModalProps) {
  return <AssignPersonnelModal {...props} />;
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
    const selectedClientObj = allClients.find((c) => c.id === clientId);
    // Instant optimistic update
    const optimisticFields: Partial<MachineWithEngineer> = {
      client_id: clientId || null,
      status: clientId ? "rented" : "available",
      client: (selectedClientObj as any) || null,
    };
    onMachineUpdated?.(optimisticFields);

    try {
      const res = await updateMachineClientAssignmentAction(machine.id, clientId || null);
      if (res.error) {
        toast("error", "Failed to update client assignment", res.error);
        // Rollback
        onMachineUpdated?.({
          client_id: machine.client_id || null,
          status: machine.status || "available",
          client: machine.client || null,
        });
      } else {
        const updatedFields: Partial<MachineWithEngineer> = {
          client_id: res.client_id || null,
          status: res.status || "available",
          client: (selectedClientObj as any) || null,
        };
        onMachineUpdated?.(updatedFields);
        onClose();
        router.refresh();
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
      onMachineUpdated?.({
        client_id: machine.client_id || null,
        status: machine.status || "available",
        client: machine.client || null,
      });
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
