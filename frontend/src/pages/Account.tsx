import { ArrowRight, CircleCheck, ClipboardList, Inbox, LogOut, Plus, ShieldCheck, Sparkles, UserRound } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { Card, StatTile } from '../components/obs'
import { ErrorState, PriorityBadge, Skeleton, StatusPill } from '../components/ui'
import { api, ApiError } from '../lib/api'
import { OPEN, timeAgo } from '../lib/format'
import { session, useSession, type Session } from '../lib/session'
import type { Level, Status } from '../lib/types'
import { useLiveQuery } from '../store/live'

/** User (Citizen) and Authority (Ward Office) accounts: sign in / create account, and citizen dashboard. */
export function Account() {
  const me = useSession()
  if (!me) return <AuthForms />
  if (me.user.role === 'authority') {
    return (
      <div className="wrap acct">
        <Card title="Signed in as ward-office staff">
          <p className="muted">{me.user.name} · {me.user.title || 'Ward office'}. Authority accounts operate the Command Center.</p>
          <div className="acct__row" style={{ marginTop: 16 }}>
            <Link to="/command" className="btn btn--signal">Open Command Center <ArrowRight /></Link>
            <SignOut />
          </div>
        </Card>
      </div>
    )
  }
  return <MyReports me={me} />
}

function SignOut({ to = '/account' }: { to?: string }) {
  const nav = useNavigate()
  return (
    <button
      className="btn btn--ghost"
      onClick={async () => {
        await api.signOut()
        session.clear()
        nav(to)
      }}
    >
      <LogOut />Sign out
    </button>
  )
}

function AuthForms() {
  const [params, setParams] = useSearchParams()
  const portal = params.get('role') === 'authority' ? 'authority' : 'citizen'
  const mode = params.get('mode') === 'register' ? 'up' : 'in'

  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [title, setTitle] = useState('Ward Officer')
  const [authorityCode, setAuthorityCode] = useState('civic-demo')
  const [err, setErr] = useState<string | null>(null)
  const [fields, setFields] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState(false)
  const nav = useNavigate()

  const switchPortal = (p: 'citizen' | 'authority') => {
    setErr(null)
    setFields({})
    setParams({ role: p, mode: mode === 'up' ? 'register' : 'login' }, { replace: true })
  }

  const switchMode = (m: 'in' | 'up') => {
    setErr(null)
    setFields({})
    setParams({ role: portal, mode: m === 'up' ? 'register' : 'login' }, { replace: true })
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
    setBusy(true)
    setErr(null)
    setFields({})

    try {
      let s: Session
      if (portal === 'authority') {
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
      }
    } catch (e) {
      setErr((e as Error).message)
      if (e instanceof ApiError) setFields(e.fields)
    } finally {
      setBusy(false)
    }
  }

  const isCitizen = portal === 'citizen'

  return (
    <div className="wrap acct acct--auth">
      <div className="acct__intro">
        <div className="acct__portal-tabs" role="tablist" aria-label="Select portal">
          <button
            type="button"
            role="tab"
            aria-selected={isCitizen}
            className={`acct__portal-btn ${isCitizen ? 'is-active' : ''}`}
            onClick={() => switchPortal('citizen')}
          >
            <UserRound size={15} /> Citizen / Resident
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={!isCitizen}
            className={`acct__portal-btn ${!isCitizen ? 'is-active' : ''}`}
            onClick={() => switchPortal('authority')}
          >
            <ShieldCheck size={15} /> Ward Authority
          </button>
        </div>

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
            aria-selected={mode === 'in'}
            className={mode === 'in' ? 'is-on' : ''}
            onClick={() => switchMode('in')}
          >
            Sign in
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={mode === 'up'}
            className={mode === 'up' ? 'is-on' : ''}
            onClick={() => switchMode('up')}
          >
            Create account
          </button>
        </div>

        {mode === 'up' && (
          <div className="field">
            <label htmlFor="auth-name">Full name</label>
            <input
              id="auth-name"
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
          <label htmlFor="auth-email">{isCitizen ? 'Email address' : 'Official work email'}</label>
          <input
            id="auth-email"
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
              <label htmlFor="auth-title">Designation / Official Title</label>
              <input
                id="auth-title"
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
              <label htmlFor="auth-code">Authority Passcode</label>
              <input
                id="auth-code"
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
          <label htmlFor="auth-pass">Password</label>
          <input
            id="auth-pass"
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
                onClick={() => switchPortal('authority')}
              >
                Switch to Authority sign-in & register
              </button>
            </p>
          ) : (
            <p className="small muted">
              Resident citizen?{' '}
              <button
                type="button"
                className="link-id"
                style={{ background: 'none', border: 'none', padding: 0, font: 'inherit', cursor: 'pointer' }}
                onClick={() => switchPortal('citizen')}
              >
                Switch to Citizen portal
              </button>
            </p>
          )}
        </div>
      </form>
    </div>
  )
}

function MyReports({ me }: { me: Session }) {
  const q = useLiveQuery(() => api.myReports(), [me.token])
  const rows = q.data ?? []
  const open = rows.filter((r) => OPEN.includes(r.status as Status)).length
  const resolved = rows.filter((r) => r.status === 'resolved').length

  return (
    <div className="wrap acct">
      <header className="acct__head">
        <div>
          <span className="eyebrow"><UserRound size={13} /> Citizen dashboard</span>
          <h1 className="serif display-2">Hello, {me.user.name.split(' ')[0]}</h1>
          <p className="muted">{me.user.email} · reports you file while signed in appear here and update live.</p>
        </div>
        <div className="acct__row">
          <Link to="/report" className="btn btn--signal"><Plus />Report an issue</Link>
          <SignOut />
        </div>
      </header>

      <section className="acct__stats">
        <StatTile icon={ClipboardList} label="My reports" value={q.data ? rows.length : '—'} />
        <StatTile icon={Inbox} label="Open" value={q.data ? open : '—'} tone="amber" />
        <StatTile icon={CircleCheck} label="Resolved" value={q.data ? resolved : '—'} tone="ok" />
      </section>

      <Card title="My complaints" sub="Newest first" pad={false}>
        {q.error ? <div style={{ padding: 16 }}><ErrorState error={q.error} onRetry={q.reload} /></div>
          : !q.data ? <div style={{ padding: 16 }}><Skeleton h={120} /></div>
          : rows.length === 0 ? (
            <div className="acct__empty">
              <p className="serif">No reports yet.</p>
              <p className="muted small">Report a pothole, flooding, a broken streetlight or anything else — you'll get a tracking ID and live updates here.</p>
              <Link to="/report" className="btn btn--signal btn--sm"><Plus />Report an issue</Link>
            </div>
          ) : (
            <ul className="acct__list">
              {rows.map((r) => {
                const last = r.timeline[r.timeline.length - 1]
                return (
                  <li key={r.id}>
                    <Link to={`/track/${r.id}`} className="acct__item">
                      <span className="acct__top"><span className="id">{r.id}</span><StatusPill status={r.status as Status} /><PriorityBadge level={r.priority_level as Level} score={r.priority_score} /></span>
                      <b>{r.headline}</b>
                      <span className="muted small">{r.category_label} · {r.location_text}</span>
                      <span className="small">{r.department_label ? <>Assigned to <b>{r.department_label}</b>{r.officer ? ` · ${r.officer}` : ''}</> : <span className="muted">Not yet assigned</span>}</span>
                      {last && <span className="acct__last small"><span className="mono muted">{timeAgo(last.created_at)}</span> {last.message}</span>}
                    </Link>
                  </li>
                )
              })}
            </ul>
          )}
      </Card>
    </div>
  )
}
