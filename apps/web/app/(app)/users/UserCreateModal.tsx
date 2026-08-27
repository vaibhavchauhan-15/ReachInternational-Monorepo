"use client";

import { useState } from "react";
import {
  AnimatedUser,
  AnimatedMail,
  AnimatedPhone,
  AnimatedLock,
  AnimatedBuilding2,
  AnimatedPackage,
  AnimatedActivity,
  AnimatedWrench,
  AnimatedUsers,
  AnimatedCreditCard,
  AnimatedTrendingUp,
  AnimatedTruck,
  AnimatedMapPin,
  AnimatedShieldCheck,
  AnimatedShieldAlert,
} from "@/components/ui/animated-icons";
import { ShieldAlert, ShieldCheck, Building2, Wrench, Package, Activity, Users, CreditCard, TrendingUp, Truck } from "lucide-react";
import { Modal, Input, SearchableSelect, Button } from "@/components/ui";
import type { SelectOption } from "@/components/ui/SearchableSelect";
import type { UserRole } from "@/lib/types/database";
import type { Branch } from "@/lib/queries/branches";

const allRoleSelectOptions: SelectOption[] = [
  {
    value: "super_admin",
    label: "Super Admin",
    description: "Entire company & multi-branch control",
    icon: <ShieldAlert className="h-4 w-4 text-red-500" />,
  },
  {
    value: "admin",
    label: "Admin",
    description: "Platform & user management",
    icon: <ShieldCheck className="h-4 w-4 text-amber-500" />,
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
  {
    value: "finance_manager",
    label: "Accounts / Finance Manager",
    description: "Billing & financial reports",
    icon: <CreditCard className="h-4 w-4 text-cyan-500" />,
  },
  {
    value: "sales_executive",
    label: "Sales Executive",
    description: "Machinery sales & client inquiries",
    icon: <TrendingUp className="h-4 w-4 text-sky-500" />,
  },
  {
    value: "rental_manager",
    label: "Rental Manager",
    description: "Rental fleet contracts & dispatches",
    icon: <Truck className="h-4 w-4 text-violet-500" />,
  },
];

interface UserCreateModalProps {
  open: boolean;
  onClose: () => void;
  isSuperAdmin: boolean;
  branches?: Branch[];
  loading: boolean;
  onSubmit: (formData: FormData) => void;
}

export function UserCreateModal({
  open,
  onClose,
  isSuperAdmin,
  branches = [],
  loading,
  onSubmit,
}: UserCreateModalProps) {
  const [createForm, setCreateForm] = useState({
    full_name: "",
    email: "",
    phone: "+91 ",
    password: "",
    role: "service_engineer" as UserRole,
    branch_id: "none",
    city: "",
    district: "",
    state: "",
  });

  const roleOptions = isSuperAdmin
    ? allRoleSelectOptions
    : allRoleSelectOptions.filter((r) => r.value !== "super_admin");

  const branchOptions: SelectOption[] = [
    {
      value: "none",
      label: "HQ / Global / Unassigned Branch",
      description: "Corporate HQ & Company-wide Access",
      icon: <Building2 className="h-4 w-4 text-slate-400" />,
    },
    ...branches.map((b) => ({
      value: b.id,
      label: b.name,
      description: `${b.city}, ${b.state} (${b.code})`,
      icon: <Building2 className="h-4 w-4 text-indigo-500" />,
    })),
  ];

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Add Employee / User Account"
      description="Register a new employee or manager with immediate active access. Login credentials will be emailed directly to the user."
      size="lg"
    >
      <form
        action={(formData) => {
          onSubmit(formData);
        }}
        className="flex flex-col gap-5"
      >
        {/* Hidden inputs for custom select values */}
        <input type="hidden" name="branch_id" value={createForm.branch_id} />
        <input type="hidden" name="role" value={createForm.role} />

        {/* Informational banner: Direct activation without approval request */}
        <div className="flex items-center gap-2.5 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-xs font-medium text-emerald-800 dark:text-emerald-300">
          <ShieldCheck className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
          <span>Accounts created via dashboard are activated immediately. Credentials will be emailed directly to the user without admin approval requests.</span>
        </div>

        {/* Section 1: User Identity & Login Credentials */}
        <div className="p-4 rounded-xl border border-[var(--color-hairline)] bg-[var(--color-canvas)] space-y-3.5">
          <div className="pb-2 border-b border-[var(--color-hairline)]">
            <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--color-ink)]">
              1. Employee Identity & Login Credentials
            </h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input
              label="Full Name *"
              name="full_name"
              icon={<AnimatedUser size={16} className="text-[var(--color-link)]" />}
              value={createForm.full_name}
              onChange={(e) => setCreateForm((prev) => ({ ...prev, full_name: e.target.value }))}
              placeholder="e.g. Rahul Sharma"
              required
            />
            <Input
              label="Email Address *"
              name="email"
              type="email"
              icon={<AnimatedMail size={16} className="text-[var(--color-link)]" />}
              value={createForm.email}
              onChange={(e) => setCreateForm((prev) => ({ ...prev, email: e.target.value }))}
              placeholder="rahul@customdomain.in"
              required
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input
              label="Mobile Phone Number *"
              name="phone"
              type="tel"
              icon={<AnimatedPhone size={16} className="text-[var(--color-link)]" />}
              value={createForm.phone}
              onChange={(e) => setCreateForm((prev) => ({ ...prev, phone: e.target.value }))}
              placeholder="+91 98765 43210"
              required
            />
            <Input
              label="Account Password *"
              name="password"
              type="password"
              icon={<AnimatedLock size={16} className="text-[var(--color-link)]" />}
              value={createForm.password}
              onChange={(e) => setCreateForm((prev) => ({ ...prev, password: e.target.value }))}
              placeholder="••••••••"
              required
            />
          </div>
        </div>

        {/* Section 2: User Address & Work Location */}
        <div className="p-4 rounded-xl border border-[var(--color-hairline)] bg-[var(--color-canvas)] space-y-3.5">
          <div className="pb-2 border-b border-[var(--color-hairline)]">
            <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--color-ink)]">
              2. User Address & Work Location
            </h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Input
              label="City *"
              name="city"
              icon={<AnimatedMapPin size={16} className="text-emerald-500" />}
              value={createForm.city}
              onChange={(e) => setCreateForm((prev) => ({ ...prev, city: e.target.value }))}
              placeholder="e.g. Pune"
              required
            />
            <Input
              label="District *"
              name="district"
              icon={<AnimatedMapPin size={16} className="text-emerald-500" />}
              value={createForm.district}
              onChange={(e) => setCreateForm((prev) => ({ ...prev, district: e.target.value }))}
              placeholder="e.g. Pune"
              required
            />
            <Input
              label="State *"
              name="state"
              icon={<AnimatedMapPin size={16} className="text-emerald-500" />}
              value={createForm.state}
              onChange={(e) => setCreateForm((prev) => ({ ...prev, state: e.target.value }))}
              placeholder="e.g. Maharashtra"
              required
            />
          </div>
        </div>

        {/* Section 3: User Access Role & System Permissions */}
        <div className="p-4 rounded-xl border border-[var(--color-hairline)] bg-[var(--color-canvas)] space-y-3.5">
          <div className="pb-2 border-b border-[var(--color-hairline)]">
            <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--color-ink)]">
              3. User Access Role & System Permissions
            </h3>
          </div>

          {/* Custom Role Selector */}
          <SearchableSelect
            label="User Access Role *"
            options={roleOptions}
            value={createForm.role}
            onChange={(val) => setCreateForm((prev) => ({ ...prev, role: val as UserRole }))}
            placeholder="Select user role..."
            clearable={false}
          />
        </div>

        {/* Form Action Controls */}
        <div className="flex items-center justify-end gap-3 pt-2">
          <Button type="button" variant="secondary" onClick={onClose} className="px-6">
            Cancel
          </Button>
          <Button type="submit" loading={loading} className="px-6 shadow-md">
            Create User Account
          </Button>
        </div>
      </form>
    </Modal>
  );
}
