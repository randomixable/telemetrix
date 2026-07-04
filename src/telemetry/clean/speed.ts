import type { MotorcycleProfile } from '../../motorcycles/motorcycleTypes'
import type { TrackPoint } from '../../types/telemetry'

function calculateAccelerationG(previousSpeedKmh: number, currentSpeedKmh: number, dtS: number) {
  if (dtS <= 0) return 0
  const accelerationMs2 = ((currentSpeedKmh - previousSpeedKmh) * 1000) / 3600 / dtS
  return accelerationMs2 / 9.81
}

export function cleanSpeedWithMotorcycleConstraints(points: TrackPoint[], motorcycle: MotorcycleProfile): TrackPoint[] {
  const maxPlausibleSpeedKmh = motorcycle.maxPlausibleSpeedKmh ?? 135
  const gpsSpikeThresholdKmh = motorcycle.gpsSpikeThresholdKmh ?? 180
  const maxAccelG = motorcycle.maxAccelG ?? 0.55
  const maxBrakeG = motorcycle.maxBrakeG ?? 1

  return points.map((point, index) => {
    const rawSpeedKmh = point.rawSpeedKmh ?? point.speedKmh ?? 0
    const baselineSpeedKmh = point.cleanedSpeedKmh ?? point.speedKmh ?? rawSpeedKmh
    const previous = index > 0 ? points[index - 1] : undefined
    const previousCleanedSpeedKmh = previous?.cleanedSpeedKmh ?? previous?.rawSpeedKmh ?? previous?.speedKmh ?? 0
    const dtS = previous ? (Date.parse(point.time) - Date.parse(previous.time)) / 1000 : 0
    const accelerationG = previous ? calculateAccelerationG(previousCleanedSpeedKmh, baselineSpeedKmh, dtS) : 0

    const reasons: string[] = []
    if (rawSpeedKmh > gpsSpikeThresholdKmh) reasons.push('gps-spike-threshold')
    if (rawSpeedKmh > maxPlausibleSpeedKmh || baselineSpeedKmh > maxPlausibleSpeedKmh) {
      reasons.push('speed-above-plausible')
    }
    if (accelerationG > maxAccelG) reasons.push('max-accel')
    if (accelerationG < -maxBrakeG) reasons.push('max-brake')

    const isAnomaly = reasons.length > 0
    const requiresSpeedClamp =
      rawSpeedKmh > gpsSpikeThresholdKmh ||
      baselineSpeedKmh > maxPlausibleSpeedKmh ||
      accelerationG > maxAccelG ||
      accelerationG < -maxBrakeG
    const cleanedSpeedKmh = requiresSpeedClamp ? Math.min(previousCleanedSpeedKmh, maxPlausibleSpeedKmh) : baselineSpeedKmh

    return {
      ...point,
      rawSpeedKmh,
      speedKmh: cleanedSpeedKmh,
      cleanedSpeedKmh,
      accelerationG,
      isAnomaly,
      anomalyReason: reasons.join(', '),
      speedAudit: [...(point.speedAudit ?? []), ...reasons.map((reason) => `motorcycle-${reason}`)],
    }
  })
}
