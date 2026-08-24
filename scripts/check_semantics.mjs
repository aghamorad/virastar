#!/usr/bin/env node
import fs from 'node:fs'
import path from 'node:path'

const args = process.argv.slice(2)
const getArg = (name, fallback) => {
  const index = args.indexOf(name)
  return index >= 0 ? args[index + 1] : fallback
}
const has = (name) => args.includes(name)
const endpoint = getArg('--endpoint', 'http://localhost:11434/v1/chat/completions')
const model = getArg('--model', 'gemma2:9b')
const evalReport = getArg('--eval-report', '')
const outputPath = getArg('--output', '')
const votes = Number(getArg('--votes', '2'))
const retries = Number(getArg('--retries', '3'))
const timeoutMs = Number(getArg('--timeout-ms', '90000'))
const delayMs = Number(getArg('--delay-ms', '250'))
const limit = Number(getArg('--limit', '0'))
const quiet = has('--quiet')

const positional = args.filter((value, index) => {
  if (value.startsWith('--')) return false
  const previous = args[index - 1]
  return !['--endpoint', '--model', '--eval-report', '--output', '--votes', '--retries', '--timeout-ms', '--delay-ms', '--limit'].includes(previous)
})

if (!evalReport && positional.length < 2) {
  console.error('Usage: check_semantics.mjs CANDIDATE.jsonl REFERENCE.jsonl [--output report.json]')
  console.error('   or: check_semantics.mjs --eval-report data/distill/eval_report.txt [--output report.json]')
  process.exit(2)
}
if (!Number.isInteger(votes) || votes < 1 || votes > 5) throw new Error('--votes must be an integer from 1 to 5')
if (!Number.isInteger(retries) || retries < 1 || retries > 8) throw new Error('--retries must be an integer from 1 to 8')

function readJsonl(file) {
  return fs.readFileSync(file, 'utf8').split('\n').filter((line) => line.trim()).map((line, index) => {
    try { return JSON.parse(line) } catch (error) { throw new Error(`${file}:${index + 1}: ${error.message}`) }
  })
}

function parseEvalReport(file) {
  const blocks = fs.readFileSync(file, 'utf8').split(/^={32,}\s*$/mu).map((block) => block.trim()).filter(Boolean)
  return blocks.map((block) => {
    const header = block.match(/^(.+?)\s+\(mode:\s*([^\)]+)\)\s*$/mu)
    const input = block.match(/^INPUT\s*:\s*([\s\S]*?)(?=^TEACHER \(9B\):)/mu)
    const reference = block.match(/^TEACHER \(9B\):\s*([\s\S]*?)(?=^SMALL \(2B\)\s*:)/mu)
    const candidate = block.match(/^SMALL \(2B\)\s*:\s*([\s\S]*)$/mu)
    if (!header || !input || !reference || !candidate) throw new Error(`Malformed eval block: ${block.slice(0, 120)}`)
    return {
      key: header[1].trim(), mode: header[2].trim(), input: input[1].trim(),
      reference: reference[1].trim(), candidate: candidate[1].trim(),
    }
  })
}

function loadPairs() {
  if (evalReport) return parseEvalReport(path.resolve(evalReport))
  const candidateFile = path.resolve(positional[0])
  const referenceFile = path.resolve(positional[1])
  const candidates = readJsonl(candidateFile)
  const references = readJsonl(referenceFile)
  if (new Set(candidates.map((row) => row.key)).size !== candidates.length) throw new Error('Candidate JSONL contains duplicate keys')
  if (new Set(references.map((row) => row.key)).size !== references.length) throw new Error('Reference JSONL contains duplicate keys')
  const candidateMap = new Map(candidates.map((row) => [row.key, row]))
  return references.map((reference) => {
    if (!reference.key) throw new Error('Every reference record must have a key')
    const candidate = candidateMap.get(reference.key)
    if (!candidate) throw new Error(`Candidate JSONL has no record for key ${reference.key}`)
    if (candidate.input && reference.input && candidate.input !== reference.input) throw new Error(`Input mismatch for key ${reference.key}`)
    const input = reference.input ?? candidate.input ?? ''
    const referenceOutput = reference.reference ?? reference.output ?? ''
    const candidateOutput = candidate.candidate ?? candidate.output ?? ''
    if (!input || !referenceOutput || !candidateOutput) throw new Error(`Missing input or output for key ${reference.key}`)
    return {
      key: reference.key,
      mode: reference.mode ?? candidate.mode ?? 'unknown',
      input,
      reference: referenceOutput,
      candidate: candidateOutput,
    }
  })
}

const pairs = loadPairs().slice(0, limit > 0 ? limit : undefined)
if (!pairs.length) throw new Error('No semantic pairs to judge')

const sleep = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds))
const retryableStatus = new Set([408, 409, 425, 429, 500, 502, 503, 504])
const systemPrompt = `تو داور سخت‌گیر برابری معنایی در بازنویسی فارسی هستی. متن ورودی، یک بازنویسی مرجع و یک بازنویسی نامزد را می‌بینی. فقط دربارهٔ حفظ معنا داوری کن؛ تفاوت لحن و قالب در حالت‌های رسمی، دانشگاهی، اداری، ادبی، شاعرانه، خودمانی، لاتی، تعارفی، نسل زد و پاچه‌خواری مجاز است. نامزد را رد کن اگر حتی یک واقعیت، فاعل، مفعول، زمان، عدد، درصد، نام، نفی، شرط، عدم قطعیت، ترتیب رخداد، درخواست یا رد محترمانه را حذف، وارونه یا اختراع کرده باشد. استعاره و اصطلاح مجاز است، به شرط آنکه همهٔ معنای قابل بازیابی باقی بماند. مرجع فقط راهنماست و ممکن است خودش ناقص باشد؛ نامزد را مستقیماً با ورودی بسنج. فقط یک شیء جیسون با کلیدهای verdict و reason و score و lost_points برگردان. verdict فقط PASS یا FAIL یا UNCERTAIN باشد. score عددی از صفر تا صد است. reason یک توضیح کوتاه فارسی و lost_points آرایه‌ای از نکات حذف یا تحریف‌شده است.`

function promptFor(pair, vote) {
  const angle = vote % 2 === 0
    ? 'این بار همهٔ گزاره‌ها را یکی‌یکی و به‌ویژه نفی‌ها، اعداد و شرط‌ها را وارسی کن.'
    : 'این بار بررسی کن آیا یک خواننده از نامزد دقیقاً همان رویدادها و خواسته‌های ورودی را می‌فهمد.'
  return `حالت: ${pair.mode}\n\nورودی اصلی:\n${pair.input}\n\nبازنویسی مرجع:\n${pair.reference}\n\nبازنویسی نامزد:\n${pair.candidate}\n\n${angle}`
}

function parseJudgment(content) {
  const cleaned = content.trim().replace(/^```(?:json)?\s*/iu, '').replace(/\s*```$/u, '')
  const match = cleaned.match(/\{[\s\S]*\}/u)
  if (!match) throw new Error(`teacher returned no JSON: ${cleaned.slice(0, 160)}`)
  const parsed = JSON.parse(match[0])
  let verdict = String(parsed.verdict ?? '').toUpperCase()
  if (['قبول', 'درست'].includes(parsed.verdict)) verdict = 'PASS'
  if (['رد', 'نادرست'].includes(parsed.verdict)) verdict = 'FAIL'
  if (['نامشخص', 'نامطمئن'].includes(parsed.verdict)) verdict = 'UNCERTAIN'
  if (!['PASS', 'FAIL', 'UNCERTAIN'].includes(verdict)) throw new Error(`invalid verdict ${JSON.stringify(parsed.verdict)}`)
  const score = Math.max(0, Math.min(100, Number(parsed.score)))
  return {
    verdict,
    reason: String(parsed.reason ?? '').trim() || 'دلیلی ارائه نشد.',
    score: Number.isFinite(score) ? score : verdict === 'PASS' ? 100 : verdict === 'FAIL' ? 0 : 50,
    lostPoints: Array.isArray(parsed.lost_points) ? parsed.lost_points.map(String) : [],
  }
}

async function requestVote(pair, vote) {
  let lastError = ''
  for (let attempt = 1; attempt <= retries; attempt += 1) {
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model,
          temperature: 0.15,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: promptFor(pair, vote) },
          ],
        }),
        signal: AbortSignal.timeout(timeoutMs),
      })
      const body = await response.text()
      if (!response.ok) {
        lastError = `HTTP ${response.status}: ${body.slice(0, 180)}`
        if (!retryableStatus.has(response.status)) break
      } else {
        const envelope = JSON.parse(body)
        const content = envelope.choices?.[0]?.message?.content ?? envelope.output ?? ''
        return { status: 'judged', ...parseJudgment(content), attempt }
      }
    } catch (error) {
      lastError = `${error.name ?? 'Error'}: ${error.message ?? String(error)}`
    }
    if (attempt < retries) await sleep(Math.min(15000, 1500 * (2 ** (attempt - 1))))
  }
  return { status: 'skipped', error: lastError || 'teacher unavailable after retries' }
}

function summarizeRecord(pair, recordVotes) {
  const judged = recordVotes.filter((vote) => vote.status === 'judged')
  if (!judged.length) return { ...pair, verdict: 'SKIP', reason: recordVotes.map((vote) => vote.error).filter(Boolean).join(' | '), agreement: null, votes: recordVotes }
  const verdicts = [...new Set(judged.map((vote) => vote.verdict))]
  const agreement = judged.length === votes ? verdicts.length === 1 : null
  const verdict = verdicts.length === 1 ? verdicts[0] : 'UNCERTAIN'
  const meanScore = Math.round(judged.reduce((sum, vote) => sum + vote.score, 0) / judged.length)
  const reasons = [...new Set(judged.map((vote) => vote.reason))]
  return { ...pair, verdict, reason: reasons.join(' | '), score: meanScore, agreement, votes: recordVotes }
}

function buildReport(results, completed, circuitOpen = false) {
  const judged = results.filter((row) => row.verdict !== 'SKIP')
  const passed = judged.filter((row) => row.verdict === 'PASS').length
  const failed = judged.filter((row) => row.verdict === 'FAIL').length
  const uncertain = judged.filter((row) => row.verdict === 'UNCERTAIN').length
  const skipped = results.filter((row) => row.verdict === 'SKIP').length
  const disagreements = results.filter((row) => row.agreement === false)
  const severity = { FAIL: 0, UNCERTAIN: 1, PASS: 2, SKIP: 3 }
  const worst = [...judged].sort((a, b) => severity[a.verdict] - severity[b.verdict] || (a.score ?? 50) - (b.score ?? 50)).slice(0, 5)
  const status = judged.length === 0 && completed === pairs.length
    ? 'UNAVAILABLE'
    : completed === pairs.length && skipped === 0
      ? 'COMPLETE'
      : 'PARTIAL'
  return {
    status,
    endpoint, model, votesPerRecord: votes,
    requestedRecords: pairs.length, completedRecords: completed,
    judgedRecords: judged.length, passed, failed, uncertain, skipped,
    passRate: judged.length ? Number((passed / judged.length).toFixed(4)) : null,
    teacherDisagreements: disagreements.map((row) => ({ key: row.key, mode: row.mode, votes: row.votes.map((vote) => vote.verdict ?? 'SKIP'), reason: row.reason })),
    circuitOpen,
    worstFive: worst.map((row) => ({ key: row.key, mode: row.mode, verdict: row.verdict, score: row.score, reason: row.reason })),
    records: results,
  }
}

function checkpoint(results, completed, circuitOpen = false) {
  const report = buildReport(results, completed, circuitOpen)
  if (outputPath) fs.writeFileSync(path.resolve(outputPath), `${JSON.stringify(report, null, 2)}\n`, 'utf8')
  return report
}

const results = []
let consecutiveFullySkipped = 0
let circuitOpen = false
for (let index = 0; index < pairs.length; index += 1) {
  const pair = pairs[index]
  if (circuitOpen) {
    results.push({ ...pair, verdict: 'SKIP', reason: 'teacher circuit open after three unavailable records', agreement: null, votes: [] })
    checkpoint(results, index + 1, true)
    continue
  }
  const recordVotes = []
  for (let vote = 0; vote < votes; vote += 1) {
    recordVotes.push(await requestVote(pair, vote))
    if (delayMs > 0 && vote + 1 < votes) await sleep(delayMs)
  }
  const result = summarizeRecord(pair, recordVotes)
  results.push(result)
  consecutiveFullySkipped = result.verdict === 'SKIP' ? consecutiveFullySkipped + 1 : 0
  if (consecutiveFullySkipped >= 3) circuitOpen = true
  if (!quiet) process.stdout.write(`[${index + 1}/${pairs.length}] ${pair.key} ${result.verdict} — ${result.reason}\n`)
  checkpoint(results, index + 1, circuitOpen)
  if (delayMs > 0 && index + 1 < pairs.length) await sleep(delayMs)
}

const report = checkpoint(results, pairs.length, circuitOpen)
process.stdout.write(`\nSemantic pass rate: ${report.passRate === null ? 'N/A' : `${(report.passRate * 100).toFixed(2)}%`} (${report.passed}/${report.judgedRecords}); failed=${report.failed}; uncertain=${report.uncertain}; skipped=${report.skipped}\n`)
if (report.teacherDisagreements.length) process.stdout.write(`Teacher disagreements: ${report.teacherDisagreements.map((row) => row.key).join(', ')}\n`)
process.stdout.write('Worst five:\n')
for (const row of report.worstFive) process.stdout.write(`- ${row.key} ${row.verdict} (${row.score}): ${row.reason}\n`)
// Network/model unavailability is represented as SKIP and is intentionally not a process error.
process.exit(0)
