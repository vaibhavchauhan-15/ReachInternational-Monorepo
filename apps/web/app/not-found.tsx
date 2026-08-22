"use client";

import { AnimatedSearchX, AnimatedArrowLeft, AnimatedHome } from "@/components/ui/animated-icons";
import { ReachInternationalLogo } from "@/components/branding";
import { Button } from "@/components/ui";

export default function NotFound() {
  return (
    <div className="flex min-h-screen w-full flex-col bg-background text-foreground items-center justify-between p-4 sm:p-6 lg:p-8">
      {/* Top Header Branding */}
      <header className="w-full max-w-5xl flex items-center justify-center sm:justify-start py-2">
        <a
          href="/dashboard"
          className="hover:opacity-90 transition-opacity focus:outline-none focus:ring-2 focus:ring-sky-500 rounded-lg p-1"
        >
          <ReachInternationalLogo variant="full" size={28} />
        </a>
      </header>

      {/* Main Content Area */}
      <main className="flex flex-1 flex-col items-center justify-center w-full my-auto py-6 sm:py-10">
        <div className="w-full max-w-sm sm:max-w-md md:max-w-lg lg:max-w-xl rounded-2xl border border-border bg-card p-6 sm:p-8 md:p-12 shadow-xl flex flex-col items-center text-card-foreground transition-all duration-200">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 rounded-full border border-border bg-muted/60 px-3.5 py-1.5 text-xs font-semibold text-muted-foreground mb-4 sm:mb-6 shadow-2xs">
            <AnimatedSearchX size={16} className="text-rose-500" />
            <span>404 — Page Not Found</span>
          </div>

          {/* Animated SVG Face Component */}
          <div className="my-custom-face-container text-foreground w-full max-w-[140px] sm:max-w-[180px] md:max-w-[210px] mx-auto mb-4 sm:mb-6">
            <svg className="face text-foreground w-full h-auto" viewBox="0 0 320 380">
              <g
                fill="none"
                stroke="currentColor"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={25}
              >
                <g className="face__eyes" transform="translate(0,112.5)">
                  <g transform="translate(15,0)">
                    <polyline className="face__eye-lid" points="37,0 0,120 75,120" />
                    <polyline
                      className="face__pupil"
                      points="55,120 55,155"
                      strokeDasharray="35 35"
                    />
                  </g>
                  <g transform="translate(230,0)">
                    <polyline className="face__eye-lid" points="37,0 0,120 75,120" />
                    <polyline
                      className="face__pupil"
                      points="55,120 55,155"
                      strokeDasharray="35 35"
                    />
                  </g>
                </g>
                <rect
                  className="face__nose"
                  x="132.5"
                  y="112.5"
                  width={55}
                  height={155}
                  rx={4}
                  ry={4}
                />
                <g transform="translate(65,334)" strokeDasharray="102 102">
                  <path className="face__mouth-left" d="M 0 30 C 0 30 40 0 95 0" />
                  <path className="face__mouth-right" d="M 95 0 C 150 0 190 30 190 30" />
                </g>
              </g>
            </svg>
          </div>

          {/* Title and Explanation */}
          <h1 className="text-xl sm:text-2xl md:text-3xl font-bold tracking-tight text-foreground mb-2 sm:mb-3 text-center">
            Looks like you&apos;re lost
          </h1>

          <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed max-w-xs sm:max-w-sm md:max-w-md text-center mb-6 sm:mb-8">
            The page or machine schedule you are looking for might have been removed, renamed, or is temporarily unavailable.
          </p>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 w-full sm:w-auto">
            <Button
              variant="secondary"
              className="w-full sm:w-auto min-w-[140px] text-xs h-10"
              onClick={() => window.history.back()}
            >
              <AnimatedArrowLeft size={16} className="mr-1.5" />
              Go Back
            </Button>

            <Button
              variant="primary"
              href="/dashboard"
              className="w-full sm:w-auto min-w-[140px] text-xs h-10"
            >
              <AnimatedHome size={16} className="mr-1.5" />
              Dashboard
            </Button>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="w-full text-center py-4 text-xs text-muted-foreground border-t border-border bg-card/40 rounded-lg">
        REACH INTERNATIONAL &copy; {new Date().getFullYear()} — Reaching All Heights
      </footer>
    </div>
  );
}

