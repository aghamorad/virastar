#!/usr/bin/env node
import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const args = process.argv.slice(2)
const getArg = (name, fallback) => {
  const index = args.indexOf(name)
  return index >= 0 ? args[index + 1] : fallback
}
const repo = path.resolve(getArg('--repo', path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')))
const sourceDir = path.resolve(getArg('--source', path.join(repo, 'data/distill/v3')))
const outputDir = path.resolve(getArg('--output', path.join(repo, 'data/distill/v4')))
const hardFile = path.resolve(getArg('--hard-test', path.join(repo, 'data/distill/hard_test.jsonl')))

const read = (file) => fs.readFileSync(file, 'utf8').split('\n').filter(Boolean).map((line, index) => {
  try { return JSON.parse(line) } catch (error) { throw new Error(`${file}:${index + 1}: ${error.message}`) }
})
const normalizeDigits = (value) => value
  .replace(/[۰-۹]/gu, (digit) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(digit)))
  .replace(/[٠-٩]/gu, (digit) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(digit)))
const tokens = (value) => [...value.toLowerCase().matchAll(/[\p{Script_Extensions=Arabic}]{2,}/gu)]
  .map((match) => match[0].replace(/[يى]/gu, 'ی').replace(/ك/gu, 'ک').replace(/(ها|های|هایی|تر|ترین|ام|ات|اش|مان|تان|شان)$/u, ''))
  .filter((token) => token.length >= 2)
const overlap = (left, right) => {
  const a = new Set(tokens(left)); const b = new Set(tokens(right))
  if (!a.size || !b.size) return 1
  let shared = 0
  for (const token of a) {
    if ([...b].some((candidate) => candidate === token || (token.length >= 4 && candidate.length >= 4 && (token.includes(candidate) || candidate.includes(token))))) shared += 1
  }
  return shared / Math.min(a.size, b.size)
}
const rejectReason = (row) => {
  if (!row.output || !/[\p{Script_Extensions=Arabic}]/u.test(row.output)) return 'empty-or-no-Persian-output'
  for (const character of row.output) {
    if (/\p{Letter}/u.test(character) && !/\p{Script_Extensions=Arabic}/u.test(character)) return 'foreign-script-letter'
  }
  if (/[0-9]/u.test(row.output)) return 'ASCII-digit'
  if (/(متن را به زبان|بازنویسی کن|یک ویراستار حرفه‌ای|ویرایشگر حرفه‌ای|توضیح نده|فقط متن نهایی)/u.test(row.output)) return 'prompt-echo'
  if (row.mode !== 'tashih' && row.output.trim() === row.input.trim()) return 'unchanged-register'
  const inputNumbers = normalizeDigits(row.input).match(/\d+(?:[.,]\d+)?/gu) ?? []
  const output = normalizeDigits(row.output)
  if (inputNumbers.some((number) => !output.includes(number))) return 'lost-number'
  if (overlap(row.input, row.output) < 0.14) return 'weak-meaning-anchor'
  const ratio = row.output.length / Math.max(1, row.input.length)
  if (ratio < 0.2 || ratio > 4) return 'extreme-length-change'
  if (/(.{16,})\1\1/su.test(row.output)) return 'repetition'
  return ''
}
const signature = (row) => `${row.mode}\0${row.input}`
const sha = (text) => crypto.createHash('sha256').update(text).digest('hex')
const filter = (rows, split, rejected) => rows.filter((row) => {
  const reason = rejectReason(row)
  if (reason) rejected.push({ split, key: row.key, mode: row.mode, reason })
  return !reason
})

const sourceTrain = read(path.join(sourceDir, 'train.jsonl'))
const sourceValid = read(path.join(sourceDir, 'valid.jsonl'))
const hard = read(hardFile)
const hardSignatures = new Set(hard.map(signature))
const rejected = []
const train = filter(sourceTrain, 'train', rejected)
const valid = filter(sourceValid, 'valid', rejected)
for (const row of [...train, ...valid]) {
  if (hardSignatures.has(signature(row))) throw new Error(`hard-test leakage: ${row.key}`)
}
const trainSignatures = new Set(train.map(signature))
for (const row of valid) {
  if (trainSignatures.has(signature(row))) throw new Error(`train-validation leakage: ${row.key}`)
}
const trainText = `${train.map(JSON.stringify).join('\n')}\n`
const validText = `${valid.map(JSON.stringify).join('\n')}\n`
const rejectedByReason = rejected.reduce((result, item) => ({ ...result, [item.reason]: (result[item.reason] ?? 0) + 1 }), {})
const modeCounts = (rows) => rows.reduce((result, row) => ({ ...result, [row.mode]: (result[row.mode] ?? 0) + 1 }), {})
const manifest = {
  version: 4,
  source: sourceDir,
  policy: 'v3 plus strict preservation filters for numbers, semantic anchors, register changes, script, prompt echoes, repetition, and output length',
  sourceRows: { train: sourceTrain.length, valid: sourceValid.length },
  finalRows: { train: train.length, valid: valid.length },
  modeCounts: { train: modeCounts(train), valid: modeCounts(valid) },
  rejectedCount: rejected.length,
  rejectedByReason,
  rejected,
  hardTestRows: hard.length,
  hardTestIncluded: 0,
  sha256: { train: sha(trainText), valid: sha(validText) },
}
fs.mkdirSync(outputDir, { recursive: true })
fs.writeFileSync(path.join(outputDir, 'train.jsonl'), trainText)
fs.writeFileSync(path.join(outputDir, 'valid.jsonl'), validText)
fs.writeFileSync(path.join(outputDir, 'preparation_manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`)
console.log(JSON.stringify({ status: 'PASS', ...manifest }, null, 2))
