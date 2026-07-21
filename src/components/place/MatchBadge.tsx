import { matchTone } from '../../lib/format'

/** Personal match, as a single number in a ring. One label, never repeated. */
export function MatchRing({ pct, size = 56 }: { pct: number | null; size?: number }) {
  const stroke = size >= 60 ? 4 : 3
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  const tone = pct === null ? 'rgba(60,60,67,0.3)' : matchTone(pct)

  if (pct === null) {
    return (
      <div
        className="flex shrink-0 items-center justify-center rounded-full bg-fill text-[11px] font-semibold text-label-2"
        style={{ width: size, height: size }}
      >
        New
      </div>
    )
  }

  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(120,120,128,0.16)" strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={tone}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - pct / 100)}
          style={{ transition: 'stroke-dashoffset 0.7s cubic-bezier(0.22, 0.68, 0.34, 1)' }}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="font-semibold tabular-nums" style={{ color: tone, fontSize: size * 0.34, letterSpacing: '-0.03em' }}>
          {pct}
        </span>
      </div>
    </div>
  )
}
