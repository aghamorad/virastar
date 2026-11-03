// Optional zero-dependency Web Audio synthesizer for tactile, interactive typing feedback.
// 100% offline, zero network requests, ultra-low latency, and senior-friendly soft volumes.

import { AUDIO_FEEDBACK_KEY, THEMES } from './themes'

let audioCtx: AudioContext | null = null

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null
  if (!audioCtx) {
    const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
    if (AudioContextClass) {
      audioCtx = new AudioContextClass()
    }
  }
  if (audioCtx && audioCtx.state === 'suspended') {
    audioCtx.resume().catch(() => {})
  }
  return audioCtx
}

export function isAudioFeedbackEnabled(): boolean {
  if (typeof window === 'undefined') return false
  try {
    return localStorage.getItem(AUDIO_FEEDBACK_KEY) === 'true'
  } catch {
    return false
  }
}

export function setAudioFeedbackEnabled(enabled: boolean): void {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(AUDIO_FEEDBACK_KEY, enabled ? 'true' : 'false')
    // Warm up the audio context on user gesture if enabling
    if (enabled) {
      getAudioContext()
    }
  } catch {
    // Ignore storage issues
  }
}

export function playTactileSound(themeId: string, type: 'tap' | 'action' | 'special' = 'tap'): void {
  if (!isAudioFeedbackEnabled()) return
  const ctx = getAudioContext()
  if (!ctx) return

  const theme = THEMES.find((t) => t.id === themeId) ?? THEMES[0]
  const profile = theme.soundProfile
  const now = ctx.currentTime

  try {
    switch (profile) {
      case 'typewriter': {
        // Cafe Naderi: mechanical click-clack
        const osc = ctx.createOscillator()
        const gain = ctx.createGain()
        osc.type = 'triangle'
        const pitch = type === 'action' ? 220 : type === 'special' ? 380 : 280 + (Math.random() * 40 - 20)
        osc.frequency.setValueAtTime(pitch, now)
        osc.frequency.exponentialRampToValueAtTime(80, now + 0.04)

        gain.gain.setValueAtTime(0.2, now)
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.045)

        osc.connect(gain)
        gain.connect(ctx.destination)
        osc.start(now)
        osc.stop(now + 0.05)
        break
      }

      case 'cyber': {
        // Cyber Tehran: high-tech snappy blip
        const osc = ctx.createOscillator()
        const gain = ctx.createGain()
        osc.type = 'sine'
        const pitch = type === 'action' ? 880 : type === 'special' ? 1046 : 660
        osc.frequency.setValueAtTime(pitch, now)
        osc.frequency.exponentialRampToValueAtTime(pitch * 1.5, now + 0.025)

        gain.gain.setValueAtTime(0.12, now)
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.035)

        osc.connect(gain)
        gain.connect(ctx.destination)
        osc.start(now)
        osc.stop(now + 0.04)
        break
      }

      case 'starlight': {
        // Shabnevis: soft celestial chime
        const osc = ctx.createOscillator()
        const gain = ctx.createGain()
        osc.type = 'sine'
        const pitch = type === 'action' ? 659.25 : type === 'special' ? 880 : 523.25
        osc.frequency.setValueAtTime(pitch, now)

        gain.gain.setValueAtTime(0.14, now)
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.09)

        osc.connect(gain)
        gain.connect(ctx.destination)
        osc.start(now)
        osc.stop(now + 0.1)
        break
      }

      case 'crystal': {
        // Firouzeh: glassy droplet ping
        const osc = ctx.createOscillator()
        const gain = ctx.createGain()
        osc.type = 'sine'
        const pitch = type === 'action' ? 784 : type === 'special' ? 987.77 : 587.33
        osc.frequency.setValueAtTime(pitch, now)
        osc.frequency.exponentialRampToValueAtTime(pitch * 0.8, now + 0.06)

        gain.gain.setValueAtTime(0.15, now)
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.07)

        osc.connect(gain)
        gain.connect(ctx.destination)
        osc.start(now)
        osc.stop(now + 0.08)
        break
      }

      case 'velvet': {
        // Golestan: warm, soft acoustic thud
        const osc = ctx.createOscillator()
        const gain = ctx.createGain()
        osc.type = 'sine'
        const pitch = type === 'action' ? 330 : type === 'special' ? 440 : 260
        osc.frequency.setValueAtTime(pitch, now)
        osc.frequency.exponentialRampToValueAtTime(140, now + 0.05)

        gain.gain.setValueAtTime(0.16, now)
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.06)

        osc.connect(gain)
        gain.connect(ctx.destination)
        osc.start(now)
        osc.stop(now + 0.07)
        break
      }

      case 'gilded': {
        // Termeh: metallic resonance
        const osc = ctx.createOscillator()
        const gain = ctx.createGain()
        osc.type = 'triangle'
        const pitch = type === 'action' ? 523.25 : type === 'special' ? 698.46 : 392
        osc.frequency.setValueAtTime(pitch, now)

        gain.gain.setValueAtTime(0.15, now)
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08)

        osc.connect(gain)
        gain.connect(ctx.destination)
        osc.start(now)
        osc.stop(now + 0.09)
        break
      }

      case 'minimal': {
        // Minimal Barfi: crisp modern UI tick
        const osc = ctx.createOscillator()
        const gain = ctx.createGain()
        osc.type = 'sine'
        osc.frequency.setValueAtTime(440, now)
        osc.frequency.exponentialRampToValueAtTime(110, now + 0.02)

        gain.gain.setValueAtTime(0.15, now)
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.025)

        osc.connect(gain)
        gain.connect(ctx.destination)
        osc.start(now)
        osc.stop(now + 0.03)
        break
      }

      case 'pen':
      default: {
        // Virastar Classic: soft nib tap on paper
        const osc = ctx.createOscillator()
        const gain = ctx.createGain()
        osc.type = 'sine'
        const pitch = type === 'action' ? 350 : type === 'special' ? 490 : 290 + (Math.random() * 30 - 15)
        osc.frequency.setValueAtTime(pitch, now)
        osc.frequency.exponentialRampToValueAtTime(120, now + 0.03)

        gain.gain.setValueAtTime(0.18, now)
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.035)

        osc.connect(gain)
        gain.connect(ctx.destination)
        osc.start(now)
        osc.stop(now + 0.04)
        break
      }
    }
  } catch {
    // Gracefully ignore audio issues
  }
}
