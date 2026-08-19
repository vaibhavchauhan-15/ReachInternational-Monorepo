/**
 * ServiceCentric Shared Utilities — String Formatters
 * Utility functions for string manipulation, entity code formatting, and capitalization.
 */

export function truncate(str: string, maxLength: number = 30): string {
  if (!str) return '';
  if (str.length <= maxLength) return str;
  return str.slice(0, maxLength - 3) + '...';
}

export function capitalize(str: string): string {
  if (!str) return '';
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
}

export function formatMachineCode(code: string | number): string {
  if (!code) return '';
  const str = String(code);
  if (str.startsWith('MCH-')) return str;
  return `MCH-${str.padStart(4, '0')}`;
}

export function formatEmployeeId(id: string | number): string {
  if (!id) return '';
  const str = String(id);
  if (str.startsWith('EMP-')) return str;
  return `EMP-${str.padStart(3, '0')}`;
}

export function formatChallanNumber(num: string | number): string {
  if (!num) return '';
  const str = String(num);
  if (str.startsWith('CHN-')) return str;
  return `CHN-${str.padStart(5, '0')}`;
}
