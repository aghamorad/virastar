// Generates the distillation dataset for the small editor model.
//
// The teacher is the local Ollama Gemma (gemma2:9b). For every mode × source
// pair it runs the mode's instruction (the app's own system prompt) and keeps
// the model's edit. Each record is stored in the chat-messages shape mlx-lm
// expects for supervised fine-tuning; the system text is folded into the user
// turn because Gemma 2's chat template rejects a separate system role.
//
// Usage (from repo root):
//   npx tsx scripts/generate_dataset.ts
// Env overrides:
//   MODES_SUBSET=rasmi,adabi   only these mode ids
//   SOURCES_LIMIT=3            only the first N sources
//   TEMPERATURE=0.4
//   OUTPUT=data/distill/all.jsonl
// The run is resumable: already-generated (mode|source) keys are skipped.
// all.jsonl is the canonical full dataset; train.sh splits it into train/valid
// without ever touching the canonical file, so the split is idempotent.

import { appendFileSync, existsSync, mkdirSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { MODES } from '../domain/modes'
import { ONLINE_RULES } from '../domain/engines/online'
import { SOURCES, type SourceText } from './sources'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const OLLAMA = 'http://localhost:11434/v1/chat/completions'
const TEACHER = 'gemma2:9b'
const TEMPERATURE = Number(process.env.TEMPERATURE ?? 0.4)
const OUT = process.env.OUTPUT ?? join(ROOT, 'data', 'distill', 'all.jsonl')
const SYNTH = join(ROOT, 'data', 'distill', 'synth_sentences.jsonl')
const WEB = join(ROOT, 'data', 'distill', 'web_sources.jsonl')

const modeSubset = process.env.MODES_SUBSET?.split(',').filter(Boolean)
const sourceLimit = process.env.SOURCES_LIMIT ? Number(process.env.SOURCES_LIMIT) : SOURCES.length
const modes = modeSubset ? MODES.filter((m) => modeSubset.includes(m.id)) : MODES
// Hand-written seeds first, then every synthesized sentence (from
// synthesize_sentences.ts) and the real fetched texts (from fetch_sources.ts),
// so each one is edited under every mode. Keys are `mode|sNN`,
// `mode|synthNNN` and `mode|newsNN` — distinct, so the resume set stays correct.
const sources: SourceText[] = [
  ...SOURCES.slice(0, sourceLimit),
  ...loadJsonLines<SynthRecord>(SYNTH),
  ...loadJsonLines<WebRecord>(WEB),
]

interface SynthRecord {
  id: string
  text: string
}

interface WebRecord {
  id: string
  text: string
}

function loadJsonLines<T extends { id: string; text: string }>(file: string): SourceText[] {
  if (!existsSync(file)) return []
  const out: SourceText[] = []
  for (const line of readFileSync(file, 'utf8').split('\n')) {
    if (!line.trim()) continue
    try {
      const r = JSON.parse(line) as T
      out.push({ id: r.id, text: r.text })
    } catch {
      /* skip malformed line */
    }
  }
  return out
}

interface Record {
  key: string
  mode: string
  register: string
  system: string
  input: string
  output: string
  messages: Array<{ role: string; content: string }>
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms))
}

async function edit(input: string, system: string): Promise<string> {
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const res = await fetch(OLLAMA, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: TEACHER,
          messages: [
            { role: 'system', content: system },
            { role: 'user', content: input },
          ],
          temperature: TEMPERATURE,
        }),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> }
      const out = data.choices?.[0]?.message?.content
      if (!out || !out.trim()) throw new Error('empty response')
      return cleanup(out.trim())
    } catch (err) {
      if (attempt === 3) throw err
      await sleep(attempt * 3000)
    }
  }
  throw new Error('unreachable')
}

/** The model can still wrap its answer in «…» or "…" — strip that. */
function cleanup(out: string): string {
  const wrap = out.match(/^[«"“']+(.*?)[»"”']$/)
  return (wrap ? wrap[1] : out).trim()
}

function loadSeen(file: string): Set<string> {
  const seen = new Set<string>()
  if (existsSync(file)) {
    for (const line of readFileSync(file, 'utf8').split('\n')) {
      if (!line.trim()) continue
      try {
        const r = JSON.parse(line) as Record
        seen.add(r.key)
      } catch {
        /* skip malformed line */
      }
    }
  }
  return seen
}

async function main(): Promise<void> {
  mkdirSync(dirname(OUT), { recursive: true })
  const seen = loadSeen(OUT)
  const total = modes.length * sources.length
  let done = 0
  let failed = 0
  const start = Date.now()
  const report = new Map<string, number>()

  const reportProgress = () => {
    const mins = ((Date.now() - start) / 60000).toFixed(1)
    process.stderr.write(
      `[${new Date().toISOString()}] ${done + failed}/${total} (${mins} min, ${failed} failed)\n`,
    )
  }

  for (const mode of modes) {
    for (const src of sources) {
      const key = `${mode.id}|${src.id}`
      if (seen.has(key)) {
        done++
        continue
      }
      const system = `${mode.instruction}\n\n${ONLINE_RULES}`
      try {
        const output = await edit(src.text, system)
        const rec: Record = {
          key,
          mode: mode.id,
          register: mode.register,
          system,
          input: src.text,
          output,
          messages: [
            { role: 'user', content: `${system}\n\n${src.text}` },
            { role: 'assistant', content: output },
          ],
        }
        appendFileSync(OUT, `${JSON.stringify(rec)}\n`)
        done++
        report.set(mode.id, (report.get(mode.id) ?? 0) + 1)
        if (done % 25 === 0) reportProgress()
      } catch (err) {
        failed++
        process.stderr.write(`FAILED ${key}: ${String(err)}\n`)
        if (failed >= 10) {
          process.stderr.write('Too many failures; aborting.\n')
          break
        }
      }
    }
  }

  reportProgress()
  process.stderr.write(
    `Done. ${done} records (${failed} failed). Per mode: ${[...report]
      .map(([m, n]) => `${m}=${n}`)
      .join(', ')}\n`,
  )
}

void main()
