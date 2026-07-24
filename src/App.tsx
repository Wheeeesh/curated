import { useEffect } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { BrowserRouter, Navigate, Outlet, Route, Routes, useLocation } from 'react-router-dom'
import { api } from './lib/api'
import { useUi } from './lib/session'
import { useMyProfile } from './lib/hooks'
import { Toast } from './components/ui/Toast'
import { BottomNav } from './components/nav/BottomNav'
import { WelcomeScreen } from './routes/WelcomeScreen'
import { OnboardingScreen } from './routes/OnboardingScreen'
import { MapScreen } from './routes/MapScreen'
import { PlaceDetailScreen } from './routes/PlaceDetailScreen'
import { ReviewScreen } from './routes/ReviewScreen'
import { AddPlaceScreen } from './routes/AddPlaceScreen'
import { PeopleScreen } from './routes/PeopleScreen'
import { ProfileScreen } from './routes/ProfileScreen'
import { UserScreen } from './routes/UserScreen'

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 30_000, retry: 1 } },
})

function Splash() {
  return (
    <div className="flex h-dvh items-center justify-center bg-surface">
      <div className="anim-fade-in font-display text-[30px] font-semibold tracking-tight">Curated</div>
    </div>
  )
}

/** Requires a session; kicks not-yet-onboarded members into onboarding. */
function Protected() {
  const session = useUi((s) => s.session)
  const { data: profile, isLoading } = useMyProfile()
  const { pathname } = useLocation()
  if (session === undefined) return <Splash />
  if (session === null) return <Navigate to="/welcome" replace />
  if (isLoading || !profile) return <Splash />
  if (!profile.onboarded && pathname !== '/onboarding') return <Navigate to="/onboarding" replace />
  return <Outlet />
}

function WithNav() {
  return (
    <>
      <Outlet />
      <BottomNav />
    </>
  )
}

export default function App() {
  const setSession = useUi((s) => s.setSession)

  useEffect(() => {
    let cancelled = false
    api.getSession().then((s) => {
      if (!cancelled) setSession(s)
    })
    const off = api.onAuthChange((s) => {
      setSession(s)
      // A sign-in/out invalidates everything user-scoped.
      queryClient.invalidateQueries()
    })
    return () => {
      cancelled = true
      off()
    }
  }, [setSession])

  return (
    <QueryClientProvider client={queryClient}>
      {/* BASE_URL keeps routing correct under the /curated/ subpath on Pages. */}
      <BrowserRouter basename={import.meta.env.BASE_URL}>
        {/* Portrait is a phone-width column; sideways the app fills the screen. */}
        <div className="relative mx-auto h-dvh max-w-md overflow-hidden bg-bg land:max-w-none">
          <Routes>
            <Route path="/welcome" element={<WelcomeScreen />} />
            <Route element={<Protected />}>
              <Route path="/onboarding" element={<OnboardingScreen />} />
              <Route element={<WithNav />}>
                <Route path="/" element={<MapScreen />} />
                <Route path="/people" element={<PeopleScreen />} />
                <Route path="/profile" element={<ProfileScreen />} />
              </Route>
              <Route path="/place/:id" element={<PlaceDetailScreen />} />
              <Route path="/place/:id/review" element={<ReviewScreen />} />
              <Route path="/add" element={<AddPlaceScreen />} />
              <Route path="/user/:id" element={<UserScreen />} />
            </Route>
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
          <Toast />
        </div>
      </BrowserRouter>
    </QueryClientProvider>
  )
}
