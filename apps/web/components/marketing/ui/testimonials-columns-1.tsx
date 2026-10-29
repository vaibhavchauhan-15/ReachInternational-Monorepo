'use client'

import React, { useState } from 'react'
import Image from 'next/image'
import { motion } from 'motion/react'
import { cn } from '@/lib/utils'
import { User } from 'lucide-react'

export interface Testimonial {
  text: string
  image?: string
  name: string
  role: string
  org?: string
  location?: string
  equipment?: string
  rating?: number
}

interface TestimonialsColumnProps {
  className?: string
  testimonials: Testimonial[]
  duration?: number
}

function AvatarWithFallback({
  src,
  alt,
  initials: _initials,
}: {
  src?: string
  alt: string
  initials?: string
}) {
  const [hasError, setHasError] = useState(false)

  if (!src || hasError) {
    return (
      <div
        className="h-10 w-10 rounded-full flex items-center justify-center shrink-0 select-none shadow-2xs border transition-transform duration-200 group-hover:scale-105"
        style={{
          backgroundColor: 'var(--surface-tint)',
          borderColor: 'var(--border-subtle)',
          color: 'var(--brand-blue, #0284c7)',
        }}
        aria-label={`Avatar placeholder for ${alt}`}
        title={alt}
      >
        <User className="w-5 h-5 opacity-90" strokeWidth={1.75} />
      </div>
    )
  }

  return (
    <Image
      width={40}
      height={40}
      src={src}
      alt={alt}
      unoptimized
      onError={() => setHasError(true)}
      className="h-10 w-10 rounded-full object-cover shrink-0 shadow-xs border"
      style={{ borderColor: 'var(--border-subtle)' }}
    />
  )
}

function getInitials(name: string): string {
  if (!name) return 'RI'
  const parts = name.trim().split(/\s+/)
  const first = parts[0]
  if (!first) return 'RI'
  if (parts.length === 1) return first.slice(0, 2).toUpperCase()
  const last = parts[parts.length - 1]
  const firstChar = first.charAt(0) || 'R'
  const lastChar = (last ? last.charAt(0) : '') || 'I'
  return (firstChar + lastChar).toUpperCase()
}

export const TestimonialsColumn = ({
  className,
  testimonials,
  duration = 16,
}: TestimonialsColumnProps) => {
  return (
    <div className={cn('overflow-hidden', className)}>
      <motion.div
        animate={{
          translateY: '-50%',
        }}
        transition={{
          duration: duration,
          repeat: Infinity,
          ease: 'linear',
          repeatType: 'loop',
        }}
        className="flex flex-col gap-5 pb-5 will-change-transform"
      >
        {[
          ...new Array(2).fill(0).map((_, groupIndex) => (
            <React.Fragment key={groupIndex}>
              {testimonials.map((item, itemIndex) => {
                const initials = getInitials(item.name)
                const rating = item.rating || 5

                return (
                  <div
                    key={`${groupIndex}-${itemIndex}`}
                    className="p-6 md:p-7 rounded-2xl border transition-all duration-300 max-w-sm w-full flex flex-col justify-between group hover:scale-[1.01]"
                    style={{
                      backgroundColor: 'var(--surface-raised)',
                      borderColor: 'var(--border-subtle)',
                      boxShadow: 'var(--shadow-sm)',
                    }}
                  >
                    <div>
                      {/* Rating & Equipment Tag */}
                      <div className="flex items-center justify-between gap-2 mb-4">
                        <div className="flex items-center gap-1 text-amber-400">
                          {[...Array(rating)].map((_, starIdx) => (
                            <svg
                              key={starIdx}
                              className="w-4 h-4 fill-current drop-shadow-xs"
                              viewBox="0 0 20 20"
                              aria-hidden="true"
                            >
                              <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                            </svg>
                          ))}
                        </div>

                        {item.equipment && (
                          <span
                            className="text-[11px] font-semibold tracking-tight px-2.5 py-0.5 rounded-full truncate max-w-[170px]"
                            style={{
                              backgroundColor: 'var(--surface-tint)',
                              color: 'var(--brand-blue, #008CFC)',
                              border: '1px solid var(--border-subtle)',
                            }}
                          >
                            {item.equipment}
                          </span>
                        )}
                      </div>

                      {/* Quote Text */}
                      <p
                        className="text-sm md:text-[14.5px] leading-relaxed mb-6 font-normal tracking-tight"
                        style={{ color: 'var(--text-primary)' }}
                      >
                        &ldquo;{item.text}&rdquo;
                      </p>
                    </div>

                    {/* Author Footer */}
                    <div
                      className="flex items-center gap-3 pt-4 border-t"
                      style={{ borderColor: 'var(--border-subtle)' }}
                    >
                      <AvatarWithFallback
                        src={item.image}
                        alt={item.name}
                        initials={initials}
                      />
                      <div className="flex flex-col min-w-0">
                        <div
                          className="font-bold text-sm tracking-tight leading-snug truncate"
                          style={{ color: 'var(--text-primary)' }}
                        >
                          {item.name}
                        </div>
                        <div
                          className="text-xs tracking-tight leading-tight truncate mt-0.5"
                          style={{ color: 'var(--text-secondary)' }}
                        >
                          {item.role}
                          {item.org ? ` • ${item.org}` : ''}
                        </div>
                        {item.location && (
                          <div
                            className="text-[11px] tracking-tight leading-tight truncate mt-0.5 flex items-center gap-1 font-medium"
                            style={{ color: 'var(--text-muted)' }}
                          >
                            <svg
                              className="w-3 h-3 shrink-0 opacity-70"
                              fill="none"
                              viewBox="0 0 24 24"
                              stroke="currentColor"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
                              />
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
                              />
                            </svg>
                            <span>{item.location}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}
            </React.Fragment>
          )),
        ]}
      </motion.div>
    </div>
  )
}

export default TestimonialsColumn
