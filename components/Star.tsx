// The Virastar mark: an eight-pointed geometric star — the shared sign of
// «ویر + ستار». Two overlapping squares, drawn as one path. A real graphic
// symbol in the Ikko Tanaka / Paul Rand tradition, not an AI sparkle.

export function Star({
  size = 24,
  className,
  hollow = false,
  title,
}: {
  size?: number
  className?: string
  hollow?: boolean
  title?: string
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      fill="currentColor"
      className={className}
      aria-hidden={title ? undefined : true}
      role={title ? 'img' : undefined}
    >
      {title ? <title>{title}</title> : null}
      {/* Axis-aligned square + square rotated 45° share a centre → 8 points. */}
      <path
        fillRule={hollow ? 'evenodd' : 'nonzero'}
        d="M 50 1.5 L 98.5 50 L 50 98.5 L 1.5 50 Z M 16 16 L 84 16 L 84 84 L 16 84 Z"
      />
    </svg>
  )
}
