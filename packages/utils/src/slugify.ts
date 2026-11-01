/**
 * Pure slugify function for URL-safe slugs with diacritics handling and optional collision resolution.
 */
export function slugify(
  input: string,
  existingSlugs: string[] = [],
  maxLength: number = 80
): string {
  if (!input || !input.trim()) {
    return 'item';
  }

  // 1. Normalize unicode diacritics / accents
  const normalized = input
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

  // 2. Convert to lowercase, replace non-alphanumeric with hyphens
  let baseSlug = normalized
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

  if (!baseSlug) {
    baseSlug = 'item';
  }

  // 3. Truncate to maxLength (preserving whole words where clean)
  if (baseSlug.length > maxLength) {
    baseSlug = baseSlug.slice(0, maxLength).replace(/-+$/, '');
  }

  // 4. If no collisions to check, return
  if (!existingSlugs || existingSlugs.length === 0) {
    return baseSlug;
  }

  const existingSet = new Set(existingSlugs.map((s) => s.toLowerCase()));
  if (!existingSet.has(baseSlug)) {
    return baseSlug;
  }

  // 5. Collision resolution: -2, -3, ...
  let counter = 2;
  let candidate = `${baseSlug}-${counter}`;
  while (existingSet.has(candidate)) {
    counter += 1;
    candidate = `${baseSlug}-${counter}`;
  }

  return candidate;
}
