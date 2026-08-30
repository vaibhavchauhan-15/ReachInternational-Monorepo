/**
 * ServiceCentric Design Tokens — Colors
 * Canonical platform-neutral color system supporting Light and Dark modes.
 */

export interface ColorTokens {
  ink: string;
  canvas: string;
  canvasElevated: string;
  body: string;
  mute: string;
  faint: string;
  hairline: string;
  hairlineSoft: string;
  primary: string;
  onPrimary: string;
  link: string;
  linkDeep: string;
  linkSoft: string;
  violet: string;
  violetSoft: string;
  cyan: string;
  cyanSoft: string;
  pink: string;
  magenta: string;
  error: string;
  errorDeep: string;
  errorSoft: string;
  warning: string;
  warningSoft: string;
  warningDeep: string;
  success: string;
  successDeep: string;
  successSoft: string;
  info: string;
  infoSoft: string;
  pending: string;
  pendingSoft: string;
  overdue: string;
  overdueSoft: string;
}

export const colorsLight: ColorTokens = {
  // Foundation (Ink & Canvas)
  ink: '#171717',
  canvas: '#fafafa',
  canvasElevated: '#ffffff',

  // Hierarchy / Text Ladder
  body: '#4d4d4d',
  mute: '#8f8f8f',
  faint: '#a1a1a1',

  // Borders & Dividers
  hairline: '#ebebeb',
  hairlineSoft: '#f2f2f2',

  // Primary & Action
  primary: '#0284c7',
  onPrimary: '#ffffff',
  link: '#0070f3',
  linkDeep: '#0761d1',
  linkSoft: '#d3e5ff',

  // Chromatic Accents
  violet: '#7928ca',
  violetSoft: '#d8ccf1',
  cyan: '#50e3c2',
  cyanSoft: '#aaffec',
  pink: '#ff0080',
  magenta: '#eb367f',

  // Semantic Status Colors
  error: '#ee0000',
  errorDeep: '#c50000',
  errorSoft: '#fef2f2',
  warning: '#f5a623',
  warningSoft: '#ffefcf',
  warningDeep: '#ab570a',
  success: '#10b981',
  successDeep: '#059669',
  successSoft: '#ecfdf5',
  info: '#3b82f6',
  infoSoft: '#eff6ff',
  pending: '#f59e0b',
  pendingSoft: '#fffbeb',
  overdue: '#e11d48',
  overdueSoft: '#fff1f2',
};

export const colorsDark: ColorTokens = {
  // Foundation (Ink & Canvas)
  ink: '#fafafa',
  canvas: '#0a0a0a',
  canvasElevated: '#171717',

  // Hierarchy / Text Ladder
  body: '#a3a3a3',
  mute: '#737373',
  faint: '#525252',

  // Borders & Dividers
  hairline: '#262626',
  hairlineSoft: '#1a1a1a',

  // Primary & Action
  primary: '#0ea5e9',
  onPrimary: '#ffffff',
  link: '#3b82f6',
  linkDeep: '#2563eb',
  linkSoft: '#1e3a8a',

  // Chromatic Accents
  violet: '#a78bfa',
  violetSoft: '#4c1d95',
  cyan: '#5eead4',
  cyanSoft: '#134e4a',
  pink: '#f472b6',
  magenta: '#ec4899',

  // Semantic Status Colors
  error: '#f87171',
  errorDeep: '#dc2626',
  errorSoft: '#450a0a',
  warning: '#fbbf24',
  warningSoft: '#78350f',
  warningDeep: '#f59e0b',
  success: '#34d399',
  successDeep: '#10b981',
  successSoft: '#064e3b',
  info: '#60a5fa',
  infoSoft: '#1e3a8a',
  pending: '#fbbf24',
  pendingSoft: '#78350f',
  overdue: '#fb7185',
  overdueSoft: '#4c0519',
};
