"use client";

import { useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  AnimatedMail,
  AnimatedLock,
  AnimatedAlertCircle,
  AnimatedShieldCheck,
  AnimatedArrowRight,
} from "@/components/ui/animated-icons";
import { login, type AuthFormState } from "@/app/actions/auth";
import { Button, Input } from "@/components/ui";

export function LoginFormClient() {
  const [state, setState] = useState<AuthFormState>({});
  const [pending, setPending] = useState(false);
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

  async function handleSubmit(formData: FormData) {
    setPending(true);
    setState({});

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
    } catch (err: unknown) {
      if (isRedirectError(err)) {
        throw err;
      }
      setState({ error: "An unexpected error occurred. Please try again." });
    } finally {
      setPending(false);
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 12, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
      className="w-full max-w-md bg-card/80 backdrop-blur-xl rounded-2xl border border-border p-7 sm:p-9 shadow-2xl text-card-foreground relative overflow-hidden"
    >
      {/* Decorative top hairline glow */}
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-sky-500/50 to-transparent" />

      <div className="mb-5">
        <h2 className="text-2xl font-bold tracking-tight text-foreground">Welcome back</h2>
      </div>

      {state.error && Object.keys(fieldErrors).length === 0 && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          className="flex items-start gap-3 rounded-xl bg-rose-500/10 border border-rose-500/20 p-3.5 mb-6 text-xs font-semibold text-rose-700 dark:text-rose-300"
        >
          <AnimatedAlertCircle size={16} className="text-rose-500 shrink-0 mt-0.5" />
          <span>{state.error}</span>
        </motion.div>
      )}

      <form action={handleSubmit} className="flex flex-col gap-4.5">
        <Input
          label="Email address"
          name="email"
          type="email"
          value={email}
          onChange={(e) => handleEmailChange(e.target.value)}
          error={fieldErrors.email}
          placeholder="vaibhav@company.com"
          icon={<AnimatedMail size={16} />}
          required
          autoComplete="email"
        />

        <Input
          label="Password"
          name="password"
          type="password"
          value={password}
          onChange={(e) => handlePasswordChange(e.target.value)}
          error={fieldErrors.password}
          placeholder="••••••••••••"
          icon={<AnimatedLock size={16} />}
          required
          autoComplete="current-password"
        />

        <div className="flex items-center justify-between pt-1">
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input
              type="checkbox"
              name="remember"
              className="h-4 w-4 rounded border-border bg-background text-sky-600 focus:ring-sky-500/20 cursor-pointer accent-sky-600"
            />
            <span className="text-xs font-medium text-muted-foreground hover:text-foreground transition-colors">Remember me</span>
          </label>
          <Link
            href="/forgot-password"
            className="text-xs font-semibold text-sky-600 dark:text-sky-400 hover:text-sky-500 hover:underline transition-colors"
          >
            Forgot password?
          </Link>
        </div>

        <motion.div whileTap={{ scale: 0.98 }} className="pt-2">
          <Button
            type="submit"
            loading={pending}
            className="w-full h-11 text-xs font-semibold bg-primary text-primary-foreground hover:opacity-95 shadow-md flex items-center justify-center gap-2 rounded-xl transition-all"
          >
            {pending ? (
              "Signing in..."
            ) : (
              <>
                Sign in to account
                <AnimatedArrowRight size={16} />
              </>
            )}
          </Button>
        </motion.div>
      </form>

      <div className="mt-7 pt-5 border-t border-border/80 flex flex-col gap-3">
        <div className="flex items-center justify-center gap-2 text-[11px] text-muted-foreground">
          <AnimatedShieldCheck size={14} className="text-emerald-500 shrink-0" />
          <span>Internal enterprise platform. Authorized personnel only.</span>
        </div>
        <div className="flex items-center justify-center gap-2 text-xs">
          <span className="text-muted-foreground">Don&apos;t have an account?</span>
          <Link
            href="/signup"
            className="text-xs font-semibold text-sky-600 dark:text-sky-400 hover:text-sky-500 hover:underline transition-colors"
          >
            Request access
          </Link>
        </div>
      </div>
    </motion.div>
  );
}
