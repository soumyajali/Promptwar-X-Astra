/* Design Lab: compare five visual directions for CivicPulse AI side by side.
   Each concept is fully self-contained (its own fonts, tokens, layout and components) and is
   rendered inside a container-query frame so the Mobile toggle shows its real responsive layout. */
import { useEffect, useState } from 'react'
import { SCREENS, type Screen } from './data'
import { Atlas } from './concepts/Atlas'
import { Wayfinder } from './concepts/Wayfinder'
import { Signal } from './concepts/Signal'
import { Quiet } from './concepts/Quiet'
import { Cyanotype } from './concepts/Cyanotype'
import './lab.css'

export const CONCEPTS = [
  { n: 1, key: 'atlas', name: 'Atlas', kind: 'Editorial & premium', line: 'A city magazine. High-contrast serif, oxblood ink, numbered spreads and infographic maps.', swatch: ['#FFFFFF', '#111111', '#6E1423', '#C9B79C'], C: Atlas },
  { n: 2, key: 'wayfinder', name: 'Wayfinder', kind: 'Modern civic technology', line: 'Built from road and transit signage. Departments are lines, hotspots are interchanges.', swatch: ['#FFFFFF', '#0F5132', '#FFC20E', '#1B5FA8'], C: Wayfinder },
  { n: 3, key: 'signal', name: 'Signal', kind: 'Bold & expressive', line: 'A public-safety poster. Caution yellow, black, giant condensed numbers, hazard stripes.', swatch: ['#FFD60A', '#0A0A0A', '#FFFFFF', '#E63B2E'], C: Signal },
  { n: 4, key: 'quiet', name: 'Quiet', kind: 'Minimal & functional', line: 'Calm and fast. Greyscale, one accent, dense tables, keyboard-first, dot-matrix map.', swatch: ['#FAFAF9', '#18181B', '#A1A1AA', '#D92D20'], C: Quiet },
  { n: 5, key: 'cyanotype', name: 'Cyanotype', kind: 'Infrastructure blueprint', line: 'An engineer’s drawing set. Prussian-blue paper, drafted linework, work-order forms, stamps.', swatch: ['#123A63', '#EAF2F8', '#7FB2D9', '#F26B1D'], C: Cyanotype },
] as const

function readHash() {
  const p = new URLSearchParams(location.hash.slice(1))
  const c = Math.min(5, Math.max(1, Number(p.get('c')) || 1))
  const s = (SCREENS.find((x) => x.key === p.get('s'))?.key ?? 'landing') as Screen
  const d = p.get('d') === 'mobile' ? 'mobile' : 'desktop'
  return { c, s, d: d as 'desktop' | 'mobile' }
}

export function DesignLab() {
  const [state, setState] = useState(readHash)
  const { c, s, d } = state
  useEffect(() => { history.replaceState(null, '', `#c=${c}&s=${s}&d=${d}`) }, [c, s, d])
  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.closest('input,textarea,select')) return
      if (/^[1-5]$/.test(e.key)) setState((x) => ({ ...x, c: +e.key }))
    }
    window.addEventListener('keydown', k)
    return () => window.removeEventListener('keydown', k)
  }, [])
  const concept = CONCEPTS[c - 1]
  const C = concept.C
  const go = (screen: Screen) => {
    setState((x) => ({ ...x, s: screen }))
    document.querySelector('.lab-stage')?.scrollTo({ top: 0 })
  }

  return (
    <div className="lab">
      <header className="lab-top">
        <div className="lab-title">
          <strong>CivicPulse AI</strong><span>Design Lab · 5 directions</span>
        </div>
        <p className="lab-note">Pick a concept, then a screen. Sample data is real engine output on the synthetic Demo City dataset. Press 1–5 to switch.</p>
      </header>

      <nav className="lab-concepts" aria-label="Design concepts">
        {CONCEPTS.map((k) => (
          <button key={k.n} className={`lab-card ${k.n === c ? 'is-on' : ''}`} aria-pressed={k.n === c} onClick={() => setState((x) => ({ ...x, c: k.n }))}>
            <span className="lab-card__n">Concept {k.n}</span>
            <span className="lab-card__name">{k.name}</span>
            <span className="lab-card__kind">{k.kind}</span>
            <span className="lab-card__sw">{k.swatch.map((sw) => <i key={sw} style={{ background: sw }} />)}</span>
            <span className="lab-card__line">{k.line}</span>
          </button>
        ))}
      </nav>

      <div className="lab-bar">
        <div className="lab-tabs" role="tablist" aria-label="Screens">
          {SCREENS.map((x, i) => (
            <button key={x.key} role="tab" aria-selected={x.key === s} className={x.key === s ? 'is-on' : ''} onClick={() => go(x.key)}>
              <span>{i + 1}</span>{x.label}
            </button>
          ))}
        </div>
        <div className="lab-device" role="radiogroup" aria-label="Preview width">
          {(['desktop', 'mobile'] as const).map((v) => (
            <button key={v} role="radio" aria-checked={d === v} className={d === v ? 'is-on' : ''} onClick={() => setState((x) => ({ ...x, d: v }))}>
              {v === 'desktop' ? 'Desktop' : 'Mobile 390'}
            </button>
          ))}
        </div>
      </div>

      <div className={`lab-stage lab-stage--${d}`}>
        <div className="lab-frame" key={`${c}-${d}`}>
          <C screen={s} go={go} />
        </div>
      </div>
    </div>
  )
}
