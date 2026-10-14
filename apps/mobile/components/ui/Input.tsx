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
import { Text } from '@/components/ui/Text';

export interface InputProps extends TextInputProps {
  className?: string;
  containerClassName?: string;
  label?: string;
  required?: boolean;
  error?: string;
  helperText?: string;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  isPassword?: boolean;
  containerStyle?: StyleProp<ViewStyle>;
  name?: string;
  id?: string;
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
      ...props
    },
    ref
  ) => {
    const [isPasswordVisible, setIsPasswordVisible] = React.useState(false);

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

    return (
      <View style={containerStyle} className={cn('w-full', label && 'mb-3', containerClassName)}>
        {label && (
          <View className="flex-row items-center mb-1.5">
            <Text variant="label" className="text-foreground">
              {label}
            </Text>
            {required && <Text variant="label" className="text-destructive ml-1">*</Text>}
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
            aria-autocomplete="none"
            {...webSecurityProps}
            className={cn(
              'web:flex h-11 native:h-12 w-full rounded-xl border border-input bg-background px-3.5 text-base text-foreground file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground web:focus-visible:outline-none web:focus-visible:ring-2 web:focus-visible:ring-ring web:focus-visible:ring-offset-2',
              leftIcon && 'pl-10',
              (rightIcon || isPassword) && 'pr-10',
              error && 'border-destructive',
              props.editable === false && 'opacity-50 web:cursor-not-allowed',
              className
            )}
            placeholderClassName={cn('text-muted-foreground', placeholderClassName)}
            style={style}
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
                <EyeOff size={18} className="text-muted-foreground" color="#888888" />
              ) : (
                <Eye size={18} className="text-muted-foreground" color="#888888" />
              )}
            </Pressable>
          ) : rightIcon ? (
            <View className="absolute right-3 z-10 items-center justify-center" style={{ zIndex: 10 }}>
              {rightIcon}
            </View>
          ) : null}
        </View>
        {error ? (
          <Text variant="caption" className="text-destructive mt-1 font-medium">{error}</Text>
        ) : helperText ? (
          <Text variant="caption" className="text-muted-foreground mt-1">{helperText}</Text>
        ) : null}
      </View>
    );
  }
);

Input.displayName = 'Input';

export { Input };
export default Input;
