"use client";

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { AnimatedSun, AnimatedMoon, AnimatedMonitor, AnimatedCheck } from "@/components/ui/animated-icons";
import { useTheme, type Theme } from "@/components/theme/ThemeProvider";

import { TooltipWrapper, SegmentedToggle } from "@/components/ui";

export interface ThemeToggleProps {
  showLabel?: boolean;
  className?: string;
  size?: "sm" | "md" | "lg";
  hideAmPm?: boolean;
  variant?: "switch" | "segmented";
}

export function ThemeToggle({
  showLabel = false,
  className = "",
  size = "sm",
  variant = "switch",
}: ThemeToggleProps) {
  const { theme, resolvedTheme, setTheme } = useTheme();
  const [isOpen, setIsOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const handle = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(handle);
  }, []);

  const isDark = mounted ? resolvedTheme === "dark" : false;

  const tooltipText = isDark ? "Switch to light mode" : "Switch to dark mode";

  const handleToggle = () => {
    if (theme === "system") {
      setTheme(isDark ? "light" : "dark");
    } else if (theme === "dark") {
      setTheme("light");
    } else {
      setTheme("dark");
    }
  };

  const options: { value: Theme; label: string; icon: React.ReactNode }[] = [
    { value: "light", label: "Light", icon: <AnimatedSun size={14} className="text-amber-500" /> },
    { value: "dark", label: "Dark", icon: <AnimatedMoon size={14} className="text-sky-400" /> },
    { value: "system", label: "System", icon: <AnimatedMonitor size={14} className="text-slate-400" /> },
  ];

  // Dimensions configuration for switch sizes
  const config = {
    sm: {
      trackWidth: "w-12",
      trackHeight: "h-6.5",
      thumbSize: "w-5.5 h-5.5",
      slideX: 22,
      iconSize: "w-3 h-3",
      textSize: "text-xs",
    },
    md: {
      trackWidth: "w-15",
      trackHeight: "h-8",
      thumbSize: "w-6.5 h-6.5",
      slideX: 28,
      iconSize: "w-3.5 h-3.5",
      textSize: "text-sm",
    },
    lg: {
      trackWidth: "w-18",
      trackHeight: "h-9.5",
      thumbSize: "w-8 h-8",
      slideX: 34,
      iconSize: "w-4 h-4",
      textSize: "text-base",
    },
  }[size] || {
    trackWidth: "w-12",
    trackHeight: "h-6.5",
    thumbSize: "w-5.5 h-5.5",
    slideX: 22,
    iconSize: "w-3 h-3",
    textSize: "text-xs",
  };

  if (variant === "segmented") {
    return (
      <SegmentedToggle<Theme>
        value={theme}
        onChange={(val) => setTheme(val)}
        layoutIdPrefix="theme-segmented-active"
        size="sm"
        className={className}
        items={options.map((opt) => ({
          id: opt.value,
          label: opt.label,
          icon: opt.icon,
        }))}
      />
    );
  }

  return (
    <div className={`relative inline-flex items-center gap-2.5 ${className}`} data-theme-toggle="true">
      {/* Switch Control */}
      <div className="relative inline-flex items-center" data-theme-toggle="true">
        <TooltipWrapper content={tooltipText} side="bottom">
          <button
            type="button"
            role="switch"
            data-theme-toggle="true"
            aria-label={tooltipText}
            aria-checked={isDark}
            onClick={handleToggle}
            onContextMenu={(e) => {
              e.preventDefault();
              setIsOpen(!isOpen);
            }}
            className={`relative inline-flex items-center rounded-full cursor-pointer transition-colors duration-200 select-none focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 ${config.trackWidth} ${config.trackHeight} ${
              isDark
                ? "bg-slate-900/90 border border-slate-700/80 hover:border-sky-500/50 shadow-inner"
                : "bg-slate-200/90 border border-slate-300/80 hover:border-amber-500/50 shadow-inner"
            }`}
          >
            {/* Background Ambient Icons */}
            <div className="w-full flex items-center justify-between px-1.5 pointer-events-none">
              <AnimatedSun size={12} className={`transition-opacity duration-200 ${!isDark ? "opacity-0" : "opacity-60 text-amber-400"}`} />
              <AnimatedMoon size={12} className={`transition-opacity duration-200 ${isDark ? "opacity-0" : "opacity-60 text-sky-400"}`} />
            </div>

            {/* Sliding Thumb */}
            <motion.div
              data-theme-toggle="true"
              className={`absolute top-0.5 left-0.5 rounded-full flex items-center justify-center shadow-md ${config.thumbSize} ${
                isDark
                  ? "bg-slate-950 text-sky-400 border border-sky-500/40 shadow-sky-950/60"
                  : "bg-white text-amber-500 border border-amber-200/80 shadow-slate-300/50"
              }`}
              animate={{
                x: isDark ? config.slideX : 0,
              }}
              transition={{
                type: "spring",
                stiffness: 500,
                damping: 28,
                mass: 0.7,
              }}
            >
              <AnimatePresence mode="popLayout" initial={false}>
                <motion.div
                  key={isDark ? "dark" : "light"}
                  initial={{ scale: 0.4, rotate: -90, opacity: 0 }}
                  animate={{ scale: 1, rotate: 0, opacity: 1 }}
                  exit={{ scale: 0.4, rotate: 90, opacity: 0 }}
                  transition={{ duration: 0.12, ease: "easeOut" }}
                  className="flex items-center justify-center"
                >
                  {isDark ? (
                    <AnimatedMoon size={12} className="fill-sky-400/20" />
                  ) : (
                    <AnimatedSun size={12} className="fill-amber-500/20" />
                  )}
                </motion.div>
              </AnimatePresence>
            </motion.div>
          </button>
        </TooltipWrapper>
      </div>

      {showLabel && (
        <span className={`${config.textSize} font-semibold text-[var(--color-ink)] capitalize select-none`}>
          {theme === "system" ? "System" : isDark ? "Dark" : "Light"} Mode
        </span>
      )}

      {/* Right-click Context Menu */}
      <AnimatePresence>
        {isOpen && (
          <>
            <div
              className="fixed inset-0 z-40"
              onClick={() => setIsOpen(false)}
            />
            <motion.div
              initial={{ opacity: 0, y: 8, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8, scale: 0.95 }}
              transition={{ duration: 0.15, ease: "easeOut" }}
              className="absolute right-0 top-full mt-2 w-36 py-1 z-50 bg-[var(--color-canvas-elevated)] border border-[var(--color-hairline)] rounded-xl shadow-xl overflow-hidden text-[var(--color-ink)]"
            >
              <div className="px-3 py-1.5 text-[10px] font-semibold text-[var(--color-mute)] uppercase tracking-wider border-b border-[var(--color-hairline)]">
                Select Theme
              </div>
              {options.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => {
                    setTheme(opt.value);
                    setIsOpen(false);
                  }}
                  className={`w-full flex items-center justify-between px-3 py-2 text-xs transition-colors hover:bg-[var(--color-hairline-soft-surface)] ${
                    theme === opt.value
                      ? "text-sky-600 dark:text-sky-400 font-semibold bg-sky-500/10"
                      : "text-[var(--color-mute)]"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    {opt.icon}
                    <span>{opt.label}</span>
                  </div>
                  {theme === opt.value && <AnimatedCheck size={14} className="text-sky-600 dark:text-sky-400" />}
                </button>
              ))}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

