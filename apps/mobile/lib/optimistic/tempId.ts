/**
 * Optimistic UI Architecture — Temporary ID Generator & Predicates
 * Identifies optimistic rows that have not yet been assigned a permanent
 * server UUID / database primary key.
 */

export const TEMP_ID_PREFIX = 'tmp_';

/**
 * Universal RFC4122 compliant UUID v4 generator
 */
export function generateUUID(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Generates an optimistic temporary ID formatted as `tmp_<uuid>` or `tmp_<prefix>_<uuid>`.
 */
export function createTempId(prefix?: string): string {
  const cleanPrefix = prefix ? `${prefix.replace(/[^a-zA-Z0-9_-]/g, '')}_` : '';
  return `${TEMP_ID_PREFIX}${cleanPrefix}${generateUUID()}`;
}

/**
 * Checks whether an ID is an optimistic temporary ID.
 */
export function isTempId(id?: string | null): boolean {
  if (!id || typeof id !== 'string') return false;
  return id.startsWith(TEMP_ID_PREFIX);
}
