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
  `${(a.pincode || '').trim()}|${normText(a.street)}|${normText(a.city)}`;

/** Display-only. Never store the output. */
export const formatAddress = (a: Partial<Address>): string =>
  [a.street, a.city, a.district, a.stateName, a.pincode]
    .map((p) => p?.trim())
    .filter(Boolean)
    .join(', ');

/**
 * Formats a site for display in single-line dropdown selectors.
 * Pattern: "S00 · Fort Songadh" or "S01 · Site Name"
 */
export const formatSiteDropdownLabel = (site: {
  code?: string | null;
  site_code?: string | null;
  site_name?: string | null;
  city?: string | null;
}): string => {
  const code = (site.code || (site.site_code ? site.site_code.replace(/^.*-S/, 'S') : 'S00')).trim();
  const name = (site.site_name || site.city || 'Site').trim();
  return `${code} · ${name}`;
};

/**
 * Formats a secondary address description for dropdown options.
 */
export const formatSiteDropdownDescription = (site: {
  address_full?: string | null;
  street?: string | null;
  city?: string | null;
  district?: string | null;
  pincode?: string | null;
}): string => {
  if (site.address_full && site.address_full.trim()) {
    return site.address_full.trim();
  }
  return [site.street, site.city, site.district, site.pincode]
    .map((p) => p?.trim())
    .filter(Boolean)
    .join(', ');
};

/**
 * Clean client dropdown label showing ONLY client code and company name.
 * Strictly avoids polluting the client selector with concatenated location strings.
 * Pattern: "CLI-0002 · JK Paper Ltd."
 */
export const formatClientDropdownLabel = (client: {
  code?: string | null;
  client_id?: string | null;
  company_name: string;
}): string => {
  const code = (client.code || client.client_id || '').trim();
  const name = (client.company_name || '').trim();
  return code ? `${code} · ${name}` : name;
};
