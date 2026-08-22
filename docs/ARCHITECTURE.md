# ویراستار — application architecture

Virastar is a Persian writing instrument. The browser is the whole product: write, pick a style, edit, review, save. The app is a static front end with a pluggable editing engine — deterministic Persian rules always available, an optional LLM endpoint when the user configures one.

## Boundaries

```text
EDITOR (write → pick a mode → ویرایش کن)
        ↓
ENGINE DISPATCH (settings.engine)
        ├── online:  a local model (Ollama → Gemma) genuinely rewrites the text;
        │            any OpenAI-compatible endpoint works; falls back to offline
        └── offline: deterministic Persian rules (no network, always works)
        ↓
RESULT (output + Persian notes + engine/mode badges) → کپی / ذخیره
        ↓
HISTORY (localStorage, 40 entries) → ادامهٔ ویرایش hands the draft back to the editor
```

No server owns the text. The default engine targets `localhost` (Ollama), so the text never leaves the machine; a remote endpoint is only used if the user configures one in تنظیمات.

## Text core (`domain/persian.ts`)

The deterministic foundation, honest about what rules can do:

- `normalizeChars` — Arabic-layout runes → Persian (أ/إ → ا, keeping آ; ي → ی; ك → ک; ة → ه), tashkeel stripped, Arabic-Indic digits → Persian.
- `fixZWNJ` — a dictionary of the most-typed space-separated verb forms (`می خواهم` → `میخواهم`) plus generic joins for plural `ها/های` and comparative `تر/ترین`.
- `fixSpacing` — no space before punctuation, one after; tidy whitespace.
- Register lexicons — `COLLOQUIAL_TO_STANDARD`, `TO_FORMAL`, `TO_CASUAL`, `TO_STREET`, `TO_GENZ`, `TO_LITERARY`, `TO_TAAROF`, `TO_FLATTERY` — each a `Record<string,string>`, applied longest-first by `replaceWords` with whole-word boundaries (Persian letters + ZWNJ form a word).

## Editing engines

`domain/engines/offline.ts` — `editOffline(input, mode)` runs a fixed pipeline: normalize → نیمفاصله → register lexicon → colloquial-interjection cleanup (formal registers) → sentence connectors (weaved sparingly, only into declarative sentences of a few words) → opener/closer wrappers → punctuation. It returns the output, a diff count, and Persian notes explaining what moved.

`domain/engines/online.ts` — `editOnline(input, mode, opts)` posts the mode's `instruction` plus the text to an OpenAI-compatible `chat/completions` endpoint and returns the model's text. The default settings point at `http://localhost:11434/v1/chat/completions` with `gemma2:9b` — real rewriting that never leaves the device.

`domain/engine.ts` — `runEdit(input, modeId, settings)` dispatches: online by default (local Ollama), catching failures and falling back to offline with an honest note; offline when the engine is set to offline or the endpoint is empty.

## Writing modes (`domain/modes.ts`)

Eleven `WritingMode`s in two groups (ابزار اصلی / بازی با زبان). Each mode declares:

- `register` — which lexicon the offline engine applies.
- `connectors` — words woven between later sentences (`weaveConnectors`), word-boundary anchored so a `و`-initial sentence isn't mistaken for already-connected.
- `opener` / `closer` — polite or literary wrappers (تعارفی, پاچهخواری).
- `instruction` — the Persian prompt handed to an online model. One instruction per mode keeps the two engines aligned on the same promise.

## Persistence

- `virastar-theme` — saved theme id, applied pre-hydration by an inline bootstrap script in the layout.
- `virastar-settings` — engine choice, endpoint, model.
- `virastar-history` — up to 40 saved edits with title, mode, dates, and full input/output text.
- `virastar-draft` — a one-shot handoff so «ادامهٔ ویرایش» reopens the editor with the previous text in place.

## Presentation

All colors, shadows, and textures are role tokens in `app/globals.css`, overridden per theme under `[data-theme]` on `<html>`. Because Tailwind v4 bakes `--shadow-*` utilities at build time, per-theme shadows are plain unlayered classes reading `var(--shadow-card)` at runtime. Each theme also redresses the primary button and paints the body with a texture — paper dots, a night starfield, a halftone, a violet glow.

Icons are custom geometric SVGs (`components/Star.tsx`, `components/Glyphs.tsx`, `components/editor/ModeGlyph.tsx`) — no emoji, no icon library, no decorative clip-art. The brand star is two overlaid squares.

## Static export

`next.config.ts` uses `output: 'export'` with a `BASE_PATH` env (empty locally, `/virastar` on GitHub Pages). `app/manifest.ts` pins `export const dynamic = 'force-static'` so the PWA manifest builds under static export. The site is RTL (`dir="rtl"`, lang `fa`) and set in Vazirmatn.

## Future work

- Bundled on-device model: download a small Gemma quant into the browser (WebGPU) so real rewriting works even without Ollama installed.
- Deeper literary engine for ادبی / شاعرانه.
- PWA install polish and sync.
