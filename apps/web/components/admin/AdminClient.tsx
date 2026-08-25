"use client";

import Link from "next/link";
import {
  AnimatedSettings,
  AnimatedUsers,
  AnimatedShieldCheck,
  AnimatedBuilding2,
  AnimatedSlidersHorizontal,
  AnimatedFileText,
  AnimatedShoppingBag,
  AnimatedBell,
  AnimatedScrollText,
  AnimatedArrowRight,
  AnimatedLock,
} from "@/components/ui/animated-icons";
import type { User } from "@/lib/types/database";

interface AdminClientProps {
  user: User;
}

export function AdminClient({ user }: AdminClientProps) {
  const isSuperAdmin = user.role === "super_admin";

  const adminModules = [
    { 
      id: "users", 
      label: "Users Directory", 
      icon: AnimatedUsers, 
      href: "/users", 
      desc: "User access accounts, roles & status management", 
      superAdminOnly: false 
    },
    { 
      id: "roles", 
      label: "Roles & Permissions", 
      icon: AnimatedShieldCheck, 
      href: isSuperAdmin ? "#" : "#", 
      desc: "Global RBAC architecture & permission configuration", 
      superAdminOnly: true 
    },
    { 
      id: "branches", 
      label: "Branches", 
      icon: AnimatedBuilding2, 
      href: "/branches", 
      desc: "Physical yards, offices, and location operational details", 
      superAdminOnly: false 
    },
    { 
      id: "employees", 
      label: "Employees", 
      icon: AnimatedUsers, 
      href: "/hr", 
      desc: "Staff directory & designation management", 
      superAdminOnly: false 
    },
    { 
      id: "workflow", 
      label: "Workflow Settings", 
      icon: AnimatedSlidersHorizontal, 
      href: "#", 
      desc: "Escalation rules & operational responsibility preferences", 
      superAdminOnly: false 
    },
    { 
      id: "document_types", 
      label: "Document Types", 
      icon: AnimatedFileText, 
      href: "/documents", 
      desc: "Required certificate taxonomies & expiry alerts", 
      superAdminOnly: false 
    },
    { 
      id: "purchase_settings", 
      label: "Purchase Settings", 
      icon: AnimatedShoppingBag, 
      href: "#", 
      desc: "PO approval limits & Terms & Conditions", 
      superAdminOnly: false 
    },
    { 
      id: "notification_settings", 
      label: "Notification Settings", 
      icon: AnimatedBell, 
      href: "/notifications", 
      desc: "In-app alerts & operational notification preferences", 
      superAdminOnly: false 
    },
    { 
      id: "audit_logs", 
      label: "Audit Logs", 
      icon: AnimatedScrollText, 
      href: "/audit-logs", 
      desc: "System-wide security event & mutation trail (Immutable)", 
      superAdminOnly: false 
    },
  ];

  return (
    <div className="w-full space-y-6">
      {/* HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[var(--color-hairline)] pb-5">
        <div>
          <div className="inline-flex items-center gap-2 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-sky-500/10 text-sky-600 dark:text-sky-400 border border-sky-500/20 mb-2">
            <AnimatedSettings size={14} />
            {isSuperAdmin ? "Super Admin Governance Console" : "Operational Administration Console"}
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-[var(--color-ink)] tracking-tight">
            Administration
          </h1>
          <p className="text-xs sm:text-sm text-[var(--color-mute)] mt-1">
            {isSuperAdmin 
              ? "Global configuration, RBAC security architecture, platform secrets, and system audit logs" 
              : "Operational preferences, branch details, user accounts, master taxonomies, and audit logs"}
          </p>
        </div>
      </div>

      {/* ADMIN MODULES GRID */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {adminModules.map((mod) => {
          const Icon = mod.icon;
          const isRestricted = mod.superAdminOnly && !isSuperAdmin;

          if (isRestricted) {
            return (
              <div
                key={mod.id}
                className="p-5 rounded-2xl border border-[var(--color-hairline)] bg-[var(--color-canvas)] opacity-60 flex flex-col justify-between space-y-3 relative overflow-hidden"
              >
                <div className="flex items-start gap-3">
                  <div className="h-10 w-10 rounded-xl bg-slate-500/10 text-slate-500 flex items-center justify-center border border-slate-500/20 shrink-0">
                    <Icon size={20} />
                  </div>
                  <div>
                    <h3 className="text-sm font-extrabold text-[var(--color-ink)] flex items-center gap-1.5">
                      {mod.label}
                      <span className="px-2 py-0.5 rounded-full text-[9px] font-bold uppercase bg-amber-500/10 text-amber-600 border border-amber-500/20 flex items-center gap-1">
                        <AnimatedLock size={10} /> Super Admin Only
                      </span>
                    </h3>
                    <p className="text-xs text-[var(--color-mute)] mt-1 leading-relaxed">
                      {mod.desc}
                    </p>
                  </div>
                </div>

                <div className="flex items-center justify-between text-xs font-bold text-[var(--color-mute)] pt-2 border-t border-[var(--color-hairline)]">
                  <span className="text-[11px] italic">Platform Governance Restricted</span>
                </div>
              </div>
            );
          }

          return (
            <Link
              key={mod.id}
              href={mod.href}
              className="p-5 rounded-2xl border border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)] hover:border-sky-500/40 hover:bg-sky-500/5 transition-all group cursor-pointer flex flex-col justify-between space-y-3"
            >
              <div className="flex items-start gap-3">
                <div className="h-10 w-10 rounded-xl bg-sky-500/10 text-sky-600 dark:text-sky-400 flex items-center justify-center border border-sky-500/20 shrink-0 group-hover:scale-105 transition-transform">
                  <Icon size={20} />
                </div>
                <div>
                  <h3 className="text-sm font-extrabold text-[var(--color-ink)] group-hover:text-sky-600 dark:group-hover:text-sky-400 transition-colors">
                    {mod.label}
                  </h3>
                  <p className="text-xs text-[var(--color-mute)] mt-1 leading-relaxed">
                    {mod.desc}
                  </p>
                </div>
              </div>

              <div className="flex items-center justify-end text-xs font-bold text-sky-600 dark:text-sky-400 pt-2 border-t border-[var(--color-hairline)]">
                <span className="flex items-center gap-1 group-hover:translate-x-0.5 transition-transform">
                  Open Setting <AnimatedArrowRight size={14} />
                </span>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
