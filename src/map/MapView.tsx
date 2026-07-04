import { useEffect, useRef } from 'react'
import maplibregl from 'maplibre-gl'
import type { Feature, FeatureCollection, LineString, Point } from 'geojson'
import type { StoredTrack, TelemetryDisplayMode, TrackPoint, TrackSector } from '../types/telemetry'
import { getDisplayPoints } from '../telemetry/display/points'

const initialCenter: [number, number] = [110.2266, -7.5154]
const routeSourceId = 'active-route-source'
const routeBaseLayerId = 'active-route-base-line'
const trackSourceId = 'active-track-source'
const trackLayerId = 'active-track-line'
const trackHoverLayerId = 'active-track-hover-line'
const eventSourceId = 'active-track-events-source'
const eventCircleLayerId = 'active-track-events-circle'
const eventLabelLayerId = 'active-track-events-label'
const sectorHighlightSourceId = 'active-sector-highlight-source'
const sectorHighlightLayerId = 'active-sector-highlight-line'
const selectedPointSourceId = 'selected-point-source'
const selectedPointLayerId = 'selected-point-circle'

type PoiMarker = {
  id: string
  kind: 'top-speed' | 'traffic-stop' | 'pause'
  icon: string
  label: string
  color: string
  lon: number
  lat: number
}

function formatCompactDuration(durationS: number) {
  const seconds = Math.max(0, Math.round(durationS))
  if (seconds < 60) return `${seconds}s`

  const minutes = Math.floor(seconds / 60)
  const remainingSeconds = seconds % 60
  return `${minutes}m${remainingSeconds}s`
}

function toSpeedSegments(track: StoredTrack, points: TrackPoint[]): FeatureCollection<LineString> {
  const features: Feature<LineString>[] = []

  for (let i = 1; i < points.length; i++) {
    const previous = points[i - 1]
    const current = points[i]

    features.push({
      type: 'Feature',
      properties: {
        id: `${track.id}-${i}`,
        previousPointIndex: i - 1,
        currentPointIndex: i,
        previousPointId: previous.id,
        currentPointId: current.id,
        speedKmh: current.cleanedSpeedKmh ?? current.speedKmh ?? 0,
        isAnomaly: current.isAnomaly ?? false,
      },
      geometry: {
        type: 'LineString',
        coordinates: [
          [previous.lon, previous.lat],
          [current.lon, current.lat],
        ],
      },
    })
  }

  return { type: 'FeatureCollection', features }
}

function toRouteLine(track: StoredTrack, points: TrackPoint[]): FeatureCollection<LineString> {
  return {
    type: 'FeatureCollection',
    features: [
      {
        type: 'Feature',
        properties: { id: track.id },
        geometry: {
          type: 'LineString',
          coordinates: points.map((point) => [point.lon, point.lat]),
        },
      },
    ],
  }
}

function toSectorHighlightLine(points: TrackPoint[], sector?: TrackSector | null): FeatureCollection<LineString> {
  if (!sector) return { type: 'FeatureCollection', features: [] }

  const coordinates = points
    .filter((point) => {
      const distanceKm = (point.distanceM ?? 0) / 1000
      return distanceKm >= sector.startDistanceKm && distanceKm <= sector.endDistanceKm
    })
    .map((point) => [point.lon, point.lat])

  if (coordinates.length < 2) return { type: 'FeatureCollection', features: [] }

  return {
    type: 'FeatureCollection',
    features: [
      {
        type: 'Feature',
        properties: { id: sector.id },
        geometry: {
          type: 'LineString',
          coordinates,
        },
      },
    ],
  }
}

function toSelectedPoint(point?: TrackPoint): FeatureCollection<Point> {
  if (!point) return { type: 'FeatureCollection', features: [] }

  return {
    type: 'FeatureCollection',
    features: [
      {
        type: 'Feature',
        properties: { id: point.id },
        geometry: { type: 'Point', coordinates: [point.lon, point.lat] },
      },
    ],
  }
}

function toEventCollection(track: StoredTrack, points: TrackPoint[]): FeatureCollection<Point> {
  const events: Feature<Point>[] = []
  const first = points[0]
  const last = points[points.length - 1]
  const topSpeedPoint = points.reduce(
    (best, point) =>
      (point.cleanedSpeedKmh ?? point.speedKmh ?? 0) > (best.cleanedSpeedKmh ?? best.speedKmh ?? 0) ? point : best,
    first,
  )

  if (first) {
    events.push({
      type: 'Feature',
      properties: { kind: 'start', label: 'Start', color: '#22c55e', pointId: first.id },
      geometry: { type: 'Point', coordinates: [first.lon, first.lat] },
    })
  }

  if (last) {
    events.push({
      type: 'Feature',
      properties: { kind: 'finish', label: 'Finish', color: '#38bdf8', pointId: last.id },
      geometry: { type: 'Point', coordinates: [last.lon, last.lat] },
    })
  }

  if (topSpeedPoint) {
    events.push({
      type: 'Feature',
      properties: {
        kind: 'top-speed',
        label: `${Math.round(topSpeedPoint.cleanedSpeedKmh ?? topSpeedPoint.speedKmh ?? 0)} km/h`,
        color: '#f59e0b',
        pointId: topSpeedPoint.id,
      },
      geometry: { type: 'Point', coordinates: [topSpeedPoint.lon, topSpeedPoint.lat] },
    })
  }

  points
    .filter((point) => point.isAnomaly)
    .slice(0, 80)
    .forEach((point) => {
      events.push({
        type: 'Feature',
        properties: { kind: 'gps-jump', label: point.anomalyReason || 'Anomaly', color: '#ef4444', pointId: point.id },
        geometry: { type: 'Point', coordinates: [point.lon, point.lat] },
      })
    })

  track.events?.forEach((event) => {
    const isPause = event.kind === 'pause'
    events.push({
      type: 'Feature',
      properties: {
        kind: event.kind,
        label: formatCompactDuration(event.durationS),
        color: isPause ? '#a855f7' : '#f97316',
      },
      geometry: { type: 'Point', coordinates: [event.lon, event.lat] },
    })
  })

  return { type: 'FeatureCollection', features: events }
}

function toPoiMarkers(track: StoredTrack, points: TrackPoint[]): PoiMarker[] {
  const first = points[0]
  const topSpeedPoint = first
    ? points.reduce(
        (best, point) =>
          (point.cleanedSpeedKmh ?? point.speedKmh ?? 0) > (best.cleanedSpeedKmh ?? best.speedKmh ?? 0) ? point : best,
        first,
      )
    : undefined
  const markers: PoiMarker[] = []

  if (topSpeedPoint) {
    markers.push({
      id: `${track.id}-top-speed`,
      kind: 'top-speed',
      icon: '🏁',
      label: `${(topSpeedPoint.cleanedSpeedKmh ?? topSpeedPoint.speedKmh ?? 0).toFixed(1)} km/h`,
      color: '#f59e0b',
      lon: topSpeedPoint.lon,
      lat: topSpeedPoint.lat,
    })
  }

  track.events?.forEach((event) => {
    const isPause = event.kind === 'pause'
    markers.push({
      id: event.id,
      kind: event.kind,
      icon: isPause ? '⏱' : '🚦',
      label: formatCompactDuration(event.durationS),
      color: isPause ? '#a855f7' : '#f97316',
      lon: event.lon,
      lat: event.lat,
    })
  })

  return markers
}

function createPoiMarkerElement(marker: PoiMarker) {
  const element = document.createElement('div')
  element.className = `poi-marker ${marker.kind}`
  element.style.setProperty('--poi-color', marker.color)
  element.innerHTML = `<span class="poi-icon">${marker.icon}</span><span class="poi-label">${marker.label}</span>`
  return element
}

type MapViewProps = {
  track?: StoredTrack
  highlightedSector?: TrackSector | null
  displayMode?: TelemetryDisplayMode
  selectedPointId?: string | null
  onSelectPoint?: (pointId: string) => void
}

export function MapView({
  track,
  highlightedSector,
  displayMode = 'cleaned',
  selectedPointId,
  onSelectPoint,
}: MapViewProps) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const mapRef = useRef<maplibregl.Map | null>(null)
  const poiMarkersRef = useRef<maplibregl.Marker[]>([])
  const displayPointsRef = useRef<TrackPoint[]>([])
  const onSelectPointRef = useRef(onSelectPoint)
  const hoverHandlersReadyRef = useRef(false)

  useEffect(() => {
    onSelectPointRef.current = onSelectPoint
  }, [onSelectPoint])

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return

    mapRef.current = new maplibregl.Map({
      container: containerRef.current,
      style: 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json',
      center: initialCenter,
      zoom: 10,
      attributionControl: false,
    })

    mapRef.current.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), 'top-right')
    mapRef.current.addControl(new maplibregl.AttributionControl({ compact: true }), 'bottom-right')

    return () => {
      poiMarkersRef.current.forEach((marker) => marker.remove())
      poiMarkersRef.current = []
      mapRef.current?.remove()
      mapRef.current = null
    }
  }, [])

  useEffect(() => {
    const map = mapRef.current
    if (!map || !track) return
    const activeMap = map
    const activeTrack = track
    const displayPoints = getDisplayPoints(activeTrack, displayMode)
    displayPointsRef.current = displayPoints

    function ensureTrackHoverLayer() {
      if (!activeMap.getLayer(trackHoverLayerId)) {
        activeMap.addLayer({
          id: trackHoverLayerId,
          type: 'line',
          source: trackSourceId,
          layout: {
            'line-cap': 'round',
            'line-join': 'round',
          },
          paint: {
            'line-color': '#ffffff',
            'line-width': ['interpolate', ['linear'], ['zoom'], 5, 24, 10, 30, 14, 36],
            'line-opacity': 0.02,
          },
        })
      }

      if (hoverHandlersReadyRef.current) return

      activeMap.on('mousemove', trackHoverLayerId, (event) => {
        const feature = event.features?.[0]
        if (!feature) return

        const previousPointIndex = Number(feature.properties?.previousPointIndex)
        const currentPointIndex = Number(feature.properties?.currentPointIndex)
        const currentDisplayPoints = displayPointsRef.current
        const previousPoint = currentDisplayPoints[previousPointIndex]
        const currentPoint = currentDisplayPoints[currentPointIndex]
        if (!previousPoint || !currentPoint) return

        const previousPixel = activeMap.project([previousPoint.lon, previousPoint.lat])
        const currentPixel = activeMap.project([currentPoint.lon, currentPoint.lat])
        const previousDistance = Math.hypot(previousPixel.x - event.point.x, previousPixel.y - event.point.y)
        const currentDistance = Math.hypot(currentPixel.x - event.point.x, currentPixel.y - event.point.y)

        activeMap.getCanvas().style.cursor = 'crosshair'
        onSelectPointRef.current?.(previousDistance <= currentDistance ? previousPoint.id : currentPoint.id)
      })

      activeMap.on('mouseleave', trackHoverLayerId, () => {
        activeMap.getCanvas().style.cursor = ''
      })

      hoverHandlersReadyRef.current = true
    }

    function renderTrack() {
      const routeSource = activeMap.getSource(routeSourceId) as maplibregl.GeoJSONSource | undefined
      const routeData = toRouteLine(activeTrack, displayPoints)
      const source = activeMap.getSource(trackSourceId) as maplibregl.GeoJSONSource | undefined
      const data = toSpeedSegments(activeTrack, displayPoints)
      const eventsSource = activeMap.getSource(eventSourceId) as maplibregl.GeoJSONSource | undefined
      const eventsData = toEventCollection(activeTrack, displayPoints)
      const poiMarkers = toPoiMarkers(activeTrack, displayPoints)

      if (routeSource) {
        routeSource.setData(routeData)
      } else {
        activeMap.addSource(routeSourceId, {
          type: 'geojson',
          data: routeData,
          lineMetrics: true,
        })

        activeMap.addLayer({
          id: routeBaseLayerId,
          type: 'line',
          source: routeSourceId,
          layout: {
            'line-cap': 'round',
            'line-join': 'round',
          },
          paint: {
            'line-color': '#f8fafc',
            'line-width': ['interpolate', ['linear'], ['zoom'], 5, 3.5, 8, 5, 14, 7],
            'line-opacity': ['interpolate', ['linear'], ['zoom'], 5, 0.72, 9, 0.44, 14, 0.28],
          },
        })

      }

      if (source) {
        source.setData(data)
      } else {
        activeMap.addSource(trackSourceId, {
          type: 'geojson',
          data,
        })

        activeMap.addLayer({
          id: trackLayerId,
          type: 'line',
          source: trackSourceId,
          layout: {
            'line-cap': 'round',
            'line-join': 'round',
          },
          paint: {
            'line-color': [
              'interpolate',
              ['linear'],
              ['get', 'speedKmh'],
              0,
              '#ef4444',
              30,
              '#f97316',
              60,
              '#facc15',
              90,
              '#22c55e',
              120,
              '#38bdf8',
            ],
            'line-width': ['interpolate', ['linear'], ['zoom'], 5, 2.6, 8, 3.2, 14, 5],
            'line-opacity': ['interpolate', ['linear'], ['zoom'], 5, 0.98, 10, 0.92],
          },
        })
      }

      ensureTrackHoverLayer()

      if (eventsSource) {
        eventsSource.setData(eventsData)
      } else {
        activeMap.addSource(eventSourceId, {
          type: 'geojson',
          data: eventsData,
        })

        activeMap.addLayer({
          id: eventCircleLayerId,
          type: 'circle',
          source: eventSourceId,
          paint: {
            'circle-color': ['get', 'color'],
            'circle-radius': ['case', ['==', ['get', 'kind'], 'gps-jump'], 4, 5],
            'circle-stroke-color': '#0c0f12',
            'circle-stroke-width': 2,
            'circle-opacity': ['case', ['==', ['get', 'kind'], 'gps-jump'], 0.95, 0.35],
          },
        })

        activeMap.addLayer({
          id: eventLabelLayerId,
          type: 'symbol',
          source: eventSourceId,
          filter: [
            'any',
            ['==', ['get', 'kind'], 'start'],
            ['==', ['get', 'kind'], 'finish'],
          ],
          layout: {
            'text-field': ['get', 'label'],
            'text-size': 12,
            'text-offset': [0, 2],
            'text-anchor': 'top',
          },
          paint: {
            'text-color': '#f5f7fa',
            'text-halo-color': '#0c0f12',
            'text-halo-width': 2,
          },
        })

        activeMap.on('click', eventCircleLayerId, (event) => {
          const pointId = event.features?.[0]?.properties?.pointId
          if (typeof pointId === 'string') onSelectPoint?.(pointId)
        })

        activeMap.on('mouseenter', eventCircleLayerId, () => {
          activeMap.getCanvas().style.cursor = 'pointer'
        })

        activeMap.on('mouseleave', eventCircleLayerId, () => {
          activeMap.getCanvas().style.cursor = ''
        })
      }

      poiMarkersRef.current.forEach((marker) => marker.remove())
      poiMarkersRef.current = poiMarkers.map((poiMarker) =>
        new maplibregl.Marker({ element: createPoiMarkerElement(poiMarker), anchor: 'bottom' })
          .setLngLat([poiMarker.lon, poiMarker.lat])
          .addTo(activeMap),
      )

      const bounds = new maplibregl.LngLatBounds()
      displayPoints.forEach((point) => bounds.extend([point.lon, point.lat]))
      if (!bounds.isEmpty()) {
        activeMap.fitBounds(bounds, { padding: 70, duration: 500 })
      }
    }

    if (activeMap.isStyleLoaded()) {
      renderTrack()
    } else {
      activeMap.once('load', renderTrack)
    }
  }, [track, displayMode, onSelectPoint])

  useEffect(() => {
    const map = mapRef.current
    if (!map || !track) return
    const activeMap = map
    const selectedPoint = selectedPointId
      ? getDisplayPoints(track, displayMode).find((point) => point.id === selectedPointId)
      : undefined

    function renderSelectedPoint() {
      const source = activeMap.getSource(selectedPointSourceId) as maplibregl.GeoJSONSource | undefined
      const data = toSelectedPoint(selectedPoint)

      if (source) {
        source.setData(data)
        return
      }

      activeMap.addSource(selectedPointSourceId, {
        type: 'geojson',
        data,
      })

      activeMap.addLayer({
        id: selectedPointLayerId,
        type: 'circle',
        source: selectedPointSourceId,
        paint: {
          'circle-color': '#ffffff',
          'circle-radius': ['interpolate', ['linear'], ['zoom'], 5, 7, 10, 10, 14, 14],
          'circle-stroke-color': '#ef4444',
          'circle-stroke-width': 4,
          'circle-opacity': 0.96,
        },
      })
    }

    if (activeMap.isStyleLoaded()) {
      renderSelectedPoint()
    } else {
      activeMap.once('load', renderSelectedPoint)
    }
  }, [track, displayMode, selectedPointId])

  useEffect(() => {
    const map = mapRef.current
    if (!map || !track) return
    const activeMap = map
    const activeTrack = track
    const displayPoints = getDisplayPoints(activeTrack, displayMode)

    function renderSectorHighlight() {
      const source = activeMap.getSource(sectorHighlightSourceId) as maplibregl.GeoJSONSource | undefined
      const data = toSectorHighlightLine(displayPoints, highlightedSector)

      if (source) {
        source.setData(data)
        return
      }

      activeMap.addSource(sectorHighlightSourceId, {
        type: 'geojson',
        data,
      })

      activeMap.addLayer({
        id: sectorHighlightLayerId,
        type: 'line',
        source: sectorHighlightSourceId,
        layout: {
          'line-cap': 'round',
          'line-join': 'round',
        },
        paint: {
          'line-color': '#c084fc',
          'line-width': ['interpolate', ['linear'], ['zoom'], 5, 7, 10, 9, 14, 12],
          'line-opacity': 0.92,
          'line-blur': 0.4,
        },
      })
    }

    if (activeMap.isStyleLoaded()) {
      renderSectorHighlight()
    } else {
      activeMap.once('load', renderSectorHighlight)
    }
  }, [track, highlightedSector, displayMode])

  return (
    <div className="map-view" ref={containerRef}>
      <div className="map-overlay top-left">
        <strong>{track ? track.name : 'No active track'}</strong>
        <span>
          {track
            ? `${getDisplayPoints(track, displayMode).length.toLocaleString()} ${displayMode} points rendered as speed-colored segments.`
            : 'Import a GPX file to render reconstructed telemetry.'}
        </span>
      </div>
      {track ? (
        <div className="map-overlay speed-legend">
          <strong>Speed (km/h)</strong>
          <div className="speed-ramp" />
          <div className="speed-labels">
            <span>0</span>
            <span>30</span>
            <span>60</span>
            <span>90</span>
            <span>120+</span>
          </div>
        </div>
      ) : null}
    </div>
  )
}
