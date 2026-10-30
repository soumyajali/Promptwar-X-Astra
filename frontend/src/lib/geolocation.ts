/* Browser location for the citizen report form.

   Why the earlier version failed: it asked only for a high-accuracy (GPS) fix with an 8 s timeout and
   reported every failure as "permission denied or unavailable". Laptops and desktops have no GPS, so a
   high-accuracy fix often never arrives in time (TIMEOUT), and the real cause was hidden.

   Strategy now:
   1. Refuse early, with a specific reason, when the page is not a secure context or the API is missing.
   2. First ask for a fast network-based fix (enableHighAccuracy: false, 15 s, positions up to 60 s old).
   3. If that times out or is unavailable, try once more with high accuracy (20 s).
   4. After a successful fix, optionally refine with a fresh high-accuracy fix and keep it if it is better.
   Coordinates are validated; nothing is ever substituted when the browser does not return a position. */

export type GeoErrorKind = 'insecure' | 'unsupported' | 'denied' | 'timeout' | 'unavailable' | 'invalid'

export interface GeoFix {
  lat: number
  lng: number
  accuracy: number // metres, as reported by the browser
  at: number
}

export class GeoError extends Error {
  kind: GeoErrorKind
  constructor(kind: GeoErrorKind, message: string) {
    super(message)
    this.kind = kind
  }
}

export const GEO_MESSAGES: Record<GeoErrorKind, string> = {
  insecure: '',
  unsupported: 'This browser cannot share your location. Tap the map to place the pin instead.',
  denied: 'Location permission is blocked for this site. Allow it from the site settings (the icon left of the address) and press “Use my location” again, or tap the map.',
  timeout: 'Your device took too long to find its position. Try again (Wi-Fi on helps indoors), or tap the map.',
  unavailable: 'Your device could not determine its position. Check that location services are switched on for your system and browser, or tap the map.',
  invalid: 'The browser returned an invalid position, so it was not used. Try again or tap the map.',
}

export function insecureMessage(): string {
  return `Location only works on secure pages. This page is ${location.origin}, which the browser treats as insecure. Open the app at https://… or on this computer at http://localhost:5173.`
}

/** Pre-flight check without prompting. Returns the permission state if the browser exposes it. */
export async function permissionState(): Promise<PermissionState | 'unknown'> {
  try {
    if (!navigator.permissions?.query) return 'unknown'
    const s = await navigator.permissions.query({ name: 'geolocation' as PermissionName })
    return s.state
  } catch {
    return 'unknown'
  }
}

function valid(c: GeolocationCoordinates): boolean {
  return Number.isFinite(c.latitude) && Number.isFinite(c.longitude) && Math.abs(c.latitude) <= 90 && Math.abs(c.longitude) <= 180
    && !(c.latitude === 0 && c.longitude === 0) && Number.isFinite(c.accuracy) && c.accuracy > 0
}

function once(opts: PositionOptions): Promise<GeoFix> {
  return new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(
      (p) => {
        if (!valid(p.coords)) { reject(new GeoError('invalid', GEO_MESSAGES.invalid)); return }
        resolve({ lat: +p.coords.latitude.toFixed(6), lng: +p.coords.longitude.toFixed(6), accuracy: Math.round(p.coords.accuracy), at: p.timestamp })
      },
      (e) => {
        const kind: GeoErrorKind = e.code === 1 ? 'denied' : e.code === 3 ? 'timeout' : 'unavailable'
        reject(new GeoError(kind, GEO_MESSAGES[kind]))
      },
      opts,
    )
  })
}

/** Get the device position. Throws GeoError with a specific kind; never returns made-up coordinates. */
export async function locate(): Promise<GeoFix> {
  if (!window.isSecureContext) throw new GeoError('insecure', insecureMessage())
  if (!('geolocation' in navigator) || !navigator.geolocation) throw new GeoError('unsupported', GEO_MESSAGES.unsupported)
  try {
    return await once({ enableHighAccuracy: false, timeout: 15000, maximumAge: 60000 })
  } catch (e) {
    if (e instanceof GeoError && (e.kind === 'timeout' || e.kind === 'unavailable')) {
      return await once({ enableHighAccuracy: true, timeout: 20000, maximumAge: 0 })
    }
    throw e
  }
}

/** Ask for a fresh high-accuracy fix; resolves null if it fails or is not better than `current`. */
export async function refine(current: GeoFix): Promise<GeoFix | null> {
  if (current.accuracy <= 50) return null
  try {
    const better = await once({ enableHighAccuracy: true, timeout: 15000, maximumAge: 0 })
    return better.accuracy < current.accuracy ? better : null
  } catch {
    return null
  }
}

export const fmtAccuracy = (m: number) => (m >= 1000 ? `±${(m / 1000).toFixed(1)} km` : `±${m} m`)
