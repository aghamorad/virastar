import type { ReactNode } from 'react'
import Link from 'next/link'
import { PRACTICAL_MODES, PLAYFUL_MODES } from '@/domain/modes'
import { ModeGlyph } from '../editor/ModeGlyph'
import { Star } from '../Star'

function Group({
  title,
  note,
  children,
}: {
  title: string
  note?: string
  children: ReactNode
}) {
  return (
    <section>
      <div className="mb-3 flex items-baseline gap-3">
        <h2 className="text-xl font-black">{title}</h2>
        {note && <p className="text-sm font-bold text-ink-soft">{note}</p>}
      </div>
      <div className="grid gap-3 sm:grid-cols-2">{children}</div>
    </section>
  )
}

export function StylesScreen() {
  return (
    <div className="space-y-10">
      <header>
        <h1 className="text-3xl font-black">سبک‌ها</h1>
        <p className="mt-2 max-w-xl text-sm leading-7 text-ink-soft">
          هر سبک، یک لحن است. ویراستار نوشته‌ات را به آن لحن می‌برد — بدون آنکه مفهومش را گم کند.
        </p>
      </header>

      <Group title="ابزار اصلی" note="هر روز، برای هر نوشته">
        {PRACTICAL_MODES.map((m) => (
          <ModeCard key={m.id} modeId={m.id} label={m.label} tagline={m.tagline} desc={m.description} />
        ))}
      </Group>

      <Group title="بازی با زبان" note="برای وقتی که می‌خواهی بدرخشانی">
        {PLAYFUL_MODES.map((m) => (
          <ModeCard key={m.id} modeId={m.id} label={m.label} tagline={m.tagline} desc={m.description} />
        ))}
      </Group>
    </div>
  )
}

function ModeCard({
  modeId,
  label,
  tagline,
  desc,
}: {
  modeId: string
  label: string
  tagline: string
  desc: string
}) {
  return (
    <Link
      href={`/edit?mode=${modeId}`}
      className="v-card shadow-soft group flex flex-col gap-3 p-5 transition-transform duration-200 hover:-translate-y-0.5"
    >
      <div className="flex items-center gap-3">
        <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-brand/10 text-brand">
          <ModeGlyph modeId={modeId} size={24} />
        </span>
        <div>
          <h3 className="text-lg font-black leading-none">{label}</h3>
          <p className="mt-1 text-xs font-bold text-ink-soft">{tagline}</p>
        </div>
      </div>
      <p className="text-sm leading-6 text-ink-soft">{desc}</p>
      <span className="mt-auto inline-flex items-center gap-1.5 text-sm font-extrabold text-brand transition-colors group-hover:text-brand-deep">
        <Star size={13} className="transition-transform duration-300 group-hover:rotate-90" />
        ویرایش با این سبک
      </span>
    </Link>
  )
}
