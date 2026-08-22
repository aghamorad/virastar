// A small set of bespoke geometric glyphs — drawn, not imported. The app
// avoids generic icon sets entirely; these are the graphic vocabulary.

type P = { size?: number; className?: string }

export function EditGlyph({ size = 20, className }: P) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" fill="currentColor" className={className} aria-hidden>
      <path d="M 50 1.5 L 98.5 50 L 50 98.5 L 1.5 50 Z M 16 16 L 84 16 L 84 84 L 16 84 Z" />
    </svg>
  )
}

export function StylesGlyph({ size = 20, className }: P) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" className={className} aria-hidden>
      <circle cx="34" cy="34" r="22" fill="currentColor" opacity="0.55" />
      <circle cx="66" cy="66" r="26" fill="currentColor" opacity="0.35" />
      <circle cx="70" cy="26" r="14" fill="currentColor" />
    </svg>
  )
}

export function HistoryGlyph({ size = 20, className }: P) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" className={className} aria-hidden>
      <rect x="20" y="18" width="60" height="64" rx="8" fill="none" stroke="currentColor" strokeWidth="8" />
      <line x1="34" y1="40" x2="66" y2="40" stroke="currentColor" strokeWidth="8" strokeLinecap="round" />
      <line x1="34" y1="56" x2="60" y2="56" stroke="currentColor" strokeWidth="8" strokeLinecap="round" />
      <line x1="34" y1="70" x2="52" y2="70" stroke="currentColor" strokeWidth="8" strokeLinecap="round" />
    </svg>
  )
}

export function SettingsGlyph({ size = 20, className }: P) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" className={className} aria-hidden>
      <circle cx="50" cy="50" r="26" fill="none" stroke="currentColor" strokeWidth="8" />
      <line x1="50" y1="8" x2="50" y2="24" stroke="currentColor" strokeWidth="8" strokeLinecap="round" />
      <line x1="50" y1="76" x2="50" y2="92" stroke="currentColor" strokeWidth="8" strokeLinecap="round" />
      <line x1="8" y1="50" x2="24" y2="50" stroke="currentColor" strokeWidth="8" strokeLinecap="round" />
      <line x1="76" y1="50" x2="92" y2="50" stroke="currentColor" strokeWidth="8" strokeLinecap="round" />
    </svg>
  )
}

export function CopyGlyph({ size = 18, className }: P) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" className={className} aria-hidden>
      <rect x="32" y="32" width="48" height="48" rx="8" fill="none" stroke="currentColor" strokeWidth="8" />
      <path d="M 20 68 V 20 h 48" fill="none" stroke="currentColor" strokeWidth="8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export function SaveGlyph({ size = 18, className }: P) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" className={className} aria-hidden>
      <path d="M 18 20 a 8 8 0 0 1 8 -8 h 34 l 22 22 v 46 a 8 8 0 0 1 -8 8 h -48 a 8 8 0 0 1 -8 -8 Z" fill="none" stroke="currentColor" strokeWidth="8" strokeLinejoin="round" />
      <path d="M 32 16 v 24 h 30 V 16 M 68 84 V 58 H 32 v 26" fill="none" stroke="currentColor" strokeWidth="7" strokeLinejoin="round" />
    </svg>
  )
}

export function CheckGlyph({ size = 18, className }: P) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" className={className} aria-hidden>
      <path d="M 24 52 l 18 18 l 36 -42" fill="none" stroke="currentColor" strokeWidth="11" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}
