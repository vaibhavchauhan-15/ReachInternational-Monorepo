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
    if (columns === 2) {
      effectiveCols = 2;
    } else if (columns === 3) {
      effectiveCols = 3;
    } else if (columns === 5 && width >= 768) {
      effectiveCols = 5;
    } else if (columns === 6 && width >= 860) {
      effectiveCols = 6;
    } else {
      effectiveCols = Math.min(columns, 4);
    }
  } else {
    effectiveCols = Math.min(columns, 2);
  }

  const validChildren = React.Children.toArray(children).filter(Boolean);

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
        {validChildren.map((child, index) => (
          <View
            key={index}
            style={{
              height: '100%',
              minWidth: 0,
              minHeight: 104,
              display: 'flex' as any,
              flexDirection: 'column' as any,
            }}
          >
            {child}
          </View>
        ))}
      </View>
    );
  }

  // Native iOS / Android: flex wrapping with explicit percentage width per item
  const itemPercent =
    effectiveCols === 1
      ? '100%'
      : effectiveCols === 3
      ? '31.5%'
      : effectiveCols === 4
      ? '23.2%'
      : effectiveCols === 5
      ? '18.2%'
      : effectiveCols === 6
      ? '14.9%'
      : '48.5%';

  return (
    <View style={[styles.nativeGrid, style]}>
      {validChildren.map((child, index) => (
        <View key={index} style={{ width: itemPercent, minHeight: 104 }}>
          {child}
        </View>
      ))}
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
