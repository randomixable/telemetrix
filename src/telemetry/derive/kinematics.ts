import type { TrackPoint } from '../../types/telemetry'
import { calculateDistanceMeters } from '../physics/distance'

export function deriveKinematics(points: TrackPoint[]): TrackPoint[] {
  let cumulativeDistanceM = 0

  return points.map((point, index) => {
    const previous = index > 0 ? points[index - 1] : undefined
    let speedKmh = 0

    if (previous) {
      const segmentDistanceM = calculateDistanceMeters(previous, point)
      const dtS = (Date.parse(point.time) - Date.parse(previous.time)) / 1000
      cumulativeDistanceM += segmentDistanceM
      speedKmh = dtS > 0 ? (segmentDistanceM / dtS) * 3.6 : 0
    }

    return {
      ...point,
      distanceM: cumulativeDistanceM,
      speedKmh,
      rawSpeedKmh: speedKmh,
      cleanedSpeedKmh: speedKmh,
    }
  })
}
