"use client";

import React, { useState, useTransition } from "react";
import Link from "next/link";
import {
  Avatar,
  Badge,
  Button,
  Card,
  Input,
  PasswordInput,
  Modal,
} from "@/components/ui";
import {
  AnimatedSettings,
  AnimatedShieldCheck,
  AnimatedCheck,
  AnimatedAlertTriangle,
} from "@/components/ui/animated-icons";
import {
  User as UserIcon,
  KeyRound,
  Clock,
  MapPin,
  Sun,
  Moon,
  Monitor,
  HelpCircle,
  BookOpen,
  Headphones,
  FileText,
  Lock,
  LogOut,
  CheckCircle2,
  AlertCircle,
  Building2,
  Shield,
  Smartphone,
  ExternalLink,
  ChevronRight,
  Info,
  Trash2,
} from "lucide-react";
import type { User as UserType } from "@/lib/types/database";
import { EditProfileModal } from "@/components/profile/EditProfileModal";
import { logout, changePasswordAction } from "@/app/actions/auth";
import { useTheme, type Theme } from "@/components/theme/ThemeProvider";
import { useRouter } from "next/navigation";

interface SettingsClientProps {
  user: UserType;
}

export function SettingsClient({ user }: SettingsClientProps) {
  const router = useRouter();
  const { theme, setTheme } = useTheme();

  // Modal states
  const [isEditProfileOpen, setIsEditProfileOpen] = useState(false);
  const [activeLegalModal, setActiveLegalModal] = useState<"privacy" | "terms" | "help" | "guide" | null>(null);
  const [showSignOutConfirm, setShowSignOutConfirm] = useState(false);

  // Change password states
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isChangingPassword, startPasswordTransition] = useTransition();
  const [passwordStatus, setPasswordStatus] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Active section scroll state
  const [activeSection, setActiveSection] = useState<"account" | "theme" | "support">("account");

  // Format shift timings
  const shiftDisplay = user.shift_time || (user.shift_start_time && user.shift_end_time 
    ? `${user.shift_start_time} - ${user.shift_end_time}` 
    : "General Shift (08:00 AM - 08:00 PM)");

  // Format full address
  const addressParts = [user.address, user.city, user.district, user.state].filter(Boolean);
  const fullAddress = addressParts.length > 0 ? addressParts.join(", ") : "No physical address registered.";

  // Format role label
  const roleLabel = (user.role || "operator").replace(/_/g, " ").toUpperCase();

  const handlePasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordStatus(null);

    if (!newPassword || newPassword.length < 6) {
      setPasswordStatus({ type: "error", text: "New password must be at least 6 characters." });
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordStatus({ type: "error", text: "New passwords do not match. Please verify." });
      return;
    }

    startPasswordTransition(async () => {
      const res = await changePasswordAction({
        currentPassword: currentPassword.trim() || undefined,
        newPassword: newPassword.trim(),
      });

      if (res.success) {
        setPasswordStatus({ type: "success", text: "Password changed successfully! Keep your credentials safe." });
        setCurrentPassword("");
        setNewPassword("");
        setConfirmPassword("");
      } else {
        setPasswordStatus({ type: "error", text: res.error || "Failed to change password. Please try again." });
      }
    });
  };

  return (
    <div className="min-h-screen bg-[var(--color-canvas)] pb-16">
      {/* Top Banner & Header */}
      <div className="border-b border-[var(--color-hairline)] bg-[var(--color-elevated)] px-4 sm:px-6 lg:px-8 py-6">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-blue-500/10 dark:bg-blue-400/10 flex items-center justify-center border border-blue-500/20 text-blue-600 dark:text-blue-400">
              <AnimatedSettings size={22} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-[var(--color-ink)]">
                  Settings & Preferences
                </h1>
                <Badge variant="active" dot>Active</Badge>
              </div>
              <p className="text-xs sm:text-sm text-[var(--color-mute)] mt-0.5">
                Manage your credentials, shift configuration, system appearance, and organization policies.
              </p>
            </div>
          </div>

          {/* Quick Nav Strip */}
          <div className="flex items-center gap-1.5 p-1 bg-[var(--color-canvas)] rounded-lg border border-[var(--color-hairline)] self-start md:self-auto overflow-x-auto">
            <button
              onClick={() => {
                setActiveSection("account");
                document.getElementById("section-account")?.scrollIntoView({ behavior: "smooth" });
              }}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
                activeSection === "account"
                  ? "bg-[var(--color-elevated)] text-[var(--color-ink)] shadow-xs border border-[var(--color-hairline)]"
                  : "text-[var(--color-mute)] hover:text-[var(--color-ink)]"
              }`}
            >
              My Account
            </button>
            <button
              onClick={() => {
                setActiveSection("theme");
                document.getElementById("section-theme")?.scrollIntoView({ behavior: "smooth" });
              }}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
                activeSection === "theme"
                  ? "bg-[var(--color-elevated)] text-[var(--color-ink)] shadow-xs border border-[var(--color-hairline)]"
                  : "text-[var(--color-mute)] hover:text-[var(--color-ink)]"
              }`}
            >
              Appearance
            </button>
            <button
              onClick={() => {
                setActiveSection("support");
                document.getElementById("section-support")?.scrollIntoView({ behavior: "smooth" });
              }}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
                activeSection === "support"
                  ? "bg-[var(--color-elevated)] text-[var(--color-ink)] shadow-xs border border-[var(--color-hairline)]"
                  : "text-[var(--color-mute)] hover:text-[var(--color-ink)]"
              }`}
            >
              About & Support
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 mt-6 space-y-8">
        
        {/* ========================================================================= */}
        {/* SECTION 1: ACCOUNT */}
        {/* ========================================================================= */}
        <section id="section-account" className="space-y-4">
          <div className="flex items-center gap-2">
            <UserIcon size={18} className="text-blue-600 dark:text-blue-400" />
            <h2 className="text-base sm:text-lg font-bold text-[var(--color-ink)]">
              Account & Credentials
            </h2>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* Profile Card */}
            <div className="lg:col-span-2 bg-[var(--color-elevated)] border border-[var(--color-hairline)] rounded-xl p-5 sm:p-6 shadow-xs flex flex-col justify-between">
              <div>
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-5 border-b border-[var(--color-hairline)]">
                  <div className="flex items-center gap-4">
                    <Avatar
                      name={user.full_name || "User"}
                      size="xl"
                      status="online"
                    />
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-lg font-bold text-[var(--color-ink)]">
                          {user.full_name || "Administrator"}
                        </h3>
                        <Badge variant="info">{roleLabel}</Badge>
                        {user.complete_profile && (
                          <Badge variant="success" dot>KYC Complete</Badge>
                        )}
                      </div>
                      <p className="text-xs sm:text-sm text-[var(--color-mute)] mt-0.5">
                        {user.email || "No email on record"}
                      </p>
                      {user.phone && (
                        <p className="text-xs text-[var(--color-mute)] mt-0.5 font-mono">
                          +{user.phone}
                        </p>
                      )}
                    </div>
                  </div>

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setIsEditProfileOpen(true)}
                    className="shrink-0"
                  >
                    Edit Profile
                  </Button>
                </div>

                {/* Account Details 2x2 Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-5">
                  <div className="flex items-start gap-3 p-3 rounded-lg bg-[var(--color-canvas)] border border-[var(--color-hairline)]">
                    <Clock size={16} className="text-sky-500 shrink-0 mt-0.5" />
                    <div>
                      <p className="text-[11px] font-bold uppercase tracking-wider text-[var(--color-mute)]">
                        Shift & Working Hours
                      </p>
                      <p className="text-xs sm:text-sm font-semibold text-[var(--color-ink)] mt-0.5">
                        {shiftDisplay}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3 p-3 rounded-lg bg-[var(--color-canvas)] border border-[var(--color-hairline)]">
                    <MapPin size={16} className="text-amber-500 shrink-0 mt-0.5" />
                    <div>
                      <p className="text-[11px] font-bold uppercase tracking-wider text-[var(--color-mute)]">
                        Base Yard & City
                      </p>
                      <p className="text-xs sm:text-sm font-semibold text-[var(--color-ink)] mt-0.5">
                        {[user.city, user.state].filter(Boolean).join(", ") || "Corporate HQ / Unassigned"}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3 p-3 rounded-lg bg-[var(--color-canvas)] border border-[var(--color-hairline)]">
                    <Shield size={16} className="text-indigo-500 shrink-0 mt-0.5" />
                    <div>
                      <p className="text-[11px] font-bold uppercase tracking-wider text-[var(--color-mute)]">
                        Aadhaar KYC
                      </p>
                      <p className="text-xs sm:text-sm font-semibold font-mono text-[var(--color-ink)] mt-0.5">
                        {user.aadhaar_number
                          ? `XXXX-XXXX-${user.aadhaar_number.slice(-4)}`
                          : "Not Submitted"}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3 p-3 rounded-lg bg-[var(--color-canvas)] border border-[var(--color-hairline)]">
                    <FileText size={16} className="text-emerald-500 shrink-0 mt-0.5" />
                    <div>
                      <p className="text-[11px] font-bold uppercase tracking-wider text-[var(--color-mute)]">
                        Equipment Driving Licence
                      </p>
                      <p className="text-xs sm:text-sm font-semibold font-mono uppercase text-[var(--color-ink)] mt-0.5">
                        {user.license_number || "Not Submitted"}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Full Address Bar */}
              <div className="mt-4 pt-4 border-t border-[var(--color-hairline)] flex items-start gap-2">
                <MapPin size={14} className="text-[var(--color-mute)] shrink-0 mt-0.5" />
                <p className="text-xs text-[var(--color-mute)] leading-relaxed">
                  <span className="font-semibold text-[var(--color-ink)]">Registered Address:</span> {fullAddress}
                </p>
              </div>
            </div>

            {/* Change Password Card */}
            <div className="bg-[var(--color-elevated)] border border-[var(--color-hairline)] rounded-xl p-5 sm:p-6 shadow-xs flex flex-col justify-between">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <KeyRound size={16} className="text-blue-600 dark:text-blue-400" />
                  <h3 className="text-sm font-bold text-[var(--color-ink)]">
                    Change Password
                  </h3>
                </div>
                <p className="text-xs text-[var(--color-mute)] mb-4">
                  Update your authentication password. Minimum 6 characters required.
                </p>

                {passwordStatus && (
                  <div
                    className={`p-3 rounded-lg text-xs flex items-start gap-2 mb-4 border ${
                      passwordStatus.type === "success"
                        ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/20"
                        : "bg-rose-500/10 text-rose-700 dark:text-rose-300 border-rose-500/20"
                    }`}
                  >
                    {passwordStatus.type === "success" ? (
                      <CheckCircle2 size={15} className="shrink-0 mt-0.5 text-emerald-600 dark:text-emerald-400" />
                    ) : (
                      <AlertCircle size={15} className="shrink-0 mt-0.5 text-rose-600 dark:text-rose-400" />
                    )}
                    <span>{passwordStatus.text}</span>
                  </div>
                )}

                <form onSubmit={handlePasswordSubmit} className="space-y-3">
                  <PasswordInput
                    label="Current Password"
                    placeholder="Enter current password"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    showLockIcon
                  />

                  <PasswordInput
                    label="New Password"
                    placeholder="At least 6 characters"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    showLockIcon
                  />

                  <PasswordInput
                    label="Confirm New Password"
                    placeholder="Re-enter new password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    showLockIcon
                  />

                  <Button
                    type="submit"
                    variant="primary"
                    size="sm"
                    fullWidth
                    loading={isChangingPassword}
                    disabled={isChangingPassword || !newPassword}
                    className="mt-2"
                  >
                    Update Password
                  </Button>
                </form>
              </div>

              <div className="mt-4 pt-3 border-t border-[var(--color-hairline)]">
                <p className="text-[11px] text-[var(--color-mute)] flex items-center gap-1.5">
                  <Lock size={12} className="shrink-0" />
                  Passwords are encrypted end-to-end via Supabase Auth.
                </p>
              </div>
            </div>

          </div>
        </section>

        {/* ========================================================================= */}
        {/* SECTION 2: THEME */}
        {/* ========================================================================= */}
        <section id="section-theme" className="space-y-4">
          <div className="flex items-center gap-2">
            <Sun size={18} className="text-amber-500" />
            <h2 className="text-base sm:text-lg font-bold text-[var(--color-ink)]">
              Appearance & Theme
            </h2>
          </div>

          <div className="bg-[var(--color-elevated)] border border-[var(--color-hairline)] rounded-xl p-5 sm:p-6 shadow-xs">
            <div className="mb-4">
              <h3 className="text-sm font-bold text-[var(--color-ink)]">
                Interface Color Scheme
              </h3>
              <p className="text-xs text-[var(--color-mute)] mt-0.5">
                Select your preferred visual style or automatically synchronize with your operating system preferences.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {/* Light Mode Option */}
              <button
                type="button"
                onClick={() => setTheme("light")}
                className={`p-4 rounded-xl border text-left transition-all ${
                  theme === "light"
                    ? "border-blue-500 bg-blue-500/5 ring-2 ring-blue-500/20 shadow-xs"
                    : "border-[var(--color-hairline)] bg-[var(--color-canvas)] hover:border-slate-300 dark:hover:border-zinc-700"
                }`}
              >
                <div className="h-20 rounded-lg bg-white border border-slate-200 p-2.5 flex flex-col justify-between mb-3 shadow-xs">
                  <div className="flex items-center justify-between">
                    <div className="h-2 w-12 bg-slate-200 rounded-full" />
                    <div className="h-3 w-3 rounded-full bg-amber-500" />
                  </div>
                  <div className="space-y-1">
                    <div className="h-1.5 w-full bg-slate-100 rounded-full" />
                    <div className="h-1.5 w-3/4 bg-slate-100 rounded-full" />
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Sun size={15} className="text-amber-500" />
                    <span className="text-xs font-bold text-[var(--color-ink)]">Light</span>
                  </div>
                  {theme === "light" && (
                    <AnimatedCheck size={14} className="text-blue-600 dark:text-blue-400 font-bold" />
                  )}
                </div>
                <p className="text-[11px] text-[var(--color-mute)] mt-1">
                  Clean crisp high-contrast daylight layout
                </p>
              </button>

              {/* Dark Mode Option */}
              <button
                type="button"
                onClick={() => setTheme("dark")}
                className={`p-4 rounded-xl border text-left transition-all ${
                  theme === "dark"
                    ? "border-blue-500 bg-blue-500/5 ring-2 ring-blue-500/20 shadow-xs"
                    : "border-[var(--color-hairline)] bg-[var(--color-canvas)] hover:border-slate-300 dark:hover:border-zinc-700"
                }`}
              >
                <div className="h-20 rounded-lg bg-zinc-950 border border-zinc-800 p-2.5 flex flex-col justify-between mb-3 shadow-xs">
                  <div className="flex items-center justify-between">
                    <div className="h-2 w-12 bg-zinc-800 rounded-full" />
                    <div className="h-3 w-3 rounded-full bg-sky-400" />
                  </div>
                  <div className="space-y-1">
                    <div className="h-1.5 w-full bg-zinc-800/80 rounded-full" />
                    <div className="h-1.5 w-3/4 bg-zinc-800/80 rounded-full" />
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Moon size={15} className="text-sky-400" />
                    <span className="text-xs font-bold text-[var(--color-ink)]">Dark</span>
                  </div>
                  {theme === "dark" && (
                    <AnimatedCheck size={14} className="text-blue-600 dark:text-blue-400 font-bold" />
                  )}
                </div>
                <p className="text-[11px] text-[var(--color-mute)] mt-1">
                  Sleek OLED dark mode tailored for low-light environments
                </p>
              </button>

              {/* System Option */}
              <button
                type="button"
                onClick={() => setTheme("system")}
                className={`p-4 rounded-xl border text-left transition-all ${
                  theme === "system"
                    ? "border-blue-500 bg-blue-500/5 ring-2 ring-blue-500/20 shadow-xs"
                    : "border-[var(--color-hairline)] bg-[var(--color-canvas)] hover:border-slate-300 dark:hover:border-zinc-700"
                }`}
              >
                <div className="h-20 rounded-lg bg-gradient-to-r from-white to-zinc-900 border border-slate-300 dark:border-zinc-800 p-2.5 flex flex-col justify-between mb-3 shadow-xs">
                  <div className="flex items-center justify-between">
                    <div className="h-2 w-12 bg-slate-300 rounded-full" />
                    <div className="h-3 w-3 rounded-full bg-blue-500" />
                  </div>
                  <div className="space-y-1">
                    <div className="h-1.5 w-full bg-slate-200/60 rounded-full" />
                    <div className="h-1.5 w-3/4 bg-slate-200/60 rounded-full" />
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Monitor size={15} className="text-slate-500" />
                    <span className="text-xs font-bold text-[var(--color-ink)]">System</span>
                  </div>
                  {theme === "system" && (
                    <AnimatedCheck size={14} className="text-blue-600 dark:text-blue-400 font-bold" />
                  )}
                </div>
                <p className="text-[11px] text-[var(--color-mute)] mt-1">
                  Automatically sync with your operating system preference
                </p>
              </button>
            </div>
          </div>
        </section>

        {/* ========================================================================= */}
        {/* SECTION 3: ABOUT & SUPPORT */}
        {/* ========================================================================= */}
        <section id="section-support" className="space-y-4">
          <div className="flex items-center gap-2">
            <HelpCircle size={18} className="text-indigo-500" />
            <h2 className="text-base sm:text-lg font-bold text-[var(--color-ink)]">
              About & Support
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            
            {/* Help Desk */}
            <div className="bg-[var(--color-elevated)] border border-[var(--color-hairline)] rounded-xl p-5 shadow-xs flex flex-col justify-between">
              <div>
                <div className="h-9 w-9 rounded-lg bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center mb-3">
                  <HelpCircle size={18} />
                </div>
                <h3 className="text-sm font-bold text-[var(--color-ink)]">Help & FAQ</h3>
                <p className="text-xs text-[var(--color-mute)] mt-1 leading-relaxed">
                  Frequently asked questions about machine inventory, hourly logs, and assignment rosters.
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setActiveLegalModal("help")}
                className="mt-4 justify-between"
              >
                <span>View Help Center</span>
                <ChevronRight size={14} />
              </Button>
            </div>

            {/* Operator Guide */}
            <div className="bg-[var(--color-elevated)] border border-[var(--color-hairline)] rounded-xl p-5 shadow-xs flex flex-col justify-between">
              <div>
                <div className="h-9 w-9 rounded-lg bg-teal-500/10 text-teal-600 dark:text-teal-400 flex items-center justify-center mb-3">
                  <BookOpen size={18} />
                </div>
                <h3 className="text-sm font-bold text-[var(--color-ink)]">Operator Guide</h3>
                <p className="text-xs text-[var(--color-mute)] mt-1 leading-relaxed">
                  Operating manual for field staff covering pre-start inspection, meter logging, and breakdown alerts.
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setActiveLegalModal("guide")}
                className="mt-4 justify-between"
              >
                <span>Read Operator Guide</span>
                <ChevronRight size={14} />
              </Button>
            </div>

            {/* Contact Support */}
            <div className="bg-[var(--color-elevated)] border border-[var(--color-hairline)] rounded-xl p-5 shadow-xs flex flex-col justify-between">
              <div>
                <div className="h-9 w-9 rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center mb-3">
                  <Headphones size={18} />
                </div>
                <h3 className="text-sm font-bold text-[var(--color-ink)]">Contact Support</h3>
                <p className="text-xs text-[var(--color-mute)] mt-1 leading-relaxed">
                  24/7 technical assistance for fleet supervisors, engineers, and machine operators.
                </p>
              </div>
              <a
                href="mailto:info@reachinternational.co.in"
                className="mt-4 inline-flex items-center justify-between px-3 py-2 text-xs font-semibold rounded-md border border-[var(--color-hairline)] bg-[var(--color-canvas)] text-[var(--color-ink)] hover:bg-[var(--color-elevated)] transition-colors"
              >
                <span>info@reachinternational.co.in</span>
                <ExternalLink size={13} className="text-[var(--color-mute)]" />
              </a>
            </div>

            {/* Privacy Policy */}
            <div className="bg-[var(--color-elevated)] border border-[var(--color-hairline)] rounded-xl p-5 shadow-xs flex flex-col justify-between">
              <div>
                <div className="h-9 w-9 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mb-3">
                  <Shield size={18} />
                </div>
                <h3 className="text-sm font-bold text-[var(--color-ink)]">Privacy Policy</h3>
                <p className="text-xs text-[var(--color-mute)] mt-1 leading-relaxed">
                  How Reach International handles employee KYC data, GPS telematics, and duty logs.
                </p>
              </div>
              <Link
                href="/privacy"
                className="mt-4 inline-flex items-center justify-between px-3 py-2 text-xs font-semibold rounded-md border border-[var(--color-hairline)] bg-[var(--color-canvas)] text-[var(--color-ink)] hover:bg-[var(--color-elevated)] transition-colors"
              >
                <span>Read Privacy Policy</span>
                <ChevronRight size={14} className="text-[var(--color-mute)]" />
              </Link>
            </div>

            {/* Terms of Service */}
            <div className="bg-[var(--color-elevated)] border border-[var(--color-hairline)] rounded-xl p-5 shadow-xs flex flex-col justify-between">
              <div>
                <div className="h-9 w-9 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center mb-3">
                  <FileText size={18} />
                </div>
                <h3 className="text-sm font-bold text-[var(--color-ink)]">Terms of Service</h3>
                <p className="text-xs text-[var(--color-mute)] mt-1 leading-relaxed">
                  Enterprise platform usage terms, equipment safety liability, and account responsibilities.
                </p>
              </div>
              <Link
                href="/terms"
                className="mt-4 inline-flex items-center justify-between px-3 py-2 text-xs font-semibold rounded-md border border-[var(--color-hairline)] bg-[var(--color-canvas)] text-[var(--color-ink)] hover:bg-[var(--color-elevated)] transition-colors"
              >
                <span>Read Terms of Service</span>
                <ChevronRight size={14} className="text-[var(--color-mute)]" />
              </Link>
            </div>

            {/* Application Details */}
            <div className="bg-[var(--color-elevated)] border border-[var(--color-hairline)] rounded-xl p-5 shadow-xs flex flex-col justify-between">
              <div>
                <div className="h-9 w-9 rounded-lg bg-purple-500/10 text-purple-600 dark:text-purple-400 flex items-center justify-center mb-3">
                  <Info size={18} />
                </div>
                <h3 className="text-sm font-bold text-[var(--color-ink)]">System Version</h3>
                <div className="mt-2 space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-[var(--color-mute)]">Web App</span>
                    <span className="font-mono font-bold text-[var(--color-ink)]">v1.2.0 (Build 2026.09)</span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-[var(--color-mute)]">Design System</span>
                    <span className="font-mono font-medium text-[var(--color-ink)]">Vercel Geist System</span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-[var(--color-mute)]">Environment</span>
                    <Badge variant="success">Production Ready</Badge>
                  </div>
                </div>
              </div>
              <p className="text-[11px] text-[var(--color-mute)] mt-4 pt-3 border-t border-[var(--color-hairline)] flex flex-wrap items-center justify-between gap-2">
                <span>Reach International • Reaching All Heights</span>
                <a href="https://www.reachinternational.co.in" target="_blank" rel="noopener noreferrer" className="text-[var(--color-link)] hover:underline">
                  www.reachinternational.co.in
                </a>
              </p>
            </div>

          </div>
        </section>

        {/* ========================================================================= */}
        {/* ACCOUNT & DATA DELETION SECTION */}
        {/* ========================================================================= */}
        <section className="pt-4 border-t border-[var(--color-hairline)]">
          <div className="bg-[var(--color-canvas-elevated)] border border-[var(--color-hairline)] rounded-xl p-5 sm:p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <h3 className="text-sm font-bold text-[var(--color-ink)]">
                Account & Data Deletion
              </h3>
              <p className="text-xs text-[var(--color-mute)] mt-0.5">
                Submit a permanent account de-provisioning and personal data erasure request under data protection regulations.
              </p>
            </div>
            <Link
              href="/account-deletion"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold border border-rose-500/30 text-rose-600 dark:text-rose-400 bg-rose-500/5 hover:bg-rose-500/10 transition-colors shrink-0"
            >
              <Trash2 size={14} />
              <span>Request Deletion</span>
            </Link>
          </div>
        </section>

        {/* ========================================================================= */}
        {/* SIGN OUT SECTION */}
        {/* ========================================================================= */}
        <section className="pt-4 border-t border-[var(--color-hairline)]">
          <div className="bg-rose-500/5 border border-rose-500/20 rounded-xl p-5 sm:p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <h3 className="text-sm font-bold text-rose-600 dark:text-rose-400">
                Sign Out of Account
              </h3>
              <p className="text-xs text-[var(--color-mute)] mt-0.5">
                Terminate your active browser session on this computer. You will need to log back in to access fleet records.
              </p>
            </div>
            <Button
              variant="danger"
              size="md"
              icon={<LogOut size={16} />}
              onClick={() => setShowSignOutConfirm(true)}
              className="shrink-0"
            >
              Sign Out
            </Button>
          </div>
        </section>

      </div>

      {/* ========================================================================= */}
      {/* MODALS */}
      {/* ========================================================================= */}

      {/* Edit Profile Modal */}
      <EditProfileModal
        user={user}
        isOpen={isEditProfileOpen}
        onClose={() => setIsEditProfileOpen(false)}
        onSuccess={() => {
          setIsEditProfileOpen(false);
          router.refresh();
        }}
      />

      {/* Sign Out Confirmation Modal */}
      <Modal
        open={showSignOutConfirm}
        onClose={() => setShowSignOutConfirm(false)}
        title="Confirm Sign Out"
        description="Are you sure you want to sign out of Reach International?"
        size="sm"
        footer={
          <div className="flex items-center justify-end gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowSignOutConfirm(false)}
            >
              Cancel
            </Button>
            <form action={logout}>
              <Button
                type="submit"
                variant="danger"
                size="sm"
                icon={<LogOut size={14} />}
              >
                Sign Out Now
              </Button>
            </form>
          </div>
        }
      >
        <p className="text-xs text-[var(--color-mute)]">
          All unsaved entries will be discarded. Your credentials will be cleared from this browser session.
        </p>
      </Modal>

      {/* Legal & Support Modals */}
      <Modal
        open={activeLegalModal === "privacy"}
        onClose={() => setActiveLegalModal(null)}
        title="Privacy Policy"
        description="Reach International Corporate Data Protection Guidelines"
        size="lg"
        footer={
          <Button variant="primary" size="sm" onClick={() => setActiveLegalModal(null)}>
            Understood
          </Button>
        }
      >
        <div className="space-y-4 text-xs leading-relaxed text-[var(--color-ink)] max-h-96 overflow-y-auto pr-2">
          <p>
            <strong>1. Data Collection & Privacy:</strong> Reach International collects necessary employee and operational telemetry data including name, phone number, encrypted government KYC IDs (Aadhaar, driving license), daily machine meter logs, and geographical job site check-ins solely for fleet coordination and payroll accuracy.
          </p>
          <p>
            <strong>2. Aadhaar Masking & Security:</strong> In full compliance with UIDAI regulations, all Aadhaar numbers are stored securely with strict cryptographic hashing and displayed only in masked format (e.g., XXXX-XXXX-1234) across all operator interfaces.
          </p>
          <p>
            <strong>3. Access Controls:</strong> Access to employee records is strictly compartmentalized based on role-based access control (RBAC). Only designated HR Managers, Super Administrators, and system auditors possess permission to inspect compliance documents.
          </p>
          <p>
            <strong>4. Data Retention:</strong> Operational machine running logs, breakdown incidents, and shift logs are preserved in immutable audit databases to comply with industrial safety standards and insurance underwriting requirements.
          </p>
        </div>
      </Modal>

      <Modal
        open={activeLegalModal === "terms"}
        onClose={() => setActiveLegalModal(null)}
        title="Terms of Service"
        description="Reach International Enterprise Platform Terms & Usage Policy"
        size="lg"
        footer={
          <Button variant="primary" size="sm" onClick={() => setActiveLegalModal(null)}>
            Accept & Close
          </Button>
        }
      >
        <div className="space-y-4 text-xs leading-relaxed text-[var(--color-ink)] max-h-96 overflow-y-auto pr-2">
          <p>
            <strong>1. Authorized Usage:</strong> The Reach International platform is intended exclusively for authorized fleet managers, engineers, supervisors, and certified machinery operators. Sharing of credentials is strictly prohibited.
          </p>
          <p>
            <strong>2. Accurate Meter Reporting:</strong> Operators and supervisors are legally bound to submit true, unmodified hour meter readings (HMR) and fuel intake logs. Falsification of machine running data constitutes gross industrial misconduct.
          </p>
          <p>
            <strong>3. Equipment Safety & Breakdowns:</strong> Any observed mechanical faults, hydraulic leaks, or brake anomalies must be immediately logged via the breakdown reporting workflow prior to equipment ignition.
          </p>
          <p>
            <strong>4. Intellectual Property:</strong> All telematics software, dashboard interfaces, design systems, and operational algorithms are the proprietary property of Reach International Heavy Equipment Fleet Ltd.
          </p>
        </div>
      </Modal>

      <Modal
        open={activeLegalModal === "help"}
        onClose={() => setActiveLegalModal(null)}
        title="Help & FAQ"
        description="Reach International Fleet Operations Guide"
        size="lg"
        footer={
          <Button variant="primary" size="sm" onClick={() => setActiveLegalModal(null)}>
            Close
          </Button>
        }
      >
        <div className="space-y-4 text-xs leading-relaxed text-[var(--color-ink)] max-h-96 overflow-y-auto pr-2">
          <div className="p-3 rounded-lg bg-[var(--color-canvas)] border border-[var(--color-hairline)]">
            <h4 className="font-bold text-[var(--color-ink)]">How do I submit running hour logs?</h4>
            <p className="text-[var(--color-mute)] mt-1">
              Navigate to the <strong>Operations</strong> tab in the navigation bar, click <strong>Daily Running Hours</strong>, and enter the starting & ending meter readings for your assigned machine.
            </p>
          </div>
          <div className="p-3 rounded-lg bg-[var(--color-canvas)] border border-[var(--color-hairline)]">
            <h4 className="font-bold text-[var(--color-ink)]">How are operator shift assignments created?</h4>
            <p className="text-[var(--color-mute)] mt-1">
              Supervisors and Managers can allocate operators to specific machines across morning, evening, or night shifts directly in the <strong>Operator Machine Assignments</strong> screen.
            </p>
          </div>
          <div className="p-3 rounded-lg bg-[var(--color-canvas)] border border-[var(--color-hairline)]">
            <h4 className="font-bold text-[var(--color-ink)]">What if I encounter an offline network area?</h4>
            <p className="text-[var(--color-mute)] mt-1">
              The Mobile application features an automatic offline queue. All entries are cached in local secure storage and automatically sync to the Supabase database once connectivity is restored.
            </p>
          </div>
        </div>
      </Modal>

      <Modal
        open={activeLegalModal === "guide"}
        onClose={() => setActiveLegalModal(null)}
        title="Operator Guide & Machinery Checklist"
        description="Standard Operating Procedures for Field Equipment Operators"
        size="lg"
        footer={
          <Button variant="primary" size="sm" onClick={() => setActiveLegalModal(null)}>
            Close
          </Button>
        }
      >
        <div className="space-y-4 text-xs leading-relaxed text-[var(--color-ink)] max-h-96 overflow-y-auto pr-2">
          <div className="p-3 rounded-lg bg-[var(--color-canvas)] border border-[var(--color-hairline)]">
            <h4 className="font-bold text-amber-600 dark:text-amber-400">Phase 1: Pre-Shift Inspection</h4>
            <ul className="list-disc pl-4 mt-1 space-y-1 text-[var(--color-mute)]">
              <li>Inspect engine oil, hydraulic fluid levels, and radiator coolant.</li>
              <li>Verify tire pressure / track tension and examine for deep cuts.</li>
              <li>Test emergency cutoff switch and warning beacon.</li>
            </ul>
          </div>
          <div className="p-3 rounded-lg bg-[var(--color-canvas)] border border-[var(--color-hairline)]">
            <h4 className="font-bold text-blue-600 dark:text-blue-400">Phase 2: During Operation</h4>
            <ul className="list-disc pl-4 mt-1 space-y-1 text-[var(--color-mute)]">
              <li>Record initial HMR reading at shift startup.</li>
              <li>Never exceed rated load capacity or boom extension limits.</li>
              <li>If engine temperature gauge enters amber zone, idle immediately for 5 minutes.</li>
            </ul>
          </div>
          <div className="p-3 rounded-lg bg-[var(--color-canvas)] border border-[var(--color-hairline)]">
            <h4 className="font-bold text-emerald-600 dark:text-emerald-400">Phase 3: Post-Shift Handover</h4>
            <ul className="list-disc pl-4 mt-1 space-y-1 text-[var(--color-mute)]">
              <li>Park equipment on level ground, lower attachments completely.</li>
              <li>Submit final meter reading in the mobile or web app.</li>
              <li>Report any mechanical disputes or irregular vibrations to supervisor.</li>
            </ul>
          </div>
        </div>
      </Modal>

    </div>
  );
}
