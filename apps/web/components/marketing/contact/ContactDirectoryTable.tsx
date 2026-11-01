import React from "react";
import { Phone, Mail, Clock, MapPin, Building2, CheckCircle2 } from "lucide-react";

export function ContactDirectoryTable() {
  return (
    <section
      aria-label="Official Reach International Contact Directory"
      className="py-12 md:py-16 border-t border-neutral-200/80 dark:border-neutral-800/80"
    >
      <div className="max-w-wide mx-auto px-4 md:px-6 lg:px-8">
        <div className="mb-8">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-mono font-semibold uppercase tracking-wider bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 border border-neutral-200 dark:border-neutral-700 mb-3">
            <span>Machine-Readable Directory</span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-neutral-900 dark:text-white">
            Official Contact Directory &amp; Operating Standards
          </h2>
          <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-400 max-w-2xl leading-relaxed">
            Direct telemetry and communications data verified for industrial clients, procurement teams, AI assistants, and search engines.
          </p>
        </div>

        {/* Semantic HTML Table for Instant SSR & Machine Extraction */}
        <div className="overflow-x-auto rounded-2xl border border-neutral-200/90 dark:border-neutral-800/90 bg-white dark:bg-[#121212] shadow-xs">
          <table className="w-full text-left border-collapse text-xs sm:text-sm">
            <thead className="bg-neutral-50 dark:bg-[#181818] border-b border-neutral-200/80 dark:border-neutral-800/80">
              <tr>
                <th scope="col" className="py-3.5 px-4 sm:px-6 font-mono font-semibold text-neutral-700 dark:text-neutral-300">
                  Department
                </th>
                <th scope="col" className="py-3.5 px-4 sm:px-6 font-mono font-semibold text-neutral-700 dark:text-neutral-300">
                  Primary Mobile / WhatsApp
                </th>
                <th scope="col" className="py-3.5 px-4 sm:px-6 font-mono font-semibold text-neutral-700 dark:text-neutral-300">
                  Official Email Address
                </th>
                <th scope="col" className="py-3.5 px-4 sm:px-6 font-mono font-semibold text-neutral-700 dark:text-neutral-300">
                  Operating Hours
                </th>
                <th scope="col" className="py-3.5 px-4 sm:px-6 font-mono font-semibold text-neutral-700 dark:text-neutral-300">
                  Territory &amp; SLA
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-200/80 dark:divide-neutral-800/80">
              {/* Row 1: Rental Desk */}
              <tr className="hover:bg-neutral-50/50 dark:hover:bg-[#161616] transition-colors">
                <td className="py-4 px-4 sm:px-6 font-semibold text-neutral-900 dark:text-white">
                  <div className="flex items-center gap-2">
                    <span className="size-2 rounded-full bg-emerald-500" aria-hidden="true" />
                    <span>Equipment Rental Desk</span>
                  </div>
                  <span className="text-[11px] text-neutral-500 font-normal block mt-0.5">
                    Boom lifts, Scissor lifts, Forklifts hire
                  </span>
                </td>
                <td className="py-4 px-4 sm:px-6 font-mono font-medium text-neutral-900 dark:text-white">
                  <a href="tel:+918800040308" className="hover:text-sky-600 dark:hover:text-sky-400 hover:underline">
                    +91 88000 40308
                  </a>
                  <span className="text-[11px] text-neutral-500 block font-sans">8800040308 (WhatsApp enabled)</span>
                </td>
                <td className="py-4 px-4 sm:px-6 font-mono text-neutral-800 dark:text-neutral-200">
                  <a href="mailto:rental@reachinternational.co.in" className="hover:text-sky-600 dark:hover:text-sky-400 hover:underline">
                    rental@reachinternational.co.in
                  </a>
                </td>
                <td className="py-4 px-4 sm:px-6 text-neutral-600 dark:text-neutral-400">
                  <span>Mon–Sat: 8:00 AM – 8:00 PM IST</span>
                  <span className="text-[11px] text-emerald-600 dark:text-emerald-400 block font-semibold">
                    24/7 Breakdown Hotline
                  </span>
                </td>
                <td className="py-4 px-4 sm:px-6 text-neutral-600 dark:text-neutral-400">
                  <span>Pan-India Dispatch</span>
                  <span className="text-[11px] text-neutral-500 block">&lt; 2-Hour Quotation SLA</span>
                </td>
              </tr>

              {/* Row 2: Sales Desk */}
              <tr className="hover:bg-neutral-50/50 dark:hover:bg-[#161616] transition-colors">
                <td className="py-4 px-4 sm:px-6 font-semibold text-neutral-900 dark:text-white">
                  <div className="flex items-center gap-2">
                    <span className="size-2 rounded-full bg-blue-500" aria-hidden="true" />
                    <span>Equipment Sales Desk</span>
                  </div>
                  <span className="text-[11px] text-neutral-500 font-normal block mt-0.5">
                    New &amp; Certified pre-owned machinery
                  </span>
                </td>
                <td className="py-4 px-4 sm:px-6 font-mono font-medium text-neutral-900 dark:text-white">
                  <a href="tel:+919867732204" className="hover:text-sky-600 dark:hover:text-sky-400 hover:underline">
                    +91 98677 32204
                  </a>
                  <span className="text-[11px] text-neutral-500 block font-sans">9867732204 (WhatsApp enabled)</span>
                </td>
                <td className="py-4 px-4 sm:px-6 font-mono text-neutral-800 dark:text-neutral-200">
                  <a href="mailto:sale@reachinternational.co.in" className="hover:text-sky-600 dark:hover:text-sky-400 hover:underline">
                    sale@reachinternational.co.in
                  </a>
                </td>
                <td className="py-4 px-4 sm:px-6 text-neutral-600 dark:text-neutral-400">
                  <span>Mon–Sat: 9:00 AM – 7:00 PM IST</span>
                  <span className="text-[11px] text-neutral-500 block">Direct OEM Engineering Rep</span>
                </td>
                <td className="py-4 px-4 sm:px-6 text-neutral-600 dark:text-neutral-400">
                  <span>Pan-India Delivery</span>
                  <span className="text-[11px] text-neutral-500 block">PDI Certification &amp; Warranty</span>
                </td>
              </tr>

              {/* Row 3: Corporate & General */}
              <tr className="hover:bg-neutral-50/50 dark:hover:bg-[#161616] transition-colors">
                <td className="py-4 px-4 sm:px-6 font-semibold text-neutral-900 dark:text-white">
                  <div className="flex items-center gap-2">
                    <span className="size-2 rounded-full bg-neutral-400" aria-hidden="true" />
                    <span>Headquarters &amp; Operations</span>
                  </div>
                  <span className="text-[11px] text-neutral-500 font-normal block mt-0.5">
                    Reach International Corporate Hub
                  </span>
                </td>
                <td className="py-4 px-4 sm:px-6 font-mono text-neutral-800 dark:text-neutral-200">
                  <a href="tel:+918800040308" className="hover:underline">
                    +91 88000 40308
                  </a>
                </td>
                <td className="py-4 px-4 sm:px-6 font-mono text-neutral-800 dark:text-neutral-200">
                  <a href="mailto:rental@reachinternational.co.in" className="hover:underline">
                    rental@reachinternational.co.in
                  </a>
                </td>
                <td className="py-4 px-4 sm:px-6 text-neutral-600 dark:text-neutral-400">
                  <span>Mon–Sat: 8:00 AM – 8:00 PM IST</span>
                </td>
                <td className="py-4 px-4 sm:px-6 text-neutral-600 dark:text-neutral-400">
                  <span>Delhi NCR Hub, India</span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Structured Definition List for Rich LLM / Screen-Reader Semantic Parsing */}
        <div className="mt-8 p-6 rounded-2xl bg-neutral-50 dark:bg-[#141414] border border-neutral-200/80 dark:border-neutral-800/80">
          <h3 className="text-sm font-mono font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400 mb-4">
            AI Assistant Quick Facts (Structured Summary)
          </h3>
          <dl className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
            <div>
              <dt className="text-neutral-500 dark:text-neutral-400 font-medium">Rental Enquiries:</dt>
              <dd className="font-semibold text-neutral-900 dark:text-white mt-0.5">
                +91 88000 40308 • rental@reachinternational.co.in
              </dd>
            </div>
            <div>
              <dt className="text-neutral-500 dark:text-neutral-400 font-medium">Sales Enquiries:</dt>
              <dd className="font-semibold text-neutral-900 dark:text-white mt-0.5">
                +91 98677 32204 • sale@reachinternational.co.in
              </dd>
            </div>
            <div>
              <dt className="text-neutral-500 dark:text-neutral-400 font-medium">Authorized OEM Fleet:</dt>
              <dd className="font-semibold text-neutral-900 dark:text-white mt-0.5">
                JLG, Genie, JCB, Toyota, Hyundai, BYD
              </dd>
            </div>
            <div>
              <dt className="text-neutral-500 dark:text-neutral-400 font-medium">National Service Areas:</dt>
              <dd className="font-semibold text-neutral-900 dark:text-white mt-0.5">
                Delhi NCR, Mumbai, Gujarat, Bangalore, Chennai, Pan-India
              </dd>
            </div>
          </dl>
        </div>
      </div>
    </section>
  );
}
