"use client";

import { useState, useRef, useEffect, useMemo, type ReactNode } from "react";
import {
  AnimatedChevronDown,
  AnimatedCheck,
  AnimatedX,
} from "./animated-icons";
import { Search } from "lucide-react";

export interface ClientSelectItem {
  id: string;
  client_name?: string | null;
  name?: string | null;
  company_name?: string | null;
  code?: string | null;
  city?: string | null;
  state?: string | null;
  address?: string | null;
  phone?: string | null;
  email?: string | null;
  status?: string | null;
  [key: string]: any;
}

export interface ClientSelectProps {
  clients: ClientSelectItem[];
  value?: string;
  onChange: (clientId: string, client?: ClientSelectItem | null) => void;
  label?: ReactNode;
  placeholder?: string;
  disabled?: boolean;
  required?: boolean;
  clearable?: boolean;
  allowAll?: boolean;
  allLabel?: string;
  compact?: boolean;
  error?: string;
  className?: string;
}

function getFormattedClientLocation(client?: ClientSelectItem | null): string {
  if (!client) return "";
  const parts = [client.address, client.city, client.state].filter(Boolean);
  return parts.join(", ");
}

export function ClientSelect({
  clients = [],
  value = "",
  onChange,
  label,
  placeholder = "Search or select client...",
  disabled = false,
  required = false,
  clearable = false,
  allowAll = false,
  allLabel = "All Clients",
  compact = false,
  error,
  className = "",
}: ClientSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const isAllSelected = allowAll && (value === "all" || value === "");

  const selectedClient = useMemo(() => {
    if (isAllSelected) return null;
    return clients.find((c) => c.id === value) || null;
  }, [clients, value, isAllSelected]);

  const clientLocationStr = useMemo(() => {
    return getFormattedClientLocation(selectedClient);
  }, [selectedClient]);

  // Search filter matching client name, company name, code, city, state, address
  const filteredClients = useMemo(() => {
    if (!searchQuery.trim()) return clients;
    const q = searchQuery.toLowerCase().trim();
    return clients.filter((c) => {
      const nameMatch = (c.client_name || c.name)?.toLowerCase().includes(q);
      const companyMatch = c.company_name?.toLowerCase().includes(q);
      const codeMatch = c.code?.toLowerCase().includes(q);
      const cityMatch = c.city?.toLowerCase().includes(q);
      const stateMatch = c.state?.toLowerCase().includes(q);
      const addressMatch = c.address?.toLowerCase().includes(q);
      return nameMatch || companyMatch || codeMatch || cityMatch || stateMatch || addressMatch;
    });
  }, [clients, searchQuery]);

  // Click outside listener
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
        setSearchQuery("");
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleOpenToggle = () => {
    if (disabled) return;
    const nextState = !isOpen;
    setIsOpen(nextState);
    if (nextState) {
      setTimeout(() => searchInputRef.current?.focus(), 50);
    } else {
      setSearchQuery("");
    }
  };

  const handleSelect = (clientId: string) => {
    if (clientId === "all") {
      onChange("all", null);
    } else {
      const target = clients.find((c) => c.id === clientId) || null;
      onChange(clientId, target);
    }
    setIsOpen(false);
    setSearchQuery("");
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange(allowAll ? "all" : "", null);
    setSearchQuery("");
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (disabled) return;
    if (e.key === "Escape") {
      setIsOpen(false);
      setSearchQuery("");
    }
  };

  const clientDisplayName = selectedClient?.company_name || selectedClient?.client_name || selectedClient?.name || "";

  return (
    <div
      className={`relative flex flex-col gap-1 w-full ${className}`}
      ref={containerRef}
      onKeyDown={handleKeyDown}
    >
      {label && (
        <label className="block text-[12px] sm:text-[13px] font-medium text-[var(--color-ink)] mb-1 flex items-center justify-between select-none">
          <span>
            {label} {required && <span className="text-rose-500 font-semibold">*</span>}
          </span>
        </label>
      )}

      {/* Trigger Button */}
      <button
        type="button"
        disabled={disabled}
        onClick={handleOpenToggle}
        className={`w-full px-3 sm:px-3.5 rounded-lg border text-xs sm:text-[13px] font-medium text-[var(--color-ink)] flex items-center justify-between transition-all shadow-2xs ${
          compact ? "h-[38px] min-h-[38px] py-1.5" : "h-[42px] sm:h-[44px] min-h-[42px] sm:min-h-[44px]"
        } ${
          error
            ? "border-rose-500 dark:border-rose-400 bg-rose-500/5 dark:bg-rose-500/10 focus:border-rose-500"
            : isOpen
            ? "border-sky-500 dark:border-sky-400 bg-[var(--color-canvas)] ring-2 ring-sky-500/15"
            : "border-[var(--color-hairline)] dark:border-[#292C2F] [html:not(.dark)_&]:border-[#E1E5E9] bg-[var(--color-canvas)] hover:border-[#3A3E42] dark:hover:border-[#3A3E42] [html:not(.dark)_&]:hover:border-[#CBD5E1]"
        } ${disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
      >
        <span className="truncate flex items-center gap-2 pr-1">
          {isAllSelected ? (
            <span className="font-bold text-[var(--color-ink)] flex items-center gap-2">
              <span>{allLabel}</span>
              <span className="px-1.5 py-0.5 rounded bg-[var(--color-hairline-soft-surface)] text-[var(--color-mute)] font-mono text-[10px]">
                {clients.length} Total
              </span>
            </span>
          ) : selectedClient ? (
            <>
              <span className="truncate font-extrabold">
                {clientDisplayName}
              </span>
              {selectedClient.code && (
                <span className="px-1.5 py-0.5 rounded bg-sky-500/10 text-sky-600 dark:text-sky-400 font-mono text-[10px] shrink-0 font-bold">
                  {selectedClient.code}
                </span>
              )}
              {!compact && clientLocationStr && (
                <span className="text-[10px] text-[var(--color-mute)] font-normal truncate hidden md:inline">
                  📍 {clientLocationStr}
                </span>
              )}
            </>
          ) : (
            <span className="text-[var(--color-mute)] font-normal">{placeholder}</span>
          )}
        </span>

        <span className="flex items-center gap-1.5 shrink-0">
          {clearable && selectedClient && (
            <span
              role="button"
              tabIndex={0}
              onClick={handleClear}
              className="p-1 rounded-full hover:bg-[var(--color-hairline-soft-surface)] text-[var(--color-mute)] hover:text-[var(--color-ink)] cursor-pointer"
            >
              <AnimatedX size={12} />
            </span>
          )}
          <AnimatedChevronDown
            size={16}
            className={`text-[var(--color-mute)] shrink-0 transition-transform duration-200 ${
              isOpen ? "rotate-180 text-sky-500" : ""
            }`}
          />
        </span>
      </button>

      {error && (
        <p className="text-xs font-semibold text-rose-600 dark:text-rose-400 mt-1 flex items-center gap-1">
          {error}
        </p>
      )}

      {/* Popover Menu */}
      {isOpen && (
        <div className="absolute z-50 top-full left-0 right-0 mt-1.5 rounded-xl border border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)] shadow-2xl overflow-hidden max-h-72 flex flex-col backdrop-blur-md animate-in fade-in slide-in-from-top-2 duration-150">
          {/* Search Header */}
          <div className="p-2 border-b border-[var(--color-hairline)] flex items-center gap-2 bg-[var(--color-canvas)]">
            <Search className="h-3.5 w-3.5 text-[var(--color-mute)] shrink-0 ml-1" />
            <input
              ref={searchInputRef}
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by Client Name, Code, City, Location..."
              className="w-full bg-transparent text-xs text-[var(--color-ink)] focus:outline-none placeholder:text-[var(--color-mute)] py-1"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="text-[var(--color-mute)] hover:text-[var(--color-ink)] p-1 cursor-pointer"
              >
                <AnimatedX size={12} />
              </button>
            )}
          </div>

          {/* Listbox */}
          <div className="overflow-y-auto p-1.5 space-y-1 custom-scrollbar">
            {allowAll && !searchQuery.trim() && (
              <button
                type="button"
                onClick={() => handleSelect("all")}
                className={`w-full flex items-center justify-between p-2.5 rounded-lg text-xs text-left transition-colors cursor-pointer ${
                  isAllSelected
                    ? "bg-sky-500/10 text-sky-600 dark:text-sky-400 font-semibold"
                    : "hover:bg-[var(--color-canvas)] text-[var(--color-ink)]"
                }`}
              >
                <div className="flex items-center gap-2">
                  <span className="font-bold">{allLabel}</span>
                  <span className="text-[10px] text-[var(--color-mute)] font-mono">
                    ({clients.length} clients)
                  </span>
                </div>
                {isAllSelected && (
                  <AnimatedCheck size={14} className="text-sky-600 dark:text-sky-400 shrink-0" />
                )}
              </button>
            )}

            {filteredClients.length === 0 ? (
              <div className="py-4 text-center text-xs text-[var(--color-mute)]">
                No matching clients found
              </div>
            ) : (
              filteredClients.map((c) => {
                const isSelected = c.id === value;
                const cName = c.company_name || c.client_name || c.name || "Client";
                const cLoc = getFormattedClientLocation(c);
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => handleSelect(c.id)}
                    className={`w-full flex items-center justify-between p-2.5 rounded-lg text-xs text-left transition-colors cursor-pointer ${
                      isSelected
                        ? "bg-sky-500/10 text-sky-600 dark:text-sky-400 font-semibold"
                        : "hover:bg-[var(--color-canvas)] text-[var(--color-ink)]"
                    }`}
                  >
                    <div className="min-w-0 pr-2 flex-1">
                      <div className="font-bold flex items-center gap-2 truncate">
                        <span className="truncate">{cName}</span>
                        {c.code && (
                          <span className="font-mono text-[10px] text-sky-600 dark:text-sky-400 bg-sky-500/10 px-1.5 py-0.5 rounded shrink-0">
                            {c.code}
                          </span>
                        )}
                      </div>
                      {cLoc && (
                        <div className="text-[10px] text-[var(--color-mute)] font-normal truncate mt-0.5">
                          📍 {cLoc}
                        </div>
                      )}
                    </div>
                    {isSelected && (
                      <AnimatedCheck size={14} className="text-sky-600 dark:text-sky-400 shrink-0" />
                    )}
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
