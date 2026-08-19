"use client";

import Link from "next/link";
import { AnimatedArrowRight } from "@/components/ui/animated-icons";
import { ReachInternationalLogo } from "@/components/ui";

export function LandingFooter() {
  const year = new Date().getFullYear();

  return (
    <footer className="bg-[var(--color-canvas-elevated)] border-t border-[var(--color-hairline)] pt-16 pb-12 relative overflow-hidden">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-10 pb-12 border-b border-[var(--color-hairline)]">
          {/* Brand & Description */}
          <div className="md:col-span-5 space-y-4">
            <Link href="/" className="inline-flex items-center group">
              <ReachInternationalLogo variant="full" size={26} />
            </Link>
            <p className="text-xs sm:text-sm text-[var(--color-mute)] leading-relaxed max-w-sm">
              The intelligent machine service management platform for enterprise industrial fleets, field engineer dispatch, and automated maintenance workflows.
            </p>
            <div className="pt-2">
              <Link
                href="/login"
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-[var(--color-link)] hover:text-[var(--color-link-deep)] transition-colors group"
              >
                Access Command Center
                <AnimatedArrowRight size={14} className="transition-transform group-hover:translate-x-1" />
              </Link>
            </div>
          </div>

          {/* Navigation Links Columns */}
          <div className="md:col-span-7 grid grid-cols-2 sm:grid-cols-3 gap-8">
            <div>
              <h4 className="text-xs font-bold font-mono uppercase tracking-wider text-[var(--color-ink)] mb-4">
                Platform
              </h4>
              <ul className="space-y-2.5 text-xs text-[var(--color-body)]">
                <li>
                  <a href="#features" className="hover:text-[var(--color-ink)] transition-colors">
                    Machine Management
                  </a>
                </li>
                <li>
                  <a href="#workflow" className="hover:text-[var(--color-ink)] transition-colors">
                    Engineer Routing
                  </a>
                </li>
                <li>
                  <a href="#equipment" className="hover:text-[var(--color-ink)] transition-colors">
                    Equipment Gallery
                  </a>
                </li>
                <li>
                  <a href="#analytics" className="hover:text-[var(--color-ink)] transition-colors">
                    Telemetry Analytics
                  </a>
                </li>
              </ul>
            </div>

            <div>
              <h4 className="text-xs font-bold font-mono uppercase tracking-wider text-[var(--color-ink)] mb-4">
                Operations
              </h4>
              <ul className="space-y-2.5 text-xs text-[var(--color-body)]">
                <li>
                  <a href="#mobile" className="hover:text-[var(--color-ink)] transition-colors">
                    Field Workspace
                  </a>
                </li>
                <li>
                  <a href="#security" className="hover:text-[var(--color-ink)] transition-colors">
                    Security & RBAC
                  </a>
                </li>
                <li>
                  <a href="#trusted" className="hover:text-[var(--color-ink)] transition-colors">
                    Enterprise Metrics
                  </a>
                </li>
              </ul>
            </div>

            <div className="col-span-2 sm:col-span-1">
              <h4 className="text-xs font-bold font-mono uppercase tracking-wider text-[var(--color-ink)] mb-4">
                Account
              </h4>
              <ul className="space-y-2.5 text-xs text-[var(--color-body)]">
                <li>
                  <Link href="/login" className="hover:text-[var(--color-ink)] transition-colors">
                    Get Started
                  </Link>
                </li>
                <li>
                  <Link href="/login" className="hover:text-[var(--color-ink)] transition-colors">
                    Sign In
                  </Link>
                </li>
              </ul>
            </div>
          </div>
        </div>

        {/* Bottom Copyright Row */}
        <div className="pt-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-[var(--color-mute)]">
          <p>© {year} REACH INTERNATIONAL. All rights reserved.</p>
          <div className="flex items-center gap-6">
            <a href="#features" className="hover:text-[var(--color-ink)] transition-colors">
              Privacy Policy
            </a>
            <a href="#security" className="hover:text-[var(--color-ink)] transition-colors">
              Terms of Service
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
