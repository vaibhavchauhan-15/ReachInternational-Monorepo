/**
 * ReachInternational Mobile — React Native Reusables Text Component
 * Official RNR Text primitive powered by @rn-primitives/slot and Geist typography.
 */

import * as Slot from '@rn-primitives/slot';
import type { SlottableTextProps, TextRef } from '@rn-primitives/types';
import { cva, type VariantProps } from 'class-variance-authority';
import * as React from 'react';
import { Text as RNText, type StyleProp, type TextStyle } from 'react-native';
import { cn } from '@/lib/utils';
import { TYPE_VARIANTS, scaled, type TypeVariant } from '@reachinternational/design-tokens';
import { useTypeScale } from '../../lib/typography/TypeScaleProvider';

const TextClassContext = React.createContext<string | undefined>(undefined);

const textVariants = cva('text-foreground web:select-text', {
  variants: {
    variant: {
      default: 'text-base font-normal',
      h1: 'text-4xl font-extrabold tracking-tight',
      h2: 'text-3xl font-semibold tracking-tight',
      h3: 'text-2xl font-semibold tracking-tight',
      h4: 'text-xl font-semibold tracking-tight',
      p: 'text-base leading-7',
      lead: 'text-xl text-muted-foreground',
      large: 'text-lg font-semibold',
      small: 'text-sm font-medium leading-none',
      muted: 'text-sm text-muted-foreground',
      // Reach tokens variants (sizes & line heights dynamically controlled by dynamicTypeStyle)
      hero: 'font-bold',
      display: 'font-bold',
      title: 'font-semibold',
      heading: 'font-semibold',
      subheading: 'font-medium text-muted-foreground',
      body: 'font-normal',
      label: 'font-medium',
      caption: 'text-muted-foreground',
      micro: 'text-muted-foreground',
      mono: 'font-mono',
    },
  },
  defaultVariants: {
    variant: 'default',
  },
});

const cache = new Map<string, TextStyle>();

export function typeStyle(variant: TypeVariant, scale: number): TextStyle {
  const key = `${variant}@${scale}`;
  let s = cache.get(key);
  if (!s) {
    const t = TYPE_VARIANTS[variant];
    if (t) {
      s = { fontFamily: t.font, fontSize: scaled(t.size, scale), lineHeight: scaled(t.line, scale) };
      cache.set(key, s);
    } else {
      s = {};
    }
  }
  return s;
}

export const useTypeStyle = (variant: TypeVariant) => {
  try {
    const { scale } = useTypeScale();
    return typeStyle(variant, scale);
  } catch {
    return typeStyle(variant, 1);
  }
};

type Banned = 'fontSize' | 'fontFamily' | 'fontWeight' | 'fontStyle' | 'lineHeight' | 'letterSpacing';

export type TextProps = SlottableTextProps & {
  className?: string;
  weight?: 'normal' | 'medium' | 'semibold' | 'bold' | string;
  variant?:
    | 'default'
    | 'h1'
    | 'h2'
    | 'h3'
    | 'h4'
    | 'p'
    | 'lead'
    | 'large'
    | 'small'
    | 'muted'
    | TypeVariant;
  style?: StyleProp<Omit<TextStyle, Banned> | TextStyle>;
};

const Text = React.forwardRef<TextRef, TextProps>(
  ({ className, asChild = false, variant = 'default', weight, style, ...props }, ref) => {
    const textClass = React.useContext(TextClassContext);
    const Component = asChild ? Slot.Text : RNText;

    let dynamicTypeStyle: TextStyle | undefined;
    if (variant && variant in TYPE_VARIANTS) {
      try {
        const { scale } = useTypeScale();
        dynamicTypeStyle = { ...typeStyle(variant as TypeVariant, scale) };
      } catch {
        dynamicTypeStyle = { ...typeStyle(variant as TypeVariant, 1) };
      }
    }

    if (weight) {
      const weightFont =
        weight === 'bold'
          ? 'Geist-Bold'
          : weight === 'semibold'
          ? 'Geist-SemiBold'
          : weight === 'medium'
          ? 'Geist-Medium'
          : 'Geist-Regular';
      dynamicTypeStyle = { ...dynamicTypeStyle, fontFamily: weightFont };
    }

    const matchedVariant =
      variant && (variant in TYPE_VARIANTS || ['default', 'h1', 'h2', 'h3', 'h4', 'p', 'lead', 'large', 'small', 'muted'].includes(variant))
        ? (variant as any)
        : 'default';

    return (
      <Component
        ref={ref}
        className={cn(textVariants({ variant: matchedVariant }), textClass, className)}
        style={[dynamicTypeStyle, style]}
        {...props}
      />
    );
  }
);

Text.displayName = 'Text';

export { Text, TextClassContext, textVariants };
export default Text;
