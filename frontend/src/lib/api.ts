import type {
  AssistantAnswer, AuthorityReport, Brief, Dashboard, Hotspot, Meta, Preview, PublicReport, PublicStats,
  ReportDetail, Status, TrackView,
} from './types'

export class ApiError extends Error {
  status: number
  fields: Record<string, string>
  constructor(status: number, message: string, fields: Record<string, string> = {}) {
    super(message)
    this.status = status
    this.fields = fields
  }
}

const AUTH_KEY = 'civicpulse.authority'

export const auth = {
  get: () => {
    try { return sessionStorage.getItem(AUTH_KEY) } catch { return null }
  },
  set: (code: string) => { try { sessionStorage.setItem(AUTH_KEY, code) } catch { /* private mode */ } },
  clear: () => { try { sessionStorage.removeItem(AUTH_KEY) } catch { /* ignore */ } },
}

async function request<T>(path: string, init: RequestInit = {}, authority = false): Promise<T> {
  const headers = new Headers(init.headers)
  if (init.body && !(init.body instanceof FormData)) headers.set('Content-Type', 'application/json')
  if (authority) headers.set('X-Authority-Code', auth.get() ?? '')
  let res: Response
  try {
    res = await fetch(path, { ...init, headers })
  } catch {
    throw new ApiError(0, 'Cannot reach the CivicPulse server. Check that the backend is running.')
  }
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    const detail = data?.detail ?? {}
    if (res.status === 401 && authority) {
      auth.clear()
      window.dispatchEvent(new Event('civicpulse:logout'))
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

  login: (code: string) => request<{ ok: boolean; name: string }>('/api/authority/login', post({ code })),
  reports: () => request<AuthorityReport[]>('/api/authority/reports', {}, true),
  report: (id: string) => request<ReportDetail>(`/api/authority/reports/${id}`, {}, true),
  dashboard: () => request<Dashboard>('/api/authority/dashboard', {}, true),
  hotspots: () => request<Hotspot[]>('/api/authority/hotspots', {}, true),
  brief: (ward?: string) => request<Brief>(`/api/authority/brief${ward ? `?ward=${encodeURIComponent(ward)}` : ''}`, {}, true),
  ask: (question: string) => request<AssistantAnswer>('/api/authority/assistant', post({ question }), true),
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
