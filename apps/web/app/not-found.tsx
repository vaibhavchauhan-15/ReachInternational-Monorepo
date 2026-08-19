"use client";

import { AnimatedSearchX, AnimatedArrowLeft, AnimatedHome } from "@/components/ui/animated-icons";
import { PublicNavbar } from "@/components/layout/PublicNavbar";
import { Button } from "@/components/ui";

export default function NotFound() {
  return (
    <div className="flex min-h-screen w-full flex-col bg-background text-foreground pt-16">
      <PublicNavbar />

      {/* Main Content Area */}
      <main className="flex flex-1 flex-col items-center justify-center p-6 text-center">
        <div className="w-full max-w-lg rounded-2xl border border-border bg-card p-8 sm:p-12 shadow-xl flex flex-col items-center text-card-foreground">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 rounded-full border border-border bg-muted/60 px-3.5 py-1.5 text-xs font-semibold text-muted-foreground mb-6 shadow-2xs">
            <AnimatedSearchX size={16} className="text-rose-500" />
            <span>404 — Page Not Found</span>
          </div>

          {/* Animated SVG Face Component */}
          <div className="my-custom-face-container text-foreground w-full mb-4">
            <svg className="face text-foreground" viewBox="0 0 320 380">
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
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground mb-3">
            Looks like you&apos;re lost
          </h1>

          <p className="text-sm text-muted-foreground leading-relaxed max-w-sm mb-8">
            The page or machine schedule you are looking for might have been removed, renamed, or is temporarily unavailable.
          </p>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 w-full sm:w-auto">
            <Button
              variant="secondary"
              className="w-full sm:w-auto min-w-[140px] text-xs"
              onClick={() => window.history.back()}
            >
              <AnimatedArrowLeft size={16} className="mr-1.5" />
              Go Back
            </Button>

            <Button
              variant="primary"
              href="/dashboard"
              className="w-full sm:w-auto min-w-[140px] text-xs"
            >
              <AnimatedHome size={16} className="mr-1.5" />
              Dashboard
            </Button>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="py-6 text-center text-xs text-muted-foreground border-t border-border bg-card/40">
        REACH INTERNATIONAL &copy; {new Date().getFullYear()} — Reaching All Heights
      </footer>
    </div>
  );
}
