import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../lib/api'
import { useUi } from '../lib/session'

const MIN_LENGTH = 8

/**
 * Where the link in the reset email lands. Supabase has already signed the
 * member in by the time this renders — the session is only good for setting a
 * password, so this screen stands between them and the rest of the app.
 */
export function ResetPasswordScreen() {
  const navigate = useNavigate()
  const setPasswordRecovery = useUi((s) => s.setPasswordRecovery)
  const showToast = useUi((s) => s.showToast)

  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const tooShort = password.length > 0 && password.length < MIN_LENGTH
  const mismatch = confirm.length > 0 && confirm !== password
  const canSubmit = password.length >= MIN_LENGTH && confirm === password

  const submit = async () => {
    setBusy(true)
    setError(null)
    try {
      await api.updatePassword(password)
      setPasswordRecovery(false)
      showToast('Password changed')
      navigate('/', { replace: true })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not change your password.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex h-full flex-col overflow-y-auto bg-surface px-6 pb-10">
      <div className="flex flex-1 flex-col justify-center pt-20 land:mx-auto land:w-full land:max-w-md land:pt-6">
        <div className="anim-fade-up">
          <h1 className="t-large-title">Choose a new password</h1>
          <p className="mt-2.5 max-w-[34ch] text-[17px] leading-snug text-label-2">
            You are signed in from the link in your email. Set a password and you are back in.
          </p>
        </div>

        <div className="anim-fade-up mt-8 space-y-3" style={{ animationDelay: '0.08s' }}>
          <input
            className="field bg-bg"
            type="password"
            placeholder="New password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoFocus
            aria-label="New password"
          />
          <input
            className="field bg-bg"
            type="password"
            placeholder="Repeat it"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            aria-label="Repeat the new password"
          />

          {tooShort && <p className="ios-section-footer">At least {MIN_LENGTH} characters.</p>}
          {mismatch && <p className="ios-section-footer text-danger">Those two do not match.</p>}
          {error && (
            <p role="alert" className="ios-section-footer text-danger">
              {error}
            </p>
          )}

          <button type="button" disabled={busy || !canSubmit} onClick={submit} className="pressable btn-primary !mt-5">
            {busy ? '…' : 'Save and continue'}
          </button>

          <button
            type="button"
            onClick={async () => {
              // Leaving without setting one would strand them in a session that
              // only exists for this, so sign out on the way past.
              setPasswordRecovery(false)
              await api.signOut()
              navigate('/welcome', { replace: true })
            }}
            className="pressable min-h-[44px] w-full text-[15px] font-medium text-label-2"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}
