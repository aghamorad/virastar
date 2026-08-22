// Pulls real Persian writing from the open web so the training set spans the
// actual register spectrum, not just the synthesizer's made-up chats. News
// feeds give clean, formal prose — the register the app's رسمى/دانشگاهی/
// اداری modes work on. Each RSS item (headline + summary) becomes a short
// source: real sentences, real facts, real word order. Casual/tweet/telegram
// registers are covered by synthesize_sentences.ts, which can't be scraped
// without auth.
//
// Usage (from repo root):
//   npx tsx scripts/fetch_sources.ts
// Writes data/distill/web_sources.jsonl ({id, text, register}).

import { appendFileSync, mkdirSync, existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const OUT = join(ROOT, 'data', 'distill', 'web_sources.jsonl')

// Register label describes the INPUT style so we can sanity-check balance later.
const FEEDS: Array<{ name: string; url: string }> = [
  { name: 'bbc', url: 'https://feeds.bbci.co.uk/persian/rss.xml' },
  { name: 'isna', url: 'https://www.isna.ir/rss' },
  { name: 'mehr', url: 'https://www.mehrnews.com/rss' },
]

// Hard cap per feed; enough to build a real-formal slice without flooding the
// dataset with near-duplicate headlines.
const PER_FEED = 8

interface WebSource {
  id: string
  text: string
  register: string
}

function stripHtml(s: string): string {
  return s
    .replace(/<![^>]*>/g, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&[a-z]+;/gi, ' ')
    .replace(/&#\d+;/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/(?<=[؀-ۿ])\s*\b[a-z]{1,4}\b\s*(?=[؀-ۿ])/g, ' ') // stray «رهبرd» junk
    .replace(/\s{2,}/g, ' ')
    .trim()
}

function sentencify(raw: string): string[] {
  // Break on real sentence ends only — never mid-sentence. Sentences over 32
  // words are dropped (too long for a seed); short neighbours are merged up to
  // a comfortable seed length.
  const sentences = raw
    .split(/(?<=[.!؟…]) +/)
    .map((s) => s.trim())
    .filter((s) => /[؀-ۿ]/.test(s))
    .filter((s) => s.split(/\s+/).length <= 32)
  const chunks: string[] = []
  for (const s of sentences) {
    const last = chunks[chunks.length - 1]
    const w = s.split(/\s+/).length
    if (last && w + last.split(/\s+/).length <= 28) {
      chunks[chunks.length - 1] = `${last} ${s}`
    } else {
      chunks.push(s)
    }
  }
  return chunks.filter((s) => s.split(/\s+/).length >= 3)
}

async function fetchRss(url: string): Promise<string> {
  const res = await fetch(url, { headers: { 'user-agent': 'Mozilla/5.0' } })
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`)
  return res.text()
}

function extractItems(xml: string): Array<{ title: string; desc: string }> {
  const items: Array<{ title: string; desc: string }> = []
  const re = /<item>([\s\S]*?)<\/item>/g
  let m: RegExpExecArray | null
  while ((m = re.exec(xml)) !== null) {
    const block = m[1]
    const title = block.match(/<title>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/title>/)?.[1] ?? ''
    const desc = block.match(/<description>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/description>/)?.[1] ?? ''
    items.push({ title: stripHtml(title), desc: stripHtml(desc) })
  }
  return items
}

function loadSeen(file: string): Set<string> {
  const seen = new Set<string>()
  if (existsSync(file)) {
    for (const line of readFileSync(file, 'utf8').split('\n')) {
      if (!line.trim()) continue
      try {
        seen.add((JSON.parse(line) as WebSource).id)
      } catch {
        /* skip */
      }
    }
  }
  return seen
}

async function main(): Promise<void> {
  mkdirSync(dirname(OUT), { recursive: true })
  const seen = loadSeen(OUT)
  let n = 0
  let seq = 1
  for (const feed of FEEDS) {
    try {
      const xml = await fetchRss(feed.url)
      const items = extractItems(xml).slice(0, PER_FEED)
      for (const item of items) {
        // Headline + first summary sentence, deduped and capped in length.
        const raw = `${item.title}. ${item.desc}`.replace(/\s*\.\.?\.\s*/g, '. ').trim()
        for (const chunk of sentencify(raw)) {
          if (chunk.split(/\s+/).length > 32) continue
          if (!/[؀-ۿ]/.test(chunk)) continue
          const id = `news${String(seq).padStart(2, '0')}`
          seq++
          if (seen.has(id)) continue
          appendFileSync(OUT, `${JSON.stringify({ id, text: chunk, register: 'formal-news' } as WebSource)}\n`)
          n++
        }
      }
      console.log(`${feed.name}: ok (${items.length} items)`)
    } catch (err) {
      console.log(`${feed.name}: FAILED ${String(err)}`)
    }
  }
  console.log(`wrote ${n} new sources → ${OUT}`)
}

void main()
