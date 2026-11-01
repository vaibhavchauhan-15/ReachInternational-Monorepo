"use client";

import { useState } from "react";
import { ArrowRight, Send } from "lucide-react";
import { CareersApplyForm } from "./CareersApplyForm";

export function CareersGeneralCta() {
  const [showForm, setShowForm] = useState(false);

  return (
    <section id="general-apply" className="py-16 md:py-24 max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 scroll-mt-20">
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#09101D] to-[#121E33] text-white p-8 sm:p-12 border border-white/10 shadow-xl space-y-6">
        {/* Glow */}
        <div
          className="absolute -right-20 -bottom-20 w-80 h-80 rounded-full blur-3xl opacity-30 pointer-events-none"
          style={{ backgroundColor: "#008CFC" }}
        />

        <div className="max-w-2xl space-y-3 relative z-10">
          <h2 className="text-2xl sm:text-3xl md:text-4xl font-extrabold tracking-tight">
            Don&apos;t See Your Role Listed?
          </h2>
          <p className="text-sm text-slate-300 leading-relaxed">
            We are always looking for skilled heavy machinery technicians, certified boom & scissor lift operators, yard managers, and equipment sales leaders across India. Submit a general profile and our talent team will review it for upcoming openings.
          </p>
        </div>

        {!showForm ? (
          <div className="relative z-10 pt-2">
            <button
              type="button"
              onClick={() => setShowForm(true)}
              className="inline-flex items-center gap-2 h-12 px-6 rounded-xl font-bold text-sm bg-[#008CFC] text-white hover:bg-[#0070CA] shadow-md transition-all active:scale-[0.98]"
            >
              <span>Submit General Application</span>
              <ArrowRight className="size-4" />
            </button>
          </div>
        ) : (
          <div className="relative z-10 pt-4 border-t border-white/10">
            <div className="p-6 sm:p-8 rounded-2xl bg-white dark:bg-[#171717] text-foreground shadow-2xl">
              <div className="flex items-center justify-between pb-4 border-b border-border mb-6">
                <div>
                  <h3 className="text-base font-bold text-foreground">
                    General Candidate Submission
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    Share your resume and preferences with our HR team
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="text-xs text-muted-foreground hover:text-foreground font-semibold"
                >
                  Close Form
                </button>
              </div>

              <CareersApplyForm jobId={null} jobTitle="General Application" />
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
