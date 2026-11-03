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
    <div className="mt-3 rounded-[12px_6px_14px_6px] border border-border bg-surface p-3 shadow-card select-none">
      {/* Top utility row */}
      <div className="mb-2.5 flex items-center justify-between border-b border-border/70 pb-2">
        <div className="flex items-center gap-2">
          <span className="flex items-center gap-1.5 text-xs font-bold text-ink">
            <Star size={13} className="text-brand" />
            صفحه‌کلید دستی فارسی
          </span>
          <span className="rounded-[4px] bg-highlight/60 border border-border px-2 py-0.5 text-[11px] font-bold text-ink">
            کلیدهای درشت و خوانا
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setMode(mode === 'alpha' ? 'numeric' : 'alpha')}
            className="rounded-[6px_3px_8px_3px] border border-border bg-paper px-2.5 py-1 text-xs font-bold text-ink shadow-soft hover:bg-highlight hover:border-ink active:translate-y-[1px] transition-all cursor-pointer"
          >
            {mode === 'alpha' ? '۱۲۳ (اعداد و علائم)' : 'الفبا'}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="rounded-[6px_3px_8px_3px] border border-border bg-paper px-2.5 py-1 text-xs font-bold text-ink-soft shadow-soft hover:text-brand hover:border-brand active:translate-y-[1px] transition-all cursor-pointer"
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
              className="flex min-h-[44px] flex-1 max-w-[56px] items-center justify-center rounded-[6px_3px_8px_3px] border border-border bg-brand/10 text-brand text-sm font-bold shadow-soft hover:bg-brand hover:text-white active:translate-y-[1px] transition-all cursor-pointer"
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
              className="min-h-[44px] px-3.5 rounded-[6px_3px_8px_3px] border border-ink/40 bg-highlight text-ink text-xs font-bold shadow-soft hover:bg-highlight/80 hover:border-ink active:translate-y-[1px] transition-all cursor-pointer"
              title="نیم‌فاصله استاندارد فارسی"
            >
              [نیم‌فاصله]
            </button>

            <button
              type="button"
              onClick={() => {
                playTactileSound(activeTheme, 'tap')
                onInsert(' ')
              }}
              className="min-h-[44px] flex-1 max-w-[220px] rounded-[6px_3px_8px_3px] border border-border bg-paper text-xs font-bold text-ink shadow-soft hover:border-ink hover:bg-paper-deep active:translate-y-[1px] transition-all cursor-pointer"
            >
              فاصله (Space)
            </button>

            <button
              type="button"
              onClick={() => {
                playTactileSound(activeTheme, 'tap')
                onInsert('،')
              }}
              className="min-h-[44px] w-10 rounded-[6px_3px_8px_3px] border border-border bg-paper text-sm font-bold text-ink shadow-soft hover:border-ink active:translate-y-[1px] transition-all cursor-pointer"
            >
              ،
            </button>

            <button
              type="button"
              onClick={() => {
                playTactileSound(activeTheme, 'tap')
                onInsert('.')
              }}
              className="min-h-[44px] w-10 rounded-[6px_3px_8px_3px] border border-border bg-paper text-sm font-bold text-ink shadow-soft hover:border-ink active:translate-y-[1px] transition-all cursor-pointer"
            >
              .
            </button>

            <button
              type="button"
              onClick={() => {
                playTactileSound(activeTheme, 'special')
                onNewLine()
              }}
              className="min-h-[44px] px-3.5 rounded-[6px_3px_8px_3px] border border-border bg-surface text-ink text-xs font-bold shadow-soft hover:border-ink hover:bg-highlight active:translate-y-[1px] transition-all cursor-pointer"
              title="سطر جدید"
            >
              ↵ خط بعد
            </button>
          </div>
        </div>
      ) : (
        /* Numbers & Symbols mode */
        <div className="space-y-1.5" dir="rtl">
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
              className="min-h-[44px] px-4 rounded-[6px_3px_8px_3px] border border-border bg-paper text-sm font-bold text-ink shadow-soft hover:border-ink active:translate-y-[1px]"
            >
              «گیومه»
            </button>
            <button
              type="button"
              onClick={() => {
                playTactileSound(activeTheme, 'special')
                onHalfSpace()
              }}
              className="min-h-[44px] px-4 rounded-[6px_3px_8px_3px] border border-ink/40 bg-highlight text-ink text-xs font-bold shadow-soft hover:border-ink active:translate-y-[1px]"
            >
              [نیم‌فاصله]
            </button>
            <button
              type="button"
              onClick={() => {
                playTactileSound(activeTheme, 'tap')
                onBackspace()
              }}
              className="min-h-[44px] px-4 rounded-[6px_3px_8px_3px] border border-border bg-brand/10 text-brand text-sm font-bold shadow-soft hover:bg-brand hover:text-white active:translate-y-[1px]"
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
      className="flex min-h-[44px] min-w-[28px] sm:min-w-[34px] flex-1 items-center justify-center rounded-[6px_3px_8px_3px] border border-border bg-paper text-base sm:text-lg font-bold text-ink shadow-soft hover:border-ink hover:bg-highlight/50 active:translate-y-[1px] transition-all cursor-pointer"
    >
      {label}
    </button>
  )
}
