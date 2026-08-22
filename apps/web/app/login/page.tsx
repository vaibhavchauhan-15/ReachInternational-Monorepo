import Link from "next/link";
import {
  AnimatedShieldCheck,
  AnimatedCheckCircle,
  AnimatedCpu,
  AnimatedBellRing,
  AnimatedActivity,
} from "@/components/ui/animated-icons";
import { LoginFormClient } from "./login-form";
import { ReachInternationalLogo } from "@/components/ui";

export default function LoginPage() {
  return (
    <div className="flex min-h-screen w-full flex-col lg:flex-row bg-background text-foreground relative overflow-hidden">
      {/* Left: Hero panel with mesh gradient & ambient glow */}
      <div className="mesh-gradient relative flex flex-col justify-between p-8 sm:p-12 lg:w-[50%] xl:w-[52%] lg:p-16 border-b lg:border-b-0 lg:border-r border-border overflow-hidden">
        {/* Soft background glow decoration */}
        <div className="absolute -top-24 -left-24 w-96 h-96 bg-sky-500/10 dark:bg-sky-500/15 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -right-24 w-96 h-96 bg-violet-500/10 dark:bg-violet-500/15 rounded-full blur-3xl pointer-events-none" />

        {/* Top Header / Logo */}
        <div className="flex items-center justify-between gap-4 z-10">
          <Link href="/" className="flex items-center group focus:outline-none">
            <ReachInternationalLogo variant="full" size={32} />
          </Link>
        </div>

        {/* Hero Central Content */}
        <div className="my-10 lg:my-14 flex flex-col gap-6 max-w-lg z-10">
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight text-foreground leading-[1.12]">
            Never miss a{" "}
            <span className="bg-gradient-to-r from-sky-500 via-indigo-500 to-violet-500 bg-clip-text text-transparent">
              service deadline
            </span>{" "}
            again.
          </h1>

          <p className="text-sm sm:text-base text-muted-foreground leading-relaxed">
            Centralized industrial fleet service tracking with automated multi-channel dispatch. Built for enterprise reliability.
          </p>

          <div className="flex flex-col sm:flex-row flex-wrap gap-3 pt-2">
            <div className="flex items-center gap-2.5 text-xs font-semibold text-foreground bg-card/70 backdrop-blur-md px-3.5 py-2 rounded-xl border border-border/80 shadow-2xs hover:border-border transition-all">
              <div className="h-2 w-2 rounded-full bg-sky-500" />
              Real-time Machine Status Sync
            </div>
            <div className="flex items-center gap-2.5 text-xs font-semibold text-foreground bg-card/70 backdrop-blur-md px-3.5 py-2 rounded-xl border border-border/80 shadow-2xs hover:border-border transition-all">
              <div className="h-2 w-2 rounded-full bg-violet-500" />
              Automated Email Alerts
            </div>
            <div className="flex items-center gap-2.5 text-xs font-semibold text-foreground bg-card/70 backdrop-blur-md px-3.5 py-2 rounded-xl border border-border/80 shadow-2xs hover:border-border transition-all">
              <div className="h-2 w-2 rounded-full bg-emerald-500" />
              Audit Security & Compliance
            </div>
          </div>
        </div>

        {/* Footer Metrics */}
        <div className="grid grid-cols-3 gap-4 pt-6 border-t border-border/60 z-10">
          <div>
            <div className="text-xl sm:text-2xl font-bold text-foreground flex items-center gap-2">
              <AnimatedCpu size={18} className="text-sky-500" />
              500+
            </div>
            <div className="text-xs text-muted-foreground mt-1 font-medium">Machines tracked</div>
          </div>
          <div className="border-l border-border/60 pl-4">
            <div className="text-xl sm:text-2xl font-bold text-foreground flex items-center gap-2">
              <AnimatedBellRing size={18} className="text-emerald-500" />
              0
            </div>
            <div className="text-xs text-muted-foreground mt-1 font-medium">Missed alerts</div>
          </div>
          <div className="border-l border-border/60 pl-4">
            <div className="text-xl sm:text-2xl font-bold text-foreground flex items-center gap-2">
              <AnimatedActivity size={18} className="text-indigo-500" />
              24/7
            </div>
            <div className="text-xs text-muted-foreground mt-1 font-medium font-mono">Automated</div>
          </div>
        </div>
      </div>

      {/* Right: Login form panel */}
      <div className="flex flex-1 items-center justify-center p-6 sm:p-12 lg:p-16 bg-background relative">
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="w-[420px] h-[420px] bg-sky-500/5 dark:bg-sky-500/10 rounded-full blur-3xl" />
        </div>
        <LoginFormClient />
      </div>
    </div>
  );
}