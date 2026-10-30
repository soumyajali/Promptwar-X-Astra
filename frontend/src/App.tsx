import { lazy, Suspense, type ReactNode } from 'react'
import { BrowserRouter, Route, Routes } from 'react-router-dom'
import { ErrorBoundary, Skeleton } from './components/ui'
import { CommandLayout } from './layouts/CommandLayout'
import { PublicLayout } from './layouts/PublicLayout'
import { Landing } from './pages/Landing'
import { NotFound } from './pages/NotFound'
import { Report } from './pages/Report'
import { Track } from './pages/Track'
import { Login } from './pages/command/Login'
import { LiveProvider } from './store/live'

// Command Center pages (and the charting library) load only when an officer opens them.
const Analytics = lazy(() => import('./pages/command/Analytics').then((m) => ({ default: m.Analytics })))
const Assignments = lazy(() => import('./pages/command/Assignments').then((m) => ({ default: m.Assignments })))
const Briefs = lazy(() => import('./pages/command/Briefs').then((m) => ({ default: m.Briefs })))
const Hotspots = lazy(() => import('./pages/command/Hotspots').then((m) => ({ default: m.Hotspots })))
const Intelligence = lazy(() => import('./pages/command/Intelligence').then((m) => ({ default: m.Intelligence })))
const MapPage = lazy(() => import('./pages/command/MapPage').then((m) => ({ default: m.MapPage })))
const Overview = lazy(() => import('./pages/command/Overview').then((m) => ({ default: m.Overview })))
const ReportDetail = lazy(() => import('./pages/command/ReportDetail').then((m) => ({ default: m.ReportDetail })))
const Reports = lazy(() => import('./pages/command/Reports').then((m) => ({ default: m.Reports })))
const DesignLab = lazy(() => import('./design-lab/Lab').then((m) => ({ default: m.DesignLab })))
const L = ({ children }: { children: ReactNode }) => <Suspense fallback={<div className="cpage"><Skeleton h={400} /></div>}>{children}</Suspense>

export default function App() {
  return (
    <ErrorBoundary>
      <LiveProvider>
        <BrowserRouter>
          <Routes>
            <Route element={<PublicLayout />}>
              <Route index element={<Landing />} />
              <Route path="report" element={<Report />} />
              <Route path="track" element={<Track />} />
              <Route path="track/:id" element={<Track />} />
              <Route path="*" element={<NotFound />} />
            </Route>
            {/* Design exploration — separate from the live app; nothing here changes existing pages. */}
            <Route path="design-lab" element={<Suspense fallback={null}><DesignLab /></Suspense>} />
            <Route path="command/login" element={<Login />} />
            <Route path="command" element={<CommandLayout />}>
              <Route index element={<L><Overview /></L>} />
              <Route path="reports" element={<L><Reports /></L>} />
              <Route path="reports/:id" element={<L><ReportDetail /></L>} />
              <Route path="map" element={<L><MapPage /></L>} />
              <Route path="hotspots" element={<L><Hotspots /></L>} />
              <Route path="intelligence" element={<L><Intelligence /></L>} />
              <Route path="assignments" element={<L><Assignments /></L>} />
              <Route path="analytics" element={<L><Analytics /></L>} />
              <Route path="briefs" element={<L><Briefs /></L>} />
            </Route>
          </Routes>
        </BrowserRouter>
      </LiveProvider>
    </ErrorBoundary>
  )
}
