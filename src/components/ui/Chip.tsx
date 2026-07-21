import type { Category } from '../../lib/api/types'
import { CATEGORY_META } from '../../lib/format'

/**
 * Filter chip. Neutral by default, graphite when on — the category's colour
 * appears only as a small dot, matching its pin on the map.
 */
export function CategoryChip({
  category,
  active = false,
  onClick,
}: {
  category: Category
  active?: boolean
  onClick?: () => void
}) {
  const meta = CATEGORY_META[category]
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`pressable inline-flex min-h-[34px] items-center gap-1.5 whitespace-nowrap rounded-full px-3.5 text-[14px] font-medium transition-colors ${
        active ? 'bg-accent text-white' : 'bg-surface text-label shadow-[0_1px_3px_rgba(0,0,0,0.1)]'
      }`}
    >
      <span
        aria-hidden
        className="h-2 w-2 rounded-full"
        style={{ backgroundColor: active ? '#fff' : meta.color }}
      />
      {meta.label}
    </button>
  )
}

/** Small colour-coded category badge shown on a place. */
export function CategoryBadge({ category }: { category: Category }) {
  const meta = CATEGORY_META[category]
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[13px] font-semibold"
      style={{ backgroundColor: `${meta.color}1a`, color: meta.color }}
    >
      <span aria-hidden className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: meta.color }} />
      {meta.label}
    </span>
  )
}
