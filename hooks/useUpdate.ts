'use client'

import { useEffect, useState } from 'react'
import { pendingUpdate } from '@/domain/updates'

/**
 * Whether a newer ویراستار has been released, learned in the background.
 *
 * `checked` is separate from `newer` on purpose: a blank `newer` before the
 * answer arrives and a blank one after it are different facts, and only the
 * second means "this is the newest release". Anything that says otherwise
 * would be claiming to know something it has not been told.
 */
export function useUpdate(): { newer: string; checked: boolean } {
  const [newer, setNewer] = useState('')
  const [checked, setChecked] = useState(false)

  useEffect(() => {
    let live = true
    void pendingUpdate().then((found) => {
      if (!live) return
      setNewer(found)
      setChecked(true)
    })
    return () => {
      live = false
    }
  }, [])

  return { newer, checked }
}
