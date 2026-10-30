import { ArrowRight, ShieldCheck, Sparkles } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { Logo } from '../../components/ui'
import { api, ApiError } from '../../lib/api'
import { session, useSession, type Session } from '../../lib/session'

/** Sign-in and registration for ward-office staff. */
export function Login() {
  const [mode, setMode] = useState<'in' | 'up'>('in')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [title, setTitle] = useState('Ward Officer')
  const [authorityCode, setAuthorityCode] = useState('civic-demo')
  const [err, setErr] = useState<string | null>(null)
  const [fields, setFields] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState(false)
  const nav = useNavigate()
  const st = (useLocation().state as { from?: string; citizen?: boolean } | null) ?? {}
  const from = st.from && st.from.startsWith('/command') ? st.from : '/command'
  const me = useSession()

  if (me?.user.role === 'authority') return <Navigate to={from} replace />

  const fillOfficerDemo = () => {
    setEmail('officer@civicpulse.demo')
    setPassword('Officer@2026')
    setErr(null)
    setFields({})
  }

  const fillEngineerDemo = () => {
    setEmail('engineer@civicpulse.demo')
    setPassword('Engineer@2026')
    setErr(null)
    setFields({})
  }

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setErr(null)
    setFields({})

    try {
      let s: Session
      if (mode === 'up') {
        s = await api.register(name.trim(), email.trim(), password, 'authority', title.trim(), authorityCode.trim())
      } else {
        s = await api.signIn(email.trim(), password, 'authority')
      }
      session.set(s)
      nav(from, { replace: true })
    } catch (e) {
      setErr((e as Error).message)
      if (e instanceof ApiError) setFields(e.fields)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="login">
      <div className="login__art" aria-hidden>
        <Logo light />
        <p className="serif login__quote">“Fix the thing that will hurt someone first. Then fix the thing that keeps coming back.”</p>
        <p className="mono login__cap">Ward Office Command Center</p>
      </div>

      <form className="login__form" onSubmit={submit} noValidate>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
          <span className="eyebrow"><ShieldCheck size={14} /> Authority Portal</span>
          <div className="seg" role="tablist" aria-label="Authority Mode">
            <button
              type="button"
              role="tab"
              aria-selected={mode === 'in'}
              className={mode === 'in' ? 'is-on' : ''}
              onClick={() => { setMode('in'); setErr(null); setFields({}) }}
            >
              Sign in
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={mode === 'up'}
              className={mode === 'up' ? 'is-on' : ''}
              onClick={() => { setMode('up'); setErr(null); setFields({}) }}
            >
              Register
            </button>
          </div>
        </div>

        <h1 className="serif display-2">
          {mode === 'in' ? 'Command Center' : 'Register Authority'}
        </h1>

        <p className="muted">
          {mode === 'in'
            ? 'For ward-office staff, engineers, and municipal administrators.'
            : 'Register a staff account with your official designation and authority passcode.'}
        </p>

        {(st.citizen || me?.user.role === 'citizen') && (
          <div className="notice notice--warn" role="status">
            You are signed in as a citizen ({me?.user.name}). Citizen accounts cannot open the Command Center.{' '}
            <Link to="/account" className="link-id">Go to my reports</Link>
          </div>
        )}

        <div className="acct__demo-badge" style={{ marginBlock: 2 }}>
          <b>Demo Authority Credentials</b>
          <span>Officer: <code>officer@civicpulse.demo</code> (Priya Shetty)</span>
          <span>Engineer: <code>engineer@civicpulse.demo</code> (Er. Anil Rao)</span>
          <span>Demo Passcode: <code>civic-demo</code></span>
          {mode === 'in' && (
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 4 }}>
              <button type="button" className="acct__demo-click" onClick={fillOfficerDemo}>
                <Sparkles size={13} /> Auto-fill Ward Officer
              </button>
              <button type="button" className="acct__demo-click" onClick={fillEngineerDemo}>
                <Sparkles size={13} /> Auto-fill Engineer
              </button>
            </div>
          )}
        </div>

        {mode === 'up' && (
          <div className="field">
            <label htmlFor="a-name">Full name</label>
            <input
              id="a-name"
              className="input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Er. Anil Rao"
              autoComplete="name"
              maxLength={80}
              required
              aria-invalid={!!fields.name}
            />
            {fields.name && <span className="error" role="alert">{fields.name}</span>}
          </div>
        )}

        <div className="field">
          <label htmlFor="a-email">Work email</label>
          <input
            id="a-email"
            className="input"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="officer@civicpulse.demo"
            autoComplete="username"
            required
            aria-invalid={!!fields.email}
          />
          {fields.email && <span className="error" role="alert">{fields.email}</span>}
        </div>

        {mode === 'up' && (
          <>
            <div className="field">
              <label htmlFor="a-title">Designation / Title</label>
              <input
                id="a-title"
                className="input"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Ward Officer, Road Engineer"
                maxLength={100}
                required
                aria-invalid={!!fields.title}
              />
              {fields.title && <span className="error" role="alert">{fields.title}</span>}
            </div>

            <div className="field">
              <label htmlFor="a-code">Authority Passcode</label>
              <input
                id="a-code"
                className="input"
                value={authorityCode}
                onChange={(e) => setAuthorityCode(e.target.value)}
                placeholder="civic-demo"
                autoComplete="off"
                required
                aria-invalid={!!fields.authority_code}
              />
              {fields.authority_code ? (
                <span className="error" role="alert">{fields.authority_code}</span>
              ) : (
                <span className="hint">Demo passcode: <code>civic-demo</code></span>
              )}
            </div>
          </>
        )}

        <div className="field">
          <label htmlFor="a-pass">Password</label>
          <input
            id="a-pass"
            className="input"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete={mode === 'up' ? 'new-password' : 'current-password'}
            required
            aria-invalid={!!fields.password}
          />
          {fields.password ? (
            <span className="error" role="alert">{fields.password}</span>
          ) : (
            mode === 'up' && <span className="hint">At least 8 characters.</span>
          )}
          {err && !Object.keys(fields).length && (
            <span className="error" role="alert">{err}</span>
          )}
        </div>

        <div className="hero__ctas" style={{ marginTop: 0 }}>
          <button
            className="btn btn--signal btn--block"
            disabled={busy || !email || !password || (mode === 'up' && (!name || !title || !authorityCode))}
          >
            {busy
              ? 'Please wait…'
              : mode === 'in'
                ? <>Sign in to Command Center <ArrowRight /></>
                : <>Register Authority Account <ArrowRight /></>}
          </button>
        </div>

        <p className="small muted">
          Citizen?{' '}
          <Link to="/account?role=citizen" className="link-id">
            Go to Citizen Sign-in & Register
          </Link>
        </p>

        <Link to="/" className="small muted">
          ← Back to public site
        </Link>
      </form>
    </div>
  )
}
