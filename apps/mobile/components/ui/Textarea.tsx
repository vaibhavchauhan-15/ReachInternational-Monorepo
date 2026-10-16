import { cn } from '@/lib/utils';
import * as React from 'react';
import { Platform, TextInput } from 'react-native';

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
      ...props
    },
    ref
  ) => {
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
          'text-foreground border-input dark:bg-input/20 flex min-h-20 w-full flex-row rounded-lg border bg-background px-3 py-2 text-base shadow-sm shadow-black/5 md:text-sm',
          Platform.select({
            web: 'placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring/50 outline-none focus-visible:ring-[2px] disabled:cursor-not-allowed',
          }),
          props.editable === false && 'opacity-50',
          className
        )}
        placeholderTextColor="#9ca3af"
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
