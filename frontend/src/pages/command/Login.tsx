import { ArrowRight, Lock } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { Logo } from '../../components/ui'
import { api, auth } from '../../lib/api'

export function Login() {
  const [code, setCode] = useState('')
  const [err, setErr] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const nav = useNavigate()
  const from = (useLocation().state as { from?: string } | null)?.from ?? '/command'

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setErr(null)
    try {
      await api.login(code.trim())
      auth.set(code.trim())
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
      <form className="login__form" onSubmit={submit}>
        <span className="eyebrow"><Lock size={13} /> Authority access</span>
        <h1 className="serif display-2">Command Center</h1>
        <p className="muted">This is a demo role gate, not real authentication. The access code is <code className="mono">civic-demo</code> (set <code className="mono">CIVICPULSE_AUTHORITY_CODE</code> to change it).</p>
        <div className="field">
          <label htmlFor="code">Access code</label>
          <input id="code" className="input" type="password" value={code} onChange={(e) => setCode(e.target.value)} autoComplete="current-password" aria-invalid={!!err} />
          {err && <span className="error">{err}</span>}
        </div>
        <div className="hero__ctas" style={{ marginTop: 0 }}>
          <button className="btn btn--civic" disabled={busy || !code}>Enter <ArrowRight /></button>
          <button type="button" className="btn btn--ghost" onClick={() => setCode('civic-demo')}>Use demo code</button>
        </div>
        <Link to="/" className="small muted">← Back to public site</Link>
      </form>
    </div>
  )
}
