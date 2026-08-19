"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  AnimatedMail,
  AnimatedLock,
  AnimatedUser,
  AnimatedPhone,
  AnimatedAlertCircle,
  AnimatedCheckCircle,
  AnimatedArrowRight,
  AnimatedArrowLeft,
} from "@/components/ui/animated-icons";
import { 
  CheckCircle2, 
  ShieldCheck, 
  Building2, 
  Wrench, 
  Package, 
  Activity, 
  Users, 
  CreditCard, 
  TrendingUp, 
  Truck, 
  UserCheck, 
  ShieldAlert 
} from "lucide-react";
import { signup, type AuthFormState } from "@/app/actions/auth";
import { Button, Input, SearchableSelect, ReachInternationalLogo } from "@/components/ui";
import type { SelectOption } from "@/components/ui/SearchableSelect";
import { ThemeToggle } from "@/components/theme/ThemeToggle";

const signupRoleOptions: SelectOption[] = [
  {
    value: "service_engineer",
    label: "Service Engineer",
    description: "Field operations & breakdown resolution",
    icon: <Wrench className="h-4 w-4 text-blue-500" />,
  },
  {
    value: "service_manager",
    label: "Service Manager",
    description: "Service planning, engineer dispatch & FSR approval",
    icon: <ShieldCheck className="h-4 w-4 text-indigo-500" />,
  },
  {
    value: "branch_manager",
    label: "Branch Manager",
    description: "Branch fleet, staff & store control",
    icon: <Building2 className="h-4 w-4 text-indigo-500" />,
  },
  {
    value: "store_manager",
    label: "Store Manager",
    description: "Inventory stock ledger & transfers",
    icon: <Package className="h-4 w-4 text-purple-500" />,
  },
  {
    value: "supervisor",
    label: "Supervisor",
    description: "Raise complaints & machine inspection",
    icon: <ShieldCheck className="h-4 w-4 text-teal-500" />,
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
    description: "Staff onboarding & payroll management",
    icon: <Users className="h-4 w-4 text-emerald-500" />,
  },
  {
    value: "finance_manager",
    label: "Accounts / Finance Manager",
    description: "Billing & financial reporting",
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
  {
    value: "admin",
    label: "Administrator",
    description: "Platform & user management",
    icon: <ShieldAlert className="h-4 w-4 text-amber-500" />,
  },
  {
    value: "super_admin",
    label: "Super Admin",
    description: "Platform owner & global multi-branch control",
    icon: <ShieldAlert className="h-4 w-4 text-red-500" />,
  },
];

export default function SignupPage() {
  const [state, setState] = useState<AuthFormState>({});
  const [pending, setPending] = useState(false);
  const [formValues, setFormValues] = useState({
    full_name: "",
    email: "",
    phone: "",
    role: "service_engineer",
    password: "",
    confirm_password: "",
  });
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const router = useRouter();

  const handleChange = (field: string, value: string) => {
    setFormValues((prev) => ({ ...prev, [field]: value }));
    if (fieldErrors[field]) {
      setFieldErrors((prev) => {
        const copy = { ...prev };
        delete copy[field];
        return copy;
      });
    }
  };

  async function handleSubmit(formData: FormData) {
    setPending(true);
    setState({});

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
      
      if (!result.error) {
        setTimeout(() => {
          router.push("/login?message=Signup successful! Please wait for admin approval.");
        }, 2000);
      }
    } catch {
      setState({ error: "An unexpected error occurred. Please try again." });
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex min-h-screen lg:h-screen w-full flex-col lg:flex-row bg-background text-foreground relative overflow-hidden">
      {/* Top Floating Controls */}
      <div className="absolute top-4 right-4 z-50 flex items-center gap-2.5">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-border/80 bg-card/80 backdrop-blur-md text-xs font-semibold text-muted-foreground hover:text-foreground hover:bg-card hover:border-border transition-all shadow-xs"
        >
          <AnimatedArrowLeft size={14} />
          <span>Home</span>
        </Link>
        <ThemeToggle />
      </div>

      {/* Left: Hero panel with mesh gradient & ambient glow */}
      <div className="mesh-gradient relative flex flex-col justify-between p-6 sm:p-10 lg:w-[45%] xl:w-[42%] lg:p-12 border-b lg:border-b-0 lg:border-r border-border overflow-hidden">
        {/* Soft background glow decoration */}
        <div className="absolute -top-24 -left-24 w-96 h-96 bg-sky-500/10 dark:bg-sky-500/15 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -right-24 w-96 h-96 bg-violet-500/10 dark:bg-violet-500/15 rounded-full blur-3xl pointer-events-none" />

        {/* Top Header / Logo */}
        <div className="flex items-center justify-between gap-4 z-10">
          <Link href="/" className="flex items-center group focus:outline-none">
            <ReachInternationalLogo variant="full" size={32} />
          </Link>
        </div>

        {/* Hero Central Content */}
        <div className="my-6 lg:my-8 flex flex-col gap-4 max-w-lg z-10">
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight text-foreground leading-[1.12]">
            Join your{" "}
            <span className="bg-gradient-to-r from-sky-500 via-indigo-500 to-violet-500 bg-clip-text text-transparent">
              organization
            </span>
          </h1>

          <p className="text-sm sm:text-base text-muted-foreground leading-relaxed">
            Create an account to access machine service tracking and automated dispatch alerts. Administrator authorization is required.
          </p>

          <div className="flex flex-col sm:flex-row flex-wrap gap-2.5 pt-1">
            <div className="flex items-center gap-2.5 text-xs font-semibold text-foreground bg-card/70 backdrop-blur-md px-3.5 py-2 rounded-xl border border-border/80 shadow-2xs">
              <CheckCircle2 className="h-4 w-4 text-sky-500" />
              Track Fleet Services
            </div>
            <div className="flex items-center gap-2.5 text-xs font-semibold text-foreground bg-card/70 backdrop-blur-md px-3.5 py-2 rounded-xl border border-border/80 shadow-2xs">
              <CheckCircle2 className="h-4 w-4 text-sky-500" />
              Automated Email Dispatch
            </div>
            <div className="flex items-center gap-2.5 text-xs font-semibold text-foreground bg-card/70 backdrop-blur-md px-3.5 py-2 rounded-xl border border-border/80 shadow-2xs">
              <CheckCircle2 className="h-4 w-4 text-sky-500" />
              Manage Machines
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="pt-4 border-t border-border/60 z-10">
          <p className="text-xs text-muted-foreground">
            By submitting this form, you agree to our terms of service and privacy policy.
          </p>
        </div>
      </div>

      {/* Right: Signup form panel - Takes up half screen width */}
      <div className="flex flex-1 items-center justify-center p-4 sm:p-6 lg:p-8 xl:p-12 bg-background relative overflow-y-auto lg:overflow-visible">
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="w-[500px] h-[500px] bg-sky-500/5 dark:bg-sky-500/10 rounded-full blur-3xl" />
        </div>

        <motion.div
          initial={{ opacity: 0, y: 12, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
          className="w-full max-w-xl lg:max-w-2xl xl:max-w-3xl bg-card/80 backdrop-blur-xl rounded-2xl border border-border p-6 sm:p-8 lg:p-10 shadow-2xl text-card-foreground relative overflow-hidden"
        >
          {/* Decorative top hairline glow */}
          <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-sky-500/50 to-transparent" />

          <div className="mb-6">
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">Create your account</h2>
            <p className="text-xs sm:text-sm text-muted-foreground mt-1">
              Fill in your details below to request access from your organization administrator.
            </p>
          </div>

          {state.error && Object.keys(fieldErrors).length === 0 && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              className="flex items-start gap-3 rounded-xl bg-rose-500/10 border border-rose-500/20 p-3.5 mb-5 text-xs font-semibold text-rose-700 dark:text-rose-300"
            >
              <AnimatedAlertCircle size={16} className="text-rose-500 shrink-0 mt-0.5" />
              <span>{state.error}</span>
            </motion.div>
          )}

          {state.message && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              className="flex items-start gap-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 p-3.5 mb-5 text-xs font-semibold text-emerald-700 dark:text-emerald-300"
            >
              <AnimatedCheckCircle size={16} className="text-emerald-500 shrink-0 mt-0.5" />
              <span>{state.message}</span>
            </motion.div>
          )}

          <form action={handleSubmit} className="flex flex-col gap-4">
            {/* 2-Column Input Grid for Signup */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input
                label="Full Name"
                name="full_name"
                type="text"
                value={formValues.full_name}
                onChange={(e) => handleChange("full_name", e.target.value)}
                error={fieldErrors.full_name}
                placeholder="Rahul Sharma"
                icon={<AnimatedUser size={16} />}
                required
                autoComplete="name"
              />

              <Input
                label="Email address"
                name="email"
                type="email"
                value={formValues.email}
                onChange={(e) => handleChange("email", e.target.value)}
                error={fieldErrors.email}
                placeholder="rahul@customdomain.in"
                icon={<AnimatedMail size={16} />}
                required
                autoComplete="email"
              />

              <Input
                label="Mobile Number"
                name="phone"
                type="tel"
                value={formValues.phone}
                onChange={(e) => handleChange("phone", e.target.value)}
                error={fieldErrors.phone}
                placeholder="+91 98765 43210"
                icon={<AnimatedPhone size={16} />}
                required
                autoComplete="tel"
              />

              <div>
                {/* Hidden Input for Form Submission */}
                <input type="hidden" name="role" value={formValues.role} />
                {/* Role Selector */}
                <SearchableSelect
                  label="Account Role Requested"
                  options={signupRoleOptions}
                  value={formValues.role}
                  onChange={(val) => handleChange("role", val)}
                  placeholder="Select account role..."
                  clearable={false}
                  error={fieldErrors.role}
                />
              </div>

              <Input
                label="Password"
                name="password"
                type="password"
                value={formValues.password}
                onChange={(e) => handleChange("password", e.target.value)}
                error={fieldErrors.password}
                placeholder="••••••••••••"
                icon={<AnimatedLock size={16} />}
                required
                autoComplete="new-password"
              />

              <Input
                label="Confirm Password"
                name="confirm_password"
                type="password"
                value={formValues.confirm_password}
                onChange={(e) => handleChange("confirm_password", e.target.value)}
                error={fieldErrors.confirm_password}
                placeholder="••••••••••••"
                icon={<AnimatedLock size={16} />}
                required
                autoComplete="new-password"
              />
            </div>

            <div className="bg-sky-500/10 border border-sky-500/20 rounded-xl p-3 text-xs leading-relaxed text-sky-700 dark:text-sky-300">
              <strong>Note:</strong> Account status will be &ldquo;pending&rdquo; until approved by an administrator.
            </div>

            <motion.div whileTap={{ scale: 0.98 }} className="pt-2">
              <Button
                type="submit"
                loading={pending}
                className="w-full h-11 text-xs font-semibold bg-primary text-primary-foreground hover:opacity-95 shadow-md flex items-center justify-center gap-2 rounded-xl transition-all"
              >
                {pending ? (
                  "Creating account..."
                ) : (
                  <>
                    Request Access
                    <AnimatedArrowRight size={16} />
                  </>
                )}
              </Button>
            </motion.div>
          </form>

          <div className="mt-6 pt-4 border-t border-border/80 flex items-center justify-center gap-2 text-xs text-muted-foreground">
            <span>Already have an account?</span>
            <Link
              href="/login"
              className="text-xs font-semibold text-sky-600 dark:text-sky-400 hover:text-sky-500 hover:underline transition-colors"
            >
              Sign in
            </Link>
          </div>
        </motion.div>
      </div>
    </div>
  );
}