'use client'

import { useCallback, useEffect, useState } from 'react'
import { DEFAULT_SETTINGS, type EngineSettings } from '@/domain/engine'

// v2: the default engine changed from the offline model to the hosted online
// engine, so old stored settings (engine 'offline', empty endpoint) must not
// stick around and silently disable online editing.
const KEY = 'virastar-settings-v2'

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
