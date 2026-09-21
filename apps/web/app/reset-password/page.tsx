"use client";

import { Suspense, useState, useEffect } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  AnimatedArrowLeft,
  AnimatedAlertCircle,
  AnimatedArrowRight,
} from "@/components/ui/animated-icons";
import { ReachInternationalLogo } from "@/components/ui";
import { ResetPasswordCard } from "@/components/auth/ResetPasswordCard";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

type TokenState = "verifying" | "valid" | "missing" | "invalid";

function ResetPasswordContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [tokenState, setTokenState] = useState<TokenState>("verifying");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function verifyRecoveryToken() {
      // Check if callback route sent us an error
      const callbackError = searchParams.get("error");
      if (callbackError) {
        setErrorMessage(
          searchParams.get("error_description") ||
            "This password reset link is invalid or has expired. Please request a new link."
        );
        setTokenState("invalid");
        return;
      }

      // Fallback: If code or token_hash arrived directly at /reset-password,
      // forward to server callback for secure PKCE exchange
      const code = searchParams.get("code");
      const tokenHash = searchParams.get("token_hash");
      if (code || tokenHash) {
        const query = new URLSearchParams(searchParams.toString());
        if (!query.has("next")) query.set("next", "/reset-password");
        window.location.replace(`/api/auth/callback?${query.toString()}`);
        return;
      }

      const hash = typeof window !== "undefined" ? window.location.hash : "";
      const hasRecoveryHash =
        hash.includes("type=recovery") || hash.includes("access_token=");

      // The server-side callback route already exchanged the PKCE code and set
      // session cookies. Check if we have an active session.
      const supabase = createSupabaseBrowserClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!isMounted) return;

      if (session) {
        setTokenState("valid");
        return;
      }

      // Listen for auth state changes (handles hash recovery and session cookie hydration)
      const {
        data: { subscription },
      } = supabase.auth.onAuthStateChange((event: string, session: unknown) => {
        if (!isMounted) return;
        if (
          event === "PASSWORD_RECOVERY" ||
          event === "SIGNED_IN" ||
          (event === "INITIAL_SESSION" && Boolean(session)) ||
          Boolean(session)
        ) {
          setTokenState("valid");
        }
      });

      // Grace period to allow cookies/storage hydration or hash processing
      const timeoutId = setTimeout(() => {
        if (!isMounted) return;
        subscription.unsubscribe();
        setTokenState((curr) => {
          if (curr === "verifying") {
            if (hasRecoveryHash) {
              setErrorMessage(
                "Unable to verify password reset token from link. Please request a new link."
              );
              return "invalid";
            }
            return "missing";
          }
          return curr;
        });
      }, 1200);

      return () => {
        subscription.unsubscribe();
        clearTimeout(timeoutId);
      };
    }

    verifyRecoveryToken();

    return () => {
      isMounted = false;
    };
  }, [searchParams]);

  return (
    <div className="min-h-screen min-h-[100dvh] w-full flex flex-col justify-between items-center px-4 py-6 sm:px-6 sm:py-8 lg:py-10 overflow-y-auto bg-[var(--color-canvas)] text-[var(--color-ink)] relative select-none">
      {/* Ambient background glow decoration */}
      <div className="fixed inset-0 flex items-center justify-center pointer-events-none z-0">
        <div className="w-[360px] sm:w-[480px] h-[360px] sm:h-[480px] bg-sky-500/5 dark:bg-sky-500/10 rounded-full blur-3xl" />
      </div>

      {/* Top Header / Brand Logo */}
      <div className="w-full flex items-center justify-center pt-1 sm:pt-2 pb-4 sm:pb-6 z-10 shrink-0">
        <Link
          href="/"
          className="inline-flex items-center group focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 rounded-lg transition-transform hover:scale-[1.01]"
          aria-label="Reach International Home"
        >
          <ReachInternationalLogo variant="full" size={26} />
        </Link>
      </div>

      {/* Center: Reset Password Card */}
      <div className="w-full flex items-center justify-center my-auto py-2 z-10">
        <motion.div
          initial={{ opacity: 0, y: 10, scale: 0.99 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
          className="w-full max-w-[420px] sm:max-w-[460px] bg-[var(--color-canvas-elevated)] backdrop-blur-xl rounded-2xl border border-[var(--color-hairline)] p-5 sm:p-7 md:p-8 shadow-2xl text-[var(--color-ink)] relative overflow-hidden"
        >
          {/* Decorative top hairline glow */}
          <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-sky-500/30 to-transparent" />

          <Link
            href="/login"
            className="inline-flex items-center gap-2 text-xs sm:text-[13px] font-medium text-[var(--color-mute)] hover:text-[var(--color-ink)] transition-colors mb-5 sm:mb-6 group py-1 min-h-[32px]"
          >
            <AnimatedArrowLeft
              size={14}
              className="transition-transform group-hover:-translate-x-0.5"
            />
            Back to sign in
          </Link>

          <AnimatePresence mode="wait">
            {/* State 1: Verifying token */}
            {tokenState === "verifying" && (
              <motion.div
                key="verifying"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex flex-col items-center justify-center py-8 text-center space-y-3"
              >
                <div className="h-9 w-9 rounded-full border-2 border-sky-500/20 border-t-sky-500 animate-spin" />
                <h3 className="text-sm font-semibold text-[var(--color-ink)]">
                  Verifying reset link...
                </h3>
                <p className="text-xs text-[var(--color-mute)] max-w-xs">
                  Please wait while we validate your secure token with Supabase.
                </p>
              </motion.div>
            )}

            {/* State 2: Missing token — Form is strictly BLOCKED */}
            {tokenState === "missing" && (
              <motion.div
                key="missing"
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="flex flex-col items-center justify-center py-2 text-center"
              >
                <div className="h-12 w-12 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-600 dark:text-amber-400 mb-3.5">
                  <AnimatedAlertCircle size={24} />
                </div>
                <h3 className="text-base sm:text-lg font-bold text-[var(--color-ink)] mb-1.5">
                  Reset Token Required
                </h3>
                <p className="text-xs text-[var(--color-mute)] leading-relaxed max-w-sm mb-6">
                  Resetting your password is not possible without the security link sent to your email. Please enter your email on the forgot password page to request a reset link.
                </p>
                <div className="w-full flex flex-col gap-2.5">
                  <Link
                    href="/forgot-password"
                    className="w-full h-11 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-xs sm:text-sm font-semibold flex items-center justify-center gap-2 transition-colors shadow-sm"
                  >
                    Request Reset Link
                    <AnimatedArrowRight size={15} />
                  </Link>
                  <Link
                    href="/login"
                    className="w-full h-10 rounded-xl border border-[var(--color-hairline)] hover:bg-[var(--color-canvas)] text-[var(--color-mute)] hover:text-[var(--color-ink)] text-xs font-medium flex items-center justify-center transition-colors"
                  >
                    Back to sign in
                  </Link>
                </div>
              </motion.div>
            )}

            {/* State 3: Invalid or expired token — Form is strictly BLOCKED */}
            {tokenState === "invalid" && (
              <motion.div
                key="invalid"
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="flex flex-col items-center justify-center py-2 text-center"
              >
                <div className="h-12 w-12 rounded-2xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-600 dark:text-rose-400 mb-3.5">
                  <AnimatedAlertCircle size={24} />
                </div>
                <h3 className="text-base sm:text-lg font-bold text-[var(--color-ink)] mb-1.5">
                  Invalid or Expired Link
                </h3>
                <p className="text-xs text-[var(--color-mute)] leading-relaxed max-w-sm mb-6">
                  {errorMessage ||
                    "This password reset link is invalid or has expired. Please request a new reset link."}
                </p>
                <div className="w-full flex flex-col gap-2.5">
                  <Link
                    href="/forgot-password"
                    className="w-full h-11 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-xs sm:text-sm font-semibold flex items-center justify-center gap-2 transition-colors shadow-sm"
                  >
                    Request New Reset Link
                    <AnimatedArrowRight size={15} />
                  </Link>
                  <Link
                    href="/login"
                    className="w-full h-10 rounded-xl border border-[var(--color-hairline)] hover:bg-[var(--color-canvas)] text-[var(--color-mute)] hover:text-[var(--color-ink)] text-xs font-medium flex items-center justify-center transition-colors"
                  >
                    Back to sign in
                  </Link>
                </div>
              </motion.div>
            )}

            {/* State 4: Valid token — Render ResetPasswordCard */}
            {tokenState === "valid" && (
              <motion.div
                key="valid"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              >
                <ResetPasswordCard
                  onSuccess={async () => {
                    // Sign out any temporary recovery session so user signs in cleanly with new credentials
                    try {
                      const supabase = createSupabaseBrowserClient();
                      await supabase.auth.signOut();
                    } catch {}

                    router.push(
                      "/login?message=" +
                        encodeURIComponent(
                          "Password reset successful! Please sign in with your new password."
                        )
                    );
                  }}
                  onCancel={() => {
                    router.push("/login");
                  }}
                  showCancel={true}
                />
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </div>

      {/* Minimal Bottom Footer */}
      <div className="w-full flex items-center justify-center text-[10px] sm:text-[11px] font-mono text-[var(--color-mute)] shrink-0 pt-4 sm:pt-6 pb-2 text-center z-10">
        <span>&copy; {new Date().getFullYear()} REACH INTERNATIONAL. ALL RIGHTS RESERVED.</span>
      </div>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen min-h-[100dvh] w-full flex items-center justify-center bg-[var(--color-canvas)]">
          <div className="w-full max-w-[420px] sm:max-w-[460px] h-[360px] animate-pulse rounded-2xl bg-[var(--color-canvas-elevated)] border border-[var(--color-hairline)] m-4" />
        </div>
      }
    >
      <ResetPasswordContent />
    </Suspense>
  );
}
