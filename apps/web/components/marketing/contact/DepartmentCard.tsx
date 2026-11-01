"use client";

import React, { useState } from "react";
import {
  Phone,
  Mail,
  Copy,
  Check,
  ArrowRight,
  CheckCircle2,
} from "lucide-react";
import { cn } from "@/lib/utils";

export interface DepartmentCardProps {
  type: "rental" | "sale";
  className?: string;
}

const DEPARTMENTS = {
  rental: {
    title: "Equipment Rental Desk",
    phoneDisplay: "+91 88000 40308",
    phoneRaw: "8800040308",
    phoneTel: "+918800040308",
    email: "rental@reachinternational.co.in",
    whatsappUrl: "https://wa.me/918800040308?text=Hello%20Reach%20International,%20I%20am%20enquiring%20about%20equipment%20rental.",
    description:
      "Flexible short-term, monthly, and long-term project rentals for boom lifts, scissor lifts, and forklifts.",
    highlights: [
      "Boom Lifts (12m to 58m working height)",
      "Electric & Rough-Terrain Scissor Lifts (6m to 22m)",
      "Heavy Counterbalanced Forklifts (1.5T to 16T)",
      "Certified factory-trained operators on demand",
      "24/7 emergency site repair & replacement guarantee",
    ],
    ctaLabel: "Enquire via WhatsApp",
    ctaHref: "https://wa.me/918800040308?text=Hello%20Reach%20International,%20I%20am%20enquiring%20about%20equipment%20rental.",
  },
  sale: {
    title: "Equipment Sales Desk",
    phoneDisplay: "+91 98677 32204",
    phoneRaw: "9867732204",
    phoneTel: "+919867732204",
    email: "sale@reachinternational.co.in",
    whatsappUrl: "https://wa.me/919867732204?text=Hello%20Reach%20International,%20I%20am%20enquiring%20about%20purchasing%20machinery.",
    description:
      "Brand-new and certified pre-owned aerial work platforms, reach trucks, and material handling equipment.",
    highlights: [
      "Authorized OEM partners: JLG, Genie, JCB, Toyota, Hyundai, BYD",
      "Comprehensive factory warranty & PDI inspection",
      "Customized financing, asset leasing & buyback advisory",
      "Genuine OEM spare parts & certified AMC coverage",
      "Nationwide machinery delivery & commissioning",
    ],
    ctaLabel: "Enquire via WhatsApp",
    ctaHref: "https://wa.me/919867732204?text=Hello%20Reach%20International,%20I%20am%20enquiring%20about%20purchasing%20machinery.",
  },
};

export function DepartmentCard({ type, className }: DepartmentCardProps) {
  const dept = DEPARTMENTS[type];
  const [copiedPhone, setCopiedPhone] = useState(false);
  const [copiedEmail, setCopiedEmail] = useState(false);

  const handleCopyPhone = async () => {
    try {
      await navigator.clipboard.writeText(dept.phoneDisplay);
      setCopiedPhone(true);
      setTimeout(() => setCopiedPhone(false), 2000);
    } catch {
      // Fallback
    }
  };

  const handleCopyEmail = async () => {
    try {
      await navigator.clipboard.writeText(dept.email);
      setCopiedEmail(true);
      setTimeout(() => setCopiedEmail(false), 2000);
    } catch {
      // Fallback
    }
  };

  return (
    <div
      className={cn(
        "rounded-2xl sm:rounded-3xl p-6 sm:p-8 bg-white dark:bg-[#121212] border border-neutral-200/90 dark:border-neutral-800/90 shadow-xs hover:shadow-md transition-all flex flex-col justify-between relative overflow-hidden group",
        className
      )}
    >
      {/* Top Accent Gradient Border Glow */}
      <div
        className={cn(
          "absolute top-0 left-0 right-0 h-1",
          type === "rental"
            ? "bg-gradient-to-r from-sky-500 via-blue-500 to-indigo-500"
            : "bg-gradient-to-r from-blue-600 via-cyan-500 to-emerald-500"
        )}
      />

      <div>
        {/* Title Header */}
        <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-neutral-900 dark:text-white mb-3">
          {dept.title}
        </h2>

        {/* Description */}
        <p className="text-sm text-neutral-600 dark:text-neutral-300 leading-relaxed mb-6">
          {dept.description}
        </p>

        {/* Direct Contact Channels Box */}
        <div className="rounded-xl sm:rounded-2xl p-4 sm:p-5 bg-neutral-50 dark:bg-[#181818] border border-neutral-200/80 dark:border-neutral-800/80 space-y-4 mb-6">
          {/* Phone Contact Row */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[11px] font-mono uppercase tracking-wider text-neutral-500 dark:text-neutral-400 font-semibold">
                Direct Mobile &amp; WhatsApp
              </span>
              <button
                type="button"
                onClick={handleCopyPhone}
                className="inline-flex items-center gap-1 text-[11px] font-mono text-neutral-600 dark:text-neutral-400 hover:text-sky-600 dark:hover:text-sky-400 transition-colors cursor-pointer"
                aria-label={`Copy phone number ${dept.phoneDisplay}`}
              >
                {copiedPhone ? (
                  <>
                    <Check className="size-3 text-emerald-500" />
                    <span className="text-emerald-600 dark:text-emerald-400 font-semibold">Copied!</span>
                  </>
                ) : (
                  <>
                    <Copy className="size-3" />
                    <span>Copy</span>
                  </>
                )}
              </button>
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
              <a
                href={`tel:${dept.phoneTel}`}
                className="text-lg sm:text-xl font-bold font-mono tracking-tight text-neutral-900 dark:text-white hover:text-sky-600 dark:hover:text-sky-400 transition-colors flex items-center gap-2"
              >
                <Phone className="size-4.5 text-sky-600 dark:text-sky-400 shrink-0" />
                <span>{dept.phoneDisplay}</span>
              </a>

              <div className="flex items-center gap-2">
                <a
                  href={`tel:${dept.phoneTel}`}
                  className="inline-flex items-center justify-center px-3 py-1.5 rounded-lg text-xs font-semibold bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 hover:bg-neutral-800 dark:hover:bg-neutral-100 transition-colors"
                >
                  Call Now
                </a>
                <a
                  href={dept.whatsappUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-center px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-600 text-white hover:bg-emerald-700 transition-colors"
                  aria-label={`Chat on WhatsApp with ${dept.title}`}
                >
                  WhatsApp
                </a>
              </div>
            </div>
          </div>

          <div className="h-px bg-neutral-200/80 dark:border-neutral-800" />

          {/* Email Contact Row */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[11px] font-mono uppercase tracking-wider text-neutral-500 dark:text-neutral-400 font-semibold">
                Official Department Email
              </span>
              <button
                type="button"
                onClick={handleCopyEmail}
                className="inline-flex items-center gap-1 text-[11px] font-mono text-neutral-600 dark:text-neutral-400 hover:text-sky-600 dark:hover:text-sky-400 transition-colors cursor-pointer"
                aria-label={`Copy email address ${dept.email}`}
              >
                {copiedEmail ? (
                  <>
                    <Check className="size-3 text-emerald-500" />
                    <span className="text-emerald-600 dark:text-emerald-400 font-semibold">Copied!</span>
                  </>
                ) : (
                  <>
                    <Copy className="size-3" />
                    <span>Copy</span>
                  </>
                )}
              </button>
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
              <a
                href={`mailto:${dept.email}`}
                className="text-sm sm:text-base font-medium font-mono text-neutral-900 dark:text-white hover:text-sky-600 dark:hover:text-sky-400 transition-colors flex items-center gap-2 break-all"
              >
                <Mail className="size-4 text-sky-600 dark:text-sky-400 shrink-0" />
                <span>{dept.email}</span>
              </a>

              <a
                href={`mailto:${dept.email}`}
                className="inline-flex items-center justify-center px-3 py-1.5 rounded-lg text-xs font-semibold bg-neutral-200 dark:bg-neutral-800 text-neutral-900 dark:text-white hover:bg-neutral-300 dark:hover:bg-neutral-700 transition-colors self-start sm:self-auto"
              >
                Send Email
              </a>
            </div>
          </div>
        </div>

        {/* Fleet & Service Highlights */}
        <div>
          <h3 className="text-xs font-mono uppercase tracking-wider text-neutral-500 dark:text-neutral-400 font-semibold mb-3">
            Core Service &amp; Fleet Capabilities
          </h3>
          <ul className="space-y-2">
            {dept.highlights.map((h, i) => (
              <li key={i} className="flex items-start gap-2.5 text-xs sm:text-sm text-neutral-700 dark:text-neutral-300">
                <CheckCircle2 className="size-4 text-emerald-500 shrink-0 mt-0.5" />
                <span>{h}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Card Footer CTA */}
      <div className="mt-8 pt-5 border-t border-neutral-200/80 dark:border-neutral-800/80">
        <a
          href={dept.ctaHref}
          target="_blank"
          rel="noopener noreferrer"
          className="w-full inline-flex items-center justify-center gap-2 py-3 px-4 rounded-xl text-sm font-semibold text-neutral-900 dark:text-white bg-neutral-100 hover:bg-neutral-200 dark:bg-neutral-800/90 dark:hover:bg-neutral-700/90 transition-all border border-neutral-200/80 dark:border-neutral-700/80 group-hover:border-sky-500/50"
        >
          <span>{dept.ctaLabel}</span>
          <ArrowRight className="size-4 text-neutral-500 dark:text-neutral-400 group-hover:translate-x-0.5 transition-transform" />
        </a>
      </div>
    </div>
  );
}
