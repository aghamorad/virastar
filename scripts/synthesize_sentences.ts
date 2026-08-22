// Synthesizes the messy, colloquial Persian seed sentences that expand the
// distillation dataset far beyond the hand-written SOURCES. The teacher writes
// a short text full of the slips a real user makes — نیم‌فاصله dropped,
// colloquial spellings, broken punctuation — and generate_dataset.ts later has
// it re-edit each sentence under every writing mode. Repeating the synthesis
// with a fresh pass number keeps the variety coming, so we can build a big
// training set from a small prompt budget.
//
// Usage (from repo root):
//   npx tsx scripts/synthesize_sentences.ts
// Env overrides:
//   SYNTH_COUNT=180      total sentences to produce
//   SYNTH_PASSES=5       cycle the prompt seeds that many times (per count)
//   OUTPUT=data/distill/synth_sentences.jsonl
// The run is resumable: existing synth ids are skipped.

import { appendFileSync, existsSync, mkdirSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const OLLAMA = 'http://localhost:11434/v1/chat/completions'
const TEACHER = 'gemma2:9b'
const TEMPERATURE = 0.9
const OUT = process.env.OUTPUT ?? join(ROOT, 'data', 'distill', 'synth_sentences.jsonl')
const COUNT = Number(process.env.SYNTH_COUNT ?? 180)
const PASSES = Number(process.env.SYNTH_PASSES ?? 5)

// Topic + format pairs. Together they steer the teacher's sentence so the
// dataset spans daily life, work, school, money, tech, health, travel — the
// things people actually type.
const THEMES: Array<[string, string]> = [
  ['برنامه آخر هفته و دعوت دوستان', 'پیام چت'],
  ['گزارش کاری و ددلاین', 'ایمیل کوتاه'],
  ['شکایت از گرانی و اجاره', 'پیام چت'],
  ['دور همی خانواده و عروسی', 'پیام چت'],
  ['درس و امتحان و استاد', 'پیام چت'],
  ['مشکل ماشین و رفتوآمد', 'پیام چت'],
  ['خرید آنلاین و سفارش', 'پیام چت'],
  ['آبوهوا و برنامه سفر', 'پیام چت'],
  ['مریضی و دکتر و دارو', 'پیام چت'],
  ['تکنولوژی و گوشی و اینترنت', 'پیام چت'],
  ['شغل و حقوق و بیکاری', 'پیام چت'],
  ['سینما و فیلم و سریال', 'پیام چت'],
  ['کتاب و مطالعه', 'پیام چت'],
  ['خواستگاری و تعارف', 'پیام چت'],
  ['پروژه و برنامهنویسی', 'پیام چت'],
  ['محله و همسایه و کوچه', 'پیام چت'],
  ['سرمایهگذاری و پول', 'یادداشت'],
  ['قرار ملاقات و ساعت', 'پیام چت'],
  ['تغذیه و رژیم و ورزش', 'پیام چت'],
  ['سفر جاده و ترافیک', 'پیام چت'],
  ['معلم و مدرسه بچهها', 'پیام چت'],
  ['رستوران و کباب و غذا', 'پیام چت'],
  ['خرید خانه و اجاره', 'پیام چت'],
  ['اعصاب و استرس و خستگی', 'پیام چت'],
  ['بهار و عید و سفر', 'پیام چت'],
  ['باران و سیل و اخبار', 'پیام چت'],
  ['گلایه از همکار و رئیس', 'پیام چت'],
  ['خرید هدیه و تولد', 'پیام چت'],
  ['شب و بیخوابی', 'پیام چت'],
  ['جشن و مهمانی شبانه', 'پیام چت'],
  ['وسایل خانه و تعمیر', 'یادداشت'],
  ['گزارش مترو و جاده', 'پیام چت'],
  ['دوری از شهر و دلتنگی', 'پیام چت'],
  ['تیم فوتبال و مسابقه', 'پیام چت'],
  ['نقد یک خرید گران', 'پیام چت'],
  ['امتحان رانندگی و کلاس', 'پیام چت'],
  ['گفتوگو با پزشک', 'پیام چت'],
  ['خبر کوتاه برای مادر', 'پیام چت'],
  ['پیگیری سفارش از فروشگاه', 'پیام چت'],
  ['تصمیم مهاجرت و بلاتکلیفی', 'پیام چت'],
]

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms))
}

interface SynthSentence {
  id: string
  text: string
  theme: string
}

/** The teacher at high temperature slips in glitches: real newlines, stray
 *  Latin junk like «arr» or «ggg», doubled spaces. Flatten those so the seed
 *  text reads like a pasted chat message. */
function cleanup(raw: string): string {
  return raw
    .replace(/\s*\n\s*/g, ' ') // newlines → spaces
    .replace(/[«"“']+|[»"”']+$/g, '')
    .replace(/\s{2,}/g, ' ')
    .replace(/(?<=[؀-ۿ])\b[a-z]{1,3}\b(?=[؀-ۿ])/g, '') // «بزarr» → «بز»
    .trim()
}

function loadSeen(file: string): Map<string, SynthSentence> {
  const seen = new Map<string, SynthSentence>()
  if (existsSync(file)) {
    for (const line of readFileSync(file, 'utf8').split('\n')) {
      if (!line.trim()) continue
      try {
        const r = JSON.parse(line) as SynthSentence
        seen.set(r.id, r)
      } catch {
        /* skip malformed line */
      }
    }
  }
  return seen
}

async function synthesize(theme: string, format: string, pass: number): Promise<string> {
  const prompt = `بنویس یک متن کوتاه فارسی (۱ تا ۳ جمله) درباره «${theme}» در قالب «${format}». آن را کاملاً محاورهای و غیررسمی بنویس، همانطور که یک کاربر معمولی در پیامرسان مینویسد: کلمات محاورهای (خونه، میخوام، میگه، برم، میشه)، نیمفاصلههای جاافتاده (می کنم بهجای میکنم)، نشانهگذاری ناقص یا غلط (نقطه و ویرگول و علامت سوال جاافتاده یا اضافه)، و جملههای نامرتب. ${pass > 0 ? 'این بار حالوهوا و جزئیات را کاملاً تازه و متفاوت از قبل بنویس.' : ''} فقط خود متن را بده؛ بدون توضیح و بدون نقلقول.`
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const res = await fetch(OLLAMA, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: TEACHER,
          messages: [{ role: 'user', content: prompt }],
          temperature: TEMPERATURE,
        }),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> }
      const out = data.choices?.[0]?.message?.content
      if (!out || !out.trim()) throw new Error('empty response')
      const clean = cleanup(out)
      if (clean.length < 8 || clean.length > 400) throw new Error(`bad length ${clean.length}`)
      return clean
    } catch (err) {
      if (attempt === 3) throw err
      await sleep(attempt * 3000)
    }
  }
  throw new Error('unreachable')
}

async function main(): Promise<void> {
  mkdirSync(dirname(OUT), { recursive: true })
  const seen = loadSeen(OUT)
  const start = Date.now()
  let made = 0
  let failed = 0

  for (let i = 1; i <= COUNT; i++) {
    const id = `synth${String(i).padStart(3, '0')}`
    if (seen.has(id)) continue
    const [theme, format] = THEMES[i % THEMES.length]
    const pass = Math.floor(i / THEMES.length)
    try {
      const text = await synthesize(theme, format, pass)
      appendFileSync(OUT, `${JSON.stringify({ id, text, theme } as SynthSentence)}\n`)
      made++
      if (made % 20 === 0) {
        const mins = ((Date.now() - start) / 60000).toFixed(1)
        process.stderr.write(`[${new Date().toISOString()}] ${made} new (${mins} min, ${failed} failed)\n`)
      }
    } catch (err) {
      failed++
      process.stderr.write(`FAILED ${id}: ${String(err)}\n`)
      if (failed >= 10) {
        process.stderr.write('Too many failures; aborting.\n')
        break
      }
    }
  }

  const total = seen.size + made
  process.stderr.write(`Done. ${made} new, ${total} total (${failed} failed).\n`)
}

void main()
