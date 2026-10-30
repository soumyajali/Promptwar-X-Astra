import { useEffect, useState } from 'react'

/** Signed-in demo account. Only the opaque session token is kept in the browser — never a password. */
export type User = { id: number; name: string; email: string; role: 'citizen' | 'authority'; title: string | null }
export type Session = { token: string; user: User }

const KEY = 'civicpulse.session'
const EVT = 'civicpulse:session'

export const session = {
  get(): Session | null {
    try { const s = localStorage.getItem(KEY); return s ? JSON.parse(s) as Session : null } catch { return null }
  },
  set(s: Session) {
    try { localStorage.setItem(KEY, JSON.stringify(s)) } catch { /* private mode: session lasts this tab only */ }
    mem = s
    window.dispatchEvent(new Event(EVT))
  },
  clear() {
    try { localStorage.removeItem(KEY) } catch { /* ignore */ }
    mem = null
    window.dispatchEvent(new Event(EVT))
  },
  token(): string | null { return (session.get() ?? mem)?.token ?? null },
}
let mem: Session | null = null

export function useSession(): Session | null {
  const [s, setS] = useState<Session | null>(() => session.get() ?? mem)
  useEffect(() => {
    const on = () => setS(session.get() ?? mem)
    window.addEventListener(EVT, on)
    window.addEventListener('storage', on)
    return () => { window.removeEventListener(EVT, on); window.removeEventListener('storage', on) }
  }, [])
  return s
}
