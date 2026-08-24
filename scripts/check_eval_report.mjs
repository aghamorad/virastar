#!/usr/bin/env node
import fs from 'node:fs'
import path from 'node:path'

const args = process.argv.slice(2)
const getArg = (name, fallback) => {
  const index = args.indexOf(name)
  return index >= 0 ? args[index + 1] : fallback
}
const reportPath = path.resolve(getArg('--report', args.find((value) => !value.startsWith('--')) ?? 'data/distill/v2/eval_report.txt'))
const jsonPath = getArg('--json', '')

const text = fs.readFileSync(reportPath, 'utf8')
const blocks = text.split(/^={32,}\s*$/mu).map((block) => block.trim()).filter(Boolean)
const records = []
for (const block of blocks) {
  const header = block.match(/^(.+?)\s+\(mode:\s*([^\)]+)\)\s*$/mu)
  const input = block.match(/^INPUT\s*:\s*([\s\S]*?)(?=^TEACHER \(9B\):)/mu)
  const teacher = block.match(/^TEACHER \(9B\):\s*([\s\S]*?)(?=^SMALL \(2B\)\s*:)/mu)
  const small = block.match(/^SMALL \(2B\)\s*:\s*([\s\S]*)$/mu)
  if (!header || !input || !teacher || !small) throw new Error(`Malformed evaluation block: ${block.slice(0, 120)}`)
  records.push({
    key: header[1].trim(), mode: header[2].trim(), input: input[1].trim(),
    teacher: teacher[1].trim(), output: small[1].trim(),
  })
}
if (!records.length) throw new Error(`No evaluation records parsed from ${reportPath}`)

const modeOrder = ['tashih', 'rasmi', 'daneshgahi', 'edari', 'khodmani', 'adabi', 'lati', 'taaroofi', 'pachelhkhor', 'naslezed', 'shaeraneh']
const failingModes = new Set(['rasmi', 'daneshgahi', 'edari', 'adabi', 'pachelhkhor', 'shaeraneh'])
const stop = new Set('از به در با را که و یا این آن یک برای تا اما اگر چون روی زیر بعد قبل خود شده شود کرد کرده می ما من تو او شما آنها ایشان است بود هست نیست چه فقط هم هر خیلی باید شاید درباره مورد متن'.split(' '))
const normalizeDigits = (value) => value
  .replace(/[۰-۹]/gu, (digit) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(digit)))
  .replace(/[٠-٩]/gu, (digit) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(digit)))
const tokens = (value) => [...value.toLowerCase().matchAll(/[\p{Script_Extensions=Arabic}]{2,}/gu)]
  .map((match) => match[0].replace(/[يى]/gu, 'ی').replace(/ك/gu, 'ک').replace(/(ها|های|هایی|تر|ترین|ام|ات|اش|مان|تان|شان)$/u, ''))
  .filter((token) => token.length >= 2 && !stop.has(token))
const overlap = (left, right) => {
  const a = new Set(tokens(left)); const b = new Set(tokens(right))
  if (!a.size || !b.size) return 1
  let shared = 0
  for (const token of a) if ([...b].some((candidate) => candidate === token || (token.length >= 4 && candidate.length >= 4 && (token.includes(candidate) || candidate.includes(token))))) shared += 1
  return shared / Math.min(a.size, b.size)
}
const hasVoice = (mode, output) => {
  const patterns = {
    tashih: /./u,
    rasmi: /(خواهشمند|لطفاً|شایسته|مقتضی|بدین|احترام|اعلام|درخواست|ضروری|امکان|مطابق|بررسی|ارسال|پیگیری|پیشنهاد)/u,
    daneshgahi: /(پژوهش|تحلیل|مطالعه|داده|شواهد|نتایج|یافته|فرضیه|روش|نمونه|متغیر|نشان می‌دهد|بررسی|ارزیابی|همبستگی|علّی|نظری)/u,
    edari: /(احتراماً|بدین‌وسیله|خواهشمند است|دستور فرمایید|اقدام لازم|پیگیری|درخواست|اعلام|ابلاغ|بررسی|شماره|ثبت|واحد|مدارک|پیوست)/u,
    khodmani: /(یه|دیگه|آخه|خب|راستش|ببین|می‌خوام|نمی‌دونم|مون|تون|اومد|گفتن|کردم|باشه)/u,
    adabi: /(دل|سایه|روشن|خاموش|آسمان|کوچه|پنجره|باد|خاطره|روزگار|شب|صبح|جان|لبخند|سنگینی|قصه|رنگ)/u,
    lati: /(داداش|رفیق|حاجی|بابا|بی‌خیال|نامرد|دمت|حال|گیر|جور|جمعش|بزن|واسه|مگه|می‌گی)/u,
    taaroofi: /(لطف|محبت|زحمت|اختیار|قربان|شرمنده|ارادت|بزرگواری|ممنون|قدم|افتخار|بفرمایید|مزاحم)/u,
    pachelhkhor: /(استاد|نابغه|بی‌نظیر|شاهکار|افسانه|اعجوبه|تاریخ|جهان|کهکشان|سلطان|حضرت|درخشان|محشر|عظمت)/u,
    naslezed: /(وایب|خفن|باحال|کراش|فاز|ترند|سم|رد فلگ|نسل|جدی|واقعاً|کلاً|انگار|حس|می‌زنه|نمی‌ده)/u,
    shaeraneh: /(دل|شب|صبح|ماه|خورشید|آسمان|باران|باد|رود|دریا|سایه|رویا|پنجره|کوچه|خواب|ستاره|غروب|سپیده|پرنده)/u,
  }
  const structuralPoetry = mode === 'shaeraneh' && (output.includes('\n') || /[؛،].*[؛،]/u.test(output))
  return Boolean(patterns[mode]?.test(output) || structuralPoetry)
}
const repeatedLine = (value) => {
  const lines = value.split('\n').map((line) => line.trim()).filter((line) => line.length >= 12)
  return lines.some((line, index) => lines.indexOf(line) !== index)
}
const foreignLetter = (value) => [...value].find((character) => /\p{Letter}/u.test(character) && !/\p{Script_Extensions=Arabic}/u.test(character))
const promptEcho = /(متن را به زبان|بازنویسی کن|یک ویراستار حرفه‌ای|ویرایشگر حرفه‌ای|توضیح نده|فقط متن نهایی)/u
const issues = []
const add = (row, category, detail, severity = 'hard') => issues.push({ key: row.key, mode: row.mode, category, detail, severity })

for (const row of records) {
  if (!row.output) add(row, 'empty-output', 'output is empty')
  if (!/[\p{Script_Extensions=Arabic}]/u.test(row.output)) add(row, 'no-persian', 'output has no Persian-script character')
  const foreign = foreignLetter(row.output)
  if (foreign) add(row, 'foreign-script', `foreign letter ${JSON.stringify(foreign)}`)
  if (/[0-9]/u.test(row.output)) add(row, 'ascii-digit', 'output contains an ASCII digit')
  if (promptEcho.test(row.output)) add(row, 'prompt-echo', 'output repeats or discusses the editing instruction')
  if (repeatedLine(row.output) || /(.{12,})\1\1/su.test(row.output)) add(row, 'repetition', 'output repeats a long line or fragment')
  const inputNumbers = normalizeDigits(row.input).match(/\d+(?:[.,]\d+)?/gu) ?? []
  const outputNormalized = normalizeDigits(row.output)
  for (const number of inputNumbers) if (!outputNormalized.includes(number)) add(row, 'lost-number', `input number ${number} is missing`)
  const semanticOverlap = Math.max(overlap(row.input, row.output), overlap(row.teacher, row.output))
  if (semanticOverlap < 0.14) add(row, 'meaning-review', `lexical anchor overlap ${semanticOverlap.toFixed(3)}`, 'metric')
  if (row.mode !== 'tashih' && row.output === row.input) add(row, 'unchanged-register', 'non-correction output is identical to input')
  if (!hasVoice(row.mode, row.output)) add(row, 'register-review', 'no deterministic register marker found', 'metric')
}

const counts = Object.fromEntries(modeOrder.map((mode) => [mode, records.filter((row) => row.mode === mode).length]))
const hardIssues = issues.filter((issue) => issue.severity === 'hard')
const meaningIssues = issues.filter((issue) => issue.category === 'meaning-review')
const registerIssues = issues.filter((issue) => issue.category === 'register-review')
const modeVoice = {}
for (const mode of modeOrder) {
  const count = counts[mode]
  const misses = registerIssues.filter((issue) => issue.mode === mode).length
  modeVoice[mode] = count ? Number(((count - misses) / count).toFixed(3)) : null
}
const meaningRate = Number((meaningIssues.length / records.length).toFixed(3))
const acceptance = {
  noHardIssues: hardIssues.length === 0,
  meaningReviewRateAtMostTenPercent: meaningRate <= 0.10,
  failingModeVoiceAtLeastSeventyFivePercent: [...failingModes].every((mode) => counts[mode] > 0 && modeVoice[mode] >= 0.75),
  allModesRepresented: modeOrder.every((mode) => counts[mode] > 0),
}
const result = {
  report: reportPath,
  records: records.length,
  counts,
  hardIssues: hardIssues.length,
  hardIssuesByCategory: hardIssues.reduce((result, issue) => ({ ...result, [issue.category]: (result[issue.category] ?? 0) + 1 }), {}),
  meaningReviewCandidates: meaningIssues.length,
  meaningReviewRate: meaningRate,
  registerMarkerCoverage: modeVoice,
  acceptance,
  status: Object.values(acceptance).every(Boolean) ? 'PASS' : 'FAIL',
  issues,
}
const serialized = `${JSON.stringify(result, null, 2)}\n`
if (jsonPath) fs.writeFileSync(path.resolve(jsonPath), serialized, 'utf8')
process.stdout.write(serialized)
process.exit(result.status === 'PASS' ? 0 : 1)
