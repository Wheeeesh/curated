import { useEffect, useState } from 'react'

/**
 * Invites people to install the app, because neither platform makes it
 * obvious. Chrome fires `beforeinstallprompt` and we can show a real button;
 * iOS has no such API at all, so the only thing that works there is telling
 * people which two taps to make.
 *
 * Shows nothing once the app is installed, and nothing again once dismissed.
 */

const DISMISSED_KEY = 'curated-install-dismissed'

/** Chrome's install event, which TypeScript has no DOM type for. */
interface InstallEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

/** Already launched from the home screen — nothing to advertise. */
function isInstalled(): boolean {
  if (window.matchMedia('(display-mode: standalone)').matches) return true
  // iOS predates the standard and reports it on navigator instead.
  return (window.navigator as Navigator & { standalone?: boolean }).standalone === true
}

/**
 * iOS Safari specifically: other iOS browsers can't install to the home
 * screen at all, so pointing them at a Share menu they don't have would be
 * worse than saying nothing.
 */
function isIosSafari(): boolean {
  const ua = window.navigator.userAgent
  const iOS = /iPad|iPhone|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1)
  if (!iOS) return false
  return /Safari/.test(ua) && !/CriOS|FxiOS|EdgiOS|OPiOS/.test(ua)
}

const ShareGlyph = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" className="inline-block -mt-0.5 align-middle">
    <path d="M12 15V3m0 0L8.5 6.5M12 3l3.5 3.5" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M6 12H5a1 1 0 0 0-1 1v7a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-7a1 1 0 0 0-1-1h-1" strokeLinecap="round" />
  </svg>
)

export function InstallPrompt() {
  const [installEvent, setInstallEvent] = useState<InstallEvent | null>(null)
  const [showIosHint, setShowIosHint] = useState(false)
  const [dismissed, setDismissed] = useState(() => localStorage.getItem(DISMISSED_KEY) === '1')

  useEffect(() => {
    if (dismissed || isInstalled()) return

    const onPrompt = (e: Event) => {
      // Keep the event: calling prompt() later is the only way to install.
      e.preventDefault()
      setInstallEvent(e as InstallEvent)
    }
    window.addEventListener('beforeinstallprompt', onPrompt)

    // Nothing to wait for on iOS, but give the map a moment before interrupting.
    const t = isIosSafari() ? setTimeout(() => setShowIosHint(true), 2500) : undefined

    const onInstalled = () => close()
    window.addEventListener('appinstalled', onInstalled)

    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt)
      window.removeEventListener('appinstalled', onInstalled)
      if (t) clearTimeout(t)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dismissed])

  const close = () => {
    localStorage.setItem(DISMISSED_KEY, '1')
    setDismissed(true)
    setInstallEvent(null)
    setShowIosHint(false)
  }

  const install = async () => {
    if (!installEvent) return
    await installEvent.prompt()
    await installEvent.userChoice
    close()
  }

  if (dismissed || (!installEvent && !showIosHint)) return null

  return (
    // Constrained to the app's own column like the tab bar, or it spans the
    // whole window on anything wider than a phone.
    <div className="anim-fade-up pointer-events-none fixed inset-x-0 bottom-[76px] z-40 mx-auto max-w-md px-4 land:bottom-4 land:left-[84px] land:mx-0">
      {/* Opaque, not .glass: it shares this slot with the map's unlock banner
          and has to cover it rather than blend into it. */}
      <div className="pointer-events-auto flex items-center gap-3 rounded-2xl bg-surface px-4 py-3 shadow-[0_4px_20px_rgba(0,0,0,0.18)]">
        <span className="min-w-0 flex-1">
          <span className="block t-subhead font-semibold">Keep Curated on your Home Screen</span>
          <span className="block t-footnote text-label-2">
            {installEvent ? (
              'Opens full screen, and the atlas works offline.'
            ) : (
              <>
                Tap <ShareGlyph /> below, then <span className="font-medium text-label">Add to Home Screen</span>.
              </>
            )}
          </span>
        </span>

        {installEvent && (
          <button
            type="button"
            onClick={install}
            className="pressable shrink-0 rounded-full bg-accent px-4 py-2 t-footnote font-semibold text-white"
          >
            Install
          </button>
        )}
        <button
          type="button"
          onClick={close}
          aria-label="Dismiss"
          className="pressable -mr-1 shrink-0 p-1 text-label-3"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
            <path d="m6 6 12 12M18 6 6 18" strokeLinecap="round" />
          </svg>
        </button>
      </div>
    </div>
  )
}
