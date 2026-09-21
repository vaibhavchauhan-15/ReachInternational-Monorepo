"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  AnimatedLock,
  AnimatedArrowRight,
} from "@/components/ui/animated-icons";
import { resetPasswordAction } from "@/app/actions/auth";
import { Button, Input, Alert } from "@/components/ui";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

interface ResetPasswordCardProps {
  onSuccess?: () => void;
  onCancel?: () => void;
  showCancel?: boolean;
}

export function ResetPasswordCard({
  onSuccess,
  onCancel,
  showCancel = true,
}: ResetPasswordCardProps) {
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Real-time validation checks
  const hasMinLength = newPassword.length >= 8;
  const hasUppercase = /[A-Z]/.test(newPassword);
  const hasLowercase = /[a-z]/.test(newPassword);
  const hasDigit = /\d/.test(newPassword);
  const passwordsMatch =
    confirmPassword.length > 0 && newPassword === confirmPassword;

  const isFormValid =
    hasMinLength && hasUppercase && hasLowercase && hasDigit && passwordsMatch;

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    if (!newPassword || !confirmPassword) {
      setError("Please fill in both password fields.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    if (!hasMinLength || !hasUppercase || !hasLowercase || !hasDigit) {
      setError(
        "Password must be at least 8 characters long and contain uppercase, lowercase, and numeric characters."
      );
      return;
    }

    setPending(true);

    try {
      const result = await resetPasswordAction({
        newPassword,
        confirmPassword,
      });

      if (!result.success) {
        // Fallback: If Server Action experienced cookie synchronization delay, try browser client updateUser directly
        try {
          const supabase = createSupabaseBrowserClient();
          const { error: clientError } = await supabase.auth.updateUser({
            password: newPassword,
          });

          if (clientError) {
            setError(result.error || clientError.message || "Failed to reset password. Please try again.");
            return;
          }
        } catch {
          setError(result.error || "Failed to reset password. Please try again.");
          return;
        }
      }

      setSuccess(
        "Password updated successfully! You can now sign in with your new password."
      );
      if (onSuccess) {
        setTimeout(() => {
          onSuccess();
        }, 1800);
      }
    } catch (err: unknown) {
      const errorObj = err as { message?: string };
      setError(errorObj?.message || "An unexpected error occurred. Please try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="w-full">
      {/* Header */}
      <div className="mb-5 sm:mb-6">
        <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-[var(--color-ink)]">
          Set new password
        </h2>
        <p className="text-xs sm:text-sm text-[var(--color-mute)] mt-1 leading-relaxed">
          Create a strong password for your Reach International account.
        </p>
      </div>

      {/* Error Alert */}
      <AnimatePresence mode="wait">
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            className="mb-4"
          >
            <Alert variant="error">{error}</Alert>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Success Alert */}
      <AnimatePresence mode="wait">
        {success && (
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            className="mb-4"
          >
            <Alert variant="success">{success}</Alert>
          </motion.div>
        )}
      </AnimatePresence>

      {!success ? (
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {/* New Password Input */}
          <Input
            id="reset-new-password"
            name="newPassword"
            label="New password"
            type="password"
            value={newPassword}
            onChange={(e) => {
              setNewPassword(e.target.value);
              if (error) setError(null);
            }}
            placeholder="••••••••••••"
            required
            autoComplete="new-password"
            icon={<AnimatedLock size={15} />}
          />

          {/* Confirm Password Input */}
          <Input
            id="reset-confirm-password"
            name="confirmPassword"
            label="Confirm new password"
            type="password"
            value={confirmPassword}
            onChange={(e) => {
              setConfirmPassword(e.target.value);
              if (error) setError(null);
            }}
            placeholder="••••••••••••"
            required
            autoComplete="new-password"
            icon={<AnimatedLock size={15} />}
          />

          {/* Password Complexity Checklist */}
          <div className="rounded-xl border border-[var(--color-hairline)] bg-[var(--color-canvas)] p-3 space-y-1.5 text-[11px] font-mono">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-[var(--color-mute)] mb-1">
              Password requirements:
            </div>
            <div
              className={`flex items-center gap-2 transition-colors ${
                hasMinLength
                  ? "text-emerald-600 dark:text-emerald-400 font-medium"
                  : "text-[var(--color-mute)]"
              }`}
            >
              <span className="w-3.5 flex justify-center">
                {hasMinLength ? "✓" : "•"}
              </span>
              <span>At least 8 characters</span>
            </div>
            <div
              className={`flex items-center gap-2 transition-colors ${
                hasUppercase
                  ? "text-emerald-600 dark:text-emerald-400 font-medium"
                  : "text-[var(--color-mute)]"
              }`}
            >
              <span className="w-3.5 flex justify-center">
                {hasUppercase ? "✓" : "•"}
              </span>
              <span>At least one uppercase letter (A-Z)</span>
            </div>
            <div
              className={`flex items-center gap-2 transition-colors ${
                hasLowercase
                  ? "text-emerald-600 dark:text-emerald-400 font-medium"
                  : "text-[var(--color-mute)]"
              }`}
            >
              <span className="w-3.5 flex justify-center">
                {hasLowercase ? "✓" : "•"}
              </span>
              <span>At least one lowercase letter (a-z)</span>
            </div>
            <div
              className={`flex items-center gap-2 transition-colors ${
                hasDigit
                  ? "text-emerald-600 dark:text-emerald-400 font-medium"
                  : "text-[var(--color-mute)]"
              }`}
            >
              <span className="w-3.5 flex justify-center">
                {hasDigit ? "✓" : "•"}
              </span>
              <span>At least one number (0-9)</span>
            </div>
            {confirmPassword.length > 0 && (
              <div
                className={`flex items-center gap-2 transition-colors ${
                  passwordsMatch
                    ? "text-emerald-600 dark:text-emerald-400 font-medium"
                    : "text-rose-600 dark:text-rose-400"
                }`}
              >
                <span className="w-3.5 flex justify-center">
                  {passwordsMatch ? "✓" : "✕"}
                </span>
                <span>
                  {passwordsMatch ? "Passwords match" : "Passwords do not match"}
                </span>
              </div>
            )}
          </div>

          {/* Submit Button */}
          <div className="pt-2 flex flex-col gap-2.5">
            <Button
              type="submit"
              variant="primary"
              size="lg"
              fullWidth
              loading={pending}
              disabled={!isFormValid || pending}
              className="h-11 text-xs sm:text-sm font-semibold rounded-lg"
            >
              {pending ? (
                "Updating password..."
              ) : (
                <>
                  Update Password
                  <AnimatedArrowRight size={15} />
                </>
              )}
            </Button>

            {showCancel && onCancel && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                fullWidth
                onClick={onCancel}
                disabled={pending}
                className="h-10 sm:h-9 min-h-[40px] sm:min-h-[36px] text-xs font-medium rounded-lg"
              >
                Cancel and return to sign in
              </Button>
            )}
          </div>
        </form>
      ) : (
        <div className="pt-3">
          <Button
            type="button"
            variant="primary"
            fullWidth
            onClick={() => {
              if (onCancel) onCancel();
              else if (onSuccess) onSuccess();
            }}
            className="h-11 text-xs sm:text-sm font-semibold rounded-lg"
          >
            Go to Sign In
          </Button>
        </div>
      )}
    </div>
  );
}
