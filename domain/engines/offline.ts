// The offline editor engine — deterministic Persian rules that run anywhere
// with no network. It corrects, repairs نیم‌فاصله, and shifts register through
// curated lexicons. Heavy rewriting is the online engine's job; this is the
// honest, always-works offline half.

import type { Register, WritingMode } from '../modes'
import {
  COLLOQUIAL_TO_STANDARD,
  TO_CASUAL,
  TO_FLATTERY,
  TO_FORMAL,
  TO_GENZ,
  TO_LITERARY,
  TO_STREET,
  TO_TAAROF,
  expandMiVariants,
  fixPunctuation,
  fixSpacing,
  fixZWNJ,
  hasPersian,
  normalizeChars,
  replaceWords,
} from '../persian'

export interface OfflineResult {
  output: string
  changed: number
  notes: string[]
}

const END_PUNCT = /[.!؟…»"'»]$/

function ensureFinalPunctuation(text: string): { text: string; changed: boolean } {
  if (!text || END_PUNCT.test(text)) return { text, changed: false }
  return { text: `${text}.`, changed: true }
}

/**
 * Weave connective words sparingly — at most a couple per text, only into
 * declarative sentences of a few words that don't already open with a
 * conjunction. Connector spam («هم‌چنین، … از این‌رو، … بدین ترتیب، …» on
 * every sentence) reads as fake formality and is worse than no connectors.
 */
function weaveConnectors(text: string, connectors: string[]): { text: string; changed: number } {
  // Word-boundary anchored so «و» matches only the standalone word and not
  // the prefix of «واقعا» — otherwise a «و»-initial sentence skips weaving.
  const leading = /^(امّا|اما|ولی|بنابراین|هم‌چنین|از این‌رو|از این رو|لیکن|پس|و|گویی|چون|خب|بابا|واقعاً|واقعا|بازم|فرموده|مقتضی است|خواهشمند است|به استحضار می‌رساند|بدین‌سان|به‌طور کلی)(?![؀-ۿ‌])/
  const sentences = text.split(/(?<=[.!؟…]) +/)
  if (sentences.length < 3) return { text, changed: 0 }
  let changed = 0
  let ci = 0
  const budget = Math.min(2, sentences.length - 2)
  const out = sentences.map((s, i) => {
    if (i === 0 || changed >= budget) return s
    const t = s.trim()
    if (!t || leading.test(t)) return s
    if (/[؟!…]$/.test(t)) return s
    if (t.split(/\s+/).length < 3) return s
    const conn = connectors[ci % connectors.length]
    ci++
    changed++
    return ` ${conn}، ${t}`
  })
  return { text: out.join(' '), changed }
}

/** Colloquial sentence-openers have no place in formal registers. */
const INTERJECTION = /^(ای بابا|آخه|بابا|وای|خب|عجب|بیخیال)[،,]?\s*/

function stripColloquialInterjections(text: string): string {
  const sentences = text.split(/(?<=[.!؟…]) +/)
  const out = sentences
    .map((s) => s.replace(INTERJECTION, ''))
    // Drop sentences that became pure punctuation («ای بابا.» → «.»).
    .filter((s) => /[؀-ۿ]/.test(s))
  return out.join(' ')
}

function applyOpeners(text: string, mode: WritingMode): { text: string; changed: number } {
  let out = text
  let changed = 0
  if (mode.opener && !out.startsWith(mode.opener)) {
    out = `${mode.opener}؛ ${out}`
    changed++
  }
  if (mode.closer && !out.endsWith(mode.closer)) {
    const end = ensureFinalPunctuation(out)
    out = end.changed ? `${end.text} ${mode.closer}.` : `${out.trim()} ${mode.closer}.`
    changed += end.changed ? 2 : 1
  }
  return { text: out, changed }
}

// The "clean" registers first fix colloquial spellings to standard, then apply
// their register shift — so رسمى doesn't leave برم or خوبه standing.
const STANDARD_AND_FORMAL = { ...COLLOQUIAL_TO_STANDARD, ...TO_FORMAL }
const STANDARD_AND_LITERARY = { ...COLLOQUIAL_TO_STANDARD, ...TO_LITERARY }

const REGISTER_LEXICON: Record<Register, Record<string, string> | null> = {
  standard: COLLOQUIAL_TO_STANDARD,
  formal: STANDARD_AND_FORMAL,
  academic: STANDARD_AND_FORMAL,
  admin: STANDARD_AND_FORMAL,
  casual: TO_CASUAL,
  literary: STANDARD_AND_LITERARY,
  street: TO_STREET,
  genz: TO_GENZ,
  taarof: { ...COLLOQUIAL_TO_STANDARD, ...TO_TAAROF },
  flattery: { ...COLLOQUIAL_TO_STANDARD, ...TO_FLATTERY },
  poetic: STANDARD_AND_LITERARY,
}

export function editOffline(input: string, mode: WritingMode): OfflineResult {
  const notes: string[] = []
  const before = input
  let text = normalizeChars(input)
  if (!hasPersian(text)) {
    return { output: text.trim(), changed: 0, notes: ['متن فارسی پیدا نکردم؛ اصلاح نشد.'] }
  }

  const znwjText = fixZWNJ(text)
  if (znwjText !== text) notes.push('نیم‌فاصله‌ها و فاصله‌ها مرتب شد.')
  text = znwjText

  const punctText = fixPunctuation(text)
  if (punctText !== text) notes.push('نشانه‌گذاری و گیومه‌ها اصلاح شد.')
  text = punctText

  // Strip sentence-opening interjections BEFORE the lexicon — otherwise آخه
  // gets turned into زیرا and then can't be removed.
  if (mode.register === 'formal' || mode.register === 'academic' || mode.register === 'admin') {
    const stripped = stripColloquialInterjections(text)
    if (stripped !== text) {
      notes.push('کلمات محاوره‌ای ابتدای جمله‌ها حذف شد.')
      text = stripped
    }
  }

  const baseLexicon = REGISTER_LEXICON[mode.register]
  if (baseLexicon) {
    const replaced = replaceWords(text, expandMiVariants(baseLexicon))
    text = replaced.text
    if (replaced.count > 0) {
      const verb =
        mode.register === 'casual' || mode.register === 'street' || mode.register === 'genz'
          ? 'واژه‌ها به لحن روزمره نزدیک شد.'
          : 'شکل استاندارد واژه‌ها جایگزین شد.'
      notes.push(verb)
    }
  }

  if (mode.connectors && mode.connectors.length > 0) {
    const woven = weaveConnectors(text, mode.connectors)
    if (woven.changed > 0) notes.push('پیوند جمله‌ها تقویت شد.')
    text = woven.text
  }

  if (mode.opener || mode.closer) {
    const wrapped = applyOpeners(text, mode)
    text = wrapped.text
  }

  // The dictionaries use the simple no-ZWNJ spellings; re-run the half-space
  // pass so their outputs come out in the modern form too.
  text = fixZWNJ(text)
  const spaced = fixSpacing(text)
  const ended = ensureFinalPunctuation(spaced)
  if (ended.changed) notes.push('نشانه‌گذاری کامل شد.')
  text = ended.text

  // How much actually moved: count real token differences, capped.
  const changed =
    before === text ? 0 : Math.min(999, countDiffs(before, text))
  if (notes.length === 0) notes.push('نوشته از قبل تمیز بود.')
  return { output: text, changed, notes }
}

/** Cheap edit-distance-ish proxy: differing words + differing punctuation. */
function countDiffs(a: string, b: string): number {
  const aw = a.split(/\s+/)
  const bw = b.split(/\s+/)
  let n = 0
  const len = Math.max(aw.length, bw.length)
  for (let i = 0; i < len; i++) {
    if (aw[i] !== bw[i]) n++
  }
  return n
}
