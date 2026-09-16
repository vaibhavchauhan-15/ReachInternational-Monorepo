import React from "react";
import { Text, type StyleProp, type TextStyle } from "react-native";
import { getSearchMatchSegments } from "@reachinternational/utils";

export interface HighlightTextProps {
  text: string | null | undefined;
  query: string | undefined;
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
  style,
  matchStyle,
  numberOfLines,
}: HighlightTextProps) {
  const segments = getSearchMatchSegments(text, query);

  if (segments.length === 0) {
    return (
      <Text style={style} numberOfLines={numberOfLines}>
        {text ?? ""}
      </Text>
    );
  }

  return (
    <Text style={style} numberOfLines={numberOfLines}>
      {segments.map((seg, i) => (
        <Text
          key={i}
          style={[
            seg.isMatch ? { color: "#0070f3", fontWeight: "600" } : null,
            seg.isMatch ? matchStyle : null,
          ]}
        >
          {seg.text}
        </Text>
      ))}
    </Text>
  );
}
