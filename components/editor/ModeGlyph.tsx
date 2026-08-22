// One abstract geometric sign per writing mode. Each is drawn by hand so the
// سبک‌ها feel like a family of marks, not a font's clip-art.

export function ModeGlyph({
  modeId,
  size = 20,
  className,
}: {
  modeId: string
  size?: number
  className?: string
}) {
  const s = { width: size, height: size, viewBox: '0 0 100 100' }
  const stroke = { fill: 'none', stroke: 'currentColor', strokeWidth: 8, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const }

  switch (modeId) {
    case 'tashih':
      return (
        <svg {...s} className={className} aria-hidden>
          <circle cx="50" cy="50" r="38" {...stroke} />
          <path d="M 32 51 l 13 13 l 25 -30" {...stroke} />
        </svg>
      )
    case 'rasmi':
      return (
        <svg {...s} className={className} aria-hidden>
          <rect x="28" y="28" width="44" height="44" transform="rotate(45 50 50)" {...stroke} strokeWidth={7} />
        </svg>
      )
    case 'daneshgahi':
      return (
        <svg {...s} className={className} aria-hidden>
          <rect x="18" y="18" width="64" height="64" {...stroke} strokeWidth={6} />
          <rect x="36" y="36" width="28" height="28" fill="currentColor" />
        </svg>
      )
    case 'edari':
      return (
        <svg {...s} className={className} aria-hidden>
          <circle cx="50" cy="50" r="36" {...stroke} />
          <line x1="26" y1="50" x2="74" y2="50" stroke="currentColor" strokeWidth="8" strokeLinecap="round" />
        </svg>
      )
    case 'khodmani':
      return (
        <svg {...s} className={className} aria-hidden>
          <circle cx="50" cy="50" r="34" fill="currentColor" />
        </svg>
      )
    case 'adabi':
      return (
        <svg {...s} className={className} aria-hidden>
          <path d="M 20 68 C 35 52, 35 48, 50 48 C 65 48, 65 52, 80 68" {...stroke} />
          <path d="M 20 46 C 35 30, 35 26, 50 26 C 65 26, 65 30, 80 46" {...stroke} />
        </svg>
      )
    case 'lati':
      return (
        <svg {...s} className={className} aria-hidden>
          <path d="M 60 18 L 36 54 h 15 l -11 28 28 -40 H 52 Z" fill="currentColor" />
        </svg>
      )
    case 'taaroofi':
      return (
        <svg {...s} className={className} aria-hidden>
          <path d="M 20 66 a 30 30 0 0 1 60 0" {...stroke} />
          <path d="M 28 74 a 22 22 0 0 1 44 0" {...stroke} />
        </svg>
      )
    case 'pachelhkhor':
      return (
        <svg {...s} className={className} aria-hidden>
          <path d="M 50 12 C 53 40, 60 47, 88 50 C 60 53, 53 60, 50 88 C 47 60, 40 53, 12 50 C 40 47, 47 40, 50 12 Z" fill="currentColor" />
        </svg>
      )
    case 'naslezed':
      return (
        <svg {...s} className={className} aria-hidden>
          <rect x="20" y="20" width="60" height="60" {...stroke} strokeWidth={6} />
          <line x1="50" y1="20" x2="50" y2="80" stroke="currentColor" strokeWidth="6" />
          <line x1="20" y1="50" x2="80" y2="50" stroke="currentColor" strokeWidth="6" />
        </svg>
      )
    case 'shaeraneh':
      return (
        <svg {...s} className={className} aria-hidden>
          <path d="M 68 14 A 42 42 0 1 0 68 86 A 33 33 0 1 1 68 14 Z" fill="currentColor" />
          <path d="M 78 24 l 3.5 7.5 8 1.2 -5.8 5.6 1.4 8 -7.1 -3.7 -7.1 3.7 1.4 -8 -5.8 -5.6 8 -1.2 Z" fill="currentColor" />
        </svg>
      )
    default:
      return (
        <svg {...s} className={className} aria-hidden>
          <path d="M 50 8 L 92 50 L 50 92 L 8 50 Z" fill="currentColor" />
        </svg>
      )
  }
}
