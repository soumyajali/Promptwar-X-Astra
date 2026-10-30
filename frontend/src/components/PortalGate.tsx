import { ArrowLeft, ArrowRight, Compass, ShieldCheck, Sparkles, UserRound } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { api, ApiError } from '../lib/api'
import { session, type Session } from '../lib/session'

interface PortalGateProps {
  onGuestExplore?: () => void
  showGuestOption?: boolean
  defaultRole?: 'citizen' | 'authority' | null
  defaultMode?: 'in' | 'up'
}

export function PortalGate({
  onGuestExplore,
  showGuestOption = true,
  defaultRole = null,
  defaultMode = 'up',
}: PortalGateProps) {
  const [params, setParams] = useSearchParams()
  const roleParam = params.get('role') as 'citizen' | 'authority' | null
  const modeParam = params.get('mode') === 'login' ? 'in' : params.get('mode') === 'register' ? 'up' : null

  const [selectedRole, setSelectedRole] = useState<'citizen' | 'authority' | null>(
    roleParam ?? defaultRole
  )
  const [mode, setMode] = useState<'in' | 'up'>(modeParam ?? defaultMode)

  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [title, setTitle] = useState('Ward Officer')
  const [authorityCode, setAuthorityCode] = useState('civic-demo')
  const [err, setErr] = useState<string | null>(null)
  const [fields, setFields] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState(false)
  const nav = useNavigate()

  const chooseRoleAndMode = (r: 'citizen' | 'authority', m: 'in' | 'up') => {
    setSelectedRole(r)
    setMode(m)
    setErr(null)
    setFields({})
    setParams({ role: r, mode: m === 'up' ? 'register' : 'login' }, { replace: true })
  }

  const backToChooser = () => {
    setSelectedRole(null)
    setErr(null)
    setFields({})
    setParams({}, { replace: true })
  }

  const fillCitizenDemo = () => {
    setEmail('citizen@civicpulse.demo')
    setPassword('Citizen@2026')
    setErr(null)
    setFields({})
  }

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
    if (!selectedRole) return
    setBusy(true)
    setErr(null)
    setFields({})

    try {
      let s: Session
      if (selectedRole === 'authority') {
        if (mode === 'up') {
          s = await api.register(name.trim(), email.trim(), password, 'authority', title.trim(), authorityCode.trim())
        } else {
          s = await api.signIn(email.trim(), password, 'authority')
        }
        session.set(s)
        nav('/command', { replace: true })
      } else {
        if (mode === 'up') {
          s = await api.register(name.trim(), email.trim(), password, 'citizen')
        } else {
          s = await api.signIn(email.trim(), password, 'citizen')
        }
        session.set(s)
        nav('/account', { replace: true })
      }
    } catch (e) {
      setErr((e as Error).message)
      if (e instanceof ApiError) setFields(e.fields)
    } finally {
      setBusy(false)
    }
  }

  const isCitizen = selectedRole === 'citizen'

  return (
    <div className="portal-gate">
      <div className="portal-gate__inner">
        {/* STEP 1: Two Portal Selection Cards */}
        {selectedRole === null ? (
          <>
            <div className="portal-gate__head">
              <span className="eyebrow eyebrow--light">CivicPulse AI · Access Gateway</span>
              <h1 className="serif display-1">Select Your Portal</h1>
              <p className="muted" style={{ fontSize: 17, lineHeight: 1.6 }}>
                Choose whether you are registering or signing in as a <b>Citizen / Resident</b> or as <b>Ward Authority staff</b>.
              </p>
            </div>

            <div className="portal-gate__grid">
              {/* Card 1: Citizen / Resident */}
              <div className="portal-card">
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div className="portal-card__icon">
                    <UserRound size={26} />
                  </div>
                  <span className="eyebrow">Resident Access</span>
                </div>

                <div className="portal-card__body">
                  <h2 className="portal-card__title">Citizen / Resident</h2>
                  <p className="portal-card__desc">
                    Report potholes, streetlights, or flooding with photos and coordinates. Track your reports live as ward engineers take action.
                  </p>
                </div>

                <div className="portal-card__actions">
                  <button
                    type="button"
                    className="btn btn--signal btn--block"
                    onClick={() => chooseRoleAndMode('citizen', 'up')}
                  >
                    Register as Citizen <ArrowRight size={16} />
                  </button>
                  <button
                    type="button"
                    className="btn btn--quiet btn--block"
                    onClick={() => chooseRoleAndMode('citizen', 'in')}
                  >
                    Sign in to Citizen Account
                  </button>
                </div>

                <div className="portal-card__demo">
                  <Sparkles size={13} style={{ color: 'var(--amber)' }} />
                  <span>Demo citizen: <code>citizen@civicpulse.demo</code></span>
                </div>
              </div>

              {/* Card 2: Ward Authority */}
              <div className="portal-card portal-card--auth">
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div className="portal-card__icon">
                    <ShieldCheck size={26} />
                  </div>
                  <span className="eyebrow">Ward Office Access</span>
                </div>

                <div className="portal-card__body">
                  <h2 className="portal-card__title">Ward Authority</h2>
                  <p className="portal-card__desc">
                    For ward officers, road engineers, and municipal inspectors. Triage incoming complaints, review AI hotspots, and dispatch field crews.
                  </p>
                </div>

                <div className="portal-card__actions">
                  <button
                    type="button"
                    className="btn btn--civic btn--block"
                    onClick={() => chooseRoleAndMode('authority', 'up')}
                  >
                    Register as Authority <ArrowRight size={16} />
                  </button>
                  <button
                    type="button"
                    className="btn btn--quiet btn--block"
                    onClick={() => chooseRoleAndMode('authority', 'in')}
                  >
                    Sign in to Command Center
                  </button>
                </div>

                <div className="portal-card__demo">
                  <Sparkles size={13} style={{ color: 'var(--signal)' }} />
                  <span>Demo authority: <code>officer@civicpulse.demo</code></span>
                </div>
              </div>
            </div>

            {showGuestOption && (
              <div className="portal-gate__guest">
                <span>Want to view public metrics first?</span>
                {onGuestExplore ? (
                  <button type="button" className="btn btn--ghost btn--sm" onClick={onGuestExplore}>
                    <Compass size={14} /> Explore Public Overview as Guest
                  </button>
                ) : (
                  <Link to="/?view=public" className="btn btn--ghost btn--sm">
                    <Compass size={14} /> Explore Public Overview as Guest
                  </Link>
                )}
              </div>
            )}
          </>
        ) : (
          /* STEP 2: Dedicated Register / Login Form for the Chosen Role */
          <div className="portal-gate__form-container">
            <div className="portal-gate__top-nav">
              <button type="button" className="portal-gate__back-btn" onClick={backToChooser}>
                <ArrowLeft size={16} /> Choose different portal
              </button>

              <div className="acct__portal-tabs" role="tablist" aria-label="Selected portal">
                <button
                  type="button"
                  role="tab"
                  aria-selected={isCitizen}
                  className={`acct__portal-btn ${isCitizen ? 'is-active' : ''}`}
                  onClick={() => chooseRoleAndMode('citizen', mode)}
                >
                  <UserRound size={14} /> Citizen / Resident
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={!isCitizen}
                  className={`acct__portal-btn ${!isCitizen ? 'is-active' : ''}`}
                  onClick={() => chooseRoleAndMode('authority', mode)}
                >
                  <ShieldCheck size={14} /> Ward Authority
                </button>
              </div>
            </div>

            <div className="portal-gate__split">
              <div className="acct__intro">
                <span className="eyebrow">
                  {isCitizen ? 'Citizen Account' : 'Ward Office · Authority Portal'}
                </span>

                <h1 className="serif display-2">
                  {isCitizen
                    ? mode === 'in'
                      ? 'Sign in to track your reports'
                      : 'Create your citizen account'
                    : mode === 'in'
                      ? 'Authority sign-in to Command Center'
                      : 'Register ward-office staff account'}
                </h1>

                <p className="muted">
                  {isCitizen
                    ? 'An account keeps every civic complaint you file in one place, with live status updates from the ward engineers.'
                    : 'For municipal officers, road engineers, and ward inspectors to prioritize issues, dispatch crews, and publish status updates.'}
                </p>

                <div className="acct__demo-badge">
                  <b>{isCitizen ? 'Demo Citizen Credentials' : 'Demo Ward Authority Credentials'}</b>
                  {isCitizen ? (
                    <>
                      <span>Email: <code>citizen@civicpulse.demo</code> · Pass: <code>Citizen@2026</code></span>
                      {mode === 'in' && (
                        <button type="button" className="acct__demo-click" onClick={fillCitizenDemo}>
                          <Sparkles size={13} /> Auto-fill citizen credentials
                        </button>
                      )}
                    </>
                  ) : (
                    <>
                      <span>Officer: <code>officer@civicpulse.demo</code> · Engineer: <code>engineer@civicpulse.demo</code></span>
                      <span>Passcode: <code>civic-demo</code> · Passwords: <code>Officer@2026</code> / <code>Engineer@2026</code></span>
                      {mode === 'in' && (
                        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                          <button type="button" className="acct__demo-click" onClick={fillOfficerDemo}>
                            <Sparkles size={13} /> Auto-fill Ward Officer
                          </button>
                          <button type="button" className="acct__demo-click" onClick={fillEngineerDemo}>
                            <Sparkles size={13} /> Auto-fill Engineer
                          </button>
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>

              <form className="card acct__form" onSubmit={submit} noValidate>
                <div className="seg" role="tablist" aria-label="Sign in or register">
                  <button
                    type="button"
                    role="tab"
                    aria-selected={mode === 'up'}
                    className={mode === 'up' ? 'is-on' : ''}
                    onClick={() => { setMode('up'); setErr(null); setFields({}) }}
                  >
                    Create account (Register)
                  </button>
                  <button
                    type="button"
                    role="tab"
                    aria-selected={mode === 'in'}
                    className={mode === 'in' ? 'is-on' : ''}
                    onClick={() => { setMode('in'); setErr(null); setFields({}) }}
                  >
                    Sign in
                  </button>
                </div>

                {mode === 'up' && (
                  <div className="field">
                    <label htmlFor="gate-name">Full name</label>
                    <input
                      id="gate-name"
                      className="input"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder={isCitizen ? 'e.g. Ramesh Pai' : 'e.g. Er. Anil Rao'}
                      autoComplete="name"
                      maxLength={80}
                      required
                      aria-invalid={!!fields.name}
                    />
                    {fields.name && <span className="error">{fields.name}</span>}
                  </div>
                )}

                <div className="field">
                  <label htmlFor="gate-email">{isCitizen ? 'Email address' : 'Official work email'}</label>
                  <input
                    id="gate-email"
                    className="input"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder={isCitizen ? 'you@example.com' : 'officer@civicpulse.demo'}
                    autoComplete="email"
                    required
                    aria-invalid={!!fields.email}
                  />
                  {fields.email && <span className="error">{fields.email}</span>}
                </div>

                {!isCitizen && mode === 'up' && (
                  <>
                    <div className="field">
                      <label htmlFor="gate-title">Designation / Official Title</label>
                      <input
                        id="gate-title"
                        className="input"
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        placeholder="e.g. Ward Officer, Road Engineer, Inspector"
                        maxLength={100}
                        required
                        aria-invalid={!!fields.title}
                      />
                      {fields.title && <span className="error">{fields.title}</span>}
                    </div>

                    <div className="field">
                      <label htmlFor="gate-code">Authority Passcode</label>
                      <input
                        id="gate-code"
                        className="input"
                        value={authorityCode}
                        onChange={(e) => setAuthorityCode(e.target.value)}
                        placeholder="civic-demo"
                        autoComplete="off"
                        required
                        aria-invalid={!!fields.authority_code}
                      />
                      {fields.authority_code ? (
                        <span className="error">{fields.authority_code}</span>
                      ) : (
                        <span className="hint">Demo passcode: <code>civic-demo</code></span>
                      )}
                    </div>
                  </>
                )}

                <div className="field">
                  <label htmlFor="gate-pass">Password</label>
                  <input
                    id="gate-pass"
                    className="input"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete={mode === 'up' ? 'new-password' : 'current-password'}
                    required
                    aria-invalid={!!fields.password}
                  />
                  {fields.password ? (
                    <span className="error">{fields.password}</span>
                  ) : (
                    mode === 'up' && <span className="hint">At least 8 characters.</span>
                  )}
                </div>

                {err && !Object.keys(fields).length && (
                  <div className="notice notice--danger" role="alert">
                    {err}
                  </div>
                )}

                <button
                  className="btn btn--signal btn--block"
                  disabled={busy || !email || !password || (mode === 'up' && !name) || (!isCitizen && mode === 'up' && (!title || !authorityCode))}
                >
                  {busy
                    ? 'Please wait…'
                    : mode === 'in'
                      ? <>Sign in as {isCitizen ? 'Citizen' : 'Authority'} <ArrowRight /></>
                      : <>Register as {isCitizen ? 'Citizen' : 'Authority'} <ArrowRight /></>}
                </button>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 4 }}>
                  {isCitizen ? (
                    <p className="small muted">
                      Ward-office staff?{' '}
                      <button
                        type="button"
                        className="link-id"
                        style={{ background: 'none', border: 'none', padding: 0, font: 'inherit', cursor: 'pointer' }}
                        onClick={() => chooseRoleAndMode('authority', mode)}
                      >
                        Switch to Authority portal
                      </button>
                    </p>
                  ) : (
                    <p className="small muted">
                      Resident citizen?{' '}
                      <button
                        type="button"
                        className="link-id"
                        style={{ background: 'none', border: 'none', padding: 0, font: 'inherit', cursor: 'pointer' }}
                        onClick={() => chooseRoleAndMode('citizen', mode)}
                      >
                        Switch to Citizen portal
                      </button>
                    </p>
                  )}
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

