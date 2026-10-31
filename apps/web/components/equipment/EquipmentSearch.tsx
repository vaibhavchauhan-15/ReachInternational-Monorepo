"use client";

import React, { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Search, X, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";

export interface EquipmentSearchProps {
  initialValue?: string;
  placeholder?: string;
  className?: string;
  autoFocus?: boolean;
  onSearchChange?: (val: string) => void;
  targetUrl?: string;
}

const POPULAR_SUGGESTIONS = [
  "Boom Lift",
  "Scissor Lift",
  "JLG 300AJP",
  "Electric Forklift",
  "Toyota Reach Truck",
  "Rough Terrain",
  "Genie Z-45",
  "Diesel Forklift",
];

export function EquipmentSearch({
  initialValue = "",
  placeholder = "Search by model name, brand (JLG, Toyota, JCB), category or working height...",
  className,
  autoFocus = false,
  onSearchChange,
  targetUrl = "/equipment",
}: EquipmentSearchProps) {
  const router = useRouter();
  const [value, setValue] = useState(initialValue);
  const [isFocused, setIsFocused] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setValue(initialValue);
  }, [initialValue]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const query = value.trim();
    if (onSearchChange) {
      onSearchChange(query);
    } else {
      router.push(`${targetUrl}?q=${encodeURIComponent(query)}`);
    }
    inputRef.current?.blur();
    setIsFocused(false);
  };

  const handleClear = () => {
    setValue("");
    if (onSearchChange) {
      onSearchChange("");
    }
    inputRef.current?.focus();
  };

  const handleSelectSuggestion = (suggestion: string) => {
    setValue(suggestion);
    if (onSearchChange) {
      onSearchChange(suggestion);
    } else {
      router.push(`${targetUrl}?q=${encodeURIComponent(suggestion)}`);
    }
    setIsFocused(false);
  };

  // Close suggestions dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsFocused(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div ref={containerRef} className={cn("relative w-full max-w-3xl mx-auto", className)}>
      <form
        onSubmit={handleSubmit}
        className={cn(
          "relative flex items-center w-full rounded-2xl transition-all duration-300",
          "bg-white dark:bg-[#141414]",
          "border border-neutral-300/80 dark:border-neutral-700/80",
          "shadow-sm hover:border-neutral-400 dark:hover:border-neutral-600",
          isFocused &&
            "border-[#0284c7] ring-4 ring-[#0284c7]/15 dark:border-[#0284c7] shadow-lg dark:shadow-[0_8px_30px_rgb(0,0,0,0.5)]"
        )}
      >
        <div className="pl-4 sm:pl-5 text-neutral-400 dark:text-neutral-500 pointer-events-none">
          <Search className="size-5" />
        </div>

        <input
          ref={inputRef}
          type="search"
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            if (onSearchChange) {
              onSearchChange(e.target.value);
            }
          }}
          onFocus={() => setIsFocused(true)}
          placeholder={placeholder}
          autoFocus={autoFocus}
          className="w-full py-3.5 sm:py-4 px-3 sm:px-4 text-sm sm:text-base bg-transparent text-neutral-900 dark:text-white placeholder:text-neutral-400 dark:placeholder:text-neutral-500 focus:outline-hidden"
        />

        <div className="flex items-center gap-1.5 pr-2.5 sm:pr-3">
          {value.length > 0 && (
            <button
              type="button"
              onClick={handleClear}
              className="p-1.5 rounded-lg text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
              aria-label="Clear search input"
            >
              <X className="size-4" />
            </button>
          )}

          <button
            type="submit"
            className="hidden sm:inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold bg-[#0284c7] hover:bg-[#0369a1] text-white shadow-2xs transition-colors cursor-pointer"
          >
            <span>Search</span>
            <ArrowRight className="size-3.5 opacity-70" />
          </button>
        </div>
      </form>

      {/* Suggested Search Term Chips / Dropdown on focus */}
      {isFocused && (
        <div className="absolute top-full left-0 right-0 mt-2 p-3 sm:p-4 rounded-xl sm:rounded-2xl bg-white dark:bg-[#181818] border border-neutral-200 dark:border-neutral-750 shadow-xl z-30">
          <div className="text-[11px] font-mono uppercase tracking-wider text-neutral-400 dark:text-neutral-500 mb-2.5">
            Popular Machinery Searches
          </div>
          <div className="flex flex-wrap gap-1.5">
            {POPULAR_SUGGESTIONS.map((sug) => (
              <button
                key={sug}
                type="button"
                onMouseDown={() => handleSelectSuggestion(sug)}
                className="px-2.5 py-1 rounded-lg text-xs font-medium bg-neutral-100 hover:bg-neutral-200 dark:bg-neutral-800 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-300 transition-colors cursor-pointer flex items-center gap-1"
              >
                <span>{sug}</span>
                <ArrowRight className="size-3 opacity-60" />
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
