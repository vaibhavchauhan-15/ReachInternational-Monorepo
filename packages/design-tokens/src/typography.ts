export const TYPE_VARIANTS = {
  hero:       { size: 44, line: 54, font: 'Geist-Bold',       icon: 32 },
  display:    { size: 28, line: 34, font: 'Geist-Bold',       icon: 28 },
  title:      { size: 20, line: 26, font: 'Geist-SemiBold',   icon: 22 },
  heading:    { size: 16, line: 22, font: 'Geist-SemiBold',   icon: 18 },
  subheading: { size: 14, line: 20, font: 'Geist-SemiBold',   icon: 16 },
  body:       { size: 14, line: 20, font: 'Geist-Regular',    icon: 16 },
  label:      { size: 13, line: 18, font: 'Geist-Medium',     icon: 14 },
  caption:    { size: 12, line: 16, font: 'Geist-Regular',    icon: 12 },
  micro:      { size: 11, line: 15, font: 'Geist-Regular',    icon: 11 },
  mono:       { size: 13, line: 18, font: 'GeistMono-Medium', icon: 14 },
} as const;

export type TypeVariant = keyof typeof TYPE_VARIANTS;

export const iconSize = {
  hero: TYPE_VARIANTS.hero.icon,
  display: TYPE_VARIANTS.display.icon,
  title: TYPE_VARIANTS.title.icon,
  heading: TYPE_VARIANTS.heading.icon,
  subheading: TYPE_VARIANTS.subheading.icon,
  body: TYPE_VARIANTS.body.icon,
  label: TYPE_VARIANTS.label.icon,
  caption: TYPE_VARIANTS.caption.icon,
  mono: TYPE_VARIANTS.mono.icon,
} as const;

export type IconSizeVariant = keyof typeof iconSize;

export const FONT_SCALE_PRESETS = { small: 0.92, medium: 1, large: 1.2 } as const;
export type FontScalePreset = keyof typeof FONT_SCALE_PRESETS;

export const OS_FONT_SCALE_CAP = 1.3;

/** Round to nearest 0.5px so text and icons land on crisp values. */
export const scaled = (n: number, scale: number) => Math.round(n * scale * 2) / 2;

