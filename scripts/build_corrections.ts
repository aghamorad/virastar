// Builds the auxiliary اصلاح (tashih) training set from the persian-2-persian
// corpus: ~200k parallel (unedited → edited) Persian sentences covering typos,
// ZWNJ, spacing, and punctuation errors. These are ready-made (input → edited
// output) pairs — no teacher needed. Formatted with the app's own tashih
// instruction so they mix cleanly with the restructuring records.
//
// Usage:
//   npx tsx scripts/build_corrections.ts
// Env: CORPUS=/path/to/corpus-dir (default /tmp/virastar-model/persian-corpus),
//      SAMPLE=3000  (total pairs to keep; first 150 become corrections_valid.jsonl)

import { writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { readFileSync } from 'node:fs'
import { dirname } from 'node:path'
import { getMode } from '../domain/modes'
import { ONLINE_RULES } from '../domain/engines/online'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const CORPUS = process.env.CORPUS ?? '/tmp/virastar-model/persian-corpus'
const SAMPLE = Number(process.env.SAMPLE ?? 3000)
const VALID_KEEP = 60

const mode = getMode('tashih')
const system = `${mode.instruction}\n\n${ONLINE_RULES}`

const src = readFileSync(join(CORPUS, 'src.txt'), 'utf8').split('\n')
const tgt = readFileSync(join(CORPUS, 'tgt.txt'), 'utf8').split('\n')

const pairs: Array<[string, string]> = []
for (let i = 0; i < src.length; i++) {
  const s = src[i]?.trim()
  const t = tgt[i]?.trim()
  if (!s || !t || s === t) continue
  if (!/[؀-ۿ]/.test(s) || !/[؀-ۿ]/.test(t)) continue
  if (s.length < 10 || s.length > 300) continue
  pairs.push([s, t])
}

// Deterministic spread sample so the whole corpus is represented.
const step = Math.max(1, Math.floor(pairs.length / SAMPLE))
const chosen = pairs.filter((_, i) => i % step === 0).slice(0, SAMPLE)

const toRecord = (n: number, s: string, t: string) => ({
  key: `corr-${n}`,
  mode: 'tashih',
  register: 'standard',
  system,
  input: s,
  output: t,
  messages: [
    { role: 'user', content: `${system}\n\n${s}` },
    { role: 'assistant', content: t },
  ],
})

const trainLines = chosen
  .slice(VALID_KEEP)
  .map(([s, t], i) => JSON.stringify(toRecord(i, s, t)))
const validLines = chosen
  .slice(0, VALID_KEEP)
  .map(([s, t], i) => JSON.stringify(toRecord(i, s, t)))

writeFileSync(join(ROOT, 'data', 'distill', 'corrections.jsonl'), trainLines.join('\n') + '\n')
writeFileSync(
  join(ROOT, 'data', 'distill', 'corrections_valid.jsonl'),
  validLines.join('\n') + '\n',
)
console.log(
  `corpus pairs: ${pairs.length}; kept train=${trainLines.length}, valid=${validLines.length}`,
)
