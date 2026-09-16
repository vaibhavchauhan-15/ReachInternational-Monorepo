"use client";

import React from "react";
import { getSearchMatchSegments } from "@reachinternational/utils";

export interface HighlightProps {
  text: string | null | undefined;
  query: string | undefined;
  className?: string;
  matchClassName?: string;
  as?: React.ElementType;
}

/**
 * Return a ReactNode that wraps matched search terms in a styled <span> element.
 * Adheres strictly to Geist design tokens: `#0070f3` text, zero background color.
 */
export function highlightText(
  text: string | null | undefined,
  query: string | undefined,
  matchClassName = "text-[#0070f3] dark:text-[#3291ff] font-semibold"
): React.ReactNode {
  const segments = getSearchMatchSegments(text, query);

  if (segments.length === 0) return text ?? "";
  if (segments.length === 1 && !segments[0].isMatch) return segments[0].text;

  return React.createElement(
    React.Fragment,
    null,
    ...segments.map((seg, i) =>
      seg.isMatch
        ? React.createElement("span", { key: i, className: matchClassName }, seg.text)
        : seg.text
    )
  );
}

/**
 * Reusable React component for highlighting search query terms inside any text string.
 */
export function Highlight({
  text,
  query,
  className = "",
  matchClassName = "text-[#0070f3] dark:text-[#3291ff] font-semibold",
  as: Component = "span",
}: HighlightProps) {
  const content = highlightText(text, query, matchClassName);
  return <Component className={className}>{content}</Component>;
}
