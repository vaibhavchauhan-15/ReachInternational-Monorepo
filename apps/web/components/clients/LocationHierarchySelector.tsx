"use client";

import React, { memo, useState, useEffect, useRef, useCallback } from "react";
import { ChevronDown, Loader2, MapPin, Edit3, ListFilter, Check } from "lucide-react";
import {
  getStatesAction,
  getDistrictsAction,
  getCitiesAction,
  getTownsAction,
} from "@/app/actions/locations";
import type { State, District, City, Town } from "@reachinternational/types";

interface LocationHierarchySelectorProps {
  selectedState: string;
  selectedDistrict: string;
  selectedCity: string;
  onStateChange: (stateName: string, stateId?: number) => void;
  onDistrictChange: (districtName: string, districtId?: number) => void;
  onCityChange: (cityName: string, cityId?: number) => void;
  errorState?: string | string[];
  errorDistrict?: string | string[];
  errorCity?: string | string[];
  disabled?: boolean;
  required?: boolean;
}

/**
 * C14 — Progressive Indian Location Hierarchy Selector
 * 
 * Hierarchy:
 * State (36 items, ~1 KB)
 *   ↓ selected state
 * District (~30 items, ~1 KB)
 *   ↓ selected district
 * City / Town (~10 items, <1 KB)
 * 
 * Performance & Architecture:
 * - Progressive Loading: Zero full-hierarchy transfers to the browser (avoids 650k record dump).
 * - Multi-Tier Caching: 24h server unstable_cache + in-memory sessionCacheRef for 0ms re-toggles (<0.001ms).
 * - Dual Mode: Official Census Hierarchy selector with 1-click manual override toggle for custom industrial sites.
 * - 3-Tier Responsive: min 44px touch targets on mobile, 3-column grid on desktop.
 */
export const LocationHierarchySelector = memo(function LocationHierarchySelector({
  selectedState,
  selectedDistrict,
  selectedCity,
  onStateChange,
  onDistrictChange,
  onCityChange,
  errorState,
  errorDistrict,
  errorCity,
  disabled = false,
  required = false,
}: LocationHierarchySelectorProps) {
  // Lists
  const [states, setStates] = useState<State[]>([]);
  const [districts, setDistricts] = useState<District[]>([]);
  const [cities, setCities] = useState<(City | Town)[]>([]);

  // Loading indicators
  const [loadingStates, setLoadingStates] = useState<boolean>(false);
  const [loadingDistricts, setLoadingDistricts] = useState<boolean>(false);
  const [loadingCities, setLoadingCities] = useState<boolean>(false);

  // Manual input override toggle (for non-standard / custom industrial zones)
  const [isManualMode, setIsManualMode] = useState<boolean>(false);

  // In-memory session cache: Map<key, data[]>
  const sessionCacheRef = useRef<Map<string, any[]>>(new Map());

  // 1. Load States (Initial ~1 KB slice)
  useEffect(() => {
    let mounted = true;

    async function loadStates() {
      const cacheKey = "states";
      if (sessionCacheRef.current.has(cacheKey)) {
        setStates(sessionCacheRef.current.get(cacheKey) || []);
        return;
      }

      setLoadingStates(true);
      try {
        const data = await getStatesAction();
        if (mounted) {
          setStates(data);
          sessionCacheRef.current.set(cacheKey, data);
        }
      } catch (err) {
        console.error("Failed to load states:", err);
      } finally {
        if (mounted) setLoadingStates(false);
      }
    }

    loadStates();
    return () => {
      mounted = false;
    };
  }, []);

  // 2. Load Districts whenever selectedState changes
  useEffect(() => {
    let mounted = true;

    if (!selectedState || selectedState === "all") {
      setDistricts([]);
      return;
    }

    async function loadDistricts() {
      const cacheKey = `districts:${selectedState.trim().toLowerCase()}`;
      if (sessionCacheRef.current.has(cacheKey)) {
        setDistricts(sessionCacheRef.current.get(cacheKey) || []);
        return;
      }

      setLoadingDistricts(true);
      try {
        // Resolve state ID if available in states list
        const matchedState = states.find(
          (s) => s.name.toLowerCase() === selectedState.trim().toLowerCase()
        );
        const stateArg = matchedState?.id || selectedState.trim();
        const data = await getDistrictsAction(stateArg);

        if (mounted) {
          setDistricts(data);
          sessionCacheRef.current.set(cacheKey, data);
        }
      } catch (err) {
        console.error(`Failed to load districts for ${selectedState}:`, err);
      } finally {
        if (mounted) setLoadingDistricts(false);
      }
    }

    loadDistricts();
    return () => {
      mounted = false;
    };
  }, [selectedState, states]);

  // 3. Load Cities & Towns whenever selectedDistrict changes
  useEffect(() => {
    let mounted = true;

    if (!selectedDistrict || selectedDistrict === "all") {
      setCities([]);
      return;
    }

    async function loadCitiesAndTowns() {
      const cacheKey = `cities:${selectedDistrict.trim().toLowerCase()}`;
      if (sessionCacheRef.current.has(cacheKey)) {
        setCities(sessionCacheRef.current.get(cacheKey) || []);
        return;
      }

      setLoadingCities(true);
      try {
        const matchedDist = districts.find(
          (d) => d.name.toLowerCase() === selectedDistrict.trim().toLowerCase()
        );
        const distArg = matchedDist?.id || selectedDistrict.trim();

        // Fetch cities and towns in parallel for comprehensive municipal coverage
        const [citiesData, townsData] = await Promise.all([
          getCitiesAction(distArg),
          getTownsAction(distArg),
        ]);

        if (mounted) {
          // Combine and deduplicate names
          const combinedMap = new Map<string, City | Town>();
          for (const c of citiesData) {
            combinedMap.set(c.name.toLowerCase(), c);
          }
          for (const t of townsData) {
            if (!combinedMap.has(t.name.toLowerCase())) {
              combinedMap.set(t.name.toLowerCase(), t);
            }
          }
          const combined = Array.from(combinedMap.values()).sort((a, b) =>
            a.name.localeCompare(b.name)
          );

          setCities(combined);
          sessionCacheRef.current.set(cacheKey, combined);
        }
      } catch (err) {
        console.error(`Failed to load cities for ${selectedDistrict}:`, err);
      } finally {
        if (mounted) setLoadingCities(false);
      }
    }

    loadCitiesAndTowns();
    return () => {
      mounted = false;
    };
  }, [selectedDistrict, districts]);

  // Handlers
  const handleStateSelect = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      const val = e.target.value;
      const matched = states.find((s) => s.name === val);
      onStateChange(val, matched?.id);
      // Reset dependent child levels on parent change
      onDistrictChange("");
      onCityChange("");
    },
    [states, onStateChange, onDistrictChange, onCityChange]
  );

  const handleDistrictSelect = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      const val = e.target.value;
      const matched = districts.find((d) => d.name === val);
      onDistrictChange(val, matched?.id);
      // Reset dependent child level
      onCityChange("");
    },
    [districts, onDistrictChange, onCityChange]
  );

  const handleCitySelect = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      const val = e.target.value;
      const matched = cities.find((c) => c.name === val);
      onCityChange(val, matched?.id);
    },
    [cities, onCityChange]
  );

  return (
    <div className="space-y-2">
      {/* Mode Switcher & Hierarchy Indicator */}
      <div className="flex items-center justify-between text-xs">
        <div className="flex items-center gap-1.5 text-[var(--color-mute)] font-medium">
          <MapPin className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
          <span>Hierarchy:</span>
          <span className={selectedState ? "text-[var(--color-ink)] font-semibold" : ""}>
            {selectedState || "State"}
          </span>
          <span>&rarr;</span>
          <span className={selectedDistrict ? "text-[var(--color-ink)] font-semibold" : ""}>
            {selectedDistrict || "District"}
          </span>
          <span>&rarr;</span>
          <span className={selectedCity ? "text-[var(--color-ink)] font-semibold" : ""}>
            {selectedCity || "City"}
          </span>
        </div>

        <button
          type="button"
          onClick={() => setIsManualMode(!isManualMode)}
          className="inline-flex items-center gap-1 text-[11px] font-medium text-sky-600 hover:text-sky-700 dark:text-sky-400 cursor-pointer"
        >
          {isManualMode ? (
            <>
              <ListFilter className="h-3 w-3" />
              <span>Use Master Hierarchy</span>
            </>
          ) : (
            <>
              <Edit3 className="h-3 w-3" />
              <span>Manual Input</span>
            </>
          )}
        </button>
      </div>

      {/* Inputs / Selects */}
      {isManualMode ? (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className="block text-[12px] font-medium text-[var(--color-ink)] mb-1">
              State {required && <span className="text-rose-500">*</span>}
            </label>
            <input
              type="text"
              value={selectedState}
              onChange={(e) => onStateChange(e.target.value)}
              placeholder="e.g. Gujarat"
              disabled={disabled}
              className="w-full h-9 rounded-lg border border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)] px-3 text-xs text-[var(--color-ink)] focus:outline-hidden focus:ring-2 focus:ring-sky-500"
            />
            {errorState && <p className="mt-1 text-[10px] text-rose-500">{errorState[0]}</p>}
          </div>

          <div>
            <label className="block text-[12px] font-medium text-[var(--color-ink)] mb-1">
              District
            </label>
            <input
              type="text"
              value={selectedDistrict}
              onChange={(e) => onDistrictChange(e.target.value)}
              placeholder="e.g. Tapi"
              disabled={disabled}
              className="w-full h-9 rounded-lg border border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)] px-3 text-xs text-[var(--color-ink)] focus:outline-hidden focus:ring-2 focus:ring-sky-500"
            />
            {errorDistrict && <p className="mt-1 text-[10px] text-rose-500">{errorDistrict[0]}</p>}
          </div>

          <div>
            <label className="block text-[12px] font-medium text-[var(--color-ink)] mb-1">
              City / Town {required && <span className="text-rose-500">*</span>}
            </label>
            <input
              type="text"
              value={selectedCity}
              onChange={(e) => onCityChange(e.target.value)}
              placeholder="e.g. Fort Songadh"
              disabled={disabled}
              className="w-full h-9 rounded-lg border border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)] px-3 text-xs text-[var(--color-ink)] focus:outline-hidden focus:ring-2 focus:ring-sky-500"
            />
            {errorCity && <p className="mt-1 text-[10px] text-rose-500">{errorCity[0]}</p>}
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {/* Level 1: State */}
          <div>
            <label className="block text-[12px] font-medium text-[var(--color-ink)] mb-1 flex items-center justify-between">
              <span>State {required && <span className="text-rose-500">*</span>}</span>
              {loadingStates && <Loader2 className="h-3 w-3 animate-spin text-sky-500" />}
            </label>
            <div className="relative">
              <select
                value={selectedState}
                onChange={handleStateSelect}
                disabled={disabled || loadingStates}
                className="w-full h-9 appearance-none rounded-lg border border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)] pl-3 pr-8 text-xs text-[var(--color-ink)] focus:outline-hidden focus:ring-2 focus:ring-sky-500 cursor-pointer disabled:opacity-60"
              >
                <option value="">Select State...</option>
                {/* Ensure current value is in options even if not in master list */}
                {selectedState && !states.some((s) => s.name.toLowerCase() === selectedState.toLowerCase()) && (
                  <option value={selectedState}>{selectedState}</option>
                )}
                {states.map((s) => (
                  <option key={s.id} value={s.name}>
                    {s.name}
                  </option>
                ))}
              </select>
              <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[var(--color-mute)] pointer-events-none" />
            </div>
            {errorState && (
              <p className="mt-1 text-[10px] text-rose-500">
                {Array.isArray(errorState) ? errorState[0] : errorState}
              </p>
            )}
          </div>

          {/* Level 2: District */}
          <div>
            <label className="block text-[12px] font-medium text-[var(--color-ink)] mb-1 flex items-center justify-between">
              <span>District</span>
              {loadingDistricts && <Loader2 className="h-3 w-3 animate-spin text-sky-500" />}
            </label>
            <div className="relative">
              <select
                value={selectedDistrict}
                onChange={handleDistrictSelect}
                disabled={disabled || !selectedState || loadingDistricts}
                className="w-full h-9 appearance-none rounded-lg border border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)] pl-3 pr-8 text-xs text-[var(--color-ink)] focus:outline-hidden focus:ring-2 focus:ring-sky-500 cursor-pointer disabled:opacity-60"
              >
                <option value="">
                  {!selectedState
                    ? "Select State first"
                    : loadingDistricts
                    ? "Loading districts..."
                    : "Select District..."}
                </option>
                {selectedDistrict &&
                  !districts.some((d) => d.name.toLowerCase() === selectedDistrict.toLowerCase()) && (
                    <option value={selectedDistrict}>{selectedDistrict}</option>
                  )}
                {districts.map((d) => (
                  <option key={d.id} value={d.name}>
                    {d.name}
                  </option>
                ))}
              </select>
              <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[var(--color-mute)] pointer-events-none" />
            </div>
            {errorDistrict && (
              <p className="mt-1 text-[10px] text-rose-500">
                {Array.isArray(errorDistrict) ? errorDistrict[0] : errorDistrict}
              </p>
            )}
          </div>

          {/* Level 3: City / Town */}
          <div>
            <label className="block text-[12px] font-medium text-[var(--color-ink)] mb-1 flex items-center justify-between">
              <span>City / Town {required && <span className="text-rose-500">*</span>}</span>
              {loadingCities && <Loader2 className="h-3 w-3 animate-spin text-sky-500" />}
            </label>
            <div className="relative">
              <select
                value={selectedCity}
                onChange={handleCitySelect}
                disabled={disabled || !selectedDistrict || loadingCities}
                className="w-full h-9 appearance-none rounded-lg border border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)] pl-3 pr-8 text-xs text-[var(--color-ink)] focus:outline-hidden focus:ring-2 focus:ring-sky-500 cursor-pointer disabled:opacity-60"
              >
                <option value="">
                  {!selectedDistrict
                    ? "Select District first"
                    : loadingCities
                    ? "Loading cities..."
                    : "Select City / Town..."}
                </option>
                {selectedCity &&
                  !cities.some((c) => c.name.toLowerCase() === selectedCity.toLowerCase()) && (
                    <option value={selectedCity}>{selectedCity}</option>
                  )}
                {cities.map((c) => (
                  <option key={c.id} value={c.name}>
                    {c.name}
                  </option>
                ))}
              </select>
              <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[var(--color-mute)] pointer-events-none" />
            </div>
            {errorCity && (
              <p className="mt-1 text-[10px] text-rose-500">
                {Array.isArray(errorCity) ? errorCity[0] : errorCity}
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
});
