import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../lib/api'
import { useUi } from '../lib/session'

export function WelcomeScreen() {
  const navigate = useNavigate()
  const session = useUi((s) => s.session)
  const [mode, setMode] = useState<'signup' | 'signin' | 'forgot'>('signup')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [username, setUsername] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sent, setSent] = useState(false)

  useEffect(() => {
    if (session) navigate('/', { replace: true })
  }, [session, navigate])

  const go = (next: typeof mode) => {
    setMode(next)
    setError(null)
    setSent(false)
  }

  const submit = async () => {
    setBusy(true)
    setError(null)
    try {
      if (mode === 'forgot') {
        await api.sendPasswordReset(email)
        setSent(true)
      } else if (mode === 'signin') {
        await api.signIn(email, password)
        navigate('/', { replace: true })
      } else {
        await api.signUp({ email, password, username, displayName })
        navigate('/', { replace: true })
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong.')
    } finally {
      setBusy(false)
    }
  }

  const canSubmit =
    mode === 'forgot'
      ? email.trim() !== ''
      : mode === 'signin'
        ? email.trim() !== '' && password !== ''
        : email.trim() !== '' && password !== '' && username.trim().length >= 3 && displayName.trim() !== ''

  return (
    <div className="flex h-full flex-col overflow-y-auto bg-surface px-6 pb-10">
      <div className="flex flex-1 flex-col justify-center pt-20">
        <div className="anim-fade-up">
          <h1 className="font-display text-[46px] font-semibold leading-none tracking-tight">Curated</h1>
          <p className="mt-4 max-w-[30ch] text-[17px] leading-snug text-label-2">
            {mode === 'forgot'
              ? 'Enter the email you signed up with and we’ll send you a link to set a new password.'
              : 'An atlas of places worth your time, pinned by people who share your taste.'}
          </p>
        </div>

        <div className="anim-fade-up mt-10 space-y-3" style={{ animationDelay: '0.08s' }}>
          {mode === 'signup' && (
            <>
              <input
                className="field bg-bg"
                placeholder="Your name"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                aria-label="Your name"
              />
              <input
                className="field bg-bg"
                placeholder="Username"
                value={username}
                onChange={(e) => setUsername(e.target.value.toLowerCase())}
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                aria-label="Username"
              />
            </>
          )}
          <input
            className="field bg-bg"
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoCapitalize="none"
            autoCorrect="off"
            aria-label="Email"
          />
          {mode !== 'forgot' && (
            <input
              className="field bg-bg"
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              aria-label="Password"
            />
          )}

          {error && <p className="ios-section-footer text-danger">{error}</p>}
          {sent && (
            <p className="ios-section-footer text-label">
              ✓ If an account uses {email.trim()}, a reset link is on its way. Check your spam folder too — the link
              opens straight back here.
            </p>
          )}

          <button type="button" disabled={busy || !canSubmit} onClick={submit} className="pressable btn-primary !mt-5">
            {busy ? '…' : mode === 'forgot' ? 'Email me a reset link' : mode === 'signin' ? 'Sign in' : 'Create account'}
          </button>

          {mode === 'signin' && (
            <button
              type="button"
              onClick={() => go('forgot')}
              className="pressable min-h-[44px] w-full text-[15px] font-medium text-label-2"
            >
              Forgot your password?
            </button>
          )}

          <button
            type="button"
            onClick={() => go(mode === 'signin' ? 'signup' : 'signin')}
            className="pressable min-h-[44px] w-full text-[15px] font-medium text-label-2"
          >
            {mode === 'signin' ? 'New here? Create an account' : mode === 'forgot' ? 'Back to sign in' : 'Already a member? Sign in'}
          </button>
        </div>
      </div>

      {api.isDemo && (
        <div className="anim-fade-up rounded-xl bg-bg p-4" style={{ animationDelay: '0.16s' }}>
          <p className="t-footnote leading-relaxed text-label-2">
            Demo mode — everything runs locally on this device. Any email and password will do.
          </p>
        </div>
      )}
    </div>
  )
}
