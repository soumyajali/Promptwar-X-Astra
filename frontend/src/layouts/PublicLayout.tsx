import { ArrowUpRight, Menu, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom'
import { Logo } from '../components/ui'

export function PublicLayout() {
  const [open, setOpen] = useState(false)
  const loc = useLocation()
  useEffect(() => { setOpen(false); window.scrollTo(0, 0) }, [loc.pathname])

  return (
    <div className="site">
      <a className="skip" href="#main">Skip to content</a>
      <header className="masthead">
        <div className="wrap masthead__row">
          <Link to="/" className="masthead__brand" aria-label="CivicPulse AI home"><Logo /></Link>
          <nav className={`masthead__nav ${open ? 'is-open' : ''}`} aria-label="Main">
            <NavLink to="/" end>Overview</NavLink>
            <a href="/#how">How it works</a>
            <a href="/#pulse">City pulse</a>
            <NavLink to="/track">Track a report</NavLink>
            <NavLink to="/command" className="masthead__cmd">Command Center <ArrowUpRight size={15} /></NavLink>
            <Link to="/report" className="btn btn--signal btn--sm masthead__cta-mobile">Report an issue</Link>
          </nav>
          <div className="masthead__actions">
            <Link to="/report" className="btn btn--signal btn--sm">Report an issue</Link>
            <button className="btn btn--quiet masthead__toggle" aria-label={open ? 'Close menu' : 'Open menu'} aria-expanded={open} onClick={() => setOpen(!open)}>
              {open ? <X /> : <Menu />}
            </button>
          </div>
        </div>
      </header>
      <main id="main"><Outlet /></main>
      <footer className="footer">
        <div className="wrap footer__grid">
          <div>
            <Logo light />
            <p className="footer__lede">From scattered complaints to prioritised, explainable, trackable civic action.</p>
          </div>
          <div>
            <h4 className="eyebrow">Citizens</h4>
            <Link to="/report">Report an issue</Link>
            <Link to="/track">Track a report</Link>
            <a href="/#pulse">City pulse</a>
          </div>
          <div>
            <h4 className="eyebrow">Ward office</h4>
            <Link to="/command">Command Center</Link>
            <Link to="/command/briefs">Action briefs</Link>
            <Link to="/command/intelligence">How the engine works</Link>
          </div>
          <div className="footer__honest">
            <h4 className="eyebrow">Honesty note</h4>
            <p>Hackathon prototype. "Demo City" uses fictional wards and synthetic reports placed on Mangaluru coordinates.
              Analysis is done by documented, deterministic algorithms — not a trained model or external AI service.
              No government system, dispatch service or identity verification is connected.</p>
          </div>
        </div>
        <div className="wrap footer__base">
          <span className="mono">CivicPulse AI · PromptWars × ASTRA 2026</span>
          <span className="mono">Map data © OpenStreetMap contributors</span>
        </div>
      </footer>
    </div>
  )
}
