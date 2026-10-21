import { cn } from '@/lib/utils';
import * as React from 'react';
import { Platform, TextInput } from 'react-native';
import { useTheme } from './ThemeProvider';
import { useTypeStyle } from './Text';
import { radiusNumeric } from '@reachinternational/design-tokens';

export type TextareaProps = React.ComponentPropsWithoutRef<typeof TextInput> & {
  placeholderClassName?: string;
};

const Textarea = React.forwardRef<React.ElementRef<typeof TextInput>, TextareaProps>(
  (
    {
      className,
      multiline = true,
      numberOfLines = Platform.select({ web: 3, native: 4 }),
      placeholderClassName,
      autoComplete = 'off',
      textContentType = 'none',
      importantForAutofill = 'no',
      autoCorrect = false,
      spellCheck = false,
      placeholderTextColor,
      style,
      ...props
    },
    ref
  ) => {
    const { theme, isDark } = useTheme();
    const bodyStyle = useTypeStyle('body');

    return (
      <TextInput
        ref={ref}
        autoComplete={autoComplete}
        textContentType={textContentType}
        importantForAutofill={importantForAutofill}
        autoCorrect={autoCorrect}
        spellCheck={spellCheck}
        aria-autocomplete="none"
        className={cn(
          'flex min-h-20 w-full flex-row rounded-lg border px-3 py-2 text-base shadow-sm shadow-black/5 md:text-sm',
          Platform.select({
            web: 'outline-none focus:outline-none focus-visible:outline-none disabled:cursor-not-allowed',
          }),
          props.editable === false && 'opacity-50',
          className
        )}
        style={[
          {
            backgroundColor: isDark ? '#141414' : '#ffffff',
            color: isDark ? '#fafafa' : '#171717',
            borderColor: isDark ? '#262626' : '#ebebeb',
            borderWidth: 1,
            borderRadius: radiusNumeric.md,
          },
          bodyStyle,
          Platform.OS === 'web' ? ({ outlineStyle: 'none' } as any) : null,
          style,
        ]}
        placeholderTextColor={placeholderTextColor || (isDark ? '#737373' : '#8f8f8f')}
        multiline={multiline}
        numberOfLines={numberOfLines}
        textAlignVertical="top"
        {...props}
      />
    );
  }
);

Textarea.displayName = 'Textarea';

export { Textarea };
