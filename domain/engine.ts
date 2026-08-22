// The editor engine facade. The product treats online and offline editing as
// the same capability — the difference is quality and speed, never the UI.

import { getMode } from './modes'
import { editOffline, type OfflineResult } from './engines/offline'
import { editOnline } from './engines/online'

export type EngineKind = 'offline' | 'online'

export interface EngineSettings {
  engine: EngineKind
  endpoint: string
  model: string
}

export const DEFAULT_SETTINGS: EngineSettings = {
  engine: 'offline',
  endpoint: '',
  model: '',
}

export interface EditResult {
  output: string
  changed: number
  engine: EngineKind
  /** Tells the reader what actually happened — in Persian. */
  notes: string[]
}

export async function runEdit(
  input: string,
  modeId: string,
  settings: EngineSettings,
): Promise<EditResult> {
  const mode = getMode(modeId)

  if (settings.engine === 'online' && settings.endpoint) {
    try {
      const output = await editOnline(input, mode, {
        endpoint: settings.endpoint,
        model: settings.model,
      })
      return {
        output,
        changed: countWordDiffs(input, output),
        engine: 'online',
        notes: [
          `«${mode.label}» با موتور آنلاین انجام شد.`,
          'ویرایش واقعی هوش مصنوعی — نتیجه را خودت قضاوت کن.',
        ],
      }
    } catch {
      const offline = editOffline(input, mode)
      return {
        ...offline,
        engine: 'offline',
        notes: [
          'موتور آنلاین در دسترس نبود؛ با موتور آفلاین ویرایش شد.',
          ...offline.notes,
        ],
      }
    }
  }

  const offline: OfflineResult = editOffline(input, mode)
  return { ...offline, engine: 'offline' }
}

function countWordDiffs(a: string, b: string): number {
  const aw = a.split(/\s+/)
  const bw = b.split(/\s+/)
  let n = 0
  const len = Math.max(aw.length, bw.length)
  for (let i = 0; i < len; i++) if (aw[i] !== bw[i]) n++
  return n
}
