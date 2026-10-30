import { session, type Session, type User } from './session'
import type {
  AssistantAnswer, AuthorityReport, Brief, Dashboard, Hotspot, Meta, Preview, PublicReport, PublicStats,
  ReportDetail, Status, TrackView,
} from './types'

export type MyReport = Omit<TrackView, 'analysis'> & { priority_level: string; priority_score: number }

export class ApiError extends Error {
  status: number
  fields: Record<string, string>
  constructor(status: number, message: string, fields: Record<string, string> = {}) {
    super(message)
    this.status = status
    this.fields = fields
  }
}

async function request<T>(path: string, init: RequestInit = {}, authority = false): Promise<T> {
  const headers = new Headers(init.headers)
  if (init.body && !(init.body instanceof FormData)) headers.set('Content-Type', 'application/json')
  const token = session.token()
  if (token) headers.set('Authorization', `Bearer ${token}`)
  let res: Response
  try {
    res = await fetch(path, { ...init, headers })
  } catch {
    throw new ApiError(0, 'Cannot reach the CivicPulse server. Check that the backend is running.')
  }
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    const detail = data?.detail ?? {}
    // A 5xx without our JSON error body comes from the dev proxy or a gateway: the backend did not answer.
    if (!detail.message && res.status >= 500) {
      throw new ApiError(0, 'Cannot reach the CivicPulse server. Check that the backend is running.')
    }
    if (res.status === 401 && (authority || path.startsWith('/api/citizen') || path === '/api/auth/me')) {
      session.clear()  // expired or revoked session: the layouts send the user back to sign in
    }
    throw new ApiError(res.status, detail.message ?? `Request failed (${res.status})`, detail.fields ?? {})
  }
  return data as T
}

const post = (body: unknown): RequestInit => ({ method: 'POST', body: JSON.stringify(body) })

export const api = {
  meta: () => request<Meta>('/api/meta'),
  stats: () => request<PublicStats>('/api/public/stats'),
  publicReports: (limit = 12) => request<PublicReport[]>(`/api/public/reports?limit=${limit}`),
  publicMap: () => request<PublicReport[]>('/api/public/map'),
  preview: (description: string) => request<Preview>('/api/analyze/preview', post({ description })),
  submit: (form: FormData) => request<TrackView>('/api/reports', { method: 'POST', body: form }),
  track: (id: string) => request<TrackView>(`/api/track/${encodeURIComponent(id.trim())}`),

  register: (name: string, email: string, password: string) => request<Session>('/api/auth/register', post({ name, email, password })),
  signIn: (email: string, password: string, role: 'citizen' | 'authority') => request<Session>('/api/auth/login', post({ email, password, role })),
  signOut: () => request<{ ok: boolean }>('/api/auth/logout', { method: 'POST' }).catch(() => ({ ok: false })),
  me: () => request<User>('/api/auth/me'),
  myReports: () => request<MyReport[]>('/api/citizen/reports'),
  reports: () => request<AuthorityReport[]>('/api/authority/reports', {}, true),
  report: (id: string) => request<ReportDetail>(`/api/authority/reports/${id}`, {}, true),
  dashboard: () => request<Dashboard>('/api/authority/dashboard', {}, true),
  hotspots: () => request<Hotspot[]>('/api/authority/hotspots', {}, true),
  brief: (ward?: string) => request<Brief>(`/api/authority/brief${ward ? `?ward=${encodeURIComponent(ward)}` : ''}`, {}, true),
  ask: (question: string, context?: Record<string, string>) =>
    request<AssistantAnswer>('/api/authority/assistant', post({ question, context: context ?? null }), true),
  setStatus: (id: string, body: { status: Status; public_message?: string; resolution_note?: string }) =>
    request<ReportDetail>(`/api/authority/reports/${id}/status`, post(body), true),
  assign: (id: string, department: string, officer?: string) =>
    request<ReportDetail>(`/api/authority/reports/${id}/assign`, post({ department, officer }), true),
  correctCategory: (id: string, category: string, reason?: string) =>
    request<ReportDetail>(`/api/authority/reports/${id}/category`, post({ category, reason }), true),
  overridePriority: (id: string, level: string, reason: string) =>
    request<ReportDetail>(`/api/authority/reports/${id}/priority`, post({ level, reason }), true),
  addUpdate: (id: string, message: string, visibility: 'public' | 'internal') =>
    request<ReportDetail>(`/api/authority/reports/${id}/updates`, post({ message, visibility }), true),
  resetDemo: () => request<{ ok: boolean; reports: number }>('/api/authority/demo/reset', { method: 'POST' }, true),
}
