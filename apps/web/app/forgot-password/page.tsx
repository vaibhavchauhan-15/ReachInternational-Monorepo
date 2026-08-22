"use client";

import { useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  AnimatedMail,
  AnimatedAlertCircle,
  AnimatedCheckCircle,
  AnimatedArrowLeft,
  AnimatedKeyRound,
  AnimatedArrowRight,
} from "@/components/ui/animated-icons";
import { forgotPassword, type AuthFormState } from "@/app/actions/auth";
import { Button, Input } from "@/components/ui";

export default function ForgotPasswordPage() {
  const [state, setState] = useState<AuthFormState>({});
  const [pending, setPending] = useState(false);
  const [email, setEmail] = useState("");
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
      const result = await forgotPassword({}, formData);
      setState(result);

      if (result.fieldErrors) {
        setFieldErrors(result.fieldErrors);
      } else {
        setFieldErrors({});
      }

      if (result.fieldValues?.email !== undefined) {
        setEmail(result.fieldValues.email);
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
    <div className="flex min-h-screen items-center justify-center bg-background p-6 sm:p-12 text-foreground relative overflow-hidden">

      {/* Ambient background glow decoration */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div className="w-[450px] h-[450px] bg-sky-500/5 dark:bg-sky-500/10 rounded-full blur-3xl" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 12, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
        className="w-full max-w-md bg-card/80 backdrop-blur-xl rounded-2xl border border-border p-7 sm:p-9 shadow-2xl text-card-foreground relative overflow-hidden"
      >
        {/* Decorative top hairline glow */}
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-sky-500/50 to-transparent" />

        <Link
          href="/login"
          className="inline-flex items-center gap-2 text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors mb-6 group"
        >
          <AnimatedArrowLeft size={14} className="transition-transform group-hover:-translate-x-0.5" />
          Back to sign in
        </Link>

        <div className="flex flex-col gap-2 mb-7">
          <div className="h-10 w-10 rounded-xl bg-sky-500/10 border border-sky-500/20 flex items-center justify-center text-sky-600 dark:text-sky-400 mb-1">
            <AnimatedKeyRound size={20} />
          </div>
          <h2 className="text-2xl font-bold tracking-tight text-foreground">Reset password</h2>
          <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
            Enter your work email address and we&rsquo;ll send you a password reset link.
          </p>
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

        {state.message && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            className="flex items-start gap-3 rounded-xl bg-sky-500/10 border border-sky-500/20 p-3.5 mb-6 text-xs font-semibold text-sky-700 dark:text-sky-300"
          >
            <AnimatedCheckCircle size={16} className="text-sky-500 shrink-0 mt-0.5" />
            <span>{state.message}</span>
          </motion.div>
        )}

        <form action={handleSubmit} className="flex flex-col gap-4">
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

          <motion.div whileTap={{ scale: 0.98 }} className="pt-2">
            <Button
              type="submit"
              loading={pending}
              className="w-full h-11 text-xs font-semibold bg-primary text-primary-foreground hover:opacity-95 shadow-md flex items-center justify-center gap-2 rounded-xl transition-all"
            >
              {pending ? (
                "Sending..."
              ) : (
                <>
                  Send Reset Link
                  <AnimatedArrowRight size={16} />
                </>
              )}
            </Button>
          </motion.div>
        </form>
      </motion.div>
    </div>
  );
}