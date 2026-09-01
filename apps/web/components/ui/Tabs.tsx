"use client";

import React from "react";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { motion } from "framer-motion";
import { SegmentedToggle, type SegmentedToggleSize } from "./SegmentedToggle";

export interface TabItem {
  id: string;
  label: string | React.ReactNode;
  count?: number | string;
  icon?: React.ReactNode;
  disabled?: boolean;
}

export interface TabsProps {
  tabs: TabItem[];
  activeTab: string;
  onChange?: (tabId: string) => void;
  /** If provided, synchronizes active tab with URL search parameter */
  urlParamKey?: string;
  /** Variant style: high-contrast segmented toggle, pill switcher, or clean underline tabs */
  variant?: "segmented" | "pill" | "underline";
  size?: SegmentedToggleSize;
  responsive?: boolean;
  fullWidth?: boolean;
  className?: string;
}

export function Tabs({
  tabs,
  activeTab,
  onChange,
  urlParamKey,
  variant = "segmented",
  size = "md",
  responsive = true,
  fullWidth = false,
  className = "",
}: TabsProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const handleTabClick = (tabId: string) => {
    if (onChange) {
      onChange(tabId);
    }

    if (urlParamKey) {
      const params = new URLSearchParams(searchParams.toString());
      params.set(urlParamKey, tabId);
      router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    }
  };

  if (variant === "segmented") {
    return (
      <SegmentedToggle
        items={tabs}
        value={activeTab}
        onChange={handleTabClick}
        size={size}
        responsive={responsive}
        fullWidth={fullWidth}
        className={className}
      />
    );
  }

  if (variant === "underline") {
    return (
      <div
        className={`flex items-center gap-4 sm:gap-6 border-b border-[var(--color-hairline)] overflow-x-auto custom-scrollbar flex-nowrap ${className}`}
      >
        {tabs.map((tab) => {
          const isActive = tab.id === activeTab;

          return (
            <button
              key={tab.id}
              type="button"
              disabled={tab.disabled}
              onClick={() => handleTabClick(tab.id)}
              className={`relative pb-3 text-xs sm:text-sm font-semibold transition-colors flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
                isActive
                  ? "text-sky-600 dark:text-sky-400 font-bold"
                  : "text-[var(--color-mute)] hover:text-[var(--color-ink)]"
              } ${tab.disabled ? "opacity-40 cursor-not-allowed" : ""}`}
            >
              {tab.icon}
              <span>{tab.label}</span>
              {tab.count !== undefined && (
                <span
                  className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono font-bold ${
                    isActive
                      ? "bg-sky-500/15 text-sky-700 dark:text-sky-300"
                      : "bg-[var(--color-hairline-soft-surface)] text-[var(--color-mute)]"
                  }`}
                >
                  {tab.count}
                </span>
              )}

              {isActive && (
                <motion.div
                  layoutId="underline-active"
                  className="absolute bottom-0 left-0 right-0 h-0.5 bg-sky-600 dark:bg-sky-400 rounded-full"
                  transition={{ type: "spring", stiffness: 400, damping: 30 }}
                />
              )}
            </button>
          );
        })}
      </div>
    );
  }

  // Pill variant
  return (
    <div
      className={`inline-flex p-1 rounded-xl bg-[var(--color-hairline-soft-surface)] dark:bg-neutral-900 border border-[var(--color-hairline)] gap-1 overflow-x-auto custom-scrollbar flex-nowrap max-w-full ${className}`}
    >
      {tabs.map((tab) => {
        const isActive = tab.id === activeTab;

        return (
          <button
            key={tab.id}
            type="button"
            disabled={tab.disabled}
            onClick={() => handleTabClick(tab.id)}
            className={`relative px-3 sm:px-3.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all select-none whitespace-nowrap cursor-pointer ${
              isActive
                ? "bg-[var(--color-canvas-elevated)] text-[var(--color-ink)] shadow-xs font-bold"
                : "text-[var(--color-mute)] hover:text-[var(--color-ink)] hover:bg-[var(--color-canvas)]/50"
            } ${tab.disabled ? "opacity-40 cursor-not-allowed" : ""}`}
          >
            {tab.icon}
            <span>{tab.label}</span>
            {tab.count !== undefined && (
              <span
                className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono font-bold ${
                  isActive
                    ? "bg-sky-500/15 text-sky-700 dark:text-sky-300"
                    : "bg-[var(--color-hairline-soft-surface)] text-[var(--color-mute)]"
                }`}
              >
                {tab.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
