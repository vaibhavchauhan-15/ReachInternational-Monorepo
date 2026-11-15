export interface MachineCategory {
  name: string;
  code: string;
  id?: number;
}

export const MACHINE_CATEGORIES: readonly MachineCategory[] = [
  { name: "Stacker", code: "stacker", id: 1 },
  { name: "Reach Truck", code: "reach_truck", id: 3 },
  { name: "Order Picker", code: "order_picker", id: 4 },
  { name: "Electric Pallet Truck", code: "electric_pallet_truck", id: 7 },
  { name: "Forklift", code: "forklift", id: 14 },
  { name: "Scissor Lift", code: "scissor_lift", id: 15 },
  { name: "Boom Lift", code: "boom_lift", id: 16 },
] as const;

export const MACHINE_CATEGORY_NAMES = MACHINE_CATEGORIES.map((c) => c.name);

export const MACHINE_CATEGORY_SELECT_OPTIONS = MACHINE_CATEGORIES.map((c) => ({
  value: c.name,
  label: c.name,
}));

export function getMachineCategoryById(id: number | string | null | undefined): MachineCategory | undefined {
  if (id === null || id === undefined) return undefined;
  const numId = Number(id);
  if (isNaN(numId)) return undefined;
  return MACHINE_CATEGORIES.find((c) => c.id === numId);
}

export function getMachineCategoryByName(name: string | null | undefined): MachineCategory | undefined {
  if (!name || typeof name !== "string") return undefined;
  const lower = name.trim().toLowerCase();
  return MACHINE_CATEGORIES.find(
    (c) => c.name.toLowerCase() === lower || c.code === lower
  );
}

export function isValidMachineCategory(category: string | null | undefined): boolean {
  if (!category || typeof category !== "string") return false;
  return Boolean(getMachineCategoryByName(category) || getMachineCategoryById(category));
}

export function normalizeMachineCategory(val: string | number | null | undefined): string | null {
  if (val === null || val === undefined) return null;
  const str = String(val).trim();
  if (!str) return null;

  // Check if string matches legacy "1. Stacker" or "3. Reach Truck" format
  const numberedMatch = str.match(/^(\d+)\.\s*(.+)$/);
  if (numberedMatch) {
    const byName = getMachineCategoryByName(numberedMatch[2]);
    if (byName) return byName.name;
    const byId = getMachineCategoryById(numberedMatch[1]);
    if (byId) return byId.name;
  }

  const byName = getMachineCategoryByName(str);
  if (byName) return byName.name;

  const byId = getMachineCategoryById(str);
  if (byId) return byId.name;

  return null;
}

export function formatMachineCategoryLabel(nameOrId: string | number | null | undefined): string {
  if (nameOrId === null || nameOrId === undefined) return "—";
  const str = String(nameOrId).trim();
  if (!str) return "—";

  // Check if string has a legacy number prefix like "3. Reach Truck"
  const match = str.match(/^\d+\.\s*(.+)$/);
  if (match) {
    const cat = getMachineCategoryByName(match[1]);
    if (cat) return cat.name;
    return match[1];
  }

  const cat = getMachineCategoryByName(str) || getMachineCategoryById(nameOrId);
  if (cat) return cat.name;
  return str;
}
