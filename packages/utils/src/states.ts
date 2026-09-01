/**
 * Canonical Indian States and Union Territories
 * Matches PostgreSQL table `public.states` (IDs 1–38)
 */

export interface IndianState {
  id: number;
  name: string;
}

export const INDIAN_STATES: readonly IndianState[] = [
  { id: 35, name: "Andaman and Nicobar Islands" },
  { id: 28, name: "Andhra Pradesh" },
  { id: 12, name: "Arunachal Pradesh" },
  { id: 18, name: "Assam" },
  { id: 10, name: "Bihar" },
  { id: 4, name: "Chandigarh" },
  { id: 22, name: "Chhattisgarh" },
  { id: 38, name: "Dadra and Nagar Haveli and Daman and Diu" },
  { id: 7, name: "Delhi" },
  { id: 30, name: "Goa" },
  { id: 24, name: "Gujarat" },
  { id: 6, name: "Haryana" },
  { id: 2, name: "Himachal Pradesh" },
  { id: 1, name: "Jammu and Kashmir" },
  { id: 20, name: "Jharkhand" },
  { id: 29, name: "Karnataka" },
  { id: 32, name: "Kerala" },
  { id: 37, name: "Ladakh" },
  { id: 31, name: "Lakshadweep" },
  { id: 23, name: "Madhya Pradesh" },
  { id: 27, name: "Maharashtra" },
  { id: 14, name: "Manipur" },
  { id: 17, name: "Meghalaya" },
  { id: 15, name: "Mizoram" },
  { id: 13, name: "Nagaland" },
  { id: 21, name: "Odisha" },
  { id: 34, name: "Puducherry" },
  { id: 3, name: "Punjab" },
  { id: 8, name: "Rajasthan" },
  { id: 11, name: "Sikkim" },
  { id: 33, name: "Tamil Nadu" },
  { id: 36, name: "Telangana" },
  { id: 16, name: "Tripura" },
  { id: 9, name: "Uttar Pradesh" },
  { id: 5, name: "Uttarakhand" },
  { id: 19, name: "West Bengal" },
] as const;

export function getStateById(id?: number | string | null): IndianState | undefined {
  if (!id) return undefined;
  const numId = Number(id);
  return INDIAN_STATES.find((s) => s.id === numId);
}

export function getStateByName(name?: string | null): IndianState | undefined {
  if (!name || !name.trim()) return undefined;
  const lower = name.trim().toLowerCase();
  
  // Exact match
  const exact = INDIAN_STATES.find((s) => s.name.toLowerCase() === lower);
  if (exact) return exact;

  // Common aliases & variants
  if (["gujarat", "gujrat", "gujrati", "gujarati"].includes(lower)) return getStateById(24);
  if (["up", "uttar pradesh", "utter pradesh", "uttar pardesh"].includes(lower)) return getStateById(9);
  if (["assam", "aasam"].includes(lower)) return getStateById(18);
  if (["madhya pradesh", "madhady pradesh", "mp"].includes(lower)) return getStateById(23);
  if (["bihar"].includes(lower)) return getStateById(10);
  if (["maharashtra"].includes(lower)) return getStateById(27);
  if (["west bengal"].includes(lower)) return getStateById(19);
  if (["delhi", "new delhi"].includes(lower)) return getStateById(7);
  if (["rajasthan"].includes(lower)) return getStateById(8);
  if (lower.includes("dad") || lower.includes("haveli") || lower.includes("daman")) return getStateById(38);
  if (["j&k", "jammu & kashmir"].includes(lower)) return getStateById(1);
  if (["andhra", "ap"].includes(lower)) return getStateById(28);
  if (["tamilnadu", "tn"].includes(lower)) return getStateById(33);
  if (["telengana"].includes(lower)) return getStateById(36);

  return undefined;
}
