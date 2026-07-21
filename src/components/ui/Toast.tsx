import { useUi } from '../../lib/session'

export function Toast() {
  const toast = useUi((s) => s.toast)
  if (!toast) return null
  return (
    <div className="pointer-events-none fixed inset-x-0 top-3 z-[60] flex justify-center px-6">
      <div
        key={toast.id}
        className="anim-fade-up flex items-center gap-2 rounded-full bg-surface px-5 py-3 t-subhead font-semibold shadow-[0_6px_24px_rgba(0,0,0,0.16)]"
      >
        {toast.gold && <span aria-hidden className="text-[15px]">✦</span>}
        {toast.message}
      </div>
    </div>
  )
}
