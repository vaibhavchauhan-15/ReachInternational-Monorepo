'use client'

import * as React from 'react'
import Link from 'next/link'
import { Sparkles } from 'lucide-react'
import { useEffect, useMemo, useRef, useState, useCallback } from 'react'
import { liquidMetalFragmentShader, ShaderMount } from '@paper-design/shaders'
import { cn } from '@/lib/utils'

export interface LiquidMetalButtonProps {
  label?: string
  href?: string
  onClick?: (e: React.MouseEvent<HTMLButtonElement | HTMLAnchorElement>) => void
  viewMode?: 'text' | 'icon'
  variant?: 'obsidian' | 'brand'
  icon?: React.ReactNode
  className?: string
  disabled?: boolean
  width?: number
  height?: number
  'aria-label'?: string
}

export function LiquidMetalButton({
  label = 'Get Started',
  href,
  onClick,
  viewMode = 'text',
  variant = 'obsidian',
  icon,
  className,
  disabled = false,
  width: customWidth,
  height: customHeight,
  'aria-label': ariaLabel,
}: LiquidMetalButtonProps) {
  const [isHovered, setIsHovered] = useState(false)
  const [isPressed, setIsPressed] = useState(false)
  const [ripples, setRipples] = useState<Array<{ x: number; y: number; id: number }>>([])
  const shaderRef = useRef<HTMLDivElement>(null)
  // biome-ignore lint/suspicious/noExplicitAny: ShaderMount from @paper-design/shaders
  const shaderMount = useRef<any>(null)
  const interactiveRef = useRef<HTMLButtonElement | HTMLAnchorElement | null>(null)
  const rippleId = useRef(0)

  // Compute ergonomic dimensions based on content
  const dimensions = useMemo(() => {
    const h = customHeight ?? 44
    const innerH = h - 4

    if (viewMode === 'icon') {
      const w = customWidth ?? h
      return {
        width: w,
        height: h,
        innerWidth: w - 4,
        innerHeight: innerH,
        shaderWidth: w,
        shaderHeight: h,
      }
    }

    // Dynamic width calculation based on text length + icon to prevent awkward truncation
    const hasIcon = Boolean(icon)
    const basePadding = hasIcon ? 48 : 36
    const calculatedWidth = Math.max(140, Math.round((label?.length || 10) * 8.2 + basePadding))
    const w = customWidth ?? calculatedWidth

    return {
      width: w,
      height: h,
      innerWidth: w - 4,
      innerHeight: innerH,
      shaderWidth: w,
      shaderHeight: h,
    }
  }, [viewMode, label, icon, customWidth, customHeight])

  // Mount WebGL liquid metal shader with consistent monochromatic platinum / mercury physics
  useEffect(() => {
    let isMounted = true
    const styleId = 'shader-canvas-style-exploded'

    if (!document.getElementById(styleId)) {
      const style = document.createElement('style')
      style.id = styleId
      style.textContent = `
        .shader-container-exploded canvas {
          width: 100% !important;
          height: 100% !important;
          display: block !important;
          position: absolute !important;
          top: 0 !important;
          left: 0 !important;
          border-radius: 100px !important;
          pointer-events: none !important;
        }
        @keyframes liquid-metal-ripple {
          0% {
            transform: translate(-50%, -50%) scale(0);
            opacity: 0.6;
          }
          100% {
            transform: translate(-50%, -50%) scale(4);
            opacity: 0;
          }
        }
      `
      document.head.appendChild(style)
    }

    const loadShader = () => {
      try {
        if (!shaderRef.current || !isMounted) return

        if (shaderMount.current?.destroy) {
          shaderMount.current.destroy()
        }

        // Set consistent monochromatic liquid metal reflections (zero chromatic dispersion)
        shaderMount.current = new ShaderMount(
          shaderRef.current,
          liquidMetalFragmentShader,
          {
            u_repetition: 4,
            u_softness: 0.5,
            u_shiftRed: 0.0, // Consistent color: zero red-shift aberration
            u_shiftBlue: 0.0, // Consistent color: zero blue-shift aberration
            u_distortion: 0.08,
            u_contour: 0.25,
            u_angle: 45,
            u_scale: 8,
            u_shape: 1,
            u_offsetX: 0.1,
            u_offsetY: -0.1,
          },
          undefined,
          0.5 // Initial ambient fluid animation speed
        )
      } catch (error) {
        // Safe WebGL fallback (CSS provides visual styling)
        console.warn('[LiquidMetalButton] Shader init error:', error)
      }
    }

    loadShader()

    return () => {
      isMounted = false
      if (shaderMount.current?.destroy) {
        shaderMount.current.destroy()
        shaderMount.current = null
      }
    }
  }, [])

  const handleMouseEnter = useCallback(() => {
    if (disabled) return
    setIsHovered(true)
    shaderMount.current?.setSpeed?.(1.1)
  }, [disabled])

  const handleMouseLeave = useCallback(() => {
    setIsHovered(false)
    setIsPressed(false)
    shaderMount.current?.setSpeed?.(0.5)
  }, [])

  const triggerClickEffects = useCallback(
    (e: React.MouseEvent<HTMLButtonElement | HTMLAnchorElement>) => {
      if (disabled) {
        e.preventDefault()
        return
      }

      if (shaderMount.current?.setSpeed) {
        shaderMount.current.setSpeed(2.2)
        setTimeout(() => {
          if (isHovered) {
            shaderMount.current?.setSpeed?.(1.1)
          } else {
            shaderMount.current?.setSpeed?.(0.5)
          }
        }, 320)
      }

      if (interactiveRef.current) {
        const rect = interactiveRef.current.getBoundingClientRect()
        const x = e.clientX - rect.left
        const y = e.clientY - rect.top
        const ripple = { x, y, id: rippleId.current++ }

        setRipples((prev) => [...prev, ripple])
        setTimeout(() => {
          setRipples((prev) => prev.filter((r) => r.id !== ripple.id))
        }, 600)
      }

      onClick?.(e)
    },
    [disabled, isHovered, onClick]
  )

  // Cohesive Color Schemes
  const isBrand = variant === 'brand'
  const innerGradient = isBrand
    ? 'linear-gradient(180deg, #0284c7 0%, #0369a1 100%)'
    : 'linear-gradient(180deg, #1c1c1f 0%, #0a0a0c 100%)'

  const innerBorder = isBrand
    ? '1px solid rgba(255, 255, 255, 0.25)'
    : '1px solid rgba(255, 255, 255, 0.12)'

  const innerShadow = isPressed
    ? 'inset 0px 2px 4px rgba(0, 0, 0, 0.6), inset 0px 1px 2px rgba(0, 0, 0, 0.5)'
    : isBrand
      ? 'inset 0px 1px 1px rgba(255, 255, 255, 0.35), 0px 2px 8px rgba(2, 132, 199, 0.3)'
      : 'inset 0px 1px 1px rgba(255, 255, 255, 0.16), 0px 2px 6px rgba(0, 0, 0, 0.4)'

  const containerShadow = isPressed
    ? '0px 0px 0px 1px rgba(255, 255, 255, 0.08), 0px 1px 2px 0px rgba(0, 0, 0, 0.4)'
    : isHovered
      ? isBrand
        ? '0px 0px 0px 1px rgba(14, 165, 233, 0.4), 0px 10px 24px -2px rgba(2, 132, 199, 0.45), 0px 4px 8px 0px rgba(0, 0, 0, 0.3)'
        : '0px 0px 0px 1px rgba(255, 255, 255, 0.22), 0px 12px 28px -4px rgba(0, 0, 0, 0.6), 0px 6px 12px 0px rgba(0, 0, 0, 0.3)'
      : isBrand
        ? '0px 0px 0px 1px rgba(2, 132, 199, 0.3), 0px 6px 16px -2px rgba(2, 132, 199, 0.3), 0px 2px 4px 0px rgba(0, 0, 0, 0.25)'
        : '0px 0px 0px 1px rgba(255, 255, 255, 0.1), 0px 6px 16px -2px rgba(0, 0, 0, 0.4), 0px 2px 4px 0px rgba(0, 0, 0, 0.2)'

  // Interactive Layer Props
  const interactiveStyle: React.CSSProperties = {
    position: 'absolute',
    top: 0,
    left: 0,
    width: `${dimensions.width}px`,
    height: `${dimensions.height}px`,
    background: 'transparent',
    border: 'none',
    cursor: disabled ? 'not-allowed' : 'pointer',
    outline: 'none',
    zIndex: 40,
    transformStyle: 'preserve-3d',
    transform: 'translateZ(25px)',
    transition: 'all 0.6s cubic-bezier(0.34, 1.56, 0.64, 1)',
    overflow: 'hidden',
    borderRadius: '100px',
  }

  const effectiveAriaLabel = ariaLabel || (viewMode === 'text' ? label : 'Action button')

  return (
    <div
      className={cn(
        'relative inline-block select-none',
        disabled && 'opacity-60 pointer-events-none',
        className
      )}
    >
      <div
        style={{
          perspective: '1000px',
          perspectiveOrigin: '50% 50%',
        }}
      >
        <div
          style={{
            position: 'relative',
            width: `${dimensions.width}px`,
            height: `${dimensions.height}px`,
            transformStyle: 'preserve-3d',
            transition: 'all 0.6s cubic-bezier(0.34, 1.56, 0.64, 1)',
            transform: 'none',
          }}
        >
          {/* Layer 1: Typography & Icon Foreground (Luminous High-End White) */}
          <div
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: `${dimensions.width}px`,
              height: `${dimensions.height}px`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '7px',
              transformStyle: 'preserve-3d',
              transition: 'all 0.6s cubic-bezier(0.34, 1.56, 0.64, 1)',
              transform: 'translateZ(20px)',
              zIndex: 30,
              pointerEvents: 'none',
              paddingLeft: viewMode === 'text' ? '14px' : '0',
              paddingRight: viewMode === 'text' ? '14px' : '0',
            }}
          >
            {viewMode === 'icon' && (
              <span
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#ffffff',
                  filter: 'drop-shadow(0px 1px 2px rgba(0, 0, 0, 0.7))',
                  transition: 'all 0.6s cubic-bezier(0.34, 1.56, 0.64, 1)',
                  transform: isHovered ? 'scale(1.08)' : 'scale(1)',
                }}
              >
                {icon || <Sparkles size={16} />}
              </span>
            )}

            {viewMode === 'text' && (
              <>
                <span
                  style={{
                    fontSize: '13.5px',
                    color: '#ffffff',
                    fontWeight: 600,
                    letterSpacing: '-0.01em',
                    textShadow: '0px 1px 2px rgba(0, 0, 0, 0.8), 0px 0px 12px rgba(255, 255, 255, 0.2)',
                    transition: 'all 0.6s cubic-bezier(0.34, 1.56, 0.64, 1)',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {label}
                </span>
                {icon && (
                  <span
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#ffffff',
                      filter: 'drop-shadow(0px 1px 2px rgba(0, 0, 0, 0.7))',
                      transition: 'transform 0.3s ease',
                      transform: isHovered ? 'translateX(2px)' : 'translateX(0)',
                    }}
                  >
                    {icon}
                  </span>
                )}
              </>
            )}
          </div>

          {/* Layer 2: Inner Core Pill Gradient */}
          <div
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: `${dimensions.width}px`,
              height: `${dimensions.height}px`,
              transformStyle: 'preserve-3d',
              transition: 'all 0.6s cubic-bezier(0.34, 1.56, 0.64, 1)',
              transform: `translateZ(10px) ${isPressed ? 'translateY(1px) scale(0.98)' : 'translateY(0) scale(1)'}`,
              zIndex: 20,
            }}
          >
            <div
              style={{
                width: `${dimensions.innerWidth}px`,
                height: `${dimensions.innerHeight}px`,
                margin: '2px',
                borderRadius: '100px',
                background: innerGradient,
                border: innerBorder,
                boxShadow: innerShadow,
                transition: 'all 0.4s ease, box-shadow 0.2s ease',
              }}
            />
          </div>

          {/* Layer 3: Shader Perimeter Glow & Dynamic Fluid Reflection */}
          <div
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: `${dimensions.width}px`,
              height: `${dimensions.height}px`,
              transformStyle: 'preserve-3d',
              transition: 'all 0.6s cubic-bezier(0.34, 1.56, 0.64, 1)',
              transform: `translateZ(0px) ${isPressed ? 'translateY(1px) scale(0.98)' : 'translateY(0) scale(1)'}`,
              zIndex: 10,
            }}
          >
            <div
              style={{
                height: `${dimensions.height}px`,
                width: `${dimensions.width}px`,
                borderRadius: '100px',
                boxShadow: containerShadow,
                transition: 'all 0.4s ease, box-shadow 0.25s ease',
                background: 'transparent',
              }}
            >
              <div
                ref={shaderRef}
                className="shader-container-exploded"
                style={{
                  borderRadius: '100px',
                  overflow: 'hidden',
                  position: 'relative',
                  width: `${dimensions.shaderWidth}px`,
                  maxWidth: `${dimensions.shaderWidth}px`,
                  height: `${dimensions.shaderHeight}px`,
                  transition: 'width 0.4s ease, height 0.4s ease',
                }}
              />
            </div>
          </div>

          {/* Layer 4: Interactive Anchor / Button Layer */}
          {href ? (
            <Link
              ref={interactiveRef as React.Ref<HTMLAnchorElement>}
              href={href}
              onClick={triggerClickEffects}
              onMouseEnter={handleMouseEnter}
              onMouseLeave={handleMouseLeave}
              onMouseDown={() => setIsPressed(true)}
              onMouseUp={() => setIsPressed(false)}
              style={interactiveStyle}
              aria-label={effectiveAriaLabel}
            >
              {ripples.map((ripple) => (
                <span
                  key={ripple.id}
                  style={{
                    position: 'absolute',
                    left: `${ripple.x}px`,
                    top: `${ripple.y}px`,
                    width: '24px',
                    height: '24px',
                    borderRadius: '50%',
                    background:
                      'radial-gradient(circle, rgba(255, 255, 255, 0.5) 0%, rgba(255, 255, 255, 0) 70%)',
                    pointerEvents: 'none',
                    animation: 'liquid-metal-ripple 0.6s ease-out',
                  }}
                />
              ))}
            </Link>
          ) : (
            <button
              ref={interactiveRef as React.Ref<HTMLButtonElement>}
              type="button"
              onClick={triggerClickEffects}
              onMouseEnter={handleMouseEnter}
              onMouseLeave={handleMouseLeave}
              onMouseDown={() => setIsPressed(true)}
              onMouseUp={() => setIsPressed(false)}
              disabled={disabled}
              style={interactiveStyle}
              aria-label={effectiveAriaLabel}
            >
              {ripples.map((ripple) => (
                <span
                  key={ripple.id}
                  style={{
                    position: 'absolute',
                    left: `${ripple.x}px`,
                    top: `${ripple.y}px`,
                    width: '24px',
                    height: '24px',
                    borderRadius: '50%',
                    background:
                      'radial-gradient(circle, rgba(255, 255, 255, 0.5) 0%, rgba(255, 255, 255, 0) 70%)',
                    pointerEvents: 'none',
                    animation: 'liquid-metal-ripple 0.6s ease-out',
                  }}
                />
              ))}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

export function LiquidMetalButtonDemo() {
  return (
    <div className="flex flex-col items-center justify-center gap-8 p-8">
      <div className="flex items-center gap-8">
        <LiquidMetalButton label="Get Started" />
        <LiquidMetalButton viewMode="icon" />
      </div>
    </div>
  )
}

export default LiquidMetalButton
