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
