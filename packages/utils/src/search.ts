/**
 * Universal Instant Search Primitives
 * Framework-agnostic search utilities for React Web, React Native, and Node.js.
 *
 * Provides:
 * - O(N) pre-computed search blob indexing
 * - Sub-millisecond multi-term AND search with automatic phone/digit normalization
 * - Framework-agnostic text segmentation for match highlighting on Web and Mobile
 */

export interface IndexedItem<T> {
  item: T;
  blob: string;
}

export interface SearchOptions {
  /**
   * If true (default), all terms must appear in the blob (AND semantics).
   * If false, any term may appear (OR semantics).
   */
  matchAllTerms?: boolean;
  /**
   * If true (default), terms containing digits will also match digit-only substrings
   * (e.g. typing "+91 9812" or "9812" matches "+91 98123 45678").
   */
  matchDigits?: boolean;
}

/**
 * Build a flat search index with pre-computed lowercase blobs.
 * Call this inside useMemo keyed on [items].
 *
 * @example
 * const index = useMemo(() => buildSearchIndex(users, (u) => [
 *   u.full_name,
 *   u.email,
 *   u.phone,
 *   u.role,
 * ]), [users]);
 */
export function buildSearchIndex<T>(
  items: T[],
  extractSearchFields: (item: T) => (string | number | null | undefined)[]
): IndexedItem<T>[] {
  return items.map((item) => {
    const rawFields = extractSearchFields(item);
    const tokens: string[] = [];

    for (const field of rawFields) {
      if (field === null || field === undefined) continue;
      const str = String(field).trim().toLowerCase();
      if (!str) continue;

      tokens.push(str);

      // If field contains digits (e.g. phone, aadhaar, machine serial),
      // also index the pure digit sequence so formatted strings match unformatted queries.
      const digits = str.replace(/\D/g, "");
      if (digits.length >= 2 && digits !== str) {
        tokens.push(digits);
      }
    }

    return {
      item,
      blob: tokens.join(" "),
    };
  });
}

/**
 * Filter a pre-built search index by a multi-term query.
 * Extremely fast: runs in <1ms for thousands of records.
 *
 * @param index Pre-computed index from buildSearchIndex
 * @param query Search input string
 * @param options Matching options (defaults to multi-term AND matching)
 */
export function searchIndexedItems<T>(
  index: IndexedItem<T>[],
  query: string,
  options: SearchOptions = {}
): T[] {
  const { matchAllTerms = true, matchDigits = true } = options;

  const terms = query
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean);

  if (terms.length === 0) {
    return index.map((entry) => entry.item);
  }

  return index
    .filter(({ blob }) => {
      const predicate = (term: string) => {
        if (blob.includes(term)) return true;
        if (matchDigits) {
          const digits = term.replace(/\D/g, "");
          if (digits.length > 0 && blob.includes(digits)) {
            return true;
          }
        }
        return false;
      };

      return matchAllTerms ? terms.every(predicate) : terms.some(predicate);
    })
    .map((entry) => entry.item);
}

/**
 * Represents a text segment that is either matched or unmatched by the search query.
 */
export interface MatchSegment {
  text: string;
  isMatch: boolean;
}

/**
 * Breaks a string into matched and unmatched segments based on query terms.
 * Framework-agnostic: returns raw data that can be mapped to <span> on Web
 * or <Text> on React Native.
 *
 * • Case-insensitive
 * • Longest-term-first to prevent partial shadowing
 * • Escapes regex metacharacters in user queries
 * • Handles phone digit variants
 */
export function getSearchMatchSegments(
  text: string | null | undefined,
  query: string | undefined,
  options: { matchDigits?: boolean } = {}
): MatchSegment[] {
  if (!text) {
    return text ? [{ text, isMatch: false }] : [];
  }
  if (!query || !query.trim()) {
    return [{ text, isMatch: false }];
  }

  const { matchDigits = true } = options;

  const terms = query
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean);

  if (terms.length === 0) {
    return [{ text, isMatch: false }];
  }

  // Collect terms and their numeric digit counterparts
  const allTerms: string[] = [];
  for (const t of terms) {
    allTerms.push(t);
    if (matchDigits) {
      const digits = t.replace(/\D/g, "");
      if (digits.length >= 2 && digits !== t) {
        allTerms.push(digits);
      }
    }
  }

  // Deduplicate and sort longest first to prevent shorter prefixes from shadowing longer matches
  const uniqueTerms = Array.from(new Set(allTerms)).sort((a, b) => b.length - a.length);
  const escapedTerms = uniqueTerms.map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));

  if (escapedTerms.length === 0) {
    return [{ text, isMatch: false }];
  }

  const regex = new RegExp(`(${escapedTerms.join("|")})`, "gi");
  const parts = text.split(regex);

  if (parts.length <= 1) {
    return [{ text, isMatch: false }];
  }

  // In split() with a capture group, odd indices are matches, even indices are non-matches
  const segments: MatchSegment[] = [];
  for (let i = 0; i < parts.length; i++) {
    const part = parts[i];
    if (!part) continue; // skip empty strings between consecutive matches
    segments.push({
      text: part,
      isMatch: i % 2 === 1,
    });
  }

  return segments;
}
