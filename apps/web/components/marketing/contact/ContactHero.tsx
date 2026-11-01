import Link from "next/link";
import { ChevronRight, ShieldCheck, Clock, Truck, Zap } from "lucide-react";

export function ContactHero() {
  return (
    <section className="relative pt-2 pb-8 md:pt-3 md:pb-10 overflow-hidden">
      {/* Subtle background glow */}
      <div
        className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[300px] rounded-full blur-3xl pointer-events-none opacity-20 dark:opacity-10"
        style={{ backgroundColor: "#0284c7" }}
        aria-hidden="true"
      />

      <div className="max-w-wide mx-auto px-4 md:px-6 lg:px-8 relative z-10">
        {/* Breadcrumb Navigation */}
        <nav aria-label="Breadcrumbs" className="mb-4">
          <ol className="flex items-center gap-2 text-xs font-mono text-neutral-500 dark:text-neutral-400">
            <li>
              <Link
                href="/"
                className="hover:text-neutral-900 dark:hover:text-white transition-colors"
              >
                Home
              </Link>
            </li>
            <li aria-hidden="true">
              <ChevronRight className="size-3.5 text-neutral-400 dark:text-neutral-600" />
            </li>
            <li className="text-neutral-900 dark:text-white font-medium" aria-current="page">
              Contact Us
            </li>
          </ol>
        </nav>

        {/* Primary Page Title (Strictly one H1) */}
        <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight text-neutral-900 dark:text-white max-w-3xl leading-[1.15]">
          Contact Our Equipment Rental &amp; Sales Desks
        </h1>

        {/* Lead Description */}
        <p className="mt-3 text-base sm:text-lg text-neutral-600 dark:text-neutral-300 max-w-xl leading-relaxed">
          Connect directly with our heavy machinery specialists for equipment rentals, sales, and fleet support across India.
        </p>

        {/* Trust Badges Strip */}
        <div className="mt-8 pt-6 border-t border-neutral-200/80 dark:border-neutral-800/80 grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="flex items-center gap-2.5">
            <div className="size-8 rounded-lg bg-sky-50 dark:bg-sky-950/50 border border-sky-200/60 dark:border-sky-800/50 flex items-center justify-center text-sky-600 dark:text-sky-400 shrink-0">
              <Zap className="size-4" />
            </div>
            <div>
              <p className="text-xs font-semibold text-neutral-900 dark:text-white">&lt; 2-Hour Response</p>
              <p className="text-[11px] text-neutral-500 dark:text-neutral-400">Guaranteed quotation SLA</p>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <div className="size-8 rounded-lg bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200/60 dark:border-emerald-800/50 flex items-center justify-center text-emerald-600 dark:text-emerald-400 shrink-0">
              <ShieldCheck className="size-4" />
            </div>
            <div>
              <p className="text-xs font-semibold text-neutral-900 dark:text-white">100% Certified Fleet</p>
              <p className="text-[11px] text-neutral-500 dark:text-neutral-400">JLG, Genie, JCB, Toyota, Hyundai</p>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <div className="size-8 rounded-lg bg-blue-50 dark:bg-blue-950/50 border border-blue-200/60 dark:border-blue-800/50 flex items-center justify-center text-blue-600 dark:text-blue-400 shrink-0">
              <Truck className="size-4" />
            </div>
            <div>
              <p className="text-xs font-semibold text-neutral-900 dark:text-white">Pan-India Dispatch</p>
              <p className="text-[11px] text-neutral-500 dark:text-neutral-400">Rapid nationwide transport</p>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <div className="size-8 rounded-lg bg-amber-50 dark:bg-amber-950/50 border border-amber-200/60 dark:border-amber-800/50 flex items-center justify-center text-amber-600 dark:text-amber-400 shrink-0">
              <Clock className="size-4" />
            </div>
            <div>
              <p className="text-xs font-semibold text-neutral-900 dark:text-white">24/7 Breakdown Support</p>
              <p className="text-[11px] text-neutral-500 dark:text-neutral-400">Field engineers on standby</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
