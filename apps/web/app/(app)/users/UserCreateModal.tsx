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
import { validateAadhaarNumber, validateLicenseNumber, formatAadhaar } from "@reachinternational/utils";
import { isSupervisedRole } from "@reachinternational/permissions";
import {
  FormSectionCard,
  UserAddressSection,
  UserSalaryField,
  FormSubmitButton,
} from "@/components/forms";

const allRoleSelectOptions: SelectOption[] = [
  {
    value: "super_admin",
    label: "Super Admin",
    description: "Entire company & full system control",
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
    value: "supervisor",
    label: "Supervisor",
    description: "Site supervisor & operator assignment oversight",
    icon: <ShieldCheck className="h-4 w-4 text-teal-500" />,
  },
  {
    value: "hr",
    label: "HR",
    description: "Staff onboarding, documents & directory management",
    icon: <Users className="h-4 w-4 text-emerald-500" />,
  },
  {
    value: "operator",
    label: "Operator",
    description: "Machine duty & daily running hour logs",
    icon: <Activity className="h-4 w-4 text-amber-500" />,
  },
];

interface UserCreateModalProps {
  open: boolean;
  onClose: () => void;
  isSuperAdmin: boolean;
  branches?: Branch[];
  loading: boolean;
  onSubmit: (formData: FormData) => void;
  supervisors?: SelectOption[];
  workingLocations?: SelectOption[];
}

export function UserCreateModal({
  open,
  onClose,
  isSuperAdmin,
  branches = [],
  loading,
  onSubmit,
  supervisors = [],
  workingLocations: _workingLocations = [],
}: UserCreateModalProps) {
  const [createForm, setCreateForm] = useState({
    full_name: "",
    email: "",
    phone: "+91 ",
    password: "",
    role: "operator" as UserRole,
    supervisor_id: "",
    branch_id: "none",
    shift_time: "08:00 - 20:00",
    shift_start_time: "08:00",
    shift_end_time: "20:00",
    street: "",
    monthly_salary: "",
    city: "",
    district: "",
    state: "",
    state_id: "",
    aadhaar_number: "",
    license_number: "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const handleFieldChange = (field: string, val: string) => {
    let formattedVal = val;
    if (field === "aadhaar_number") {
      formattedVal = formatAadhaar(val);
    } else if (field === "license_number") {
      formattedVal = val.toUpperCase();
    }

    setCreateForm((prev) => ({ ...prev, [field]: formattedVal }));

    // Real-time validation for 12 digits
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
    if (field === "aadhaar_number" && createForm.aadhaar_number.trim()) {
      const res = validateAadhaarNumber(createForm.aadhaar_number);
      if (!res.isValid) {
        setErrors((prev) => ({ ...prev, aadhaar_number: res.error || "Invalid Aadhaar number" }));
      }
    } else if (field === "license_number" && createForm.license_number.trim()) {
      const res = validateLicenseNumber(createForm.license_number);
      if (!res.isValid) {
        setErrors((prev) => ({ ...prev, license_number: res.error || "Invalid driving licence format" }));
      }
    }
  };

  const isOperator = createForm.role === "operator";

  // Section 1: Employee Identity & Login Credentials (Mandatory)
  const section1Complete = Boolean(
    createForm.full_name.trim().length >= 2 &&
    createForm.email.trim().includes("@") &&
    createForm.phone.replace(/\D/g, "").length >= 10 &&
    createForm.password.length >= 6
  );

  // Section 2: User Address & Operations (Mandatory)
  const section2Complete = Boolean(
    createForm.street.trim() &&
    createForm.city.trim() &&
    createForm.district.trim() &&
    (createForm.state.trim() || createForm.state_id) &&
    createForm.shift_start_time.trim() &&
    createForm.shift_end_time.trim()
  );

  // Section 3: Identity & Regulatory Documents (Optional)
  const section3Complete = Boolean(
    (!createForm.aadhaar_number.trim() || (createForm.aadhaar_number.replace(/\D/g, "").length === 12 && !errors.aadhaar_number)) &&
    (!createForm.license_number.trim() || !errors.license_number)
  );

  // Section 4: User Access Role & System Permissions (Mandatory)
  const section4Complete = Boolean(
    createForm.role &&
    (!isOperator || (createForm.monthly_salary && Number(createForm.monthly_salary) > 0 && !errors.monthly_salary))
  );

  const isAllMandatoryFilled =
    section1Complete &&
    section2Complete &&
    section3Complete &&
    section4Complete;

  const missingMandatoryCount =
    (section1Complete ? 0 : 1) +
    (section2Complete ? 0 : 1) +
    (section3Complete ? 0 : 1) +
    (section4Complete ? 0 : 1);

  const handleFormSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const newErrors: Record<string, string> = {};

    if (createForm.aadhaar_number.trim()) {
      const aadhaarRes = validateAadhaarNumber(createForm.aadhaar_number);
      if (!aadhaarRes.isValid) {
        newErrors.aadhaar_number = aadhaarRes.error || "Invalid Aadhaar number.";
      }
    }

    if (createForm.license_number.trim()) {
      const licRes = validateLicenseNumber(createForm.license_number);
      if (!licRes.isValid) {
        newErrors.license_number = licRes.error || "Invalid driving licence format.";
      }
    }

    if (createForm.role === "operator") {
      const sal = Number(createForm.monthly_salary);
      if (!createForm.monthly_salary || isNaN(sal) || sal <= 0) {
        newErrors.monthly_salary = "Monthly salary is mandatory for operator accounts and must be greater than 0.";
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
        onSubmit={handleFormSubmit}
        className="flex flex-col gap-4"
      >
        {/* Hidden inputs for custom select values */}
        <input type="hidden" name="branch_id" value={createForm.branch_id} />
        <input type="hidden" name="role" value={createForm.role} />
        <input type="hidden" name="supervisor_id" value={createForm.supervisor_id} />

        {/* Informational banner: Direct activation without approval request */}
        <div className="flex items-center gap-2.5 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-xs font-medium text-emerald-800 dark:text-emerald-300">
          <ShieldCheck className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
          <span>Accounts created via dashboard are activated immediately. Credentials will be emailed directly to the user without admin approval requests.</span>
        </div>

        {/* Section 1: User Identity & Login Credentials */}
        <FormSectionCard
          stepNumber={1}
          title="Employee Identity & Login Credentials"
          description="Basic personal details and login access"
          isMandatory={true}
          isCompleted={section1Complete}
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
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

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
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
        </FormSectionCard>

        {/* Section 2: User Address & Work Location */}
        <FormSectionCard
          stepNumber={2}
          title="User Address & Operations"
          description="Street + City/Town/Village + District + State and Shift schedule"
          isMandatory={true}
          isCompleted={section2Complete}
        >
          <UserAddressSection
            street={createForm.street}
            city={createForm.city}
            district={createForm.district}
            state={createForm.state}
            stateId={createForm.state_id}
            onChange={(field, val) => handleFieldChange(field, val)}
            required={true}
            idPrefix="create-user"
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-[var(--color-hairline)]">
            <Input
              label="Shift Start Time *"
              name="shift_start_time"
              type="time"
              value={createForm.shift_start_time}
              onChange={(e) => handleFieldChange("shift_start_time", e.target.value)}
              required
            />
            <Input
              label="Shift End Time *"
              name="shift_end_time"
              type="time"
              value={createForm.shift_end_time}
              onChange={(e) => handleFieldChange("shift_end_time", e.target.value)}
              required
            />
            <input type="hidden" name="shift_time" value={`${createForm.shift_start_time} - ${createForm.shift_end_time}`} />
          </div>
        </FormSectionCard>

        {/* Section 3: Identity & Regulatory Documents */}
        <FormSectionCard
          stepNumber={3}
          title="Identity & Regulatory Documents"
          description="Government identification records (Optional)"
          isMandatory={false}
          isCompleted={section3Complete}
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Input
              label="Aadhaar Card Number"
              name="aadhaar_number"
              icon={<AnimatedShieldCheck size={16} className="text-[var(--color-link)]" />}
              value={createForm.aadhaar_number}
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
              value={createForm.license_number}
              onChange={(e) => handleFieldChange("license_number", e.target.value)}
              onBlur={() => handleFieldBlur("license_number")}
              error={errors.license_number}
              maxLength={25}
              placeholder="e.g. MH12 20110012345"
            />
          </div>
        </FormSectionCard>

        {/* Section 4: User Access Role & System Permissions */}
        <FormSectionCard
          stepNumber={4}
          title="User Access Role & System Permissions"
          description="Platform role, supervisor oversight, and compensation"
          isMandatory={true}
          isCompleted={section4Complete}
        >
          {/* Custom Role Selector */}
          <SearchableSelect
            label="User Access Role *"
            options={roleOptions}
            value={createForm.role}
            onChange={(val) => setCreateForm((prev) => ({ ...prev, role: val as UserRole }))}
            placeholder="Select user role..."
            clearable={false}
          />

          {/* Conditional Supervisor Selector for Supervised Roles */}
          {isSupervisedRole(createForm.role) && (
            <div className="pt-2">
              <SearchableSelect
                label="Assign Supervisor"
                options={supervisors}
                value={createForm.supervisor_id}
                onChange={(val) => setCreateForm((prev) => ({ ...prev, supervisor_id: val }))}
                placeholder={supervisors.length > 0 ? "Search or select supervisor..." : "No active supervisors available"}
                clearable
              />
              <p className="mt-1.5 text-[11px] text-[var(--color-mute)]">
                Assign a designated supervisor to oversee shift duties, site allocations, and maintenance reports.
              </p>
            </div>
          )}

          {/* Conditional Monthly Salary for Operators */}
          {createForm.role === "operator" && (
            <div className="pt-2">
              <UserSalaryField
                value={createForm.monthly_salary}
                onChange={(val) => {
                  setCreateForm((prev) => ({ ...prev, monthly_salary: val }));
                  if (errors.monthly_salary) {
                    setErrors((prev) => {
                      const copy = { ...prev };
                      delete copy.monthly_salary;
                      return copy;
                    });
                  }
                }}
                role={createForm.role}
                error={errors.monthly_salary}
                id="create-user-salary"
              />
            </div>
          )}
        </FormSectionCard>

        {/* Form Action Controls */}
        <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-[var(--color-hairline)]">
          <Button
            type="button"
            variant="ghost-sm"
            onClick={onClose}
            className="h-9 px-4 text-xs font-medium rounded-sm border border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)] hover:bg-[var(--color-hairline-soft-surface)] text-[var(--color-ink)] cursor-pointer active:scale-[0.98] transition-all"
          >
            Cancel
          </Button>
          <div className="min-w-[180px]">
            <FormSubmitButton
              isReady={isAllMandatoryFilled}
              loading={loading}
              label="Create User Account"
              loadingLabel="Creating User Account..."
              missingCount={missingMandatoryCount}
              fullWidth={false}
              size="sm"
            />
          </div>
        </div>
      </form>
    </Modal>
  );
}
