import React, { memo } from 'react';
import { View, Text, StyleSheet, type ViewStyle } from 'react-native';
import Svg, { Rect, Circle, Path, Line, G } from 'react-native-svg';
import { useTheme } from '../ui/ThemeProvider';

export interface ScissorLiftLogoIconProps {
  size?: number;
  color?: string;
  arrowColor?: string;
  style?: ViewStyle;
  variant?: 'auto' | 'light' | 'dark';
  withArrow?: boolean;
}

/**
 * Authoritative ScissorLiftLogoIcon vector matching apps/web/components/branding/ScissorLiftLogoIcon.tsx
 * and apps/mobile/public/dark-favicon.svg.
 *
 * Polarity Rule:
 * In Dark Theme: Renders the LIGHT logo (white scissor lift + cyan blue #38bdf8 arrow).
 * In Light Theme: Renders the DARK logo (charcoal #0f172a scissor lift + brand blue #0284c7 arrow).
 */
export const ScissorLiftLogoIcon = memo(function ScissorLiftLogoIcon({
  size = 32,
  color,
  arrowColor,
  style,
  variant = 'auto',
  withArrow = false,
}: ScissorLiftLogoIconProps) {
  const { isDark } = useTheme();

  // In dark theme use light logo, in light theme use dark logo
  const useLightIcon =
    variant === 'light' ? true : variant === 'dark' ? false : isDark;

  const structureColor =
    color || (useLightIcon ? '#ffffff' : '#0f172a');
  const accentArrowColor =
    arrowColor || (useLightIcon ? '#38bdf8' : '#0284c7');

  if (withArrow) {
    return (
      <View style={[{ width: size, height: size }, style]}>
        <Svg width={size} height={size} viewBox="0 0 100 100" fill="none">
          {/* Base Chassis */}
          <Rect x="12" y="82" width="68" height="6" rx="3" fill={structureColor} />
          <Circle cx="22" cy="91" r="4.5" fill={structureColor} />
          <Circle cx="70" cy="91" r="4.5" fill={structureColor} />

          {/* Hydraulic Base Mounts */}
          <Rect x="18" y="78" width="8" height="4" fill={structureColor} />
          <Rect x="66" y="78" width="8" height="4" fill={structureColor} />

          {/* Scissor Arms (Bottom X) */}
          <Path
            d="M22 82 L70 54"
            stroke={structureColor}
            strokeWidth="5"
            strokeLinecap="round"
          />
          <Path
            d="M70 82 L22 54"
            stroke={structureColor}
            strokeWidth="5"
            strokeLinecap="round"
          />
          <Circle cx="46" cy="68" r="3" fill={structureColor} />

          {/* Scissor Arms (Top X) */}
          <Path
            d="M22 54 L70 26"
            stroke={structureColor}
            strokeWidth="5"
            strokeLinecap="round"
          />
          <Path
            d="M70 54 L22 26"
            stroke={structureColor}
            strokeWidth="5"
            strokeLinecap="round"
          />
          <Circle cx="46" cy="40" r="3" fill={structureColor} />

          {/* Center Hydraulic Lift Cylinder */}
          <Line
            x1="46"
            y1="78"
            x2="46"
            y2="28"
            stroke={structureColor}
            strokeWidth="2.5"
            strokeDasharray="4 2"
            opacity={0.4}
          />

          {/* Top Work Platform Deck */}
          <Rect x="10" y="20" width="72" height="6" rx="2" fill={structureColor} />

          {/* Safety Guardrails */}
          <Path
            d="M14 20 V8 H78 V20"
            stroke={structureColor}
            strokeWidth="3.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          />
          <Path d="M46 20 V8" stroke={structureColor} strokeWidth="2.5" />

          {/* Upward Height Arrow */}
          <G fill="none">
            <Path
              d="M89 54 V10"
              stroke={accentArrowColor}
              strokeWidth="4.5"
              strokeLinecap="round"
            />
            <Path
              d="M81 18 L89 8 L97 18"
              stroke={accentArrowColor}
              strokeWidth="4.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </G>
        </Svg>
      </View>
    );
  }

  return (
    <View style={[{ width: size, height: size }, style]}>
      <Svg width={size} height={size} viewBox="0 0 100 100" fill="none">
        {/* Base Chassis (Centered matching Web app) */}
        <Rect x="16" y="82" width="68" height="6" rx="3" fill={structureColor} />
        <Circle cx="26" cy="91" r="4.5" fill={structureColor} />
        <Circle cx="74" cy="91" r="4.5" fill={structureColor} />

        {/* Hydraulic Base Mounts */}
        <Rect x="22" y="78" width="8" height="4" fill={structureColor} />
        <Rect x="70" y="78" width="8" height="4" fill={structureColor} />

        {/* Lower Scissor Level (Bottom X-Brace) */}
        <Path
          d="M26 82 L74 54"
          stroke={structureColor}
          strokeWidth="5"
          strokeLinecap="round"
        />
        <Path
          d="M74 82 L26 54"
          stroke={structureColor}
          strokeWidth="5"
          strokeLinecap="round"
        />
        <Circle cx="50" cy="68" r="3" fill={structureColor} />

        {/* Upper Scissor Level (Top X-Brace) */}
        <Path
          d="M26 54 L74 26"
          stroke={structureColor}
          strokeWidth="5"
          strokeLinecap="round"
        />
        <Path
          d="M74 54 L26 26"
          stroke={structureColor}
          strokeWidth="5"
          strokeLinecap="round"
        />
        <Circle cx="50" cy="40" r="3" fill={structureColor} />

        {/* Center Hydraulic Lift Cylinder */}
        <Line
          x1="50"
          y1="78"
          x2="50"
          y2="28"
          stroke={structureColor}
          strokeWidth="2.5"
          strokeDasharray="4 2"
          opacity={0.4}
        />

        {/* Upper Work Platform Deck */}
        <Rect x="14" y="20" width="72" height="6" rx="2" fill={structureColor} />

        {/* Safety Guardrails */}
        <Path
          d="M18 20 V8 H82 V20"
          stroke={structureColor}
          strokeWidth="3.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
        <Path d="M50 20 V8" stroke={structureColor} strokeWidth="2.5" />
      </Svg>
    </View>
  );
});

export interface ReachBrandEmblemProps {
  size?: number;
  style?: ViewStyle;
  variant?: 'auto' | 'light' | 'dark';
  bordered?: boolean;
}

/**
 * Authoritative Squircle Brand Mark Emblem matching
 * apps/mobile/public/light-web-app-manifest-512x512.png and dark-web-app-manifest-512x512.png.
 *
 * Polarity Rule:
 * In Dark Theme: Renders the LIGHT emblem (white container with dark trellis & 'R' from light-web-app-manifest).
 * In Light Theme: Renders the DARK emblem (dark container with white trellis & 'R' from dark-web-app-manifest).
 */
export const ReachBrandEmblem = memo(function ReachBrandEmblem({
  size = 32,
  style,
  variant = 'auto',
  bordered = true,
}: ReachBrandEmblemProps) {
  const { isDark } = useTheme();

  // In dark theme use light logo/emblem, in light theme use dark logo/emblem
  const useLightEmblem =
    variant === 'light' ? true : variant === 'dark' ? false : isDark;

  const containerBg = useLightEmblem ? '#ffffff' : '#09090b';
  const containerBorder = useLightEmblem ? '#e2e8f0' : '#27272a';
  const markColor = useLightEmblem ? '#0f172a' : '#ffffff';
  const accentColor = useLightEmblem ? '#0284c7' : '#38bdf8';
  const cornerRadius = Math.round(size * 0.24);

  return (
    <View
      style={[
        styles.emblemContainer,
        {
          width: size,
          height: size,
          borderRadius: cornerRadius,
          backgroundColor: containerBg,
          borderColor: bordered ? containerBorder : 'transparent',
          borderWidth: bordered ? 1 : 0,
        },
        style,
      ]}
    >
      <Svg width={size * 0.76} height={size * 0.76} viewBox="0 0 100 100" fill="none">
        {/* Left Side: Scissor Trellis Column */}
        <Path d="M12 28 H44" stroke={markColor} strokeWidth="4.5" strokeLinecap="round" />

        {/* 4 Tiers of X-Bracing */}
        <Path d="M14 28 L42 42" stroke={markColor} strokeWidth="4" strokeLinecap="round" />
        <Path d="M42 28 L14 42" stroke={markColor} strokeWidth="4" strokeLinecap="round" />

        <Path d="M14 42 L42 56" stroke={markColor} strokeWidth="4" strokeLinecap="round" />
        <Path d="M42 42 L14 56" stroke={markColor} strokeWidth="4" strokeLinecap="round" />

        <Path d="M14 56 L42 70" stroke={markColor} strokeWidth="4" strokeLinecap="round" />
        <Path d="M42 56 L14 70" stroke={markColor} strokeWidth="4" strokeLinecap="round" />

        <Path d="M14 70 L42 84" stroke={markColor} strokeWidth="4" strokeLinecap="round" />
        <Path d="M42 70 L14 84" stroke={markColor} strokeWidth="4" strokeLinecap="round" />

        {/* Bottom Base Bar */}
        <Path d="M10 84 H46" stroke={markColor} strokeWidth="4.5" strokeLinecap="round" />

        {/* Right Side: Upward Chevron Arrow (Isometric Roof Accent) */}
        <Path
          d="M54 26 L71 11 L88 26"
          stroke={accentColor}
          strokeWidth="6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Right Side: Bold Geometric 'R' */}
        <Path d="M57 36 V78" stroke={markColor} strokeWidth="9.5" strokeLinecap="square" />
        <Path
          d="M57 36 H73 C81 36 86 41 86 48 C86 55 81 60 73 60 H57"
          stroke={markColor}
          strokeWidth="8"
          strokeLinejoin="round"
        />
        <Path d="M68 58 L85 78" stroke={markColor} strokeWidth="9" strokeLinecap="round" />

        {/* Right Side: Horizontal Baseline Bar */}
        <Path d="M53 86 H89" stroke={accentColor} strokeWidth="5.5" strokeLinecap="round" />
      </Svg>
    </View>
  );
});

export type LogoVariant = 'full' | 'compact' | 'wordmark';
export type ThemePolarity = 'auto' | 'light' | 'dark';

export interface ReachInternationalLogoProps {
  variant?: LogoVariant | ThemePolarity;
  iconType?: 'emblem' | 'scissor';
  size?: number;
  showIcon?: boolean;
  showTagline?: boolean;
  style?: ViewStyle;
  themeVariant?: ThemePolarity;
  withArrow?: boolean;
  alt?: string;
}

/**
 * Authoritative Full Brand Lockup matching apps/web/components/branding/ReachInternationalLogo.tsx
 * and apps/mobile/public/pdf-logo.png
 *
 * Polarity Rule:
 * In Dark Theme: Renders the LIGHT logo (white "REACH", cyan "INTERNATIONAL", subtle light tagline).
 * In Light Theme: Renders the DARK logo (dark "REACH", brand blue "INTERNATIONAL", slate tagline).
 */
export const ReachInternationalLogo = memo(function ReachInternationalLogo({
  size = 32,
  showIcon = true,
  showTagline = true,
  iconType = 'emblem',
  style,
  variant = 'full',
  themeVariant,
  withArrow = false,
  alt = 'Reach International — Reaching All Heights',
}: ReachInternationalLogoProps) {
  const { isDark } = useTheme();

  // Resolve layout variant vs theme variant gracefully
  const isThemePolarityString =
    variant === 'light' || variant === 'dark' || variant === 'auto';
  const effectiveLayoutVariant: LogoVariant = isThemePolarityString
    ? 'full'
    : (variant as LogoVariant) || 'full';
  const effectiveTheme: ThemePolarity =
    themeVariant || (isThemePolarityString ? (variant as ThemePolarity) : 'auto');

  // In dark theme use light logo, in light theme use dark logo
  const useLightLogo =
    effectiveTheme === 'light' ? true : effectiveTheme === 'dark' ? false : isDark;

  const iconSize = Math.max(22, Math.round(size * 1.05));
  const emblemSize = Math.max(24, Math.round(size * 1.15));

  // Polarity: Dark theme uses light logo, light theme uses dark logo
  const brandReachColor = useLightLogo ? '#ffffff' : '#09090b';
  const brandInternationalColor = useLightLogo ? '#38bdf8' : '#0284c7';
  const taglineColor = useLightLogo ? '#94a3b8' : '#64748b';
  const dividerColor = useLightLogo
    ? 'rgba(255, 255, 255, 0.2)'
    : 'rgba(203, 213, 225, 0.9)';

  // Proportional typography scaling exactly matching web design
  const reachFontSize = Math.max(11, Math.round(size * 0.54));
  const internationalFontSize = Math.max(11, Math.round(size * 0.54));
  const taglineFontSize = Math.max(6, Math.round(size * 0.25));
  const gapSize = Math.max(7, Math.round(size * 0.3));

  if (effectiveLayoutVariant === 'compact') {
    return (
      <View
        style={[styles.compactContainer, style]}
        accessible={true}
        accessibilityLabel={alt}
      >
        {showIcon ? (
          iconType === 'scissor' ? (
            <ScissorLiftLogoIcon
              size={size}
              variant={useLightLogo ? 'light' : 'dark'}
              withArrow={withArrow}
            />
          ) : (
            <ReachBrandEmblem
              size={size}
              variant={useLightLogo ? 'light' : 'dark'}
            />
          )
        ) : (
          <View
            style={[
              styles.monogramBadge,
              {
                backgroundColor: useLightLogo
                  ? 'rgba(56, 189, 248, 0.15)'
                  : 'rgba(2, 132, 199, 0.12)',
                borderColor: useLightLogo
                  ? 'rgba(56, 189, 248, 0.3)'
                  : 'rgba(2, 132, 199, 0.25)',
              },
            ]}
          >
            <Text
              style={[
                styles.monogramText,
                {
                  color: useLightLogo ? '#38bdf8' : '#0284c7',
                  fontSize: Math.round(size * 0.42),
                },
              ]}
            >
              RI
            </Text>
          </View>
        )}
      </View>
    );
  }

  const shouldRenderIcon = effectiveLayoutVariant !== 'wordmark' && showIcon;

  return (
    <View
      style={[styles.container, { gap: gapSize }, style]}
      accessible={true}
      accessibilityLabel={alt}
    >
      {shouldRenderIcon && (
        iconType === 'scissor' ? (
          <ScissorLiftLogoIcon
            size={iconSize}
            variant={useLightLogo ? 'light' : 'dark'}
            withArrow={withArrow}
          />
        ) : (
          <ReachBrandEmblem
            size={emblemSize}
            variant={useLightLogo ? 'light' : 'dark'}
          />
        )
      )}
      <View style={styles.textContainer}>
        {/* Brand Name Row */}
        <View style={styles.brandRow}>
          <Text
            style={[
              styles.reachText,
              { color: brandReachColor, fontSize: reachFontSize },
            ]}
          >
            REACH
          </Text>
          <Text
            style={[
              styles.internationalText,
              {
                color: brandInternationalColor,
                fontSize: internationalFontSize,
              },
            ]}
          >
            INTERNATIONAL
          </Text>
        </View>

        {/* Hairline Divider & Official "REACHING ALL HEIGHTS" Tagline */}
        {showTagline && effectiveLayoutVariant === 'full' && (
          <View style={styles.taglineContainer}>
            <View style={[styles.divider, { backgroundColor: dividerColor }]} />
            <Text
              style={[
                styles.taglineText,
                { color: taglineColor, fontSize: taglineFontSize },
              ]}
              numberOfLines={1}
            >
              REACHING ALL HEIGHTS
            </Text>
          </View>
        )}
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  compactContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  monogramBadge: {
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  monogramText: {
    fontWeight: '900',
    letterSpacing: -0.5,
  },
  emblemContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  textContainer: {
    justifyContent: 'center',
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  reachText: {
    fontWeight: '900',
    letterSpacing: -0.4,
    textTransform: 'uppercase',
  },
  internationalText: {
    fontWeight: '800',
    letterSpacing: -0.2,
    textTransform: 'uppercase',
  },
  taglineContainer: {
    marginTop: 1,
    width: '100%',
  },
  divider: {
    height: 1,
    width: '100%',
    borderRadius: 1,
    marginBottom: 2,
    marginTop: 2,
  },
  taglineText: {
    fontWeight: '600',
    letterSpacing: 2.0,
    textTransform: 'uppercase',
  },
});
