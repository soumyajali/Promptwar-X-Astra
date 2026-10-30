import { ArrowRight, Camera, Check, CircleAlert, Copy, Crosshair, ImagePlus, Loader2, MapPin, Sparkles, X } from 'lucide-react'
import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { CityMap } from '../components/CityMap'
import { CategoryTag, PageBanner, PriorityBadge, ScoreBreakdown, StatusPill } from '../components/ui'
import { ApiError, api } from '../lib/api'
import { CATEGORY_KEYS, CATEGORY_META, DEMO_EXAMPLE } from '../lib/constants'
import { distance, pct } from '../lib/format'
import type { CategoryKey, Preview, TrackView } from '../lib/types'

const MAX_MB = 5

export function Report() {
  const [category, setCategory] = useState<CategoryKey | ''>('')
  const [description, setDescription] = useState('')
  const [location, setLocation] = useState('')
  const [pin, setPin] = useState<{ lat: number; lng: number } | null>(null)
  const [image, setImage] = useState<File | null>(null)
  const [imageUrl, setImageUrl] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [contact, setContact] = useState('')
  const [affected, setAffected] = useState('')
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [geoState, setGeoState] = useState<string | null>(null)
  const [preview, setPreview] = useState<Preview | null>(null)
  const [result, setResult] = useState<TrackView | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

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

  const useMyLocation = () => {
    if (!('geolocation' in navigator)) { setGeoState('Location is not available in this browser. Tap the map instead.'); return }
    setGeoState('Finding you…')
    navigator.geolocation.getCurrentPosition(
      (p) => { setPin({ lat: +p.coords.latitude.toFixed(6), lng: +p.coords.longitude.toFixed(6) }); setGeoState(`Located within about ${Math.round(p.coords.accuracy)} m.`) },
      () => setGeoState('Could not get your location (permission denied or unavailable). Tap the map to place the pin.'),
      { enableHighAccuracy: true, timeout: 8000 },
    )
  }

  const fillDemo = () => {
    setCategory('waterlogging')
    setDescription(DEMO_EXAMPLE.description)
    setLocation(DEMO_EXAMPLE.location)
    setPin({ lat: DEMO_EXAMPLE.lat, lng: DEMO_EXAMPLE.lng })
  }

  const validate = () => {
    const e: Record<string, string> = {}
    if (description.trim().length < 15) e.description = 'Describe the problem in at least 15 characters.'
    if (location.trim().length < 3) e.location_text = 'Add a landmark, street or area name.'
    if (contact && !/^[0-9+\-\s()]{7,20}$|^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(contact.trim())) e.reporter_contact = 'Enter a valid phone number or email, or leave it blank.'
    if (affected && !(+affected >= 1)) e.affected_people = 'Enter a number, or leave it blank.'
    return e
  }

  const submit = async (ev: FormEvent) => {
    ev.preventDefault()
    setFormError(null)
    const e = validate()
    setErrors(e)
    if (Object.keys(e).length) { setFormError('Please fix the highlighted fields.'); return }
    const fd = new FormData()
    fd.set('description', description.trim())
    fd.set('location_text', location.trim())
    if (category) fd.set('category', category)
    if (pin) { fd.set('lat', String(pin.lat)); fd.set('lng', String(pin.lng)) }
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
      if (err instanceof ApiError) { setErrors(err.fields); setFormError(err.message) } else setFormError('Something went wrong. Please try again.')
    } finally { setSubmitting(false) }
  }

  if (result) return <Submitted r={result} onAnother={() => {
    setResult(null); setDescription(''); setLocation(''); setPin(null); setImage(null); setImageUrl(null); setCategory(''); setAffected('')
  }} />

  return (
    <>
    <PageBanner eyebrow="Capture · Citizen report" title="Report an issue">
      <p className="banner__lede">No account needed. Describe what you see, pin where it is, add a photo if you can. You’ll get a tracking ID straight away.</p>
      <button type="button" className="btn btn--ghost btn--glass btn--sm" onClick={fillDemo}><Sparkles />Fill with demo example</button>
    </PageBanner>
    <div className="report wrap">
      <form className="report__grid" onSubmit={submit} noValidate>
        <div className="report__form">
          {/* 1 */}
          <fieldset className="step">
            <legend><span className="step__n mono">1</span> What’s the problem?</legend>
            <div className="chips" role="radiogroup" aria-label="Category (optional)">
              {CATEGORY_KEYS.map((k) => {
                const Icon = CATEGORY_META[k].icon
                return (
                  <button type="button" key={k} role="radio" aria-checked={category === k}
                    className={`chip ${category === k ? 'is-on' : ''}`} onClick={() => setCategory(category === k ? '' : k)}>
                    <Icon aria-hidden />{CATEGORY_META[k].short}
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
          </fieldset>

          {/* 2 */}
          <fieldset className="step">
            <legend><span className="step__n mono">2</span> Where is it?</legend>
            <div className="field">
              <label htmlFor="loc">Landmark, street or area</label>
              <input id="loc" className="input" value={location} maxLength={200} aria-invalid={!!errors.location_text}
                placeholder="e.g. Central Bus Stand, Platform Road" onChange={(e) => setLocation(e.target.value)} />
              {errors.location_text && <span className="error">{errors.location_text}</span>}
            </div>
            <div className="picker">
              <div className="picker__bar">
                <span className="small"><MapPin size={15} /> {pin ? <span className="mono">{pin.lat.toFixed(5)}, {pin.lng.toFixed(5)}</span> : 'Tap the map to drop a pin'}</span>
                <span className="picker__btns">
                  {pin && <button type="button" className="btn btn--quiet btn--sm" onClick={() => setPin(null)}><X />Clear</button>}
                  <button type="button" className="btn btn--ghost btn--sm" onClick={useMyLocation}><Crosshair />Use my location</button>
                </span>
              </div>
              <div className="picker__map">
                <CityMap height="100%" pick={pin} onPick={(lat, lng) => setPin({ lat: +lat.toFixed(6), lng: +lng.toFixed(6) })} scrollZoom={false} fitKey={pin ? `${pin.lat}` : 'none'} />
              </div>
              {geoState && <p className="hint">{geoState}</p>}
              {errors.location && <span className="error">{errors.location}</span>}
            </div>
          </fieldset>

          {/* 3 */}
          <fieldset className="step">
            <legend><span className="step__n mono">3</span> Add a photo <span className="muted">(optional)</span></legend>
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
          </fieldset>

          {/* 4 */}
          <fieldset className="step">
            <legend><span className="step__n mono">4</span> A little more <span className="muted">(optional)</span></legend>
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
          </fieldset>

          {formError && <div className="notice notice--danger" role="alert"><CircleAlert />{formError}</div>}
          <div className="report__submit">
            <button className="btn btn--signal" disabled={submitting}>
              {submitting ? <><Loader2 className="spin" />Analysing your report…</> : <>Submit report <ArrowRight /></>}
            </button>
            <span className="muted small">By submitting you agree this is a genuine report.</span>
          </div>
        </div>

        <aside className="report__aside">
          <div className="aside-card">
            <span className="eyebrow">What happens next</span>
            <ol className="next">
              <li><strong>Instant analysis.</strong> Category, summary, priority score and nearby similar reports — shown to you right after you submit.</li>
              <li><strong>Review & assignment.</strong> The ward office assigns the right department.</li>
              <li><strong>Progress you can see.</strong> Track every status change with your ID.</li>
            </ol>
            <p className="muted small">Reporting the same problem as a neighbour? Still report it — similar reports are linked, which raises the priority.</p>
          </div>
        </aside>
      </form>
    </div>
    </>
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
