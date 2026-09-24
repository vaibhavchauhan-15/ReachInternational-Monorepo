"use client";

import { useMemo } from "react";
import { Input, SearchableSelect, type SelectOption } from "@/components/ui";
import { AnimatedMapPin } from "@/components/ui/animated-icons";
import { INDIAN_STATES, getStateById, getStateByName } from "@reachinternational/utils";

const stateSelectOptions: SelectOption[] = INDIAN_STATES.map((s) => ({
  value: String(s.id),
  label: s.name,
}));

export interface UserAddressSectionProps {
  street: string;
  city: string;
  district: string;
  state: string;
  stateId?: string | number | null;
  onChange: (field: "street" | "city" | "district" | "state" | "state_id", value: string) => void;
  errors?: {
    street?: string;
    city?: string;
    district?: string;
    state?: string;
  };
  required?: boolean;
  disabled?: boolean;
  className?: string;
  idPrefix?: string;
}

/**
 * Reusable Address Section Component
 * Guarantees unified consistency monorepo-wide:
 * address = street + city/town/village + district + state
 */
export function UserAddressSection({
  street,
  city,
  district,
  state,
  stateId,
  onChange,
  errors = {},
  required = true,
  disabled = false,
  className = "",
  idPrefix = "addr",
}: UserAddressSectionProps) {
  // Resolve active state option value
  const activeStateId = useMemo(() => {
    if (stateId && String(stateId).trim()) return String(stateId);
    if (state && state.trim()) {
      const matched = getStateByName(state.trim());
      if (matched) return String(matched.id);
    }
    return "";
  }, [stateId, state]);

  return (
    <div className={`space-y-2.5 sm:space-y-3 ${className}`}>
      {/* 1. Street Address */}
      <div>
        <Input
          id={`${idPrefix}-street`}
          name="street"
          label="Street / Building / Locality Address"
          type="text"
          value={street}
          onChange={(e) => onChange("street", e.target.value)}
          placeholder="e.g. Plot No. 42, MIDC Industrial Area, Chakan"
          required={required}
          disabled={disabled}
          error={errors.street}
          icon={<AnimatedMapPin size={15} />}
        />
        {/* Hidden address mirror for backward-compatible server actions & DB triggers */}
        <input type="hidden" name="address" value={street} />
      </div>

      {/* 2. City/Town/Village | 3. District | 4. State (3-Column Responsive Grid) */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 sm:gap-3">
        {/* City / Town / Village */}
        <Input
          id={`${idPrefix}-city`}
          name="city"
          label="City / Town / Village"
          type="text"
          value={city}
          onChange={(e) => onChange("city", e.target.value)}
          placeholder="e.g. Pune"
          required={required}
          disabled={disabled}
          autoComplete="address-level2"
          error={errors.city}
          icon={<AnimatedMapPin size={15} />}
        />

        {/* District */}
        <Input
          id={`${idPrefix}-district`}
          name="district"
          label="District"
          type="text"
          value={district}
          onChange={(e) => onChange("district", e.target.value)}
          placeholder="e.g. Pune"
          required={required}
          disabled={disabled}
          autoComplete="address-level2"
          error={errors.district}
          icon={<AnimatedMapPin size={15} />}
        />

        {/* State Selector */}
        <div className="flex flex-col gap-1 w-full" id={`${idPrefix}-state-container`}>
          <label className="text-[12px] sm:text-[13px] font-medium text-[var(--color-ink)] select-none flex items-center gap-1">
            <span>State</span>
            {required && <span className="text-rose-500 font-semibold">*</span>}
          </label>
          <input type="hidden" name="state" value={state} />
          <input type="hidden" name="state_id" value={activeStateId} />
          <SearchableSelect
            options={stateSelectOptions}
            value={activeStateId}
            onChange={(val, opt) => {
              onChange("state_id", val);
              onChange("state", opt?.label || "");
            }}
            placeholder="Select state..."
            clearable={!required}
            disabled={disabled}
            error={errors.state}
            className="w-full text-xs sm:text-[13px]"
          />
        </div>
      </div>
    </div>
  );
}
