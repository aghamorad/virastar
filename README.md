# ویراستار — Virastar

> بهتر بنویس، بهتر بگو.

Virastar is a beautiful Persian writing instrument — not a chatbot. You write in Persian, choose how you want the text to sound, and an editor improves it. You review, copy, save, and keep writing.

The first screen is a calm place to start: a star, the wordmark, the promise, and a big «متن جدید» button. The editor is the whole point: your words on the left, a style, and one decisive «ویرایش کن».

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

## Run it locally

```bash
npm install
npm run dev
```

Then open `http://localhost:3001`. The site is RTL Persian, set in Vazirmatn.

Production and type checks:

```bash
npm run build
npm run typecheck
```

## How the editor works

The editing engine has two halves:

- **Offline (default):** deterministic Persian rules that run anywhere with no network — character normalization, نیمفاصله repair, punctuation spacing, register lexicons, sentence connectors, and openers/closers for the polite modes. It is the honest, always-works fallback.
- **Online:** pluggable — point it at any OpenAI-compatible chat-completions endpoint and the same modes get real rewriting. If the endpoint is unreachable, the app falls back to the offline engine and says so.

Choose the engine and endpoint in **تنظیمات**. Same eleven modes either way.

## Themes

The palette is defined as role tokens, so the whole UI restyles in one switch, remembered across visits:

- **ویراستار** — cream paper, carmine star, friendly accent
- **شبنویس** — night writing: deep indigo and gold
- **کافه تهران** — 1960s/70s Tehran: sepia, burnt orange, olive
- **جوهر بنفش** — purple ink on lavender

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

The offline engine never leaves the device. The online engine is only used if you configure an endpoint in settings — nothing is sent anywhere by default.
