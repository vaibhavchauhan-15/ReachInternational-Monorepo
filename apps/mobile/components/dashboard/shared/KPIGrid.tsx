import React from 'react';
import { View, StyleSheet, useWindowDimensions, Platform } from 'react-native';
import { spacingNumeric } from '@reachinternational/design-tokens';

export interface KPIGridProps {
  children: React.ReactNode;
  columns?: 1 | 2 | 3 | 4 | 5 | 6;
  style?: any;
}

export const KPIGrid: React.FC<KPIGridProps> = ({ children, columns = 4, style }) => {
  const { width } = useWindowDimensions();
  const isTablet = width > 640 && width < 1024;
  const isDesktop = width >= 1024;

  let effectiveCols = 2;
  if (columns === 1) {
    effectiveCols = 1;
  } else if (isDesktop) {
    effectiveCols = columns;
  } else if (isTablet) {
    effectiveCols = Math.min(columns, 4);
  } else {
    effectiveCols = Math.min(columns, 2);
  }

  if (Platform.OS === 'web') {
    return (
      <View
        style={[
          {
            display: 'grid' as any,
            gridTemplateColumns: `repeat(${effectiveCols}, minmax(0, 1fr))` as any,
            gap: spacingNumeric.sm,
            width: '100%',
          },
          style,
        ]}
      >
        {children}
      </View>
    );
  }

  // Native iOS / Android: flex wrapping with explicit percentage width per item
  const itemPercent =
    effectiveCols === 1
      ? '100%'
      : effectiveCols === 3
      ? '31%'
      : effectiveCols === 4
      ? '23%'
      : effectiveCols === 5
      ? '18%'
      : effectiveCols === 6
      ? '15%'
      : '48.5%';

  return (
    <View style={[styles.nativeGrid, style]}>
      {React.Children.map(children, (child) => {
        if (!child) return null;
        return (
          <View style={{ width: itemPercent, minHeight: 92 }}>
            {child}
          </View>
        );
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  nativeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacingNumeric.sm,
    width: '100%',
  },
});
