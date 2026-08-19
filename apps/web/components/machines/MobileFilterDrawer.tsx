"use client";

import { AnimatedX, AnimatedSlidersHorizontal, AnimatedRotateCcw, AnimatedCheck } from "@/components/ui/animated-icons";
import { Button, SearchableSelect, Dialog, DialogContent } from "@/components/ui";

interface MobileFilterDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  statusOptions: { value: string; label: string }[];
  cityOptions: { value: string; label: string }[];
  engineerOptions: { value: string; label: string }[];
  currentStatus: string;
  currentCity: string;
  currentEngineerId: string;
  isAdmin: boolean;
  onApplyFilters: (filters: { status?: string; city?: string; engineer_id?: string }) => void;
  onResetFilters: () => void;
  activeFilterCount: number;
}

export function MobileFilterDrawer({
  isOpen,
  onClose,
  statusOptions,
  cityOptions,
  engineerOptions,
  currentStatus,
  currentCity,
  currentEngineerId,
  isAdmin,
  onApplyFilters,
  onResetFilters,
  activeFilterCount,
}: MobileFilterDrawerProps) {
  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent
        from="bottom"
        showCloseButton={false}
        className="max-w-full rounded-t-[28px] rounded-b-none border-t border-[var(--color-hairline)] p-6 space-y-5 pb-safe max-h-[85vh] overflow-y-auto mt-auto"
      >
        {/* Handle Drag Indicator */}
        <div className="w-12 h-1.5 bg-[var(--color-hairline)] rounded-full mx-auto -mt-2 mb-2 opacity-60" />

        {/* Sheet Title */}
        <div className="flex items-center justify-between border-b border-[var(--color-hairline)] pb-4">
          <div className="flex items-center gap-2">
            <AnimatedSlidersHorizontal size={20} className="text-[var(--color-ink)]" />
            <h3 className="text-base font-bold text-[var(--color-ink)]">
              Filter Machines
            </h3>
            {activeFilterCount > 0 && (
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[var(--color-ink)] text-white text-[10px] font-bold">
                {activeFilterCount}
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            {activeFilterCount > 0 && (
              <button
                onClick={onResetFilters}
                className="flex items-center gap-1 text-xs text-[var(--color-mute)] hover:text-[var(--color-ink)] transition-colors px-2 py-1 rounded"
              >
                <AnimatedRotateCcw size={14} />
                Reset
              </button>
            )}
            <button
              onClick={onClose}
              className="p-1.5 rounded-full hover:bg-[var(--color-hairline-soft-surface)] text-[var(--color-mute)] hover:text-[var(--color-ink)] transition-colors"
            >
              <AnimatedX size={20} />
            </button>
          </div>
        </div>

        {/* Filter Fields */}
        <div className="space-y-4 pt-2">
          <div>
            <label className="block text-xs font-semibold text-[var(--color-ink)] uppercase tracking-wider mb-1.5">
              Machine Status
            </label>
            <div className="grid grid-cols-3 gap-2">
              {statusOptions.map((opt) => {
                const isSelected = currentStatus === opt.value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => onApplyFilters({ status: opt.value })}
                    className={`flex items-center justify-center gap-1 py-2 px-3 rounded-[var(--radius-md)] text-xs font-medium border transition-all ${
                      isSelected
                        ? "bg-[var(--color-ink)] text-white border-[var(--color-ink)] shadow-xs"
                        : "bg-[var(--color-canvas)] text-[var(--color-body)] border-[var(--color-hairline)] hover:border-[var(--color-ink)]"
                    }`}
                  >
                    {isSelected && <AnimatedCheck size={14} />}
                    {opt.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-[var(--color-ink)] uppercase tracking-wider mb-1.5">
              City Location
            </label>
            <SearchableSelect
              options={cityOptions}
              value={currentCity}
              onChange={(val) => onApplyFilters({ city: val })}
              placeholder="Select City"
            />
          </div>

          {isAdmin && (
            <div>
              <label className="block text-xs font-semibold text-[var(--color-ink)] uppercase tracking-wider mb-1.5">
                Assigned Service Engineer
              </label>
              <SearchableSelect
                options={engineerOptions}
                value={currentEngineerId}
                onChange={(val) => onApplyFilters({ engineer_id: val })}
                placeholder="Select Engineer"
              />
            </div>
          )}
        </div>

        {/* Apply Action */}
        <div className="pt-4 border-t border-[var(--color-hairline)]">
          <Button
            variant="primary"
            className="w-full justify-center py-3 text-sm font-bold shadow-md"
            onClick={onClose}
          >
            Done
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
