'use client'

import { useSyncExternalStore } from 'react'
import { getModelStatus, subscribeModelStatus } from '@/domain/engines/browser'

export function useModelStatus() {
  return useSyncExternalStore(subscribeModelStatus, getModelStatus, getModelStatus)
}
