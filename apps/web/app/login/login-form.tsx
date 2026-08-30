"use client";

import { useState, useRef } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import {
  AnimatedMail,
  AnimatedLock,
  AnimatedEye,
  AnimatedEyeOff,
  AnimatedAlertCircle,
  AnimatedShieldCheck,
} from "@/components/ui/animated-icons";
import { Loader2 } from "lucide-react";
import { login, type AuthFormState } from "@/app/actions/auth";
import { ReachInternationalLogo } from "@/components/ui";

export function LoginFormClient() {
  const searchParams = useSearchParams();
  const urlError = searchParams.get("error");
  const urlMessage = searchParams.get("message");

  const resolvedUrlError = urlError
    ? urlError === "account_pending"
      ? "Your account is pending administrator approval. Please wait for an administrator to approve your account."
      : urlError === "account_inactive"
        ? "Your account has been deactivated. Contact your administrator."
        : urlError === "profile_not_found"
          ? "User profile not found. Please log in again or contact your administrator."
          : urlError
    : null;

  const [state, setState] = useState<AuthFormState>({});
  const [pending, setPending] = useState(false);
  const isSubmittingRef = useRef(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const handleEmailChange = (val: string) => {
    setEmail(val);
    if (fieldErrors.email) {
      setFieldErrors((prev) => {
        const copy = { ...prev };
        delete copy.email;
        return copy;
      });
    }
  };

  const handlePasswordChange = (val: string) => {
    setPassword(val);
    if (fieldErrors.password) {
      setFieldErrors((prev) => {
        const copy = { ...prev };
        delete copy.password;
        return copy;
      });
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
    isSubmittingRef.current = true;
    setPending(true);
    setState({});
    setFieldErrors({});

    const formData = new FormData(e.currentTarget);
    try {
      const result = await login({}, formData);
      setState(result);

      if (result.fieldErrors) {
        setFieldErrors(result.fieldErrors);
      } else {
        setFieldErrors({});
      }

      if (result.fieldValues) {
        if (result.fieldValues.email !== undefined) setEmail(result.fieldValues.email);
        if (result.fieldValues.password !== undefined) setPassword(result.fieldValues.password);
      }

      isSubmittingRef.current = false;
      setPending(false);
    } catch (err: unknown) {
      if (isRedirectError(err)) {
        // Keep pending=true and isSubmittingRef=true so button stays disabled & spinning while redirecting
        throw err;
      }
      isSubmittingRef.current = false;
      setPending(false);
      setState({ error: "An unexpected error occurred. Please try again." });
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8, scale: 0.99 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
      className="w-full max-w-[480px] sm:max-w-[500px] bg-[#111314] dark:bg-[#111314] [html:not(.dark)_&]:bg-[#FFFFFF] rounded-[14px] border border-[#26292C] dark:border-[#26292C] [html:not(.dark)_&]:border-[#E1E5E9] p-7 sm:p-9 shadow-[0_20px_60px_rgba(0,0,0,0.35)] [html:not(.dark)_&]:shadow-[0_20px_50px_rgba(0,0,0,0.06)] text-[#F5F7F8] dark:text-[#F5F7F8] [html:not(.dark)_&]:text-[#111315] relative overflow-hidden"
    >
      {/* Mobile Only: Top Header Logo & Portal Emblem */}
      <div className="flex lg:hidden flex-col items-center justify-center mb-6 gap-2">
        <Link href="/" className="flex items-center group focus:outline-none">
          <ReachInternationalLogo variant="full" size={30} />
        </Link>
        <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-[#00AEEF]/10 dark:bg-[#00AEEF]/15 border border-[#00AEEF]/20 text-[10px] font-mono font-medium text-[#00AEEF] dark:text-[#00AEEF] [html:not(.dark)_&]:text-[#008FD0]">
          <span className="h-1.5 w-1.5 rounded-full bg-[#18B981] animate-pulse" />
          Enterprise Fleet Platform
        </div>
      </div>

      {/* Card Header */}
      <div className="mb-6">
        <h2 className="text-2xl sm:text-[26px] font-bold tracking-tight text-[#F5F7F8] dark:text-[#F5F7F8] [html:not(.dark)_&]:text-[#111315]">
          Welcome back
        </h2>
      </div>

      {/* Global Error Banner */}
      {(state.error || resolvedUrlError) && Object.keys(fieldErrors).length === 0 && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          className="flex items-start gap-2.5 rounded-[9px] bg-rose-500/10 border border-rose-500/20 p-3 mb-5 text-xs font-semibold text-rose-600 dark:text-rose-400"
        >
          <AnimatedAlertCircle size={15} className="text-rose-500 shrink-0 mt-0.5" />
          <span>{state.error || resolvedUrlError}</span>
        </motion.div>
      )}

      {/* Global Success Banner */}
      {urlMessage && !state.error && !resolvedUrlError && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          className="flex items-start gap-2.5 rounded-[9px] bg-emerald-500/10 border border-emerald-500/20 p-3 mb-5 text-xs font-semibold text-emerald-600 dark:text-emerald-400"
        >
          <AnimatedShieldCheck size={15} className="text-emerald-500 shrink-0 mt-0.5" />
          <span>{urlMessage}</span>
        </motion.div>
      )}

      {/* Login Form */}
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        {/* Email Address Input */}
        <div className="flex flex-col gap-1.5 w-full">
          <label
            htmlFor="login-email"
            className="text-[13px] font-medium text-[#F5F7F8] dark:text-[#F5F7F8] [html:not(.dark)_&]:text-[#111315] select-none"
          >
            Email address
          </label>
          <div className="relative w-full flex items-center">
            <div className="absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none flex items-center justify-center text-[#969CA3] dark:text-[#969CA3] [html:not(.dark)_&]:text-[#626970]">
              <AnimatedMail size={16} />
            </div>
            <input
              id="login-email"
              name="email"
              type="email"
              value={email}
              onChange={(e) => handleEmailChange(e.target.value)}
              placeholder="vaibhav@company.com"
              required
              autoComplete="email"
              className={`w-full h-[48px] pl-10 pr-3.5 text-sm rounded-[9px] border bg-[#151718] dark:bg-[#151718] [html:not(.dark)_&]:bg-[#F1F3F5] text-[#F5F7F8] dark:text-[#F5F7F8] [html:not(.dark)_&]:text-[#111315] placeholder-[#969CA3]/60 dark:placeholder-[#969CA3]/60 [html:not(.dark)_&]:placeholder-[#626970]/70 transition-colors focus:outline-none focus:border-[#00AEEF] dark:focus:border-[#00AEEF] [html:not(.dark)_&]:focus:border-[#008FD0] focus:ring-3 focus:ring-[#00AEEF]/12 dark:focus:ring-[#00AEEF]/12 [html:not(.dark)_&]:focus:ring-[#008FD0]/12 ${
                fieldErrors.email
                  ? "border-rose-500 dark:border-rose-400 bg-rose-500/5 dark:bg-rose-500/10 focus:border-rose-500"
                  : "border-[#292C2F] dark:border-[#292C2F] [html:not(.dark)_&]:border-[#E1E5E9] hover:border-[#3A3E42] dark:hover:border-[#3A3E42] [html:not(.dark)_&]:hover:border-[#CBD5E1]"
              }`}
            />
          </div>
          {fieldErrors.email && (
            <p className="text-xs font-semibold text-rose-600 dark:text-rose-400 mt-0.5 flex items-center gap-1">
              {fieldErrors.email}
            </p>
          )}
        </div>

        {/* Password Input */}
        <div className="flex flex-col gap-1.5 w-full">
          <label
            htmlFor="login-password"
            className="text-[13px] font-medium text-[#F5F7F8] dark:text-[#F5F7F8] [html:not(.dark)_&]:text-[#111315] select-none"
          >
            Password
          </label>
          <div className="relative w-full flex items-center">
            <div className="absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none flex items-center justify-center text-[#969CA3] dark:text-[#969CA3] [html:not(.dark)_&]:text-[#626970]">
              <AnimatedLock size={16} />
            </div>
            <input
              id="login-password"
              name="password"
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(e) => handlePasswordChange(e.target.value)}
              placeholder="••••••••••••"
              required
              autoComplete="current-password"
              className={`w-full h-[48px] pl-10 pr-10 text-sm rounded-[9px] border bg-[#151718] dark:bg-[#151718] [html:not(.dark)_&]:bg-[#F1F3F5] text-[#F5F7F8] dark:text-[#F5F7F8] [html:not(.dark)_&]:text-[#111315] placeholder-[#969CA3]/60 dark:placeholder-[#969CA3]/60 [html:not(.dark)_&]:placeholder-[#626970]/70 transition-colors focus:outline-none focus:border-[#00AEEF] dark:focus:border-[#00AEEF] [html:not(.dark)_&]:focus:border-[#008FD0] focus:ring-3 focus:ring-[#00AEEF]/12 dark:focus:ring-[#00AEEF]/12 [html:not(.dark)_&]:focus:ring-[#008FD0]/12 ${
                fieldErrors.password
                  ? "border-rose-500 dark:border-rose-400 bg-rose-500/5 dark:bg-rose-500/10 focus:border-rose-500"
                  : "border-[#292C2F] dark:border-[#292C2F] [html:not(.dark)_&]:border-[#E1E5E9] hover:border-[#3A3E42] dark:hover:border-[#3A3E42] [html:not(.dark)_&]:hover:border-[#CBD5E1]"
              }`}
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[#969CA3] dark:text-[#969CA3] [html:not(.dark)_&]:text-[#626970] hover:text-[#F5F7F8] dark:hover:text-[#F5F7F8] [html:not(.dark)_&]:hover:text-[#111315] transition-colors p-1 rounded focus:outline-none"
              tabIndex={-1}
              aria-label={showPassword ? "Hide password" : "Show password"}
            >
              {showPassword ? <AnimatedEyeOff size={16} /> : <AnimatedEye size={16} />}
            </button>
          </div>
          {fieldErrors.password && (
            <p className="text-xs font-semibold text-rose-600 dark:text-rose-400 mt-0.5 flex items-center gap-1">
              {fieldErrors.password}
            </p>
          )}
        </div>

        {/* Remember Me & Forgot Password Row */}
        <div className="flex items-center justify-between pt-1">
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input
              type="checkbox"
              name="remember"
              className="h-4 w-4 rounded-[4px] border border-[#292C2F] dark:border-[#292C2F] [html:not(.dark)_&]:border-[#CBD5E1] bg-[#151718] dark:bg-[#151718] [html:not(.dark)_&]:bg-white accent-[#00AEEF] cursor-pointer focus:ring-0"
            />
            <span className="text-xs font-medium text-[#969CA3] dark:text-[#969CA3] [html:not(.dark)_&]:text-[#626970] hover:text-[#F5F7F8] dark:hover:text-[#F5F7F8] [html:not(.dark)_&]:hover:text-[#111315] transition-colors">
              Remember me
            </span>
          </label>
          <Link
            href="/forgot-password"
            className="text-xs font-semibold text-[#00AEEF] dark:text-[#00AEEF] [html:not(.dark)_&]:text-[#008FD0] hover:underline transition-colors"
          >
            Forgot password?
          </Link>
        </div>

        {/* Sign In Button — DESIGN.md compliant primary app button */}
        <div className="pt-2">
          <button
            type="submit"
            disabled={pending}
            className="w-full h-11 rounded-[6px] font-semibold text-sm transition-all duration-150 shadow-sm flex items-center justify-center gap-2 bg-sky-600 hover:bg-sky-700 dark:bg-sky-500 dark:hover:bg-sky-600 text-white disabled:opacity-50 disabled:cursor-not-allowed disabled:pointer-events-none active:scale-[0.98] cursor-pointer"
          >
            {pending ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin shrink-0 text-current" />
                <span>Signing in...</span>
              </>
            ) : (
              <span>Sign in to Reach Fleet</span>
            )}
          </button>
        </div>
      </form>

      {/* Card Footer: Request Access */}
      <div className="mt-6 pt-5 border-t border-[#26292C] dark:border-[#26292C] [html:not(.dark)_&]:border-[#E1E5E9] flex items-center justify-center gap-1.5 text-xs">
        <span className="text-[#969CA3] dark:text-[#969CA3] [html:not(.dark)_&]:text-[#626970]">
          Don&apos;t have access?
        </span>
        <Link
          href="/signup"
          className="font-semibold text-[#00AEEF] dark:text-[#00AEEF] [html:not(.dark)_&]:text-[#008FD0] hover:underline transition-colors inline-flex items-center gap-0.5"
        >
          <span>Request access</span>
          <span className="text-xs">→</span>
        </Link>
      </div>
    </motion.div>
  );
}

