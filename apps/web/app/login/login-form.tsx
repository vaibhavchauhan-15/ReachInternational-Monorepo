"use client";

import { useState, useRef } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import {
  AnimatedMail,
  AnimatedLock,
} from "@/components/ui/animated-icons";
import { login, type AuthFormState } from "@/app/actions/auth";
import {
  Button,
  Input,
  Alert,
  ReachInternationalLogo,
} from "@/components/ui";

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
      className="w-full max-w-md sm:max-w-[480px] lg:max-w-[500px] bg-[var(--color-canvas-elevated)] rounded-2xl border border-[var(--color-hairline)] p-5 sm:p-7 md:p-8 shadow-2xl text-[var(--color-ink)] relative overflow-hidden"
    >
      {/* Mobile Only: Top Header Logo */}
      <div className="flex lg:hidden flex-col items-center justify-center mb-4 sm:mb-6">
        <Link href="/" className="flex items-center group focus:outline-none" aria-label="Reach International">
          <ReachInternationalLogo variant="full" size={28} />
        </Link>
      </div>

      {/* Card Header */}
      <div className="mb-4 sm:mb-6">
        <h2 className="text-xl sm:text-2xl md:text-[26px] font-bold tracking-tight text-[var(--color-ink)]">
          Welcome back
        </h2>
      </div>

      {/* Global Error Banner */}
      {(state.error || resolvedUrlError) && Object.keys(fieldErrors).length === 0 && (
        <div className="mb-4 sm:mb-5">
          <Alert variant="error">
            {state.error || resolvedUrlError}
          </Alert>
        </div>
      )}

      {/* Global Success Banner */}
      {urlMessage && !state.error && !resolvedUrlError && (
        <div className="mb-4 sm:mb-5">
          <Alert variant="success">
            {urlMessage}
          </Alert>
        </div>
      )}

      {/* Login Form */}
      <form onSubmit={handleSubmit} className="flex flex-col gap-3.5 sm:gap-4">
        {/* Email Address Input */}
        <Input
          id="login-email"
          name="email"
          label="Email address"
          type="email"
          value={email}
          onChange={(e) => handleEmailChange(e.target.value)}
          placeholder="vaibhav@company.com"
          required
          autoComplete="email"
          error={fieldErrors.email}
          icon={<AnimatedMail size={15} />}
        />

        {/* Password Input */}
        <Input
          id="login-password"
          name="password"
          label="Password"
          type="password"
          value={password}
          onChange={(e) => handlePasswordChange(e.target.value)}
          placeholder="••••••••••••"
          required
          autoComplete="current-password"
          error={fieldErrors.password}
          icon={<AnimatedLock size={15} />}
        />

        {/* Remember Me & Forgot Password Row */}
        <div className="flex items-center justify-between pt-0.5">
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input
              type="checkbox"
              name="remember"
              className="h-4 w-4 rounded-[4px] border border-[var(--color-hairline)] bg-[var(--color-canvas)] accent-sky-600 cursor-pointer focus:ring-0"
            />
            <span className="text-xs font-medium text-[var(--color-mute)] hover:text-[var(--color-ink)] transition-colors">
              Remember me
            </span>
          </label>
          <Link
            href="/forgot-password"
            className="text-xs font-semibold text-sky-600 dark:text-sky-400 hover:underline transition-colors"
          >
            Forgot password?
          </Link>
        </div>

        {/* Sign In Button */}
        <div className="pt-1.5 sm:pt-2">
          <Button
            type="submit"
            variant="primary"
            size="lg"
            fullWidth
            loading={pending}
            className="h-11 sm:h-11.5 text-xs sm:text-sm font-semibold rounded-lg sm:rounded-[9px]"
          >
            Sign in
          </Button>
        </div>
      </form>

      {/* Card Footer: Request Access */}
      <div className="mt-5 sm:mt-6 pt-4 sm:pt-5 border-t border-[var(--color-hairline)] flex items-center justify-center gap-1.5 text-xs sm:text-[13px]">
        <span className="text-[var(--color-mute)]">
          Don&apos;t have access?
        </span>
        <Link
          href="/signup"
          className="font-semibold text-sky-600 dark:text-sky-400 hover:underline transition-colors"
        >
          Request access
        </Link>
      </div>
    </motion.div>
  );
}
