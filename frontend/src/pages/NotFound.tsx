import { Link } from 'react-router-dom'

export function NotFound() {
  return (
    <div className="wrap page-head" style={{ paddingBlock: '96px' }}>
      <span className="eyebrow">404</span>
      <h1 className="serif display-1">This street isn’t on our map.</h1>
      <p className="page-head__lede">The page you asked for doesn’t exist.</p>
      <div className="hero__ctas"><Link className="btn btn--civic" to="/">Go home</Link><Link className="btn btn--ghost" to="/track">Track a report</Link></div>
    </div>
  )
}
