// A one-shot handoff: picking "continue editing" from history drops the text
// into the editor without smearing it across the URL.

const KEY = 'virastar-draft'

export interface Draft {
  input: string
  modeId: string
}

export function saveDraft(d: Draft) {
  try {
    localStorage.setItem(KEY, JSON.stringify(d))
  } catch {
    /* storage unavailable */
  }
}

export function readDraft(): Draft | null {
  try {
    const raw = localStorage.getItem(KEY)
    return raw ? (JSON.parse(raw) as Draft) : null
  } catch {
    return null
  }
}

export function clearDraft() {
  try {
    localStorage.removeItem(KEY)
  } catch {
    /* storage unavailable */
  }
}
