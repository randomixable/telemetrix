import type { TrackPoint } from '../../types/telemetry'

const GRAVITY_MS2 = 9.81

export type MaxGForceResult = {
  maxAccelG: number
  maxDecelG: number
  maxAccelPointIndex: number
  maxDecelPointIndex: number
}

function pointSpeedKmh(point: TrackPoint) {
  return point.cleanedSpeedKmh ?? point.speedKmh ?? point.rawSpeedKmh ?? 0
}

function accelerationG(previous: TrackPoint, current: TrackPoint) {
  const dtS = (Date.parse(current.time) - Date.parse(previous.time)) / 1000
  if (dtS <= 0) return 0

  const speedDiffKmh = pointSpeedKmh(current) - pointSpeedKmh(previous)
  return ((speedDiffKmh * 1000) / 3600 / dtS) / GRAVITY_MS2
}

export function calculateMaxGForce(points: TrackPoint[]): MaxGForceResult {
  let maxAccelG = 0
  let maxDecelG = 0
  let maxAccelPointIndex = -1
  let maxDecelPointIndex = -1

  for (let i = 1; i < points.length; i++) {
    let currentG = accelerationG(points[i - 1], points[i])

    if (i >= 2) {
      const previousG = accelerationG(points[i - 2], points[i - 1])
      currentG = (currentG + previousG) / 2
    }

    const cappedG = Math.max(-1, Math.min(0.5, currentG))

    if (cappedG > maxAccelG) {
      maxAccelG = cappedG
      maxAccelPointIndex = i
    }

    if (cappedG < maxDecelG) {
      maxDecelG = cappedG
      maxDecelPointIndex = i
    }
  }

  return {
    maxAccelG: Number(maxAccelG.toFixed(2)),
    maxDecelG: Number(Math.abs(maxDecelG).toFixed(2)),
    maxAccelPointIndex,
    maxDecelPointIndex,
  }
}
