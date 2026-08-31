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
  AnimatedShieldCheck,
  AnimatedCreditCard,
} from "@/components/ui/animated-icons";
import { signup, type AuthFormState } from "@/app/actions/auth";
import {
  Button,
  Input,
  Alert,
  SearchableSelect,
  ReachInternationalLogo,
  type SelectOption,
} from "@/components/ui";
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
          full_name: result.fieldValues?.full_name ?? prev.full_name,
          email: result.fieldValues?.email ?? prev.email,
          phone: result.fieldValues?.phone ?? prev.phone,
          role: result.fieldValues?.role ?? prev.role,
          city: result.fieldValues?.city ?? prev.city,
          district: result.fieldValues?.district ?? prev.district,
          state: result.fieldValues?.state ?? prev.state,
          aadhaar_number: result.fieldValues?.aadhaar_number ?? prev.aadhaar_number,
          license_number: result.fieldValues?.license_number ?? prev.license_number,
        }));
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
    <div className="min-h-screen min-h-[100dvh] w-full flex flex-col lg:flex-row bg-[var(--color-canvas)] text-[var(--color-ink)] lg:h-screen lg:max-h-screen lg:overflow-hidden select-none">
      {/* ============================================================
          Left: Visual & Industrial Fleet Showcase Panel (Desktop only)
          40% width, restrained dark charcoal/cool gray surface
          ============================================================ */}
      <div className="relative hidden lg:flex flex-col justify-between h-full lg:w-[40%] p-8 xl:p-10 2xl:p-12 border-r border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)] overflow-hidden shrink-0">
        {/* Minimal atmospheric Reach Blue glow behind machine */}
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

        {/* Hero Central Content: Industrial & Fleet Platform Identity */}
        <div className="my-auto flex flex-col gap-6 xl:gap-8 max-w-md xl:max-w-lg z-10 py-4">
          <div className="flex flex-col gap-2">
            <h1 className="text-3xl sm:text-4xl xl:text-5xl font-bold tracking-tight text-[var(--color-ink)] leading-[1.1]">
              Manage your fleet.
              <br />
              <span className="text-sky-600 dark:text-sky-400">
                Track every hour.
              </span>
            </h1>
          </div>

          {/* Machine Showcase Stage with Ground Shadow Pedestal */}
          <div className="relative pt-2 pb-1 flex items-center justify-center">
            {/* Ground Shadow Pedestal under boom lift wheels */}
            <div className="absolute bottom-1 left-1/2 -translate-x-1/2 w-[90%] max-w-[360px] xl:max-w-[420px] h-6 bg-[radial-gradient(ellipse_at_center,rgba(0,0,0,0.18)_0%,rgba(0,0,0,0.04)_50%,transparent_70%)] dark:bg-[radial-gradient(ellipse_at_center,rgba(0,0,0,0.85)_0%,rgba(0,0,0,0.25)_50%,transparent_70%)] blur-[4px] pointer-events-none z-0" />

            {/* Industrial Machinery Transparent PNG Asset */}
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
          Right: Dedicated Registration Workspace (60% width on desktop)
          Clean floating card, responsive single-focus view on mobile
          ============================================================ */}
      <div className="relative flex-1 lg:w-[60%] w-full min-h-screen lg:h-full flex flex-col justify-between items-center px-4 py-6 sm:px-6 sm:py-8 lg:p-8 xl:p-12 overflow-y-auto bg-[var(--color-canvas)]">
        {/* Top Spacer for balanced desktop vertical distribution */}
        <div className="hidden lg:block w-full h-2 shrink-0" />
        <div className="w-full flex items-center justify-center my-auto py-2">
          <motion.div
            initial={{ opacity: 0, y: 8, scale: 0.99 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
            className="w-full max-w-xl lg:max-w-2xl bg-[var(--color-canvas-elevated)] rounded-2xl border border-[var(--color-hairline)] p-4 sm:p-6 lg:p-6.5 shadow-2xl text-[var(--color-ink)] relative overflow-hidden"
          >
            {/* Mobile Only: Top Header Logo */}
            <div className="flex lg:hidden flex-col items-center justify-center mb-3 sm:mb-4">
              <Link href="/" className="flex items-center group focus:outline-none" aria-label="Reach International">
                <ReachInternationalLogo variant="full" size={26} />
              </Link>
            </div>

            {/* Card Header — Clean title */}
            <div className="mb-3.5 sm:mb-4">
              <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-[var(--color-ink)]">
                Create an account
              </h2>
            </div>

            {/* Global Error Banner */}
            {state.error && Object.keys(fieldErrors).length === 0 && (
              <div className="mb-3.5">
                <Alert variant="error">{state.error}</Alert>
              </div>
            )}

            {/* Global Success Banner */}
            {state.message && !state.error && (
              <div className="mb-3.5">
                <Alert variant="success">{state.message}</Alert>
              </div>
            )}

            {/* Registration Form */}
            <form onSubmit={handleSubmit} className="flex flex-col gap-2.5 sm:gap-3">
              {/* Row 1: Full Name | Email */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 sm:gap-3">
                <Input
                  id="signup-full-name"
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

                <Input
                  id="signup-email"
                  name="email"
                  label="Email address"
                  type="email"
                  value={formValues.email}
                  onChange={(e) => handleChange("email", e.target.value)}
                  placeholder="rahul@domain.com"
                  required
                  autoComplete="email"
                  error={fieldErrors.email}
                  icon={<AnimatedMail size={15} />}
                />
              </div>

              {/* Row 2: Mobile Number | Role */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 sm:gap-3">
                <Input
                  id="signup-phone"
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
                    Role <span className="text-rose-500 font-semibold">*</span>
                  </label>
                  <input type="hidden" name="role" value={formValues.role} />
                  <SearchableSelect
                    options={signupRoleOptions}
                    value={formValues.role}
                    onChange={(val) => handleChange("role", val)}
                    placeholder="Select role..."
                    clearable={false}
                    error={fieldErrors.role}
                    className="w-full text-xs sm:text-[13px]"
                  />
                </div>
              </div>

              {/* Row 3: City | District | State (3-Column layout) */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 sm:gap-3">
                <Input
                  id="signup-city"
                  name="city"
                  label="City"
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
                  id="signup-district"
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

                <Input
                  id="signup-state"
                  name="state"
                  label="State"
                  type="text"
                  value={formValues.state}
                  onChange={(e) => handleChange("state", e.target.value)}
                  placeholder="Maharashtra"
                  required
                  autoComplete="address-level1"
                  error={fieldErrors.state}
                  icon={<AnimatedMapPin size={15} />}
                />
              </div>

              {/* Row 4: Aadhaar Card Number | Driving Licence Number */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 sm:gap-3">
                <Input
                  id="signup-aadhaar"
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
                  id="signup-license"
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

              {/* Row 5: Password | Confirm Password */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 sm:gap-3">
                <Input
                  id="signup-password"
                  name="password"
                  label="Password"
                  type="password"
                  value={formValues.password}
                  onChange={(e) => handleChange("password", e.target.value)}
                  placeholder="••••••••••••"
                  required
                  autoComplete="new-password"
                  error={fieldErrors.password}
                  icon={<AnimatedLock size={15} />}
                />

                <Input
                  id="signup-confirm-password"
                  name="confirm_password"
                  label="Confirm Password"
                  type="password"
                  value={formValues.confirm_password}
                  onChange={(e) => handleChange("confirm_password", e.target.value)}
                  placeholder="••••••••••••"
                  required
                  autoComplete="new-password"
                  error={fieldErrors.confirm_password}
                  icon={<AnimatedLock size={15} />}
                />
              </div>

              {/* Note banner */}
              <div className="rounded-lg bg-sky-500/10 border border-sky-500/20 py-2 px-3 text-[11px] sm:text-xs leading-relaxed text-sky-700 dark:text-sky-300">
                <strong>Note:</strong> Account status will be &ldquo;pending&rdquo; until approved by an administrator.
              </div>

              {/* Submit CTA Button */}
              <div className="pt-1">
                <Button
                  type="submit"
                  variant="primary"
                  size="lg"
                  fullWidth
                  loading={pending}
                  className="h-11 sm:h-11.5 rounded-lg font-semibold text-xs sm:text-sm shadow-xs justify-center"
                >
                  {pending ? "Requesting Platform Access..." : "Request Platform Access"}
                </Button>
              </div>
            </form>

            {/* Footer */}
            <div className="mt-3.5 pt-3 border-t border-[var(--color-hairline)] flex items-center justify-center gap-1.5 text-xs sm:text-[13px]">
              <span className="text-[var(--color-mute)]">
                Already have an account?
              </span>
              <Link
                href="/login"
                className="font-semibold text-sky-600 dark:text-sky-400 hover:underline transition-colors"
              >
                Sign in
              </Link>
            </div>
          </motion.div>
        </div>

        {/* Minimal Bottom Footer */}
        <div className="w-full flex items-center justify-center text-[10px] sm:text-[11px] font-mono text-[var(--color-mute)] shrink-0 pt-2 pb-1 text-center">
          <span>&copy; {new Date().getFullYear()} REACH INTERNATIONAL. ALL RIGHTS RESERVED.</span>
        </div>
      </div>
    </div>
  );
}