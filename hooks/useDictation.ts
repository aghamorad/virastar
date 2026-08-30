'use client'

// Dictation via the browser's native speech recognition (Web Speech API) —
// Safari/iOS use Apple's on-device recognizer, so Persian dictation works with
// no download and nothing leaving the machine. The API is part of the browser,
// so there is zero load-time cost; this hook only starts streaming when asked.

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

function createRecognition(): SpeechRecognitionLike | null {
  if (typeof window === 'undefined') return null
  const global = window as unknown as Record<string, unknown>
  const ctor = global.SpeechRecognition ?? global.webkitSpeechRecognition
  if (typeof ctor !== 'function') return null
  return new (ctor as new () => SpeechRecognitionLike)()
}

export function useDictation(lang = 'fa-IR') {
  // Detect the recognizer after mount: the server doesn't have one, so checking
  // during the first render would make server HTML and client HTML disagree and
  // fail hydration (which also kills the editor's event handlers).
  const [supported, setSupported] = useState(false)
  const [listening, setListening] = useState(false)
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null)
  const sessionRef = useRef(0)
  const onTranscriptRef = useRef<(text: string) => void>(() => {})
  const onEndRef = useRef<() => void>(() => {})

  useEffect(() => {
    setSupported(createRecognition() !== null)
  }, [])

  // Tear down any running recognition when the screen unmounts.
  useEffect(() => {
    return () => {
      sessionRef.current++
      recognitionRef.current?.abort()
      recognitionRef.current = null
    }
  }, [])

  const start = (onTranscript: (text: string) => void, onEnd?: () => void) => {
    const recognition = createRecognition()
    if (!recognition) return
    const session = ++sessionRef.current
    onTranscriptRef.current = onTranscript
    onEndRef.current = onEnd ?? (() => {})

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
