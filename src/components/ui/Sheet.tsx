import type { ReactNode } from 'react'

export function Sheet({
  open,
  onClose,
  children,
  tall = false,
}: {
  open: boolean
  onClose: () => void
  children: ReactNode
  tall?: boolean
}) {
  if (!open) return null
  return (
    <div className="fixed inset-0 z-40">
      <div className="absolute inset-0 bg-black/25 anim-fade-in" onClick={onClose} />
      <div
        className={`absolute inset-x-0 bottom-0 mx-auto max-w-md anim-sheet rounded-t-[14px] bg-surface shadow-[0_-8px_40px_rgba(0,0,0,0.16)] ${
          tall ? 'max-h-[88dvh]' : 'max-h-[72dvh]'
        } overflow-y-auto no-scrollbar pb-safe`}
      >
        <div className="sticky top-0 z-10 flex justify-center bg-surface pt-2 pb-1.5">
          <div className="h-[5px] w-9 rounded-full bg-[rgba(60,60,67,0.2)]" />
        </div>
        {children}
      </div>
    </div>
  )
}
