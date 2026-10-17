/**
 * ReachInternational Mobile — Reusable Transparent Long Logo Component
 * 
 * Centralized, authoritative brand long logo component for Reach International.
 * Supports light and dark theme assets with pixel-perfect 2:1 aspect ratio.
 * 
 * Assets:
 * - Light Theme: assets/Reach International Light Theme LongLogo.png
 * - Dark Theme:  assets/Reach International Dark Theme LongLogo.png
 */

import React, { memo } from 'react';
import {
  Image,
  View,
  StyleSheet,
  type StyleProp,
  type ImageStyle,
  type ViewStyle,
} from 'react-native';
import { useTheme } from '../ui/ThemeProvider';

export type LongLogoThemeVariant = 'auto' | 'light' | 'dark';

export interface ReachLongLogoProps {
  /** Width in density-independent pixels. Height auto-computes to width / 2 if omitted. */
  width?: number;
  /** Height in density-independent pixels. Width auto-computes to height * 2 if omitted. */
  height?: number;
  /** Explicit theme override; defaults to 'auto' (tracks active app theme). */
  themeVariant?: LongLogoThemeVariant;
  /** Optional style override passed directly to the Image primitive. */
  style?: StyleProp<ImageStyle>;
  /** Optional style override passed to the wrapping View container. */
  containerStyle?: StyleProp<ViewStyle>;
  /** Image resizing strategy; defaults to 'contain'. */
  resizeMode?: 'contain' | 'cover' | 'stretch' | 'center';
  /** Accessibility text description for screen readers. */
  alt?: string;
  /** Testing identifier for automated QA suites. */
  testID?: string;
}

const lightLogoAsset = require('../../assets/Reach International Light Theme LongLogo.png');
const darkLogoAsset = require('../../assets/Reach International Dark Theme LongLogo.png');

export const ReachLongLogo = memo(function ReachLongLogo({
  width,
  height,
  themeVariant = 'auto',
  style,
  containerStyle,
  resizeMode = 'contain',
  alt = 'Reach International — Reaching All Heights',
  testID = 'reach-long-logo',
}: ReachLongLogoProps) {
  const { isDark } = useTheme();

  // Determine whether to show the dark-theme logo or light-theme logo
  const useDarkAsset =
    themeVariant === 'dark' ? true : themeVariant === 'light' ? false : isDark;

  const imageSource = useDarkAsset ? darkLogoAsset : lightLogoAsset;

  // Authentic 2:1 aspect ratio calculation (1774 x 887 px)
  const defaultHeight = height || (width ? Math.round(width / 2) : 70);
  const defaultWidth = width || Math.round(defaultHeight * 2);

  return (
    <View
      style={[
        styles.container,
        { width: defaultWidth, height: defaultHeight },
        containerStyle,
      ]}
      testID={testID}
      accessible={true}
      accessibilityRole="image"
      accessibilityLabel={alt}
    >
      <Image
        source={imageSource}
        style={[
          {
            width: defaultWidth,
            height: defaultHeight,
          },
          style,
        ]}
        resizeMode={resizeMode}
      />
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
