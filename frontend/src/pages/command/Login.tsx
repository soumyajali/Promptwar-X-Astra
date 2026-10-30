import { ArrowRight, Lock } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { Logo } from '../../components/ui'
import { api } from '../../lib/api'
import { session, useSession } from '../../lib/session'

/** Separate sign-in for ward-office staff. Demo accounts only — see README; not government authentication. */
export function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [err, setErr] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const nav = useNavigate()
  const st = (useLocation().state as { from?: string; citizen?: boolean } | null) ?? {}
  const from = st.from && st.from.startsWith('/command') ? st.from : '/command'
  const me = useSession()
  if (me?.user.role === 'authority') return <Navigate to={from} replace />

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setErr(null)
    try {
      const s = await api.signIn(email.trim(), password, 'authority')
      session.set(s)
      nav(from, { replace: true })
    } catch (e) { setErr((e as Error).message) } finally { setBusy(false) }
  }

  return (
    <div className="login">
      <div className="login__art" aria-hidden>
        <Logo light />
        <p className="serif login__quote">“Fix the thing that will hurt someone first. Then fix the thing that keeps coming back.”</p>
        <p className="mono login__cap">Ward Office Command Center</p>
      </div>
      <form className="login__form" onSubmit={submit} noValidate>
        <span className="eyebrow"><Lock size={13} /> Authority sign-in</span>
        <h1 className="serif display-2">Command Center</h1>
        <p className="muted">For ward-office staff. These are demo accounts for the hackathon (listed in the README) — not government identity verification.</p>
        {(st.citizen || me?.user.role === 'citizen') && (
          <div className="notice notice--warn" role="status">You are signed in as a citizen ({me?.user.name}). Citizen accounts cannot open the Command Center. <Link to="/account" className="link-id">Go to my reports</Link></div>
        )}
        <div className="field">
          <label htmlFor="a-email">Work email</label>
          <input id="a-email" className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="username" required aria-invalid={!!err} />
        </div>
        <div className="field">
          <label htmlFor="a-pass">Password</label>
          <input id="a-pass" className="input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" required aria-invalid={!!err} />
          {err && <span className="error" role="alert">{err}</span>}
        </div>
        <div className="hero__ctas" style={{ marginTop: 0 }}>
          <button className="btn btn--signal" disabled={busy || !email || !password}>{busy ? 'Signing in…' : <>Sign in <ArrowRight /></>}</button>
        </div>
        <p className="small muted">Citizen? <Link to="/account" className="link-id">Sign in to your citizen account</Link></p>
        <Link to="/" className="small muted">← Back to public site</Link>
      </form>
    </div>
  )
}
