/**
 * ReachInternational Mobile — Canonical Reusable SearchInput
 *
 * Provides a clean, polished search input adhering to Vercel Geist design tokens:
 * - Edge border highlighting on focus: #0284c7 (brand blue) / #38bdf8 (dark mode)
 * - Seamless inner TextInput with zero border, zero browser inset outlines, zero background bleed
 * - Responsive 36px / 38px / 44px touch-friendly height with crisp hairline borders
 * - Built-in Search icon and animated/interactive clear 'X' button
 * - Cross-platform parity across iOS, Android, and Web
 */

import React, { useState, useRef } from 'react';
import {
  View,
  TextInput,
  StyleSheet,
  ActivityIndicator,
  Platform,
  type TextInputProps,
  type ViewStyle,
  type TextStyle,
  type StyleProp,
} from 'react-native';
import { Search, X } from './icon';
import { useTheme } from './ThemeProvider';
import { radiusNumeric, type TypeVariant } from '@reachinternational/design-tokens';
import { useTypeStyle } from './Text';
import { haptics } from '../../lib/haptics';
import { Pressable } from './touch/Pressable';

export interface SearchInputProps extends Omit<TextInputProps, 'style'> {
  value: string;
  onChangeText: (text: string) => void;
  onClear?: () => void;
  placeholder?: string;
  placeholderTextColor?: string;
  isLoading?: boolean;
  autoFocus?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  containerStyle?: StyleProp<ViewStyle>;
  inputStyle?: StyleProp<TextStyle>;
  textVariant?: TypeVariant;
  variant?: 'default' | 'pill' | 'rounded';
  size?: 'sm' | 'md' | 'lg';
  name?: string;
  id?: string;
}

export const SearchInput = React.forwardRef<TextInput, SearchInputProps>(({
  value,
  onChangeText,
  onClear,
  placeholder = 'Search...',
  placeholderTextColor,
  isLoading = false,
  autoFocus = false,
  leftIcon,
  rightIcon,
  containerStyle,
  inputStyle,
  textVariant,
  variant = 'default',
  size = 'md',
  onFocus,
  onBlur,
  ...restProps
}, ref) => {
  const { theme, isDark } = useTheme();
  const [isFocused, setIsFocused] = useState(false);
  const inputRef = useRef<TextInput>(null);

  const textVariantResolved: TypeVariant = textVariant || (size === 'lg' ? 'body' : 'caption');
  const typeStyleObj = useTypeStyle(textVariantResolved);

  React.useImperativeHandle(ref, () => inputRef.current as TextInput);

  const handleFocus = (e: any) => {
    setIsFocused(true);
    if (onFocus) onFocus(e);
  };

  const handleBlur = (e: any) => {
    setIsFocused(false);
    if (onBlur) onBlur(e);
  };

  const handleClear = () => {
    haptics.select();
    onChangeText('');
    if (onClear) onClear();
    inputRef.current?.focus();
  };

  const activeBorderColor = isDark ? '#38bdf8' : '#0284c7';
  const inactiveBorderColor = theme.colors.hairline;
  const effectiveBorderColor = isFocused ? activeBorderColor : inactiveBorderColor;

  const height = size === 'sm' ? 34 : size === 'lg' ? 44 : 36;
  const borderRadius = variant === 'pill' ? radiusNumeric.full : radiusNumeric.lg;

  const isFlexLayout = React.useMemo(() => {
    if (!containerStyle) return false;
    const flat = StyleSheet.flatten(containerStyle);
    return flat != null && (flat.flex !== undefined || flat.flexGrow !== undefined);
  }, [containerStyle]);

  return (
    <View
      style={[
        styles.container,
        isFlexLayout ? styles.flexContainer : styles.fullWidthContainer,
        {
          height,
          borderRadius,
          backgroundColor: theme.colors.canvas,
          borderColor: effectiveBorderColor,
          borderWidth: isFocused ? 1.5 : 1,
        },
        isFocused &&
          Platform.OS === 'web' &&
          ({
            boxShadow: isDark
              ? '0 0 0 1px rgba(56, 189, 248, 0.35)'
              : '0 0 0 1px rgba(2, 132, 199, 0.25)',
          } as any),
        containerStyle,
      ]}
    >
      {/* Left Search Icon or Loading Spinner */}
      <View style={styles.leftIconWrapper}>
        {isLoading ? (
          <ActivityIndicator
            size="small"
            color={isDark ? '#38bdf8' : '#0284c7'}
          />
        ) : leftIcon ? (
          leftIcon
        ) : (
          <Search
            size={14}
            color={isFocused ? (isDark ? '#38bdf8' : '#0284c7') : theme.colors.mute}
          />
        )}
      </View>

      {/* Borderless Inner TextInput */}
      <TextInput
        ref={inputRef}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={placeholderTextColor || theme.colors.mute}
        autoFocus={autoFocus}
        onFocus={handleFocus}
        onBlur={handleBlur}
        {...restProps}
        autoComplete={Platform.OS === 'web' ? ('one-time-code' as any) : 'off'}
        textContentType="none"
        importantForAutofill="no"
        autoCorrect={false}
        spellCheck={false}
        inputMode="search"
        aria-autocomplete="none"
        {...(Platform.OS === 'web'
          ? {
              name: (restProps as any).name || 'search_filter_query',
              id: (restProps as any).id || (restProps as any).name || 'search_filter_query',
              dataSet: {
                lpignore: 'true',
                '1p-ignore': 'true',
                formType: 'other',
                ...((restProps as any).dataSet || {}),
              },
            }
          : {})}
        style={[
          styles.input,
          typeStyleObj,
          {
            color: theme.colors.ink,
          },
          inputStyle,
        ]}
      />

      {/* Clear Button or Custom Right Icon */}
      {value.length > 0 ? (
        <Pressable
          variant="plain"
          haptic={false}
          onPress={handleClear}
          hitSlopToMin48={true}
          accessibilityLabel="Clear search input"
          style={styles.clearBtn}
        >
          <X size={13} color={theme.colors.mute} />
        </Pressable>
      ) : rightIcon ? (
        rightIcon
      ) : null}
    </View>
  );
});

SearchInput.displayName = 'SearchInput';

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    gap: 8,
    minWidth: 0,
    ...Platform.select({
      web: {
        transition: 'border-color 0.15s ease, box-shadow 0.15s ease',
      } as any,
    }),
  },
  fullWidthContainer: {
    width: '100%',
  },
  flexContainer: {
    flex: 1,
    minWidth: 0,
    flexShrink: 1,
  },
  leftIconWrapper: {
    flexShrink: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  input: {
    flex: 1,
    minWidth: 0,
    height: '100%',
    paddingVertical: 0,
    paddingHorizontal: 0,
    backgroundColor: 'transparent',
    borderWidth: 0,
    ...Platform.select({
      web: {
        outlineStyle: 'none',
      } as any,
    }),
  },
  clearBtn: {
    padding: 2,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
});
