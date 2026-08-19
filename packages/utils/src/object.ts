/**
 * ServiceCentric Shared Utilities — Object & Array Helpers
 * Functional array grouping, sorting, filtering, and object key pick/omit helpers.
 */

export function groupBy<T>(array: T[], keyGetter: (item: T) => string): Record<string, T[]> {
  return array.reduce((acc, item) => {
    const key = keyGetter(item);
    if (!acc[key]) {
      acc[key] = [];
    }
    acc[key].push(item);
    return acc;
  }, {} as Record<string, T[]>);
}

export function sortBy<T>(array: T[], keyGetter: (item: T) => string | number, order: 'asc' | 'desc' = 'asc'): T[] {
  return [...array].sort((a, b) => {
    const keyA = keyGetter(a);
    const keyB = keyGetter(b);
    if (keyA < keyB) return order === 'asc' ? -1 : 1;
    if (keyA > keyB) return order === 'asc' ? 1 : -1;
    return 0;
  });
}

export function filterNil<T>(array: (T | null | undefined)[]): T[] {
  return array.filter((item): item is T => item !== null && item !== undefined);
}

export function omit<T extends object, K extends keyof T>(obj: T, keys: K[]): Omit<T, K> {
  const result = { ...obj };
  for (const key of keys) {
    delete result[key];
  }
  return result;
}

export function pick<T extends object, K extends keyof T>(obj: T, keys: K[]): Pick<T, K> {
  const result = {} as Pick<T, K>;
  for (const key of keys) {
    if (key in obj) {
      result[key] = obj[key];
    }
  }
  return result;
}
