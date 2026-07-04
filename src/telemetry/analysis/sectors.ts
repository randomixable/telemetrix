import type { StoredTrack, TrackPoint, TrackSector } from '../../types/telemetry'

export const sectorDistanceOptionsKm = [5, 10, 15, 20, 25] as const
export type SectorDistanceKm = (typeof sectorDistanceOptionsKm)[number]

function pointSpeedKmh(point: TrackPoint) {
  return point.cleanedSpeedKmh ?? point.speedKmh ?? point.rawSpeedKmh ?? 0
}

function calculateElevationDelta(points: TrackPoint[]) {
  let elevationGainM = 0
  let elevationLossM = 0

  points.forEach((point, index) => {
    if (index === 0 || point.ele === undefined) return

    const previousElevation = points[index - 1].ele
    if (previousElevation === undefined) return

    const diff = point.ele - previousElevation
    if (diff > 0) elevationGainM += diff
    if (diff < 0) elevationLossM += Math.abs(diff)
  })

  return { elevationGainM, elevationLossM }
}

function calculateMovingTime(points: TrackPoint[]) {
  return points.reduce((total, point, index) => {
    if (index === 0 || pointSpeedKmh(point) < 2) return total
    return total + Math.max(0, (Date.parse(point.time) - Date.parse(points[index - 1].time)) / 1000)
  }, 0)
}

function calculateSectorConfidence(points: TrackPoint[]) {
  if (points.length < 2) return 'unknown'

  const anomalyRatio = points.filter((point) => point.isAnomaly).length / points.length
  if (anomalyRatio > 0.12) return 'low'
  if (anomalyRatio > 0.03) return 'medium'
  return 'high'
}

export function buildDistanceSectors(track: StoredTrack, sectorDistanceKm: SectorDistanceKm): TrackSector[] {
  const totalDistanceKm = track.summary?.distanceKm ?? (track.points.at(-1)?.distanceM ?? 0) / 1000
  if (totalDistanceKm <= 0) return []

  const sectorCount = Math.ceil(totalDistanceKm / sectorDistanceKm)

  return Array.from({ length: sectorCount }, (_, index): TrackSector => {
    const startDistanceKm = index * sectorDistanceKm
    const endDistanceKm = Math.min((index + 1) * sectorDistanceKm, totalDistanceKm)
    const sectorPoints = track.points.filter((point) => {
      const distanceKm = (point.distanceM ?? 0) / 1000
      return index === 0
        ? distanceKm >= startDistanceKm && distanceKm <= endDistanceKm
        : distanceKm > startDistanceKm && distanceKm <= endDistanceKm
    })
    const firstPoint = sectorPoints[0]
    const lastPoint = sectorPoints.at(-1)
    const durationS = firstPoint && lastPoint ? Math.max(0, (Date.parse(lastPoint.time) - Date.parse(firstPoint.time)) / 1000) : 0
    const movingTimeS = calculateMovingTime(sectorPoints)
    const distanceKm = Math.max(0, endDistanceKm - startDistanceKm)
    const { elevationGainM, elevationLossM } = calculateElevationDelta(sectorPoints)
    const stopCount = (track.events ?? []).filter((event) => {
      const point = track.points[event.pointIndex]
      const distanceKm = (point?.distanceM ?? 0) / 1000
      return distanceKm > startDistanceKm && distanceKm <= endDistanceKm
    }).length
    const anomalyCount = sectorPoints.filter((point) => point.isAnomaly).length

    return {
      id: `${track.id}-sector-${sectorDistanceKm}-${index}`,
      index,
      startDistanceKm,
      endDistanceKm,
      pointCount: sectorPoints.length,
      durationS,
      movingTimeS,
      averageSpeedKmh: movingTimeS > 0 ? (distanceKm / (movingTimeS / 3600)) : 0,
      topSpeedKmh: sectorPoints.length ? Math.max(...sectorPoints.map(pointSpeedKmh)) : 0,
      elevationGainM,
      elevationLossM,
      stopCount,
      anomalyCount,
      confidence: calculateSectorConfidence(sectorPoints),
    }
  })
}
