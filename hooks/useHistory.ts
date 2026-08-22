'use client'

import { useCallback, useEffect, useState } from 'react'

export interface HistoryEntry {
  id: string
  title: string
  input: string
  output: string
  modeId: string
  engine: 'offline' | 'online'
  at: number
}

const KEY = 'virastar-history'
const MAX = 40

function load(): HistoryEntry[] {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return []
    const list = JSON.parse(raw)
    return Array.isArray(list) ? (list as HistoryEntry[]) : []
  } catch {
    return []
  }
}

function persist(list: HistoryEntry[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(list))
  } catch {
    /* storage unavailable */
  }
}

function titleFor(input: string): string {
  const t = input.replace(/\s+/g, ' ').trim()
  return t.length > 32 ? `${t.slice(0, 32)}…` : t || 'متن بی‌عنوان'
}

export function useHistory() {
  const [entries, setEntries] = useState<HistoryEntry[]>([])

  useEffect(() => {
    setEntries(load())
  }, [])

  const add = useCallback(
    (e: Omit<HistoryEntry, 'id' | 'at' | 'title'>): HistoryEntry => {
      const entry: HistoryEntry = {
        ...e,
        id: Math.random().toString(36).slice(2, 10),
        at: Date.now(),
        title: titleFor(e.input),
      }
      setEntries((prev) => {
        const next = [entry, ...prev].slice(0, MAX)
        persist(next)
        return next
      })
      return entry
    },
    [],
  )

  const remove = useCallback((id: string) => {
    setEntries((prev) => {
      const next = prev.filter((e) => e.id !== id)
      persist(next)
      return next
    })
  }, [])

  const clear = useCallback(() => {
    setEntries([])
    persist([])
  }, [])

  return { entries, add, remove, clear }
}
