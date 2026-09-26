"use client";

import { useState, useEffect, useTransition } from "react";
import Link from "next/link";
import {
  Palette,
  ShieldCheck,
  FileText,
  Trash2,
  ChevronRight,
  ShieldAlert,
  KeyRound,
  Bell,
  CheckCircle2,
  XCircle,
  Lock,
  LogOut,
  BookOpen,
} from "lucide-react";
import { ThemeToggle } from "@/components/theme/ThemeToggle";
import { Button, Modal, PasswordInput, Switch, useToast } from "@/components/ui";
import { changePasswordAction, logout } from "@/app/actions/auth";
import type { User as UserType } from "@/lib/types/database";
import { UserProfileHeaderCard } from "@/components/profile/UserProfileHeaderCard";

const NOTIF_PREFS_KEY = "@reach:notification_preferences";

interface NotificationPreferences {
  shiftReminders: boolean;
  breakdownAlerts: boolean;
  assignmentAlerts: boolean;
  logSubmissions: boolean;
}

const DEFAULT_NOTIFS: NotificationPreferences = {
  shiftReminders: true,
  breakdownAlerts: true,
  assignmentAlerts: true,
  logSubmissions: true,
};

interface SettingsClientProps {
  user: UserType;
  profileDetail?: UserType | null;
}

export function SettingsClient({ user, profileDetail }: SettingsClientProps) {
  const { toast } = useToast();
  const [passwordModalOpen, setPasswordModalOpen] = useState(false);

  // Notifications State
  const [notifs, setNotifs] = useState<NotificationPreferences>(DEFAULT_NOTIFS);

  // Password Form State
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [isPendingPassword, startPasswordTransition] = useTransition();

  // Load notification preferences from localStorage
  useEffect(() => {
    try {
      const stored = localStorage.getItem(NOTIF_PREFS_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        queueMicrotask(() => {
          setNotifs((prev) => ({ ...prev, ...parsed }));
        });
      }
    } catch {
      // Ignore localStorage errors
    }
  }, []);

  const handleNotifToggle = (key: keyof NotificationPreferences, val: boolean) => {
    const updated = { ...notifs, [key]: val };
    setNotifs(updated);
    try {
      localStorage.setItem(NOTIF_PREFS_KEY, JSON.stringify(updated));
      toast(
        "success",
        "Preferences Saved",
        "Your notification settings have been updated."
      );
    } catch {
      // Ignore localStorage errors
    }
  };

  // Password Real-time Complexity & Strength Evaluation
  const hasMinLength = newPassword.length >= 8;
  const hasUpper = /[A-Z]/.test(newPassword);
  const hasLower = /[a-z]/.test(newPassword);
  const hasDigit = /\d/.test(newPassword);
  const hasSymbol = /[!@#$%^&*(),.?":{}|<>\-_+=\[\]]/.test(newPassword);

  const passwordsMatch =
    confirmPassword.length > 0 && newPassword === confirmPassword;

  // Real-time strength calculation (Weak, Medium, Strong)
  const strengthScore = (() => {
    if (!newPassword) return 0;
    if (newPassword.length < 8) return 1;
    let count = 0;
    if (hasUpper) count++;
    if (hasLower) count++;
    if (hasDigit) count++;
    if (hasSymbol) count++;

    if (count >= 4) return 3; // Strong
    if (count >= 2 && hasUpper && hasLower && hasDigit) return 2; // Medium
    return 1; // Weak
  })();

  const strengthMeta = {
    0: { label: "", color: "", bg: "" },
    1: {
      label: "Weak",
      color: "text-rose-600 dark:text-rose-400",
      bg: "bg-rose-500",
    },
    2: {
      label: "Medium",
      color: "text-amber-600 dark:text-amber-400",
      bg: "bg-amber-500",
    },
    3: {
      label: "Strong",
      color: "text-emerald-600 dark:text-emerald-400",
      bg: "bg-emerald-500",
    },
  }[strengthScore];

  const isPasswordFormValid =
    Boolean(currentPassword) &&
    hasMinLength &&
    hasUpper &&
    hasLower &&
    hasDigit &&
    passwordsMatch;

  const handlePasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError(null);

    if (!currentPassword) {
      setPasswordError("Current password is required.");
      return;
    }
    if (!hasMinLength) {
      setPasswordError("New password must be at least 8 characters long.");
      return;
    }
    if (!hasUpper || !hasLower || !hasDigit) {
      setPasswordError(
        "New password must contain at least one uppercase letter, one lowercase letter, and one number."
      );
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError("New passwords do not match. Please verify.");
      return;
    }

    startPasswordTransition(async () => {
      const res = await changePasswordAction({ currentPassword, newPassword });
      if (res.success) {
        toast(
          "success",
          "Password Updated",
          "Your password has been changed successfully."
        );
        setPasswordModalOpen(false);
        setCurrentPassword("");
        setNewPassword("");
        setConfirmPassword("");
      } else {
        const errMsg = res.error || "Failed to update password.";
        if (errMsg.toLowerCase().includes("current password") || errMsg.toLowerCase().includes("incorrect")) {
          setPasswordError("Current password is incorrect. Please check and try again.");
        } else {
          setPasswordError(errMsg);
        }
      }
    });
  };

  const isSuperAdmin = user.role === "super_admin";
  const displayUser = profileDetail || user;

  return (
    <div className="max-w-4xl mx-auto space-y-6 select-none pb-12">
      {/* ─── Page Title Header (Desktop/Tablet only; MobilePageHeader renders on mobile) ─── */}
      <div className="hidden sm:flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 pb-2 border-b border-[var(--color-hairline)]">
        <div>
          <h1 className="text-xl sm:text-2xl font-extrabold text-[var(--color-ink)] tracking-tight">
            Settings
          </h1>
          <p className="text-xs sm:text-sm text-[var(--color-mute)] mt-0.5">
            Manage account preferences, appearance, notifications, security, and system options.
          </p>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* SECTION 1: PROFILE & ACCOUNT OVERVIEW */}
      {/* ========================================================================= */}
      <UserProfileHeaderCard user={displayUser} />

      {/* ========================================================================= */}
      {/* 2-COLUMN RESPONSIVE GRID (DESKTOP) / STACKED (MOBILE) */}
      {/* ========================================================================= */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* LEFT COLUMN: APPEARANCE & NOTIFICATIONS */}
        <div className="space-y-5">
          {/* CARD 2: APPEARANCE & THEME */}
          <div className="border border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)] rounded-2xl p-4 sm:p-5 shadow-xs space-y-3">
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-sky-500/10 text-sky-600 dark:text-sky-400">
                <Palette size={16} />
              </div>
              <div>
                <h3 className="text-sm font-bold text-[var(--color-ink)]">
                  Appearance
                </h3>
                <p className="text-[11px] text-[var(--color-mute)]">
                  Switch between light, dark, or system color themes.
                </p>
              </div>
            </div>

            <div className="pt-2">
              <ThemeToggle variant="segmented" />
            </div>
          </div>

          {/* CARD 3: NOTIFICATION PREFERENCES */}
          <div className="border border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)] rounded-2xl p-4 sm:p-5 shadow-xs space-y-4">
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
                <Bell size={16} />
              </div>
              <div>
                <h3 className="text-sm font-bold text-[var(--color-ink)]">
                  Notifications
                </h3>
                <p className="text-[11px] text-[var(--color-mute)]">
                  Configure operational alerts and mobile reminders.
                </p>
              </div>
            </div>

            <div className="space-y-3 pt-1">
              <Switch
                label="Shift & Attendance Reminders"
                description="Alerts for shift start, clock-in, and log submission deadlines"
                checked={notifs.shiftReminders}
                onChange={(e) => handleNotifToggle("shiftReminders", e.target.checked)}
              />
              <div className="border-t border-[var(--color-hairline)] pt-3">
                <Switch
                  label="Breakdown & Maintenance Alerts"
                  description="Instant notifications when assigned equipment flags a breakdown"
                  checked={notifs.breakdownAlerts}
                  onChange={(e) => handleNotifToggle("breakdownAlerts", e.target.checked)}
                />
              </div>
              <div className="border-t border-[var(--color-hairline)] pt-3">
                <Switch
                  label="Equipment Fleet Assignments"
                  description="Notifications when machines or operators are updated in your roster"
                  checked={notifs.assignmentAlerts}
                  onChange={(e) => handleNotifToggle("assignmentAlerts", e.target.checked)}
                />
              </div>
              <div className="border-t border-[var(--color-hairline)] pt-3">
                <Switch
                  label="Daily Log Confirmations"
                  description="Confirmations for verified HMR submissions and approvals"
                  checked={notifs.logSubmissions}
                  onChange={(e) => handleNotifToggle("logSubmissions", e.target.checked)}
                />
              </div>
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: SECURITY & LEGAL */}
        <div className="space-y-5">
          {/* CARD 4: SECURITY & CREDENTIALS */}
          <div className="border border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)] rounded-2xl p-4 sm:p-5 shadow-xs space-y-4">
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                <Lock size={16} />
              </div>
              <div>
                <h3 className="text-sm font-bold text-[var(--color-ink)]">
                  Security & Password
                </h3>
                <p className="text-[11px] text-[var(--color-mute)]">
                  Manage authentication credentials and session encryption.
                </p>
              </div>
            </div>

            <div className="flex items-center justify-between p-3 rounded-xl bg-[var(--color-canvas)] border border-[var(--color-hairline)]">
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold text-[var(--color-ink)]">
                  Account Password
                </p>
                <p className="text-[11px] text-[var(--color-mute)] mt-0.5">
                  Update your authentication password securely.
                </p>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                icon={<KeyRound className="h-3.5 w-3.5" />}
                onClick={() => {
                  setPasswordError(null);
                  setPasswordModalOpen(true);
                }}
                className="text-xs font-semibold cursor-pointer shrink-0 shadow-2xs"
              >
                Change
              </Button>
            </div>

            <div className="p-3 rounded-xl bg-[var(--color-hairline-soft-surface)]/30 border border-[var(--color-hairline)] space-y-1.5 text-xs">
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-[var(--color-mute)]">Session Role:</span>
                <span className="font-bold text-[var(--color-ink)] uppercase">
                  {user.role}
                </span>
              </div>
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-[var(--color-mute)]">Data Protection:</span>
                <span className="font-medium text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                  <CheckCircle2 size={12} /> Supabase RLS Active
                </span>
              </div>
            </div>
          </div>

          {/* CARD 5: LEGAL & PLATFORM INFORMATION */}
          <div className="border border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)] rounded-2xl divide-y divide-[var(--color-hairline)] overflow-hidden shadow-xs">
            <div className="px-4 sm:px-5 py-3.5">
              <h3 className="text-sm font-bold text-[var(--color-ink)]">
                Legal & Platform
              </h3>
              <p className="text-[11px] text-[var(--color-mute)]">
                Terms of service, privacy compliance, and build telemetry.
              </p>
            </div>

            <Link
              href="/privacy"
              className="flex items-center justify-between px-4 sm:px-5 py-3 text-xs sm:text-sm font-medium text-[var(--color-ink)] hover:bg-[var(--color-canvas)] transition-colors min-h-[48px] group"
            >
              <span className="flex items-center gap-2.5">
                <ShieldCheck size={16} className="text-[var(--color-mute)] group-hover:text-emerald-500 transition-colors shrink-0" />
                Privacy Policy
              </span>
              <ChevronRight size={15} className="text-[var(--color-mute)] shrink-0" />
            </Link>

            <Link
              href="/terms"
              className="flex items-center justify-between px-4 sm:px-5 py-3 text-xs sm:text-sm font-medium text-[var(--color-ink)] hover:bg-[var(--color-canvas)] transition-colors min-h-[48px] group"
            >
              <span className="flex items-center gap-2.5">
                <FileText size={16} className="text-[var(--color-mute)] group-hover:text-sky-500 transition-colors shrink-0" />
                Terms of Service
              </span>
              <ChevronRight size={15} className="text-[var(--color-mute)] shrink-0" />
            </Link>

            <Link
              href="/account-deletion-guide"
              className="flex items-center justify-between px-4 sm:px-5 py-3 text-xs sm:text-sm font-medium text-[var(--color-ink)] hover:bg-[var(--color-canvas)] transition-colors min-h-[48px] group"
            >
              <span className="flex items-center gap-2.5">
                <BookOpen size={16} className="text-[var(--color-mute)] group-hover:text-amber-500 transition-colors shrink-0" />
                Account Deletion Guide
              </span>
              <ChevronRight size={15} className="text-[var(--color-mute)] shrink-0" />
            </Link>

            <div className="px-4 sm:px-5 py-3 bg-[var(--color-canvas)] flex items-center justify-between text-[11px] text-[var(--color-mute)]">
              <span>Reach International App</span>
              <span className="font-mono font-medium text-[var(--color-ink)]">v1.0.0</span>
            </div>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* SECTION 6: DANGER ZONE & SESSION SIGN OUT */}
      {/* ========================================================================= */}
      <div className="border border-rose-500/20 bg-rose-500/[0.03] rounded-2xl p-3.5 sm:p-5 shadow-xs space-y-3.5">
        <div>
          <h3 className="text-sm font-bold text-rose-600 dark:text-rose-400">
            Account Management & Danger Zone
          </h3>
          <p className="text-[11px] text-[var(--color-mute)] mt-0.5">
            Permanent account erasure and session sign out options.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2 border-t border-rose-500/15">
          {isSuperAdmin ? (
            <div className="flex items-center gap-2 text-xs text-[var(--color-mute)]">
              <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-amber-700 dark:text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-500/20">
                <ShieldAlert size={12} />
                Protected
              </span>
              <span>Super Administrator accounts cannot be deleted.</span>
            </div>
          ) : (
            <Link
              href="/delete-account"
              className="inline-flex items-center justify-center gap-1.5 w-full sm:w-auto h-11 sm:h-8.5 px-3.5 rounded-xl border border-rose-500/25 bg-rose-500/5 hover:bg-rose-500/10 text-xs font-bold text-rose-600 dark:text-rose-400 transition-colors cursor-pointer shadow-2xs"
            >
              <Trash2 className="h-3.5 w-3.5 text-rose-500 shrink-0" />
              <span>Delete Account</span>
            </Link>
          )}

          {/* Prominent Red Sign Out */}
          <form action={logout} className="w-full sm:w-auto">
            <Button
              type="submit"
              variant="ghost"
              size="sm"
              icon={<LogOut className="h-4 w-4 text-rose-500" />}
              className="w-full sm:w-auto h-11 sm:h-8.5 px-4 text-xs font-bold text-rose-600 dark:text-rose-400 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/25 transition-all cursor-pointer shadow-2xs justify-center"
            >
              Sign Out of Session
            </Button>
          </form>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* MODALS */}
      {/* ========================================================================= */}
      {/* 1. Change Password Modal */}
      {passwordModalOpen && (
        <Modal
          open={passwordModalOpen}
          onClose={() => setPasswordModalOpen(false)}
          title="Change Password"
          description="Enter your current password and choose a strong new password."
          size="md"
        >
          <form onSubmit={handlePasswordSubmit} className="space-y-4 pt-2">
            {passwordError && (
              <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-xs font-semibold text-rose-600 dark:text-rose-400 flex items-start gap-2">
                <XCircle size={15} className="shrink-0 mt-0.5 text-rose-500" />
                <span>{passwordError}</span>
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-[var(--color-ink)] mb-1">
                Current Password
              </label>
              <PasswordInput
                value={currentPassword}
                onChange={(e) => {
                  setCurrentPassword(e.target.value);
                  if (passwordError) setPasswordError(null);
                }}
                placeholder="Enter current password"
                required
                error={
                  passwordError?.toLowerCase().includes("current password")
                    ? passwordError
                    : undefined
                }
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[var(--color-ink)] mb-1">
                New Password
              </label>
              <PasswordInput
                value={newPassword}
                onChange={(e) => {
                  setNewPassword(e.target.value);
                  if (passwordError) setPasswordError(null);
                }}
                placeholder="At least 8 chars (uppercase, lowercase, number, symbol)"
                required
              />

              {/* Real-time Password Strength Meter */}
              {newPassword.length > 0 && (
                <div className="mt-2 space-y-1.5">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-[var(--color-mute)] font-medium">
                      Password strength:
                    </span>
                    <span className={`font-bold ${strengthMeta.color}`}>
                      {strengthMeta.label}
                    </span>
                  </div>
                  <div className="grid grid-cols-3 gap-1.5 h-1.5">
                    <div
                      className={`h-full rounded-full transition-colors ${
                        strengthScore >= 1 ? strengthMeta.bg : "bg-[var(--color-hairline)]"
                      }`}
                    />
                    <div
                      className={`h-full rounded-full transition-colors ${
                        strengthScore >= 2 ? strengthMeta.bg : "bg-[var(--color-hairline)]"
                      }`}
                    />
                    <div
                      className={`h-full rounded-full transition-colors ${
                        strengthScore >= 3 ? strengthMeta.bg : "bg-[var(--color-hairline)]"
                      }`}
                    />
                  </div>
                </div>
              )}

              {/* Real-time Requirements Checklist */}
              <div className="mt-2.5 p-2.5 rounded-xl bg-[var(--color-canvas)] border border-[var(--color-hairline)] grid grid-cols-2 gap-1.5 text-[11px]">
                <div
                  className={`flex items-center gap-1.5 transition-colors ${
                    hasMinLength
                      ? "text-emerald-600 dark:text-emerald-400 font-semibold"
                      : "text-[var(--color-mute)]"
                  }`}
                >
                  <span className="w-3 text-center">{hasMinLength ? "✓" : "•"}</span>
                  <span>8+ characters</span>
                </div>
                <div
                  className={`flex items-center gap-1.5 transition-colors ${
                    hasUpper
                      ? "text-emerald-600 dark:text-emerald-400 font-semibold"
                      : "text-[var(--color-mute)]"
                  }`}
                >
                  <span className="w-3 text-center">{hasUpper ? "✓" : "•"}</span>
                  <span>Uppercase (A-Z)</span>
                </div>
                <div
                  className={`flex items-center gap-1.5 transition-colors ${
                    hasLower
                      ? "text-emerald-600 dark:text-emerald-400 font-semibold"
                      : "text-[var(--color-mute)]"
                  }`}
                >
                  <span className="w-3 text-center">{hasLower ? "✓" : "•"}</span>
                  <span>Lowercase (a-z)</span>
                </div>
                <div
                  className={`flex items-center gap-1.5 transition-colors ${
                    hasDigit
                      ? "text-emerald-600 dark:text-emerald-400 font-semibold"
                      : "text-[var(--color-mute)]"
                  }`}
                >
                  <span className="w-3 text-center">{hasDigit ? "✓" : "•"}</span>
                  <span>Number (0-9)</span>
                </div>
                <div
                  className={`col-span-2 flex items-center gap-1.5 transition-colors ${
                    hasSymbol
                      ? "text-emerald-600 dark:text-emerald-400 font-semibold"
                      : "text-[var(--color-mute)]"
                  }`}
                >
                  <span className="w-3 text-center">{hasSymbol ? "✓" : "•"}</span>
                  <span>Special symbol (!@#$%^&*...)</span>
                </div>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[var(--color-ink)] mb-1">
                Confirm New Password
              </label>
              <PasswordInput
                value={confirmPassword}
                onChange={(e) => {
                  setConfirmPassword(e.target.value);
                  if (passwordError) setPasswordError(null);
                }}
                placeholder="Re-enter new password"
                required
              />

              {/* Real-time Match Indicator */}
              {confirmPassword.length > 0 && (
                <div className="mt-1.5">
                  {passwordsMatch ? (
                    <div className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                      <CheckCircle2 size={13} className="shrink-0" />
                      Passwords match
                    </div>
                  ) : (
                    <div className="text-[11px] font-semibold text-rose-600 dark:text-rose-400 flex items-center gap-1">
                      <XCircle size={13} className="shrink-0" />
                      Passwords do not match
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-[var(--color-hairline)]">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setPasswordModalOpen(false)}
                disabled={isPendingPassword}
                className="cursor-pointer"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                variant="primary"
                size="sm"
                loading={isPendingPassword}
                disabled={!isPasswordFormValid || isPendingPassword}
                className="cursor-pointer"
              >
                Update Password
              </Button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
