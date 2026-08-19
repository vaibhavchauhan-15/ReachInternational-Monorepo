/**
 * ServiceCentric Design Tokens — Elevation & Shadows
 * 3-level shadow system for Light and Dark themes.
 */

export const elevationLight = {
  none: 'none',
  whisper: '0px 1px 2px rgba(0, 0, 0, 0.04)',
  floating: '0px 4px 12px -2px rgba(0, 0, 0, 0.06), 0px 2px 4px -1px rgba(0, 0, 0, 0.04)',
} as const;

export const elevationDark = {
  none: 'none',
  whisper: '0px 1px 2px rgba(0, 0, 0, 0.4)',
  floating: '0px 8px 24px -4px rgba(0, 0, 0, 0.5), 0px 2px 6px -1px rgba(0, 0, 0, 0.3)',
} as const;

export type ElevationTokens = typeof elevationLight;
