'use client'

import { useState } from 'react'
import { Star } from '../Star'
import { useActiveTheme } from '@/hooks/useActiveTheme'
import { playTactileSound } from '@/domain/audioFeedback'

interface PersianKeyboardProps {
  onInsert: (char: string) => void
  onBackspace: () => void
  onHalfSpace: () => void
  onNewLine: () => void
  onClose: () => void
}

const ROW_1 = ['ض', 'ص', 'ث', 'ق', 'ف', 'غ', 'ع', 'ه', 'خ', 'ح', 'ج', 'چ']
const ROW_2 = ['ش', 'س', 'ی', 'ب', 'ل', 'ا', 'ت', 'ن', 'م', 'ک', 'گ']
const ROW_3 = ['ظ', 'ط', 'ز', 'ر', 'ذ', 'د', 'پ', 'و', 'ژ', 'آ']
const ROW_NUMS = ['۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹', '۰']
const ROW_SYMBOLS = ['،', '؛', '؟', '!', '.', '«', '»', ':', '–', '٪']

export function PersianKeyboard({
  onInsert,
  onBackspace,
  onHalfSpace,
  onNewLine,
  onClose,
}: PersianKeyboardProps) {
  const [mode, setMode] = useState<'alpha' | 'numeric'>('alpha')
  const activeTheme = useActiveTheme()

  return (
    <div className="mt-3 rounded-2xl border border-border bg-paper-deep p-3 shadow-lg select-none transition-all">
      {/* Top utility row */}
      <div className="mb-2.5 flex items-center justify-between border-b border-border/50 pb-2">
        <div className="flex items-center gap-2">
          <span className="flex items-center gap-1.5 text-xs font-black text-ink">
            <Star size={13} className="text-brand" />
            صفحه‌کلید فارسی هوشمند
          </span>
          <span className="rounded-full bg-brand/10 px-2 py-0.5 text-[11px] font-bold text-brand">
            کلیدهای بزرگ و آسان
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setMode(mode === 'alpha' ? 'numeric' : 'alpha')}
            className="rounded-lg bg-paper px-2.5 py-1 text-xs font-bold text-ink hover:text-brand border border-border"
          >
            {mode === 'alpha' ? '۱۲۳ (اعداد و علائم)' : 'الفبا'}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg bg-paper px-2.5 py-1 text-xs font-bold text-ink-soft hover:text-red-500 border border-border"
            title="بستن کیبورد مجازی"
          >
            بستن ✕
          </button>
        </div>
      </div>

      {mode === 'alpha' ? (
        <div className="space-y-1.5" dir="rtl">
          {/* Row 1 */}
          <div className="flex justify-center gap-1">
            {ROW_1.map((ch) => (
              <KeyButton key={ch} label={ch} onClick={() => onInsert(ch)} />
            ))}
          </div>

          {/* Row 2 */}
          <div className="flex justify-center gap-1 pr-2">
            {ROW_2.map((ch) => (
              <KeyButton key={ch} label={ch} onClick={() => onInsert(ch)} />
            ))}
          </div>

          {/* Row 3 with Backspace */}
          <div className="flex justify-center gap-1">
            <button
              type="button"
              onClick={() => {
                playTactileSound(activeTheme, 'tap')
                onBackspace()
              }}
              className="flex min-h-[44px] flex-1 max-w-[56px] items-center justify-center rounded-xl bg-paper border border-border text-sm font-black text-ink hover:border-brand hover:text-brand active:scale-95 transition-all shadow-sm"
              title="پاک کردن"
            >
              ⌫
            </button>
            {ROW_3.map((ch) => (
              <KeyButton key={ch} label={ch} onClick={() => onInsert(ch)} />
            ))}
          </div>

          {/* Row 4: Space, ZWNJ, Punctuation, Newline */}
          <div className="flex items-center justify-center gap-1 pt-1">
            <button
              type="button"
              onClick={() => {
                playTactileSound(activeTheme, 'special')
                onHalfSpace()
              }}
              className="min-h-[44px] px-3 rounded-xl bg-brand/10 border border-brand/30 text-xs font-black text-brand hover:bg-brand/20 active:scale-95 transition-all shadow-sm"
              title="نیم‌فاصله استاندارد فارسی"
            >
              نیم‌فاصله
            </button>

            <button
              type="button"
              onClick={() => {
                playTactileSound(activeTheme, 'tap')
                onInsert(' ')
              }}
              className="min-h-[44px] flex-1 max-w-[220px] rounded-xl bg-paper border border-border text-xs font-bold text-ink hover:border-brand active:scale-95 transition-all shadow-sm"
            >
              فاصله (Space)
            </button>

            <button
              type="button"
              onClick={() => {
                playTactileSound(activeTheme, 'tap')
                onInsert('،')
              }}
              className="min-h-[44px] w-10 rounded-xl bg-paper border border-border text-sm font-black text-ink hover:border-brand active:scale-95 transition-all shadow-sm"
            >
              ،
            </button>

            <button
              type="button"
              onClick={() => {
                playTactileSound(activeTheme, 'tap')
                onInsert('.')
              }}
              className="min-h-[44px] w-10 rounded-xl bg-paper border border-border text-sm font-black text-ink hover:border-brand active:scale-95 transition-all shadow-sm"
            >
              .
            </button>

            <button
              type="button"
              onClick={() => {
                playTactileSound(activeTheme, 'special')
                onNewLine()
              }}
              className="min-h-[44px] px-3.5 rounded-xl bg-paper border border-border text-xs font-black text-ink hover:border-brand active:scale-95 transition-all shadow-sm"
              title="سطر جدید"
            >
              ↵ خط بعد
            </button>
          </div>
        </div>
      ) : (
        /* Numbers & Symbols mode */
        <div className="space-y-2" dir="rtl">
          <div className="flex justify-center gap-1.5">
            {ROW_NUMS.map((n) => (
              <KeyButton key={n} label={n} onClick={() => onInsert(n)} />
            ))}
          </div>
          <div className="flex justify-center gap-1.5">
            {ROW_SYMBOLS.map((s) => (
              <KeyButton key={s} label={s} onClick={() => onInsert(s)} />
            ))}
          </div>
          <div className="flex items-center justify-center gap-2 pt-1">
            <button
              type="button"
              onClick={() => {
                playTactileSound(activeTheme, 'tap')
                onInsert('«»')
              }}
              className="min-h-[44px] px-4 rounded-xl bg-paper border border-border text-sm font-black text-ink hover:border-brand active:scale-95"
            >
              «گیومه»
            </button>
            <button
              type="button"
              onClick={() => {
                playTactileSound(activeTheme, 'special')
                onHalfSpace()
              }}
              className="min-h-[44px] px-4 rounded-xl bg-brand/10 border border-brand/30 text-xs font-black text-brand hover:bg-brand/20 active:scale-95"
            >
              نیم‌فاصله
            </button>
            <button
              type="button"
              onClick={() => {
                playTactileSound(activeTheme, 'tap')
                onBackspace()
              }}
              className="min-h-[44px] px-4 rounded-xl bg-paper border border-border text-sm font-black text-ink hover:border-brand active:scale-95"
            >
              ⌫ پاک کردن
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function KeyButton({ label, onClick }: { label: string; onClick: () => void }) {
  const activeTheme = useActiveTheme()
  return (
    <button
      type="button"
      onClick={() => {
        playTactileSound(activeTheme, 'tap')
        onClick()
      }}
      className="flex min-h-[44px] min-w-[28px] sm:min-w-[34px] flex-1 items-center justify-center rounded-xl bg-paper border border-border text-base sm:text-lg font-black text-ink hover:border-brand hover:text-brand hover:shadow active:scale-90 transition-all shadow-sm cursor-pointer"
    >
      {label}
    </button>
  )
}
