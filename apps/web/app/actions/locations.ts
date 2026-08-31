"use server";

import { getStatesList, getDistrictsList, getCitiesList, searchLocations } from "@/lib/queries/locations";
import type { MasterState, MasterDistrict, MasterCity, MasterLocation } from "@reachinternational/types";

/**
 * Server action to get all 36 Indian States and Union Territories
 */
export async function getStatesAction(): Promise<MasterState[]> {
  return getStatesList();
}

/**
 * Server action to fetch districts for a selected state
 */
export async function getDistrictsAction(stateName: string): Promise<MasterDistrict[]> {
  if (!stateName) return [];
  return getDistrictsList(stateName);
}

/**
 * Server action to fetch cities & towns for a selected state and district
 */
export async function getCitiesAction(stateName: string, districtName: string): Promise<MasterCity[]> {
  if (!stateName || !districtName) return [];
  return getCitiesList(stateName, districtName);
}

/**
 * Server action for high-speed instant search across state, district, and city/town
 */
export async function searchLocationsAction(query: string, limit = 20): Promise<MasterLocation[]> {
  if (!query || query.trim().length < 2) return [];
  return searchLocations(query, limit);
}

// ---------------------------------------------------------------------------
// Relational Hierarchy Server Actions
// ---------------------------------------------------------------------------

export async function getRelationalStatesAction() {
  const { getRelationalStatesList } = await import("@/lib/queries/locations");
  return getRelationalStatesList();
}

export async function getRelationalDistrictsAction(stateId: number) {
  if (!stateId || stateId <= 0) return [];
  const { getRelationalDistrictsList } = await import("@/lib/queries/locations");
  return getRelationalDistrictsList(stateId);
}

export async function getRelationalCitiesAction(districtId: number) {
  if (!districtId || districtId <= 0) return [];
  const { getRelationalCitiesList } = await import("@/lib/queries/locations");
  return getRelationalCitiesList(districtId);
}

export async function getRelationalTownsAction(districtId: number) {
  if (!districtId || districtId <= 0) return [];
  const { getRelationalTownsList } = await import("@/lib/queries/locations");
  return getRelationalTownsList(districtId);
}

export async function getRelationalVillagesAction(districtId: number) {
  if (!districtId || districtId <= 0) return [];
  const { getRelationalVillagesList } = await import("@/lib/queries/locations");
  return getRelationalVillagesList(districtId);
}
