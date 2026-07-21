import { CATEGORIES } from '../../lib/api/types'
import { CATEGORY_META } from '../../lib/format'
import type { TasteVector } from '../../lib/taste/tasteVector'

/**
 * Taste profile as ranked bars, strongest first — answers "what am I into?"
 * at a glance. When `compareTo` is given (another member's page), a tick on
 * each bar marks where you sit, so two profiles compare row by row.
 */
export function TasteBars({
  vector,
  compareTo,
  compareLabel = 'you',
}: {
  vector: TasteVector
  compareTo?: TasteVector
  compareLabel?: string
}) {
  const rows = [...CATEGORIES].sort((a, b) => vector[b] - vector[a])

  return (
    <div>
      {compareTo && (
        <p className="mb-3 flex items-center gap-1.5 t-footnote text-label-2">
          <span aria-hidden className="inline-block h-3 w-[2px] rounded-full bg-white mix-blend-difference" />
          marks {compareLabel}
        </p>
      )}
      <div className="space-y-3">
        {rows.map((c) => {
          const pct = Math.round(vector[c] * 100)
          const mine = compareTo ? Math.round(compareTo[c] * 100) : null
          return (
            <div key={c} className="flex items-center gap-3">
              <span className="flex w-[76px] shrink-0 items-center gap-1.5 t-subhead">
                <span aria-hidden className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: CATEGORY_META[c].color }} />
                {CATEGORY_META[c].label}
              </span>
              <div className="relative h-2 flex-1 rounded-full bg-fill">
                <div
                  className="h-full rounded-full bg-accent transition-[width] duration-500"
                  style={{ width: `${pct}%` }}
                />
                {mine !== null && (
                  // Difference blend keeps the tick visible whether it lands on
                  // the dark fill or the light track.
                  <span
                    aria-hidden
                    className="absolute top-[-3px] h-[14px] w-[2px] rounded-full bg-white mix-blend-difference"
                    style={{ left: `calc(${mine}% - 1px)` }}
                  />
                )}
              </div>
              <span className="w-9 shrink-0 text-right t-footnote tabular-nums text-label-2">{pct}%</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
