#!/usr/bin/env node
import fs from 'node:fs'
import path from 'node:path'

const args = process.argv.slice(2)
const getArg = (name, fallback) => {
  const index = args.indexOf(name)
  return index >= 0 ? args[index + 1] : fallback
}
const repo = path.resolve(getArg('--repo', path.resolve(path.dirname(new URL(import.meta.url).pathname), '..')))
const inputPath = path.resolve(getArg('--input', path.join(repo, 'data/distill/codex_v3.jsonl')))
const reportPath = getArg('--report', '')
const modeOrder = ['tashih', 'rasmi', 'daneshgahi', 'edari', 'khodmani', 'adabi', 'lati', 'taaroofi', 'pachelhkhor', 'naslezed', 'shaeraneh']

function parseLivePrompts() {
  const modeText = fs.readFileSync(path.join(repo, 'domain/modes.ts'), 'utf8')
  const onlineText = fs.readFileSync(path.join(repo, 'domain/engines/online.ts'), 'utf8')
  const modes = {}
  for (const match of modeText.matchAll(/id: '([^']+)'[\s\S]*?register: '([^']+)'[\s\S]*?instruction:\s*\n\s*'([^']*)'/g)) {
    modes[match[1]] = { register: match[2], instruction: match[3] }
  }
  const block = onlineText.match(/export const ONLINE_RULES = \[([\s\S]*?)\]\.join\('\\n'\)/)
  if (!block) throw new Error('Could not parse ONLINE_RULES')
  return { modes, rules: [...block[1].matchAll(/'([^']*)'/g)].map((match) => match[1]).join('\n') }
}
const { modes, rules } = parseLivePrompts()

const lines = fs.readFileSync(inputPath, 'utf8').split('\n').filter((line) => line.trim())
const rows = lines.map((line, index) => {
  try { return JSON.parse(line) } catch (error) { throw new Error(`${inputPath}:${index + 1}: ${error.message}`) }
})
const flags = []
const flag = (row, category, detail) => flags.push({ key: row?.key ?? '(record)', mode: row?.mode ?? '(unknown)', category, detail })
const countSentences = (text) => text.split(/(?<=[.!؟!])\s+/u).map((part) => part.trim()).filter(Boolean).length
const normalizeDigits = (value) => value
  .replace(/[۰-۹]/gu, (digit) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(digit)))
  .replace(/[٠-٩]/gu, (digit) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(digit)))
const stop = new Set('از به در با را که و یا این آن یک برای تا اما اگر چون روی زیر بعد قبل خود شده شود کرد کرده می ما من تو او شما آنها ایشان است بود هست نیست چه فقط هم هر خیلی باید شاید درباره مورد متن پیام موضوع'.split(' '))
const contentTokens = (value) => [...value.toLowerCase().matchAll(/[\p{Script_Extensions=Arabic}]{3,}/gu)]
  .map((match) => match[0].replace(/[يى]/gu, 'ی').replace(/ك/gu, 'ک').replace(/(ها|های|هایی|تر|ترین|ام|ات|اش|مان|تان|شان)$/u, ''))
  .filter((token) => token.length >= 3 && !stop.has(token))
const overlap = (input, output) => {
  const source = new Set(contentTokens(input)); const target = new Set(contentTokens(output))
  if (!source.size) return 1
  let shared = 0
  for (const token of source) if ([...target].some((candidate) => candidate === token || (token.length >= 5 && candidate.length >= 5 && (token.includes(candidate) || candidate.includes(token))))) shared += 1
  return shared / source.size
}
const voicePatterns = {
  tashih: /./u,
  rasmi: /(مایلم|ضروری است|انتظار دارم|هدف از|لطفاً|ازاین‌رو|با توجه|درخواست|ارسال|اعلام)/u,
  daneshgahi: /(یادداشت|صورت‌بندی|تحلیل|بررسی|نتیجه|شواهد|پژوهش|بنابراین|اطمینان یافت)/u,
  edari: /(به استحضار می‌رساند|به آگاهی می‌رساند|احتراماً|خواهشمند است|اقدام لازم|تأکید می‌شود|مقتضی است|دستور فرمایید|شایان ذکر|مکلف است)/u,
  khodmani: /(رو |توی|می‌خوام|قراره|حواسمون|یه |دیگه|راستش)/u,
  adabi: /(واژه|سایه|ماجرا|گفت‌وگو|امید|فراموش|چهره|روشن|خاموش|روزگار)/u,
  lati: /(رفیق|داداش|حاجی|بابا|حرف حساب|صاف و پوست‌کنده|مراماً|واسه)/u,
  taaroofi: /(با عرض پوزش|اگر لطف|ممنون می‌شوم|خواهش می‌کنم|بزرگواری|زحمت|سپاس|امتنان|جسارت|صلاح بدانید|پیشاپیش)/u,
  pachelhkhor: /(بی‌رقیب|تدبیر|افسانه‌ای|تیزبین|استاد|نابغه|درخشان|شاهکار|گره‌گشا|ذهن|شگفت|خارق|عقاب|بی‌خطا)/u,
  naslezed: /(واقعاً|یه |توی|خلاصه|سمی|وایب|جدی|کل ماجرا|تکلیفش)/u,
  shaeraneh: /(واژه|رشته|چراغ|حقیقت|امید|دهان خواهد گشود|چون|سایه|آسمان|شب|صبح|جویبار|نسیم|ساحل|باد|آرزو|گذر|روایت)/u,
}

const seenKeys = new Set(); const seenInputs = new Set(); const seenOutputs = new Set()
const inputSentenceFrequency = new Map(); const outputSentenceFrequency = new Map()
const counts = Object.fromEntries(modeOrder.map((mode) => [mode, 0]))
const sentenceCounts = {}; const trapCounts = {}
for (const mode of modeOrder) trapCounts[mode] = { meta: 0, mixedScript: 0, ambiguous: 0, refusal: 0, nested: 0 }

for (let index = 0; index < rows.length; index += 1) {
  const row = rows[index]
  const expectedFields = ['key', 'mode', 'register', 'system', 'input', 'output', 'messages']
  if (JSON.stringify(Object.keys(row)) !== JSON.stringify(expectedFields)) flag(row, 'schema', `unexpected field order/set: ${Object.keys(row).join(',')}`)
  if (!modeOrder.includes(row.mode)) { flag(row, 'schema', `unknown mode ${row.mode}`); continue }
  counts[row.mode] += 1
  const expectedKey = `codexv3${String(counts[row.mode]).padStart(3, '0')}|${row.mode}`
  if (row.key !== expectedKey) flag(row, 'schema', `key should be ${expectedKey}`)
  const spec = modes[row.mode]
  const system = `${spec.instruction}\n\n${rules}`
  if (row.register !== spec.register) flag(row, 'schema', `register should be ${spec.register}`)
  if (row.system !== system) flag(row, 'schema', 'system does not match live prompt')
  if (!Array.isArray(row.messages) || row.messages.length !== 2 || row.messages[0]?.role !== 'user' || row.messages[1]?.role !== 'assistant') {
    flag(row, 'schema', 'messages must be one user and one assistant turn')
  } else {
    if (row.messages[0].content !== `${system}\n\n${row.input}`) flag(row, 'schema', 'user message mismatch')
    if (row.messages[1].content !== row.output) flag(row, 'schema', 'assistant message mismatch')
  }
  if (seenKeys.has(row.key)) flag(row, 'uniqueness', 'duplicate key'); seenKeys.add(row.key)
  if (seenInputs.has(row.input)) flag(row, 'uniqueness', 'duplicate input'); seenInputs.add(row.input)
  if (seenOutputs.has(row.output)) flag(row, 'uniqueness', 'duplicate output'); seenOutputs.add(row.output)
  const sentences = countSentences(row.input)
  for (const sentence of row.input.split(/(?<=[.!؟!])\s+/u).map((part) => part.trim()).filter(Boolean)) inputSentenceFrequency.set(sentence, (inputSentenceFrequency.get(sentence) ?? 0) + 1)
  for (const sentence of row.output.split(/(?<=[.!؟!])\s+/u).map((part) => part.trim()).filter(Boolean)) outputSentenceFrequency.set(sentence, (outputSentenceFrequency.get(sentence) ?? 0) + 1)
  sentenceCounts[sentences] = (sentenceCounts[sentences] ?? 0) + 1
  if (sentences < 3 || sentences > 8) flag(row, 'long-input', `input has ${sentences} sentences; expected 3-8`)
  if (countSentences(row.output) < 3) flag(row, 'coverage', 'output has fewer than three sentences')
  if (!/[\p{Script_Extensions=Arabic}]/u.test(row.output)) flag(row, 'script', 'output has no Persian-script character')
  const foreign = [...row.output].find((character) => /\p{Letter}/u.test(character) && !/\p{Script_Extensions=Arabic}/u.test(character))
  if (foreign) flag(row, 'foreign-script', `foreign output letter ${JSON.stringify(foreign)}`)
  if (/[0-9]/u.test(row.output)) flag(row, 'foreign-script', 'ASCII digit in output')
  if (/(این چند جمله رو|متن اصلی رو بفرستم|بازنویسی کن|متن را به زبان|یک ویراستار حرفه‌ای|توضیح نده|placeholder)/iu.test(row.output)) flag(row, 'meta-echo', 'output echoes an instruction')
  if (/(.{18,})\1\1/su.test(row.output)) flag(row, 'repetition', 'long fragment repeats three times')
  const inputNumbers = normalizeDigits(row.input).match(/\d+(?:[.,]\d+)?/gu) ?? []
  const outputNumbers = normalizeDigits(row.output)
  for (const number of inputNumbers) if (!outputNumbers.includes(number)) flag(row, 'meaning', `numeric anchor ${number} is missing`)
  const semanticOverlap = overlap(row.input.replace(/^این چند جمله[^.؟!]*[.؟!]\s*/u, ''), row.output)
  if (semanticOverlap < 0.16) flag(row, 'meaning-review', `content-token overlap ${semanticOverlap.toFixed(3)} < 0.16`)
  if (!voicePatterns[row.mode].test(row.output)) flag(row, 'register-review', `missing ${row.mode} register marker`)
  if (row.output.length < row.input.length * 0.45) flag(row, 'coverage', 'output is less than 45% of input length')
  if (row.output.length > row.input.length * 2.4) flag(row, 'coverage', 'output is more than 240% of input length')
  if (/^این چند جمله رو/u.test(row.input)) trapCounts[row.mode].meta += 1
  if (/[A-Za-z]/u.test(row.input)) trapCounts[row.mode].mixedScript += 1
  if (/همون قبلی/u.test(row.input)) trapCounts[row.mode].ambiguous += 1
  if (/نمی‌تونم مسئولیت/u.test(row.input)) trapCounts[row.mode].refusal += 1
  if (/می‌خوام اول .* بعد .*؛ اگر/u.test(row.input)) trapCounts[row.mode].nested += 1
}
const maxInputSentenceRepeat = Math.max(...inputSentenceFrequency.values())
const maxOutputSentenceRepeat = Math.max(...outputSentenceFrequency.values())
if (maxInputSentenceRepeat > 5) flag({ key: '(corpus)', mode: '(all)' }, 'diversity', `one input sentence repeats ${maxInputSentenceRepeat} times; maximum is 5`)
if (maxOutputSentenceRepeat > 3) flag({ key: '(corpus)', mode: '(all)' }, 'diversity', `one output sentence repeats ${maxOutputSentenceRepeat} times; maximum is 3`)
for (const mode of modeOrder) {
  if (counts[mode] !== 120) flag({ key: mode, mode }, 'count', `${counts[mode]} records; expected 120`)
  for (const [kind, count] of Object.entries(trapCounts[mode])) if (count < 20) flag({ key: mode, mode }, 'trap-coverage', `${kind} has ${count}; expected at least 20`)
}
if (rows.length !== 1320) flag({ key: '(corpus)', mode: '(all)' }, 'count', `${rows.length} records; expected 1320`)

const byCategory = flags.reduce((result, item) => ({ ...result, [item.category]: (result[item.category] ?? 0) + 1 }), {})
const report = {
  input: inputPath,
  records: rows.length,
  expectedRecords: 1320,
  liveModes: Object.keys(modes).length,
  onlineRuleLines: rules.split('\n').length,
  counts,
  uniqueKeys: seenKeys.size,
  uniqueInputs: seenInputs.size,
  uniqueOutputs: seenOutputs.size,
  inputSentenceCounts: sentenceCounts,
  sentenceDiversity: {
    uniqueInputSentences: inputSentenceFrequency.size,
    uniqueOutputSentences: outputSentenceFrequency.size,
    maxInputSentenceRepeat,
    maxOutputSentenceRepeat,
  },
  trapCounts,
  foreignScriptFlags: flags.filter((item) => item.category === 'foreign-script').length,
  unresolvedReviewFlags: flags.filter((item) => item.category.endsWith('-review')).length,
  unresolvedFlagsTotal: flags.length,
  unresolvedFlagsByCategory: byCategory,
  unresolvedFlags: flags,
  status: flags.length ? 'FAIL' : 'PASS',
}
const serialized = `${JSON.stringify(report, null, 2)}\n`
if (reportPath) fs.writeFileSync(path.resolve(reportPath), serialized, 'utf8')
process.stdout.write(serialized)
process.exit(flags.length ? 1 : 0)
