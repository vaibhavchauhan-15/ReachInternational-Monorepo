// packages/utils/src/address.ts
export type Address = {
  street: string;
  city: string;
  district: string;
  stateName: string;
  pincode: string;
};

/**
 * Normalize text for comparison. Mirrors SQL norm_text() exactly:
 * lower, replace non-alphanumeric with space, trim.
 * Uses Unicode-aware regex so Devanagari etc. are kept.
 */
export const normText = (s?: string | null): string =>
  (s ?? '').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();

/**
 * Deterministic address key matching SQL address_key generated column.
 * pincode|norm(street)|norm(city)
 */
export const addressKey = (a: Pick<Address, 'street' | 'city' | 'pincode'>): string =>
  `${a.pincode.trim()}|${normText(a.street)}|${normText(a.city)}`;

/** Display-only. Never store the output. */
export const formatAddress = (a: Partial<Address>): string =>
  [a.street, a.city, a.district, a.stateName, a.pincode]
    .map((p) => p?.trim())
    .filter(Boolean)
    .join(', ');
