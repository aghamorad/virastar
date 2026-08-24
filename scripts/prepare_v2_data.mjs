#!/usr/bin/env node
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { fileURLToPath } from 'node:url'

const args = process.argv.slice(2)
const getArg = (name, fallback) => {
  const index = args.indexOf(name)
  return index >= 0 ? args[index + 1] : fallback
}
const repo = path.resolve(getArg('--repo', path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')))
const distill = path.join(repo, 'data/distill')
const outputDir = path.resolve(getArg('--output', path.join(distill, 'v2')))
const codexInput = getArg('--codex', 'codex.jsonl')
const failingModes = new Set(['rasmi', 'daneshgahi', 'edari', 'adabi', 'pachelhkhor', 'shaeraneh'])
const expectedCodexCounts = {
  tashih: 100,
  rasmi: 120,
  daneshgahi: 120,
  edari: 120,
  khodmani: 100,
  adabi: 120,
  lati: 100,
  taaroofi: 100,
  pachelhkhor: 120,
  naslezed: 100,
  shaeraneh: 120,
}

const parseModes = () => {
  const modeText = fs.readFileSync(path.join(repo, 'domain/modes.ts'), 'utf8')
  const onlineText = fs.readFileSync(path.join(repo, 'domain/engines/online.ts'), 'utf8')
  const modes = {}
  for (const match of modeText.matchAll(
    /id: '([^']+)'[\s\S]*?register: '([^']+)'[\s\S]*?instruction:\s*\n\s*'([^']*)'/g,
  )) modes[match[1]] = { register: match[2], instruction: match[3] }
  const rulesBlock = onlineText.match(/export const ONLINE_RULES = \[([\s\S]*?)\]\.join\('\\n'\)/)
  if (!rulesBlock) throw new Error('Could not parse ONLINE_RULES')
  const rules = [...rulesBlock[1].matchAll(/'([^']*)'/g)].map((m) => m[1]).join('\n')
  return { modes, rules }
}
const { modes, rules } = parseModes()
const modeOrder = Object.keys(expectedCodexCounts)

const readJsonl = (name) => {
  const file = path.isAbsolute(name) ? name : path.join(distill, name)
  return fs.readFileSync(file, 'utf8').split('\n').filter((line) => line.trim()).map((line, index) => {
    try { return JSON.parse(line) } catch (error) {
      throw new Error(`${name}:${index + 1}: invalid JSON: ${error.message}`)
    }
  })
}
const normalizeRecord = (row) => {
  const spec = modes[row.mode]
  if (!spec) throw new Error(`Unknown mode in ${row.key}: ${row.mode}`)
  const system = `${spec.instruction}\n\n${rules}`
  return {
    key: row.key,
    mode: row.mode,
    register: spec.register,
    system,
    input: row.input,
    output: row.output,
    messages: [
      { role: 'user', content: `${system}\n\n${row.input}` },
      { role: 'assistant', content: row.output },
    ],
  }
}
const poisonReason = (row) => {
  if (!/[\p{Script_Extensions=Arabic}]/u.test(row.output)) return 'no Persian output'
  for (const character of row.output) {
    if (/\p{Letter}/u.test(character) && !/\p{Script_Extensions=Arabic}/u.test(character)) {
      return `foreign-script letter ${JSON.stringify(character)}`
    }
  }
  if (/[0-9]/u.test(row.output)) return 'ASCII digit in output'
  if (/(از نو بساز|بازسازی کن|توضیح نده|یک ویراستار حرفه‌ای باش|متن را به زبان .* بازنویسی کن)/u.test(row.output)) {
    return 'prompt echo'
  }
  if (/(\[[^\]\n]{2,}\]|【[^】\n]{2,}】)/u.test(row.output)) return 'placeholder output'
  if (/(.{12,})\1\1/su.test(row.output)) return 'repeated long fragment'
  if (row.output.length > Math.max(600, row.input.length * 6)) return 'extreme output length'
  return ''
}
const filterPoison = (records, source, filtered) => records.filter((row) => {
  const reason = poisonReason(row)
  if (reason) filtered.push({ source, key: row.key, mode: row.mode, reason })
  return !reason
})
const inputSignature = (row) => `${row.mode}\u0000${row.input}`
const dedupe = (records, source, seen, removed) => records.filter((row) => {
  const signature = inputSignature(row)
  if (seen.has(signature)) {
    removed.push({ source, key: row.key, mode: row.mode, reason: 'duplicate mode/input' })
    return false
  }
  seen.add(signature)
  return true
})
const stableHash = (value) => {
  let hash = 2166136261
  for (const character of value) {
    hash ^= character.codePointAt(0)
    hash = Math.imul(hash, 16777619)
  }
  return hash >>> 0
}
const deterministicSort = (records) => [...records].sort((a, b) => {
  const difference = stableHash(`${a.key}\u0000${a.input}`) - stableHash(`${b.key}\u0000${b.input}`)
  return difference || a.key.localeCompare(b.key)
})
const interleaveByMode = (records) => {
  const buckets = new Map(modeOrder.map((mode) => [mode, []]))
  for (const row of records) buckets.get(row.mode)?.push(row)
  for (const [mode, rows] of buckets) buckets.set(mode, deterministicSort(rows))
  const output = []
  let remaining = true
  while (remaining) {
    remaining = false
    for (const mode of modeOrder) {
      const row = buckets.get(mode).shift()
      if (row) { output.push(row); remaining = true }
    }
  }
  return output
}
const countModes = (records) => {
  const counts = Object.fromEntries(modeOrder.map((mode) => [mode, 0]))
  for (const row of records) counts[row.mode] = (counts[row.mode] ?? 0) + 1
  return counts
}

const filtered = []
const duplicates = []
const baseTrain = filterPoison(readJsonl('train.jsonl').map(normalizeRecord), 'train.jsonl', filtered)
const baseValid = filterPoison(readJsonl('valid.jsonl').map(normalizeRecord), 'valid.jsonl', filtered)
const correctionsTrain = filterPoison(readJsonl('corrections.jsonl').map(normalizeRecord), 'corrections.jsonl', filtered)
const correctionsValid = filterPoison(readJsonl('corrections_valid.jsonl').map(normalizeRecord), 'corrections_valid.jsonl', filtered)
const codex = readJsonl(codexInput).map(normalizeRecord)

const codexCounts = countModes(codex)
for (const [mode, expected] of Object.entries(expectedCodexCounts)) {
  if (codexCounts[mode] !== expected) throw new Error(`codex ${mode}: ${codexCounts[mode]}, expected ${expected}`)
}
const codexTrain = []
const codexValid = []
for (const mode of modeOrder) {
  const modeRows = codex.filter((row) => row.mode === mode)
  const validCount = Math.round(modeRows.length * 0.10)
  const sorted = deterministicSort(modeRows)
  codexValid.push(...sorted.slice(0, validCount))
  codexTrain.push(...sorted.slice(validCount))
}

const seenTrain = new Set()
const uniqueBaseTrain = dedupe(baseTrain, 'train.jsonl', seenTrain, duplicates)
const uniqueCorrectionsTrain = dedupe(correctionsTrain, 'corrections.jsonl', seenTrain, duplicates)
const uniqueCodexTrain = dedupe(codexTrain, 'codex.jsonl train split', seenTrain, duplicates)
const weightedCodexTrain = []
for (const row of uniqueCodexTrain) {
  const weight = row.mode === 'tashih' ? 1 : failingModes.has(row.mode) ? 4 : 3
  for (let copy = 0; copy < weight; copy += 1) weightedCodexTrain.push(row)
}

const seenValid = new Set()
const uniqueBaseValid = dedupe(baseValid, 'valid.jsonl', seenValid, duplicates)
const uniqueCorrectionsValid = dedupe(correctionsValid, 'corrections_valid.jsonl', seenValid, duplicates)
const uniqueCodexValid = dedupe(codexValid, 'codex.jsonl valid split', seenValid, duplicates)
for (const row of uniqueCodexValid) {
  const signature = inputSignature(row)
  if (seenTrain.has(signature)) throw new Error(`train/valid leakage: ${row.key}`)
}

const finalTrain = interleaveByMode([
  ...uniqueBaseTrain,
  ...uniqueCorrectionsTrain,
  ...weightedCodexTrain,
])
const finalValid = interleaveByMode([
  ...uniqueBaseValid,
  ...uniqueCorrectionsValid,
  ...uniqueCodexValid,
])

fs.mkdirSync(outputDir, { recursive: true })
const trainText = `${finalTrain.map(JSON.stringify).join('\n')}\n`
const validText = `${finalValid.map(JSON.stringify).join('\n')}\n`
const sha256 = (value) => crypto.createHash('sha256').update(value).digest('hex')
fs.writeFileSync(path.join(outputDir, 'train.jsonl'), trainText, 'utf8')
fs.writeFileSync(path.join(outputDir, 'valid.jsonl'), validText, 'utf8')
const filteredByReason = {}
for (const row of filtered) {
  const reason = row.reason.startsWith('foreign-script letter') ? 'foreign-script letter' : row.reason
  filteredByReason[reason] = (filteredByReason[reason] ?? 0) + 1
}
const manifest = {
  version: 1,
  prompt: { liveModes: Object.keys(modes).length, onlineRuleLines: rules.split('\n').length },
  codex: {
    total: codex.length,
    sourceCounts: codexCounts,
    uniqueTrain: uniqueCodexTrain.length,
    uniqueValid: uniqueCodexValid.length,
    trainingWeights: { tashih: 1, failingModes: 4, otherModes: 3 },
  },
  sourceRows: {
    baseTrain: { total: readJsonl('train.jsonl').length, accepted: baseTrain.length },
    correctionsTrain: { total: readJsonl('corrections.jsonl').length, accepted: correctionsTrain.length },
    baseValid: { total: readJsonl('valid.jsonl').length, accepted: baseValid.length },
    correctionsValid: { total: readJsonl('corrections_valid.jsonl').length, accepted: correctionsValid.length },
  },
  final: {
    trainRows: finalTrain.length,
    validRows: finalValid.length,
    trainModeCounts: countModes(finalTrain),
    validModeCounts: countModes(finalValid),
    sha256: { train: sha256(trainText), valid: sha256(validText) },
  },
  filteredCount: filtered.length,
  filteredByReason,
  filtered,
  duplicateCount: duplicates.length,
  duplicates,
}
fs.writeFileSync(path.join(outputDir, 'preparation_manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`, 'utf8')
console.log(JSON.stringify({
  status: 'PASS',
  codexRows: manifest.codex.total,
  codexTrain: manifest.codex.uniqueTrain,
  codexValid: manifest.codex.uniqueValid,
  trainRows: manifest.final.trainRows,
  validRows: manifest.final.validRows,
  filteredRows: manifest.filteredCount,
  filteredByReason: manifest.filteredByReason,
  duplicatesRemoved: manifest.duplicateCount,
  sha256: manifest.final.sha256,
}, null, 2))
