import React from 'react';
import { View, Text, StyleSheet, type ViewStyle } from 'react-native';
import Svg, { Rect, Circle, Path, Line } from 'react-native-svg';
import { useTheme } from '../ui/ThemeProvider';

export interface ScissorLiftLogoIconProps {
  size?: number;
  color?: string;
  style?: ViewStyle;
}

export function ScissorLiftLogoIcon({
  size = 32,
  color,
  style,
}: ScissorLiftLogoIconProps) {
  const { theme, isDark } = useTheme();
  const iconColor = color || (isDark ? '#ffffff' : theme.colors.ink);

  return (
    <View style={[{ width: size, height: size }, style]}>
      <Svg width={size} height={size} viewBox="0 0 100 100" fill="none">
        {/* Heavy Base Chassis */}
        <Rect x="16" y="82" width="68" height="6" rx="3" fill={iconColor} />
        <Circle cx="26" cy="91" r="4.5" fill={iconColor} />
        <Circle cx="74" cy="91" r="4.5" fill={iconColor} />

        {/* Hydraulic Base Mounts */}
        <Rect x="22" y="78" width="8" height="4" fill={iconColor} />
        <Rect x="70" y="78" width="8" height="4" fill={iconColor} />

        {/* Lower Scissor Level (Bottom X-Brace) */}
        <Path
          d="M26 82 L74 54"
          stroke={iconColor}
          strokeWidth="5"
          strokeLinecap="round"
        />
        <Path
          d="M74 82 L26 54"
          stroke={iconColor}
          strokeWidth="5"
          strokeLinecap="round"
        />
        <Circle cx="50" cy="68" r="3" fill={iconColor} />

        {/* Upper Scissor Level (Top X-Brace) */}
        <Path
          d="M26 54 L74 26"
          stroke={iconColor}
          strokeWidth="5"
          strokeLinecap="round"
        />
        <Path
          d="M74 54 L26 26"
          stroke={iconColor}
          strokeWidth="5"
          strokeLinecap="round"
        />
        <Circle cx="50" cy="40" r="3" fill={iconColor} />

        {/* Center Hydraulic Lift Cylinder */}
        <Line
          x1="50"
          y1="78"
          x2="50"
          y2="28"
          stroke={iconColor}
          strokeWidth="2.5"
          strokeDasharray="4 2"
          opacity={0.4}
        />

        {/* Upper Work Platform Deck */}
        <Rect x="14" y="20" width="72" height="6" rx="2" fill={iconColor} />

        {/* Safety Guardrails */}
        <Path
          d="M18 20 V8 H82 V20"
          stroke={iconColor}
          strokeWidth="3.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
        <Path d="M50 20 V8" stroke={iconColor} strokeWidth="2.5" />
      </Svg>
    </View>
  );
}

export interface ReachInternationalLogoProps {
  size?: number;
  showIcon?: boolean;
  showTagline?: boolean;
  style?: ViewStyle;
}

export function ReachInternationalLogo({
  size = 32,
  showIcon = true,
  showTagline = true,
  style,
}: ReachInternationalLogoProps) {
  const { theme, isDark } = useTheme();
  const iconSize = Math.max(26, Math.round(size * 1.1));

  const brandReachColor = isDark ? '#ffffff' : theme.colors.ink;
  const brandInternationalColor = '#0ea5e9';
  const taglineColor = isDark ? '#94a3b8' : '#64748b';
  const dividerColor = isDark ? 'rgba(255,255,255,0.18)' : 'rgba(0,0,0,0.12)';

  // Scale typography according to the requested size
  const reachFontSize = Math.round(size * 0.52);
  const internationalFontSize = Math.round(size * 0.52);
  const taglineFontSize = Math.max(7, Math.round(size * 0.25));

  return (
    <View style={[styles.container, style]}>
      {showIcon && <ScissorLiftLogoIcon size={iconSize} />}
      <View style={styles.textContainer}>
        {/* Brand Name Row */}
        <View style={styles.brandRow}>
          <Text style={[styles.reachText, { color: brandReachColor, fontSize: reachFontSize }]}>
            REACH
          </Text>
          <Text
            style={[
              styles.internationalText,
              { color: brandInternationalColor, fontSize: internationalFontSize },
            ]}
          >
            INTERNATIONAL
          </Text>
        </View>

        {/* Divider & Tagline */}
        {showTagline && (
          <View style={styles.taglineContainer}>
            <View style={[styles.divider, { backgroundColor: dividerColor }]} />
            <Text
              style={[
                styles.taglineText,
                { color: taglineColor, fontSize: taglineFontSize },
              ]}
            >
              REACHING ALL HEIGHTS
            </Text>
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  textContainer: {
    justifyContent: 'center',
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  reachText: {
    fontWeight: '900',
    letterSpacing: -0.3,
  },
  internationalText: {
    fontWeight: '800',
    letterSpacing: -0.2,
  },
  taglineContainer: {
    marginTop: 3,
    width: '100%',
  },
  divider: {
    height: 1,
    width: '100%',
    borderRadius: 1,
    marginBottom: 2,
  },
  taglineText: {
    fontWeight: '600',
    letterSpacing: 1.5,
  },
});
