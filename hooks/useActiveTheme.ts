'use client'

import { useEffect, useState } from 'react'
import { THEME_STORAGE_KEY } from '@/domain/themes'

const DEFAULT_THEME = 'virastar'

/** The currently-active theme, live-updating when the data-theme attr changes. */
export function useActiveTheme(): string {
  const [theme, setTheme] = useState(DEFAULT_THEME)

  useEffect(() => {
    const root = document.documentElement
    const update = () => setTheme(root.getAttribute('data-theme') || DEFAULT_THEME)
    update()
    const mo = new MutationObserver(update)
    mo.observe(root, { attributes: true, attributeFilter: ['data-theme'] })
    return () => mo.disconnect()
  }, [])

  return theme
}

export function applyTheme(id: string) {
  try {
    localStorage.setItem(THEME_STORAGE_KEY, id)
  } catch {
    /* storage unavailable — theme still applies for this session */
  }
  const root = document.documentElement
  root.setAttribute('data-theme', id)
  // Re-trigger the settle animation so a switch feels like the paper re-sets.
  root.classList.remove('theme-settle')
  void root.offsetWidth
  root.classList.add('theme-settle')
}
