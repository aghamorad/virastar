'use client'

import { Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { EditorScreen } from '@/components/editor/EditorScreen'

function EditorRoute() {
  const sp = useSearchParams()
  const mode = sp.get('mode') ?? undefined
  return <EditorScreen initialMode={mode} />
}

export default function EditPage() {
  return (
    <Suspense fallback={<p className="py-20 text-center text-ink-soft">آماده کردن ویراستار…</p>}>
      <EditorRoute />
    </Suspense>
  )
}
