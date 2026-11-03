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
    <div className="mt-3 rounded-none border-4 border-black bg-paper p-3 shadow-[6px_6px_0px_#000] select-none">
      {/* Top utility row */}
      <div className="mb-2.5 flex items-center justify-between border-b-3 border-black pb-2">
        <div className="flex items-center gap-2">
          <span className="flex items-center gap-1.5 text-xs font-black text-ink uppercase tracking-wider">
            <Star size={13} className="text-signal" />
            صفحه‌کلید فارسی هوشمند
          </span>
          <span className="rounded-none border-2 border-black bg-emphasis px-2 py-0.5 text-[11px] font-black text-black shadow-[2px_2px_0px_#000]">
            کلیدهای بزرگ و آسان
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setMode(mode === 'alpha' ? 'numeric' : 'alpha')}
            className="rounded-none border-2 border-black bg-white px-2.5 py-1 text-xs font-black text-black shadow-[2px_2px_0px_#000] hover:bg-emphasis hover:translate-x-[-1px] hover:translate-y-[-1px] hover:shadow-[3px_3px_0px_#000] active:translate-x-[1px] active:translate-y-[1px] active:shadow-none transition-none cursor-pointer"
          >
            {mode === 'alpha' ? '۱۲۳ (اعداد و علائم)' : 'الفبا'}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="rounded-none border-2 border-black bg-signal px-2.5 py-1 text-xs font-black text-white shadow-[2px_2px_0px_#000] hover:bg-black hover:translate-x-[-1px] hover:translate-y-[-1px] hover:shadow-[3px_3px_0px_#000] active:translate-x-[1px] active:translate-y-[1px] active:shadow-none transition-none cursor-pointer"
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
              className="flex min-h-[44px] flex-1 max-w-[56px] items-center justify-center rounded-none border-2 border-black bg-signal/20 text-sm font-black text-black shadow-[2px_2px_0px_#000] hover:bg-signal hover:text-white hover:translate-x-[-1px] hover:translate-y-[-1px] hover:shadow-[3px_3px_0px_#000] active:translate-x-[1px] active:translate-y-[1px] active:shadow-none transition-none cursor-pointer"
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
              className="min-h-[44px] px-3.5 rounded-none border-2 border-black bg-field text-black text-xs font-black shadow-[2px_2px_0px_#000] hover:bg-emphasis hover:translate-x-[-1px] hover:translate-y-[-1px] hover:shadow-[3px_3px_0px_#000] active:translate-x-[1px] active:translate-y-[1px] active:shadow-none transition-none cursor-pointer"
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
              className="min-h-[44px] flex-1 max-w-[220px] rounded-none border-2 border-black bg-white text-xs font-black text-black shadow-[2px_2px_0px_#000] hover:bg-emphasis hover:translate-x-[-1px] hover:translate-y-[-1px] hover:shadow-[3px_3px_0px_#000] active:translate-x-[1px] active:translate-y-[1px] active:shadow-none transition-none cursor-pointer"
            >
              فاصله (Space)
            </button>

            <button
              type="button"
              onClick={() => {
                playTactileSound(activeTheme, 'tap')
                onInsert('،')
              }}
              className="min-h-[44px] w-10 rounded-none border-2 border-black bg-white text-sm font-black text-black shadow-[2px_2px_0px_#000] hover:bg-emphasis hover:translate-x-[-1px] hover:translate-y-[-1px] hover:shadow-[3px_3px_0px_#000] active:translate-x-[1px] active:translate-y-[1px] active:shadow-none transition-none cursor-pointer"
            >
              ،
            </button>

            <button
              type="button"
              onClick={() => {
                playTactileSound(activeTheme, 'tap')
                onInsert('.')
              }}
              className="min-h-[44px] w-10 rounded-none border-2 border-black bg-white text-sm font-black text-black shadow-[2px_2px_0px_#000] hover:bg-emphasis hover:translate-x-[-1px] hover:translate-y-[-1px] hover:shadow-[3px_3px_0px_#000] active:translate-x-[1px] active:translate-y-[1px] active:shadow-none transition-none cursor-pointer"
            >
              .
            </button>

            <button
              type="button"
              onClick={() => {
                playTactileSound(activeTheme, 'special')
                onNewLine()
              }}
              className="min-h-[44px] px-3.5 rounded-none border-2 border-black bg-emphasis text-black text-xs font-black shadow-[2px_2px_0px_#000] hover:bg-black hover:text-white hover:translate-x-[-1px] hover:translate-y-[-1px] hover:shadow-[3px_3px_0px_#000] active:translate-x-[1px] active:translate-y-[1px] active:shadow-none transition-none cursor-pointer"
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
              className="min-h-[44px] px-4 rounded-none border-2 border-black bg-white text-sm font-black text-black shadow-[2px_2px_0px_#000] hover:bg-emphasis hover:translate-x-[-1px] hover:translate-y-[-1px] hover:shadow-[3px_3px_0px_#000] active:translate-x-[1px] active:translate-y-[1px] active:shadow-none transition-none cursor-pointer"
            >
              «گیومه»
            </button>
            <button
              type="button"
              onClick={() => {
                playTactileSound(activeTheme, 'special')
                onHalfSpace()
              }}
              className="min-h-[44px] px-4 rounded-none border-2 border-black bg-field text-black text-xs font-black shadow-[2px_2px_0px_#000] hover:bg-emphasis hover:translate-x-[-1px] hover:translate-y-[-1px] hover:shadow-[3px_3px_0px_#000] active:translate-x-[1px] active:translate-y-[1px] active:shadow-none transition-none cursor-pointer"
            >
              [نیم‌فاصله]
            </button>
            <button
              type="button"
              onClick={() => {
                playTactileSound(activeTheme, 'tap')
                onBackspace()
              }}
              className="min-h-[44px] px-4 rounded-none border-2 border-black bg-signal/20 text-black text-sm font-black shadow-[2px_2px_0px_#000] hover:bg-signal hover:text-white hover:translate-x-[-1px] hover:translate-y-[-1px] hover:shadow-[3px_3px_0px_#000] active:translate-x-[1px] active:translate-y-[1px] active:shadow-none transition-none cursor-pointer"
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
      className="flex min-h-[44px] min-w-[28px] sm:min-w-[34px] flex-1 items-center justify-center rounded-none border-2 border-black bg-white text-base sm:text-lg font-black text-black shadow-[2px_2px_0px_#000] hover:bg-emphasis hover:translate-x-[-1px] hover:translate-y-[-1px] hover:shadow-[3px_3px_0px_#000] active:translate-x-[1px] active:translate-y-[1px] active:shadow-none transition-none cursor-pointer"
    >
      {label}
    </button>
  )
}
