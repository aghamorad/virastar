# ویراستار — Virastar

> بهتر بنویس، بهتر بگو.

Virastar is a Persian writing instrument — not a chatbot. You write in Persian, pick how you want the text to sound, and it helps you say it better. Everything it does, you review: you keep what you like, copy it, save it, and go on writing.

It's free, it needs no account, and it runs on the web, on iPhone, and on Android. The phone apps are in the repo's Releases.

## The eleven modes

Two groups, eleven ways to speak.

**ابزار اصلی — the practical tools**

| Mode | What it does |
| --- | --- |
| اصلاح | fixes spelling, punctuation, نیمفاصله; keeps your voice |
| رسمی | professional and polite for email and work |
| دانشگاهی | clear, precise, structured academic language |
| اداری | conventional, respectful official correspondence |
| خودمانی | natural, warm everyday speech |
| ادبی | well-built literary prose, inspired by the Persian tradition |

**بازی با زبان — playing with language**

| Mode | What it does |
| --- | --- |
| لاتی | real Tehrani street language, sharp and warm |
| تعارفی | Iranian politeness — the courtesy is the message |
| پاچهخواری | exaggerated, funny flattery |
| نسل زد | today's internet Persian, irony and fresh idioms |
| شاعرانه | rhythmic prose with imagery, echoing Ferdowsi, Sa'di, Hafez |

## How the editor works

The engine has two halves, and you pick which you want in **تنظیمات**:

- **Online (the default).** A real language model rewrites your text. The default is Google Gemini, served through a small Cloudflare Worker; there's also a free Qwen model that needs no key. If you prefer, you can point the engine at any OpenAI-compatible service instead.
- **Offline.** Download a small Qwen model and everything runs on your own device, with no network at all — or pick the rules-only mode, which uses deterministic Persian rules (character normalization, نیمفاصله repair, punctuation spacing, register lexicons) and needs no model whatsoever.

You can also dictate instead of typing. Dictation is built in — native on iPhone and Android, and via the browser elsewhere.

## Run it locally

```bash
npm install
npm run dev
```

Then open `http://localhost:3000`. The site is RTL Persian, set in Vazirmatn.

Production and type checks:

```bash
npm run build
npm run typecheck
```

## Themes

The palette is defined as role tokens, so the whole UI restyles in one switch, remembered across visits:

- **ویراستار** — cream paper, carmine star; the default
- **شبنویس** — night writing: deep indigo and gold
- **کافه تهران** — 1960s/70s Tehran: sepia, burnt orange, olive
- **جوهر بنفش** — purple ink on lavender
- **ماشینتحریر** — the 1950s office: steel keys, worn ribbon
- **گرامافون** — an art-deco café: walnut, brass, vinyl in the haze
- **روزنامه** — the old newspaper page: red headlines, print ink

## Deploying

The app builds to a static export (`out/`). GitHub Actions in `.github/workflows/deploy-pages.yml` builds and publishes to GitHub Pages whenever `main` changes. Pages serves the site from a repo path, so the workflow builds with `BASE_PATH=/virastar`.

**Live site:** https://aghamorad.github.io/virastar/

To host elsewhere, serve the same `out/` export on any static host — build with the base path first:

```bash
BASE_PATH=/virastar npm run build
```

## Architecture

A src-less Next.js App Router app with a strict split between the deterministic Persian text core and the pluggable editing engines:

```text
app/                  routes: home, edit, styles, history, settings
components/           screens, editor, theme switcher, custom geometric SVG glyphs
domain/               Persian text core, writing modes, themes, engines (offline + online)
hooks/                theme, settings, history persistence
services/draft        one-shot history → editor handoff
```

Deep-dive in [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

## Design

The visual identity is built from the graphic tradition of Ikko Tanaka, Paul Rand, Saul Bass, Milton Glaser, and Herb Lubalin: strong geometric shapes, decisive color, no decoration for its own sake. Icons are custom geometric SVGs — no emoji, no icon libraries, no graduation caps. The star is a real graphic symbol: two squares overlaid, the mark of the editor.

## Privacy

The online model runs through a Cloudflare Worker in front of Google Gemini, so the text you're editing travels there to be edited — no account, nothing to configure. If you want nothing to leave your device, choose a local model or the rules-only mode in تنظیمات; then the editing happens entirely on your own machine.
