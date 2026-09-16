"use server";

import {
  getStatesList,
  getDistrictsList,
  getCitiesList,
  getTownsList,
  getVillagesList,
  searchLocations,
  type HierarchicalLocationSearchResult,
} from "@/lib/queries/locations";
import type { State, District, City, Town, Village } from "@reachinternational/types";

/**
 * Server action to get all 36 Indian States and Union Territories.
 * Payload: ~1 KB (36 items).
 */
export async function getStatesAction(): Promise<State[]> {
  return getStatesList();
}

/**
 * Server action to fetch districts for a selected state (by ID or name).
 * Payload: ~1 KB (20–45 items).
 */
export async function getDistrictsAction(stateIdOrName: number | string): Promise<District[]> {
  if (!stateIdOrName) return [];
  return getDistrictsList(stateIdOrName);
}

/**
 * Server action to fetch cities for a selected district (by ID or name).
 * Payload: < 1 KB (2–15 items).
 */
export async function getCitiesAction(districtIdOrName: number | string): Promise<City[]> {
  if (!districtIdOrName) return [];
  return getCitiesList(districtIdOrName);
}

/**
 * Server action to fetch towns for a selected district (by ID or name).
 * Payload: < 2 KB (5–30 items).
 */
export async function getTownsAction(districtIdOrName: number | string): Promise<Town[]> {
  if (!districtIdOrName) return [];
  return getTownsList(districtIdOrName);
}

/**
 * Server action to fetch villages for a selected district with optional search filter.
 */
export async function getVillagesAction(
  districtIdOrName: number | string,
  search?: string,
  limit = 50
): Promise<Village[]> {
  if (!districtIdOrName) return [];
  return getVillagesList(districtIdOrName, search, limit);
}

/**
 * Server action for high-speed progressive search across states, districts, and cities.
 */
export async function searchLocationsAction(
  query: string,
  limit = 20
): Promise<HierarchicalLocationSearchResult[]> {
  if (!query || query.trim().length < 2) return [];
  return searchLocations(query, limit);
}

// ---------------------------------------------------------------------------
// Relational Hierarchy Aliases
// ---------------------------------------------------------------------------
export const getRelationalStatesAction = getStatesAction;
export const getRelationalDistrictsAction = getDistrictsAction;
export const getRelationalCitiesAction = getCitiesAction;
export const getRelationalTownsAction = getTownsAction;
export const getRelationalVillagesAction = getVillagesAction;
