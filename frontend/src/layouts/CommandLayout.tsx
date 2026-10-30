import {
  BarChart3, Brain, ClipboardList, FileText, Flame, LayoutDashboard, LogOut, Map as MapIcon, Menu, MessageSquareText,
  RotateCcw, Users, X,
} from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, NavLink, Navigate, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { Assistant } from '../components/Assistant'
import { LiveIndicator, Logo, Toast, useToast } from '../components/ui'
import { api, auth } from '../lib/api'
import { useLive } from '../store/live'

const NAV = [
  { to: '/command', label: 'Overview', icon: LayoutDashboard, end: true },
  { to: '/command/reports', label: 'All reports', icon: ClipboardList },
  { to: '/command/map', label: 'Live city map', icon: MapIcon },
  { to: '/command/hotspots', label: 'Hotspots', icon: Flame },
  { to: '/command/intelligence', label: 'AI intelligence', icon: Brain },
  { to: '/command/assignments', label: 'Assignments', icon: Users },
  { to: '/command/analytics', label: 'Analytics', icon: BarChart3 },
  { to: '/command/briefs', label: 'Action briefs', icon: FileText },
]

export function CommandLayout() {
  const nav = useNavigate()
  const loc = useLocation()
  const [authed, setAuthed] = useState(!!auth.get())
  const [menu, setMenu] = useState(false)
  const [assistant, setAssistant] = useState(false)
  const toast = useToast()
  const { lastEvent } = useLive()

  useEffect(() => {
    const out = () => setAuthed(false)
    window.addEventListener('civicpulse:logout', out)
    return () => window.removeEventListener('civicpulse:logout', out)
  }, [])
  useEffect(() => { setMenu(false) }, [loc.pathname])
  useEffect(() => {
    if (lastEvent?.event === 'report.created' && lastEvent.id) toast.show(`New citizen report ${lastEvent.id} received and analysed`)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lastEvent])

  if (!authed) return <Navigate to="/command/login" replace state={{ from: loc.pathname }} />

  const reset = async () => {
    if (!confirm('Reset all data to the 46 synthetic demo reports? Reports submitted during the demo will be removed.')) return
    try {
      const r = await api.resetDemo()
      toast.show(`Demo data reset · ${r.reports} reports`)
      nav('/command')
    } catch (e) { toast.show((e as Error).message) }
  }

  return (
    <div className={`cmd ${menu ? 'is-menu' : ''}`}>
      <aside className="cmd__side" aria-label="Command Center navigation">
        <div className="cmd__brand">
          <Link to="/" aria-label="CivicPulse public site"><Logo light /></Link>
          <button className="btn btn--quiet cmd__close" aria-label="Close menu" onClick={() => setMenu(false)}><X /></button>
        </div>
        <div className="cmd__role"><span className="eyebrow eyebrow--light">Ward Office · Demo City</span><LiveIndicator light /></div>
        <nav className="cmd__nav">
          {NAV.map(({ to, label, icon: Icon, end }) => (
            <NavLink key={to} to={to} end={end}><Icon aria-hidden />{label}</NavLink>
          ))}
        </nav>
        <div className="cmd__foot">
          <button className="cmd__ask" onClick={() => setAssistant(true)}><MessageSquareText />Ask CivicPulse</button>
          <button className="cmd__link" onClick={reset}><RotateCcw />Reset demo data</button>
          <button className="cmd__link" onClick={() => { auth.clear(); setAuthed(false) }}><LogOut />Sign out</button>
        </div>
      </aside>
      <div className="cmd__scrim" onClick={() => setMenu(false)} />
      <div className="cmd__main">
        <header className="cmd__top">
          <button className="btn btn--quiet cmd__burger" aria-label="Open menu" onClick={() => setMenu(true)}><Menu /></button>
          <Link to="/" className="cmd__toplogo"><Logo compact /></Link>
          <span className="cmd__topnote mono">Demo access · synthetic data</span>
          <div className="cmd__topact">
            <Link to="/report" className="btn btn--ghost btn--sm" target="_blank">Citizen view</Link>
            <button className="btn btn--civic btn--sm" onClick={() => setAssistant(true)}><MessageSquareText />Ask</button>
          </div>
        </header>
        <main className="cmd__content" id="main"><Outlet /></main>
      </div>
      <Assistant open={assistant} onClose={() => setAssistant(false)} />
      <Toast message={toast.msg} onDone={toast.clear} />
    </div>
  )
}
