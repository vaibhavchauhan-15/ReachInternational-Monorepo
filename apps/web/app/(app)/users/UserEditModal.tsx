"use client";

import { useState } from "react";
import {
  AnimatedUser,
  AnimatedPhone,
  AnimatedBuilding2,
  AnimatedShieldCheck,
  AnimatedShieldAlert,
  AnimatedWrench,
  AnimatedPackage,
  AnimatedActivity,
  AnimatedUsers,
  AnimatedCreditCard,
  AnimatedTrendingUp,
  AnimatedTruck,
  AnimatedMapPin,
} from "@/components/ui/animated-icons";
import { ShieldAlert, ShieldCheck, Building2, Wrench, Package, Activity, Users, CreditCard, TrendingUp, Truck } from "lucide-react";
import { Modal, Input, SearchableSelect, Button } from "@/components/ui";
import type { SelectOption } from "@/components/ui/SearchableSelect";
import type { User, UserRole } from "@/lib/types/database";
import type { Branch } from "@/lib/queries/branches";
import { validateAadhaarNumber, validateLicenseNumber, formatAadhaar } from "@reachinternational/utils";

const allRoleSelectOptions: SelectOption[] = [
  {
    value: "super_admin",
    label: "Super Admin",
    description: "Entire company control",
    icon: <ShieldAlert className="h-4 w-4 text-red-500" />,
  },
  {
    value: "admin",
    label: "Admin",
    description: "Platform & user management",
    icon: <ShieldCheck className="h-4 w-4 text-amber-500" />,
  },
  {
    value: "manager",
    label: "Manager",
    description: "Operations, fleet, client contracts & business management",
    icon: <ShieldCheck className="h-4 w-4 text-violet-500" />,
  },
  {
    value: "service_manager",
    label: "Service Manager",
    description: "Service planning, engineer dispatch & FSR approval",
    icon: <ShieldCheck className="h-4 w-4 text-indigo-500" />,
  },
  {
    value: "service_engineer",
    label: "Service Engineer",
    description: "Field operations & breakdown resolution",
    icon: <Wrench className="h-4 w-4 text-blue-500" />,
  },
  {
    value: "supervisor",
    label: "Supervisor",
    description: "Raise complaints & machine inspection",
    icon: <ShieldCheck className="h-4 w-4 text-teal-500" />,
  },
  {
    value: "store_manager",
    label: "Store Manager",
    description: "Inventory stock ledger & transfers",
    icon: <Package className="h-4 w-4 text-purple-500" />,
  },
  {
    value: "operator",
    label: "Operator",
    description: "Machine duty & daily running hour logs",
    icon: <Activity className="h-4 w-4 text-amber-500" />,
  },
  {
    value: "mechanic",
    label: "Mechanic / Technician",
    description: "Repair work orders & parts request",
    icon: <Wrench className="h-4 w-4 text-orange-500" />,
  },
  {
    value: "hr_manager",
    label: "HR Manager",
    description: "Staff onboarding, leave & payroll",
    icon: <Users className="h-4 w-4 text-emerald-500" />,
  },
];

interface UserEditModalProps {
  user: User;
  branches?: Branch[];
  isSuperAdmin?: boolean;
  onClose: () => void;
  loading: boolean;
  onSubmit: (formData: FormData) => void;
}

export function UserEditModal({
  user,
  isSuperAdmin = false,
  onClose,
  loading,
  onSubmit,
}: UserEditModalProps) {
  const [editForm, setEditForm] = useState({
    full_name: user.full_name,
    phone: user.phone || "+91 ",
    role: user.role,
    city: user.city || "",
    district: user.district || "",
    state: user.state || "",
    aadhaar_number: user.aadhaar_number ? formatAadhaar(user.aadhaar_number) : "",
    license_number: user.license_number || "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const handleFieldChange = (field: string, val: string) => {
    let formattedVal = val;
    if (field === "aadhaar_number") {
      formattedVal = formatAadhaar(val);
    } else if (field === "license_number") {
      formattedVal = val.toUpperCase();
    }

    setEditForm((prev) => ({ ...prev, [field]: formattedVal }));

    // Real-time check
    if (field === "aadhaar_number") {
      const clean = formattedVal.replace(/\D/g, "");
      if (clean.length === 12) {
        const res = validateAadhaarNumber(clean);
        if (!res.isValid) {
          setErrors((prev) => ({ ...prev, aadhaar_number: res.error || "Invalid Aadhaar" }));
          return;
        }
      }
    }

    if (errors[field]) {
      setErrors((prev) => {
        const copy = { ...prev };
        delete copy[field];
        return copy;
      });
    }
  };

  const handleFieldBlur = (field: string) => {
    if (field === "aadhaar_number" && editForm.aadhaar_number.trim()) {
      const res = validateAadhaarNumber(editForm.aadhaar_number);
      if (!res.isValid) {
        setErrors((prev) => ({ ...prev, aadhaar_number: res.error || "Invalid Aadhaar number" }));
      }
    } else if (field === "license_number" && editForm.license_number.trim()) {
      const res = validateLicenseNumber(editForm.license_number);
      if (!res.isValid) {
        setErrors((prev) => ({ ...prev, license_number: res.error || "Invalid driving licence format" }));
      }
    }
  };

  const handleFormSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const newErrors: Record<string, string> = {};

    if (editForm.aadhaar_number.trim()) {
      const aadhaarRes = validateAadhaarNumber(editForm.aadhaar_number);
      if (!aadhaarRes.isValid) {
        newErrors.aadhaar_number = aadhaarRes.error || "Invalid Aadhaar number.";
      }
    }

    if (editForm.license_number.trim()) {
      const licRes = validateLicenseNumber(editForm.license_number);
      if (!licRes.isValid) {
        newErrors.license_number = licRes.error || "Invalid driving licence format.";
      }
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    const formData = new FormData(e.currentTarget);
    onSubmit(formData);
  };

  const roleOptions = isSuperAdmin
    ? allRoleSelectOptions
    : allRoleSelectOptions.filter((r) => r.value !== "super_admin");

  return (
    <Modal
      open={true}
      onClose={onClose}
      title="Edit User Account Details"
      description="Update employee contact info, work location address, and role permissions."
      size="lg"
    >
      <form
        onSubmit={handleFormSubmit}
        className="flex flex-col gap-5"
      >
        <input type="hidden" name="role" value={editForm.role} />

        {/* Section 1: User Identity */}
        <div className="p-4 rounded-xl border border-[var(--color-hairline)] bg-[var(--color-canvas)] space-y-3.5">
          <div className="pb-2 border-b border-[var(--color-hairline)]">
            <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--color-ink)]">
              Contact & Identity Info
            </h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input
              label="Full Name *"
              name="full_name"
              icon={<AnimatedUser size={16} className="text-[var(--color-link)]" />}
              value={editForm.full_name}
              onChange={(e) => setEditForm((prev) => ({ ...prev, full_name: e.target.value }))}
              placeholder="e.g. Rahul Sharma"
              required
            />
            <Input
              label="Mobile Phone Number *"
              name="phone"
              type="tel"
              icon={<AnimatedPhone size={16} className="text-[var(--color-link)]" />}
              value={editForm.phone}
              onChange={(e) => setEditForm((prev) => ({ ...prev, phone: e.target.value }))}
              placeholder="+91 98765 43210"
              required
            />
          </div>
        </div>

        {/* Section 2: User Address & Work Location */}
        <div className="p-4 rounded-xl border border-[var(--color-hairline)] bg-[var(--color-canvas)] space-y-3.5">
          <div className="pb-2 border-b border-[var(--color-hairline)]">
            <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--color-ink)]">
              User Address & Work Location
            </h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Input
              label="City *"
              name="city"
              icon={<AnimatedMapPin size={16} className="text-emerald-500" />}
              value={editForm.city}
              onChange={(e) => setEditForm((prev) => ({ ...prev, city: e.target.value }))}
              placeholder="e.g. Pune"
              required
            />
            <Input
              label="District *"
              name="district"
              icon={<AnimatedMapPin size={16} className="text-emerald-500" />}
              value={editForm.district}
              onChange={(e) => setEditForm((prev) => ({ ...prev, district: e.target.value }))}
              placeholder="e.g. Pune"
              required
            />
            <Input
              label="State *"
              name="state"
              icon={<AnimatedMapPin size={16} className="text-emerald-500" />}
              value={editForm.state}
              onChange={(e) => setEditForm((prev) => ({ ...prev, state: e.target.value }))}
              placeholder="e.g. Maharashtra"
              required
            />
          </div>
        </div>

        {/* Section 3: Identity & Regulatory Documents */}
        <div className="p-4 rounded-xl border border-[var(--color-hairline)] bg-[var(--color-canvas)] space-y-3.5">
          <div className="pb-2 border-b border-[var(--color-hairline)]">
            <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--color-ink)]">
              Identity & Regulatory Documents
            </h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input
              label="Aadhaar Card Number"
              name="aadhaar_number"
              icon={<AnimatedShieldCheck size={16} className="text-[var(--color-link)]" />}
              value={editForm.aadhaar_number}
              onChange={(e) => handleFieldChange("aadhaar_number", e.target.value)}
              onBlur={() => handleFieldBlur("aadhaar_number")}
              error={errors.aadhaar_number}
              maxLength={14}
              placeholder="12-digit Aadhaar Number"
            />
            <Input
              label="Driving Licence Number"
              name="license_number"
              icon={<AnimatedCreditCard size={16} className="text-[var(--color-link)]" />}
              value={editForm.license_number}
              onChange={(e) => handleFieldChange("license_number", e.target.value)}
              onBlur={() => handleFieldBlur("license_number")}
              error={errors.license_number}
              maxLength={25}
              placeholder="e.g. MH12 20110012345"
            />
          </div>
        </div>

        {/* Section 4: Role & Access Control */}
        <div className="p-4 rounded-xl border border-[var(--color-hairline)] bg-[var(--color-canvas)] space-y-3.5">
          <div className="pb-2 border-b border-[var(--color-hairline)]">
            <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--color-ink)]">
              System Access Role
            </h3>
          </div>

          <SearchableSelect
            label="User Access Role *"
            options={roleOptions}
            value={editForm.role}
            onChange={(val) => setEditForm((prev) => ({ ...prev, role: val as UserRole }))}
            placeholder="Select access role..."
            clearable={false}
          />
        </div>

        <div className="flex items-center justify-end gap-3 pt-2">
          <Button type="button" variant="secondary" onClick={onClose} className="px-6">
            Cancel
          </Button>
          <Button type="submit" loading={loading} className="px-6 shadow-md">
            Save Account Changes
          </Button>
        </div>
      </form>
    </Modal>
  );
}
