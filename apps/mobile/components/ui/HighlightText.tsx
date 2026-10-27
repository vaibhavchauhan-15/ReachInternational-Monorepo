import React from "react";
import type { StyleProp, TextStyle } from "react-native";
import { getSearchMatchSegments } from "@reachinternational/utils";
import type { TypeVariant } from "@reachinternational/design-tokens";
import { Text } from "./Text";

export interface HighlightTextProps {
  text: string | null | undefined;
  query: string | undefined;
  variant?: TypeVariant;
  weight?: 'normal' | 'medium' | 'semibold' | 'bold' | string;
  style?: StyleProp<TextStyle>;
  matchStyle?: StyleProp<TextStyle>;
  numberOfLines?: number;
}

/**
 * React Native text component that highlights matching search query terms.
 * Adheres to Vercel Geist design tokens: `#0070f3` blue text with zero background.
 */
export function HighlightText({
  text,
  query,
  variant = 'body',
  weight,
  style,
  matchStyle,
  numberOfLines,
}: HighlightTextProps) {
  const segments = getSearchMatchSegments(text, query);

  if (segments.length === 0) {
    return (
      <Text variant={variant} weight={weight} style={style as any} numberOfLines={numberOfLines}>
        {text ?? ""}
      </Text>
    );
  }

  return (
    <Text variant={variant} weight={weight} style={style as any} numberOfLines={numberOfLines}>
      {segments.map((seg, i) => (
        <Text
          key={i}
          variant={variant}
          weight={weight}
          style={[
            seg.isMatch ? { color: "#0070f3" } : null,
            seg.isMatch ? matchStyle : null,
          ] as any}
        >
          {seg.text}
        </Text>
      ))}
    </Text>
  );
}
