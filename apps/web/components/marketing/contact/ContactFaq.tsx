"use client";

import React, { useState } from "react";
import { ChevronDown, HelpCircle } from "lucide-react";
import { cn } from "@/lib/utils";

import { CONTACT_FAQS } from "./data";

export { CONTACT_FAQS };

export function ContactFaq() {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  const toggle = (index: number) => {
    setOpenIndex((prev) => (prev === index ? null : index));
  };

  return (
    <section aria-label="Frequently Asked Questions" className="py-12 md:py-16 border-t border-neutral-200/80 dark:border-neutral-800/80">
      <div className="max-w-3xl mx-auto px-4 md:px-6">
        <div className="text-center mb-10">
          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-neutral-900 dark:text-white">
            Frequently Asked Questions
          </h2>
          <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-400">
            Immediate answers to common queries regarding commercial terms, fleet delivery, and support services.
          </p>
        </div>

        <div className="space-y-3">
          {CONTACT_FAQS.map((faq, index) => {
            const isOpen = openIndex === index;
            return (
              <div
                key={index}
                className="rounded-2xl border border-neutral-200/90 dark:border-neutral-800/90 bg-white dark:bg-[#121212] overflow-hidden transition-all shadow-2xs"
              >
                <button
                  type="button"
                  onClick={() => toggle(index)}
                  className="w-full text-left p-5 flex items-center justify-between gap-4 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
                  aria-expanded={isOpen}
                >
                  <span className="text-sm sm:text-base font-semibold text-neutral-900 dark:text-white leading-snug">
                    {faq.q}
                  </span>
                  <ChevronDown
                    className={cn(
                      "size-4.5 text-neutral-400 shrink-0 transition-transform duration-200",
                      isOpen && "rotate-180 text-neutral-900 dark:text-white"
                    )}
                  />
                </button>
                {isOpen && (
                  <div className="px-5 pb-5 pt-0">
                    <p className="text-xs sm:text-sm text-neutral-600 dark:text-neutral-300 leading-relaxed border-t border-neutral-100 dark:border-neutral-800/80 pt-3">
                      {faq.a}
                    </p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
