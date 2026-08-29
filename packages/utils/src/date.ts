/**
 * ServiceCentric Shared Utilities — Date Formatting
 * Enforces explicit DD-MM-YYYY rendering on both server (Node.js) and client environments without hydration mismatches.
 */

export function formatDate(dateInput: string | Date | null | undefined): string {
  if (!dateInput) return '—';
  let date: Date;
  if (typeof dateInput === 'string') {
    const cleanStr = dateInput.trim();
    if (!cleanStr) return '—';

    // Check YYYY-MM-DD or YYYY-MM-DDTHH:mm:ss
    const isoParts = cleanStr.split('T')[0].split('-');
    if (isoParts.length === 3 && isoParts[0].length === 4) {
      const year = parseInt(isoParts[0], 10);
      const month = parseInt(isoParts[1], 10) - 1;
      const day = parseInt(isoParts[2], 10);
      date = new Date(year, month, day);
    } else {
      // Check DD-MM-YYYY or DD/MM/YYYY
      const dmParts = cleanStr.split(/[/-]/);
      if (dmParts.length === 3 && dmParts[0].length <= 2 && dmParts[2].length === 4) {
        const day = parseInt(dmParts[0], 10);
        const month = parseInt(dmParts[1], 10) - 1;
        const year = parseInt(dmParts[2], 10);
        date = new Date(year, month, day);
      } else {
        date = new Date(cleanStr);
      }
    }
  } else {
    date = dateInput;
  }
  if (isNaN(date.getTime())) return '—';

  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  return `${day}-${month}-${year}`;
}

export function formatDisplayDate(dateInput: string | Date | null | undefined): string {
  return formatDate(dateInput);
}

export function formatDateTime(dateInput: string | Date | null | undefined): string {
  if (!dateInput) return '—';
  let date: Date;
  if (typeof dateInput === 'string') {
    const cleanStr = dateInput.trim();
    const isoParts = cleanStr.split('T')[0].split('-');
    if (isoParts.length === 3 && isoParts[0].length === 4 && !cleanStr.includes('T')) {
      const year = parseInt(isoParts[0], 10);
      const month = parseInt(isoParts[1], 10) - 1;
      const day = parseInt(isoParts[2], 10);
      date = new Date(year, month, day);
    } else {
      date = new Date(cleanStr);
    }
  } else {
    date = dateInput;
  }
  if (isNaN(date.getTime())) return '—';

  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${day}-${month}-${year}, ${hours}:${minutes}`;
}

export function formatTimeAgo(dateInput: string | Date | null | undefined): string {
  if (!dateInput) return '—';
  let date: Date;
  if (typeof dateInput === 'string') {
    date = new Date(dateInput);
  } else {
    date = dateInput;
  }
  if (isNaN(date.getTime())) return '—';

  const diffMs = Date.now() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);

  if (diffSec < 60) return 'Just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHour < 24) return `${diffHour}h ago`;
  if (diffDay === 1) return 'Yesterday';
  if (diffDay < 30) return `${diffDay}d ago`;
  return formatDate(date);
}

/**
 * Formats any raw time input (e.g. "06:00:00", "18:00:00", "18:30", "6:00", "06:00 AM")
 * into user-friendly 12-hour format with AM/PM (e.g. "06:00 AM", "06:00 PM").
 */
export function formatTo12Hour(timeStr?: string | null): string {
  if (!timeStr) return '';
  const trimmed = timeStr.trim().toUpperCase();
  if (!trimmed) return '';

  // Already formatted with AM/PM (e.g. "06:00 AM", "6:00PM", "06:00:00 AM")
  const ampmMatch = trimmed.match(/^(\d{1,2}):(\d{2})(?::\d{2})?\s*(AM|PM)$/i);
  if (ampmMatch) {
    const h = parseInt(ampmMatch[1], 10);
    const m = ampmMatch[2];
    const p = ampmMatch[3].toUpperCase();
    return `${String(h).padStart(2, '0')}:${m} ${p}`;
  }

  // 24-hour format (e.g. "06:00:00", "18:00:00", "18:30", "6:00")
  const match24 = trimmed.match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/);
  if (match24) {
    let hours = parseInt(match24[1], 10);
    const minutes = match24[2];
    const period = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12;
    if (hours === 0) hours = 12;
    return `${String(hours).padStart(2, '0')}:${minutes} ${period}`;
  }

  return trimmed;
}

/**
 * Formats a start and end time range in 12-hour AM/PM format (e.g. "06:00 AM — 06:00 PM").
 */
export function formatShiftTimingRange(startStr?: string | null, endStr?: string | null): string {
  const s = formatTo12Hour(startStr) || '06:00 AM';
  const e = formatTo12Hour(endStr) || '02:00 PM';
  return `${s} — ${e}`;
}

/**
 * Formats a start and end time range in compact 12-hour AM/PM format for tables/exports (e.g. "06:00AM-06:00PM").
 */
export function formatCompactTiming(startStr?: string | null, endStr?: string | null): string {
  const formattedStart = formatTo12Hour(startStr) || '06:00 AM';
  const formattedEnd = formatTo12Hour(endStr) || '02:00 PM';
  return `${formattedStart.replace(/\s+/g, '')}-${formattedEnd.replace(/\s+/g, '')}`;
}

