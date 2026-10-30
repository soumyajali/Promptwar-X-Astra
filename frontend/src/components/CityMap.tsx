/* Leaflet + OpenStreetMap. Markers are coloured by priority; hotspots drawn as dashed circles.
   If tiles fail to load (offline / blocked), markers still render on a plain background and a notice explains why. */
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { Circle, MapContainer, Marker, Popup, TileLayer, Tooltip, useMap, useMapEvents } from 'react-leaflet'
import { WifiOff } from 'lucide-react'
import type { Hotspot, Level, Status } from '../lib/types'
import { LEVEL_LABEL, STATUS_LABEL } from '../lib/format'

export interface MapPoint {
  id: string
  lat: number | null
  lng: number | null
  level: Level
  status: Status
  title: string
  subtitle?: string
  score?: number
}

const CENTER: [number, number] = [12.8705, 74.843]

const icons = new Map<string, L.DivIcon>()
function pinIcon(level: Level, closed: boolean, selected: boolean, isNew: boolean) {
  const key = `${level}${closed}${selected}${isNew}`
  if (!icons.has(key)) {
    const size = isNew ? 24 : level === 'critical' ? 20 : 16
    icons.set(key, L.divIcon({
      className: '',
      html: `<div class="map-pin map-pin--${level}${closed ? ' map-pin--closed' : ''}${selected ? ' map-pin--selected' : ''}${isNew ? ' map-pin--new' : ''}"></div>`,
      iconSize: [size, size], iconAnchor: [size / 2, size / 2],
    }))
  }
  return icons.get(key)!
}

function FitTo({ points, fitKey, zoom = 16 }: { points: [number, number][]; fitKey?: string; zoom?: number }) {
  const map = useMap()
  const done = useRef<string | undefined>(undefined)
  useEffect(() => {
    if (!points.length || done.current === fitKey) return
    done.current = fitKey
    if (points.length === 1) map.setView(points[0], zoom)
    else map.fitBounds(L.latLngBounds(points).pad(0.12), { maxZoom: 16 })
  }, [map, points, fitKey])
  return null
}

function FlyTo({ target }: { target?: [number, number] | null }) {
  const map = useMap()
  useEffect(() => { if (target) map.flyTo(target, Math.max(map.getZoom(), 16), { duration: .6 }) }, [map, target])
  return null
}

function ClickPicker({ onPick }: { onPick: (lat: number, lng: number) => void }) {
  useMapEvents({ click: (e) => onPick(e.latlng.lat, e.latlng.lng) })
  return null
}

function InvalidateOnResize() {
  const map = useMap()
  useEffect(() => {
    const ro = new ResizeObserver(() => map.invalidateSize())
    ro.observe(map.getContainer())
    return () => ro.disconnect()
  }, [map])
  return null
}

export function CityMap({
  points = [], hotspots = [], showHotspots = true, selectedId, onSelect, height = 420, pick, pickAccuracy, onPick,
  fitKey = 'default', newId, flyTo, scrollZoom = true, renderPopup,
}: {
  points?: MapPoint[]
  hotspots?: Hotspot[] | { id: string; lat: number; lng: number; radius_m: number; location: string; count: number }[]
  showHotspots?: boolean
  selectedId?: string | null
  onSelect?: (id: string) => void
  height?: number | string
  pick?: { lat: number; lng: number } | null
  /** Accuracy radius in metres for a device-detected pin; drawn as a circle and used to pick the zoom. */
  pickAccuracy?: number
  onPick?: (lat: number, lng: number) => void
  fitKey?: string
  newId?: string
  flyTo?: [number, number] | null
  scrollZoom?: boolean
  renderPopup?: (p: MapPoint) => ReactNode
}) {
  const [tileErrors, setTileErrors] = useState(0)
  const valid = useMemo(() => points.filter((p) => p.lat != null && p.lng != null), [points])
  const bounds = useMemo(() => valid.map((p) => [p.lat!, p.lng!] as [number, number]), [valid])

  return (
    <div className="citymap" style={{ height, position: 'relative', borderRadius: 'inherit' }}>
      <MapContainer center={CENTER} zoom={14} style={{ height: '100%', width: '100%' }} scrollWheelZoom={scrollZoom} attributionControl>
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          maxZoom={19}
          eventHandlers={{ tileerror: () => setTileErrors((n) => n + 1), tileload: () => setTileErrors(0) }}
        />
        <InvalidateOnResize />
        {!pick && bounds.length > 0 && <FitTo points={bounds} fitKey={fitKey} />}
        {pick && <FitTo points={[[pick.lat, pick.lng]]} fitKey={`pick-${fitKey}`}
          zoom={!pickAccuracy || pickAccuracy < 150 ? 17 : pickAccuracy < 600 ? 16 : pickAccuracy < 2500 ? 14 : 12} />}
        <FlyTo target={flyTo} />
        {onPick && <ClickPicker onPick={onPick} />}
        {showHotspots && hotspots.map((h) => (
          <Circle key={h.id} center={[h.lat, h.lng]} radius={Math.max(h.radius_m, 80) + 40}
            pathOptions={{ color: '#C8441A', weight: 1.5, dashArray: '5 5', fillColor: '#C8441A', fillOpacity: .08 }}>
            <Tooltip direction="top" permanent={false}>{h.id} · {h.location} · {h.count} reports</Tooltip>
          </Circle>
        ))}
        {valid.map((p) => {
          const closed = p.status === 'resolved' || p.status === 'rejected'
          return (
            <Marker key={p.id} position={[p.lat!, p.lng!]} icon={pinIcon(p.level, closed, p.id === selectedId, p.id === newId)}
              zIndexOffset={p.id === newId ? 1000 : p.level === 'critical' ? 500 : 0}
              eventHandlers={{ click: () => onSelect?.(p.id) }}
              keyboard title={`${p.id} ${p.title}`}>
              {!onSelect && (
                <Popup>
                  {renderPopup ? renderPopup(p) : (
                    <div>
                      <div className="id">{p.id}</div>
                      <strong>{p.title}</strong>
                      {p.subtitle && <div className="muted">{p.subtitle}</div>}
                      <div>{LEVEL_LABEL[p.level]}{p.score != null ? ` · ${p.score}` : ''} · {STATUS_LABEL[p.status]}</div>
                    </div>
                  )}
                </Popup>
              )}
            </Marker>
          )
        })}
        {pick && pickAccuracy && (
          <Circle center={[pick.lat, pick.lng]} radius={pickAccuracy} interactive={false}
            pathOptions={{ color: '#93C3A5', weight: 1.5, fillColor: '#93C3A5', fillOpacity: .12 }} />
        )}
        {pick && <Marker position={[pick.lat, pick.lng]} icon={pinIcon('critical', false, true, true)} />}
      </MapContainer>
      {tileErrors > 3 && (
        <div className="map-fallback notice notice--warn" role="status">
          <WifiOff /> Map tiles couldn't load (offline or blocked). Report markers are still shown at their exact coordinates.
        </div>
      )}
    </div>
  )
}
