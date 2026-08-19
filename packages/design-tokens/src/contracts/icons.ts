/**
 * ServiceCentric Design Tokens — Platform-Neutral Icon Keys
 * Ensures Web (Lucide React) and Mobile (Expo Vector Icons) use identical icon symbol keys.
 */

export const ICON_KEYS = {
  machine: 'truck',
  service: 'wrench',
  complaint: 'alert-triangle',
  inventory: 'package',
  rental: 'key',
  sales: 'trending-up',
  finance: 'dollar-sign',
  hr: 'users',
  user: 'user',
  branch: 'building',
  dashboard: 'layout-dashboard',
  work: 'briefcase',
  document: 'file-text',
  notification: 'bell',
  audit: 'shield-check',
  settings: 'settings',
  alert: 'alert-circle',
  check: 'check-circle',
  clock: 'clock',
  filter: 'filter',
  search: 'search',
  plus: 'plus',
  edit: 'edit-2',
  trash: 'trash-2',
  chevronRight: 'chevron-right',
  chevronDown: 'chevron-down',
  menu: 'menu',
  close: 'x',
  download: 'download',
  print: 'printer',
} as const;

export type IconKey = keyof typeof ICON_KEYS;
