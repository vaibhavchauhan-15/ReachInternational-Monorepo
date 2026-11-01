import React from "react";
import { MapPin, Phone, Mail, Building, Truck } from "lucide-react";

import { REGIONAL_HUBS } from "./data";

export function RegionalHubs() {
  return (
    <section aria-label="Regional Depots and Fleet Yards" className="py-12 md:py-16">
      <div className="max-w-wide mx-auto px-4 md:px-6 lg:px-8">
        <div className="mb-10 text-center max-w-2xl mx-auto">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-mono font-semibold uppercase tracking-wider bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 border border-neutral-200 dark:border-neutral-700 mb-3">
            <span>Nationwide Logistics</span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-neutral-900 dark:text-white">
            Regional Fleet Yards &amp; Depots
          </h2>
          <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-400 leading-relaxed">
            Strategically located maintenance hubs across major industrial clusters for rapid equipment dispatch and zero-downtime field assistance.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
          {REGIONAL_HUBS.map((hub) => (
            <div
              key={hub.city}
              className="rounded-2xl p-5 bg-white dark:bg-[#121212] border border-neutral-200/90 dark:border-neutral-800/90 shadow-xs flex flex-col justify-between"
            >
              <div>
                <span className="text-[10px] font-mono font-semibold uppercase tracking-wider text-sky-600 dark:text-sky-400 block mb-1">
                  {hub.region}
                </span>
                <h3 className="text-base font-bold text-neutral-900 dark:text-white mb-2">
                  {hub.city}
                </h3>
                <p className="text-xs text-neutral-500 dark:text-neutral-400 leading-relaxed mb-4">
                  {hub.address}
                </p>
                <div className="p-2.5 rounded-xl bg-neutral-50 dark:bg-[#181818] border border-neutral-200/60 dark:border-neutral-800/60 text-[11px] text-neutral-600 dark:text-neutral-300 mb-4">
                  <span className="font-semibold block text-neutral-800 dark:text-neutral-200 mb-0.5">
                    Hub Specialization:
                  </span>
                  {hub.capabilities}
                </div>
              </div>

              <div className="pt-3 border-t border-neutral-100 dark:border-neutral-800/80 space-y-1.5 text-xs font-mono">
                <a
                  href={`tel:${hub.phone.replace(/\s+/g, "")}`}
                  className="flex items-center gap-2 text-neutral-800 dark:text-neutral-200 hover:text-sky-600 dark:hover:text-sky-400 transition-colors"
                >
                  <Phone className="size-3.5 text-neutral-400" />
                  <span>{hub.phone}</span>
                </a>
                <a
                  href={`mailto:${hub.email}`}
                  className="flex items-center gap-2 text-neutral-800 dark:text-neutral-200 hover:text-sky-600 dark:hover:text-sky-400 transition-colors truncate"
                >
                  <Mail className="size-3.5 text-neutral-400 shrink-0" />
                  <span className="truncate">{hub.email}</span>
                </a>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
