import { Suspense } from "react";
import Link from "next/link";
import Image from "next/image";
import { LoginFormClient } from "./login-form";
import { ReachInternationalLogo } from "@/components/ui";

export default function LoginPage() {
  return (
    <div className="h-screen h-[100dvh] max-h-screen w-full flex flex-col lg:flex-row bg-[#080909] text-[#F5F7F8] dark:bg-[#080909] dark:text-[#F5F7F8] [html:not(.dark)_&]:bg-[#F7F8FA] [html:not(.dark)_&]:text-[#111315] overflow-hidden select-none">
      {/* ============================================================
          Left: Visual & Industrial Fleet Showcase Panel (Desktop only)
          40% width, restrained dark charcoal/cool gray surface
          ============================================================ */}
      <div className="relative hidden lg:flex flex-col justify-between h-full lg:w-[40%] p-8 xl:p-10 2xl:p-12 border-r border-[#26292C] dark:border-[#26292C] [html:not(.dark)_&]:border-[#E1E5E9] bg-[#0E1011] dark:bg-[#0E1011] [html:not(.dark)_&]:bg-[#F4F6F8] overflow-hidden">
        {/* Minimal atmospheric Reach Blue glow behind machine */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[440px] h-[440px] bg-[radial-gradient(circle_at_center,rgba(0,174,239,0.09)_0%,rgba(0,174,239,0.02)_50%,transparent_70%)] dark:bg-[radial-gradient(circle_at_center,rgba(0,174,239,0.12)_0%,rgba(0,174,239,0.03)_50%,transparent_70%)] rounded-full blur-3xl pointer-events-none" />

        {/* Top Header / Logo */}
        <div className="flex items-center justify-between z-10">
          <Link
            href="/"
            className="inline-flex items-center group focus:outline-none focus-visible:ring-2 focus-visible:ring-[#00AEEF] rounded-lg transition-transform hover:scale-[1.01]"
            aria-label="Reach International Home"
          >
            <ReachInternationalLogo variant="full" size={28} />
          </Link>
        </div>

        {/* Hero Central Content: Industrial & Fleet Platform Identity */}
        <div className="my-auto flex flex-col gap-6 xl:gap-8 max-w-md xl:max-w-lg z-10 py-4">
          <div className="flex flex-col gap-2">
            <h1 className="text-3xl sm:text-4xl xl:text-5xl font-bold tracking-tight text-[#F5F7F8] dark:text-[#F5F7F8] [html:not(.dark)_&]:text-[#111315] leading-[1.1]">
              Manage your fleet.
              <br />
              <span className="text-[#00AEEF] dark:text-[#00AEEF] [html:not(.dark)_&]:text-[#008FD0]">
                Track every hour.
              </span>
            </h1>
          </div>

          {/* Machine Showcase Stage with Ground Shadow Pedestal */}
          <div className="relative pt-2 pb-1 flex items-center justify-center">
            {/* Ground Shadow Pedestal under boom lift wheels */}
            <div className="absolute bottom-1 left-1/2 -translate-x-1/2 w-[90%] max-w-[360px] xl:max-w-[420px] h-6 bg-[radial-gradient(ellipse_at_center,rgba(0,0,0,0.18)_0%,rgba(0,0,0,0.04)_50%,transparent_70%)] dark:bg-[radial-gradient(ellipse_at_center,rgba(0,0,0,0.85)_0%,rgba(0,0,0,0.25)_50%,transparent_70%)] blur-[4px] pointer-events-none z-0" />

            {/* Industrial Machinery Transparent PNG Asset */}
            <div className="relative z-10 w-full max-w-[340px] xl:max-w-[400px] 2xl:max-w-[440px] transition-transform duration-500 hover:scale-[1.02]">
              <Image
                src="/loginpageimage.png"
                alt="Reach International Aerial Boom Lift Fleet Equipment"
                width={800}
                height={533}
                priority
                className="w-full h-auto max-h-[32vh] xl:max-h-[36vh] object-contain drop-shadow-sm dark:drop-shadow-[0_12px_24px_rgba(0,0,0,0.6)] select-none pointer-events-none"
              />
            </div>
          </div>
        </div>

        {/* Minimal Bottom Spacer */}
        <div className="h-4 z-10" />
      </div>

      {/* ============================================================
          Right: Dedicated Authentication Workspace (60% width on desktop)
          Clean floating card, responsive single-focus view on mobile
          ============================================================ */}
      <div className="relative flex-1 lg:w-[60%] h-full flex flex-col justify-between items-center p-4 sm:p-6 lg:p-8 xl:p-12 overflow-y-auto lg:overflow-hidden bg-[#080909] dark:bg-[#080909] [html:not(.dark)_&]:bg-[#F7F8FA]">
        {/* Top Spacer */}
        <div className="w-full h-2 shrink-0" />

        {/* Center: Floating Authentication Card */}
        <div className="w-full flex items-center justify-center my-auto py-2 z-10">
          <Suspense fallback={<div className="w-full max-w-[480px] sm:max-w-[500px] h-[480px] animate-pulse rounded-[14px] bg-[#111314] dark:bg-[#111314] [html:not(.dark)_&]:bg-white border border-[#26292C] dark:border-[#26292C] [html:not(.dark)_&]:border-[#E1E5E9]" />}>
            <LoginFormClient />
          </Suspense>
        </div>

        {/* Minimal Bottom Footer */}
        <div className="w-full flex items-center justify-center text-[11px] font-mono text-[#969CA3] dark:text-[#969CA3] [html:not(.dark)_&]:text-[#626970] shrink-0 pt-2 pb-1">
          <span>&copy; {new Date().getFullYear()} REACH INTERNATIONAL. ALL RIGHTS RESERVED.</span>
        </div>
      </div>
    </div>
  );
}