"use client";

import { useState, useRef, useMemo } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Upload, FileText, X } from "lucide-react";
import { validateDocumentFile, DEFAULT_ALLOWED_DOCUMENT_MIME_TYPES } from "@/lib/upload";
import {
  AnimatedUser,
  AnimatedPhone,
  AnimatedShieldCheck,
  AnimatedCreditCard,
} from "@/components/ui/animated-icons";
import {
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
  computeShiftTiming,
  parseProfileShiftTime,
} from "@reachinternational/utils";
import { completeOnboardingAction, type OnboardingFormState } from "@/app/actions/onboarding";
import type { User } from "@/lib/types/database";
import {
  FormSectionCard,
  UserAddressSection,
  UserSalaryField,
  FormSubmitButton,
} from "@/components/forms";

const onboardingRoleOptions: SelectOption[] = [
  { value: "manager", label: "Manager" },
  { value: "supervisor", label: "Supervisor" },
  { value: "hr", label: "HR" },
  { value: "operator", label: "Operator" },
];

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
    role: user.role || "operator",
    shift_start_time: initialShifts.start,
    shift_end_time: initialShifts.end,
    street: user.street || user.address || "",
    city: user.city || "",
    district: user.district || "",
    state: user.state || "",
    state_id: user.state_id ? String(user.state_id) : "",
    address: user.address || user.street || "",
    monthly_salary: user.monthly_salary !== null && user.monthly_salary !== undefined ? String(user.monthly_salary) : "",
    aadhaar_number: user.aadhaar_number ? formatAadhaar(user.aadhaar_number) : "",
    license_number: user.license_number || "",
  });

  const [state, setState] = useState<OnboardingFormState>({});
  const [pending, setPending] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const isSubmittingRef = useRef(false);

  const [aadhaarFile, setAadhaarFile] = useState<File | null>(null);
  const [aadhaarPreviewUrl, setAadhaarPreviewUrl] = useState<string | null>(null);
  const [aadhaarFileError, setAadhaarFileError] = useState<string | null>(null);

  const [licenseFile, setLicenseFile] = useState<File | null>(null);
  const [licensePreviewUrl, setLicensePreviewUrl] = useState<string | null>(null);
  const [licenseFileError, setLicenseFileError] = useState<string | null>(null);

  const handleAadhaarFileChange = (file: File | null) => {
    if (aadhaarPreviewUrl) URL.revokeObjectURL(aadhaarPreviewUrl);
    if (!file) {
      setAadhaarFile(null);
      setAadhaarPreviewUrl(null);
      setAadhaarFileError(null);
      return;
    }
    const val = validateDocumentFile(file, DEFAULT_ALLOWED_DOCUMENT_MIME_TYPES, 2097152);
    if (!val.valid) {
      setAadhaarFile(null);
      setAadhaarPreviewUrl(null);
      setAadhaarFileError(val.error || "Invalid file");
    } else {
      setAadhaarFile(file);
      setAadhaarFileError(null);
      if (file.type.startsWith("image/")) {
        setAadhaarPreviewUrl(URL.createObjectURL(file));
      } else {
        setAadhaarPreviewUrl(null);
      }
    }
  };

  const handleLicenseFileChange = (file: File | null) => {
    if (licensePreviewUrl) URL.revokeObjectURL(licensePreviewUrl);
    if (!file) {
      setLicenseFile(null);
      setLicensePreviewUrl(null);
      setLicenseFileError(null);
      return;
    }
    const val = validateDocumentFile(file, DEFAULT_ALLOWED_DOCUMENT_MIME_TYPES, 2097152);
    if (!val.valid) {
      setLicenseFile(null);
      setLicensePreviewUrl(null);
      setLicenseFileError(val.error || "Invalid file");
    } else {
      setLicenseFile(file);
      setLicenseFileError(null);
      if (file.type.startsWith("image/")) {
        setLicensePreviewUrl(URL.createObjectURL(file));
      } else {
        setLicensePreviewUrl(null);
      }
    }
  };

  // Dynamic shift duration & classification computation
  const shiftTimingSummary = useMemo(() => {
    if (!formValues.shift_start_time || !formValues.shift_end_time) return null;
    return computeShiftTiming({
      startTime: formValues.shift_start_time,
      endTime: formValues.shift_end_time,
    });
  }, [formValues.shift_start_time, formValues.shift_end_time]);

  const isOperator = formValues.role === "operator";

  // Section 1: Account Information & Role (Mandatory)
  const section1Complete = useMemo(() => {
    return Boolean(
      formValues.full_name.trim().length >= 2 &&
      formValues.phone.replace(/\D/g, "").length >= 10 &&
      formValues.role
    );
  }, [formValues.full_name, formValues.phone, formValues.role]);

  // Section 2: Work Shift Schedule (Mandatory)
  const section2Complete = useMemo(() => {
    return Boolean(formValues.shift_start_time.trim() && formValues.shift_end_time.trim());
  }, [formValues.shift_start_time, formValues.shift_end_time]);

  // Section 3: Work Location & Address (Mandatory)
  const section3Complete = useMemo(() => {
    return Boolean(
      (formValues.street.trim() || formValues.address.trim()) &&
      formValues.city.trim() &&
      formValues.district.trim() &&
      (formValues.state.trim() || formValues.state_id)
    );
  }, [formValues.street, formValues.address, formValues.city, formValues.district, formValues.state, formValues.state_id]);

  // Section 4: Compensation (Mandatory for operators, optional for others)
  const section4Complete = useMemo(() => {
    if (!isOperator) return true;
    return Boolean(formValues.monthly_salary && Number(formValues.monthly_salary) > 0);
  }, [isOperator, formValues.monthly_salary]);

  // Section 5: Identity & Verification (Mandatory)
  const section5Complete = useMemo(() => {
    const clean = formValues.aadhaar_number.replace(/\D/g, "");
    return Boolean(clean.length === 12 && validateAadhaarNumber(clean).isValid);
  }, [formValues.aadhaar_number]);

  // Combined completeness guard for submission gating
  const isAllMandatoryFilled = useMemo(() => {
    return (
      section1Complete &&
      section2Complete &&
      section3Complete &&
      section4Complete &&
      section5Complete
    );
  }, [section1Complete, section2Complete, section3Complete, section4Complete, section5Complete]);

  const missingMandatoryCount = useMemo(() => {
    let count = 0;
    if (!section1Complete) count++;
    if (!section2Complete) count++;
    if (!section3Complete) count++;
    if (!section4Complete) count++;
    if (!section5Complete) count++;
    return count;
  }, [section1Complete, section2Complete, section3Complete, section4Complete, section5Complete]);

  // Compute profile completeness percentage for visual progress indicator
  const progressPercent = useMemo(() => {
    let completed = 0;
    const total = isOperator ? 9 : 8;
    if (formValues.full_name.trim().length >= 2) completed++;
    if (formValues.phone.trim().replace(/\D/g, "").length >= 10) completed++;
    if (formValues.role) completed++;
    if (formValues.shift_start_time && formValues.shift_end_time) completed++;
    if (formValues.street.trim().length >= 2 || formValues.address.trim().length >= 2) completed++;
    if (formValues.city.trim().length >= 2) completed++;
    if (formValues.district.trim().length >= 2) completed++;
    if (formValues.state.trim().length >= 2 || formValues.state_id) completed++;
    if (isOperator && formValues.monthly_salary && Number(formValues.monthly_salary) > 0) completed++;
    if (formValues.aadhaar_number.trim().replace(/\D/g, "").length === 12) completed++;
    return Math.min(100, Math.round((completed / total) * 100));
  }, [formValues, isOperator]);

  const handleChange = (field: string, value: string) => {
    let formattedVal = value;
    if (field === "aadhaar_number") {
      formattedVal = formatAadhaar(value);
    } else if (field === "license_number") {
      formattedVal = value.toUpperCase();
    } else if (field === "street") {
      setFormValues((prev) => ({ ...prev, street: value, address: value }));
      if (fieldErrors.street || fieldErrors.address) {
        setFieldErrors((prev) => {
          const copy = { ...prev };
          delete copy.street;
          delete copy.address;
          return copy;
        });
      }
      return;
    }

    setFormValues((prev) => ({ ...prev, [field]: formattedVal }));

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
    if (!formValues.street.trim() && !formValues.address.trim()) {
      errors.street = "Street / building address is required.";
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
    if (isOperator && (!formValues.monthly_salary || Number(formValues.monthly_salary) <= 0)) {
      errors.monthly_salary = "Monthly salary is required for operator accounts.";
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
    if (aadhaarFile) {
      formData.set("aadhaar_file", aadhaarFile);
    }
    if (licenseFile) {
      formData.set("license_file", licenseFile);
    }
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
              <FormSectionCard
                stepNumber={1}
                title="Account & Role"
                description="Verified credentials and platform operational role"
                isMandatory={true}
                isCompleted={section1Complete}
              >
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
              </FormSectionCard>

              {/* Section 2: Work Shift Schedule */}
              <FormSectionCard
                stepNumber={2}
                title="Work Shift Schedule"
                description="Operating shift hours and timing window"
                isMandatory={true}
                isCompleted={section2Complete}
                headerAction={
                  shiftTimingSummary?.isValid ? (
                    <span className="inline-flex items-center gap-1 text-[10px] font-semibold font-mono text-sky-600 dark:text-sky-400 bg-sky-500/10 px-2 py-0.5 rounded-md border border-sky-500/20">
                      {shiftTimingSummary.isOvernight ? "🌙 Overnight" : "☀️ Standard"} · {shiftTimingSummary.durationFormatted}
                    </span>
                  ) : undefined
                }
              >
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
              </FormSectionCard>

              {/* Section 3: Work Location & Address */}
              <FormSectionCard
                stepNumber={3}
                title="Work Location & Address"
                description="Street + City/Town/Village + District + State"
                isMandatory={true}
                isCompleted={section3Complete}
              >
                <UserAddressSection
                  street={formValues.street || formValues.address}
                  city={formValues.city}
                  district={formValues.district}
                  state={formValues.state}
                  stateId={formValues.state_id}
                  onChange={(field, val) => handleChange(field, val)}
                  errors={{
                    street: fieldErrors.street || fieldErrors.address,
                    city: fieldErrors.city,
                    district: fieldErrors.district,
                    state: fieldErrors.state,
                  }}
                  required={true}
                  idPrefix="onboarding"
                />
              </FormSectionCard>

              {/* Section 4: Compensation */}
              <FormSectionCard
                stepNumber={4}
                title="Compensation"
                description="Monthly base remuneration details"
                isMandatory={isOperator}
                isCompleted={section4Complete}
              >
                <UserSalaryField
                  value={formValues.monthly_salary}
                  onChange={(val) => handleChange("monthly_salary", val)}
                  role={formValues.role}
                  error={fieldErrors.monthly_salary}
                  id="onboarding-salary"
                />
              </FormSectionCard>

              {/* Section 5: Identity Verification */}
              <FormSectionCard
                stepNumber={5}
                title="Identity & Verification"
                description="Government identification and document attachments"
                isMandatory={true}
                isCompleted={section5Complete}
              >
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

                {/* Document Uploads: Aadhaar Card & Driving Licence */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-2.5 pt-1">
                  {/* Aadhaar Upload Card */}
                  <div className="rounded-xl border border-[var(--color-hairline)] bg-[var(--color-canvas)] p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-[var(--color-ink)] flex items-center gap-1.5">
                        <AnimatedShieldCheck size={14} className="text-sky-600 dark:text-sky-400" />
                        Aadhaar Document <span className="text-[10px] font-normal text-[var(--color-mute)]">(Front Photo / PDF)</span>
                      </span>
                      <span className="text-[10px] text-[var(--color-mute)] font-mono">2 MB max</span>
                    </div>

                    {!aadhaarFile ? (
                      <label className="flex items-center justify-center gap-2 p-3 rounded-lg border-2 border-dashed border-[var(--color-hairline)] hover:border-sky-500/50 cursor-pointer transition-colors group min-h-[48px]">
                        <Upload className="h-4 w-4 text-[var(--color-mute)] group-hover:text-sky-600 transition-colors" />
                        <span className="text-xs text-[var(--color-mute)] group-hover:text-[var(--color-ink)] transition-colors">
                          Upload Aadhaar (JPG, PNG, PDF)
                        </span>
                        <input
                          type="file"
                          name="aadhaar_file"
                          className="hidden"
                          accept="image/*,application/pdf,.doc,.docx,.txt"
                          onChange={(e) => handleAadhaarFileChange(e.target.files?.[0] || null)}
                        />
                      </label>
                    ) : (
                      <div className="flex items-center gap-2.5 p-2 rounded-lg bg-sky-500/5 border border-sky-500/20">
                        {aadhaarPreviewUrl ? (
                          /* eslint-disable-next-line @next/next/no-img-element */
                          <img
                            src={aadhaarPreviewUrl}
                            alt="Aadhaar preview"
                            className="h-10 w-10 rounded-lg object-cover border border-[var(--color-hairline)] shrink-0"
                          />
                        ) : (
                          <div className="h-10 w-10 rounded-lg bg-[var(--color-hairline)] flex items-center justify-center shrink-0">
                            <FileText className="h-5 w-5 text-sky-600" />
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-semibold text-[var(--color-ink)] truncate">
                            {aadhaarFile.name}
                          </p>
                          <p className="text-[10px] text-[var(--color-mute)] font-mono">
                            {(aadhaarFile.size / 1024).toFixed(0)} KB · Attached
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleAadhaarFileChange(null)}
                          className="p-1.5 rounded-lg hover:bg-[var(--color-hairline)] text-[var(--color-mute)] hover:text-rose-500 transition-colors"
                          title="Remove file"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    )}

                    {aadhaarFileError && (
                      <p className="text-[11px] text-rose-500 font-medium flex items-center gap-1">
                        {aadhaarFileError}
                      </p>
                    )}
                  </div>

                  {/* Licence Upload Card */}
                  <div className="rounded-xl border border-[var(--color-hairline)] bg-[var(--color-canvas)] p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-[var(--color-ink)] flex items-center gap-1.5">
                        <AnimatedCreditCard size={14} className="text-sky-600 dark:text-sky-400" />
                        Licence Document <span className="text-[10px] font-normal text-[var(--color-mute)]">(Front Photo / PDF)</span>
                      </span>
                      <span className="text-[10px] text-[var(--color-mute)] font-mono">2 MB max</span>
                    </div>

                    {!licenseFile ? (
                      <label className="flex items-center justify-center gap-2 p-3 rounded-lg border-2 border-dashed border-[var(--color-hairline)] hover:border-sky-500/50 cursor-pointer transition-colors group min-h-[48px]">
                        <Upload className="h-4 w-4 text-[var(--color-mute)] group-hover:text-sky-600 transition-colors" />
                        <span className="text-xs text-[var(--color-mute)] group-hover:text-[var(--color-ink)] transition-colors">
                          Upload Licence (JPG, PNG, PDF)
                        </span>
                        <input
                          type="file"
                          name="license_file"
                          className="hidden"
                          accept="image/*,application/pdf,.doc,.docx,.txt"
                          onChange={(e) => handleLicenseFileChange(e.target.files?.[0] || null)}
                        />
                      </label>
                    ) : (
                      <div className="flex items-center gap-2.5 p-2 rounded-lg bg-sky-500/5 border border-sky-500/20">
                        {licensePreviewUrl ? (
                          /* eslint-disable-next-line @next/next/no-img-element */
                          <img
                            src={licensePreviewUrl}
                            alt="Licence preview"
                            className="h-10 w-10 rounded-lg object-cover border border-[var(--color-hairline)] shrink-0"
                          />
                        ) : (
                          <div className="h-10 w-10 rounded-lg bg-[var(--color-hairline)] flex items-center justify-center shrink-0">
                            <FileText className="h-5 w-5 text-sky-600" />
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-semibold text-[var(--color-ink)] truncate">
                            {licenseFile.name}
                          </p>
                          <p className="text-[10px] text-[var(--color-mute)] font-mono">
                            {(licenseFile.size / 1024).toFixed(0)} KB · Attached
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleLicenseFileChange(null)}
                          className="p-1.5 rounded-lg hover:bg-[var(--color-hairline)] text-[var(--color-mute)] hover:text-rose-500 transition-colors"
                          title="Remove file"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    )}

                    {licenseFileError && (
                      <p className="text-[11px] text-rose-500 font-medium flex items-center gap-1">
                        {licenseFileError}
                      </p>
                    )}
                  </div>
                </div>
              </FormSectionCard>

              {/* Submit CTA Button with mandatory gating & double-click protection */}
              <div className="pt-2">
                <FormSubmitButton
                  isReady={isAllMandatoryFilled}
                  loading={pending}
                  label="Complete Profile & Enter Dashboard"
                  loadingLabel="Saving Profile & Directing to Dashboard..."
                  missingCount={missingMandatoryCount}
                />
              </div>
            </form>
          </motion.div>
        </div>
        <div className="hidden lg:block w-full h-1 shrink-0" />
      </div>
    </div>
  );
}
