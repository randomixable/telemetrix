import type { TrackPoint, TrackReconstruction } from '../../types/telemetry'
import { calculateDistanceMeters } from '../physics/distance'

const DEFAULT_SAMPLE_RATE_HZ = 5
const GRAVITY_MS2 = 9.81
const CURVATURE_WINDOW_M = 35
const MIN_CURVATURE_BASELINE_M = 18

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t
}

function interpolateOptionalNumber(a: number | undefined, b: number | undefined, t: number) {
  if (a === undefined && b === undefined) return undefined
  if (a === undefined) return b
  if (b === undefined) return a
  return lerp(a, b, t)
}

function pointSpeedKmh(point: TrackPoint) {
  return point.cleanedSpeedKmh ?? point.speedKmh ?? point.rawSpeedKmh ?? 0
}

function calculateAccelerationG(previousSpeedKmh: number, currentSpeedKmh: number, dtS: number) {
  if (dtS <= 0) return 0
  return (((currentSpeedKmh - previousSpeedKmh) * 1000) / 3600 / dtS) / GRAVITY_MS2
}

function monotoneDistances(points: TrackPoint[]) {
  let lastDistanceM = 0

  return points.map((point) => {
    const distanceM = Math.max(lastDistanceM, point.distanceM ?? lastDistanceM)
    lastDistanceM = distanceM
    return distanceM
  })
}

function calculateConfidence(previous: TrackPoint, current: TrackPoint, dtS: number, distanceDeltaM: number) {
  let confidence = 0.92
  if (previous.isAnomaly || current.isAnomaly) confidence -= 0.35
  if (dtS > 1.5) confidence -= Math.min(0.55, (dtS - 1.5) * 0.08)
  if (distanceDeltaM <= 0.05 && pointSpeedKmh(previous) > 5) confidence -= 0.2
  return Math.max(0.1, Number(confidence.toFixed(2)))
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

function findWindowIndex(points: TrackPoint[], startIndex: number, direction: -1 | 1, minimumDistanceM: number) {
  const startDistanceM = points[startIndex].distanceM ?? 0
  let candidateIndex = startIndex

  while (candidateIndex + direction >= 0 && candidateIndex + direction < points.length) {
    candidateIndex += direction
    const candidateDistanceM = points[candidateIndex].distanceM ?? startDistanceM
    if (Math.abs(candidateDistanceM - startDistanceM) >= minimumDistanceM) return candidateIndex
  }

  return candidateIndex === startIndex ? undefined : candidateIndex
}

function calculateWindowedCurvature(points: TrackPoint[], index: number) {
  const previousIndex = findWindowIndex(points, index, -1, CURVATURE_WINDOW_M)
  const nextIndex = findWindowIndex(points, index, 1, CURVATURE_WINDOW_M)
  const previous = previousIndex === undefined ? undefined : points[previousIndex]
  const next = nextIndex === undefined ? undefined : points[nextIndex]

  if (!previous || !next) return { curvature: 0, headingDeg: next ? calculateHeadingDeg(points[index], next) : 0 }

  const inboundHeadingDeg = calculateHeadingDeg(previous, points[index])
  const outboundHeadingDeg = calculateHeadingDeg(points[index], next)
  const headingDeg = calculateHeadingDeg(previous, next)
  const baselineM = Math.max(MIN_CURVATURE_BASELINE_M, calculateDistanceMeters(previous, next))
  const headingChangeRad = (headingDeltaDeg(inboundHeadingDeg, outboundHeadingDeg) * Math.PI) / 180

  return {
    headingDeg,
    curvature: headingChangeRad / baselineM,
  }
}

function enrichReconstructedPoints(points: TrackPoint[]) {
  return points.map((point, index) => {
    const previous = index > 0 ? points[index - 1] : undefined
    const next = index + 1 < points.length ? points[index + 1] : undefined
    const fallbackHeadingDeg = previous ? calculateHeadingDeg(previous, point) : next ? calculateHeadingDeg(point, next) : 0
    const windowedCurvature = calculateWindowedCurvature(points, index)
    const headingDeg = windowedCurvature.headingDeg || fallbackHeadingDeg
    const curvature = windowedCurvature.curvature
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

export function reconstructTrackDistanceV2(
  points: TrackPoint[],
  sampleRateHz = DEFAULT_SAMPLE_RATE_HZ,
): TrackReconstruction {
  if (points.length < 2) return { sampleRateHz, method: 'distance-v2', points: [] }

  const intervalMs = 1000 / sampleRateHz
  const distances = monotoneDistances(points)
  const reconstructed: TrackPoint[] = []

  for (let i = 0; i < points.length - 1; i++) {
    const previous = points[i]
    const current = points[i + 1]
    const startMs = Date.parse(previous.time)
    const endMs = Date.parse(current.time)
    const dtMs = endMs - startMs
    if (dtMs <= 0) continue

    const startDistanceM = distances[i]
    const endDistanceM = distances[i + 1]
    const distanceDeltaM = Math.max(0, endDistanceM - startDistanceM)
    const steps = Math.max(1, Math.round(dtMs / intervalMs))
    const confidence = calculateConfidence(previous, current, dtMs / 1000, distanceDeltaM)
    const anchorAccelerationG = calculateAccelerationG(pointSpeedKmh(previous), pointSpeedKmh(current), dtMs / 1000)

    for (let step = 0; step < steps; step++) {
      if (i > 0 && step === 0) continue
      const timeRatio = step / steps
      const timeMs = startMs + dtMs * timeRatio
      const targetDistanceM = lerp(startDistanceM, endDistanceM, timeRatio)
      const distanceRatio = distanceDeltaM > 0 ? (targetDistanceM - startDistanceM) / distanceDeltaM : timeRatio
      const speedKmh = lerp(pointSpeedKmh(previous), pointSpeedKmh(current), timeRatio)

      reconstructed.push({
        id: `${previous.id}-distance-v2-${step}`,
        lat: lerp(previous.lat, current.lat, distanceRatio),
        lon: lerp(previous.lon, current.lon, distanceRatio),
        ele: interpolateOptionalNumber(previous.ele, current.ele, distanceRatio),
        time: new Date(timeMs).toISOString(),
        distanceM: targetDistanceM,
        speedKmh,
        cleanedSpeedKmh: speedKmh,
        rawSpeedKmh: interpolateOptionalNumber(previous.rawSpeedKmh, current.rawSpeedKmh, timeRatio),
        accelerationG: Number(anchorAccelerationG.toFixed(3)),
        origin: timeRatio === 0 ? previous.origin ?? 'derived' : 'estimated',
        confidence,
        sourcePointIndexStart: i,
        sourcePointIndexEnd: i + 1,
      })
    }
  }

  const lastPoint = points[points.length - 1]
  reconstructed.push({
    ...lastPoint,
    id: `${lastPoint.id}-distance-v2-final`,
    distanceM: distances[distances.length - 1],
    origin: lastPoint.origin ?? 'derived',
    confidence: lastPoint.isAnomaly ? 0.55 : 0.92,
    sourcePointIndexStart: points.length - 2,
    sourcePointIndexEnd: points.length - 1,
  })

  return {
    sampleRateHz,
    method: 'distance-v2',
    points: enrichReconstructedPoints(reconstructed),
  }
}
