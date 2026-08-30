"use client";

import { useState, useRef } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  AnimatedMail,
  AnimatedLock,
  AnimatedUser,
  AnimatedPhone,
  AnimatedMapPin,
  AnimatedAlertCircle,
  AnimatedShieldCheck,
  AnimatedCreditCard,
  AnimatedEye,
  AnimatedEyeOff,
} from "@/components/ui/animated-icons";
import {
  Loader2,
} from "lucide-react";
import { signup, type AuthFormState } from "@/app/actions/auth";
import { ReachInternationalLogo } from "@/components/ui";
import { SearchableSelect } from "@/components/ui/SearchableSelect";
import type { SelectOption } from "@/components/ui/SearchableSelect";
import { validateAadhaarNumber, validateLicenseNumber, formatAadhaar } from "@reachinternational/utils";

const signupRoleOptions: SelectOption[] = [
  { value: "service_engineer", label: "Service Engineer" },
  { value: "manager", label: "Manager" },
  { value: "service_manager", label: "Service Manager" },
  { value: "supervisor", label: "Supervisor" },
  { value: "store_manager", label: "Store Manager" },
  { value: "operator", label: "Operator" },
  { value: "mechanic", label: "Mechanic / Technician" },
  { value: "hr_manager", label: "HR Manager" },
];

export default function SignupPage() {
  const [state, setState] = useState<AuthFormState>({});
  const [pending, setPending] = useState(false);
  const isSubmittingRef = useRef(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [formValues, setFormValues] = useState({
    full_name: "",
    email: "",
    phone: "",
    role: "service_engineer",
    city: "",
    district: "",
    state: "",
    aadhaar_number: "",
    license_number: "",
    password: "",
    confirm_password: "",
  });
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const router = useRouter();

  const handleChange = (field: string, value: string) => {
    let formattedVal = value;
    if (field === "aadhaar_number") {
      formattedVal = formatAadhaar(value);
    } else if (field === "license_number") {
      formattedVal = value.toUpperCase();
    }

    setFormValues((prev) => ({ ...prev, [field]: formattedVal }));

    // Instant validation for Aadhaar
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

    if (fieldErrors[field]) {
      setFieldErrors((prev) => {
        const copy = { ...prev };
        delete copy[field];
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

  function isRedirectError(error: unknown): boolean {
    if (typeof error !== "object" || error === null) return false;
    const err = error as Record<string, unknown>;
    if (typeof err.digest === "string" && err.digest.startsWith("NEXT_REDIRECT")) {
      return true;
    }
    if (err.message === "NEXT_REDIRECT") {
      return true;
    }
    return false;
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (isSubmittingRef.current || pending) return;

    // Client-side pre-flight checks
    const errors: Record<string, string> = {};
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
      const result = await signup({}, formData);
      setState(result);

      if (result.fieldErrors) {
        setFieldErrors(result.fieldErrors);
      } else {
        setFieldErrors({});
      }

      if (result.fieldValues) {
        setFormValues((prev) => ({
          ...prev,
          ...result.fieldValues,
        }));
      }

      if (!result.error && result.message) {
        // Keep pending=true and isSubmittingRef=true so button stays locked and displays spinner during redirect
        setTimeout(() => {
          router.push("/login?message=Signup successful! Please wait for admin approval.");
        }, 1500);
        return;
      }

      isSubmittingRef.current = false;
      setPending(false);
    } catch (err: unknown) {
      if (isRedirectError(err)) {
        throw err;
      }
      isSubmittingRef.current = false;
      setPending(false);
      setState({ error: "An unexpected error occurred. Please try again." });
    }
  }

  return (
    <div className="h-screen h-[100dvh] max-h-screen w-full flex flex-col lg:flex-row bg-[#080909] text-[#F5F7F8] dark:bg-[#080909] dark:text-[#F5F7F8] [html:not(.dark)_&]:bg-[#F7F8FA] [html:not(.dark)_&]:text-[#111315] overflow-y-auto lg:overflow-hidden select-none">
      {/* ============================================================
          Left: Visual & Industrial Fleet Showcase Panel (Desktop only)
          40% width, restrained dark charcoal/cool gray surface
          ============================================================ */}
      <div className="relative hidden lg:flex flex-col justify-between h-full lg:w-[40%] p-8 xl:p-10 2xl:p-12 border-r border-[#26292C] dark:border-[#26292C] [html:not(.dark)_&]:border-[#E1E5E9] bg-[#0E1011] dark:bg-[#0E1011] [html:not(.dark)_&]:bg-[#F4F6F8] overflow-hidden">
        {/* Minimal atmospheric Reach Blue glow behind machine */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[440px] h-[440px] bg-[radial-gradient(circle_at_center,rgba(0,174,239,0.09)_0%,rgba(0,174,239,0.02)_50%,transparent_70%)] dark:bg-[radial-gradient(circle_at_center,rgba(0,174,239,0.12)_0%,rgba(0,174,239,0.03)_50%,transparent_70%)] rounded-full blur-3xl pointer-events-none" />

        {/* Top Header / Logo */}
        <div className="flex items-center justify-between z-10">
          <Link
            href="/"
            className="inline-flex items-center group focus:outline-none focus-visible:ring-2 focus-visible:ring-[#00AEEF] rounded-lg transition-transform hover:scale-[1.01]"
            aria-label="Reach International Home"
          >
            <ReachInternationalLogo variant="full" size={28} />
          </Link>
        </div>

        {/* Hero Central Content */}
        <div className="my-auto flex flex-col gap-6 xl:gap-8 max-w-md xl:max-w-lg z-10 py-4">
          <div className="flex flex-col gap-2">
            <h1 className="text-3xl sm:text-4xl xl:text-5xl font-bold tracking-tight text-[#F5F7F8] dark:text-[#F5F7F8] [html:not(.dark)_&]:text-[#111315] leading-[1.1]">
              Join your team.
              <br />
              <span className="text-[#00AEEF] dark:text-[#00AEEF] [html:not(.dark)_&]:text-[#008FD0]">
                Access the fleet.
              </span>
            </h1>
          </div>

          {/* Machine Showcase Stage with Ground Shadow Pedestal */}
          <div className="relative pt-2 pb-1 flex items-center justify-center">
            <div className="absolute bottom-1 left-1/2 -translate-x-1/2 w-[90%] max-w-[360px] xl:max-w-[420px] h-6 bg-[radial-gradient(ellipse_at_center,rgba(0,0,0,0.18)_0%,rgba(0,0,0,0.04)_50%,transparent_70%)] dark:bg-[radial-gradient(ellipse_at_center,rgba(0,0,0,0.85)_0%,rgba(0,0,0,0.25)_50%,transparent_70%)] blur-[4px] pointer-events-none z-0" />

            <div className="relative z-10 w-full max-w-[340px] xl:max-w-[400px] 2xl:max-w-[440px] transition-transform duration-500 hover:scale-[1.02]">
              <Image
                src="/loginpageimage.png"
                alt="Reach International Aerial Boom Lift Fleet Equipment"
                width={800}
                height={533}
                priority
                className="w-full h-auto max-h-[32vh] xl:max-h-[36vh] object-contain drop-shadow-sm dark:drop-shadow-[0_12px_24px_rgba(0,0,0,0.6)] select-none pointer-events-none"
              />
            </div>
          </div>
        </div>

        {/* Minimal Bottom Spacer */}
        <div className="h-4 z-10" />
      </div>

      {/* ============================================================
          Right: Dedicated Signup Workspace (60% width on desktop)
          Compact floating enterprise registration card with zero scroll
          ============================================================ */}
      <div className="relative flex-1 lg:w-[60%] h-full flex flex-col justify-center items-center p-3 sm:p-5 lg:p-6 xl:p-8 overflow-y-auto lg:overflow-hidden bg-[#080909] dark:bg-[#080909] [html:not(.dark)_&]:bg-[#F7F8FA]">
        {/* Center: Floating Registration Card */}
        <div className="w-full flex items-center justify-center my-auto py-1 z-10">
          <motion.div
            initial={{ opacity: 0, y: 8, scale: 0.99 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
            className="w-full max-w-xl lg:max-w-2xl bg-[#111314] dark:bg-[#111314] [html:not(.dark)_&]:bg-[#FFFFFF] rounded-[14px] border border-[#26292C] dark:border-[#26292C] [html:not(.dark)_&]:border-[#E1E5E9] p-5 sm:p-6 lg:p-6 shadow-[0_20px_60px_rgba(0,0,0,0.35)] [html:not(.dark)_&]:shadow-[0_20px_50px_rgba(0,0,0,0.06)] text-[#F5F7F8] dark:text-[#F5F7F8] [html:not(.dark)_&]:text-[#111315] relative overflow-hidden"
          >
            {/* Mobile Only: Top Header Logo & Portal Emblem */}
            <div className="flex lg:hidden flex-col items-center justify-center mb-4 gap-1.5">
              <Link href="/" className="flex items-center group focus:outline-none">
                <ReachInternationalLogo variant="full" size={26} />
              </Link>
              <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-[#00AEEF]/10 dark:bg-[#00AEEF]/15 border border-[#00AEEF]/20 text-[10px] font-mono font-medium text-[#00AEEF] dark:text-[#00AEEF] [html:not(.dark)_&]:text-[#008FD0]">
                <span className="h-1.5 w-1.5 rounded-full bg-[#18B981] animate-pulse" />
                Enterprise Fleet Platform
              </div>
            </div>

            {/* Card Header — Clean title */}
            <div className="mb-3.5">
              <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-[#F5F7F8] dark:text-[#F5F7F8] [html:not(.dark)_&]:text-[#111315]">
                Create an account
              </h2>
            </div>

            {/* Global Error Banner */}
            {state.error && Object.keys(fieldErrors).length === 0 && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                className="flex items-start gap-2 rounded-[6px] bg-rose-500/10 border border-rose-500/20 p-2.5 mb-3 text-xs font-semibold text-rose-600 dark:text-rose-400"
              >
                <AnimatedAlertCircle size={14} className="text-rose-500 shrink-0 mt-0.5" />
                <span>{state.error}</span>
              </motion.div>
            )}

            {/* Global Success Banner */}
            {state.message && !state.error && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                className="flex items-start gap-2 rounded-[6px] bg-emerald-500/10 border border-emerald-500/20 p-2.5 mb-3 text-xs font-semibold text-emerald-600 dark:text-emerald-400"
              >
                <AnimatedShieldCheck size={14} className="text-emerald-500 shrink-0 mt-0.5" />
                <span>{state.message}</span>
              </motion.div>
            )}

            {/* Registration Form */}
            <form onSubmit={handleSubmit} className="flex flex-col gap-2.5">
              {/* Row 1: Full Name | Email */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {/* Full Name */}
                <div className="flex flex-col gap-1 w-full">
                  <label
                    htmlFor="signup-full-name"
                    className="text-xs font-medium text-[#F5F7F8] dark:text-[#F5F7F8] [html:not(.dark)_&]:text-[#111315] select-none"
                  >
                    Full Name <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative w-full flex items-center">
                    <div className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none flex items-center justify-center text-[#969CA3] dark:text-[#969CA3] [html:not(.dark)_&]:text-[#626970]">
                      <AnimatedUser size={15} />
                    </div>
                    <input
                      id="signup-full-name"
                      name="full_name"
                      type="text"
                      value={formValues.full_name}
                      onChange={(e) => handleChange("full_name", e.target.value)}
                      placeholder="Rahul Sharma"
                      required
                      autoComplete="name"
                      className={`w-full h-10 pl-9 pr-3 text-xs sm:text-[13px] rounded-[6px] border bg-[#151718] dark:bg-[#151718] [html:not(.dark)_&]:bg-[#F1F3F5] text-[#F5F7F8] dark:text-[#F5F7F8] [html:not(.dark)_&]:text-[#111315] placeholder-[#969CA3]/60 dark:placeholder-[#969CA3]/60 [html:not(.dark)_&]:placeholder-[#626970]/70 transition-colors focus:outline-none focus:border-[#00AEEF] dark:focus:border-[#00AEEF] [html:not(.dark)_&]:focus:border-[#008FD0] focus:ring-2 focus:ring-[#00AEEF]/15 ${
                        fieldErrors.full_name
                          ? "border-rose-500 dark:border-rose-400 bg-rose-500/5 dark:bg-rose-500/10 focus:border-rose-500"
                          : "border-[#292C2F] dark:border-[#292C2F] [html:not(.dark)_&]:border-[#E1E5E9] hover:border-[#3A3E42] dark:hover:border-[#3A3E42] [html:not(.dark)_&]:hover:border-[#CBD5E1]"
                      }`}
                    />
                  </div>
                  {fieldErrors.full_name && (
                    <p className="text-[11px] font-semibold text-rose-600 dark:text-rose-400 mt-0.5">
                      {fieldErrors.full_name}
                    </p>
                  )}
                </div>

                {/* Email Address */}
                <div className="flex flex-col gap-1 w-full">
                  <label
                    htmlFor="signup-email"
                    className="text-xs font-medium text-[#F5F7F8] dark:text-[#F5F7F8] [html:not(.dark)_&]:text-[#111315] select-none"
                  >
                    Email address <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative w-full flex items-center">
                    <div className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none flex items-center justify-center text-[#969CA3] dark:text-[#969CA3] [html:not(.dark)_&]:text-[#626970]">
                      <AnimatedMail size={15} />
                    </div>
                    <input
                      id="signup-email"
                      name="email"
                      type="email"
                      value={formValues.email}
                      onChange={(e) => handleChange("email", e.target.value)}
                      placeholder="rahul@domain.com"
                      required
                      autoComplete="email"
                      className={`w-full h-10 pl-9 pr-3 text-xs sm:text-[13px] rounded-[6px] border bg-[#151718] dark:bg-[#151718] [html:not(.dark)_&]:bg-[#F1F3F5] text-[#F5F7F8] dark:text-[#F5F7F8] [html:not(.dark)_&]:text-[#111315] placeholder-[#969CA3]/60 dark:placeholder-[#969CA3]/60 [html:not(.dark)_&]:placeholder-[#626970]/70 transition-colors focus:outline-none focus:border-[#00AEEF] dark:focus:border-[#00AEEF] [html:not(.dark)_&]:focus:border-[#008FD0] focus:ring-2 focus:ring-[#00AEEF]/15 ${
                        fieldErrors.email
                          ? "border-rose-500 dark:border-rose-400 bg-rose-500/5 dark:bg-rose-500/10 focus:border-rose-500"
                          : "border-[#292C2F] dark:border-[#292C2F] [html:not(.dark)_&]:border-[#E1E5E9] hover:border-[#3A3E42] dark:hover:border-[#3A3E42] [html:not(.dark)_&]:hover:border-[#CBD5E1]"
                      }`}
                    />
                  </div>
                  {fieldErrors.email && (
                    <p className="text-[11px] font-semibold text-rose-600 dark:text-rose-400 mt-0.5">
                      {fieldErrors.email}
                    </p>
                  )}
                </div>
              </div>

              {/* Row 2: Mobile Number | Role */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {/* Mobile Number */}
                <div className="flex flex-col gap-1 w-full">
                  <label
                    htmlFor="signup-phone"
                    className="text-xs font-medium text-[#F5F7F8] dark:text-[#F5F7F8] [html:not(.dark)_&]:text-[#111315] select-none"
                  >
                    Mobile Number <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative w-full flex items-center">
                    <div className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none flex items-center justify-center text-[#969CA3] dark:text-[#969CA3] [html:not(.dark)_&]:text-[#626970]">
                      <AnimatedPhone size={15} />
                    </div>
                    <input
                      id="signup-phone"
                      name="phone"
                      type="tel"
                      value={formValues.phone}
                      onChange={(e) => handleChange("phone", e.target.value)}
                      placeholder="+91 98765 43210"
                      required
                      autoComplete="tel"
                      className={`w-full h-10 pl-9 pr-3 text-xs sm:text-[13px] rounded-[6px] border bg-[#151718] dark:bg-[#151718] [html:not(.dark)_&]:bg-[#F1F3F5] text-[#F5F7F8] dark:text-[#F5F7F8] [html:not(.dark)_&]:text-[#111315] placeholder-[#969CA3]/60 dark:placeholder-[#969CA3]/60 [html:not(.dark)_&]:placeholder-[#626970]/70 transition-colors focus:outline-none focus:border-[#00AEEF] dark:focus:border-[#00AEEF] [html:not(.dark)_&]:focus:border-[#008FD0] focus:ring-2 focus:ring-[#00AEEF]/15 ${
                        fieldErrors.phone
                          ? "border-rose-500 dark:border-rose-400 bg-rose-500/5 dark:bg-rose-500/10 focus:border-rose-500"
                          : "border-[#292C2F] dark:border-[#292C2F] [html:not(.dark)_&]:border-[#E1E5E9] hover:border-[#3A3E42] dark:hover:border-[#3A3E42] [html:not(.dark)_&]:hover:border-[#CBD5E1]"
                      }`}
                    />
                  </div>
                  {fieldErrors.phone && (
                    <p className="text-[11px] font-semibold text-rose-600 dark:text-rose-400 mt-0.5">
                      {fieldErrors.phone}
                    </p>
                  )}
                </div>

                {/* Account Role */}
                <div className="flex flex-col gap-1 w-full">
                  <label
                    className="text-xs font-medium text-[#F5F7F8] dark:text-[#F5F7F8] [html:not(.dark)_&]:text-[#111315] select-none"
                  >
                    Role <span className="text-rose-500">*</span>
                  </label>
                  <input type="hidden" name="role" value={formValues.role} />
                  <SearchableSelect
                    options={signupRoleOptions}
                    value={formValues.role}
                    onChange={(val) => handleChange("role", val)}
                    placeholder="Select role..."
                    clearable={false}
                    error={fieldErrors.role}
                    className="w-full text-xs"
                  />
                </div>
              </div>

              {/* Row 3: City | District | State (3-Column compact layout) */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                {/* City */}
                <div className="flex flex-col gap-1 w-full">
                  <label
                    htmlFor="signup-city"
                    className="text-xs font-medium text-[#F5F7F8] dark:text-[#F5F7F8] [html:not(.dark)_&]:text-[#111315] select-none"
                  >
                    City <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative w-full flex items-center">
                    <div className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none flex items-center justify-center text-[#969CA3] dark:text-[#969CA3] [html:not(.dark)_&]:text-[#626970]">
                      <AnimatedMapPin size={14} />
                    </div>
                    <input
                      id="signup-city"
                      name="city"
                      type="text"
                      value={formValues.city}
                      onChange={(e) => handleChange("city", e.target.value)}
                      placeholder="Pune"
                      required
                      autoComplete="address-level2"
                      className={`w-full h-10 pl-8 pr-2.5 text-xs rounded-[6px] border bg-[#151718] dark:bg-[#151718] [html:not(.dark)_&]:bg-[#F1F3F5] text-[#F5F7F8] dark:text-[#F5F7F8] [html:not(.dark)_&]:text-[#111315] placeholder-[#969CA3]/60 dark:placeholder-[#969CA3]/60 [html:not(.dark)_&]:placeholder-[#626970]/70 transition-colors focus:outline-none focus:border-[#00AEEF] dark:focus:border-[#00AEEF] [html:not(.dark)_&]:focus:border-[#008FD0] focus:ring-2 focus:ring-[#00AEEF]/15 ${
                        fieldErrors.city
                          ? "border-rose-500 dark:border-rose-400 bg-rose-500/5 dark:bg-rose-500/10 focus:border-rose-500"
                          : "border-[#292C2F] dark:border-[#292C2F] [html:not(.dark)_&]:border-[#E1E5E9] hover:border-[#3A3E42] dark:hover:border-[#3A3E42] [html:not(.dark)_&]:hover:border-[#CBD5E1]"
                      }`}
                    />
                  </div>
                  {fieldErrors.city && (
                    <p className="text-[11px] font-semibold text-rose-600 dark:text-rose-400 mt-0.5">
                      {fieldErrors.city}
                    </p>
                  )}
                </div>

                {/* District */}
                <div className="flex flex-col gap-1 w-full">
                  <label
                    htmlFor="signup-district"
                    className="text-xs font-medium text-[#F5F7F8] dark:text-[#F5F7F8] [html:not(.dark)_&]:text-[#111315] select-none"
                  >
                    District <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative w-full flex items-center">
                    <div className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none flex items-center justify-center text-[#969CA3] dark:text-[#969CA3] [html:not(.dark)_&]:text-[#626970]">
                      <AnimatedMapPin size={14} />
                    </div>
                    <input
                      id="signup-district"
                      name="district"
                      type="text"
                      value={formValues.district}
                      onChange={(e) => handleChange("district", e.target.value)}
                      placeholder="Pune"
                      required
                      autoComplete="address-level2"
                      className={`w-full h-10 pl-8 pr-2.5 text-xs rounded-[6px] border bg-[#151718] dark:bg-[#151718] [html:not(.dark)_&]:bg-[#F1F3F5] text-[#F5F7F8] dark:text-[#F5F7F8] [html:not(.dark)_&]:text-[#111315] placeholder-[#969CA3]/60 dark:placeholder-[#969CA3]/60 [html:not(.dark)_&]:placeholder-[#626970]/70 transition-colors focus:outline-none focus:border-[#00AEEF] dark:focus:border-[#00AEEF] [html:not(.dark)_&]:focus:border-[#008FD0] focus:ring-2 focus:ring-[#00AEEF]/15 ${
                        fieldErrors.district
                          ? "border-rose-500 dark:border-rose-400 bg-rose-500/5 dark:bg-rose-500/10 focus:border-rose-500"
                          : "border-[#292C2F] dark:border-[#292C2F] [html:not(.dark)_&]:border-[#E1E5E9] hover:border-[#3A3E42] dark:hover:border-[#3A3E42] [html:not(.dark)_&]:hover:border-[#CBD5E1]"
                      }`}
                    />
                  </div>
                  {fieldErrors.district && (
                    <p className="text-[11px] font-semibold text-rose-600 dark:text-rose-400 mt-0.5">
                      {fieldErrors.district}
                    </p>
                  )}
                </div>

                {/* State */}
                <div className="flex flex-col gap-1 w-full">
                  <label
                    htmlFor="signup-state"
                    className="text-xs font-medium text-[#F5F7F8] dark:text-[#F5F7F8] [html:not(.dark)_&]:text-[#111315] select-none"
                  >
                    State <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative w-full flex items-center">
                    <div className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none flex items-center justify-center text-[#969CA3] dark:text-[#969CA3] [html:not(.dark)_&]:text-[#626970]">
                      <AnimatedMapPin size={14} />
                    </div>
                    <input
                      id="signup-state"
                      name="state"
                      type="text"
                      value={formValues.state}
                      onChange={(e) => handleChange("state", e.target.value)}
                      placeholder="Maharashtra"
                      required
                      autoComplete="address-level1"
                      className={`w-full h-10 pl-8 pr-2.5 text-xs rounded-[6px] border bg-[#151718] dark:bg-[#151718] [html:not(.dark)_&]:bg-[#F1F3F5] text-[#F5F7F8] dark:text-[#F5F7F8] [html:not(.dark)_&]:text-[#111315] placeholder-[#969CA3]/60 dark:placeholder-[#969CA3]/60 [html:not(.dark)_&]:placeholder-[#626970]/70 transition-colors focus:outline-none focus:border-[#00AEEF] dark:focus:border-[#00AEEF] [html:not(.dark)_&]:focus:border-[#008FD0] focus:ring-2 focus:ring-[#00AEEF]/15 ${
                        fieldErrors.state
                          ? "border-rose-500 dark:border-rose-400 bg-rose-500/5 dark:bg-rose-500/10 focus:border-rose-500"
                          : "border-[#292C2F] dark:border-[#292C2F] [html:not(.dark)_&]:border-[#E1E5E9] hover:border-[#3A3E42] dark:hover:border-[#3A3E42] [html:not(.dark)_&]:hover:border-[#CBD5E1]"
                      }`}
                    />
                  </div>
                  {fieldErrors.state && (
                    <p className="text-[11px] font-semibold text-rose-600 dark:text-rose-400 mt-0.5">
                      {fieldErrors.state}
                    </p>
                  )}
                </div>
              </div>

              {/* Row 4: Aadhaar Card Number | Driving Licence Number */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {/* Aadhaar Card Number */}
                <div className="flex flex-col gap-1 w-full">
                  <label
                    htmlFor="signup-aadhaar"
                    className="text-xs font-medium text-[#F5F7F8] dark:text-[#F5F7F8] [html:not(.dark)_&]:text-[#111315] select-none"
                  >
                    Aadhaar Card Number <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative w-full flex items-center">
                    <div className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none flex items-center justify-center text-[#969CA3] dark:text-[#969CA3] [html:not(.dark)_&]:text-[#626970]">
                      <AnimatedShieldCheck size={15} />
                    </div>
                    <input
                      id="signup-aadhaar"
                      name="aadhaar_number"
                      type="text"
                      value={formValues.aadhaar_number}
                      onChange={(e) => handleChange("aadhaar_number", e.target.value)}
                      onBlur={() => handleBlur("aadhaar_number")}
                      placeholder="12-digit Aadhaar Number"
                      maxLength={14}
                      required
                      className={`w-full h-10 pl-9 pr-3 text-xs sm:text-[13px] rounded-[6px] border bg-[#151718] dark:bg-[#151718] [html:not(.dark)_&]:bg-[#F1F3F5] text-[#F5F7F8] dark:text-[#F5F7F8] [html:not(.dark)_&]:text-[#111315] placeholder-[#969CA3]/60 dark:placeholder-[#969CA3]/60 [html:not(.dark)_&]:placeholder-[#626970]/70 transition-colors focus:outline-none focus:border-[#00AEEF] dark:focus:border-[#00AEEF] [html:not(.dark)_&]:focus:border-[#008FD0] focus:ring-2 focus:ring-[#00AEEF]/15 ${
                        fieldErrors.aadhaar_number
                          ? "border-rose-500 dark:border-rose-400 bg-rose-500/5 dark:bg-rose-500/10 focus:border-rose-500"
                          : "border-[#292C2F] dark:border-[#292C2F] [html:not(.dark)_&]:border-[#E1E5E9] hover:border-[#3A3E42] dark:hover:border-[#3A3E42] [html:not(.dark)_&]:hover:border-[#CBD5E1]"
                      }`}
                    />
                  </div>
                  {fieldErrors.aadhaar_number && (
                    <p className="text-[11px] font-semibold text-rose-600 dark:text-rose-400 mt-0.5">
                      {fieldErrors.aadhaar_number}
                    </p>
                  )}
                </div>

                {/* Driving Licence Number */}
                <div className="flex flex-col gap-1 w-full">
                  <label
                    htmlFor="signup-license"
                    className="text-xs font-medium text-[#F5F7F8] dark:text-[#F5F7F8] [html:not(.dark)_&]:text-[#111315] select-none"
                  >
                    Driving Licence Number <span className="text-[11px] font-normal text-[#969CA3] dark:text-[#969CA3] [html:not(.dark)_&]:text-[#626970]">(Optional)</span>
                  </label>
                  <div className="relative w-full flex items-center">
                    <div className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none flex items-center justify-center text-[#969CA3] dark:text-[#969CA3] [html:not(.dark)_&]:text-[#626970]">
                      <AnimatedCreditCard size={15} />
                    </div>
                    <input
                      id="signup-license"
                      name="license_number"
                      type="text"
                      value={formValues.license_number}
                      onChange={(e) => handleChange("license_number", e.target.value)}
                      onBlur={() => handleBlur("license_number")}
                      placeholder="e.g. MH12 20110012345"
                      maxLength={25}
                      className={`w-full h-10 pl-9 pr-3 text-xs sm:text-[13px] rounded-[6px] border bg-[#151718] dark:bg-[#151718] [html:not(.dark)_&]:bg-[#F1F3F5] text-[#F5F7F8] dark:text-[#F5F7F8] [html:not(.dark)_&]:text-[#111315] placeholder-[#969CA3]/60 dark:placeholder-[#969CA3]/60 [html:not(.dark)_&]:placeholder-[#626970]/70 transition-colors focus:outline-none focus:border-[#00AEEF] dark:focus:border-[#00AEEF] [html:not(.dark)_&]:focus:border-[#008FD0] focus:ring-2 focus:ring-[#00AEEF]/15 ${
                        fieldErrors.license_number
                          ? "border-rose-500 dark:border-rose-400 bg-rose-500/5 dark:bg-rose-500/10 focus:border-rose-500"
                          : "border-[#292C2F] dark:border-[#292C2F] [html:not(.dark)_&]:border-[#E1E5E9] hover:border-[#3A3E42] dark:hover:border-[#3A3E42] [html:not(.dark)_&]:hover:border-[#CBD5E1]"
                      }`}
                    />
                  </div>
                  {fieldErrors.license_number && (
                    <p className="text-[11px] font-semibold text-rose-600 dark:text-rose-400 mt-0.5">
                      {fieldErrors.license_number}
                    </p>
                  )}
                </div>
              </div>

              {/* Row 5: Password | Confirm Password */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {/* Password */}
                <div className="flex flex-col gap-1 w-full">
                  <label
                    htmlFor="signup-password"
                    className="text-xs font-medium text-[#F5F7F8] dark:text-[#F5F7F8] [html:not(.dark)_&]:text-[#111315] select-none"
                  >
                    Password <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative w-full flex items-center">
                    <div className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none flex items-center justify-center text-[#969CA3] dark:text-[#969CA3] [html:not(.dark)_&]:text-[#626970]">
                      <AnimatedLock size={15} />
                    </div>
                    <input
                      id="signup-password"
                      name="password"
                      type={showPassword ? "text" : "password"}
                      value={formValues.password}
                      onChange={(e) => handleChange("password", e.target.value)}
                      placeholder="••••••••••••"
                      required
                      autoComplete="new-password"
                      className={`w-full h-10 pl-9 pr-9 text-xs sm:text-[13px] rounded-[6px] border bg-[#151718] dark:bg-[#151718] [html:not(.dark)_&]:bg-[#F1F3F5] text-[#F5F7F8] dark:text-[#F5F7F8] [html:not(.dark)_&]:text-[#111315] placeholder-[#969CA3]/60 dark:placeholder-[#969CA3]/60 [html:not(.dark)_&]:placeholder-[#626970]/70 transition-colors focus:outline-none focus:border-[#00AEEF] dark:focus:border-[#00AEEF] [html:not(.dark)_&]:focus:border-[#008FD0] focus:ring-2 focus:ring-[#00AEEF]/15 ${
                        fieldErrors.password
                          ? "border-rose-500 dark:border-rose-400 bg-rose-500/5 dark:bg-rose-500/10 focus:border-rose-500"
                          : "border-[#292C2F] dark:border-[#292C2F] [html:not(.dark)_&]:border-[#E1E5E9] hover:border-[#3A3E42] dark:hover:border-[#3A3E42] [html:not(.dark)_&]:hover:border-[#CBD5E1]"
                      }`}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#969CA3] dark:text-[#969CA3] [html:not(.dark)_&]:text-[#626970] hover:text-[#F5F7F8] dark:hover:text-[#F5F7F8] [html:not(.dark)_&]:hover:text-[#111315] transition-colors p-1 rounded focus:outline-none"
                      tabIndex={-1}
                      aria-label={showPassword ? "Hide password" : "Show password"}
                    >
                      {showPassword ? <AnimatedEyeOff size={15} /> : <AnimatedEye size={15} />}
                    </button>
                  </div>
                  {fieldErrors.password && (
                    <p className="text-[11px] font-semibold text-rose-600 dark:text-rose-400 mt-0.5">
                      {fieldErrors.password}
                    </p>
                  )}
                </div>

                {/* Confirm Password */}
                <div className="flex flex-col gap-1 w-full">
                  <label
                    htmlFor="signup-confirm-password"
                    className="text-xs font-medium text-[#F5F7F8] dark:text-[#F5F7F8] [html:not(.dark)_&]:text-[#111315] select-none"
                  >
                    Confirm Password <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative w-full flex items-center">
                    <div className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none flex items-center justify-center text-[#969CA3] dark:text-[#969CA3] [html:not(.dark)_&]:text-[#626970]">
                      <AnimatedLock size={15} />
                    </div>
                    <input
                      id="signup-confirm-password"
                      name="confirm_password"
                      type={showConfirmPassword ? "text" : "password"}
                      value={formValues.confirm_password}
                      onChange={(e) => handleChange("confirm_password", e.target.value)}
                      placeholder="••••••••••••"
                      required
                      autoComplete="new-password"
                      className={`w-full h-10 pl-9 pr-9 text-xs sm:text-[13px] rounded-[6px] border bg-[#151718] dark:bg-[#151718] [html:not(.dark)_&]:bg-[#F1F3F5] text-[#F5F7F8] dark:text-[#F5F7F8] [html:not(.dark)_&]:text-[#111315] placeholder-[#969CA3]/60 dark:placeholder-[#969CA3]/60 [html:not(.dark)_&]:placeholder-[#626970]/70 transition-colors focus:outline-none focus:border-[#00AEEF] dark:focus:border-[#00AEEF] [html:not(.dark)_&]:focus:border-[#008FD0] focus:ring-2 focus:ring-[#00AEEF]/15 ${
                        fieldErrors.confirm_password
                          ? "border-rose-500 dark:border-rose-400 bg-rose-500/5 dark:bg-rose-500/10 focus:border-rose-500"
                          : "border-[#292C2F] dark:border-[#292C2F] [html:not(.dark)_&]:border-[#E1E5E9] hover:border-[#3A3E42] dark:hover:border-[#3A3E42] [html:not(.dark)_&]:hover:border-[#CBD5E1]"
                      }`}
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#969CA3] dark:text-[#969CA3] [html:not(.dark)_&]:text-[#626970] hover:text-[#F5F7F8] dark:hover:text-[#F5F7F8] [html:not(.dark)_&]:hover:text-[#111315] transition-colors p-1 rounded focus:outline-none"
                      tabIndex={-1}
                      aria-label={showConfirmPassword ? "Hide password" : "Show password"}
                    >
                      {showConfirmPassword ? <AnimatedEyeOff size={15} /> : <AnimatedEye size={15} />}
                    </button>
                  </div>
                  {fieldErrors.confirm_password && (
                    <p className="text-[11px] font-semibold text-rose-600 dark:text-rose-400 mt-0.5">
                      {fieldErrors.confirm_password}
                    </p>
                  )}
                </div>
              </div>

              {/* Note banner */}
              <div className="rounded-[6px] bg-[#00AEEF]/10 dark:bg-[#00AEEF]/10 border border-[#00AEEF]/20 py-1.5 px-3 text-[11px] leading-relaxed text-[#00AEEF] dark:text-[#00AEEF] [html:not(.dark)_&]:text-[#008FD0]">
                <strong>Note:</strong> Account status will be &ldquo;pending&rdquo; until approved by an administrator.
              </div>

              {/* Submit CTA Button — DESIGN.md compliant primary app button */}
              <div className="pt-1">
                <button
                  type="submit"
                  disabled={pending}
                  className="w-full h-11 rounded-[6px] font-medium text-sm transition-all duration-150 shadow-xs flex items-center justify-center gap-2 bg-[#171717] hover:bg-[#262626] text-[#ffffff] dark:bg-[#fafafa] dark:hover:bg-[#ebebeb] dark:text-[#0a0a0a] disabled:opacity-50 disabled:cursor-not-allowed disabled:pointer-events-none active:scale-[0.98] cursor-pointer"
                >
                  {pending ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin shrink-0 text-current" />
                      <span>Creating account...</span>
                    </>
                  ) : (
                    <span>Request Platform Access</span>
                  )}
                </button>
              </div>
            </form>

            {/* Footer */}
            <div className="mt-3.5 pt-3 border-t border-[#26292C] dark:border-[#26292C] [html:not(.dark)_&]:border-[#E1E5E9] flex items-center justify-center gap-1.5 text-xs">
              <span className="text-[#969CA3] dark:text-[#969CA3] [html:not(.dark)_&]:text-[#626970]">
                Already have an account?
              </span>
              <Link
                href="/login"
                className="font-semibold text-[#00AEEF] dark:text-[#00AEEF] [html:not(.dark)_&]:text-[#008FD0] hover:underline transition-colors"
              >
                Sign in
              </Link>
            </div>
          </motion.div>
        </div>

        {/* Minimal Bottom Footer */}
        <div className="w-full flex items-center justify-center text-[11px] font-mono text-[#969CA3] dark:text-[#969CA3] [html:not(.dark)_&]:text-[#626970] shrink-0 pt-1 pb-1">
          <span>&copy; {new Date().getFullYear()} REACH INTERNATIONAL. ALL RIGHTS RESERVED.</span>
        </div>
      </div>
    </div>
  );
}