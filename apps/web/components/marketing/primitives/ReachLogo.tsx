import React from 'react'
import Image from 'next/image'

export interface ReachLogoProps {
  className?: string
  /**
   * Theme variant:
   * - 'auto': responds dynamically to site theme (dark logo on light theme, light logo on dark theme)
   * - 'light': forces dark logo (for light backgrounds)
   * - 'dark': forces light logo with white text/icon (for dark backgrounds like footer)
   * Defaults to 'auto'.
   */
  variant?: 'light' | 'dark' | 'auto'
  showTagline?: boolean
  width?: number
  height?: number
  priority?: boolean
}

export function ReachLogo({
  className = '',
  variant = 'auto',
  width,
  height = 48,
  priority = false,
}: ReachLogoProps) {
  // Master logo aspect ratio is 2:1 (1774 x 887)
  const calculatedWidth = width ?? Math.round(height * 2)

  if (variant === 'dark') {
    // Explicitly for dark backgrounds: display light logo (white text/icon)
    return (
      <span className={`inline-flex items-center shrink-0 ${className}`}>
        <Image
          src="/images/reach-logo-light.png"
          alt="Reach International — Reaching All Heights"
          width={calculatedWidth}
          height={height}
          className="block object-contain"
          style={{ height: `${height}px`, width: 'auto', aspectRatio: '2 / 1' }}
          priority={priority}
        />
      </span>
    )
  }

  if (variant === 'light') {
    // Explicitly for light backgrounds: display dark logo (charcoal text/icon)
    return (
      <span className={`inline-flex items-center shrink-0 ${className}`}>
        <Image
          src="/images/reach-logo-dark.png"
          alt="Reach International — Reaching All Heights"
          width={calculatedWidth}
          height={height}
          className="block object-contain"
          style={{ height: `${height}px`, width: 'auto', aspectRatio: '2 / 1' }}
          priority={priority}
        />
      </span>
    )
  }

  // variant === 'auto': Dynamic theme switching with zero FOUC / zero layout shift via CSS
  return (
    <span className={`reach-logo-wrapper inline-flex items-center shrink-0 ${className}`}>
      {/* Light Theme: show dark logo (charcoal text on light background) */}
      <Image
        src="/images/reach-logo-dark.png"
        alt="Reach International — Reaching All Heights"
        width={calculatedWidth}
        height={height}
        className="reach-logo-on-light object-contain"
        style={{ height: `${height}px`, width: 'auto', aspectRatio: '2 / 1' }}
        priority={priority}
      />
      {/* Dark Theme: show light logo (white text on dark background) */}
      <Image
        src="/images/reach-logo-light.png"
        alt="Reach International — Reaching All Heights"
        width={calculatedWidth}
        height={height}
        className="reach-logo-on-dark object-contain"
        style={{ height: `${height}px`, width: 'auto', aspectRatio: '2 / 1' }}
        priority={priority}
      />
    </span>
  )
}
