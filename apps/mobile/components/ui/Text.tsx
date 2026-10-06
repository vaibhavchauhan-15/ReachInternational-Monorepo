import React from 'react';
import { Text as RNText, type StyleProp, type TextProps as RNTextProps, type TextStyle } from 'react-native';
import { TYPE_VARIANTS, scaled, type TypeVariant } from '@reachinternational/design-tokens';
import { useTypeScale } from '../../lib/typography/TypeScaleProvider';

// Compile error if anyone passes these in `style`.
type Banned = 'fontSize' | 'fontFamily' | 'fontWeight' | 'fontStyle' | 'lineHeight' | 'letterSpacing';

export type TextProps = Omit<RNTextProps, 'style' | 'allowFontScaling'> & {
  variant?: TypeVariant;
  style?: StyleProp<Omit<TextStyle, Banned>>;
};

const cache = new Map<string, TextStyle>();

export function typeStyle(variant: TypeVariant, scale: number): TextStyle {
  const key = `${variant}@${scale}`;
  let s = cache.get(key);
  if (!s) {
    const t = TYPE_VARIANTS[variant];
    s = { fontFamily: t.font, fontSize: scaled(t.size, scale), lineHeight: scaled(t.line, scale) };
    cache.set(key, s);
  }
  return s;
}

/** For non-Text consumers: TextInput, Stack headerTitleStyle, tab labels, toasts. */
export const useTypeStyle = (variant: TypeVariant) => typeStyle(variant, useTypeScale().scale);

export function Text({ variant = 'body', style, ...rest }: TextProps) {
  const { scale } = useTypeScale();
  // Typography is applied LAST so nothing can override it.
  return <RNText allowFontScaling={false} style={[style, typeStyle(variant, scale)]} {...rest} />;
}
