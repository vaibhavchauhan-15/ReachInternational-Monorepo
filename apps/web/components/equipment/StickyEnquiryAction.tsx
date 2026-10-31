"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { Phone, Send, FileText } from "lucide-react";
import { cn } from "@/lib/utils";

export interface StickyEnquiryActionProps {
  modelName: string;
  targetId?: string;
  className?: string;
}

export function StickyEnquiryAction({
  modelName,
  targetId = "quote-enquiry",
  className,
}: StickyEnquiryActionProps) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    function handleScroll() {
      // Show sticky bar after scrolling down 300px
      if (window.scrollY > 300) {
        setVisible(true);
      } else {
        setVisible(false);
      }
    }

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  if (!visible) return null;

  return (
    <div
      className={cn(
        "fixed bottom-0 inset-x-0 z-40 p-3 sm:p-4 bg-white/95 dark:bg-[#121212]/95 backdrop-blur-md border-t border-neutral-200/90 dark:border-neutral-800/90 shadow-2xl transition-all duration-300 animate-in slide-in-from-bottom-2",
        className
      )}
    >
      <div className="max-w-6xl mx-auto flex items-center justify-between gap-4">
        <div className="hidden sm:block min-w-0">
          <span className="text-[11px] font-mono uppercase tracking-wider text-neutral-400 block truncate">
            Machinery Quotation &amp; Support
          </span>
          <span className="text-sm font-bold text-neutral-900 dark:text-white truncate block">
            {modelName}
          </span>
        </div>

        <div className="flex items-center gap-2.5 w-full sm:w-auto justify-end">
          <a
            href="tel:+919820000000"
            className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-semibold bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 text-neutral-800 dark:text-neutral-200 transition-colors"
          >
            <Phone className="size-3.5 text-[#0284c7]" />
            <span>Call Specialist</span>
          </a>

          <a
            href={`#${targetId}`}
            className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-xs sm:text-sm font-semibold bg-[#0284c7] hover:bg-[#0369a1] text-white shadow-xs transition-colors cursor-pointer"
          >
            <Send className="size-3.5" />
            <span>Request Quote</span>
          </a>
        </div>
      </div>
    </div>
  );
}
