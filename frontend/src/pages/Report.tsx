import { ArrowLeft, ArrowRight, Camera, Check, CircleAlert, CircleCheck, Copy, Crosshair, ImagePlus, Loader2, MapPin, MousePointerClick, Radar, Sparkles, X, Zap } from 'lucide-react'
import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { CityMap } from '../components/CityMap'
import { CategoryTag, PriorityBadge, ScoreBreakdown, StatusPill } from '../components/ui'
import { ApiError, api } from '../lib/api'
import { useSession } from '../lib/session'
import { CATEGORY_KEYS, CATEGORY_META, DEMO_EXAMPLE } from '../lib/constants'
import { distance, pct } from '../lib/format'
import { fmtAccuracy, GeoError, insecureMessage, locate, permissionState, refine, type GeoErrorKind } from '../lib/geolocation'
import type { CategoryKey, Preview, TrackView } from '../lib/types'

const MAX_MB = 5

/** Where the pin came from. Shown next to the coordinates and saved with the report. */
type PinSource = 'device' | 'map' | 'demo'
interface Pin { lat: number; lng: number; source: PinSource; accuracy?: number }
type GeoStatus =
  | { state: 'idle' }
  | { state: 'locating' }
  | { state: 'refining' }
  | { state: 'success'; accuracy: number }
  | { state: 'error'; kind: GeoErrorKind; message: string }

export function Report() {
  const [category, setCategory] = useState<CategoryKey | ''>('')
  const [description, setDescription] = useState('')
  const [location, setLocation] = useState('')
  const [pin, setPin] = useState<Pin | null>(null)
  const [fitKey, setFitKey] = useState(0) // bumps only when the device or demo sets the pin, so map taps don't re-centre
  const [image, setImage] = useState<File | null>(null)
  const [imageUrl, setImageUrl] = useState<string | null>(null)
  const me = useSession()
  const [name, setName] = useState(() => (me?.user.role === 'citizen' ? me.user.name : ''))
  const [contact, setContact] = useState('')
  const [affected, setAffected] = useState('')
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [geo, setGeo] = useState<GeoStatus>({ state: 'idle' })
  const [preview, setPreview] = useState<Preview | null>(null)
  const [result, setResult] = useState<TrackView | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const [step, setStep] = useState(0)
  const topRef = useRef<HTMLDivElement>(null)

  // Live classifier hint (debounced). Nothing is stored by this call.
  useEffect(() => {
    if (description.trim().length < 12) { setPreview(null); return }
    const t = setTimeout(() => { api.preview(description).then(setPreview).catch(() => setPreview(null)) }, 450)
    return () => clearTimeout(t)
  }, [description])

  useEffect(() => () => { if (imageUrl) URL.revokeObjectURL(imageUrl) }, [imageUrl])

  const pickImage = (f: File | undefined) => {
    setErrors((e) => ({ ...e, image: '' }))
    if (!f) return
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(f.type)) {
      setErrors((e) => ({ ...e, image: 'Use a JPEG, PNG or WebP photo.' })); return
    }
    if (f.size > MAX_MB * 1024 * 1024) {
      setErrors((e) => ({ ...e, image: `Photo is ${(f.size / 1048576).toFixed(1)} MB — the limit is ${MAX_MB} MB.` })); return
    }
    if (imageUrl) URL.revokeObjectURL(imageUrl)
    setImage(f)
    setImageUrl(URL.createObjectURL(f))
  }

  const useMyLocation = async () => {
    if (geo.state === 'locating' || geo.state === 'refining') return
    if (!window.isSecureContext) { setGeo({ state: 'error', kind: 'insecure', message: insecureMessage() }); return }
    // Permission is requested only here, on the user's click. If it was blocked earlier, say so without prompting.
    if ((await permissionState()) === 'denied') {
      setGeo({ state: 'error', kind: 'denied', message: 'Location permission is blocked for this site. Allow it from the site settings (the icon left of the address) and press “Use my location” again, or tap the map.' })
      return
    }
    setGeo({ state: 'locating' })
    try {
      const fix = await locate()
      setPin({ lat: fix.lat, lng: fix.lng, source: 'device', accuracy: fix.accuracy })
      setFitKey((k) => k + 1)
      setErrors((e) => ({ ...e, location: '' }))
      if (fix.accuracy > 50) {
        setGeo({ state: 'refining' })
        const better = await refine(fix)
        const best = better ?? fix
        if (better) { setPin({ lat: better.lat, lng: better.lng, source: 'device', accuracy: better.accuracy }); setFitKey((k) => k + 1) }
        setGeo({ state: 'success', accuracy: best.accuracy })
      } else {
        setGeo({ state: 'success', accuracy: fix.accuracy })
      }
    } catch (e) {
      const err = e instanceof GeoError ? e : new GeoError('unavailable', 'Could not get a position from the browser.')
      setGeo({ state: 'error', kind: err.kind, message: err.message })
    }
  }

  const fillDemo = () => {
    setCategory('waterlogging')
    setDescription(DEMO_EXAMPLE.description)
    setLocation(DEMO_EXAMPLE.location)
    setPin({ lat: DEMO_EXAMPLE.lat, lng: DEMO_EXAMPLE.lng, source: 'demo' })
    setFitKey((k) => k + 1)
    setGeo({ state: 'idle' })
  }

  const validate = () => {
    const e: Record<string, string> = {}
    if (description.trim().length < 15) e.description = 'Describe the problem in at least 15 characters.'
    if (location.trim().length < 3) e.location_text = 'Add a landmark, street or area name.'
    if (contact && !/^[0-9+\-\s()]{7,20}$|^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(contact.trim())) e.reporter_contact = 'Enter a valid phone number or email, or leave it blank.'
    if (affected && !(+affected >= 1)) e.affected_people = 'Enter a number, or leave it blank.'
    return e
  }

  /* Per-step checks, so problems surface on the step that has them. */
  const stepErrors = (i: number): Record<string, string> => {
    const all = validate()
    const keys = [['description'], ['location_text'], [], ['reporter_contact', 'affected_people']][i] ?? []
    return Object.fromEntries(Object.entries(all).filter(([k]) => keys.includes(k)))
  }
  const goStep = (i: number) => {
    setStep(i)
    setFormError(null)
    requestAnimationFrame(() => topRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }))
  }
  const next = () => {
    const e = stepErrors(step)
    setErrors((prev) => ({ ...prev, ...Object.fromEntries(Object.keys(validate()).map((k) => [k, ''])), ...e }))
    if (Object.keys(e).length) { setFormError('Please fix the highlighted fields.'); return }
    goStep(Math.min(3, step + 1))
  }
  const STEP_FOR: Record<string, number> = { description: 0, category: 0, location_text: 1, location: 1, image: 2, reporter_contact: 3, affected_people: 3, reporter_name: 3 }

  const submit = async (ev: FormEvent) => {
    ev.preventDefault()
    // Enter inside an earlier step's field moves forward instead of submitting before review.
    if (step < 3) { next(); return }
    setFormError(null)
    const e = validate()
    setErrors(e)
    if (Object.keys(e).length) { setFormError('Please fix the highlighted fields.'); goStep(Math.min(...Object.keys(e).map((k) => STEP_FOR[k] ?? 0))); return }
    const fd = new FormData()
    fd.set('description', description.trim())
    fd.set('location_text', location.trim())
    if (category) fd.set('category', category)
    if (pin) {
      fd.set('lat', String(pin.lat)); fd.set('lng', String(pin.lng)); fd.set('location_source', pin.source)
      if (pin.source === 'device' && pin.accuracy) fd.set('location_accuracy_m', String(pin.accuracy))
    }
    if (name.trim()) fd.set('reporter_name', name.trim())
    if (contact.trim()) fd.set('reporter_contact', contact.trim())
    if (affected) fd.set('affected_people', String(parseInt(affected, 10)))
    if (image) fd.set('image', image)
    setSubmitting(true)
    try {
      const r = await api.submit(fd)
      setResult(r)
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } catch (err) {
      if (err instanceof ApiError) {
        setErrors(err.fields); setFormError(err.message)
        const steps = Object.keys(err.fields).map((k) => STEP_FOR[k]).filter((x) => x != null)
        if (steps.length) goStep(Math.min(...steps))
      } else setFormError('Something went wrong. Please try again.')
    } finally { setSubmitting(false) }
  }

  if (result) return <Submitted r={result} onAnother={() => {
    setResult(null); setStep(0); setDescription(''); setLocation(''); setPin(null); setGeo({ state: 'idle' }); setImage(null); setImageUrl(null); setCategory(''); setAffected('')
  }} />

  const STEPS = ['Report details', 'Location & map', 'Add evidence', 'Review & submit']
  const done = [description.trim().length >= 15, !!location.trim() && !!pin, !!image, false]
  return (
    <div className="wizard wrap" ref={topRef}>
      <nav className="wizard__rail" aria-label="Report steps">
        <ol>
          {STEPS.map((label, i) => (
            <li key={label}>
              <button type="button" className={`wstep ${i === step ? 'is-on' : ''} ${done[i] && i !== step ? 'is-done' : ''}`} aria-current={i === step ? 'step' : undefined} onClick={() => goStep(i)}>
                <span className="wstep__n">{done[i] && i !== step ? <Check size={14} /> : i + 1}</span>{label}
              </button>
            </li>
          ))}
        </ol>
        <button type="button" className="btn btn--ghost btn--sm wizard__demo" onClick={fillDemo}><Sparkles />Fill with demo example</button>
        <p className="small muted wizard__who">{me?.user.role === 'citizen'
          ? <>Reporting as <b>{me.user.name}</b> — this report will appear in <Link to="/account" className="link-id">My reports</Link>.</>
          : <>Reporting anonymously. <Link to="/account" className="link-id">Sign in</Link> to keep your reports in one place.</>}</p>
      </nav>
      <form className="wizard__main" onSubmit={submit} noValidate>
        <header className="wizard__head">
          <h1 className="serif">Report an issue</h1>
          <p>Help us build a cleaner, safer and better city. No account needed.</p>
        </header>
        <div className="report__form">
          {/* 1 */}
          <section className="step" role="group" aria-labelledby="step-1" hidden={step !== 0}>
            <h2 className="step__title" id="step-1">Issue category <span className="muted">(optional)</span></h2>
            <div className="cat-tiles" role="radiogroup" aria-label="Category (optional)">
              {CATEGORY_KEYS.map((k) => {
                const Icon = CATEGORY_META[k].icon
                return (
                  <button type="button" key={k} role="radio" aria-checked={category === k}
                    className={`cat-tile ${category === k ? 'is-on' : ''}`} onClick={() => setCategory(category === k ? '' : k)}>
                    <Icon aria-hidden /><span>{CATEGORY_META[k].label}</span>
                  </button>
                )
              })}
            </div>
            <p className="hint">Optional — if you skip it, CivicPulse will work it out from your description.</p>
            <div className="field">
              <label htmlFor="desc">Describe it</label>
              <textarea id="desc" className="textarea" value={description} maxLength={2000}
                aria-invalid={!!errors.description} aria-describedby="desc-hint"
                placeholder="e.g. Knee-deep water at the bus stand since morning, children can’t reach the school bus…"
                onChange={(e) => setDescription(e.target.value)} />
              <div className="field__row">
                {errors.description ? <span className="error">{errors.description}</span> : <span id="desc-hint" className="hint">Mention any danger, who is affected and how long it has been like this.</span>}
                <span className="hint mono">{description.length}/2000</span>
              </div>
            </div>
            {preview?.ready && (
              <div className="ai-hint" aria-live="polite">
                <Sparkles aria-hidden />
                <div>
                  Reads as <strong>{preview.label}</strong> <span className="mono">({pct(preview.confidence ?? 0)})</span>
                  {preview.evidence?.length ? <span className="muted"> — from “{preview.evidence.slice(0, 3).join('”, “')}”</span> : null}
                  {preview.hazards?.length ? <div className="ai-hint__warn"><CircleAlert size={14} /> Safety concern detected: {preview.hazards.join(', ')}</div> : null}
                  {category && preview.category && preview.category !== category && preview.category !== 'other' && (preview.confidence ?? 0) >= .6 &&
                    <div className="muted small">Your choice ({CATEGORY_META[category].short}) is kept; an officer will double-check.</div>}
                </div>
              </div>
            )}
          </section>

          {/* 2 */}
          <section className="step" role="group" aria-labelledby="step-2" hidden={step !== 1}>
            <h2 className="step__title" id="step-2">Where is it?</h2>
            <div className="field">
              <label htmlFor="loc">Landmark, street or area</label>
              <input id="loc" className="input" value={location} maxLength={200} aria-invalid={!!errors.location_text}
                placeholder="e.g. Central Bus Stand, Platform Road" onChange={(e) => setLocation(e.target.value)} />
              {errors.location_text && <span className="error">{errors.location_text}</span>}
            </div>
            <div className="picker">
              <div className="picker__bar">
                <span className="small picker__coords" aria-live="polite">
                  <MapPin size={15} />
                  {pin ? <>
                    <span className="mono">{pin.lat.toFixed(5)}, {pin.lng.toFixed(5)}</span>
                    <span className={`pin-src pin-src--${pin.source}`}>
                      {pin.source === 'device' ? <>Your device{pin.accuracy ? ` · ${fmtAccuracy(pin.accuracy)}` : ''}</> : pin.source === 'map' ? 'Placed on map' : 'Demo example'}
                    </span>
                  </> : 'No location yet: use your location or tap the map'}
                </span>
                <span className="picker__btns">
                  {pin && <button type="button" className="btn btn--quiet btn--sm" onClick={() => { setPin(null); setGeo({ state: 'idle' }) }}><X />Clear</button>}
                  <button type="button" className="btn btn--ghost btn--sm" onClick={useMyLocation} disabled={geo.state === 'locating'} aria-busy={geo.state === 'locating'}>
                    {geo.state === 'locating' ? <Loader2 className="spin" /> : <Crosshair />}{geo.state === 'locating' ? 'Locating…' : 'Use my location'}
                  </button>
                </span>
              </div>
              <div className="picker__map">
                <CityMap height="100%" pick={pin} pickAccuracy={pin?.source === 'device' ? pin.accuracy : undefined}
                  onPick={(lat, lng) => { setPin({ lat: +lat.toFixed(6), lng: +lng.toFixed(6), source: 'map' }); setGeo({ state: 'idle' }); setErrors((e) => ({ ...e, location: '' })) }}
                  scrollZoom={false} fitKey={`fit-${fitKey}`} />
              </div>
              <div className="geo-status" role="status" aria-live="polite">
                {geo.state === 'locating' && <p className="geo geo--busy"><Loader2 className="spin" size={15} />Asking your browser for your position. If a permission prompt appears, choose Allow.</p>}
                {geo.state === 'refining' && <p className="geo geo--ok"><CircleCheck size={15} />Location found. Improving accuracy…</p>}
                {geo.state === 'success' && pin?.source === 'device' && <p className="geo geo--ok"><CircleCheck size={15} />Location detected by your device, accurate to about {fmtAccuracy(geo.accuracy)}. Drag the map or tap to adjust.</p>}
                {geo.state === 'error' && <p className="geo geo--err"><CircleAlert size={15} />{geo.message}{pin ? ' The pin shown was placed earlier and has not changed.' : ''}</p>}
                {geo.state === 'idle' && !pin && <p className="hint"><MousePointerClick size={14} /> You can also tap the map to place the pin yourself.</p>}
              </div>
              {errors.location && <span className="error">{errors.location}</span>}
            </div>
          </section>

          {/* 3 */}
          <section className="step" role="group" aria-labelledby="step-3" hidden={step !== 2}>
            <h2 className="step__title" id="step-3">Add evidence <span className="muted">(optional)</span></h2>
            <input ref={fileRef} id="photo" type="file" accept="image/jpeg,image/png,image/webp" capture="environment" hidden
              onChange={(e) => pickImage(e.target.files?.[0])} />
            {imageUrl ? (
              <div className="photo">
                <img src={imageUrl} alt="Preview of the photo you selected" />
                <div className="photo__meta">
                  <span className="small">{image?.name} · {((image?.size ?? 0) / 1024).toFixed(0)} KB</span>
                  <span>
                    <button type="button" className="btn btn--ghost btn--sm" onClick={() => fileRef.current?.click()}><Camera />Replace</button>
                    <button type="button" className="btn btn--quiet btn--sm" onClick={() => { setImage(null); setImageUrl(null); if (fileRef.current) fileRef.current.value = '' }}><X />Remove</button>
                  </span>
                </div>
              </div>
            ) : (
              <button type="button" className="dropzone" onClick={() => fileRef.current?.click()}
                onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); pickImage(e.dataTransfer.files?.[0]) }}>
                <ImagePlus aria-hidden />
                <span><strong>Take or choose a photo</strong><br /><span className="muted small">JPEG, PNG or WebP · up to {MAX_MB} MB · drag & drop works too</span></span>
              </button>
            )}
            {errors.image && <span className="error">{errors.image}</span>}
          </section>

          {/* 4 */}
          <section className="step" role="group" aria-labelledby="step-4" hidden={step !== 3}>
            <h2 className="step__title" id="step-4">Review &amp; submit</h2>
            <dl className="review">
              <div><dt>Category</dt><dd>{category ? CATEGORY_META[category].label : preview?.ready ? <>Auto: {preview.label} <span className="muted">({pct(preview.confidence ?? 0)})</span></> : 'Detected from your description'}</dd><button type="button" className="review__edit" onClick={() => goStep(0)}>Edit</button></div>
              <div><dt>Description</dt><dd>{description.trim() || <span className="muted">Not written yet</span>}</dd><button type="button" className="review__edit" onClick={() => goStep(0)}>Edit</button></div>
              <div><dt>Location</dt><dd>{location.trim() || <span className="muted">No landmark</span>}{pin && <span className="mono muted"> · {pin.lat.toFixed(5)}, {pin.lng.toFixed(5)} ({pin.source === 'device' ? 'your device' : pin.source === 'map' ? 'map pin' : 'demo'})</span>}</dd><button type="button" className="review__edit" onClick={() => goStep(1)}>Edit</button></div>
              <div><dt>Photo</dt><dd>{image ? image.name : <span className="muted">None</span>}</dd><button type="button" className="review__edit" onClick={() => goStep(2)}>Edit</button></div>
            </dl>
            <h3 className="review__sub">A little more <span className="muted">(optional)</span></h3>
            <div className="field-grid">
              <div className="field">
                <label htmlFor="aff">People affected (estimate)</label>
                <input id="aff" className="input" inputMode="numeric" value={affected} onChange={(e) => setAffected(e.target.value.replace(/\D/g, '').slice(0, 7))} placeholder="e.g. 200" />
                {errors.affected_people && <span className="error">{errors.affected_people}</span>}
              </div>
              <div className="field">
                <label htmlFor="name">Your name</label>
                <input id="name" className="input" value={name} maxLength={80} onChange={(e) => setName(e.target.value)} autoComplete="name" />
              </div>
              <div className="field">
                <label htmlFor="contact">Phone or email</label>
                <input id="contact" className="input" value={contact} maxLength={80} aria-invalid={!!errors.reporter_contact} onChange={(e) => setContact(e.target.value)} autoComplete="tel" />
                {errors.reporter_contact && <span className="error">{errors.reporter_contact}</span>}
              </div>
            </div>
            <p className="hint">Only the ward office sees your name and contact. They are never shown on public pages.</p>
          </section>

          {formError && <div className="notice notice--danger" role="alert"><CircleAlert />{formError}</div>}
          <div className="wizard__nav">
            {step > 0 ? <button type="button" className="btn btn--ghost" onClick={() => goStep(step - 1)}><ArrowLeft />Back</button> : <span />}
            {step < 3
              ? <button key="next" type="button" className="btn btn--signal wizard__next" onClick={next}>Next: {STEPS[step + 1]} <ArrowRight /></button>
              : <button key="submit" type="submit" className="btn btn--signal wizard__next" disabled={submitting}>
                  {submitting ? <><Loader2 className="spin" />Analysing your report…</> : <>Submit report <ArrowRight /></>}
                </button>}
          </div>
        </div>
      </form>
      <aside className="wizard__aside">
        <img src="/img/street-night.jpg" alt="" loading="lazy" />
        <h2 className="serif">Your report makes a difference</h2>
        <ul>
          <li><Zap aria-hidden />Quick response: routed to the right department</li>
          <li><Sparkles aria-hidden />AI-powered analysis the moment you submit</li>
          <li><Radar aria-hidden />Track progress live with your report ID</li>
        </ul>
        <p className="muted small">Same problem as a neighbour? Still report it. Similar reports are linked, which raises the priority.</p>
      </aside>
    </div>
  )
}

function Submitted({ r, onAnother }: { r: TrackView; onAnother: () => void }) {
  const [copied, setCopied] = useState(false)
  const a = r.analysis
  const dup = a.duplicates
  return (
    <div className="submitted wrap">
      <header className="submitted__head">
        <span className="eyebrow"><Check size={14} /> Report received</span>
        <h1 className="serif display-1">Your tracking ID</h1>
        <div className="submitted__id">
          <span className="mono">{r.id}</span>
          <button className="btn btn--ghost btn--sm" onClick={() => { navigator.clipboard?.writeText(r.id).then(() => setCopied(true)).catch(() => {}) }}>
            {copied ? <><Check />Copied</> : <><Copy />Copy</>}
          </button>
        </div>
        <p className="muted">Save this ID. Use it any time to follow progress. <StatusPill status={r.status} /></p>
        <div className="hero__ctas">
          <Link to={`/track/${r.id}`} className="btn btn--civic">Track this report <ArrowRight /></Link>
          <button className="btn btn--ghost" onClick={onAnother}>Report another issue</button>
          <MyReportsLink />
        </div>
      </header>

      <section className="analysis">
        <div className="analysis__intro">
          <span className="eyebrow">Understand · what CivicPulse found</span>
          <h2 className="serif display-3">Analysed in the moment you pressed submit.</h2>
        </div>
        <div className="analysis__grid">
          <article className="panel">
            <div className="panel__head"><h3>Category</h3><span className="panel__note">Text classifier</span></div>
            <div className="panel__body stack">
              <CategoryTag category={r.category} label={r.category_label} />
              <p className="small">{a.classification.resolution?.message}</p>
              <p className="muted small">{a.classification.explanation}</p>
            </div>
          </article>
          <article className="panel">
            <div className="panel__head"><h3>Summary</h3><span className="panel__note">Extractive — uses only your words</span></div>
            <div className="panel__body stack">
              <p className="summary-text">{a.summary?.text ?? r.summary}</p>
              {!!a.summary?.safety_concerns.length && <p className="small"><strong>Safety:</strong> {a.summary.safety_concerns.join(', ')}</p>}
            </div>
          </article>
          <article className="panel">
            <div className="panel__head"><h3>Similar reports nearby</h3><span className="panel__note">Text · category · distance · time</span></div>
            <div className="panel__body stack">
              {dup.matches && dup.matches.length ? (
                <>
                  <p className="small">{dup.likelihood === 'likely'
                    ? <><strong>Likely the same problem</strong> as {dup.matches.filter((m) => m.likelihood === 'likely').length} earlier report(s). Your report is kept and linked — it strengthens the case.</>
                    : <>Possibly related to {dup.matches.length} earlier report(s).</>}</p>
                  <ul className="matches">
                    {dup.matches.slice(0, 3).map((m) => (
                      <li key={m.id}>
                        <Link to={`/track/${m.id}`} className="id">{m.id}</Link>
                        <span className="mono small">{pct(m.score)} match · {distance(m.distance_m)}</span>
                        <span className="muted small">{m.reasons.join(' · ')}</span>
                      </li>
                    ))}
                  </ul>
                </>
              ) : <p className="small">No similar reports found nearby — this looks like a new problem.</p>}
            </div>
          </article>
          <article className="panel panel--wide">
            <div className="panel__head"><h3>Priority</h3><span className="panel__note">Six weighted factors · 0–100</span></div>
            <div className="panel__body">
              <div className="priority-top">
                <div className="score-dial"><b>{a.priority.score}</b><span>/100</span></div>
                <div><PriorityBadge level={a.priority.level} /><p className="small" style={{ marginTop: 8 }}>{a.priority.reasoning}</p></div>
              </div>
              <ScoreBreakdown factors={a.priority.factors} />
            </div>
          </article>
          <article className="panel">
            <div className="panel__head"><h3>Recommended action</h3><span className="panel__note">Rule-based suggestion</span></div>
            <div className="panel__body stack">
              <p><strong>{a.recommendation.primary?.action}</strong></p>
              <p className="muted small">{a.recommendation.primary?.why}</p>
              <p className="small">Suggested department: <strong>{a.recommendation.department_label}</strong><br />Suggested response: <strong>{a.recommendation.response_target}</strong></p>
              <p className="muted small">{a.recommendation.note}</p>
            </div>
          </article>
        </div>
      </section>
    </div>
  )
}

/** After submitting: signed-in citizens can jump to their dashboard; others are invited to sign in next time. */
function MyReportsLink() {
  const me = useSession()
  if (me?.user.role === 'citizen') return <Link to="/account" className="btn btn--ghost">My reports</Link>
  return null
}
