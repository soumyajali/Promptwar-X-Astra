import { AlertTriangle, ArrowLeft, Check, Copy, ExternalLink, Loader2, Mail, MapPin, Phone, User } from 'lucide-react'
import { useEffect, useState, type FormEvent, type ReactNode } from 'react'
import { Link, useParams } from 'react-router-dom'
import { CityMap } from '../../components/CityMap'
import { Panel } from '../../components/command'
import { CategoryTag, ErrorState, PriorityBadge, ScoreBreakdown, Skeleton, StatusPill, Timeline, Toast, useToast } from '../../components/ui'
import { api } from '../../lib/api'
import { CATEGORY_KEYS, CATEGORY_META } from '../../lib/constants'
import { distance, fmtDate, LEVEL_ORDER, pct, STATUS_LABEL } from '../../lib/format'
import type { DeptKey, Meta, ReportDetail as RD, Status } from '../../lib/types'
import { useLiveQuery } from '../../store/live'

const NEXT: Record<Status, Status[]> = {
  submitted: ['under_review', 'in_progress', 'resolved', 'rejected'],
  under_review: ['in_progress', 'resolved', 'rejected'],
  assigned: ['in_progress', 'resolved', 'rejected', 'under_review'],
  in_progress: ['resolved', 'assigned', 'rejected'],
  resolved: ['under_review'],
  rejected: ['under_review'],
}

export function ReportDetail() {
  const { id = '' } = useParams()
  const q = useLiveQuery(() => api.report(id), [id])
  const meta = useLiveQuery(() => api.meta(), [], { live: false })
  const toast = useToast()

  if (q.error) return <div className="cpage"><BackLink /><ErrorState error={q.error} onRetry={q.reload} /></div>
  if (!q.data || !meta.data || q.data.id !== id) return <div className="cpage"><BackLink /><Skeleton h={120} /><Skeleton h={480} style={{ marginTop: 16 }} /></div>
  const r = q.data
  const a = r.analysis
  const apply = (next: RD, msg: string) => { q.setData(next); toast.show(msg) }

  return (
    <div className="cpage detail">
      <BackLink />
      <header className="detail__head">
        <div className="detail__ids">
          <span className="id">{r.id}</span>
          <Link to={`/track/${r.id}`} target="_blank" className="small link-id">Citizen view <ExternalLink size={12} /></Link>
        </div>
        <h1 className="serif detail__title">{r.headline}</h1>
        <div className="detail__tags">
          <CategoryTag category={r.category} label={r.category_label} />
          <PriorityBadge level={r.priority_level} score={r.priority_score} />
          <StatusPill status={r.status} />
          {r.department_label && <span className="badge badge--outline">{r.department_label}{r.officer ? ` · ${r.officer}` : ''}</span>}
          {r.needs_review && <span className="badge badge--high"><AlertTriangle size={12} />Category needs review</span>}
        </div>
      </header>

      <div className="detail__grid">
        {/* ---------- left: the report & AI analysis ---------- */}
        <div className="stack-lg">
          <Panel title="Citizen report" note={`Received ${fmtDate(r.created_at)} · via ${r.channel}`}>
            <div className="detail__report">
              <div className="stack">
                <p>{r.description}</p>
                <p className="small"><MapPin size={14} /> {r.location_text}{r.ward ? ` · ${r.ward}` : ''}{r.lat != null && <span className="mono muted"> · {r.lat.toFixed(5)}, {r.lng!.toFixed(5)}</span>}</p>
                {r.affected_people && <p className="small">Affected people (stated): <strong>{r.affected_people}</strong></p>}
                <div className="reporter small">
                  <span><User size={14} />{r.reporter_name ?? 'Anonymous'}</span>
                  {r.reporter_contact && <span>{r.reporter_contact.includes('@') ? <Mail size={14} /> : <Phone size={14} />}{r.reporter_contact}</span>}
                  <span className="muted">Visible to ward staff only</span>
                </div>
              </div>
              {r.image_url && <a href={r.image_url} target="_blank" rel="noreferrer"><img src={r.image_url} alt="Citizen photo of the issue" className="detail__img" /></a>}
            </div>
          </Panel>

          <section className="ai">
            <div className="ai__head">
              <span className="eyebrow">Understand · CivicPulse analysis</span>
              <span className="muted small">Deterministic, documented algorithms · v{(a as unknown as { pipeline_version?: string }).pipeline_version ?? '1.0'}</span>
            </div>

            <Panel title="Summary" note="Extractive · built only from the citizen’s text">
              <p className="summary-text">{a.summary.text}</p>
              <div className="signals">
                {a.signals.hazards.map((h) => <span key={h} className="badge badge--critical">{h}</span>)}
                {a.signals.affected.map((h) => <span key={h} className="badge badge--outline">{h}</span>)}
                {a.signals.duration && <span className="badge badge--outline">{a.signals.duration}</span>}
              </div>
            </Panel>

            <Panel title="Classification" note="Weighted lexicon classifier">
              <div className="stack">
                <p className="small">{a.classification.resolution.message}</p>
                <div className="cls-bars">
                  {Object.entries(a.classification.scores).sort((x, y) => y[1] - x[1]).slice(0, 4).map(([k, v]) => (
                    <div key={k} className="cls-bar">
                      <span className="small">{CATEGORY_META[k as keyof typeof CATEGORY_META]?.label}</span>
                      <span className="factor__bar"><span style={{ width: pct(v), background: k === a.classification.category ? 'var(--civic)' : 'var(--rule-strong)' }} /></span>
                      <span className="mono small">{pct(v)}</span>
                    </div>
                  ))}
                </div>
                <p className="muted small">{a.classification.explanation}</p>
                {a.classification.alternative_label && <p className="small">Alternative: <strong>{a.classification.alternative_label}</strong> ({pct(a.classification.alternative_confidence ?? 0)})</p>}
                <CorrectCategory r={r} onDone={apply} />
              </div>
            </Panel>

            <Panel title="Priority" note={r.priority_overridden ? `Officer override: ${r.priority_override_reason}` : 'Six weighted factors · weights sum to 100'}>
              <div className="priority-top">
                <div className="score-dial"><b>{r.priority_score}</b><span>/100</span></div>
                <div><PriorityBadge level={r.priority_level} /><p className="small" style={{ marginTop: 6 }}>{a.priority.reasoning}</p></div>
              </div>
              <ScoreBreakdown factors={a.priority.factors} />
              <OverridePriority r={r} onDone={apply} />
            </Panel>

            <Panel title="Duplicates & related reports" note="0.40 text + 0.20 category + 0.30 distance + 0.10 time">
              {r.links.length ? (
                <>
                  <ul className="links">
                    {r.links.map((l) => (
                      <li key={l.id}>
                        <div className="links__top">
                          <Link to={`/command/reports/${l.id}`} className="id link-id">{l.id}</Link>
                          <span className={`badge ${l.likelihood === 'likely' ? 'badge--critical' : 'badge--outline'}`}>{l.likelihood === 'likely' ? 'Likely duplicate' : 'Possibly related'} · {pct(l.score)}</span>
                          <StatusPill status={l.status} />
                        </div>
                        <p className="small">{l.category_label} · {l.location_text} · {distance(l.distance_m)}</p>
                        <p className="muted small">{l.reasons.join(' · ')}</p>
                      </li>
                    ))}
                  </ul>
                  {r.lat != null && (
                    <div className="links__map">
                      <CityMap height={220} scrollZoom={false} fitKey={r.id}
                        points={[{ id: r.id, lat: r.lat, lng: r.lng, level: r.priority_level, status: r.status, title: 'This report' },
                          ...r.links.map((l) => ({ id: l.id, lat: l.lat, lng: l.lng, level: l.priority_level, status: l.status, title: l.location_text }))]}
                        newId={r.id} />
                    </div>
                  )}
                </>
              ) : <p className="small muted">No similar reports within 500 m and 14 days. Reports are linked, never merged or deleted.</p>}
            </Panel>

            <Panel title="Recommended actions" note={a.recommendation.note}>
              <ol className="recs">
                {a.recommendation.actions.map((x, i) => <li key={i}><strong>{x.action}</strong><span className="muted small">{x.why}</span></li>)}
              </ol>
              <p className="small">Suggested department <strong>{a.recommendation.department_label}</strong> · response <strong>{a.recommendation.response_target}</strong></p>
            </Panel>
          </section>
        </div>

        {/* ---------- right: actions + timeline ---------- */}
        <div className="stack-lg detail__side">
          <Panel title="Assign" className="act">
            <AssignForm r={r} meta={meta.data} onDone={apply} />
          </Panel>
          <Panel title="Update status" className="act">
            <StatusForm r={r} onDone={apply} />
          </Panel>
          <Panel title="Add a note or public update" className="act">
            <NoteForm r={r} onDone={apply} />
          </Panel>
          <Panel title="Timeline" note="Public and internal entries">
            <Timeline items={r.timeline} />
          </Panel>
        </div>
      </div>
      <Toast message={toast.msg} onDone={toast.clear} />
    </div>
  )
}

const BackLink = () => <Link to="/command/reports" className="back small"><ArrowLeft size={15} />All reports</Link>

function useAction() {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const run = async (fn: () => Promise<void>) => {
    setBusy(true); setError(null)
    try { await fn() } catch (e) { setError((e as Error).message) } finally { setBusy(false) }
  }
  return { busy, error, run }
}

const Err = ({ e }: { e: string | null }) => (e ? <p className="error" role="alert">{e}</p> : null)
const Submit = ({ busy, children, disabled }: { busy: boolean; children: ReactNode; disabled?: boolean }) => (
  <button className="btn btn--civic btn--sm" disabled={busy || disabled}>{busy ? <Loader2 className="spin" /> : <Check />}{children}</button>
)

function AssignForm({ r, meta, onDone }: { r: RD; meta: Meta; onDone: (r: RD, m: string) => void }) {
  const suggested = r.analysis.recommendation.department
  const [dept, setDept] = useState<DeptKey>(r.department ?? suggested)
  const [officer, setOfficer] = useState(r.officer ?? '')
  const { busy, error, run } = useAction()
  useEffect(() => { setDept(r.department ?? suggested); setOfficer(r.officer ?? '') }, [r.id, r.department, r.officer, suggested])
  const officers = meta.officers[dept] ?? []
  const submit = (e: FormEvent) => {
    e.preventDefault()
    run(async () => onDone(await api.assign(r.id, dept, officer || undefined), `Assigned to ${meta.departments[dept]}`))
  }
  return (
    <form onSubmit={submit} className="stack">
      <div className="field">
        <label htmlFor="dept">Department</label>
        <select id="dept" className="select" value={dept} onChange={(e) => { setDept(e.target.value as DeptKey); setOfficer('') }}>
          {Object.entries(meta.departments).map(([k, v]) => <option key={k} value={k}>{v}{k === suggested ? ' (suggested)' : ''}</option>)}
        </select>
      </div>
      <div className="field">
        <label htmlFor="off">Responsible officer</label>
        <select id="off" className="select" value={officer} onChange={(e) => setOfficer(e.target.value)}>
          <option value="">— Not yet —</option>
          {officers.map((o) => <option key={o} value={o}>{o}</option>)}
        </select>
      </div>
      <Err e={error} />
      <Submit busy={busy} disabled={dept === r.department && (officer || null) === r.officer}>Save assignment</Submit>
    </form>
  )
}

function StatusForm({ r, onDone }: { r: RD; onDone: (r: RD, m: string) => void }) {
  const opts = NEXT[r.status]
  const [status, setStatus] = useState<Status>(opts[0])
  const [msg, setMsg] = useState('')
  const [note, setNote] = useState('')
  const { busy, error, run } = useAction()
  useEffect(() => { setStatus(NEXT[r.status][0]); setMsg(''); setNote('') }, [r.status])
  const submit = (e: FormEvent) => {
    e.preventDefault()
    run(async () => onDone(await api.setStatus(r.id, { status, public_message: msg || undefined, resolution_note: note || undefined }), `Status set to ${STATUS_LABEL[status]}`))
  }
  return (
    <form onSubmit={submit} className="stack">
      <p className="small">Current: <StatusPill status={r.status} /></p>
      <div className="seg" role="radiogroup" aria-label="New status">
        {opts.map((s) => <button type="button" role="radio" aria-checked={status === s} key={s} className={status === s ? 'is-on' : ''} onClick={() => setStatus(s)}>{STATUS_LABEL[s]}</button>)}
      </div>
      {status === 'resolved' ? (
        <div className="field">
          <label htmlFor="rn">Resolution note <span className="muted">(required, shown to citizen)</span></label>
          <textarea id="rn" className="textarea" style={{ minHeight: 80 }} value={note} onChange={(e) => setNote(e.target.value)} placeholder="What was done to fix it?" />
        </div>
      ) : (
        <div className="field">
          <label htmlFor="pm">Message to citizen {status === 'rejected' ? <span className="muted">(required)</span> : <span className="muted">(optional)</span>}</label>
          <textarea id="pm" className="textarea" style={{ minHeight: 70 }} value={msg} onChange={(e) => setMsg(e.target.value)} placeholder={status === 'in_progress' ? 'e.g. Pump crew dispatched to the site.' : ''} />
        </div>
      )}
      <Err e={error} />
      <Submit busy={busy}>Update status</Submit>
    </form>
  )
}

function NoteForm({ r, onDone }: { r: RD; onDone: (r: RD, m: string) => void }) {
  const [msg, setMsg] = useState('')
  const [vis, setVis] = useState<'public' | 'internal'>('public')
  const { busy, error, run } = useAction()
  const submit = (e: FormEvent) => {
    e.preventDefault()
    run(async () => { onDone(await api.addUpdate(r.id, msg, vis), vis === 'public' ? 'Public update posted' : 'Internal note saved'); setMsg('') })
  }
  return (
    <form onSubmit={submit} className="stack">
      <div className="seg" role="radiogroup" aria-label="Visibility">
        <button type="button" role="radio" aria-checked={vis === 'public'} className={vis === 'public' ? 'is-on' : ''} onClick={() => setVis('public')}>Citizen-visible</button>
        <button type="button" role="radio" aria-checked={vis === 'internal'} className={vis === 'internal' ? 'is-on' : ''} onClick={() => setVis('internal')}>Internal only</button>
      </div>
      <textarea className="textarea" aria-label="Message" style={{ minHeight: 70 }} value={msg} maxLength={1000} onChange={(e) => setMsg(e.target.value)} placeholder={vis === 'public' ? 'Shown on the citizen’s tracking page' : 'Only ward staff can see this'} />
      <Err e={error} />
      <Submit busy={busy} disabled={msg.trim().length < 2}>{vis === 'public' ? 'Post update' : 'Save note'}</Submit>
    </form>
  )
}

function CorrectCategory({ r, onDone }: { r: RD; onDone: (r: RD, m: string) => void }) {
  const [open, setOpen] = useState(false)
  const [cat, setCat] = useState(r.category)
  const [reason, setReason] = useState('')
  const { busy, error, run } = useAction()
  if (!open) return <button className="btn btn--ghost btn--sm" onClick={() => setOpen(true)}><Copy />Correct category</button>
  return (
    <form className="inline-form" onSubmit={(e) => { e.preventDefault(); run(async () => { onDone(await api.correctCategory(r.id, cat, reason || undefined), 'Category corrected'); setOpen(false) }) }}>
      <select className="select" aria-label="Correct category" value={cat} onChange={(e) => setCat(e.target.value as typeof cat)}>
        {CATEGORY_KEYS.map((k) => <option key={k} value={k}>{CATEGORY_META[k].label}</option>)}
      </select>
      <input className="input" aria-label="Reason" placeholder="Reason (optional)" value={reason} onChange={(e) => setReason(e.target.value)} />
      <Err e={error} />
      <div className="inline-form__btns">
        <Submit busy={busy} disabled={cat === r.category}>Save</Submit>
        <button type="button" className="btn btn--quiet btn--sm" onClick={() => setOpen(false)}>Cancel</button>
      </div>
    </form>
  )
}

function OverridePriority({ r, onDone }: { r: RD; onDone: (r: RD, m: string) => void }) {
  const [open, setOpen] = useState(false)
  const [level, setLevel] = useState(r.priority_level)
  const [reason, setReason] = useState('')
  const { busy, error, run } = useAction()
  if (!open) return <button className="btn btn--ghost btn--sm" style={{ marginTop: 12 }} onClick={() => setOpen(true)}>Adjust priority</button>
  return (
    <form className="inline-form" style={{ marginTop: 12 }} onSubmit={(e) => { e.preventDefault(); run(async () => { onDone(await api.overridePriority(r.id, level, reason), 'Priority adjusted'); setOpen(false) }) }}>
      <select className="select" aria-label="Priority level" value={level} onChange={(e) => setLevel(e.target.value as typeof level)}>
        {LEVEL_ORDER.map((l) => <option key={l} value={l}>{l[0].toUpperCase() + l.slice(1)}</option>)}
      </select>
      <input className="input" aria-label="Reason" required minLength={3} placeholder="Reason (required, logged)" value={reason} onChange={(e) => setReason(e.target.value)} />
      <Err e={error} />
      <div className="inline-form__btns">
        <Submit busy={busy} disabled={reason.trim().length < 3}>Save</Submit>
        <button type="button" className="btn btn--quiet btn--sm" onClick={() => setOpen(false)}>Cancel</button>
      </div>
    </form>
  )
}
