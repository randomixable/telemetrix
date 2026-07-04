import type { TrackPoint, TrackReconstruction } from '../../types/telemetry'
import { calculateDistanceMeters } from '../physics/distance'

const DEFAULT_SAMPLE_RATE_HZ = 5
const GRAVITY_MS2 = 9.81

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t
}

function interpolateOptionalNumber(a: number | undefined, b: number | undefined, t: number) {
  if (a === undefined && b === undefined) return undefined
  if (a === undefined) return b
  if (b === undefined) return a
  return lerp(a, b, t)
}

function calculateHeadingDeg(previous: TrackPoint, current: TrackPoint) {
  const toRad = (deg: number) => (deg * Math.PI) / 180
  const toDeg = (rad: number) => (rad * 180) / Math.PI
  const lat1 = toRad(previous.lat)
  const lat2 = toRad(current.lat)
  const deltaLon = toRad(current.lon - previous.lon)
  const y = Math.sin(deltaLon) * Math.cos(lat2)
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(deltaLon)
  return (toDeg(Math.atan2(y, x)) + 360) % 360
}

function headingDeltaDeg(a: number, b: number) {
  return ((b - a + 540) % 360) - 180
}

function pointSpeedKmh(point: TrackPoint) {
  return point.cleanedSpeedKmh ?? point.speedKmh ?? point.rawSpeedKmh ?? 0
}

function calculateConfidence(previous: TrackPoint, current: TrackPoint, dtS: number) {
  let confidence = 0.9
  if (previous.isAnomaly || current.isAnomaly) confidence -= 0.35
  if (dtS > 1.5) confidence -= Math.min(0.55, (dtS - 1.5) * 0.08)
  return Math.max(0.1, Number(confidence.toFixed(2)))
}

function enrichReconstructedPoints(points: TrackPoint[]) {
  return points.map((point, index) => {
    const previous = index > 0 ? points[index - 1] : undefined
    const next = index + 1 < points.length ? points[index + 1] : undefined
    const headingDeg = previous ? calculateHeadingDeg(previous, point) : next ? calculateHeadingDeg(point, next) : 0
    const previousHeadingDeg = previous && index > 1 ? calculateHeadingDeg(points[index - 2], previous) : headingDeg
    const distanceM = previous ? Math.max(0.001, calculateDistanceMeters(previous, point)) : 0
    const curvature = previous ? headingDeltaDeg(previousHeadingDeg, headingDeg) / distanceM : 0
    const speedMs = pointSpeedKmh(point) / 3.6
    const lateralG = Math.abs((speedMs * speedMs * curvature) / GRAVITY_MS2)

    return {
      ...point,
      headingDeg,
      curvature,
      lateralG: Number(lateralG.toFixed(3)),
    }
  })
}

export function reconstructTrackLinear(points: TrackPoint[], sampleRateHz = DEFAULT_SAMPLE_RATE_HZ): TrackReconstruction {
  if (points.length < 2) return { sampleRateHz, method: 'linear-v1', points: [] }

  const intervalMs = 1000 / sampleRateHz
  const reconstructed: TrackPoint[] = []

  for (let i = 0; i < points.length - 1; i++) {
    const previous = points[i]
    const current = points[i + 1]
    const startMs = Date.parse(previous.time)
    const endMs = Date.parse(current.time)
    const dtMs = endMs - startMs
    if (dtMs <= 0) continue

    const steps = Math.max(1, Math.round(dtMs / intervalMs))
    const confidence = calculateConfidence(previous, current, dtMs / 1000)

    for (let step = 0; step < steps; step++) {
      if (i > 0 && step === 0) continue
      const ratio = step / steps
      const timeMs = startMs + dtMs * ratio
      const speedKmh = lerp(pointSpeedKmh(previous), pointSpeedKmh(current), ratio)

      reconstructed.push({
        id: `${previous.id}-recon-${step}`,
        lat: lerp(previous.lat, current.lat, ratio),
        lon: lerp(previous.lon, current.lon, ratio),
        ele: interpolateOptionalNumber(previous.ele, current.ele, ratio),
        time: new Date(timeMs).toISOString(),
        distanceM: interpolateOptionalNumber(previous.distanceM, current.distanceM, ratio),
        speedKmh,
        cleanedSpeedKmh: speedKmh,
        rawSpeedKmh: interpolateOptionalNumber(previous.rawSpeedKmh, current.rawSpeedKmh, ratio),
        origin: ratio === 0 ? previous.origin ?? 'derived' : 'estimated',
        confidence,
        sourcePointIndexStart: i,
        sourcePointIndexEnd: i + 1,
      })
    }
  }

  const lastPoint = points[points.length - 1]
  reconstructed.push({
    ...lastPoint,
    id: `${lastPoint.id}-recon-final`,
    origin: lastPoint.origin ?? 'derived',
    confidence: 0.9,
    sourcePointIndexStart: points.length - 2,
    sourcePointIndexEnd: points.length - 1,
  })

  return {
    sampleRateHz,
    method: 'linear-v1',
    points: enrichReconstructedPoints(reconstructed),
  }
}
