"use client";

import { useState, useTransition, useEffect } from "react";
import {
  Modal,
  Button,
  useToast,
  Input,
  CustomTimePicker,
} from "@/components/ui";
import {
  AnimatedAlertTriangle,
} from "@/components/ui/animated-icons";
import { CheckCircle2, AlertCircle } from "lucide-react";
import { updateMyProfile } from "@/app/actions/profile";
import { validateAadhaarNumber, validateLicenseNumber } from "@reachinternational/utils";
import type { User as UserType } from "@/lib/types/database";

interface EditProfileModalProps {
  user: UserType;
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

const INDIAN_STATES = [
  { id: 24, name: "Gujarat" },
  { id: 27, name: "Maharashtra" },
  { id: 23, name: "Madhya Pradesh" },
  { id: 8, name: "Rajasthan" },
  { id: 9, name: "Uttar Pradesh" },
  { id: 10, name: "Bihar" },
  { id: 18, name: "Assam" },
  { id: 19, name: "West Bengal" },
  { id: 7, name: "Delhi" },
  { id: 6, name: "Haryana" },
  { id: 3, name: "Punjab" },
  { id: 29, name: "Karnataka" },
  { id: 33, name: "Tamil Nadu" },
  { id: 36, name: "Telangana" },
  { id: 28, name: "Andhra Pradesh" },
  { id: 32, name: "Kerala" },
  { id: 21, name: "Odisha" },
  { id: 20, name: "Jharkhand" },
  { id: 22, name: "Chhattisgarh" },
  { id: 30, name: "Goa" },
  { id: 5, name: "Uttarakhand" },
  { id: 2, name: "Himachal Pradesh" },
  { id: 1, name: "Jammu and Kashmir" },
  { id: 38, name: "Dadra and Nagar Haveli and Daman and Diu" },
];

function parseShiftTimes(shiftStr?: string | null): { start: string; end: string } {
  if (!shiftStr) {
    return { start: "08:00 AM", end: "08:00 PM" };
  }
  const matches = shiftStr.match(/\b(\d{1,2}:\d{2}(?:\s*(?:AM|PM|am|pm))?)\b/g);
  if (matches && matches.length >= 2) {
    const normalize = (t: string) => {
      const match = t.trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)?$/i);
      if (match) {
        const h = parseInt(match[1], 10);
        const formattedH = h >= 1 && h <= 12 ? String(h).padStart(2, "0") : String(h % 12 || 12).padStart(2, "0");
        const formattedM = match[2];
        const period = (match[3] || (h >= 12 ? "PM" : "AM")).toUpperCase();
        return `${formattedH}:${formattedM} ${period}`;
      }
      return t.trim();
    };
    return { start: normalize(matches[0]), end: normalize(matches[1]) };
  }
  return { start: "08:00 AM", end: "08:00 PM" };
}

export function EditProfileModal({
  user,
  isOpen,
  onClose,
  onSuccess,
}: EditProfileModalProps) {
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();

  const [fullName, setFullName] = useState(user.full_name || "");
  const [phone, setPhone] = useState(user.phone || "");

  const initialTimes = parseShiftTimes(user.shift_time);
  const [startTime, setStartTime] = useState(initialTimes.start);
  const [endTime, setEndTime] = useState(initialTimes.end);

  const [address, setAddress] = useState(user.address || "");
  const [city, setCity] = useState(user.city || "");
  const [district, setDistrict] = useState(user.district || "");
  const [stateName, setStateName] = useState(user.state || "Maharashtra");
  const [stateId, setStateId] = useState<number | undefined>(user.state_id || 27);
  const [aadhaarNumber, setAadhaarNumber] = useState(user.aadhaar_number || "");
  const [licenseNumber, setLicenseNumber] = useState(user.license_number || "");

  const [aadhaarError, setAadhaarError] = useState<string | null>(null);
  const [licenseError, setLicenseError] = useState<string | null>(null);

  // Sync state when modal opens or user prop updates
  useEffect(() => {
    if (isOpen) {
      setFullName(user.full_name || "");
      setPhone(user.phone || "");
      const times = parseShiftTimes(user.shift_time);
      setStartTime(times.start);
      setEndTime(times.end);
      setAddress(user.address || "");
      setCity(user.city || "");
      setDistrict(user.district || "");
      setStateName(user.state || "Maharashtra");
      setStateId(user.state_id || 27);
      setAadhaarNumber(user.aadhaar_number || "");
      setLicenseNumber(user.license_number || "");
      setAadhaarError(null);
      setLicenseError(null);
    }
  }, [isOpen, user]);

  const handleStateChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const selectedName = e.target.value;
    setStateName(selectedName);
    const matched = INDIAN_STATES.find((s) => s.name.toLowerCase() === selectedName.toLowerCase());
    if (matched) {
      setStateId(matched.id);
    }
  };

  const handleAadhaarChange = (val: string) => {
    setAadhaarNumber(val);
    if (!val.trim()) {
      setAadhaarError(null);
      return;
    }
    const res = validateAadhaarNumber(val);
    if (!res.isValid) {
      setAadhaarError(res.error || "Invalid Aadhaar format");
    } else {
      setAadhaarError(null);
    }
  };

  const handleLicenseChange = (val: string) => {
    const upper = val.toUpperCase();
    setLicenseNumber(upper);
    if (!upper.trim()) {
      setLicenseError(null);
      return;
    }
    const res = validateLicenseNumber(upper);
    if (!res.isValid) {
      setLicenseError(res.error || "Invalid licence format");
    } else {
      setLicenseError(null);
    }
  };

  const isSuperAdmin = user.role === "super_admin";
  const approverHierarchyLabel =
    user.role === "admin"
      ? "Super Administrator"
      : ["manager", "service_manager", "hr_manager", "store_manager"].includes(user.role)
      ? "Administrator"
      : "Manager / Administrator";

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!fullName.trim()) {
      toast("error", "Full name is required.");
      return;
    }

    const digitsOnly = phone.replace(/\D/g, "");
    if (digitsOnly.length < 10) {
      toast("error", "Please enter a valid 10-digit mobile number.");
      return;
    }

    if (aadhaarNumber.trim()) {
      const aRes = validateAadhaarNumber(aadhaarNumber);
      if (!aRes.isValid) {
        toast("error", aRes.error || "Invalid Aadhaar number.");
        return;
      }
    }

    if (licenseNumber.trim()) {
      const lRes = validateLicenseNumber(licenseNumber);
      if (!lRes.isValid) {
        toast("error", lRes.error || "Invalid driving licence number.");
        return;
      }
    }

    const finalShift =
      startTime.trim() && endTime.trim()
        ? `${startTime.trim()} - ${endTime.trim()}`
        : startTime.trim() || endTime.trim() || "";

    startTransition(async () => {
      const formData = new FormData();
      formData.set("full_name", fullName.trim());
      formData.set("phone", phone.trim());
      formData.set("shift_time", finalShift);
      formData.set("address", address.trim());
      formData.set("city", city.trim() || "Mumbai");
      formData.set("district", district.trim() || "Mumbai");
      formData.set("state", stateName.trim() || "Maharashtra");
      if (stateId) formData.set("state_id", String(stateId));
      formData.set("aadhaar_number", aadhaarNumber.trim());
      formData.set("license_number", licenseNumber.trim());

      const res = await updateMyProfile(formData);

      if (res.error) {
        toast("error", res.error);
        return;
      }

      if (res.instant) {
        toast("success", res.message || "Profile updated successfully!");
      } else {
        toast("info", res.message || "Profile change request submitted for approval.");
      }

      onSuccess?.();
      onClose();
    });
  };

  return (
    <Modal
      open={isOpen}
      onClose={onClose}
      title="Edit Profile"
      description={
        isSuperAdmin
          ? "Update your personal details, shift timings, and official identity documents."
          : `Submit profile changes for authorization by your ${approverHierarchyLabel}.`
      }
      size="lg"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Notice Card explaining approval hierarchy */}
        <div
          className={`p-3.5 rounded-xl border flex items-start gap-3 text-xs leading-relaxed ${
            isSuperAdmin
              ? "bg-emerald-500/10 border-emerald-500/25 text-emerald-900 dark:text-emerald-300"
              : "bg-sky-500/10 border-sky-500/25 text-sky-900 dark:text-sky-300"
          }`}
        >
          {isSuperAdmin ? (
            <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400 mt-0.5" />
          ) : (
            <AlertCircle className="h-4 w-4 shrink-0 text-sky-600 dark:text-sky-400 mt-0.5" />
          )}
          <div>
            <span className="font-bold">
              {isSuperAdmin ? "Direct Update Access" : "Administrative Approval Required"}
            </span>
            <p className="mt-0.5 opacity-90">
              {isSuperAdmin
                ? "As a Super Admin, your modifications apply instantly to the database."
                : `Your requested changes will be routed directly to your ${approverHierarchyLabel} for review before updating your active profile.`}
            </p>
          </div>
        </div>

        {/* Section 1: Personal Details */}
        <div className="space-y-3 pt-1">
          <h4 className="text-[11px] font-bold uppercase tracking-wider text-[var(--color-mute)]">
            1. Personal Details
          </h4>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-[var(--color-ink)] mb-1">
                Full Name <span className="text-rose-500">*</span>
              </label>
              <Input
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="e.g. Rahul Sharma"
                required
                className="h-10"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[var(--color-ink)] mb-1">
                Mobile Number <span className="text-rose-500">*</span>
              </label>
              <Input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="e.g. 9876543210"
                required
                maxLength={15}
                className="h-10 font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[var(--color-ink)] mb-1">
                Aadhaar Card Number
              </label>
              <Input
                value={aadhaarNumber}
                onChange={(e) => handleAadhaarChange(e.target.value)}
                placeholder="12-digit Aadhaar Number"
                maxLength={14}
                className={`h-10 font-mono ${
                  aadhaarError ? "border-rose-500 focus:ring-rose-500/30" : ""
                }`}
              />
              {aadhaarError && (
                <p className="text-[11px] text-rose-500 font-medium mt-1 flex items-center gap-1">
                  <AnimatedAlertTriangle size={12} />
                  {aadhaarError}
                </p>
              )}
            </div>

            <div>
              <label className="block text-xs font-semibold text-[var(--color-ink)] mb-1">
                Driving Licence Number
              </label>
              <Input
                value={licenseNumber}
                onChange={(e) => handleLicenseChange(e.target.value)}
                placeholder="e.g. MH12 20110012345"
                maxLength={25}
                className={`h-10 font-mono uppercase ${
                  licenseError ? "border-rose-500 focus:ring-rose-500/30" : ""
                }`}
              />
              {licenseError && (
                <p className="text-[11px] text-rose-500 font-medium mt-1 flex items-center gap-1">
                  <AnimatedAlertTriangle size={12} />
                  {licenseError}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Section 2: Shift Timing */}
        <div className="space-y-3 pt-2 border-t border-[var(--color-hairline)]">
          <h4 className="text-[11px] font-bold uppercase tracking-wider text-[var(--color-mute)]">
            2. Shift Timing
          </h4>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <CustomTimePicker
              label="Shift Start Time"
              value={startTime}
              onChange={setStartTime}
              placeholder="08:00 AM"
            />
            <CustomTimePicker
              label="Shift End Time"
              value={endTime}
              onChange={setEndTime}
              placeholder="08:00 PM"
            />
          </div>
        </div>

        {/* Section 3: Address */}
        <div className="space-y-3 pt-2 border-t border-[var(--color-hairline)]">
          <h4 className="text-[11px] font-bold uppercase tracking-wider text-[var(--color-mute)]">
            3. Address
          </h4>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-semibold text-[var(--color-ink)] mb-1">
                State / UT
              </label>
              <select
                value={stateName}
                onChange={handleStateChange}
                className="w-full h-10 px-3 rounded-lg border border-[var(--color-hairline)] bg-[var(--color-canvas)] text-xs font-medium text-[var(--color-ink)] focus:outline-none focus:ring-2 focus:ring-sky-500/30 cursor-pointer"
              >
                {INDIAN_STATES.map((st) => (
                  <option key={st.id} value={st.name}>
                    {st.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[var(--color-ink)] mb-1">
                District
              </label>
              <Input
                value={district}
                onChange={(e) => setDistrict(e.target.value)}
                placeholder="e.g. Thane"
                className="h-10"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[var(--color-ink)] mb-1">
                City / Town
              </label>
              <Input
                value={city}
                onChange={(e) => setCity(e.target.value)}
                placeholder="e.g. Navi Mumbai"
                className="h-10"
              />
            </div>
          </div>
        </div>

        {/* Modal Footer Actions */}
        <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-[var(--color-hairline)]">
          <Button
            type="button"
            variant="ghost"
            onClick={onClose}
            disabled={isPending}
            className="h-10 px-4 text-xs font-semibold"
          >
            Cancel
          </Button>
          <Button
            type="submit"
            variant="primary"
            loading={isPending}
            className="h-10 px-5 text-xs font-bold shadow-sm"
          >
            {isSuperAdmin ? "Save Changes Directly" : "Submit for Approval"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
