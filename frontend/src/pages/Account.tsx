import { ArrowRight, CircleCheck, ClipboardList, Inbox, LogOut, Plus, UserRound } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Card, StatTile } from '../components/obs'
import { ErrorState, PriorityBadge, Skeleton, StatusPill } from '../components/ui'
import { api, ApiError } from '../lib/api'
import { OPEN, timeAgo } from '../lib/format'
import { session, useSession, type Session } from '../lib/session'
import type { Level, Status } from '../lib/types'
import { useLiveQuery } from '../store/live'

/** Citizen account: sign in / create account, then "My reports". Demo accounts — no identity verification. */
export function Account() {
  const me = useSession()
  if (!me) return <AuthForms />
  if (me.user.role === 'authority') {
    return (
      <div className="wrap acct">
        <Card title="Signed in as ward-office staff">
          <p className="muted">{me.user.name} · {me.user.title}. Authority accounts work in the Command Center.</p>
          <div className="acct__row"><Link to="/command" className="btn btn--signal">Open Command Center <ArrowRight /></Link><SignOut /></div>
        </Card>
      </div>
    )
  }
  return <MyReports me={me} />
}

function SignOut({ to = '/account' }: { to?: string }) {
  const nav = useNavigate()
  return <button className="btn btn--ghost" onClick={async () => { await api.signOut(); session.clear(); nav(to) }}><LogOut />Sign out</button>
}

function AuthForms() {
  const [mode, setMode] = useState<'in' | 'up'>('in')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [err, setErr] = useState<string | null>(null)
  const [fields, setFields] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState(false)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true); setErr(null); setFields({})
    try {
      const s: Session = mode === 'up' ? await api.register(name.trim(), email.trim(), password) : await api.signIn(email.trim(), password, 'citizen')
      session.set(s)
    } catch (e) {
      setErr((e as Error).message)
      if (e instanceof ApiError) setFields(e.fields)
    } finally { setBusy(false) }
  }

  return (
    <div className="wrap acct acct--auth">
      <div className="acct__intro">
        <span className="eyebrow">Citizen account</span>
        <h1 className="serif display-2">{mode === 'in' ? 'Sign in to track your reports' : 'Create your citizen account'}</h1>
        <p className="muted">An account keeps every complaint you file in one place, with live status from the ward office. You can still report anonymously without one.</p>
        <p className="small muted">Hackathon demo: accounts live in this app's database only. There is no identity verification or link to any government system.</p>
      </div>
      <form className="card acct__form" onSubmit={submit} noValidate>
        <div className="seg" role="tablist" aria-label="Account">
          <button type="button" role="tab" aria-selected={mode === 'in'} className={mode === 'in' ? 'is-on' : ''} onClick={() => { setMode('in'); setErr(null); setFields({}) }}>Sign in</button>
          <button type="button" role="tab" aria-selected={mode === 'up'} className={mode === 'up' ? 'is-on' : ''} onClick={() => { setMode('up'); setErr(null); setFields({}) }}>Create account</button>
        </div>
        {mode === 'up' && (
          <div className="field">
            <label htmlFor="c-name">Full name</label>
            <input id="c-name" className="input" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" maxLength={80} aria-invalid={!!fields.name} />
            {fields.name && <span className="error">{fields.name}</span>}
          </div>
        )}
        <div className="field">
          <label htmlFor="c-email">Email</label>
          <input id="c-email" className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" aria-invalid={!!fields.email} />
          {fields.email && <span className="error">{fields.email}</span>}
        </div>
        <div className="field">
          <label htmlFor="c-pass">Password</label>
          <input id="c-pass" className="input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete={mode === 'up' ? 'new-password' : 'current-password'} aria-invalid={!!fields.password} />
          {fields.password ? <span className="error">{fields.password}</span> : mode === 'up' && <span className="hint">At least 8 characters.</span>}
        </div>
        {err && !Object.keys(fields).length && <div className="notice notice--danger" role="alert">{err}</div>}
        <button className="btn btn--signal btn--block" disabled={busy || !email || !password || (mode === 'up' && !name)}>
          {busy ? 'Please wait…' : mode === 'in' ? <>Sign in <ArrowRight /></> : <>Create account <ArrowRight /></>}
        </button>
        <p className="small muted">Ward-office staff? <Link to="/command/login" className="link-id">Authority sign-in</Link></p>
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
