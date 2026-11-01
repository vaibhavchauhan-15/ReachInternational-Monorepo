import type { Metadata } from "next";
import Link from "next/link";
import { CheckCircle2, ArrowRight, Home, Briefcase, Phone } from "lucide-react";

export const metadata: Metadata = {
  title: "Application Received | Reach International Careers",
  description: "Thank you for applying to Reach International. Your application has been received.",
  robots: {
    index: false,
    follow: false,
  },
};

export default function ApplySuccessPage() {
  return (
    <div className="py-20 max-w-2xl mx-auto px-4 sm:px-6 text-center space-y-8">
      {/* Success Badge */}
      <div className="size-16 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 flex items-center justify-center mx-auto shadow-xs">
        <CheckCircle2 className="size-8" />
      </div>

      <div className="space-y-3">
        <span className="text-xs font-bold uppercase tracking-widest text-[#008CFC]">
          Application Received
        </span>
        <h1 className="text-3xl font-extrabold text-foreground tracking-tight">
          Thank You for Applying!
        </h1>
        <p className="text-sm text-muted-foreground leading-relaxed max-w-lg mx-auto">
          Your resume and details have been delivered to our recruitment team. We review every profile carefully.
        </p>
      </div>

      {/* What happens next box */}
      <div className="p-6 rounded-3xl bg-white dark:bg-[#171717] border border-black/[0.06] dark:border-white/[0.08] shadow-xs text-left space-y-4 max-w-md mx-auto">
        <h2 className="text-xs font-extrabold uppercase tracking-wider text-foreground">
          What Happens Next?
        </h2>
        <ul className="space-y-3 text-xs text-muted-foreground">
          <li className="flex items-start gap-3">
            <span className="size-5 rounded-full bg-sky-500/10 text-[#008CFC] font-bold text-[11px] flex items-center justify-center shrink-0">
              1
            </span>
            <span>
              <strong>Resume Screening:</strong> Our HR specialists will evaluate your experience against role criteria within <strong>48 to 72 hours</strong>.
            </span>
          </li>
          <li className="flex items-start gap-3">
            <span className="size-5 rounded-full bg-sky-500/10 text-[#008CFC] font-bold text-[11px] flex items-center justify-center shrink-0">
              2
            </span>
            <span>
              <strong>Phone Discussion:</strong> If shortlisted, you will receive a direct call to discuss role responsibilities, site locations, and compensation.
            </span>
          </li>
          <li className="flex items-start gap-3">
            <span className="size-5 rounded-full bg-sky-500/10 text-[#008CFC] font-bold text-[11px] flex items-center justify-center shrink-0">
              3
            </span>
            <span>
              <strong>Technical Evaluation:</strong> Mechanics and operators undergo equipment familiarity assessments at our nearest yard.
            </span>
          </li>
        </ul>
      </div>

      {/* Return Links */}
      <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
        <Link
          href="/careers"
          className="w-full sm:w-auto h-11 px-5 rounded-xl font-bold text-xs bg-[#008CFC] text-white hover:bg-[#0070CA] shadow-xs flex items-center justify-center gap-2"
        >
          <Briefcase className="size-4" />
          <span>Browse Other Openings</span>
        </Link>
        <Link
          href="/"
          className="w-full sm:w-auto h-11 px-5 rounded-xl border border-border text-xs font-semibold hover:bg-muted/60 transition-colors flex items-center justify-center gap-2 text-foreground"
        >
          <Home className="size-4 text-muted-foreground" />
          <span>Return to Homepage</span>
        </Link>
      </div>
    </div>
  );
}
