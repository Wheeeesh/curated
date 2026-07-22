import { useEffect, useRef } from 'react'
import maplibregl from 'maplibre-gl'
import type { FeatureCollection, Point } from 'geojson'
import type { Place } from '../../lib/api/types'
import { primaryCategory } from '../../lib/api/types'
import type { MapView as MapViewState } from '../../lib/session'
import { CATEGORY_META } from '../../lib/format'
import { MAP_FONT, MAP_STYLE_URL } from '../../lib/mapStyle'

export interface MapPin extends Place {
  matchPct: number | null
  hasWarning: boolean
}

const categoryColorExpr = [
  'match',
  ['get', 'category'],
  ...Object.entries(CATEGORY_META).flatMap(([cat, meta]) => [cat, meta.color]),
  '#a89c85',
] as unknown as maplibregl.ExpressionSpecification

function toGeoJson(pins: MapPin[]): FeatureCollection {
  return {
    type: 'FeatureCollection',
    features: pins.map((p) => ({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [p.lng, p.lat] },
      properties: {
        id: p.id,
        category: primaryCategory(p),
        name: p.name,
        matchLabel: p.matchPct !== null && p.matchPct >= 80 ? String(p.matchPct) : '',
        highMatch: p.matchPct !== null && p.matchPct >= 80,
        hasWarning: p.hasWarning,
      },
    })),
  }
}

export function MapView({
  pins,
  initialView,
  flyTo,
  onPinTap,
  onMoveEnd,
  onMapReady,
}: {
  pins: MapPin[]
  initialView: MapViewState
  flyTo: (MapViewState & { nonce: number }) | null
  onPinTap: (placeId: string) => void
  onMoveEnd?: (v: MapViewState) => void
  onMapReady?: (map: maplibregl.Map) => void
}) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<maplibregl.Map | null>(null)
  const loadedRef = useRef(false)
  const pinsRef = useRef(pins)
  pinsRef.current = pins
  const onPinTapRef = useRef(onPinTap)
  onPinTapRef.current = onPinTap
  const onMoveEndRef = useRef(onMoveEnd)
  onMoveEndRef.current = onMoveEnd

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return
    const map = new maplibregl.Map({
      container: containerRef.current,
      style: MAP_STYLE_URL,
      center: [initialView.lng, initialView.lat],
      zoom: initialView.zoom,
      attributionControl: { compact: true },
    })
    mapRef.current = map
    if (import.meta.env.DEV) (window as unknown as { __map?: maplibregl.Map }).__map = map

    map.on('load', () => {
      loadedRef.current = true
      map.addSource('places', {
        type: 'geojson',
        data: toGeoJson(pinsRef.current),
        cluster: true,
        clusterRadius: 46,
        clusterMaxZoom: 15,
      })

      map.addLayer({
        id: 'clusters',
        type: 'circle',
        source: 'places',
        filter: ['has', 'point_count'],
        paint: {
          'circle-color': '#ffffff',
          'circle-radius': ['step', ['get', 'point_count'], 16, 8, 20, 20, 25],
          'circle-stroke-width': 1,
          'circle-stroke-color': 'rgba(60,60,67,0.18)',
        },
      })
      map.addLayer({
        id: 'cluster-count',
        type: 'symbol',
        source: 'places',
        filter: ['has', 'point_count'],
        layout: {
          'text-field': ['get', 'point_count_abbreviated'],
          'text-font': MAP_FONT,
          'text-size': 13,
        },
        paint: { 'text-color': '#1c1c1e' },
      })
      map.addLayer({
        id: 'pins',
        type: 'circle',
        source: 'places',
        filter: ['!', ['has', 'point_count']],
        paint: {
          'circle-color': categoryColorExpr,
          'circle-radius': ['case', ['get', 'highMatch'], 9, 7],
          // White halo keeps pins legible on the light basemap; a graphite
          // ring marks a strong personal match, red marks a warning.
          'circle-stroke-width': ['case', ['get', 'hasWarning'], 2.5, ['get', 'highMatch'], 2.5, 2],
          'circle-stroke-color': [
            'case',
            ['get', 'hasWarning'], '#ff3b30',
            ['get', 'highMatch'], '#1c1c1e',
            '#ffffff',
          ],
        },
      })
      map.addLayer({
        id: 'pin-match',
        type: 'symbol',
        source: 'places',
        filter: ['all', ['!', ['has', 'point_count']], ['!=', ['get', 'matchLabel'], '']],
        layout: {
          'text-field': ['get', 'matchLabel'],
          'text-font': MAP_FONT,
          'text-size': 10,
          'text-offset': [0, -1.6],
          'text-allow-overlap': true,
        },
        paint: {
          'text-color': '#1c1c1e',
          'text-halo-color': '#ffffff',
          'text-halo-width': 1.5,
        },
      })
      map.addLayer({
        id: 'pin-labels',
        type: 'symbol',
        source: 'places',
        minzoom: 13.5,
        filter: ['!', ['has', 'point_count']],
        layout: {
          'text-field': ['get', 'name'],
          'text-font': MAP_FONT,
          'text-size': 11,
          'text-offset': [0, 1.3],
          'text-anchor': 'top',
          'text-optional': true,
        },
        paint: {
          'text-color': 'rgba(60,60,67,0.75)',
          'text-halo-color': '#ffffff',
          'text-halo-width': 1.5,
        },
      })

      map.on('click', 'clusters', async (e) => {
        const feature = e.features?.[0]
        if (!feature) return
        const source = map.getSource('places') as maplibregl.GeoJSONSource
        const zoom = await source.getClusterExpansionZoom(feature.properties!.cluster_id as number)
        map.easeTo({ center: (feature.geometry as Point).coordinates as [number, number], zoom })
      })
      map.on('click', 'pins', (e) => {
        const feature = e.features?.[0]
        if (feature) onPinTapRef.current(feature.properties!.id as string)
      })
      for (const layer of ['clusters', 'pins']) {
        map.on('mouseenter', layer, () => (map.getCanvas().style.cursor = 'pointer'))
        map.on('mouseleave', layer, () => (map.getCanvas().style.cursor = ''))
      }

      onMapReady?.(map)
    })

    map.on('moveend', () => {
      const c = map.getCenter()
      onMoveEndRef.current?.({ lat: c.lat, lng: c.lng, zoom: map.getZoom() })
    })

    // The container can be resized by layout changes the window never sees
    // (route transitions, HMR) — keep the canvas in sync.
    const ro = new ResizeObserver(() => map.resize())
    ro.observe(containerRef.current)

    return () => {
      ro.disconnect()
      map.remove()
      mapRef.current = null
      loadedRef.current = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Keep pins in sync
  useEffect(() => {
    const map = mapRef.current
    if (!map || !loadedRef.current) return
    const source = map.getSource('places') as maplibregl.GeoJSONSource | undefined
    source?.setData(toGeoJson(pins))
  }, [pins])

  // Fly wherever the app asks (search result, "near me", a new pin)
  useEffect(() => {
    const map = mapRef.current
    if (!map || !flyTo) return
    map.flyTo({ center: [flyTo.lng, flyTo.lat], zoom: flyTo.zoom, duration: 1400 })
  }, [flyTo])

  // Explicit sizing: maplibre-gl.css forces `position: relative` on the
  // container, which would collapse an inset-0 absolute box to zero height.
  return <div ref={containerRef} className="h-full w-full" />
}
