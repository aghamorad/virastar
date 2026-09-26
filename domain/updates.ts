/**
 * Is a newer ویراستار out?
 *
 * One question to GitHub, asked after the page has already painted. Nothing is
 * downloaded and nothing is installed — the answer only decides whether the
 * window mentions that a newer cut exists. A check that fails (offline, behind
 * a proxy that eats it, rate-limited on a shared IP) returns nothing at all,
 * because "could not tell" and "you are current" lead to the same silence.
 *
 * Kept free of React so the answer can be asked for from anywhere, and asked
 * once — see `pendingUpdate`.
 */

import pkg from '../package.json'

/** The version this copy was built from. Bumped by the release, not by hand. */
export const APP_VERSION: string = pkg.version

export const REPO = 'aghamorad/virastar'
export const RELEASES = `https://github.com/${REPO}/releases`
/** Where a stale copy sends you: the newest release, whatever it turns out to be. */
export const DOWNLOAD = `${RELEASES}/latest`

/** Long enough for a slow link, short enough that a dead one is not noticed. */
const TIMEOUT = 9000

const FA_DIGITS = '۰۱۲۳۴۵۶۷۸۹'

/** "1.0.0" -> "۱.۰.۰" — a version is an identifier, but a Persian speaker reads it. */
export function faVersion(version: string): string {
  return version.replace(/\d/g, (digit) => FA_DIGITS[Number(digit)])
}

/** "v1.2.10" -> [1, 2, 10]. Anything unparseable counts as zero. */
export function parts(version: string): number[] {
  return String(version)
    .trim()
    .replace(/^v/i, '')
    .split('.')
    .map((piece) => {
      const digits = piece.replace(/\D/g, '')
      return digits ? Number(digits) : 0
    })
}

export function isNewer(candidate: string, mine: string): boolean {
  const a = parts(candidate)
  const b = parts(mine)
  for (let i = 0; i < Math.max(a.length, b.length); i += 1) {
    const x = a[i] ?? 0
    const y = b[i] ?? 0
    if (x !== y) return x > y
  }
  return false
}

/**
 * The tag of the newest release, bare ("1.0.1"), or "" when it could not be
 * read. GitHub's `releases/latest` already skips drafts and prereleases, which
 * is what is wanted: a release candidate is not something to wave at someone
 * who is simply using the app.
 */
export async function latest(): Promise<string> {
  // AbortController rather than AbortSignal.timeout: the latter is newer than
  // some of the browsers and WebViews this ships into.
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT)
  try {
    const response = await fetch(
      `https://api.github.com/repos/${REPO}/releases/latest`,
      {
        headers: { Accept: 'application/vnd.github+json' },
        signal: controller.signal,
        cache: 'no-store',
      },
    )
    if (!response.ok) return ''
    const payload = await response.json()
    return String(payload?.tag_name ?? '')
      .trim()
      .replace(/^v/i, '')
  } catch {
    // Offline, throttled, blocked, JSON that is not JSON. All the same answer.
    return ''
  } finally {
    clearTimeout(timer)
  }
}

/** The newer release's number, or "" when there is none or no answer. */
export async function newerThanMine(mine: string = APP_VERSION): Promise<string> {
  const found = await latest()
  return found && isNewer(found, mine) ? found : ''
}

let pending: Promise<string> | null = null

/**
 * The answer, asked for at most once per page load however many components are
 * interested. A promise rather than a value so two callers arriving during the
 * same request share it instead of racing.
 */
export function pendingUpdate(): Promise<string> {
  if (!pending) pending = newerThanMine()
  return pending
}
