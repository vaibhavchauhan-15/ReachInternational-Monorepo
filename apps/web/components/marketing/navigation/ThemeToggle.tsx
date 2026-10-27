'use client'

import React, { useSyncExternalStore } from 'react'
import { useTheme } from '@/components/theme/ThemeProvider'
import { Button } from '@/components/marketing/ui/button'
import { Sun, Moon } from 'lucide-react'

const subscribe = () => () => {}

export function ThemeToggle() {
  const { theme, setTheme, resolvedTheme } = useTheme()
  const mounted = useSyncExternalStore(subscribe, () => true, () => false)

  const isDark = mounted ? (resolvedTheme || theme) === 'dark' : false

  return (
    <Button
      variant="ghost"
      size="icon"
      aria-label={`Switch to ${isDark ? 'light' : 'dark'} theme`}
      className="relative size-10 rounded-full border-0 shadow-none hover:bg-[var(--surface-sunken)] active:scale-90 transition-all overflow-hidden cursor-pointer text-[var(--text-primary)]"
      onClick={() => setTheme(isDark ? 'light' : 'dark')}
    >
      <Sun className="size-4.5 rotate-0 scale-100 transition-all duration-300 dark:-rotate-90 dark:scale-0" />
      <Moon className="absolute size-4.5 rotate-90 scale-0 transition-all duration-300 dark:rotate-0 dark:scale-100" />
    </Button>
  )
}
