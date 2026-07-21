import { scoreColor } from '../../lib/format'

export function ScoreBar({ label, score }: { label: string; score: number }) {
  const color = scoreColor(score)
  return (
    <div className="flex items-center gap-3">
      <span className="w-[62px] shrink-0 t-subhead text-label-2">{label}</span>
      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-fill">
        <div
          className="h-full rounded-full transition-[width] duration-500"
          style={{ width: `${(score / 10) * 100}%`, backgroundColor: color }}
        />
      </div>
      <span className="w-8 shrink-0 text-right t-subhead font-semibold tabular-nums" style={{ color }}>
        {score.toFixed(1)}
      </span>
    </div>
  )
}
