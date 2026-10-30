import { Sparkles } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Metric, PageHead, Panel, ReportRows } from '../../components/command'
import { ErrorState, Skeleton } from '../../components/ui'
import { api } from '../../lib/api'
import { pct } from '../../lib/format'
import type { Preview } from '../../lib/types'
import { useLiveQuery } from '../../store/live'

const WEIGHTS = [
  ['Safety risk', 25, 'Hazard phrases (live wire, open manhole, gas leak, assault…) each with a risk weight, or the category’s baseline risk.'],
  ['Severity', 20, 'Severity phrases (knee deep, burst, completely blocked…). A detected hazard implies severity of at least 0.6 × its risk.'],
  ['Urgency', 15, 'Urgency phrases (emergency, getting worse…) and stated duration — a week or more unresolved scores fully.'],
  ['Public impact', 15, 'Affected groups (school, hospital, bus stand, market…) and the number of people stated by the citizen (500+ = full).'],
  ['Recurring reports', 15, '0.25 per linked similar report + 0.15 per same-category report within 300 m in 60 days.'],
  ['Geographic concentration', 10, 'Open reports of any kind within 400 m in the last 14 days (5+ = full).'],
] as const

export function Intelligence() {
  const reports = useLiveQuery(() => api.reports())
  const [text, setText] = useState('Live wire hanging near the school gate and sparking after the rain, children walk here every morning')
  const [pv, setPv] = useState<Preview | null>(null)
  useEffect(() => {
    if (text.trim().length < 12) { setPv(null); return }
    const t = setTimeout(() => api.preview(text).then(setPv).catch(() => setPv(null)), 350)
    return () => clearTimeout(t)
  }, [text])

  if (reports.error) return <ErrorState error={reports.error} onRetry={reports.reload} />
  const rs = reports.data
  const chose = rs?.filter((r) => r.category_selected && r.category_selected !== 'other') ?? []
  const agree = chose.filter((r) => r.category_predicted === r.category_selected).length
  const auto = rs?.filter((r) => !r.category_selected) ?? []
  const review = rs?.filter((r) => r.needs_review) ?? []
  const linked = rs?.filter((r) => r.primary_report_id) ?? []
  const corrected = rs?.filter((r) => r.category_corrected) ?? []

  return (
    <div className="cpage">
      <PageHead eyebrow="Understand · AI intelligence" title="How the engine decides">
        CivicPulse uses deterministic, documented NLP and geographic algorithms. There is no trained model and no external AI service —
        every output can be traced to the rule or phrase that produced it.
      </PageHead>

      <dl className="metrics metrics--5">
        {rs ? (
          <>
            <Metric label="Classifier agrees with citizen" value={chose.length ? pct(agree / chose.length) : '—'} note={`${agree} of ${chose.length} reports where the citizen picked a category`} />
            <Metric label="Auto-categorised" value={auto.length} note="Citizen skipped the category" />
            <Metric label="Awaiting category review" value={review.length} tone={review.length ? 'ochre' : undefined} note="Citizen and classifier disagree" />
            <Metric label="Officer corrections" value={corrected.length} note="Feedback logged on the report" />
            <Metric label="Linked as duplicates" value={linked.length} />
          </>
        ) : Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} h={86} />)}
      </dl>

      <div className="grid-12">
        <Panel title="Try the classifier" note="Live — uses the same endpoint as the citizen form; nothing is saved" className="span-6">
          <textarea className="textarea" aria-label="Test complaint text" value={text} onChange={(e) => setText(e.target.value)} />
          {pv?.ready && (
            <div className="ai-hint" style={{ marginTop: 12 }}>
              <Sparkles aria-hidden />
              <div>
                <strong>{pv.label}</strong> <span className="mono">{pct(pv.confidence ?? 0)}</span>{pv.needs_review && <span className="badge badge--high" style={{ marginLeft: 8 }}>below review threshold</span>}
                <div className="small muted">Evidence: {pv.evidence?.join(', ') || 'none'}</div>
                {!!pv.hazards?.length && <div className="small">Hazards: {pv.hazards.join(', ')}</div>}
                {!!pv.affected?.length && <div className="small">Affected: {pv.affected.join(', ')}</div>}
              </div>
            </div>
          )}
        </Panel>

        <Panel title="Pipeline" note="Runs on every new report" className="span-6">
          <ol className="pipeline">
            <li><b>Classify</b> — weighted phrase lexicon per category, softmax confidence with an “other” pseudo-class. Below 45% → human review.</li>
            <li><b>Resolve category</b> — the citizen’s choice is kept; strong disagreement (≥60%) is flagged, never silently overwritten.</li>
            <li><b>Summarise</b> — picks the most informative sentence, then adds only detected facts: affected groups, hazards, urgency cues.</li>
            <li><b>Find duplicates</b> — TF-IDF (unigrams + bigrams) cosine, category match, distance ≤500 m, time ≤14 days. Linked, never deleted.</li>
            <li><b>Score priority</b> — six factors below. Score 0–100 → Critical ≥70 · High ≥50 · Medium ≥30 · Low.</li>
            <li><b>Recommend</b> — rules map category + hazards + recurrence to actions, department and response target.</li>
            <li><b>Re-score neighbours</b> — open reports within 400 m are re-scored because their recurrence just changed.</li>
          </ol>
        </Panel>

        <Panel title="Priority weights" note="Documented in backend/app/services/priority.py" className="span-7">
          <table className="table table--plain">
            <thead><tr><th>Factor</th><th>Max</th><th>How it is measured</th></tr></thead>
            <tbody>{WEIGHTS.map(([n, w, d]) => <tr key={n}><td><strong>{n}</strong></td><td className="mono">{w}</td><td className="small">{d}</td></tr>)}</tbody>
          </table>
        </Panel>

        <Panel title="Review queue" note="Category mismatches" className="span-5">
          <ReportRows reports={review} empty="No reports need category review." />
          {review.length > 0 && <p className="small" style={{ marginTop: 10 }}><Link className="link-id" to="/command/reports?review=1&status=all">Open in report list</Link></p>}
        </Panel>

        <Panel title="Honest limits" className="span-12">
          <ul className="limits">
            <li>The classifier is a hand-built lexicon. It is fast and explainable but will miss phrasing it has not seen; low confidence is routed to people.</li>
            <li>The summariser is extractive. It cannot paraphrase and never adds facts; it may keep awkward citizen wording.</li>
            <li>Duplicate detection compares against reports already stored. Thresholds were tuned on the synthetic demo data only.</li>
            <li>Priority weights are a documented policy choice, not learned from outcomes. A real deployment should calibrate them with the ward office.</li>
            <li>Photos are stored and shown but not analysed.</li>
          </ul>
        </Panel>
      </div>
    </div>
  )
}
