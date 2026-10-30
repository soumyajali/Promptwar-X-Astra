import {
  BarChart3, Brain, ClipboardList, FileText, Flame, LayoutDashboard, LogOut, Map as MapIcon, Menu, MessageSquareText,
  RotateCcw, Users, X,
} from 'lucide-react'
import { useEffect, useState } from 'react'
import { ShieldCheck } from 'lucide-react'
import { Link, NavLink, Navigate, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { Assistant } from '../components/Assistant'
import { LiveIndicator, Logo, Toast, useToast } from '../components/ui'
import { api } from '../lib/api'
import { session, useSession } from '../lib/session'
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

/** Local date and time in the operations header, updated every 30 s. */
function Clock() {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => { const t = setInterval(() => setNow(new Date()), 30000); return () => clearInterval(t) }, [])
  return <span className="cmd__clock mono">{now.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })} · {now.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}</span>
}

export function CommandLayout() {
  const nav = useNavigate()
  const loc = useLocation()
  const me = useSession()
  const [menu, setMenu] = useState(false)
  const [confirmReset, setConfirmReset] = useState(false)
  const [assistant, setAssistant] = useState(false)
  const toast = useToast()
  const { lastEvent } = useLive()

  useEffect(() => { setMenu(false) }, [loc.pathname])
  useEffect(() => {
    if (lastEvent?.event === 'report.created' && lastEvent.id) toast.show(`New citizen report ${lastEvent.id} received and analysed`)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lastEvent])

  // Only signed-in ward-office accounts get the Command Center; citizens are sent to the authority sign-in.
  if (!me || me.user.role !== 'authority') {
    return <Navigate to="/command/login" replace state={{ from: loc.pathname, citizen: me?.user.role === 'citizen' }} />
  }
  const signOut = async () => { await api.signOut(); session.clear(); nav('/command/login', { replace: true }) }
  const reset = async () => {
    setConfirmReset(false)
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
        <div className="cmd__who"><span className="cmd__avatar" aria-hidden>{me.user.name.replace(/^(Er|Dr|Mr|Ms)\.\s*/, '').split(' ').map((w) => w[0]).slice(0, 2).join('')}</span><span><b>{me.user.name}</b><em>{me.user.title ?? 'Ward office'} · Authority</em></span></div>
        <nav className="cmd__nav">
          {NAV.map(({ to, label, icon: Icon, end }) => (
            <NavLink key={to} to={to} end={end}><Icon aria-hidden />{label}</NavLink>
          ))}
        </nav>
        <div className="cmd__card" aria-hidden>
          <img src="/img/hero-city-sm.jpg" alt="" />
          <p>A smarter city through collective action.</p>
        </div>
        <div className="cmd__foot">
          <button className="cmd__ask" onClick={() => setAssistant(true)}><MessageSquareText />Ask CivicPulse</button>
          {confirmReset ? (
            <div className="cmd__confirm" role="alertdialog" aria-label="Confirm reset">
              <p>Reset to the 46 demo reports? Reports added during the demo are removed.</p>
              <div><button className="btn btn--signal btn--sm" onClick={reset}>Reset</button><button className="btn btn--quiet btn--sm" onClick={() => setConfirmReset(false)}>Cancel</button></div>
            </div>
          ) : <button className="cmd__link" onClick={() => setConfirmReset(true)}><RotateCcw />Reset demo data</button>}
          <button className="cmd__link" onClick={signOut}><LogOut />Sign out</button>
        </div>
      </aside>
      <div className="cmd__scrim" onClick={() => setMenu(false)} />
      <div className="cmd__main">
        <header className="cmd__top">
          <button className="btn btn--quiet cmd__burger" aria-label="Open menu" onClick={() => setMenu(true)}><Menu /></button>
          <Link to="/" className="cmd__toplogo"><Logo compact /></Link>
          <span className="cmd__topnote mono">Demo account · synthetic data</span>
          <div className="cmd__topact">
            <Clock />
            <span className="cmd__admin" title={me.user.email}><ShieldCheck size={15} /><span><b>{me.user.name}</b><em>{me.user.title ?? 'Ward office'}</em></span></span>
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
