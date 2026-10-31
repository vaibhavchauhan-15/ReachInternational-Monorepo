'use client';

import React from 'react';
import { Building2, ShieldCheck, Award, Zap } from 'lucide-react';
import { LogoLoop } from '@/components/marketing/ui/logo-loop';
import { clientsRow1, clientsRow2 } from './ClientLogos';

export function ClientsSection() {
  return (
    <section
      id="clients-section"
      className="w-full py-12 md:py-16 overflow-hidden relative"
      style={{
        backgroundColor: 'var(--surface-base)',
        borderBottom: '1px solid var(--border-subtle)',
      }}
    >
      {/* Background radial gradient accent */}
      <div
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[350px] rounded-full blur-3xl pointer-events-none opacity-20 dark:opacity-15"
        style={{
          background: 'radial-gradient(circle, var(--brand-blue, #008CFC) 0%, transparent 70%)',
        }}
        aria-hidden="true"
      />

      <div className="max-w-wide mx-auto px-4 md:px-6 lg:px-8 relative z-10">
        {/* Header Block */}
        <div className="text-center max-w-3xl mx-auto mb-8 md:mb-10">
          <h2
            className="text-3xl md:text-4xl lg:text-5xl font-extrabold tracking-tight"
            style={{ color: 'var(--text-primary)' }}
          >
            Trusted by India&apos;s Industry Leaders
          </h2>

          <p
            className="text-base md:text-lg mt-3 md:mt-4 leading-relaxed max-w-2xl mx-auto"
            style={{ color: 'var(--text-secondary)' }}
          >
            India&apos;s top public and private enterprises depend on Reach International for reliable aerial access and material handling equipment.
          </p>

          {/* Quick Credibility Trust Badges */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-3.5 mt-6 md:mt-8 max-w-3xl mx-auto">
            <div
              className="px-4 py-2.5 rounded-full border flex items-center gap-2 justify-center transition-all duration-200 hover:-translate-y-0.5 hover:shadow-2xs"
              style={{
                backgroundColor: 'var(--surface-base)',
                borderColor: 'var(--border-subtle)',
              }}
            >
              <ShieldCheck className="w-3.5 h-3.5 text-[#0284c7] flex-none" />
              <span className="text-xs font-medium tracking-tight whitespace-nowrap" style={{ color: 'var(--text-primary)' }}>
                100% Certified Fleet
              </span>
            </div>

            <div
              className="px-4 py-2.5 rounded-full border flex items-center gap-2 justify-center transition-all duration-200 hover:-translate-y-0.5 hover:shadow-2xs"
              style={{
                backgroundColor: 'var(--surface-base)',
                borderColor: 'var(--border-subtle)',
              }}
            >
              <Zap className="w-3.5 h-3.5 text-[#0284c7] flex-none" />
              <span className="text-xs font-medium tracking-tight whitespace-nowrap" style={{ color: 'var(--text-primary)' }}>
                &lt;5% Breakdown Rate
              </span>
            </div>

            <div
              className="px-4 py-2.5 rounded-full border flex items-center gap-2 justify-center transition-all duration-200 hover:-translate-y-0.5 hover:shadow-2xs"
              style={{
                backgroundColor: 'var(--surface-base)',
                borderColor: 'var(--border-subtle)',
              }}
            >
              <Award className="w-3.5 h-3.5 text-[#0284c7] flex-none" />
              <span className="text-xs font-medium tracking-tight whitespace-nowrap" style={{ color: 'var(--text-primary)' }}>
                10+ Years Excellence
              </span>
            </div>

            <div
              className="px-4 py-2.5 rounded-full border flex items-center gap-2 justify-center transition-all duration-200 hover:-translate-y-0.5 hover:shadow-2xs"
              style={{
                backgroundColor: 'var(--surface-base)',
                borderColor: 'var(--border-subtle)',
              }}
            >
              <Building2 className="w-3.5 h-3.5 text-[#0284c7] flex-none" />
              <span className="text-xs font-medium tracking-tight whitespace-nowrap" style={{ color: 'var(--text-primary)' }}>
                Pan-India Deployment
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Auto-scrolling Dual Logo Tracks - Optimized Compact Spacing */}
      <div className="w-full flex flex-col gap-2.5 sm:gap-3 my-1">
        {/* Track 1: Left-to-Right Scrolling */}
        <div className="w-full">
          <LogoLoop
            logos={clientsRow1}
            direction="right"
            speed={45}
            logoHeight={64}
            gap={20}
            pauseOnHover={true}
            draggable={true}
            scaleOnHover={true}
            labels="none"
            fadeOut={true}
            fadeOutWidth={0.12}
            ariaLabel="Enterprise clients row 1"
          />
        </div>

        {/* Track 2: Right-to-Left Scrolling */}
        <div className="w-full">
          <LogoLoop
            logos={clientsRow2}
            direction="left"
            speed={45}
            logoHeight={64}
            gap={20}
            pauseOnHover={true}
            draggable={true}
            scaleOnHover={true}
            labels="none"
            fadeOut={true}
            fadeOutWidth={0.12}
            ariaLabel="Enterprise clients row 2"
          />
        </div>
      </div>
    </section>
  );
}
