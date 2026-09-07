"use client";

import { useState, useRef, useMemo } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  AnimatedMail,
  AnimatedUser,
  AnimatedPhone,
  AnimatedMapPin,
  AnimatedShieldCheck,
  AnimatedCreditCard,
} from "@/components/ui/animated-icons";
import {
  Button,
  Input,
  Alert,
  SearchableSelect,
  CustomTimePicker,
  ReachInternationalLogo,
  type SelectOption,
} from "@/components/ui";
import {
  validateAadhaarNumber,
  validateLicenseNumber,
  formatAadhaar,
  INDIAN_STATES,
  getStateById,
  computeShiftTiming,
  parseProfileShiftTime,
} from "@reachinternational/utils";
import { completeOnboardingAction, type OnboardingFormState } from "@/app/actions/onboarding";
import type { User } from "@/lib/types/database";

const onboardingRoleOptions: SelectOption[] = [
  { value: "service_engineer", label: "Service Engineer" },
  { value: "manager", label: "Manager" },
  { value: "service_manager", label: "Service Manager" },
  { value: "supervisor", label: "Supervisor" },
  { value: "store_manager", label: "Store Manager" },
  { value: "operator", label: "Operator" },
  { value: "mechanic", label: "Mechanic / Technician" },
  { value: "hr_manager", label: "HR Manager" },
];

const stateSelectOptions: SelectOption[] = INDIAN_STATES.map((s) => ({
  value: String(s.id),
  label: s.name,
}));

interface OnboardingClientProps {
  user: User;
}

export function OnboardingClient({ user }: OnboardingClientProps) {
  const router = useRouter();

  // Extract shift timings if already set on user
  const initialShifts = useMemo(() => {
    if (user.shift_time) {
      const parsed = parseProfileShiftTime(user.shift_time);
      if (parsed && parsed.startTime && parsed.endTime) {
        return { start: parsed.startTime, end: parsed.endTime };
      }
    }
    return { start: "08:00 AM", end: "08:00 PM" };
  }, [user.shift_time]);

  const [formValues, setFormValues] = useState({
    full_name: user.full_name && user.full_name !== user.email ? user.full_name : "",
    email: user.email || "",
    phone: user.phone || "",
    role: user.role || "service_engineer",
    shift_start_time: initialShifts.start,
    shift_end_time: initialShifts.end,
    city: user.city || "",
    district: user.district || "",
    state: user.state || "",
    state_id: user.state_id ? String(user.state_id) : "",
    address: user.address || "",
    aadhaar_number: user.aadhaar_number ? formatAadhaar(user.aadhaar_number) : "",
    license_number: user.license_number || "",
  });

  const [state, setState] = useState<OnboardingFormState>({});
  const [pending, setPending] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const isSubmittingRef = useRef(false);

  // Dynamic shift duration & classification computation
  const shiftTimingSummary = useMemo(() => {
    if (!formValues.shift_start_time || !formValues.shift_end_time) return null;
    return computeShiftTiming({
      startTime: formValues.shift_start_time,
      endTime: formValues.shift_end_time,
    });
  }, [formValues.shift_start_time, formValues.shift_end_time]);

  // Compute profile completeness percentage for visual progress indicator
  const progressPercent = useMemo(() => {
    let completed = 0;
    const total = 8;
    if (formValues.full_name.trim().length >= 2) completed++;
    if (formValues.phone.trim().replace(/\D/g, "").length >= 10) completed++;
    if (formValues.role) completed++;
    if (formValues.shift_start_time && formValues.shift_end_time) completed++;
    if (formValues.city.trim().length >= 2) completed++;
    if (formValues.district.trim().length >= 2) completed++;
    if (formValues.state.trim().length >= 2) completed++;
    if (formValues.aadhaar_number.trim().replace(/\D/g, "").length === 12) completed++;
    return Math.round((completed / total) * 100);
  }, [formValues]);

  const handleChange = (field: string, value: string) => {
    let formattedVal = value;
    if (field === "aadhaar_number") {
      formattedVal = formatAadhaar(value);
    } else if (field === "license_number") {
      formattedVal = value.toUpperCase();
    }

    if (field === "state_id") {
      const matchedState = getStateById(value);
      setFormValues((prev) => ({
        ...prev,
        state_id: value,
        state: matchedState ? matchedState.name : prev.state,
      }));
    } else {
      setFormValues((prev) => ({ ...prev, [field]: formattedVal }));
    }

    // Instant Aadhaar validation feedback
    if (field === "aadhaar_number") {
      const clean = formattedVal.replace(/\D/g, "");
      if (clean.length === 12) {
        const res = validateAadhaarNumber(clean);
        if (!res.isValid) {
          setFieldErrors((prev) => ({ ...prev, aadhaar_number: res.error || "Invalid Aadhaar number" }));
          return;
        }
      }
    }

    if (fieldErrors[field] || (field === "state_id" && fieldErrors.state)) {
      setFieldErrors((prev) => {
        const copy = { ...prev };
        delete copy[field];
        if (field === "state_id") delete copy.state;
        return copy;
      });
    }
  };

  const handleBlur = (field: string) => {
    if (field === "aadhaar_number" && formValues.aadhaar_number.trim()) {
      const res = validateAadhaarNumber(formValues.aadhaar_number);
      if (!res.isValid) {
        setFieldErrors((prev) => ({ ...prev, aadhaar_number: res.error || "Invalid Aadhaar number" }));
      }
    } else if (field === "license_number" && formValues.license_number.trim()) {
      const res = validateLicenseNumber(formValues.license_number);
      if (!res.isValid) {
        setFieldErrors((prev) => ({ ...prev, license_number: res.error || "Invalid driving licence format" }));
      }
    }
  };

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (isSubmittingRef.current || pending) return;

    // Client-side pre-flight checks
    const errors: Record<string, string> = {};
    if (!formValues.full_name.trim() || formValues.full_name.trim().length < 2) {
      errors.full_name = "Full name is required (minimum 2 characters).";
    }
    const cleanPhone = formValues.phone.replace(/\D/g, "");
    if (!cleanPhone || cleanPhone.length < 10) {
      errors.phone = "Valid 10-digit mobile phone number is required.";
    }
    if (!formValues.shift_start_time.trim()) {
      errors.shift_start_time = "Shift start time is required.";
    }
    if (!formValues.shift_end_time.trim()) {
      errors.shift_end_time = "Shift end time is required.";
    }
    if (!formValues.city.trim()) {
      errors.city = "City/Town is required.";
    }
    if (!formValues.district.trim()) {
      errors.district = "District is required.";
    }
    if (!formValues.state.trim() && !formValues.state_id) {
      errors.state = "State is required.";
    }
    if (!formValues.address.trim()) {
      errors.address = "Address (street / locality) is required.";
    }
    if (!formValues.aadhaar_number.trim()) {
      errors.aadhaar_number = "Aadhaar card number is required.";
    } else {
      const aadhaarRes = validateAadhaarNumber(formValues.aadhaar_number);
      if (!aadhaarRes.isValid) {
        errors.aadhaar_number = aadhaarRes.error || "Invalid Aadhaar number.";
      }
    }
    if (formValues.license_number.trim()) {
      const licRes = validateLicenseNumber(formValues.license_number);
      if (!licRes.isValid) {
        errors.license_number = licRes.error || "Invalid driving licence format.";
      }
    }

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }

    isSubmittingRef.current = true;
    setPending(true);
    setState({});
    setFieldErrors({});

    const formData = new FormData(e.currentTarget);
    try {
      const result = await completeOnboardingAction({}, formData);
      setState(result);

      if (result.fieldErrors) {
        setFieldErrors(result.fieldErrors);
        isSubmittingRef.current = false;
        setPending(false);
      } else if (result.success && result.redirectUrl) {
        router.replace(result.redirectUrl);
      } else {
        isSubmittingRef.current = false;
        setPending(false);
      }
    } catch (err: unknown) {
      isSubmittingRef.current = false;
      setPending(false);
      setState({ error: "An unexpected error occurred. Please try again." });
    }
  }

  return (
    <div className="min-h-screen min-h-[100dvh] w-full flex flex-col lg:flex-row bg-[var(--color-canvas)] text-[var(--color-ink)] lg:h-screen lg:max-h-screen lg:overflow-hidden select-none">
      {/* ============================================================
          Left: Visual & Industrial Fleet Showcase Panel (Desktop only)
          40% width, matching the signup layout identity
          ============================================================ */}
      <div className="relative hidden lg:flex flex-col justify-between h-full lg:w-[40%] p-8 xl:p-10 2xl:p-12 border-r border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)] overflow-hidden shrink-0">
        {/* Subtle radial atmosphere */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[440px] h-[440px] bg-[radial-gradient(circle_at_center,rgba(2,132,199,0.09)_0%,rgba(2,132,199,0.02)_50%,transparent_70%)] dark:bg-[radial-gradient(circle_at_center,rgba(14,165,233,0.12)_0%,rgba(14,165,233,0.03)_50%,transparent_70%)] rounded-full blur-3xl pointer-events-none" />

        {/* Top Header / Logo */}
        <div className="flex items-center justify-between z-10">
          <Link
            href="/"
            className="inline-flex items-center group focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 rounded-lg transition-transform hover:scale-[1.01]"
            aria-label="Reach International Home"
          >
            <ReachInternationalLogo variant="full" size={28} />
          </Link>
        </div>

        {/* Hero Central Content */}
        <div className="my-auto flex flex-col gap-6 xl:gap-8 max-w-md xl:max-w-lg z-10 py-4">
          <div className="flex flex-col gap-2">
            <span className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-sky-600 dark:text-sky-400 bg-sky-500/10 px-2.5 py-1 rounded-full border border-sky-500/20 w-fit">
              <span className="w-1.5 h-1.5 rounded-full bg-sky-500 animate-pulse" />
              Employee Onboarding
            </span>
            <h1 className="text-3xl sm:text-4xl xl:text-5xl font-bold tracking-tight text-[var(--color-ink)] leading-[1.1]">
              Complete your profile.
              <br />
              <span className="text-sky-600 dark:text-sky-400">
                Unlock your workspace.
              </span>
            </h1>
            <p className="text-sm text-[var(--color-mute)] leading-relaxed">
              Fill in your shift timings, operational site, and identity records once to activate full dashboard features.
            </p>
          </div>

          {/* Machine Showcase Stage */}
          <div className="relative pt-2 pb-1 flex items-center justify-center">
            <div className="absolute bottom-1 left-1/2 -translate-x-1/2 w-[90%] max-w-[360px] xl:max-w-[420px] h-6 bg-[radial-gradient(ellipse_at_center,rgba(0,0,0,0.18)_0%,rgba(0,0,0,0.04)_50%,transparent_70%)] dark:bg-[radial-gradient(ellipse_at_center,rgba(0,0,0,0.85)_0%,rgba(0,0,0,0.25)_50%,transparent_70%)] blur-[4px] pointer-events-none z-0" />
            <div className="relative z-10 w-full max-w-[340px] xl:max-w-[400px] 2xl:max-w-[440px] transition-transform duration-500 hover:scale-[1.02]">
              <Image
                src="/loginpageimage.png"
                alt="Reach International Aerial Boom Lift Fleet Equipment"
                width={800}
                height={533}
                priority
                className="w-full h-auto max-h-[30vh] xl:max-h-[34vh] object-contain drop-shadow-sm dark:drop-shadow-[0_12px_24px_rgba(0,0,0,0.6)] select-none pointer-events-none"
              />
            </div>
          </div>
        </div>

        {/* Minimal Bottom Info */}
        <div className="z-10 text-[11px] text-[var(--color-mute)] flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
          <span>One-time setup · Fast permanent verification</span>
        </div>
      </div>

      {/* ============================================================
          Right: Dedicated Onboarding Form Workspace (60% on desktop)
          Clean floating card, responsive single-focus view on mobile
          ============================================================ */}
      <div className="relative flex-1 lg:w-[60%] w-full min-h-screen lg:h-full flex flex-col justify-between items-center px-4 py-4 sm:px-6 sm:py-6 lg:px-8 lg:py-3.5 xl:px-10 xl:py-4 overflow-y-auto bg-[var(--color-canvas)]">
        <div className="hidden lg:block w-full h-1 shrink-0" />
        <div className="w-full flex items-center justify-center my-auto py-1 sm:py-1.5">
          <motion.div
            initial={{ opacity: 0, y: 8, scale: 0.99 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
            className="w-full max-w-xl lg:max-w-2xl bg-[var(--color-canvas-elevated)] rounded-2xl border border-[var(--color-hairline)] p-4 sm:p-5 lg:p-5.5 shadow-2xl text-[var(--color-ink)] relative overflow-hidden"
          >
            {/* Mobile Only: Top Header Logo */}
            <div className="flex lg:hidden flex-col items-center justify-center mb-2.5 sm:mb-3">
              <Link href="/" className="flex items-center group focus:outline-none" aria-label="Reach International">
                <ReachInternationalLogo variant="full" size={26} />
              </Link>
            </div>

            {/* Card Header & Setup Progress */}
            <div className="mb-3 sm:mb-3.5">
              <div className="flex items-center justify-between gap-2">
                <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-[var(--color-ink)]">
                  Complete Your Profile
                </h2>
                <span className="text-[11px] font-mono font-bold px-2 py-0.5 rounded-full border border-sky-500/25 bg-sky-500/10 text-sky-600 dark:text-sky-400">
                  {progressPercent}% Complete
                </span>
              </div>
              <p className="text-xs sm:text-[13px] text-[var(--color-mute)] mt-1">
                Please verify and complete the details below to unlock your workspace.
              </p>

              {/* Visual Progress Bar */}
              <div className="w-full h-1 bg-[var(--color-hairline)] rounded-full overflow-hidden mt-2.5">
                <motion.div
                  className="h-full bg-gradient-to-r from-sky-500 to-sky-600"
                  initial={{ width: 0 }}
                  animate={{ width: `${progressPercent}%` }}
                  transition={{ duration: 0.4 }}
                />
              </div>
            </div>

            {/* Global Error Banner */}
            {state.error && (
              <div className="mb-3">
                <Alert variant="error">{state.error}</Alert>
              </div>
            )}

            {/* Registration & Onboarding Form */}
            <form onSubmit={handleSubmit} className="flex flex-col gap-2.5 sm:gap-3">
              {/* Hidden Inputs for Shift Timing Serialization */}
              <input type="hidden" name="shift_start_time" value={formValues.shift_start_time} />
              <input type="hidden" name="shift_end_time" value={formValues.shift_end_time} />
              <input
                type="hidden"
                name="shift_time"
                value={
                  formValues.shift_start_time.trim() && formValues.shift_end_time.trim()
                    ? `${formValues.shift_start_time.trim()} - ${formValues.shift_end_time.trim()}`
                    : formValues.shift_start_time.trim() || formValues.shift_end_time.trim() || ""
                }
              />

              {/* Section 1: Account Information & Role */}
              <div className="rounded-xl border border-[var(--color-hairline)] bg-[var(--color-canvas)]/60 p-3 sm:p-3.5 space-y-2 sm:space-y-2.5">
                <div className="flex items-center justify-between pb-1.5 border-b border-[var(--color-hairline)]">
                  <div className="flex items-center gap-1.5 sm:gap-2">
                    <span className="flex items-center justify-center w-5 h-5 rounded-md bg-sky-500/10 text-sky-600 dark:text-sky-400 text-[10px] font-bold">1</span>
                    <h3 className="text-[11px] sm:text-xs font-bold uppercase tracking-wider text-[var(--color-ink)]">
                      Account & Role
                    </h3>
                  </div>
                </div>

                {/* Row 1: Full Name | Verified Email */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-2.5">
                  <Input
                    id="onboarding-full-name"
                    name="full_name"
                    label="Full Name"
                    type="text"
                    value={formValues.full_name}
                    onChange={(e) => handleChange("full_name", e.target.value)}
                    placeholder="Rahul Sharma"
                    required
                    autoComplete="name"
                    error={fieldErrors.full_name}
                    icon={<AnimatedUser size={15} />}
                  />

                  <div className="flex flex-col gap-1 w-full">
                    <div className="flex items-center justify-between">
                      <label className="text-[12px] sm:text-[13px] font-medium text-[var(--color-ink)] select-none">
                        Email Address
                      </label>
                      <span className="text-[10px] font-bold font-mono text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-1.5 py-0.2 rounded border border-emerald-500/20">
                        ✓ Verified
                      </span>
                    </div>
                    <input
                      id="onboarding-email"
                      name="email"
                      type="email"
                      value={formValues.email}
                      readOnly
                      disabled
                      className="w-full h-9.5 sm:h-10 px-3 rounded-xl border border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)]/50 text-[var(--color-mute)] cursor-not-allowed text-xs sm:text-[13px]"
                    />
                  </div>
                </div>

                {/* Row 2: Mobile Number | Role */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-2.5">
                  <Input
                    id="onboarding-phone"
                    name="phone"
                    label="Mobile Number"
                    type="tel"
                    value={formValues.phone}
                    onChange={(e) => handleChange("phone", e.target.value)}
                    placeholder="+91 98765 43210"
                    required
                    autoComplete="tel"
                    error={fieldErrors.phone}
                    icon={<AnimatedPhone size={15} />}
                  />

                  {/* Account Role Dropdown */}
                  <div className="flex flex-col gap-1 w-full">
                    <label className="text-[12px] sm:text-[13px] font-medium text-[var(--color-ink)] select-none">
                      Assigned Role <span className="text-rose-500 font-semibold">*</span>
                    </label>
                    <input type="hidden" name="role" value={formValues.role} />
                    <SearchableSelect
                      options={onboardingRoleOptions}
                      value={formValues.role}
                      onChange={(val) => handleChange("role", val)}
                      placeholder="Select role..."
                      clearable={false}
                      error={fieldErrors.role}
                      className="w-full text-xs sm:text-[13px]"
                    />
                  </div>
                </div>
              </div>

              {/* Section 2: Work Shift Schedule */}
              <div className="rounded-xl border border-[var(--color-hairline)] bg-[var(--color-canvas)]/60 p-3 sm:p-3.5 space-y-2 sm:space-y-2.5">
                <div className="flex items-center justify-between pb-1.5 border-b border-[var(--color-hairline)]">
                  <div className="flex items-center gap-1.5 sm:gap-2">
                    <span className="flex items-center justify-center w-5 h-5 rounded-md bg-sky-500/10 text-sky-600 dark:text-sky-400 text-[10px] font-bold">2</span>
                    <h3 className="text-[11px] sm:text-xs font-bold uppercase tracking-wider text-[var(--color-ink)]">
                      Work Shift Schedule
                    </h3>
                  </div>
                  {shiftTimingSummary?.isValid && (
                    <span className="inline-flex items-center gap-1 text-[10px] font-semibold font-mono text-sky-600 dark:text-sky-400 bg-sky-500/10 px-2 py-0.5 rounded-md border border-sky-500/20">
                      {shiftTimingSummary.isOvernight ? "🌙 Overnight" : "☀️ Standard"} · {shiftTimingSummary.durationFormatted}
                    </span>
                  )}
                </div>

                {/* Shift Start Time | Shift End Time */}
                <div className="grid grid-cols-2 gap-2 sm:gap-2.5">
                  <CustomTimePicker
                    label="Shift Start Time"
                    value={formValues.shift_start_time}
                    onChange={(val) => handleChange("shift_start_time", val)}
                    placeholder="08:00 AM"
                    required
                    hideIcon
                    error={fieldErrors.shift_start_time}
                  />
                  <CustomTimePicker
                    label="Shift End Time"
                    value={formValues.shift_end_time}
                    onChange={(val) => handleChange("shift_end_time", val)}
                    placeholder="08:00 PM"
                    required
                    hideIcon
                    error={fieldErrors.shift_end_time}
                  />
                </div>
              </div>

              {/* Section 3: Work Location & Address */}
              <div className="rounded-xl border border-[var(--color-hairline)] bg-[var(--color-canvas)]/60 p-3 sm:p-3.5 space-y-2 sm:space-y-2.5">
                <div className="flex items-center justify-between pb-1.5 border-b border-[var(--color-hairline)]">
                  <div className="flex items-center gap-1.5 sm:gap-2">
                    <span className="flex items-center justify-center w-5 h-5 rounded-md bg-sky-500/10 text-sky-600 dark:text-sky-400 text-[10px] font-bold">3</span>
                    <h3 className="text-[11px] sm:text-xs font-bold uppercase tracking-wider text-[var(--color-ink)]">
                      Work Location & Address
                    </h3>
                  </div>
                </div>

                {/* City/Town/Village | District | State (3-Column layout) */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 sm:gap-2.5">
                  <Input
                    id="onboarding-city"
                    name="city"
                    label="City/Town/Village"
                    type="text"
                    value={formValues.city}
                    onChange={(e) => handleChange("city", e.target.value)}
                    placeholder="Pune"
                    required
                    autoComplete="address-level2"
                    error={fieldErrors.city}
                    icon={<AnimatedMapPin size={15} />}
                  />

                  <Input
                    id="onboarding-district"
                    name="district"
                    label="District"
                    type="text"
                    value={formValues.district}
                    onChange={(e) => handleChange("district", e.target.value)}
                    placeholder="Pune"
                    required
                    autoComplete="address-level2"
                    error={fieldErrors.district}
                    icon={<AnimatedMapPin size={15} />}
                  />

                  {/* State Dropdown Selector */}
                  <div className="flex flex-col gap-1 w-full" id="onboarding-state-container">
                    <label className="text-[12px] sm:text-[13px] font-medium text-[var(--color-ink)] select-none">
                      State <span className="text-rose-500 font-semibold">*</span>
                    </label>
                    <input type="hidden" name="state" value={formValues.state} />
                    <input type="hidden" name="state_id" value={formValues.state_id} />
                    <SearchableSelect
                      options={stateSelectOptions}
                      value={formValues.state_id}
                      onChange={(val, opt) => {
                        setFormValues((prev) => ({
                          ...prev,
                          state_id: val,
                          state: opt?.label || prev.state,
                        }));
                        if (fieldErrors.state) {
                          setFieldErrors((prev) => {
                            const copy = { ...prev };
                            delete copy.state;
                            return copy;
                          });
                        }
                      }}
                      placeholder="Select state..."
                      clearable={false}
                      error={fieldErrors.state}
                      className="w-full text-xs sm:text-[13px]"
                    />
                  </div>
                </div>

                {/* Street / Building Address */}
                <Input
                  id="onboarding-address"
                  name="address"
                  label="Street / Site Base Address"
                  type="text"
                  value={formValues.address}
                  onChange={(e) => handleChange("address", e.target.value)}
                  placeholder="Plot No. 42, MIDC Industrial Area, Chakan"
                  required
                  error={fieldErrors.address}
                  icon={<AnimatedMapPin size={15} />}
                />
              </div>

              {/* Section 4: Identity Verification */}
              <div className="rounded-xl border border-[var(--color-hairline)] bg-[var(--color-canvas)]/60 p-3 sm:p-3.5 space-y-2 sm:space-y-2.5">
                <div className="flex items-center justify-between pb-1.5 border-b border-[var(--color-hairline)]">
                  <div className="flex items-center gap-1.5 sm:gap-2">
                    <span className="flex items-center justify-center w-5 h-5 rounded-md bg-sky-500/10 text-sky-600 dark:text-sky-400 text-[10px] font-bold">4</span>
                    <h3 className="text-[11px] sm:text-xs font-bold uppercase tracking-wider text-[var(--color-ink)]">
                      Identity & Verification
                    </h3>
                  </div>
                </div>

                {/* Aadhaar Card Number | Driving Licence Number */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-2.5">
                  <Input
                    id="onboarding-aadhaar"
                    name="aadhaar_number"
                    label="Aadhaar Card Number"
                    type="text"
                    value={formValues.aadhaar_number}
                    onChange={(e) => handleChange("aadhaar_number", e.target.value)}
                    onBlur={() => handleBlur("aadhaar_number")}
                    placeholder="12-digit Aadhaar Number"
                    maxLength={14}
                    required
                    error={fieldErrors.aadhaar_number}
                    icon={<AnimatedShieldCheck size={15} />}
                  />

                  <Input
                    id="onboarding-license"
                    name="license_number"
                    label={
                      <span>
                        Driving Licence Number <span className="text-[11px] font-normal text-[var(--color-mute)]">(Optional)</span>
                      </span>
                    }
                    type="text"
                    value={formValues.license_number}
                    onChange={(e) => handleChange("license_number", e.target.value)}
                    onBlur={() => handleBlur("license_number")}
                    placeholder="e.g. MH12 20110012345"
                    maxLength={25}
                    error={fieldErrors.license_number}
                    icon={<AnimatedCreditCard size={15} />}
                  />
                </div>
              </div>

              {/* Submit CTA Button */}
              <div className="pt-2">
                <Button
                  type="submit"
                  variant="primary"
                  size="lg"
                  loading={pending}
                  disabled={pending}
                  className="w-full h-10 sm:h-11 text-xs sm:text-sm font-semibold shadow-md"
                >
                  {pending ? "Saving Profile & Directing to Dashboard..." : "Complete Profile & Enter Dashboard"}
                </Button>
              </div>
            </form>
          </motion.div>
        </div>
        <div className="hidden lg:block w-full h-1 shrink-0" />
      </div>
    </div>
  );
}
