import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react'
import { proxy } from 'comlink'
import { Activity, Bike, Cpu, Database, Flag, FolderOpen, Gauge, Radar, SlidersHorizontal } from 'lucide-react'
import { useAppStore } from '../state/useAppStore'
import { processGpxTrack } from '../telemetry/pipeline/processTrack'
import type { TrackProcessingProgress } from '../telemetry/pipeline/processTrack'
import { createTelemetryWorker, type TelemetryWorkerClient } from '../telemetry/worker/client'
import { getDisplayPoints } from '../telemetry/display/points'
import { clearTracks, deleteTrack, saveTrack } from '../storage/tracksRepository'
import { useTracks } from '../storage/useTracks'
import { defaultMotorcycleProfile, defaultMotorcycleProfiles } from '../motorcycles/defaultProfiles'
import { buildDistanceSectors, sectorDistanceOptionsKm } from '../telemetry/analysis/sectors'
import type { SectorDistanceKm } from '../telemetry/analysis/sectors'
import type { StoredTrack, TelemetryDisplayMode, TrackPoint, TrackSector } from '../types/telemetry'

const MapView = lazy(() => import('../map/MapView').then((module) => ({ default: module.MapView })))

function formatDistance(distanceKm?: number) {
  return distanceKm === undefined ? 'n/a' : `${distanceKm.toFixed(1)} km`
}

function formatSpeed(speedKmh?: number) {
  return speedKmh === undefined ? 'n/a' : `${speedKmh.toFixed(1)} km/h`
}

function formatSampling(samplingHz?: number) {
  return samplingHz === undefined ? 'n/a' : `${samplingHz.toFixed(2)} Hz`
}

function formatInterval(intervalS?: number) {
  return intervalS === undefined ? 'n/a' : `${intervalS.toFixed(1)} s`
}

function formatDuration(durationS?: number) {
  if (durationS === undefined) return 'n/a'
  const seconds = Math.max(0, Math.round(durationS))
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const remainingSeconds = seconds % 60
  return `${hours}h ${minutes}m ${remainingSeconds}s`
}

function formatElevation(elevationM?: number) {
  return elevationM === undefined ? 'n/a' : `${elevationM.toFixed(1)} m`
}

function formatSignedG(value?: number, sign: 'positive' | 'negative' = 'positive') {
  if (value === undefined) return 'n/a'
  const prefix = value < 0 ? '-' : value > 0 ? '+' : sign === 'negative' ? '-' : ''
  return `${prefix}${Math.abs(value).toFixed(2)}g`
}

function formatTrackTime(value?: string) {
  if (!value) return 'n/a'

  return new Date(value).toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
    timeZone: 'Asia/Jakarta',
    timeZoneName: 'shortOffset',
  })
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' })
}

function formatPercent(value?: number) {
  return value === undefined ? 'n/a' : `${value.toFixed(1)}%`
}

function formatCount(value?: number) {
  return value === undefined ? 'n/a' : value.toLocaleString()
}

function pointSpeedKmh(point?: { cleanedSpeedKmh?: number; speedKmh?: number; rawSpeedKmh?: number }) {
  if (!point) return undefined
  return point.cleanedSpeedKmh ?? point.speedKmh ?? point.rawSpeedKmh ?? 0
}

type DockMode = 'metrics' | 'speed' | 'elevation' | 'accel' | 'lateral' | 'confidence'

function buildChartPath(values: Array<{ x: number; y: number }>, width: number, height: number) {
  if (values.length < 2) return ''
  const maxX = Math.max(...values.map((value) => value.x)) || 1
  const minY = Math.min(...values.map((value) => value.y))
  const maxY = Math.max(...values.map((value) => value.y))
  const yRange = maxY - minY || 1

  return values
    .map((value, index) => {
      const x = (value.x / maxX) * width
      const y = height - ((value.y - minY) / yRange) * height
      return `${index === 0 ? 'M' : 'L'} ${x.toFixed(2)} ${y.toFixed(2)}`
    })
    .join(' ')
}

function buildPointAudit(track: StoredTrack, displayMode: TelemetryDisplayMode, point: TrackPoint, displayPoints: TrackPoint[]) {
  const pointIndex = displayPoints.findIndex((candidate) => candidate.id === point.id)
  const anchorIndex = point.sourcePointIndexStart ?? pointIndex
  const sourcePoint = track.points[anchorIndex]
  const nextSourcePoint = track.points[point.sourcePointIndexEnd ?? anchorIndex + 1]
  const previousDisplayPoint = pointIndex > 0 ? displayPoints[pointIndex - 1] : undefined
  const nextDisplayPoint = pointIndex + 1 < displayPoints.length ? displayPoints[pointIndex + 1] : undefined
  const sourceIntervalS = sourcePoint && nextSourcePoint ? (Date.parse(nextSourcePoint.time) - Date.parse(sourcePoint.time)) / 1000 : undefined
  const nearbyAnomaly = [sourcePoint, nextSourcePoint, previousDisplayPoint, point, nextDisplayPoint].some(
    (candidate) => candidate?.isAnomaly,
  )

  return {
    id: point.id,
    speedKmh: pointSpeedKmh(point),
    mode: displayMode,
    time: point.time,
    distanceKm: point.distanceM === undefined ? undefined : point.distanceM / 1000,
    origin: point.origin,
    confidence: point.confidence,
    sourcePointIndexStart: anchorIndex,
    sourcePointIndexEnd: point.sourcePointIndexEnd ?? anchorIndex,
    sourceIntervalS,
    rawSpeedAtSource: sourcePoint?.rawSpeedKmh ?? sourcePoint?.speedKmh,
    cleanedSpeedAtSource: sourcePoint?.cleanedSpeedKmh ?? sourcePoint?.speedKmh,
    accelBeforeG: previousDisplayPoint?.accelerationG,
    accelAfterG: nextDisplayPoint?.accelerationG,
    accelerationG: point.accelerationG,
    lateralG: point.lateralG,
    headingDeg: point.headingDeg,
    curvature: point.curvature,
    nearbyAnomaly,
    anomalyReason: point.anomalyReason || sourcePoint?.anomalyReason || nextSourcePoint?.anomalyReason,
    speedAudit: [
      ...new Set([
        ...(point.speedAudit ?? []),
        ...(point.physicsAudit ?? []),
        ...(sourcePoint?.speedAudit ?? []),
        ...(sourcePoint?.physicsAudit ?? []),
      ]),
    ],
  }
}

function App() {
  const inputRef = useRef<HTMLInputElement | null>(null)
  const telemetryWorkerRef = useRef<TelemetryWorkerClient | null>(null)
  const [refreshKey, setRefreshKey] = useState(0)
  const [status, setStatus] = useState('Ready')
  const [highlightedSector, setHighlightedSector] = useState<TrackSector | null>(null)
  const [selectedPointId, setSelectedPointId] = useState<string | null>(null)
  const [dockMode, setDockMode] = useState<DockMode>('metrics')
  const { tracks, isLoading } = useTracks(refreshKey)
  const activeTrackId = useAppStore((state) => state.activeTrackId)
  const setActiveTrackId = useAppStore((state) => state.setActiveTrackId)
  const activeMotorcycleId = useAppStore((state) => state.activeMotorcycleId)
  const setActiveMotorcycleId = useAppStore((state) => state.setActiveMotorcycleId)
  const sectorDistanceKm = useAppStore((state) => state.sectorDistanceKm)
  const setSectorDistanceKm = useAppStore((state) => state.setSectorDistanceKm)
  const telemetryDisplayMode = useAppStore((state) => state.telemetryDisplayMode)
  const setTelemetryDisplayMode = useAppStore((state) => state.setTelemetryDisplayMode)
  const activeTrack = tracks.find((track) => track.id === activeTrackId) ?? tracks[0]
  const activeMotorcycle =
    defaultMotorcycleProfiles.find((motorcycle) => motorcycle.id === activeMotorcycleId) ?? defaultMotorcycleProfile
  const sectors = useMemo(
    () => (activeTrack ? buildDistanceSectors(activeTrack, sectorDistanceKm) : []),
    [activeTrack, sectorDistanceKm],
  )
  const reconstructionAudit = useMemo(() => {
    const reconstruction = activeTrack?.reconstruction
    if (!activeTrack || !reconstruction) return undefined

    const confidenceValues = reconstruction.points
      .map((point) => point.confidence)
      .filter((confidence): confidence is number => confidence !== undefined)
    const lowConfidenceSamples = confidenceValues.filter((confidence) => confidence < 0.5).length
    const averageConfidence = confidenceValues.length
      ? confidenceValues.reduce((total, confidence) => total + confidence, 0) / confidenceValues.length
      : undefined
    const rawAnchorSamples = Math.min(activeTrack.points.length, reconstruction.points.length)
    const syntheticSamples = Math.max(0, reconstruction.points.length - rawAnchorSamples)

    return {
      rawPointCount: activeTrack.points.length,
      reconstructedPointCount: reconstruction.points.length,
      rawAnchorSamples,
      syntheticSamples,
      sampleRateHz: reconstruction.sampleRateHz,
      method: reconstruction.method,
      averageConfidence,
      lowConfidenceSamples,
      syntheticRatio: reconstruction.points.length ? (syntheticSamples / reconstruction.points.length) * 100 : undefined,
    }
  }, [activeTrack])
  const topSpeedAudit = useMemo(() => {
    if (!activeTrack) return undefined

    const displayPoints = getDisplayPoints(activeTrack, telemetryDisplayMode)
    if (!displayPoints.length) return undefined

    const topSpeedPoint = displayPoints.reduce((best, point) =>
      (pointSpeedKmh(point) ?? 0) > (pointSpeedKmh(best) ?? 0) ? point : best,
    )
    return buildPointAudit(activeTrack, telemetryDisplayMode, topSpeedPoint, displayPoints)
  }, [activeTrack, telemetryDisplayMode])
  const anomalyCandidates = useMemo(() => {
    if (!activeTrack) return []

    return getDisplayPoints(activeTrack, telemetryDisplayMode)
      .filter(
        (point) =>
          point.isAnomaly ||
          point.speedAudit?.some((reason) => reason.startsWith('motorcycle-') || reason.startsWith('physics-')),
      )
      .slice(0, 60)
  }, [activeTrack, telemetryDisplayMode])
  const selectedPointAudit = useMemo(() => {
    if (!activeTrack || !selectedPointId) return undefined
    const displayPoints = getDisplayPoints(activeTrack, telemetryDisplayMode)
    const selectedPoint = displayPoints.find((point) => point.id === selectedPointId)
    if (!selectedPoint) return undefined

    return buildPointAudit(activeTrack, telemetryDisplayMode, selectedPoint, displayPoints)
  }, [activeTrack, selectedPointId, telemetryDisplayMode])

  useEffect(() => {
    if (!activeTrack || !selectedPointId) return
    if (getDisplayPoints(activeTrack, telemetryDisplayMode).some((point) => point.id === selectedPointId)) return
    setSelectedPointId(null)
  }, [activeTrack, selectedPointId, telemetryDisplayMode])

  useEffect(
    () => () => {
      telemetryWorkerRef.current?.terminate()
      telemetryWorkerRef.current = null
    },
    [],
  )

  async function processTrackInWorker(fileName: string, gpxText: string, onProgress: (progress: TrackProcessingProgress) => void) {
    telemetryWorkerRef.current ??= createTelemetryWorker()
    return telemetryWorkerRef.current.api.processGpxTrack(
      { fileName, gpxText, motorcycle: activeMotorcycle },
      proxy(onProgress),
    )
  }
  const finalAnomalyEntries = useMemo(() => {
    if (!activeTrack?.quality.finalAnomalyCounts) return []

    return Object.entries(activeTrack.quality.finalAnomalyCounts)
      .filter(([, count]) => count > 0)
      .sort(([, a], [, b]) => b - a)
  }, [activeTrack])
  const processingAdjustmentEntries = useMemo(() => {
    if (!activeTrack?.quality.processingAdjustmentCounts) return []

    return Object.entries(activeTrack.quality.processingAdjustmentCounts)
      .filter(([, count]) => count > 0)
      .sort(([, a], [, b]) => b - a)
  }, [activeTrack])

  const metrics = useMemo(
    () => [
      { label: 'Tracks', value: String(tracks.length), hint: 'local library' },
      { label: 'Distance', value: formatDistance(activeTrack?.summary?.distanceKm), hint: 'derived from GPX' },
      { label: 'Top Speed', value: formatSpeed(activeTrack?.summary?.topSpeedKmh), hint: 'cleaned estimate' },
      { label: 'GPS Noise', value: activeTrack?.quality.gpsNoise ?? 'n/a', hint: 'quality audit' },
    ],
    [activeTrack, tracks.length],
  )
  const chartData = useMemo(() => {
    if (!activeTrack || dockMode === 'metrics') return undefined

    const displayPoints = getDisplayPoints(activeTrack, telemetryDisplayMode)
    const values = displayPoints
      .map((point) => {
        const distanceKm = (point.distanceM ?? 0) / 1000
        const y =
          dockMode === 'speed'
            ? pointSpeedKmh(point)
            : dockMode === 'elevation'
              ? point.ele
              : dockMode === 'accel'
                ? point.accelerationG
                : dockMode === 'lateral'
                  ? point.lateralG
                  : point.confidence === undefined
                    ? undefined
                    : point.confidence * 100

        return y === undefined ? undefined : { id: point.id, x: distanceKm, y }
      })
      .filter((value): value is { id: string; x: number; y: number } => value !== undefined)

    if (values.length < 2) return undefined

    const label =
      dockMode === 'speed'
        ? 'Speed'
        : dockMode === 'elevation'
          ? 'Elevation'
          : dockMode === 'accel'
            ? 'Accel / Brake G'
            : dockMode === 'lateral'
              ? 'Lateral G'
              : 'Confidence'
    const unit =
      dockMode === 'speed'
        ? 'km/h'
        : dockMode === 'elevation'
          ? 'm'
          : dockMode === 'accel' || dockMode === 'lateral'
            ? 'g'
            : '%'
    const stroke =
      dockMode === 'speed'
        ? '#38bdf8'
        : dockMode === 'elevation'
          ? '#86efac'
          : dockMode === 'accel'
            ? '#f97316'
            : dockMode === 'lateral'
              ? '#a855f7'
              : '#facc15'
    const minY = Math.min(...values.map((value) => value.y))
    const maxY = Math.max(...values.map((value) => value.y))

    return {
      label,
      unit,
      stroke,
      minY,
      maxY,
      distanceKm: values.at(-1)?.x ?? 0,
      values,
      path: buildChartPath(values, 640, 120),
      zeroY: minY < 0 && maxY > 0 ? 120 - ((0 - minY) / (maxY - minY || 1)) * 120 : undefined,
      selectedX:
        selectedPointId === null
          ? undefined
          : values.find((value) => value.id === selectedPointId)?.x === undefined
            ? undefined
            : ((values.find((value) => value.id === selectedPointId)?.x ?? 0) / (values.at(-1)?.x || 1)) * 640,
      anomalyMarkers: displayPoints
        .filter((point) => point.isAnomaly && point.distanceM !== undefined)
        .slice(0, 80)
        .map((point) => ({ x: (((point.distanceM ?? 0) / 1000) / (values.at(-1)?.x || 1)) * 640 })),
    }
  }, [activeTrack, dockMode, selectedPointId, telemetryDisplayMode])

  function selectNearestChartPoint(clientX: number, bounds: DOMRect) {
    if (!chartData?.values.length) return
    const ratio = Math.min(1, Math.max(0, (clientX - bounds.left) / bounds.width))
    const targetDistanceKm = ratio * chartData.distanceKm
    const nearest = chartData.values.reduce((best, value) =>
      Math.abs(value.x - targetDistanceKm) < Math.abs(best.x - targetDistanceKm) ? value : best,
    )
    setSelectedPointId(nearest.id)
  }

  async function handleImport(files: FileList | null) {
    const file = files?.[0]
    if (!file) return
    try {
      if (!file.name.toLowerCase().endsWith('.gpx')) {
        setStatus('Only GPX files are supported')
        return
      }

      setStatus('Importing GPX')
      const text = await file.text()
      let track: StoredTrack

      try {
        setStatus('Processing GPX in worker')
        track = await processTrackInWorker(file.name, text, (progress) => {
          setStatus(`${progress.label} · ${progress.step}/${progress.total}`)
        })
      } catch (workerError) {
        console.warn('Telemetry worker failed; falling back to main-thread processing.', workerError)
        telemetryWorkerRef.current?.terminate()
        telemetryWorkerRef.current = null
        setStatus('Worker unavailable, processing locally')
        track = processGpxTrack(file.name, text, undefined, activeMotorcycle, (progress) => {
          setStatus(`${progress.label} · ${progress.step}/${progress.total}`)
        })
      }

      setStatus('Saving locally')
      track.rawFile = file
      await saveTrack(track)
      setActiveTrackId(track.id)
      setRefreshKey((key) => key + 1)
      setStatus(`Imported ${track.name}`)
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Failed to import GPX')
    } finally {
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  async function handleDeleteTrack(trackId: string) {
    await deleteTrack(trackId)
    if (trackId === activeTrack?.id) setActiveTrackId(null)
    setRefreshKey((key) => key + 1)
    setStatus('Track deleted')
  }

  async function handleClearTracks() {
    await clearTracks()
    setActiveTrackId(null)
    setRefreshKey((key) => key + 1)
    setStatus('Local track library cleared')
  }

  return (
    <main className="telemetrix-shell">
      <aside className="sidebar" aria-label="Telemetry controls">
        <div className="brand-block">
          <div className="brand-mark">T</div>
          <div>
            <p className="eyebrow">Local-first telemetry</p>
            <h1>Telemetrix</h1>
          </div>
        </div>

        <input
          ref={inputRef}
          className="file-input"
          type="file"
          accept=".gpx,application/gpx+xml"
          onChange={(event) => void handleImport(event.target.files)}
        />
        <button className="import-drop" type="button" onClick={() => inputRef.current?.click()}>
          <FolderOpen size={20} />
          <span>
            <strong>Import GPX</strong>
            <small>Raw files stay in this browser</small>
          </span>
        </button>

        <section className="panel-section">
          <div className="section-title">
            <Database size={16} />
            <span>Local Library</span>
            {tracks.length > 0 ? (
              <button className="section-action" type="button" onClick={() => void handleClearTracks()}>
                Clear
              </button>
            ) : null}
          </div>
          {isLoading ? <div className="empty-state">Loading local tracks...</div> : null}
          {!isLoading && tracks.length === 0 ? <div className="empty-state">No tracks imported yet.</div> : null}
          {!isLoading && tracks.length > 0 ? (
            <div className="track-list">
              {tracks.map((track) => (
                <div
                  className={track.id === activeTrack?.id ? 'track-item active' : 'track-item'}
                  key={track.id}
                  onClick={() => setActiveTrackId(track.id)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') setActiveTrackId(track.id)
                  }}
                >
                  <div className="track-copy">
                    <strong>{track.name}</strong>
                    <span>
                      {formatDistance(track.summary?.distanceKm)} · {track.points.length.toLocaleString()} pts ·{' '}
                      {formatDate(track.createdAt)}
                    </span>
                  </div>
                  <button
                    className="track-delete"
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation()
                      void handleDeleteTrack(track.id)
                    }}
                    aria-label={`Delete ${track.name}`}
                  >
                    Delete
                  </button>
                </div>
              ))}
            </div>
          ) : null}
        </section>

        <section className="panel-section">
          <div className="section-title">
            <Bike size={16} />
            <span>Motorcycle Profile</span>
          </div>
          <select
            className="control-select"
            value={activeMotorcycleId}
            onChange={(event) => setActiveMotorcycleId(event.target.value)}
          >
            {defaultMotorcycleProfiles.map((motorcycle) => (
              <option value={motorcycle.id} key={motorcycle.id}>
                {motorcycle.name}
              </option>
            ))}
          </select>
          <div className="quality-note">{activeMotorcycle.category}</div>
        </section>

        <section className="panel-section">
          <div className="section-title">
            <SlidersHorizontal size={16} />
            <span>Processing</span>
          </div>
          <select
            className="control-select"
            value={telemetryDisplayMode}
            onChange={(event) => setTelemetryDisplayMode(event.target.value as TelemetryDisplayMode)}
          >
            <option value="raw">Raw GPX</option>
            <option value="cleaned">Cleaned</option>
            <option value="reconstructed">Reconstructed 5 Hz</option>
          </select>
          <div className="setting-row">
            <span>Max Plausible</span>
            <strong>{activeMotorcycle.maxPlausibleSpeedKmh ?? 'n/a'} km/h</strong>
          </div>
          <div className="setting-row">
            <span>GPS Spike</span>
            <strong>{activeMotorcycle.gpsSpikeThresholdKmh ?? 'n/a'} km/h</strong>
          </div>
          <div className="setting-row">
            <span>Accel / Brake</span>
            <strong>{activeMotorcycle.maxAccelG ?? 'n/a'}g / {activeMotorcycle.maxBrakeG ?? 'n/a'}g</strong>
          </div>
          <div className="setting-row">
            <span>Corner Lat G</span>
            <strong>{activeMotorcycle.maxCornerLateralG ?? 'n/a'}g</strong>
          </div>
          <div className="setting-row">
            <span>Reconstructed Samples</span>
            <strong>{activeTrack?.reconstruction?.points.length.toLocaleString() ?? 'n/a'}</strong>
          </div>
        </section>

        <section className="panel-section">
          <div className="section-title">
            <Cpu size={16} />
            <span>Reconstruction Audit</span>
          </div>
          {reconstructionAudit ? (
            <>
              <div className="audit-grid reconstruction-grid">
                <div>
                  <span>Raw Anchors</span>
                  <strong>{reconstructionAudit.rawPointCount.toLocaleString()}</strong>
                </div>
                <div>
                  <span>Recon Samples</span>
                  <strong>{reconstructionAudit.reconstructedPointCount.toLocaleString()}</strong>
                </div>
                <div>
                  <span>Synthetic</span>
                  <strong>{reconstructionAudit.syntheticSamples.toLocaleString()}</strong>
                </div>
                <div>
                  <span>Synthetic Ratio</span>
                  <strong>{formatPercent(reconstructionAudit.syntheticRatio)}</strong>
                </div>
                <div>
                  <span>Sample Rate</span>
                  <strong>{reconstructionAudit.sampleRateHz.toFixed(1)} Hz</strong>
                </div>
                <div>
                  <span>Method</span>
                  <strong>{reconstructionAudit.method}</strong>
                </div>
                <div>
                  <span>Avg Confidence</span>
                  <strong>
                    {formatPercent(
                      reconstructionAudit.averageConfidence === undefined
                        ? undefined
                        : reconstructionAudit.averageConfidence * 100,
                    )}
                  </strong>
                </div>
                <div>
                  <span>Low Confidence</span>
                  <strong>{reconstructionAudit.lowConfidenceSamples.toLocaleString()}</strong>
                </div>
              </div>
              <div className="quality-note">
                Reconstruction uses distance v2 by default, with gap-aware confidence before physics-aware smoothing.
              </div>
            </>
          ) : (
            <div className="empty-state">Re-import a GPX file to generate reconstructed telemetry samples.</div>
          )}
        </section>

        <section className="panel-section">
          <div className="section-title">
            <Radar size={16} />
            <span>Point Inspector</span>
          </div>
          {activeTrack ? (
            <>
              {anomalyCandidates.length ? (
                <div className="point-picker-list">
                  {anomalyCandidates.map((point) => (
                    <button
                      className={`point-picker-item ${selectedPointId === point.id ? 'active' : ''}`}
                      key={point.id}
                      type="button"
                      onClick={() => setSelectedPointId(point.id)}
                    >
                      <span>{formatDistance((point.distanceM ?? 0) / 1000)}</span>
                      <strong>{formatSpeed(pointSpeedKmh(point))}</strong>
                      <small>{point.anomalyReason || point.speedAudit?.[0] || 'audit point'}</small>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="empty-state">No anomaly points in the active display mode.</div>
              )}
              {selectedPointAudit ? (
                <>
                  <div className="audit-grid reconstruction-grid">
                    <div>
                      <span>Speed</span>
                      <strong>{formatSpeed(selectedPointAudit.speedKmh)}</strong>
                    </div>
                    <div>
                      <span>Mode</span>
                      <strong>{selectedPointAudit.mode}</strong>
                    </div>
                    <div>
                      <span>Raw Source</span>
                      <strong>{formatSpeed(selectedPointAudit.rawSpeedAtSource)}</strong>
                    </div>
                    <div>
                      <span>Clean Source</span>
                      <strong>{formatSpeed(selectedPointAudit.cleanedSpeedAtSource)}</strong>
                    </div>
                    <div>
                      <span>Time</span>
                      <strong>{formatTrackTime(selectedPointAudit.time)}</strong>
                    </div>
                    <div>
                      <span>Distance</span>
                      <strong>{formatDistance(selectedPointAudit.distanceKm)}</strong>
                    </div>
                    <div>
                      <span>Confidence</span>
                      <strong>
                        {formatPercent(
                          selectedPointAudit.confidence === undefined ? undefined : selectedPointAudit.confidence * 100,
                        )}
                      </strong>
                    </div>
                    <div>
                      <span>Source Gap</span>
                      <strong>{formatInterval(selectedPointAudit.sourceIntervalS)}</strong>
                    </div>
                    <div>
                      <span>Accel / Brake G</span>
                      <strong>{formatSignedG(selectedPointAudit.accelerationG)}</strong>
                    </div>
                    <div>
                      <span>Lateral G</span>
                      <strong>
                        {selectedPointAudit.lateralG === undefined ? 'n/a' : `${selectedPointAudit.lateralG.toFixed(2)}g`}
                      </strong>
                    </div>
                    <div>
                      <span>Heading</span>
                      <strong>
                        {selectedPointAudit.headingDeg === undefined ? 'n/a' : `${selectedPointAudit.headingDeg.toFixed(0)} deg`}
                      </strong>
                    </div>
                    <div>
                      <span>Source Index</span>
                      <strong>{`${selectedPointAudit.sourcePointIndexStart}-${selectedPointAudit.sourcePointIndexEnd}`}</strong>
                    </div>
                  </div>
                  {selectedPointAudit.anomalyReason ? (
                    <div className="quality-note">Reason: {selectedPointAudit.anomalyReason}</div>
                  ) : null}
                  {selectedPointAudit.speedAudit.length ? (
                    <div className="speed-audit-group">
                      <span>Speed Audit</span>
                      <div className="speed-audit-list">
                        {selectedPointAudit.speedAudit.map((reason) => (
                          <div key={reason}>
                            <span>{reason}</span>
                            <strong>1</strong>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : null}
                </>
              ) : null}
            </>
          ) : (
            <div className="empty-state">Import a GPX file to inspect anomaly points.</div>
          )}
        </section>

        <section className="panel-section">
          <div className="section-title">
            <Gauge size={16} />
            <span>Top Speed Audit</span>
          </div>
          {topSpeedAudit ? (
            <>
              <div className="audit-grid reconstruction-grid">
                <div>
                  <span>Top Speed</span>
                  <strong>{formatSpeed(topSpeedAudit.speedKmh)}</strong>
                </div>
                <div>
                  <span>Display Mode</span>
                  <strong>{topSpeedAudit.mode}</strong>
                </div>
                <div>
                  <span>Raw at Source</span>
                  <strong>{formatSpeed(topSpeedAudit.rawSpeedAtSource)}</strong>
                </div>
                <div>
                  <span>Clean at Source</span>
                  <strong>{formatSpeed(topSpeedAudit.cleanedSpeedAtSource)}</strong>
                </div>
                <div>
                  <span>Time</span>
                  <strong>{formatTrackTime(topSpeedAudit.time)}</strong>
                </div>
                <div>
                  <span>Distance</span>
                  <strong>{formatDistance(topSpeedAudit.distanceKm)}</strong>
                </div>
                <div>
                  <span>Origin</span>
                  <strong>{topSpeedAudit.origin ?? 'n/a'}</strong>
                </div>
                <div>
                  <span>Confidence</span>
                  <strong>{formatPercent(topSpeedAudit.confidence === undefined ? undefined : topSpeedAudit.confidence * 100)}</strong>
                </div>
                <div>
                  <span>Source Gap</span>
                  <strong>{formatInterval(topSpeedAudit.sourceIntervalS)}</strong>
                </div>
                <div>
                  <span>Source Index</span>
                  <strong>
                    {topSpeedAudit.sourcePointIndexStart === undefined
                      ? 'n/a'
                      : `${topSpeedAudit.sourcePointIndexStart}-${topSpeedAudit.sourcePointIndexEnd ?? topSpeedAudit.sourcePointIndexStart}`}
                  </strong>
                </div>
                <div>
                  <span>Accel / Brake Before</span>
                  <strong>{formatSignedG(topSpeedAudit.accelBeforeG)}</strong>
                </div>
                <div>
                  <span>Accel / Brake After</span>
                  <strong>{formatSignedG(topSpeedAudit.accelAfterG)}</strong>
                </div>
                <div>
                  <span>Lateral G</span>
                  <strong>{topSpeedAudit.lateralG === undefined ? 'n/a' : `${topSpeedAudit.lateralG.toFixed(2)}g`}</strong>
                </div>
                <div>
                  <span>Nearby Anomaly</span>
                  <strong>{topSpeedAudit.nearbyAnomaly ? 'yes' : 'no'}</strong>
                </div>
              </div>
              {topSpeedAudit.anomalyReason ? <div className="quality-note">Reason: {topSpeedAudit.anomalyReason}</div> : null}
              {topSpeedAudit.speedAudit.length ? (
                <div className="speed-audit-group">
                  <span>Speed Audit</span>
                  <div className="speed-audit-list">
                    {topSpeedAudit.speedAudit.map((reason) => (
                      <div key={reason}>
                        <span>{reason}</span>
                        <strong>1</strong>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
            </>
          ) : (
            <div className="empty-state">Import a GPX file to audit top speed context.</div>
          )}
        </section>

        <section className="panel-section">
          <div className="section-title">
            <Gauge size={16} />
            <span>Ride Summary</span>
          </div>
          {activeTrack?.summary ? (
            <>
              <div className="setting-row">
                <span>Total Time</span>
                <strong>{formatDuration(activeTrack.summary.durationS)}</strong>
              </div>
              <div className="setting-row">
                <span>Moving Time</span>
                <strong>{formatDuration(activeTrack.summary.movingTimeS)}</strong>
              </div>
              <div className="setting-row">
                <span>Average Speed</span>
                <strong>{formatSpeed(activeTrack.summary.averageSpeedKmh)}</strong>
              </div>
              <div className="setting-row">
                <span>Top Speed</span>
                <strong>{formatSpeed(activeTrack.summary.topSpeedKmh)}</strong>
              </div>
              <div className="setting-row">
                <span>Total Distance</span>
                <strong>{formatDistance(activeTrack.summary.distanceKm)}</strong>
              </div>
              <div className="setting-row">
                <span>Total Elevation</span>
                <strong>{formatElevation(activeTrack.summary.totalElevationM ?? activeTrack.summary.elevationGainM)}</strong>
              </div>
              <div className="setting-row">
                <span>Start Time</span>
                <strong>{formatTrackTime(activeTrack.summary.startTime ?? activeTrack.points[0]?.time)}</strong>
              </div>
              <div className="setting-row">
                <span>Finish Time</span>
                <strong>{formatTrackTime(activeTrack.summary.finishTime ?? activeTrack.points.at(-1)?.time)}</strong>
              </div>
              <div className="setting-row">
                <span>Max Acceleration G-Force</span>
                <strong>{formatSignedG(activeTrack.summary.maxAccelG)}</strong>
              </div>
              <div className="setting-row">
                <span>Max Deceleration G-Force</span>
                <strong>{formatSignedG(activeTrack.summary.maxDecelG, 'negative')}</strong>
              </div>
            </>
          ) : (
            <div className="empty-state">Import a GPX file to calculate ride summary.</div>
          )}
        </section>

        <section className="panel-section">
          <div className="section-title">
            <Flag size={16} />
            <span>Sectors</span>
          </div>
          <select
            className="control-select"
            value={sectorDistanceKm}
            onChange={(event) => setSectorDistanceKm(Number(event.target.value) as SectorDistanceKm)}
          >
            {sectorDistanceOptionsKm.map((distanceKm) => (
              <option value={distanceKm} key={distanceKm}>
                {distanceKm} km sectors
              </option>
            ))}
          </select>
          {activeTrack && sectors.length > 0 ? (
            <div className="sector-list">
              {sectors.map((sector) => (
                <div
                  className="sector-item"
                  key={sector.id}
                  onBlur={() => setHighlightedSector(null)}
                  onFocus={() => setHighlightedSector(sector)}
                  onMouseEnter={() => setHighlightedSector(sector)}
                  onMouseLeave={() => setHighlightedSector(null)}
                  role="button"
                  tabIndex={0}
                >
                  <div className="sector-heading">
                    <strong>
                      {sector.startDistanceKm.toFixed(0)}-{sector.endDistanceKm.toFixed(1)} km
                    </strong>
                    <span
                      className={`sector-confidence ${sector.confidence}`}
                      title="Confidence is based on anomaly density inside this sector. High means fewer flagged samples."
                    >
                      Confidence {sector.confidence}
                    </span>
                  </div>
                  <div className="sector-metrics">
                    <span>Avg {formatSpeed(sector.averageSpeedKmh)}</span>
                    <span>Top {formatSpeed(sector.topSpeedKmh)}</span>
                    <span>Elev +{sector.elevationGainM.toFixed(0)} / -{sector.elevationLossM.toFixed(0)} m</span>
                    <span>{sector.stopCount} stops</span>
                    <span>{sector.anomalyCount} anomalies</span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="empty-state">Import a GPX file to split the ride into distance sectors.</div>
          )}
        </section>

        <section className="panel-section">
          <div className="section-title">
            <Radar size={16} />
            <span>Quality Audit</span>
          </div>
          {activeTrack ? (
            <>
              <div className="audit-grid">
                <div>
                  <span>Sampling</span>
                  <strong>{formatSampling(activeTrack.quality.samplingHz)}</strong>
                </div>
                <div>
                  <span>Interval</span>
                  <strong>{formatInterval(activeTrack.quality.medianIntervalS)}</strong>
                </div>
                <div>
                  <span>Coverage</span>
                  <strong>{formatPercent(activeTrack.quality.timeCoveragePercent)}</strong>
                </div>
                <div>
                  <span>Raw Points</span>
                  <strong>{formatCount(activeTrack.quality.actualPointCount)}</strong>
                </div>
                <div>
                  <span>Expected 1Hz</span>
                  <strong>{formatCount(activeTrack.quality.expectedPointCount1Hz)}</strong>
                </div>
                <div>
                  <span>Missing Sec</span>
                  <strong>{formatCount(activeTrack.quality.missingSeconds)}</strong>
                </div>
                <div>
                  <span>Gap Count</span>
                  <strong>{activeTrack.quality.gapCount}</strong>
                </div>
                <div>
                  <span>Longest Gap</span>
                  <strong>{formatInterval(activeTrack.quality.longestGapS)}</strong>
                </div>
                <div>
                  <span>P95 Interval</span>
                  <strong>{formatInterval(activeTrack.quality.p95IntervalS)}</strong>
                </div>
                <div>
                  <span>Max Interval</span>
                  <strong>{formatInterval(activeTrack.quality.maxIntervalS)}</strong>
                </div>
                <div>
                  <span>Duplicates</span>
                  <strong>{activeTrack.quality.duplicatePoints}</strong>
                </div>
                <div>
                  <span>GPS Jumps</span>
                  <strong>{activeTrack.quality.gpsJumps}</strong>
                </div>
                <div>
                  <span>Anomalies</span>
                  <strong>{activeTrack.quality.anomalies}</strong>
                </div>
                <div>
                  <span>Raw Max</span>
                  <strong>{formatSpeed(activeTrack.quality.maxSpeedKmh)}</strong>
                </div>
                <div>
                  <span>Clean Max</span>
                  <strong>{formatSpeed(activeTrack.quality.maxCleanedSpeedKmh)}</strong>
                </div>
                <div>
                  <span>Max Accel</span>
                  <strong>{formatSignedG(activeTrack.summary?.maxAccelG)}</strong>
                </div>
                <div>
                  <span>Max Brake</span>
                  <strong>{formatSignedG(activeTrack.summary?.maxDecelG, 'negative')}</strong>
                </div>
                <div>
                  <span>Pauses</span>
                  <strong>{activeTrack.summary?.pauseCount ?? 0}</strong>
                </div>
                <div>
                  <span>Traffic Stops</span>
                  <strong>{activeTrack.summary?.trafficStopCount ?? 0}</strong>
                </div>
              </div>
              <div className={`quality-pill ${activeTrack.quality.gpsNoise}`}>
                GPS noise: {activeTrack.quality.gpsNoise}
              </div>
              {activeTrack.quality.confidenceBreakdown ? (
                <div className="speed-audit-group">
                  <span>Confidence Model</span>
                  <div className="speed-audit-list">
                    <div>
                      <span>route-shape</span>
                      <strong>{activeTrack.quality.confidenceBreakdown.routeShape}</strong>
                    </div>
                    <div>
                      <span>speed</span>
                      <strong>{activeTrack.quality.confidenceBreakdown.speed}</strong>
                    </div>
                    <div>
                      <span>acceleration</span>
                      <strong>{activeTrack.quality.confidenceBreakdown.acceleration}</strong>
                    </div>
                    <div>
                      <span>reconstruction</span>
                      <strong>{activeTrack.quality.confidenceBreakdown.reconstruction}</strong>
                    </div>
                  </div>
                  <div className="quality-note">Confidence labels describe data reliability, not rider performance.</div>
                </div>
              ) : (
                <>
                  <div className="quality-note">Speed confidence: {activeTrack.quality.speedConfidence}</div>
                  <div className="quality-note">Acceleration confidence: {activeTrack.quality.accelerationConfidence}</div>
                </>
              )}
              {finalAnomalyEntries.length ? (
                <div className="speed-audit-group">
                  <span>Final Anomalies</span>
                  <div className="speed-audit-list">
                    {finalAnomalyEntries.map(([reason, count]) => (
                      <div key={reason}>
                        <span>{reason}</span>
                        <strong>{count}</strong>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
              {processingAdjustmentEntries.length ? (
                <div className="speed-audit-group">
                  <span>Processing Adjustments</span>
                  <div className="speed-audit-list">
                    {processingAdjustmentEntries.map(([reason, count]) => (
                    <div key={reason}>
                      <span>{reason}</span>
                      <strong>{count}</strong>
                    </div>
                    ))}
                  </div>
                </div>
              ) : null}
            </>
          ) : (
            <div className="empty-state">Import a GPX file to audit track quality.</div>
          )}
        </section>
      </aside>

      <section className="workspace">
        <header className="topbar">
          <div>
            <p className="eyebrow">Reconstruction workspace</p>
            <h2>GPX cleaning, resampling, and riding insight</h2>
          </div>
          <div className="status-pill">
            <Activity size={16} />
            {status}
          </div>
        </header>

        <div className="map-stage">
          <Suspense
            fallback={
              <div className="map-loading" aria-live="polite">
                Loading map engine
              </div>
            }
          >
            <MapView
              track={activeTrack}
              highlightedSector={highlightedSector}
              displayMode={telemetryDisplayMode}
              selectedPointId={selectedPointId}
              onSelectPoint={setSelectedPointId}
            />
          </Suspense>
        </div>

        <footer className="telemetry-dock">
          <div className="dock-main">
            <div className="dock-tabs" aria-label="Telemetry dock mode">
              {(['metrics', 'speed', 'elevation', 'accel', 'lateral', 'confidence'] as DockMode[]).map((mode) => (
                <button
                  className={dockMode === mode ? 'active' : ''}
                  key={mode}
                  type="button"
                  onClick={() => setDockMode(mode)}
                >
                  {mode}
                </button>
              ))}
            </div>
            {dockMode === 'metrics' ? (
              <div className="metric-grid">
                {metrics.map((metric) => (
                  <div className="metric" key={metric.label}>
                    <span>{metric.label}</span>
                    <strong>{metric.value}</strong>
                    <small>{metric.hint}</small>
                  </div>
                ))}
              </div>
            ) : chartData ? (
              <div className="chart-lane">
                <div className="chart-lane-header">
                  <strong>{chartData.label}</strong>
                  <span>
                    {chartData.minY.toFixed(1)}-{chartData.maxY.toFixed(1)} {chartData.unit} ·{' '}
                    {chartData.distanceKm.toFixed(1)} km
                  </span>
                </div>
                <svg
                  className="telemetry-chart"
                  viewBox="0 0 640 120"
                  preserveAspectRatio="none"
                  role="img"
                  aria-label={`${chartData.label} over distance`}
                  onPointerUp={(event) => selectNearestChartPoint(event.clientX, event.currentTarget.getBoundingClientRect())}
                >
                  <line x1="0" x2="640" y1="30" y2="30" />
                  <line x1="0" x2="640" y1="60" y2="60" />
                  <line x1="0" x2="640" y1="90" y2="90" />
                  {chartData.zeroY !== undefined ? (
                    <line className="chart-zero" x1="0" x2="640" y1={chartData.zeroY} y2={chartData.zeroY} />
                  ) : null}
                  {chartData.anomalyMarkers.map((marker, index) => (
                    <line className="chart-anomaly" key={`${marker.x}-${index}`} x1={marker.x} x2={marker.x} y1="0" y2="120" />
                  ))}
                  <path d={chartData.path} style={{ stroke: chartData.stroke }} />
                  {chartData.selectedX !== undefined ? (
                    <line className="chart-selected" x1={chartData.selectedX} x2={chartData.selectedX} y1="0" y2="120" />
                  ) : null}
                </svg>
              </div>
            ) : (
              <div className="chart-empty">No chart data for this mode.</div>
            )}
          </div>
        </footer>
      </section>
    </main>
  )
}

export default App
