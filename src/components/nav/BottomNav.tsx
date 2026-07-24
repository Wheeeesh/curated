import { NavLink, useLocation } from 'react-router-dom'

const TABS = [
  {
    to: '/',
    label: 'Atlas',
    icon: (active: boolean) => (
      <svg width="26" height="26" viewBox="0 0 24 24" fill="none" strokeWidth={active ? 2 : 1.6} stroke="currentColor">
        <path
          d="M9 4 3.5 6.2v13.3L9 17.3l6 2.2 5.5-2.2V4L15 6.2 9 4Z"
          strokeLinejoin="round"
          fill={active ? 'currentColor' : 'none'}
          fillOpacity={active ? 0.14 : 0}
        />
        <path d="M9 4v13.3M15 6.2v13.3" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    to: '/people',
    label: 'Members',
    icon: (active: boolean) => (
      <svg width="26" height="26" viewBox="0 0 24 24" fill="none" strokeWidth={active ? 2 : 1.6} stroke="currentColor">
        <circle cx="9.5" cy="8" r="3.5" fill={active ? 'currentColor' : 'none'} fillOpacity={active ? 0.14 : 0} />
        <path d="M3.8 19.4c.9-3.3 3-5 5.7-5s4.8 1.7 5.7 5" strokeLinecap="round" />
        <circle cx="17.2" cy="9.4" r="2.5" />
        <path d="M17 14.6c2.1.2 3.5 1.6 4 4" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    to: '/profile',
    label: 'You',
    icon: (active: boolean) => (
      <svg width="26" height="26" viewBox="0 0 24 24" fill="none" strokeWidth={active ? 2 : 1.6} stroke="currentColor">
        <circle cx="12" cy="8" r="3.8" fill={active ? 'currentColor' : 'none'} fillOpacity={active ? 0.14 : 0} />
        <path d="M5 20c1-3.9 3.8-5.8 7-5.8s6 1.9 7 5.8" strokeLinecap="round" />
      </svg>
    ),
  },
]

/**
 * A tab bar across the bottom in portrait. Sideways, vertical space is the
 * scarce one, so the same three tabs become a slim rail down the left edge.
 */
export function BottomNav() {
  const { pathname } = useLocation()
  return (
    <nav className="fixed inset-x-0 bottom-0 z-30 mx-auto max-w-md land:inset-y-0 land:right-auto land:mx-0 land:w-[72px] land:max-w-none">
      <div className="glass border-t border-separator pb-safe land:h-full land:border-r land:border-t-0 land:pb-0 land:pl-safe">
        <div className="flex land:h-full land:flex-col land:justify-center land:gap-3">
          {TABS.map((tab) => {
            const active = tab.to === '/' ? pathname === '/' : pathname.startsWith(tab.to)
            return (
              <NavLink
                key={tab.to}
                to={tab.to}
                aria-current={active ? 'page' : undefined}
                className={`pressable flex min-h-[52px] flex-1 flex-col items-center justify-center gap-0.5 pt-1.5 land:flex-none land:pt-0 ${
                  active ? 'text-accent' : 'text-label-3'
                }`}
              >
                {tab.icon(active)}
                <span className={`text-[10px] ${active ? 'font-semibold' : 'font-medium'}`}>{tab.label}</span>
              </NavLink>
            )
          })}
        </div>
      </div>
    </nav>
  )
}
