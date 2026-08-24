#!/usr/bin/env node
import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const args = process.argv.slice(2)
const getArg = (name, fallback) => { const index = args.indexOf(name); return index >= 0 ? args[index + 1] : fallback }
const repo = path.resolve(getArg('--repo', path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')))
const distill = path.join(repo, 'data/distill')
const outputDir = path.resolve(getArg('--output', path.join(distill, 'v3')))
const shortFile = path.resolve(getArg('--short', path.join(distill, 'codex.jsonl')))
const longFile = path.resolve(getArg('--long', path.join(distill, 'codex_v3.jsonl')))
const hardFile = path.resolve(getArg('--hard-test', path.join(distill, 'hard_test.jsonl')))
const modeOrder = ['tashih', 'rasmi', 'daneshgahi', 'edari', 'khodmani', 'adabi', 'lati', 'taaroofi', 'pachelhkhor', 'naslezed', 'shaeraneh']
const hardModes = new Set(['rasmi', 'daneshgahi', 'edari', 'adabi', 'pachelhkhor', 'shaeraneh'])
const expectedShort = { tashih: 100, rasmi: 120, daneshgahi: 120, edari: 120, khodmani: 100, adabi: 120, lati: 100, taaroofi: 100, pachelhkhor: 120, naslezed: 100, shaeraneh: 120 }
const expectedLong = Object.fromEntries(modeOrder.map((mode) => [mode, 120]))

function prompts() {
  const mt = fs.readFileSync(path.join(repo, 'domain/modes.ts'), 'utf8')
  const ot = fs.readFileSync(path.join(repo, 'domain/engines/online.ts'), 'utf8')
  const modes = {}
  for (const m of mt.matchAll(/id: '([^']+)'[\s\S]*?register: '([^']+)'[\s\S]*?instruction:\s*\n\s*'([^']*)'/g)) modes[m[1]] = { register: m[2], instruction: m[3] }
  const block = ot.match(/export const ONLINE_RULES = \[([\s\S]*?)\]\.join\('\\n'\)/)
  if (!block) throw new Error('Could not parse ONLINE_RULES')
  return { modes, rules: [...block[1].matchAll(/'([^']*)'/g)].map((m) => m[1]).join('\n') }
}
const { modes, rules } = prompts()
const read = (file) => fs.readFileSync(file, 'utf8').split('\n').filter(Boolean).map((line, index) => { try { return JSON.parse(line) } catch (error) { throw new Error(`${file}:${index + 1}: ${error.message}`) } })
const normalize = (row) => {
  const spec = modes[row.mode]; if (!spec) throw new Error(`Unknown mode ${row.mode}`)
  const system = `${spec.instruction}\n\n${rules}`
  return { key: row.key, mode: row.mode, register: spec.register, system, input: row.input, output: row.output, messages: [{ role: 'user', content: `${system}\n\n${row.input}` }, { role: 'assistant', content: row.output }] }
}
const poison = (row) => {
  if (!/[\p{Script_Extensions=Arabic}]/u.test(row.output)) return 'no Persian output'
  for (const c of row.output) if (/\p{Letter}/u.test(c) && !/\p{Script_Extensions=Arabic}/u.test(c)) return 'foreign-script letter'
  if (/[0-9]/u.test(row.output)) return 'ASCII digit'
  if (/(از نو بساز|بازسازی کن|توضیح نده|یک ویراستار حرفه‌ای باش|متن را به زبان .* بازنویسی کن)/u.test(row.output)) return 'prompt echo'
  if (/(\[[^\]\n]{2,}\]|【[^】\n]{2,}】)/u.test(row.output)) return 'placeholder'
  if (/(.{16,})\1\1/su.test(row.output)) return 'repetition'
  if (row.output.length > Math.max(600, row.input.length * 6)) return 'extreme expansion'
  return ''
}
const stableHash = (value) => { let hash = 2166136261; for (const c of value) { hash ^= c.codePointAt(0); hash = Math.imul(hash, 16777619) } return hash >>> 0 }
const sort = (rows) => [...rows].sort((a, b) => stableHash(`${a.key}\0${a.input}`) - stableHash(`${b.key}\0${b.input}`) || a.key.localeCompare(b.key))
const splitTenPercent = (rows) => {
  const train = []; const valid = []
  for (const mode of modeOrder) {
    const bucket = sort(rows.filter((row) => row.mode === mode)); const n = Math.round(bucket.length * 0.1)
    valid.push(...bucket.slice(0, n)); train.push(...bucket.slice(n))
  }
  return { train, valid }
}
const signature = (row) => `${row.mode}\0${row.input}`
const dedupe = (rows, seen, duplicates, source) => rows.filter((row) => {
  const sig = signature(row); if (seen.has(sig)) { duplicates.push({ source, key: row.key, mode: row.mode }); return false } seen.add(sig); return true
})
const interleave = (rows) => {
  const buckets = new Map(modeOrder.map((mode) => [mode, sort(rows.filter((row) => row.mode === mode))])); const out = []
  while ([...buckets.values()].some((bucket) => bucket.length)) for (const mode of modeOrder) { const row = buckets.get(mode).shift(); if (row) out.push(row) }
  return out
}
const counts = (rows) => Object.fromEntries(modeOrder.map((mode) => [mode, rows.filter((row) => row.mode === mode).length]))
const assertCounts = (name, actual, expected) => { for (const mode of modeOrder) if (actual[mode] !== expected[mode]) throw new Error(`${name} ${mode}: ${actual[mode]} != ${expected[mode]}`) }

const sourceFiles = [
  ['baseTrain', path.join(distill, 'train.jsonl')], ['correctionsTrain', path.join(distill, 'corrections.jsonl')],
  ['baseValid', path.join(distill, 'valid.jsonl')], ['correctionsValid', path.join(distill, 'corrections_valid.jsonl')],
]
const filtered = []; const sources = {}
for (const [name, file] of sourceFiles) {
  const all = read(file).map(normalize); const accepted = all.filter((row) => { const reason = poison(row); if (reason) filtered.push({ source: path.basename(file), key: row.key, mode: row.mode, reason }); return !reason })
  sources[name] = { total: all.length, accepted }
}
const shortRows = read(shortFile).map(normalize); const longRows = read(longFile).map(normalize); const hardRows = read(hardFile).map(normalize)
assertCounts('short', counts(shortRows), expectedShort); assertCounts('long', counts(longRows), expectedLong)
const shortSplit = splitTenPercent(shortRows); const longSplit = splitTenPercent(longRows)
const duplicates = []; const trainSeen = new Set()
const baseTrain = dedupe(sources.baseTrain.accepted, trainSeen, duplicates, 'train.jsonl')
const correctionsTrain = dedupe(sources.correctionsTrain.accepted, trainSeen, duplicates, 'corrections.jsonl')
const shortTrain = dedupe(shortSplit.train, trainSeen, duplicates, 'codex.jsonl')
const longTrain = dedupe(longSplit.train, trainSeen, duplicates, 'codex_v3.jsonl')
const weighted = []
for (const row of shortTrain) { const weight = row.mode === 'tashih' ? 1 : hardModes.has(row.mode) ? 4 : 3; for (let i = 0; i < weight; i += 1) weighted.push(row) }
for (const row of longTrain) { const weight = row.mode === 'tashih' ? 1 : hardModes.has(row.mode) ? 3 : 2; for (let i = 0; i < weight; i += 1) weighted.push(row) }

const validSeen = new Set(); const baseValid = dedupe(sources.baseValid.accepted, validSeen, duplicates, 'valid.jsonl')
const correctionsValid = dedupe(sources.correctionsValid.accepted, validSeen, duplicates, 'corrections_valid.jsonl')
const shortValid = dedupe(shortSplit.valid, validSeen, duplicates, 'codex.jsonl validation')
const longValid = dedupe(longSplit.valid, validSeen, duplicates, 'codex_v3.jsonl validation')
for (const row of [...baseValid, ...correctionsValid, ...shortValid, ...longValid]) if (trainSeen.has(signature(row))) throw new Error(`train/validation leakage: ${row.key}`)
const hardSignatures = new Set(hardRows.map(signature))
for (const sig of trainSeen) if (hardSignatures.has(sig)) throw new Error('hard_test input leaked into training')
for (const row of [...baseValid, ...correctionsValid, ...shortValid, ...longValid]) if (hardSignatures.has(signature(row))) throw new Error(`hard_test input leaked into validation: ${row.key}`)

const train = interleave([...baseTrain, ...correctionsTrain, ...weighted])
const valid = interleave([...baseValid, ...correctionsValid, ...shortValid, ...longValid])
const trainText = `${train.map(JSON.stringify).join('\n')}\n`; const validText = `${valid.map(JSON.stringify).join('\n')}\n`
const sha = (text) => crypto.createHash('sha256').update(text).digest('hex')
const byReason = {}; for (const item of filtered) byReason[item.reason] = (byReason[item.reason] ?? 0) + 1
const manifest = {
  version: 3, liveModes: Object.keys(modes).length, onlineRuleLines: rules.split('\n').length,
  sourceRows: Object.fromEntries(Object.entries(sources).map(([name, value]) => [name, { total: value.total, accepted: value.accepted.length }])),
  codex: { short: { total: shortRows.length, train: shortTrain.length, valid: shortValid.length }, long: { total: longRows.length, train: longTrain.length, valid: longValid.length }, hardTest: { total: hardRows.length, included: 0 } },
  weights: { short: { tashih: 1, difficult: 4, other: 3 }, long: { tashih: 1, difficult: 3, other: 2 } },
  final: { trainRows: train.length, validRows: valid.length, trainModeCounts: counts(train), validModeCounts: counts(valid), sha256: { train: sha(trainText), valid: sha(validText) } },
  filteredCount: filtered.length, filteredByReason: byReason, filtered, duplicateCount: duplicates.length, duplicates,
}
fs.mkdirSync(outputDir, { recursive: true }); fs.writeFileSync(path.join(outputDir, 'train.jsonl'), trainText); fs.writeFileSync(path.join(outputDir, 'valid.jsonl'), validText); fs.writeFileSync(path.join(outputDir, 'preparation_manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`)
console.log(JSON.stringify({ status: 'PASS', trainRows: train.length, validRows: valid.length, trainModeCounts: manifest.final.trainModeCounts, validModeCounts: manifest.final.validModeCounts, hardTestIncluded: 0, filteredRows: filtered.length, duplicatesRemoved: duplicates.length, sha256: manifest.final.sha256 }, null, 2))
