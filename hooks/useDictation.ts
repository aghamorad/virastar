'use client'

// Dictation for the editor. In the packaged iOS app (Capacitor) the web view
// has no Web Speech API, so we route through the native VirastarSpeech plugin
// (SFSpeechRecognizer) via window.Capacitor.Plugins. On the plain web we fall
// back to the browser's native recognizer (Safari/iOS use Apple's on-device
// engine; Chromium uses the OS engine) — no download, nothing leaves the
// machine. The API is part of the browser/OS, so there is zero load-time cost;
// this hook only starts streaming when asked.

import { useEffect, useRef, useState } from 'react'

interface SpeechRecognitionEventLike {
  resultIndex: number
  results: ArrayLike<{
    isFinal: boolean
    0: { transcript: string }
  }>
}

interface SpeechRecognitionLike {
  lang: string
  continuous: boolean
  interimResults: boolean
  start: () => void
  stop: () => void
  abort: () => void
  onresult: ((event: SpeechRecognitionEventLike) => void) | null
  onerror: ((event: { error?: string }) => void) | null
  onend: (() => void) | null
}

interface NativeSpeechPlugin {
  start: (opts: { locale?: string }) => Promise<void>
  stop: () => Promise<void>
  addListener: (
    eventName: string,
    cb: (data: { transcript?: string; isFinal?: boolean; error?: string }) => void,
  ) => Promise<{ remove: () => void }>
}

function createRecognition(): SpeechRecognitionLike | null {
  if (typeof window === 'undefined') return null
  const global = window as unknown as Record<string, unknown>
  const ctor = global.SpeechRecognition ?? global.webkitSpeechRecognition
  if (typeof ctor !== 'function') return null
  return new (ctor as new () => SpeechRecognitionLike)()
}

function createNativeSpeech(): NativeSpeechPlugin | null {
  if (typeof window === 'undefined') return null
  const cap = (window as unknown as { Capacitor?: { Plugins?: Record<string, NativeSpeechPlugin> } }).Capacitor
  return cap?.Plugins?.VirastarSpeech ?? null
}

export function useDictation(lang = 'fa-IR') {
  // Detect the recognizer after mount: the server doesn't have one, so checking
  // during the first render would make server HTML and client HTML disagree and
  // fail hydration (which also kills the editor's event handlers).
  const [supported, setSupported] = useState(false)
  const [listening, setListening] = useState(false)
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null)
  const nativeRef = useRef<NativeSpeechPlugin | null>(null)
  const listenerHandlesRef = useRef<Array<{ remove: () => void }>>([])
  const sessionRef = useRef(0)
  const onTranscriptRef = useRef<(text: string) => void>(() => {})
  const onEndRef = useRef<() => void>(() => {})

  useEffect(() => {
    const native = createNativeSpeech()
    nativeRef.current = native
    setSupported(native !== null || createRecognition() !== null)
  }, [])

  // Tear down any running recognition when the screen unmounts.
  useEffect(() => {
    return () => {
      sessionRef.current++
      listenerHandlesRef.current.forEach((h) => {
        try {
          h.remove()
        } catch {
          /* already removed */
        }
      })
      listenerHandlesRef.current = []
      nativeRef.current?.stop().catch(() => {})
      nativeRef.current = null
      recognitionRef.current?.abort()
      recognitionRef.current = null
    }
  }, [])

  function clearNativeListeners() {
    listenerHandlesRef.current.forEach((h) => {
      try {
        h.remove()
      } catch {
        /* already removed */
      }
    })
    listenerHandlesRef.current = []
  }

  const start = (onTranscript: (text: string) => void, onEnd?: () => void) => {
    const session = ++sessionRef.current
    onTranscriptRef.current = onTranscript
    onEndRef.current = onEnd ?? (() => {})

    const native = nativeRef.current
    if (native) {
      clearNativeListeners()
      const guard =
        (fn: (data: { transcript?: string; isFinal?: boolean; error?: string }) => void) =>
        (data: { transcript?: string; isFinal?: boolean; error?: string }) => {
          if (sessionRef.current === session) fn(data)
        }
      native
        .addListener('partialResult', guard((data) => {
          if (typeof data.transcript === 'string') onTranscriptRef.current(data.transcript)
        }))
        .then((h) => listenerHandlesRef.current.push(h))
      native
        .addListener('end', guard(() => {
          setListening(false)
          onEndRef.current()
        }))
        .then((h) => listenerHandlesRef.current.push(h))
      native
        .start({ locale: lang })
        .then(() => {
          if (sessionRef.current === session) setListening(true)
        })
        .catch(() => {
          setListening(false)
          onEndRef.current()
        })
      return
    }

    const recognition = createRecognition()
    if (!recognition) return

    recognition.lang = lang
    recognition.continuous = true
    recognition.interimResults = true

    let finalText = ''
    recognition.onresult = (event) => {
      let interim = ''
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i]
        if (result.isFinal) finalText += result[0].transcript
        else interim += result[0].transcript
      }
      onTranscriptRef.current(finalText + (interim ? ' ' + interim : ''))
    }
    recognition.onerror = () => {
      // A failed or denied mic ends the session — onend does the cleanup.
    }
    recognition.onend = () => {
      setListening(false)
      if (recognitionRef.current === recognition) recognitionRef.current = null
      onEndRef.current()
    }

    recognitionRef.current = recognition
    try {
      recognition.start()
      setListening(true)
    } catch {
      setListening(false)
    }
  }

  const stop = () => {
    const native = nativeRef.current
    if (native) {
      native.stop().catch(() => {})
      return
    }
    const recognition = recognitionRef.current
    if (!recognition) return
    const session = sessionRef.current
    recognitionRef.current = null
    try {
      recognition.stop()
    } catch {
      /* already stopped */
    }
    // stop() should end the session, but some engines never fire onend; abort
    // as a fallback without ever killing a newly-started session.
    setTimeout(() => {
      if (sessionRef.current !== session) return
      try {
        recognition.abort()
      } catch {
        /* noop */
      }
    }, 800)
  }

  return { supported, listening, start, stop }
}
