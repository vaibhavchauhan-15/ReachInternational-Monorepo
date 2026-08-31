"use client";

import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  AnimatedSearch,
  AnimatedSlidersHorizontal,
  AnimatedX,
  AnimatedRotateCcw,
  AnimatedChevronDown,
} from "./animated-icons";

export interface FilterToolbarProps {
  /** Search query value */
  searchQuery: string;
  /** Function to update search query */
  onSearchChange: (value: string) => void;
  /** Search input placeholder text */
  placeholder?: string;
  /** Number of active filters (excluding default state) */
  activeFilterCount?: number;
  /** Callback when "Reset / Clear filters" is clicked */
  onResetFilters?: () => void;
  /** Optional custom action elements on the search row */
  actions?: React.ReactNode;
  /** Filter options/pills/dropdowns content rendered inside the expandable filter panel */
  children?: React.ReactNode;
  /** Optional default state for filter panel open/closed */
  defaultOpen?: boolean;
  /** Custom class name for outer card wrapper */
  className?: string;
  /** Optional submit handler for form submission */
  onSubmitSearch?: (e: React.FormEvent) => void;
}

export function FilterToolbar({
  searchQuery,
  onSearchChange,
  placeholder = "Search...",
  activeFilterCount = 0,
  onResetFilters,
  actions,
  children,
  defaultOpen = false,
  className = "",
  onSubmitSearch,
}: FilterToolbarProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const [isAnimating, setIsAnimating] = useState(false);

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (onSubmitSearch) onSubmitSearch(e);
  };

  const toggleOpen = () => {
    setIsAnimating(true);
    setIsOpen((prev) => !prev);
  };

  return (
    <div
      className={`p-3 sm:p-3.5 rounded-xl border border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)] shadow-xs ${className}`}
    >
      {/* Top Toolbar Row: Search Input + Filter Toggle Button + Actions */}
      <form onSubmit={handleFormSubmit} className="flex items-center gap-2 sm:gap-2.5">
        {/* Instant Search Input Bar */}
        <div className="relative flex-1 group">
          <AnimatedSearch
            size={14}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-mute)] group-focus-within:text-[var(--color-ink)] group-hover:text-[var(--color-ink)] transition-colors pointer-events-none"
          />
          <input
            type="text"
            placeholder={placeholder}
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="w-full pl-9 pr-8 py-2 text-xs rounded-lg border border-[var(--color-hairline)] bg-[var(--color-canvas)] text-[var(--color-ink)] placeholder-[var(--color-mute)] focus:outline-none focus:border-[var(--color-ink)] focus:ring-1 focus:ring-[var(--color-ink)]/20 transition-all"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => onSearchChange("")}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 rounded-full hover:bg-[var(--color-hairline-soft-surface)] text-[var(--color-mute)] hover:text-[var(--color-ink)] transition-colors"
              title="Clear search query"
            >
              <AnimatedX size={14} />
            </button>
          )}
        </div>

        {/* Filter Toggle Button */}
        {children && (
          <button
            type="button"
            onClick={toggleOpen}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg border text-xs font-semibold active:scale-95 transition-all duration-200 shrink-0 select-none cursor-pointer ${
              isOpen || activeFilterCount > 0
                ? "bg-[var(--color-ink)] text-[var(--color-canvas)] border-[var(--color-ink)] shadow-xs"
                : "bg-[var(--color-canvas)] text-[var(--color-ink)] border-[var(--color-hairline)] hover:border-[var(--color-ink)]/40 hover:bg-[var(--color-hairline-soft-surface)]"
            }`}
          >
            <AnimatedSlidersHorizontal size={14} />
            <span>Filter</span>
            {activeFilterCount > 0 && (
              <span
                className={`flex h-4 min-w-[16px] px-1 items-center justify-center rounded-full text-[10px] font-bold transition-colors ${
                  isOpen || activeFilterCount > 0
                    ? "bg-[var(--color-canvas)] text-[var(--color-ink)]"
                    : "bg-[var(--color-ink)] text-[var(--color-canvas)]"
                }`}
              >
                {activeFilterCount}
              </span>
            )}
            <AnimatedChevronDown
              size={12}
              className={`transition-transform duration-300 ease-out ${isOpen ? "rotate-180" : ""}`}
            />
          </button>
        )}

        {/* Custom Actions (e.g. Export / Custom Buttons / View Switcher) */}
        {actions}

        {/* Quick Reset Filters Button */}
        {activeFilterCount > 0 && onResetFilters && (
          <button
            type="button"
            onClick={onResetFilters}
            className="flex items-center gap-1 px-2.5 py-2 rounded-lg text-xs font-medium text-[var(--color-mute)] hover:text-[var(--color-ink)] hover:bg-[var(--color-hairline-soft-surface)] transition-all shrink-0 cursor-pointer active:scale-95"
            title="Reset all filters"
          >
            <AnimatedRotateCcw size={14} />
            <span className="hidden sm:inline">Reset</span>
          </button>
        )}
      </form>

      {/* Expandable / Collapsible Filter Panel with Buttery Smooth Transition */}
      <AnimatePresence initial={false}>
        {isOpen && children && (
          <motion.div
            key="filter-panel"
            initial={{ opacity: 0, height: 0 }}
            animate={{
              opacity: 1,
              height: "auto",
              transition: {
                height: { duration: 0.28, ease: [0.16, 1, 0.3, 1] },
                opacity: { duration: 0.22, ease: "easeOut", delay: 0.04 },
              },
            }}
            exit={{
              opacity: 0,
              height: 0,
              transition: {
                height: { duration: 0.22, ease: [0.16, 1, 0.3, 1] },
                opacity: { duration: 0.16, ease: "easeIn" },
              },
            }}
            onAnimationStart={() => setIsAnimating(true)}
            onAnimationComplete={() => setIsAnimating(false)}
            style={{ willChange: isAnimating ? "height, opacity" : "auto" }}
            className={isAnimating ? "overflow-hidden" : "overflow-visible"}
          >
            <div className="pt-3 mt-3 border-t border-[var(--color-hairline)] overflow-visible">
              <motion.div
                initial={{ y: -6, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: -4, opacity: 0 }}
                transition={{ duration: 0.2, ease: "easeOut" }}
                className="overflow-visible"
              >
                {children}
              </motion.div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
