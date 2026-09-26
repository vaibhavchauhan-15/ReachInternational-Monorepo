"use client";

import { useState, useEffect } from "react";
import { getUserDetailAction } from "@/app/actions/users";
import {
  AnimatedUser,
  AnimatedPhone,
  AnimatedShieldCheck,
  AnimatedCreditCard,
  AnimatedClock,
  AnimatedMapPin,
} from "@/components/ui/animated-icons";
import { ShieldAlert, ShieldCheck, Activity, Users } from "lucide-react";
import { Modal, Input, SearchableSelect, Button } from "@/components/ui";
import type { SelectOption } from "@/components/ui/SearchableSelect";
import type { User, UserRole } from "@/lib/types/database";
import type { Branch } from "@/lib/queries/branches";
import {
  validateAadhaarNumber,
  validateLicenseNumber,
  formatAadhaar,
  getStateById,
  getStateByName,
} from "@reachinternational/utils";
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

interface UserEditModalProps {
  user: User;
  branches?: Branch[];
  isSuperAdmin?: boolean;
  onClose: () => void;
  loading: boolean;
  onSubmit: (formData: FormData) => void;
  supervisors?: SelectOption[];
  workingLocations?: SelectOption[];
}

export function UserEditModal({
  user,
  isSuperAdmin = false,
  onClose,
  loading,
  onSubmit,
  supervisors = [],
  workingLocations: _workingLocations = [],
}: UserEditModalProps) {
  const matchedState = user.state_id
    ? getStateById(user.state_id)
    : user.state
    ? getStateByName(user.state)
    : undefined;

  const [editForm, setEditForm] = useState({
    full_name: user.full_name,
    phone: user.phone || "+91 ",
    role: user.role,
    supervisor_id: user.supervisor_id || user.supervisor?.id || "",
    shift_time: user.shift_time || "",
    shift_start_time: user.shift_start_time || "08:00",
    shift_end_time: user.shift_end_time || "20:00",
    street: user.street || user.address || "",
    monthly_salary: user.monthly_salary ? String(user.monthly_salary) : "",
    city: user.city || "",
    district: user.district || "",
    state: matchedState ? matchedState.name : user.state || "",
    state_id: matchedState ? String(matchedState.id) : user.state_id ? String(user.state_id) : "",
    aadhaar_number: user.aadhaar_number ? formatAadhaar(user.aadhaar_number) : "",
    license_number: user.license_number || "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (user?.id) {
      getUserDetailAction(user.id).then((res) => {
        if (res.user) {
          setEditForm((prev) => ({
            ...prev,
            street: prev.street || res.user?.street || res.user?.address || "",
            monthly_salary: prev.monthly_salary || (res.user?.monthly_salary ? String(res.user.monthly_salary) : ""),
            shift_start_time: prev.shift_start_time || res.user?.shift_start_time || "08:00",
            shift_end_time: prev.shift_end_time || res.user?.shift_end_time || "20:00",
            aadhaar_number: prev.aadhaar_number || (res.user?.aadhaar_number ? formatAadhaar(res.user.aadhaar_number) : ""),
            license_number: prev.license_number || res.user?.license_number || "",
          }));
        }
      }).catch(() => {});
    }
  }, [user?.id]);

  const handleFieldChange = (field: string, val: string) => {
    let formattedVal = val;
    if (field === "aadhaar_number") {
      formattedVal = formatAadhaar(val);
    } else if (field === "license_number") {
      formattedVal = val.toUpperCase();
    }

    if (field === "state_id") {
      const st = getStateById(val);
      setEditForm((prev) => ({
        ...prev,
        state_id: val,
        state: st ? st.name : prev.state,
      }));
    } else {
      setEditForm((prev) => ({ ...prev, [field]: formattedVal }));
    }

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

    if (errors[field] || (field === "state_id" && errors.state)) {
      setErrors((prev) => {
        const copy = { ...prev };
        delete copy[field];
        if (field === "state_id") delete copy.state;
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

    if (!editForm.state.trim() && !editForm.state_id) {
      newErrors.state = "State is required.";
    }

    if (editForm.role === "operator") {
      const sal = Number(editForm.monthly_salary);
      if (!editForm.monthly_salary || isNaN(sal) || sal <= 0) {
        newErrors.monthly_salary = "Monthly salary is mandatory for operator accounts and must be greater than 0.";
      }
    }

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

  // Real-time completeness check
  const section1Complete = Boolean(
    editForm.full_name.trim().length > 0 &&
    editForm.phone.trim().length >= 10
  );

  const section2Complete = Boolean(
    editForm.city.trim().length > 0 &&
    editForm.district.trim().length > 0 &&
    (editForm.state.trim().length > 0 || editForm.state_id.trim().length > 0)
  );

  const section3Complete = Boolean(
    editForm.aadhaar_number.trim().length > 0 ||
    editForm.license_number.trim().length > 0
  );

  const section4Complete = Boolean(
    editForm.role &&
    (editForm.role !== "operator" || (editForm.monthly_salary && Number(editForm.monthly_salary) > 0))
  );

  const isAllMandatoryFilled = Boolean(section1Complete && section2Complete && section4Complete);

  const missingFields: string[] = [];
  if (!editForm.full_name.trim()) missingFields.push("Full Name");
  if (!editForm.phone.trim() || editForm.phone.trim().length < 10) missingFields.push("Valid Phone");
  if (!editForm.city.trim()) missingFields.push("City/Town/Village");
  if (!editForm.district.trim()) missingFields.push("District");
  if (!editForm.state.trim() && !editForm.state_id.trim()) missingFields.push("State");
  if (editForm.role === "operator" && (!editForm.monthly_salary || Number(editForm.monthly_salary) <= 0)) {
    missingFields.push("Monthly Salary");
  }
  const missingMandatoryCount = missingFields.length;

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
        <input type="hidden" name="supervisor_id" value={editForm.supervisor_id} />
        <input type="hidden" name="state" value={editForm.state} />
        <input type="hidden" name="state_id" value={editForm.state_id} />

        {/* Section 1: User Identity */}
        <FormSectionCard
          stepNumber={1}
          title="Contact & Identity Info"
          description="Employee full legal name and active communication phone number."
          icon={<AnimatedUser size={16} className="text-sky-600 dark:text-sky-400 shrink-0" />}
          isMandatory={true}
          isCompleted={section1Complete}
        >
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
        </FormSectionCard>

        {/* Section 2: User Address & Work Location */}
        <FormSectionCard
          stepNumber={2}
          title="Address & Shift Schedule"
          description="Operational deployment address and daily work shift timing."
          icon={<AnimatedMapPin size={16} className="text-sky-600 dark:text-sky-400 shrink-0" />}
          isMandatory={true}
          isCompleted={section2Complete}
        >
          {/* Shift Schedule */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pb-2 border-b border-[var(--color-hairline)]">
            <Input
              label="Shift Start Time"
              name="shift_start_time"
              type="time"
              value={editForm.shift_start_time}
              onChange={(e) => setEditForm((prev) => ({ ...prev, shift_start_time: e.target.value }))}
            />
            <Input
              label="Shift End Time"
              name="shift_end_time"
              type="time"
              value={editForm.shift_end_time}
              onChange={(e) => setEditForm((prev) => ({ ...prev, shift_end_time: e.target.value }))}
            />
            <input type="hidden" name="shift_time" value={`${editForm.shift_start_time} - ${editForm.shift_end_time}`} />
          </div>

          {/* Canonical User Address Component */}
          <UserAddressSection
            street={editForm.street}
            city={editForm.city}
            district={editForm.district}
            state={editForm.state}
            stateId={editForm.state_id}
            onChange={(field, val) => handleFieldChange(field, val)}
            required={true}
            idPrefix="edit-user"
            errors={{
              state: errors.state,
              city: errors.city,
              district: errors.district,
            }}
          />
        </FormSectionCard>

        {/* Section 3: Identity & Regulatory Documents */}
        <FormSectionCard
          stepNumber={3}
          title="Identity & Regulatory Documents"
          description="Government-issued compliance identifiers for payroll and field operations."
          icon={<AnimatedShieldCheck size={16} className="text-sky-600 dark:text-sky-400 shrink-0" />}
          isMandatory={false}
          isCompleted={section3Complete}
        >
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
        </FormSectionCard>

        {/* Section 4: Role & Access Control */}
        <FormSectionCard
          stepNumber={4}
          title="System Access & Compensation"
          description="Role-based permissions, supervisory hierarchy, and salary configuration."
          icon={<AnimatedCreditCard size={16} className="text-sky-600 dark:text-sky-400 shrink-0" />}
          isMandatory={true}
          isCompleted={section4Complete}
        >
          <SearchableSelect
            label="User Access Role *"
            options={roleOptions}
            value={editForm.role}
            onChange={(val) => setEditForm((prev) => ({ ...prev, role: val as UserRole }))}
            placeholder="Select access role..."
            clearable={false}
          />

          {/* Conditional Supervisor Selector for Supervised Roles */}
          {isSupervisedRole(editForm.role) && (
            <div className="pt-2">
              <SearchableSelect
                label="Assigned Supervisor"
                options={supervisors}
                value={editForm.supervisor_id}
                onChange={(val) => setEditForm((prev) => ({ ...prev, supervisor_id: val }))}
                placeholder={supervisors.length > 0 ? "Search or select supervisor..." : "No active supervisors available"}
                clearable
              />
              <p className="mt-1.5 text-[11px] text-[var(--color-mute)]">
                Assign or change the supervisor supervising this user.
              </p>
            </div>
          )}

          {/* Conditional Monthly Salary for Operators */}
          {editForm.role === "operator" && (
            <div className="pt-2">
              <UserSalaryField
                value={editForm.monthly_salary}
                onChange={(val) => {
                  setEditForm((prev) => ({ ...prev, monthly_salary: val }));
                  if (errors.monthly_salary) {
                    setErrors((prev) => {
                      const copy = { ...prev };
                      delete copy.monthly_salary;
                      return copy;
                    });
                  }
                }}
                role={editForm.role}
                error={errors.monthly_salary}
                id="edit-user-salary"
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
              label="Save Account Changes"
              loadingLabel="Saving Changes..."
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
