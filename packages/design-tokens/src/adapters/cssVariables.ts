/**
 * ServiceCentric Design Tokens — Web CSS Variable Adapter
 * Converts canonical TypeScript design tokens into CSS custom property declarations.
 */

import { colorsLight, colorsDark } from '../tokens/colors';
import { typographyPresets, fontFamilies } from '../tokens/typography';
import { spacing } from '../tokens/spacing';
import { radius } from '../tokens/radius';
import { elevationLight, elevationDark } from '../tokens/elevation';
import { motionDurations, motionEasings } from '../tokens/motion';

export function generateRootCssVariables(): string {
  return `
:root {
  --font-sans: ${fontFamilies.sans};
  --font-mono: ${fontFamilies.mono};

  /* Typography */
  --text-display-xl-size: ${typographyPresets.displayXl.size};
  --text-display-xl-line: ${typographyPresets.displayXl.lineHeight};
  --text-display-xl-spacing: ${typographyPresets.displayXl.letterSpacing};
  --text-display-xl-weight: ${typographyPresets.displayXl.weight};

  --text-heading-lg-size: ${typographyPresets.headingLg.size};
  --text-heading-lg-line: ${typographyPresets.headingLg.lineHeight};
  --text-heading-lg-spacing: ${typographyPresets.headingLg.letterSpacing};
  --text-heading-lg-weight: ${typographyPresets.headingLg.weight};

  --text-heading-md-size: ${typographyPresets.headingMd.size};
  --text-heading-md-line: ${typographyPresets.headingMd.lineHeight};
  --text-heading-md-spacing: ${typographyPresets.headingMd.letterSpacing};
  --text-heading-md-weight: ${typographyPresets.headingMd.weight};

  --text-label-sm-size: ${typographyPresets.labelSm.size};
  --text-label-sm-line: ${typographyPresets.labelSm.lineHeight};
  --text-label-sm-spacing: ${typographyPresets.labelSm.letterSpacing};
  --text-label-sm-weight: ${typographyPresets.labelSm.weight};

  --text-mono-eyebrow-size: ${typographyPresets.monoEyebrow.size};
  --text-mono-eyebrow-line: ${typographyPresets.monoEyebrow.lineHeight};
  --text-mono-eyebrow-spacing: ${typographyPresets.monoEyebrow.letterSpacing};
  --text-mono-eyebrow-weight: ${typographyPresets.monoEyebrow.weight};

  --text-body-lg-size: ${typographyPresets.bodyLg.size};
  --text-body-lg-line: ${typographyPresets.bodyLg.lineHeight};
  --text-body-lg-weight: ${typographyPresets.bodyLg.weight};

  --text-body-md-size: ${typographyPresets.bodyMd.size};
  --text-body-md-line: ${typographyPresets.bodyMd.lineHeight};
  --text-body-md-weight: ${typographyPresets.bodyMd.weight};

  --text-body-sm-size: ${typographyPresets.bodySm.size};
  --text-body-sm-line: ${typographyPresets.bodySm.lineHeight};
  --text-body-sm-weight: ${typographyPresets.bodySm.weight};

  --text-button-lg-size: ${typographyPresets.buttonLg.size};
  --text-button-lg-line: ${typographyPresets.buttonLg.lineHeight};
  --text-button-lg-weight: ${typographyPresets.buttonLg.weight};

  --text-button-md-size: ${typographyPresets.buttonMd.size};
  --text-button-md-line: ${typographyPresets.buttonMd.lineHeight};
  --text-button-md-weight: ${typographyPresets.buttonMd.weight};

  --text-code-size: ${typographyPresets.code.size};
  --text-code-line: ${typographyPresets.code.lineHeight};
  --text-code-weight: ${typographyPresets.code.weight};

  /* Spacing */
  --spacing-xxs: ${spacing.xxs};
  --spacing-xs: ${spacing.xs};
  --spacing-sm: ${spacing.sm};
  --spacing-md: ${spacing.md};
  --spacing-lg: ${spacing.lg};
  --spacing-xl: ${spacing.xl};
  --spacing-2xl: ${spacing['2xl']};
  --spacing-3xl: ${spacing['3xl']};
  --spacing-4xl: ${spacing['4xl']};
  --spacing-section: ${spacing.section};

  /* Radius */
  --radius-none: ${radius.none};
  --radius-sm: ${radius.sm};
  --radius-md: ${radius.md};
  --radius-lg: ${radius.lg};
  --radius-pill-category: ${radius.pillCategory};
  --radius-pill: ${radius.pill};
  --radius-full: ${radius.full};

  /* Light Colors */
  --color-ink: ${colorsLight.ink};
  --color-canvas: ${colorsLight.canvas};
  --color-canvas-elevated: ${colorsLight.canvasElevated};
  --color-body: ${colorsLight.body};
  --color-mute: ${colorsLight.mute};
  --color-faint: ${colorsLight.faint};
  --color-hairline: ${colorsLight.hairline};
  --color-hairline-soft: ${colorsLight.hairlineSoft};
  --color-primary: ${colorsLight.primary};
  --color-on-primary: ${colorsLight.onPrimary};
  --color-link: ${colorsLight.link};
  --color-link-deep: ${colorsLight.linkDeep};
  --color-link-soft: ${colorsLight.linkSoft};
  --color-violet: ${colorsLight.violet};
  --color-violet-soft: ${colorsLight.violetSoft};
  --color-cyan: ${colorsLight.cyan};
  --color-cyan-soft: ${colorsLight.cyanSoft};
  --color-pink: ${colorsLight.pink};
  --color-magenta: ${colorsLight.magenta};

  --color-error: ${colorsLight.error};
  --color-error-deep: ${colorsLight.errorDeep};
  --color-warning: ${colorsLight.warning};
  --color-warning-soft: ${colorsLight.warningSoft};
  --color-warning-deep: ${colorsLight.warningDeep};
  --color-success: ${colorsLight.success};
  --color-success-deep: ${colorsLight.successDeep};

  /* Elevation */
  --shadow-none: ${elevationLight.none};
  --shadow-whisper: ${elevationLight.whisper};
  --shadow-floating: ${elevationLight.floating};

  /* Motion */
  --motion-instant: ${motionDurations.instant};
  --motion-fast: ${motionDurations.fast};
  --motion-normal: ${motionDurations.normal};
  --motion-slow: ${motionDurations.slow};
  --motion-slower: ${motionDurations.slower};

  --ease-out-cubic: ${motionEasings.easeOutCubic};
  --ease-spring: ${motionEasings.easeSpring};
  --ease-smooth: ${motionEasings.easeSmooth};
}

.dark {
  --color-ink: ${colorsDark.ink};
  --color-canvas: ${colorsDark.canvas};
  --color-canvas-elevated: ${colorsDark.canvasElevated};
  --color-body: ${colorsDark.body};
  --color-mute: ${colorsDark.mute};
  --color-faint: ${colorsDark.faint};
  --color-hairline: ${colorsDark.hairline};
  --color-hairline-soft: ${colorsDark.hairlineSoft};
  --color-primary: ${colorsDark.primary};
  --color-on-primary: ${colorsDark.onPrimary};
  --color-link: ${colorsDark.link};
  --color-link-deep: ${colorsDark.linkDeep};
  --color-link-soft: ${colorsDark.linkSoft};
  --color-violet: ${colorsDark.violet};
  --color-violet-soft: ${colorsDark.violetSoft};
  --color-cyan: ${colorsDark.cyan};
  --color-cyan-soft: ${colorsDark.cyanSoft};
  --color-pink: ${colorsDark.pink};
  --color-magenta: ${colorsDark.magenta};

  --color-error: ${colorsDark.error};
  --color-error-deep: ${colorsDark.errorDeep};
  --color-warning: ${colorsDark.warning};
  --color-warning-soft: ${colorsDark.warningSoft};
  --color-warning-deep: ${colorsDark.warningDeep};
  --color-success: ${colorsDark.success};
  --color-success-deep: ${colorsDark.successDeep};

  --shadow-whisper: ${elevationDark.whisper};
  --shadow-floating: ${elevationDark.floating};
}
  `.trim();
}
