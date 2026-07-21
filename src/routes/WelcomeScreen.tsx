import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api, DEMO_INVITE_CODE } from '../lib/api'
import { useUi } from '../lib/session'

type Mode = 'code' | 'signin'

export function WelcomeScreen() {
  const navigate = useNavigate()
  const session = useUi((s) => s.session)
  const [mode, setMode] = useState<Mode>('code')
  const [code, setCode] = useState('')
  const [codeValid, setCodeValid] = useState<boolean | null>(null)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [username, setUsername] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (session) navigate('/', { replace: true })
  }, [session, navigate])

  // Live invite-code validation, debounced.
  useEffect(() => {
    setCodeValid(null)
    const c = code.trim()
    if (c.length < 6) return
    const t = setTimeout(() => {
      api.checkInviteCode(c).then(({ valid }) => setCodeValid(valid)).catch(() => setCodeValid(null))
    }, 350)
    return () => clearTimeout(t)
  }, [code])

  const submit = async () => {
    setBusy(true)
    setError(null)
    try {
      if (mode === 'signin') {
        await api.signIn(email, password)
      } else {
        await api.signUpWithInvite({ code, email, password, username, displayName })
      }
      navigate('/', { replace: true })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong.')
    } finally {
      setBusy(false)
    }
  }

  const showDetails = mode === 'signin' || codeValid === true

  return (
    <div className="flex min-h-dvh flex-col overflow-y-auto bg-surface px-6 pb-10">
      <div className="flex flex-1 flex-col justify-center pt-20">
        <div className="anim-fade-up">
          <h1 className="font-display text-[46px] font-semibold leading-none tracking-tight">Curated</h1>
          <p className="mt-4 max-w-[30ch] text-[17px] leading-snug text-label-2">
            An atlas of places worth your time, pinned by people who share your taste.
          </p>
        </div>

        <div className="anim-fade-up mt-10 space-y-3" style={{ animationDelay: '0.08s' }}>
          {mode === 'code' && (
            <div className="relative">
              <input
                className="field bg-bg pr-11 font-mono uppercase tracking-[0.18em]"
                placeholder="Invite code"
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                autoCapitalize="characters"
                autoCorrect="off"
                spellCheck={false}
                aria-label="Invite code"
              />
              {codeValid !== null && (
                <span
                  className={`absolute right-4 top-1/2 -translate-y-1/2 text-[17px] ${
                    codeValid ? 'text-label' : 'text-danger'
                  }`}
                >
                  {codeValid ? '✓' : '✕'}
                </span>
              )}
              {codeValid === false && (
                <p className="ios-section-footer text-danger">That code isn’t valid, or it has already been used.</p>
              )}
            </div>
          )}

          {showDetails && (
            <div className="anim-fade-up space-y-3">
              {mode === 'code' && (
                <>
                  <input className="field bg-bg" placeholder="Your name" value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
                  <input
                    className="field bg-bg"
                    placeholder="Username"
                    value={username}
                    onChange={(e) => setUsername(e.target.value.toLowerCase())}
                    autoCapitalize="none"
                    autoCorrect="off"
                    spellCheck={false}
                  />
                </>
              )}
              <input className="field bg-bg" type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} autoCapitalize="none" />
              <input className="field bg-bg" type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} />

              {error && <p className="ios-section-footer text-danger">{error}</p>}

              <button type="button" disabled={busy} onClick={submit} className="pressable btn-primary !mt-5">
                {busy ? '…' : mode === 'signin' ? 'Sign in' : 'Join Curated'}
              </button>
            </div>
          )}

          <button
            type="button"
            onClick={() => {
              setMode(mode === 'signin' ? 'code' : 'signin')
              setError(null)
            }}
            className="pressable min-h-[44px] w-full text-[15px] font-medium text-label-2"
          >
            {mode === 'signin' ? 'Have an invite code?' : 'Already a member? Sign in'}
          </button>
        </div>
      </div>

      {api.isDemo && mode === 'code' && (
        <div className="anim-fade-up rounded-xl bg-bg p-4" style={{ animationDelay: '0.16s' }}>
          <p className="t-footnote leading-relaxed text-label-2">
            Demo mode — everything runs locally on this device. Join with code{' '}
            <button
              type="button"
              className="pressable font-mono font-bold tracking-widest text-label underline underline-offset-2"
              onClick={() => setCode(DEMO_INVITE_CODE)}
            >
              {DEMO_INVITE_CODE}
            </button>
          </p>
        </div>
      )}
    </div>
  )
}
