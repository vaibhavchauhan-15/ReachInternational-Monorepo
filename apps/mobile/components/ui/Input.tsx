/**
 * ReachInternational Mobile — React Native Reusables Input Component
 * Official RNR Input primitive with NativeWind styling, accessible labels and error messages.
 */

import * as React from 'react';
import {
  TextInput,
  type TextInputProps,
  View,
  Pressable,
  Platform,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { cn } from '@/lib/utils';
import { Eye, EyeOff } from 'lucide-react-native';
import { Text, useTypeStyle } from '@/components/ui/Text';
import { useTheme } from '@/components/ui/ThemeProvider';
import { radiusNumeric } from '@reachinternational/design-tokens';

export interface InputProps extends TextInputProps {
  className?: string;
  containerClassName?: string;
  placeholderClassName?: string;
  label?: string | React.ReactNode;
  required?: boolean;
  error?: string | boolean;
  helperText?: string;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  isPassword?: boolean;
  containerStyle?: StyleProp<ViewStyle>;
  name?: string;
  id?: string;
  focusBorderColor?: string;
}

const Input = React.forwardRef<React.ElementRef<typeof TextInput>, InputProps>(
  (
    {
      className,
      containerClassName,
      placeholderClassName,
      label,
      required = false,
      error,
      helperText,
      leftIcon,
      rightIcon,
      isPassword = false,
      secureTextEntry,
      containerStyle,
      style,
      autoComplete,
      textContentType,
      importantForAutofill,
      autoCorrect,
      spellCheck,
      keyboardType,
      inputMode,
      focusBorderColor,
      placeholderTextColor,
      onFocus,
      onBlur,
      ...props
    },
    ref
  ) => {
    const { theme, isDark } = useTheme();
    const bodyStyle = useTypeStyle('body');
    const [isPasswordVisible, setIsPasswordVisible] = React.useState(false);
    const [isFocused, setIsFocused] = React.useState(false);

    const handleFocus = React.useCallback(
      (e: any) => {
        setIsFocused(true);
        onFocus?.(e);
      },
      [onFocus]
    );

    const handleBlur = React.useCallback(
      (e: any) => {
        setIsFocused(false);
        onBlur?.(e);
      },
      [onBlur]
    );

    const actualSecureTextEntry = isPassword
      ? !isPasswordVisible
      : secureTextEntry;

    // Default autofill / autocomplete to safe non-credential behavior monorepo-wide
    // Passwords default to current-password; non-passwords strictly default to 'one-time-code' on web (bypasses Chrome credential autofill) and 'off' on native
    const effectiveAutoComplete = isPassword
      ? (autoComplete ?? 'current-password')
      : (Platform.OS === 'web'
          ? (autoComplete && autoComplete !== 'off' ? autoComplete : ('one-time-code' as any))
          : (autoComplete ?? 'off'));

    const effectiveTextContentType = isPassword
      ? (textContentType ?? 'password')
      : (textContentType ?? 'none');

    const effectiveImportantForAutofill = isPassword
      ? (importantForAutofill ?? 'yes')
      : (importantForAutofill ?? 'no');

    const effectiveAutoCorrect = autoCorrect ?? false;
    const effectiveSpellCheck = spellCheck ?? false;

    // Automatically infer inputMode from keyboardType when not explicitly provided
    const effectiveInputMode = inputMode ?? (
      keyboardType === 'decimal-pad' ? 'decimal' :
      keyboardType === 'numeric' || keyboardType === 'number-pad' ? 'numeric' :
      keyboardType === 'email-address' ? 'email' :
      keyboardType === 'phone-pad' ? 'tel' :
      keyboardType === 'url' ? 'url' :
      undefined
    );

    const webSecurityProps = Platform.OS === 'web' && !isPassword && effectiveAutoComplete !== 'email'
      ? {
          name: (props as any).name || 'custom_input_field',
          id: (props as any).id || (props as any).name || 'custom_input_field',
          dataSet: {
            lpignore: 'true',
            '1p-ignore': 'true',
            formType: 'other',
            ...((props as any).dataSet || {}),
          },
        }
      : {};

    const hasError = Boolean(error);
    const errorMessage = typeof error === 'string' && error.trim().length > 0 ? error : undefined;

    const activeBorderColor = hasError
      ? '#ef4444'
      : (focusBorderColor || (isDark ? '#0ea5e9' : '#0284c7'));

    const inactiveBorderColor = hasError
      ? (isDark ? '#f87171' : '#ee0000')
      : (isDark ? '#262626' : '#ebebeb');

    const effectiveBorderColor = isFocused ? activeBorderColor : inactiveBorderColor;
    const inputBackgroundColor = isDark ? '#141414' : '#fafafa';
    const inputTextColor = theme.colors.ink;
    const effectivePlaceholderColor = placeholderTextColor || (isDark ? '#737373' : '#8f8f8f');

    const resolvedInputStyle = React.useMemo(() => {
      const baseStyle: any = {
        backgroundColor: inputBackgroundColor,
        color: inputTextColor,
        borderColor: effectiveBorderColor,
        borderWidth: 1,
        borderRadius: radiusNumeric.md,
        minHeight: 44,
        paddingHorizontal: 14,
        ...(leftIcon ? { paddingLeft: 40 } : {}),
        ...(rightIcon || isPassword ? { paddingRight: 40 } : {}),
        ...(props.editable === false ? { opacity: 0.6, backgroundColor: isDark ? '#1a1a1a' : '#f5f5f5' } : {}),
      };

      if (Platform.OS === 'web') {
        baseStyle.outlineStyle = 'none';
        baseStyle.outline = 'none';
        if (isFocused) {
          baseStyle.boxShadow = `0 0 0 1px ${activeBorderColor}`;
        }
      }

      return [baseStyle, bodyStyle, style];
    }, [
      inputBackgroundColor,
      inputTextColor,
      effectiveBorderColor,
      leftIcon,
      rightIcon,
      isPassword,
      props.editable,
      isDark,
      isFocused,
      activeBorderColor,
      bodyStyle,
      style,
    ]);

    return (
      <View style={containerStyle} className={cn('w-full', label && 'mb-3', containerClassName)}>
        {label && (
          <View className="flex-row items-center mb-1.5" style={{ marginBottom: 6 }}>
            {typeof label === 'string' ? (
              <Text
                variant="label"
                weight="medium"
                style={{ color: isDark ? '#fafafa' : '#171717' }}
              >
                {required ? label.replace(/\s*\*+$/, '') : label}
              </Text>
            ) : (
              label
            )}
            {required && (
              <Text
                variant="label"
                weight="semibold"
                style={{ color: isDark ? '#f87171' : '#ee0000', marginLeft: 4 }}
              >
                *
              </Text>
            )}
          </View>
        )}
        <View className="relative flex-row items-center w-full">
          {leftIcon && (
            <View className="absolute left-3 z-10 items-center justify-center pointer-events-none">
              {leftIcon}
            </View>
          )}
          <TextInput
            ref={ref}
            secureTextEntry={actualSecureTextEntry}
            autoComplete={effectiveAutoComplete}
            textContentType={effectiveTextContentType}
            importantForAutofill={effectiveImportantForAutofill}
            autoCorrect={effectiveAutoCorrect}
            spellCheck={effectiveSpellCheck}
            keyboardType={keyboardType}
            inputMode={effectiveInputMode}
            placeholderTextColor={effectivePlaceholderColor}
            aria-autocomplete="none"
            onFocus={handleFocus}
            onBlur={handleBlur}
            {...webSecurityProps}
            className={cn(
              'web:flex h-11 native:h-12 w-full rounded-xl border px-3.5 text-base file:border-0 file:bg-transparent file:text-sm file:font-medium web:outline-none web:focus:outline-none web:focus-visible:outline-none web:transition-[border-color,box-shadow] web:duration-150',
              leftIcon && 'pl-10',
              (rightIcon || isPassword) && 'pr-10',
              hasError && 'border-destructive',
              props.editable === false && 'opacity-50 web:cursor-not-allowed',
              className
            )}
            placeholderClassName={cn('text-muted-foreground', placeholderClassName)}
            style={resolvedInputStyle}
            {...props}
          />
          {isPassword ? (
            <Pressable
              onPress={() => setIsPasswordVisible((prev) => !prev)}
              className="absolute right-3 z-10 items-center justify-center p-1"
              style={{ zIndex: 10, minWidth: 44, minHeight: 44 }}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              accessibilityRole="button"
              accessibilityLabel={isPasswordVisible ? 'Hide password' : 'Show password'}
            >
              {isPasswordVisible ? (
                <EyeOff size={18} color={isDark ? '#9ca3af' : '#888888'} />
              ) : (
                <Eye size={18} color={isDark ? '#9ca3af' : '#888888'} />
              )}
            </Pressable>
          ) : rightIcon ? (
            <View className="absolute right-3 z-10 items-center justify-center" style={{ zIndex: 10 }}>
              {rightIcon}
            </View>
          ) : null}
        </View>
        {errorMessage ? (
          <Text
            variant="caption"
            weight="medium"
            style={{ color: isDark ? '#f87171' : '#ee0000', marginTop: 4 }}
          >
            {errorMessage}
          </Text>
        ) : helperText ? (
          <Text
            variant="caption"
            style={{ color: isDark ? '#a1a1aa' : '#737373', marginTop: 4 }}
          >
            {helperText}
          </Text>
        ) : null}
      </View>
    );
  }
);

Input.displayName = 'Input';

export { Input };
export default Input;
