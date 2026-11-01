import React from 'react';

interface SplitWordsProps {
  text: string;
  className?: string;
  wordClassName?: string;
}

/**
 * Server Component that splits text into individual words while preserving
 * 100% SEO indexability and screen-reader accessibility.
 *
 * The container element holds the complete sentence in an `aria-label`,
 * while individual word spans are marked `aria-hidden="true"`.
 */
export function SplitWords({
  text,
  className = '',
  wordClassName = '',
}: SplitWordsProps) {
  const words = text.split(/\s+/).filter(Boolean);

  return (
    <span
      className={className}
      aria-label={text}
      role="text"
    >
      {words.map((word, idx) => (
        <span
          key={idx}
          aria-hidden="true"
          className={`inline-block mr-[0.25em] ${wordClassName}`}
        >
          {word}
        </span>
      ))}
    </span>
  );
}
