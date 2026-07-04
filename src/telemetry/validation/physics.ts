import type { MotorcycleProfile } from '../../motorcycles/motorcycleTypes'
import type { TrackPoint } from '../../types/telemetry'

const GRAVITY_MS2 = 9.81
const SPEED_MISMATCH_MIN_DELTA_KMH = 18
const SPEED_MISMATCH_RATIO = 0.35

function pointSpeedKmh(point: TrackPoint) {
  return point.cleanedSpeedKmh ?? point.speedKmh ?? point.rawSpeedKmh ?? 0
}

function appendReason(existing: string | undefined, reasons: string[]) {
  const existingReasons = existing
    ? existing
        .split(',')
        .map((reason) => reason.trim())
        .filter(Boolean)
    : []

  return [...new Set([...existingReasons, ...reasons])].join(', ')
}

function calculateAccelerationG(previousSpeedKmh: number, currentSpeedKmh: number, dtS: number) {
  if (dtS <= 0) return 0
  return (((currentSpeedKmh - previousSpeedKmh) * 1000) / 3600 / dtS) / GRAVITY_MS2
}

function calculateDistanceDerivedSpeedKmh(previous: TrackPoint, current: TrackPoint, dtS: number) {
  if (dtS <= 0 || previous.distanceM === undefined || current.distanceM === undefined) return undefined
  const distanceDeltaM = Math.max(0, current.distanceM - previous.distanceM)
  return (distanceDeltaM / dtS) * 3.6
}

export function validatePhysicsConstraints(points: TrackPoint[], motorcycle: MotorcycleProfile): TrackPoint[] {
  const maxAccelG = motorcycle.maxAccelG ?? 0.55
  const maxBrakeG = motorcycle.maxBrakeG ?? 1
  const maxCornerLateralG = motorcycle.maxCornerLateralG ?? 0.75
  const maxPlausibleSpeedKmh = motorcycle.maxPlausibleSpeedKmh ?? 135

  return points.map((point, index) => {
    const previous = index > 0 ? points[index - 1] : undefined
    const speedKmh = pointSpeedKmh(point)
    const isSyntheticEstimate = point.origin === 'estimated'
    const reasons: string[] = []
    let accelerationG = point.accelerationG

    if (previous) {
      const dtS = (Date.parse(point.time) - Date.parse(previous.time)) / 1000
      const previousSpeedKmh = pointSpeedKmh(previous)
      accelerationG = isSyntheticEstimate
        ? point.accelerationG
        : calculateAccelerationG(previousSpeedKmh, speedKmh, dtS)

      if (!isSyntheticEstimate && (accelerationG ?? 0) > maxAccelG) reasons.push('physics-max-accel')
      if (!isSyntheticEstimate && (accelerationG ?? 0) < -maxBrakeG) reasons.push('physics-max-brake')

      const distanceDerivedSpeedKmh = calculateDistanceDerivedSpeedKmh(previous, point, dtS)
      if (!isSyntheticEstimate && distanceDerivedSpeedKmh !== undefined) {
        const deltaKmh = Math.abs(distanceDerivedSpeedKmh - speedKmh)
        const ratio = speedKmh > 1 ? deltaKmh / speedKmh : deltaKmh
        if (deltaKmh >= SPEED_MISMATCH_MIN_DELTA_KMH && ratio >= SPEED_MISMATCH_RATIO) {
          reasons.push('physics-distance-speed-mismatch')
        }
      }
    }

    if (speedKmh > maxPlausibleSpeedKmh) reasons.push('physics-speed-above-plausible')
    if ((point.lateralG ?? 0) > maxCornerLateralG) reasons.push('physics-lateral-g')
    if ((point.confidence ?? 1) < 0.45) reasons.push('physics-low-confidence')

    const physicsAudit = [...new Set([...(point.physicsAudit ?? []), ...reasons])]
    const isAnomaly = point.isAnomaly || physicsAudit.length > 0

    return {
      ...point,
      accelerationG: Number((accelerationG ?? 0).toFixed(3)),
      isAnomaly,
      anomalyReason: physicsAudit.length ? appendReason(point.anomalyReason, physicsAudit) : point.anomalyReason,
      physicsAudit,
      speedAudit: [...new Set([...(point.speedAudit ?? []), ...physicsAudit])],
    }
  })
}
