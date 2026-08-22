'use client'

import { useCallback, useEffect, useState } from 'react'
import { DEFAULT_SETTINGS, type EngineSettings } from '@/domain/engine'

const KEY = 'virastar-settings'

export function useSettings(): [EngineSettings, (s: EngineSettings) => void] {
  const [settings, setSettings] = useState<EngineSettings>(DEFAULT_SETTINGS)

  useEffect(() => {
    try {
      const raw = localStorage.getItem(KEY)
      if (raw) setSettings({ ...DEFAULT_SETTINGS, ...JSON.parse(raw) })
    } catch {
      /* ignore malformed storage */
    }
  }, [])

  const save = useCallback((next: EngineSettings) => {
    setSettings(next)
    try {
      localStorage.setItem(KEY, JSON.stringify(next))
    } catch {
      /* storage unavailable */
    }
  }, [])

  return [settings, save]
}
