"use client";

import React from "react";
import type { SlimEquipment } from "@/lib/queries/rfq";
import type { EquipmentCategory } from "@reachinternational/types";
import { Trash2, Plus, Wrench, Calendar, Hash, ArrowUpDown } from "lucide-react";

export interface RfqFormItem {
  id: string; // client local key
  requirement_type: "rental" | "purchase";
  equipment_id?: string | null;
  category_id?: string | null;
  brand_id?: string | null;
  custom_description?: string | null;
  quantity: number;
  min_height_m?: number | null;
  min_capacity_kg?: number | null;
  duration_value?: number | null;
  duration_unit?: "day" | "week" | "month" | null;
  notes?: string | null;
}

interface ItemCardProps {
  index: number;
  item: RfqFormItem;
  equipmentList: SlimEquipment[];
  categories: { id: string; name: string }[];
  canRemove: boolean;
  onChange: (updated: RfqFormItem) => void;
  onRemove: () => void;
}

export function ItemCard({
  index,
  item,
  equipmentList,
  categories,
  canRemove,
  onChange,
  onRemove,
}: ItemCardProps) {
  const isRental = item.requirement_type === "rental";

  const handleModelChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    if (val === "custom") {
      onChange({
        ...item,
        equipment_id: null,
        category_id: null,
        custom_description: item.custom_description || "",
      });
    } else if (val.startsWith("cat:")) {
      const catId = val.replace("cat:", "");
      onChange({
        ...item,
        equipment_id: null,
        category_id: catId,
        custom_description: null,
      });
    } else if (val) {
      const eq = equipmentList.find((m) => m.id === val);
      onChange({
        ...item,
        equipment_id: val,
        category_id: null,
        brand_id: eq?.brand_id || null,
        custom_description: null,
      });
    } else {
      onChange({
        ...item,
        equipment_id: null,
        category_id: null,
        custom_description: null,
      });
    }
  };

  const selectedSelectValue = item.equipment_id
    ? item.equipment_id
    : item.category_id
    ? `cat:${item.category_id}`
    : item.custom_description
    ? "custom"
    : "";

  return (
    <div className="relative rounded-xl border border-neutral-200 bg-white p-5 shadow-xs transition-all dark:border-neutral-800 dark:bg-neutral-900/60">
      {/* Top Header Row */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-neutral-100 pb-4 dark:border-neutral-800/80">
        <div className="flex items-center gap-2.5">
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-neutral-900 text-xs font-semibold text-white dark:bg-neutral-100 dark:text-neutral-950">
            {index + 1}
          </span>
          <h4 className="text-sm font-semibold tracking-tight text-neutral-900 dark:text-neutral-100">
            Machine Requirement #{index + 1}
          </h4>
        </div>

        <div className="flex items-center gap-3">
          {/* Segmented Toggle: Rental vs Purchase */}
          <div className="inline-flex rounded-lg border border-neutral-200 bg-neutral-100 p-0.5 text-xs font-medium dark:border-neutral-800 dark:bg-neutral-800/80">
            <button
              type="button"
              onClick={() => onChange({ ...item, requirement_type: "rental" })}
              className={`rounded-md px-3 py-1 transition-all ${
                isRental
                  ? "bg-white text-neutral-950 shadow-xs font-semibold dark:bg-neutral-900 dark:text-white"
                  : "text-neutral-600 hover:text-neutral-950 dark:text-neutral-400 dark:hover:text-white"
              }`}
            >
              Rental Fleet
            </button>
            <button
              type="button"
              onClick={() => onChange({ ...item, requirement_type: "purchase" })}
              className={`rounded-md px-3 py-1 transition-all ${
                !isRental
                  ? "bg-white text-neutral-950 shadow-xs font-semibold dark:bg-neutral-900 dark:text-white"
                  : "text-neutral-600 hover:text-neutral-950 dark:text-neutral-400 dark:hover:text-white"
              }`}
            >
              Purchase / Sale
            </button>
          </div>

          {canRemove && (
            <button
              type="button"
              onClick={onRemove}
              className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-neutral-400 hover:bg-red-50 hover:text-red-600 dark:text-neutral-500 dark:hover:bg-red-950/30 dark:hover:text-red-400 transition-colors"
              title="Remove machine"
              aria-label="Remove machine"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      {/* Inputs Grid */}
      <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* Model or Category Selector */}
        <div className="sm:col-span-2">
          <label className="mb-1.5 block text-xs font-medium text-neutral-700 dark:text-neutral-300">
            Machine or Equipment Type <span className="text-red-500">*</span>
          </label>
          <select
            value={selectedSelectValue}
            onChange={handleModelChange}
            className="w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 text-xs text-neutral-900 shadow-xs focus:border-sky-500 focus:outline-hidden focus:ring-2 focus:ring-sky-500/20 dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-100"
          >
            <option value="">-- Choose Catalogue Model or Category --</option>
            {equipmentList.length > 0 && (
              <optgroup label="Popular Catalogue Models">
                {equipmentList.map((eq) => (
                  <option key={eq.id} value={eq.id}>
                    {eq.name} ({eq.model_number || eq.category_name})
                  </option>
                ))}
              </optgroup>
            )}
            {categories.length > 0 && (
              <optgroup label="Or Select General Category">
                {categories.map((cat) => (
                  <option key={cat.id} value={`cat:${cat.id}`}>
                    Any {cat.name}
                  </option>
                ))}
              </optgroup>
            )}
            <optgroup label="Other">
              <option value="custom">Other / Custom Requirement (describe below)</option>
            </optgroup>
          </select>
        </div>

        {/* Quantity */}
        <div>
          <label className="mb-1.5 block text-xs font-medium text-neutral-700 dark:text-neutral-300">
            Quantity (Units) <span className="text-red-500">*</span>
          </label>
          <div className="relative">
            <input
              type="number"
              min={1}
              max={99}
              value={item.quantity || 1}
              onChange={(e) =>
                onChange({
                  ...item,
                  quantity: Math.max(1, parseInt(e.target.value, 10) || 1),
                })
              }
              className="w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 text-xs text-neutral-900 shadow-xs focus:border-sky-500 focus:outline-hidden focus:ring-2 focus:ring-sky-500/20 dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-100"
            />
          </div>
        </div>

        {/* Rental Duration (if rental) */}
        {isRental ? (
          <div>
            <label className="mb-1.5 block text-xs font-medium text-neutral-700 dark:text-neutral-300">
              Expected Duration
            </label>
            <div className="flex gap-2">
              <input
                type="number"
                min={1}
                placeholder="e.g. 1"
                value={item.duration_value ?? ""}
                onChange={(e) =>
                  onChange({
                    ...item,
                    duration_value: e.target.value ? parseInt(e.target.value, 10) : null,
                  })
                }
                className="w-16 rounded-lg border border-neutral-200 bg-white px-2 py-2 text-xs text-neutral-900 shadow-xs focus:border-sky-500 focus:outline-hidden focus:ring-2 focus:ring-sky-500/20 dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-100"
              />
              <select
                value={item.duration_unit || "month"}
                onChange={(e) =>
                  onChange({
                    ...item,
                    duration_unit: e.target.value as "day" | "week" | "month",
                  })
                }
                className="flex-1 rounded-lg border border-neutral-200 bg-white px-2 py-2 text-xs text-neutral-900 shadow-xs focus:border-sky-500 focus:outline-hidden focus:ring-2 focus:ring-sky-500/20 dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-100"
              >
                <option value="day">Day(s)</option>
                <option value="week">Week(s)</option>
                <option value="month">Month(s)</option>
              </select>
            </div>
          </div>
        ) : (
          <div>
            <label className="mb-1.5 block text-xs font-medium text-neutral-700 dark:text-neutral-300">
              Procurement Type
            </label>
            <input
              type="text"
              readOnly
              value="Outright Purchase"
              className="w-full rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2 text-xs text-neutral-500 shadow-xs dark:border-neutral-800 dark:bg-neutral-900/40 dark:text-neutral-400 cursor-not-allowed"
            />
          </div>
        )}
      </div>

      {/* Custom Description (if "custom" is selected or no specific model) */}
      {(selectedSelectValue === "custom" || (!item.equipment_id && !item.category_id)) && (
        <div className="mt-3">
          <label className="mb-1.5 block text-xs font-medium text-neutral-700 dark:text-neutral-300">
            Specific Machine Specifications / Requirements <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            required
            placeholder="e.g. 14m Electric Articulated Boom Lift or 3-Ton Diesel Forklift"
            value={item.custom_description || ""}
            onChange={(e) => onChange({ ...item, custom_description: e.target.value })}
            className="w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 text-xs text-neutral-900 shadow-xs focus:border-sky-500 focus:outline-hidden focus:ring-2 focus:ring-sky-500/20 dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-100"
          />
        </div>
      )}

      {/* Technical Spec Preferences (Optional) */}
      <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div>
          <label className="mb-1 block text-[11px] text-neutral-500 dark:text-neutral-400">
            Min Working Height (m, optional)
          </label>
          <input
            type="number"
            step="0.5"
            placeholder="e.g. 14.5"
            value={item.min_height_m ?? ""}
            onChange={(e) =>
              onChange({
                ...item,
                min_height_m: e.target.value ? parseFloat(e.target.value) : null,
              })
            }
            className="w-full rounded-md border border-neutral-200 bg-white px-2.5 py-1.5 text-xs text-neutral-900 shadow-xs focus:border-sky-500 focus:outline-hidden dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-100"
          />
        </div>
        <div>
          <label className="mb-1 block text-[11px] text-neutral-500 dark:text-neutral-400">
            Min Load Capacity (kg, optional)
          </label>
          <input
            type="number"
            step="50"
            placeholder="e.g. 230"
            value={item.min_capacity_kg ?? ""}
            onChange={(e) =>
              onChange({
                ...item,
                min_capacity_kg: e.target.value ? parseInt(e.target.value, 10) : null,
              })
            }
            className="w-full rounded-md border border-neutral-200 bg-white px-2.5 py-1.5 text-xs text-neutral-900 shadow-xs focus:border-sky-500 focus:outline-hidden dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-100"
          />
        </div>
        <div>
          <label className="mb-1 block text-[11px] text-neutral-500 dark:text-neutral-400">
            Operator Requirement / Special Notes
          </label>
          <input
            type="text"
            placeholder="e.g. Certified operator required"
            value={item.notes ?? ""}
            onChange={(e) => onChange({ ...item, notes: e.target.value })}
            className="w-full rounded-md border border-neutral-200 bg-white px-2.5 py-1.5 text-xs text-neutral-900 shadow-xs focus:border-sky-500 focus:outline-hidden dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-100"
          />
        </div>
      </div>
    </div>
  );
}
