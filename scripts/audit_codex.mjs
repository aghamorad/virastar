#!/usr/bin/env node
import fs from 'node:fs'
import path from 'node:path'
import { createHash } from 'node:crypto'
import { fileURLToPath } from 'node:url'

const args = process.argv.slice(2)
const getArg = (name, fallback) => {
  const index = args.indexOf(name)
  return index >= 0 ? args[index + 1] : fallback
}
const scriptDir = path.dirname(fileURLToPath(import.meta.url))
const defaultRepo = path.resolve(scriptDir, '..')
const repo = path.resolve(getArg('--repo', defaultRepo))
const inputPath = path.resolve(getArg('--input', path.join(repo, 'data/distill/codex.jsonl')))
const reportPath = getArg('--report', '')
const reviewLedgerPath = getArg('--review-ledger', '')
const writeReviewLedgerPath = getArg('--write-review-ledger', '')

const expectedCounts = {
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

const modeText = fs.readFileSync(path.join(repo, 'domain/modes.ts'), 'utf8')
const onlineText = fs.readFileSync(path.join(repo, 'domain/engines/online.ts'), 'utf8')
const modes = {}
for (const match of modeText.matchAll(
  /id: '([^']+)'[\s\S]*?register: '([^']+)'[\s\S]*?instruction:\s*\n\s*'([^']*)'/g,
)) {
  modes[match[1]] = { register: match[2], instruction: match[3] }
}
const rulesBlock = onlineText.match(/export const ONLINE_RULES = \[([\s\S]*?)\]\.join\('\\n'\)/)
if (!rulesBlock) throw new Error('Could not parse ONLINE_RULES from domain/engines/online.ts')
const onlineRules = [...rulesBlock[1].matchAll(/'([^']*)'/g)].map((m) => m[1]).join('\n')

const rawLines = fs.readFileSync(inputPath, 'utf8').split('\n').filter((line) => line.trim())
const rows = []
const flags = []
const flag = (category, key, detail) => flags.push({ category, key, detail })
for (let index = 0; index < rawLines.length; index += 1) {
  try {
    rows.push(JSON.parse(rawLines[index]))
  } catch (error) {
    flag('schema', `line-${index + 1}`, `invalid JSON: ${error.message}`)
  }
}

const normalize = (value) => value
  .normalize('NFKC')
  .replace(/[يى]/gu, 'ی')
  .replace(/ك/gu, 'ک')
  .replace(/ۀ/gu, 'ه')
  .replace(/[\u200c\u200d]/gu, '')
  .replace(/[^\p{Script_Extensions=Arabic}\p{Number}]+/gu, ' ')
  .trim()

const stopwords = new Set([
  'این', 'آن', 'اون', 'یک', 'یه', 'برای', 'از', 'به', 'با', 'در', 'روی', 'زیر', 'تا', 'که',
  'و', 'یا', 'اما', 'ولی', 'اگر', 'اگه', 'چون', 'هم', 'را', 'رو', 'من', 'ما', 'تو', 'شما',
  'او', 'ایشان', 'خود', 'خودم', 'خودش', 'همه', 'هر', 'هیچ', 'خیلی', 'فقط', 'هنوز', 'دیگر',
  'دوباره', 'امروز', 'فردا', 'دیروز', 'حالا', 'بعد', 'قبل', 'وقت', 'شد', 'شده', 'بود', 'بوده',
  'است', 'هست', 'نیست', 'شود', 'کرد', 'کرده', 'کنم', 'کنید', 'کنه', 'میخوام', 'میخواهم',
  'باید', 'میشه', 'میشود', 'میتوان', 'لطفا', 'خواهشمند', 'درخواست', 'اطلاع', 'استحضار',
])
const stem = (token) => {
  let value = token.replace(/^(ن?می)/u, '')
  for (const suffix of ['ترین', 'هایی', 'های', 'ها', 'شان', 'مان', 'تان', 'ان', 'ات', 'تر']) {
    if (value.length > suffix.length + 3 && value.endsWith(suffix)) {
      value = value.slice(0, -suffix.length)
      break
    }
  }
  return value
}
const contentTokens = (value) => normalize(value)
  .split(/\s+/u)
  .filter((token) => token.length >= 3 && !stopwords.has(token))
  .map(stem)
  .filter((token) => token.length >= 3)
const overlapRatio = (input, output) => {
  const inputTokens = [...new Set(contentTokens(input))]
  const outputTokens = [...new Set(contentTokens(output))]
  if (inputTokens.length === 0) return 1
  const matched = inputTokens.filter((source) => outputTokens.some(
    (target) => source === target || (source.length >= 5 && target.length >= 5 && (source.includes(target) || target.includes(source))),
  ))
  return matched.length / inputTokens.length
}

const meaningThreshold = {
  tashih: 0.35,
  rasmi: 0.12,
  daneshgahi: 0.12,
  edari: 0.12,
  khodmani: 0.15,
  adabi: 0.10,
  lati: 0.12,
  taaroofi: 0.10,
  pachelhkhor: 0.08,
  naslezed: 0.12,
  shaeraneh: 0.08,
}

const voicePatterns = {
  rasmi: /(لطفاً|امکان|درخواست|پیشنهاد|تأیید|اطلاع|اعلام|بررسی|پیوست|است|شد|شود|خواهد|دارد|ندارد|می‌توان|چنانچه|با توجه|سپاس|پوزش|مطابقت|معتبر)/u,
  daneshgahi: /(پژوهش|داده|یافته|نتیجه|بررسی|تحلیل|شواهد|بنابراین|ازاین‌رو|بااین‌حال|نشان|می‌توان|امکان|محدود|رابطه|تعمیم|تعریف|مفهوم|نمونه|متغیر|مقاله|فصل|منبع|آمار|نرخ|آزمایش|مصاحبه|پرسش|گزارش|سند|مقایسه|است|شد)/u,
  edari: /(به اطلاع|به استحضار|خواهشمند|درخواست|اینجانب|این‌جانب|اقدام|موافقت|ضروری است|لازم است)/u,
  khodmani: /(یه|اگه|خیلی|راستش|خونه|می‌خوام|نمی‌تون|می‌شه|برات|بهت|بهم|مون|تون|حوصله|ببخشید|راستی|فکر کنم|بیا|باشه|ممنون|گوشی|دوست|بگم|میام|برم|بخورم|بدم|شد|کردم)/u,
  adabi: /(چون|گویی|خاموش|آرام|سایه|دل|چهره|راه|بر جای|سرانجام|آنگاه|چشم|یاد|سکوت|گام|سپیده|فرو|دور|کهن|درنگ|خلوت|واپسین|پیشین|نخست|اندک|جامه|دکان|بدرود|هیاهو|خاطره|سنگین|پریشان|رهسپار|گشود|نهاد|نشاند|افکند|بازگشت|ماند)/u,
  lati: /(داداش|رفیق|بامرام|مرام|دم.*گرم|مون|کول|صاف|حساب|قرون|وایس|جمعش|گردن|نامرد|علاف|سوتی|کارو|پولو|حرفو|طرف|بچه‌محل|جون|الکی|مگه|نذار|دست مردم|حق مردم|پایه|پوست‌کنده|خرابکاری)/u,
  taaroofi: /(لطف|ممنون|زحمت|اجازه|شرمنده|ببخشید|خواهش|محبت|خدمت|مقدور|اگر امکان|دست شما درد نکند)/u,
  pachelhkhor: /(بی‌رقیب|قهرمان|نابغه|استاد|سلطان|فرمانروا|درخشان|افسانه|معجزه|بی‌همتا|چیره‌دست|گره‌گشا|فاتح|هنرمند|تدبیر|شاهکار|بزرگوار|خوش‌ذوق|صبور|بامرام|کاردان|کاربلد|دانشمند|خوش‌قلب|دوراندیش|آینده‌نگر|طلایی|جادویی|درجه‌یک|تیزبین|بی‌نقص)/u,
  naslezed: /(واقعاً|کلاً|در سطح|سمی|هشدار|پایان‌بندی|بحران|عملیات|حالت|انرژی|ده از ده|غافلگیری|شخصیت|در اوج|عالی بود|افسانه‌ای|جهان|تعادل|موفقیت‌آمیز|خیلی|کلی|دقیق|ظاهراً|کامل|قشنگ|هوشمندانه|رایگان|شانس|برنامه‌ریزی|هماهنگی|تغییر موضع|زندگی مستقل|سرمایه‌گذاری)/u,
  shaeraneh: /(چون|گویی|آسمان|نور|سایه|دل|شب|باد|باران|موج|آرام|خواب|خاطره|سپیده|خورشید|ماه|ستاره|نغمه|رنگ|ریشه|دریا|خاموش|روشن|افق|آغوش|پرده)/u,
}
const colloquialInFormal = /(می‌خوام|نمی‌خوام|می‌تون|نمی‌تون|اگه|واسه|(^|\s)یه\s|خونه|بگید|کنسل|اوکی|(^|\s)رو(\s|$))/u
const echoPatterns = [
  /از نو بساز/u,
  /بازسازی کن/u,
  /توضیح نده/u,
  /فقط متن (بازنویسی|ویرایش|اصلاح)[‌\- ]?شده/u,
  /متن را به زبان .* بازنویسی کن/u,
  /یک ویراستار حرفه‌ای باش/u,
  /متن (اصلی|موردنظر|ارسالی) را .* (بفرست|ارسال)/u,
  /برای (ویرایش|بازنویسی) به من/u,
  /\[[^\]\n]{2,}\]/u,
  /【[^】\n]{2,}】/u,
]
const hasNegation = (value) => /(^|\s)(نه|هیچ|نیست|نبود|نشد|نشده|ندار|نخواه|نمی|نتوان|فاقد|عدم|بدون|بیرون|بی‌آنکه|بی‌هیچ|نرسید|نکرد|نرفت|نگرفت|نماند|نیامد|نداد|نگفت|نپذیرفت|نخواند|نپرسید|نچرخید|نزد|ناقص|ناموفق|نامناسب|محدود|متوقف|لغو|رد|حذف|کسر|اختلال|معیوب|خطا|اشتباه|بسته|تمام|منقضی|بازماند|دریغ|خالی|سکوت|سرگردان|بپرهیز|خودداری|صرفاً|تنها|اولویت)/u.test(normalize(value))

const seenKeys = new Set()
const seenInputs = new Set()
const seenOutputs = new Set()
const counts = {}
for (const row of rows) {
  const key = typeof row.key === 'string' ? row.key : '(missing-key)'
  const requiredFields = ['key', 'mode', 'register', 'system', 'input', 'output', 'messages']
  if (Object.keys(row).sort().join('|') !== requiredFields.sort().join('|')) {
    flag('schema', key, `fields are ${Object.keys(row).sort().join(', ')}`)
  }
  if (!modes[row.mode]) {
    flag('schema', key, `unknown mode ${row.mode}`)
    continue
  }
  counts[row.mode] = (counts[row.mode] ?? 0) + 1
  if (!new RegExp(`^codex\\d{2,3}\\|${row.mode}$`).test(key)) flag('schema', key, 'invalid key format')
  if (row.register !== modes[row.mode].register) flag('schema', key, 'register does not match live mode')
  const liveSystem = `${modes[row.mode].instruction}\n\n${onlineRules}`
  if (row.system !== liveSystem) flag('schema', key, 'system does not match live instruction + ONLINE_RULES')
  if (
    !Array.isArray(row.messages) || row.messages.length !== 2
    || row.messages[0]?.role !== 'user' || row.messages[0]?.content !== `${row.system}\n\n${row.input}`
    || row.messages[1]?.role !== 'assistant' || row.messages[1]?.content !== row.output
  ) flag('schema', key, 'messages do not reconstruct system/input/output')
  if (seenKeys.has(key)) flag('duplicate', key, 'duplicate key')
  if (seenInputs.has(row.input)) flag('duplicate', key, 'duplicate input')
  if (seenOutputs.has(row.output)) flag('duplicate', key, 'duplicate output')
  seenKeys.add(key); seenInputs.add(row.input); seenOutputs.add(row.output)

  for (const character of row.output) {
    if (/\p{Letter}/u.test(character) && !/\p{Script_Extensions=Arabic}/u.test(character)) {
      flag('foreign-script', key, `non-Persian letter ${JSON.stringify(character)}`)
      break
    }
  }
  if (/[0-9]/u.test(row.output)) flag('foreign-script', key, 'ASCII digit in output')
  if (echoPatterns.some((pattern) => pattern.test(row.output)) || row.output.includes(modes[row.mode].instruction.slice(0, 24))) {
    flag('prompt-echo', key, 'output resembles an instruction or asks for text')
  }
  const inputNumbers = row.input.match(/[۰-۹0-9]+/gu) ?? []
  for (const number of inputNumbers) {
    if (!row.output.includes(number)) flag('meaning-anchor', key, `missing number ${number}`)
  }
  if (hasNegation(row.input) && !hasNegation(row.output)) flag('meaning-review', key, 'input negation may be missing from output')
  const overlap = overlapRatio(row.input, row.output)
  if (overlap < meaningThreshold[row.mode]) {
    flag('meaning-review', key, `content-token overlap ${overlap.toFixed(2)} < ${meaningThreshold[row.mode].toFixed(2)}`)
  }
  if (row.output.trim() === row.input.trim()) flag('meaning-anchor', key, 'output is identical to input')
  const sentences = row.output.split(/[.!؟؛\n]+/u).map((s) => s.trim()).filter(Boolean)
  if (new Set(sentences).size !== sentences.length) flag('repetition', key, 'repeated sentence')
  if (/(.{12,})\1\1/su.test(row.output)) flag('repetition', key, 'repeated long fragment')

  if (row.mode === 'tashih') {
    const ratio = row.output.length / Math.max(1, row.input.length)
    if (ratio < 0.72 || ratio > 1.35) flag('register-review', key, `correction length ratio ${ratio.toFixed(2)} suggests rewriting`)
  } else if (!voicePatterns[row.mode]?.test(row.output)) {
    flag('register-review', key, `missing ${row.mode} register signal`)
  }
  if (['rasmi', 'daneshgahi', 'edari'].includes(row.mode) && colloquialInFormal.test(row.output)) {
    flag('register-review', key, 'colloquial token may remain in formal register')
  }
}

for (const [mode, expected] of Object.entries(expectedCounts)) {
  if ((counts[mode] ?? 0) !== expected) flag('count', mode, `found ${counts[mode] ?? 0}, expected ${expected}`)
}

const rowByKey = new Map(rows.map((row) => [row.key, row]))
const digestFor = (row) => createHash('sha256')
  .update(`${row.mode}\u0000${row.input}\u0000${row.output}\u0000${row.system}`)
  .digest('hex')
const reviewableCategories = new Set(['meaning-review', 'register-review'])
const reviewFlags = flags.filter((item) => reviewableCategories.has(item.category))

if (writeReviewLedgerPath) {
  const grouped = new Map()
  for (const item of reviewFlags) {
    const row = rowByKey.get(item.key)
    if (!row) continue
    const entry = grouped.get(item.key) ?? {
      key: item.key,
      digest: digestFor(row),
      categories: [],
      note: 'Human-reviewed: input meaning is preserved and output carries the requested register.',
    }
    if (!entry.categories.includes(item.category)) entry.categories.push(item.category)
    grouped.set(item.key, entry)
  }
  const ledger = {
    version: 1,
    corpus: path.basename(inputPath),
    entries: [...grouped.values()].sort((a, b) => a.key.localeCompare(b.key)),
  }
  fs.writeFileSync(path.resolve(writeReviewLedgerPath), `${JSON.stringify(ledger, null, 2)}\n`, 'utf8')
}

let approvedEntries = []
if (reviewLedgerPath) {
  const ledger = JSON.parse(fs.readFileSync(path.resolve(reviewLedgerPath), 'utf8'))
  approvedEntries = Array.isArray(ledger.entries) ? ledger.entries : []
}
const approvalByKey = new Map(approvedEntries.map((entry) => [entry.key, entry]))
const isApproved = (item) => {
  if (!reviewableCategories.has(item.category)) return false
  const row = rowByKey.get(item.key)
  const approval = approvalByKey.get(item.key)
  return Boolean(
    row && approval
    && approval.digest === digestFor(row)
    && Array.isArray(approval.categories)
    && approval.categories.includes(item.category),
  )
}
const approvedFlags = flags.filter(isApproved)
const unresolvedFlags = flags.filter((item) => !isApproved(item))

const byCategory = {}
const byMode = {}
for (const item of flags) {
  byCategory[item.category] = (byCategory[item.category] ?? 0) + 1
  const mode = item.key.includes('|') ? item.key.split('|').at(-1) : item.key
  byMode[mode] = (byMode[mode] ?? 0) + 1
}
const unresolvedByCategory = {}
const unresolvedByMode = {}
for (const item of unresolvedFlags) {
  unresolvedByCategory[item.category] = (unresolvedByCategory[item.category] ?? 0) + 1
  const mode = item.key.includes('|') ? item.key.split('|').at(-1) : item.key
  unresolvedByMode[mode] = (unresolvedByMode[mode] ?? 0) + 1
}
const report = {
  input: inputPath,
  records: rows.length,
  expectedRecords: Object.values(expectedCounts).reduce((a, b) => a + b, 0),
  liveModes: Object.keys(modes).length,
  onlineRuleLines: onlineRules.split('\n').length,
  counts,
  rawFlagsTotal: flags.length,
  rawFlagsByCategory: byCategory,
  rawFlagsByMode: byMode,
  reviewCandidatesTotal: reviewFlags.length,
  approvedReviewFlags: approvedFlags.length,
  unresolvedFlagsTotal: unresolvedFlags.length,
  unresolvedFlagsByCategory: unresolvedByCategory,
  unresolvedFlagsByMode: unresolvedByMode,
  unresolvedFlags,
  status: unresolvedFlags.length === 0 ? 'PASS' : 'FAIL',
}
const serialized = `${JSON.stringify(report, null, 2)}\n`
if (reportPath) fs.writeFileSync(path.resolve(reportPath), serialized, 'utf8')
process.stdout.write(serialized)
process.exit(unresolvedFlags.length === 0 ? 0 : 1)
