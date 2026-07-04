import { describe, expect, it } from 'vitest'
import { defaultMotorcycleProfile } from '../../motorcycles/defaultProfiles'
import type { TrackPoint } from '../../types/telemetry'
import { validatePhysicsConstraints } from './physics'

function trackPoint(index: number, speedKmh: number, distanceM: number, lateralG = 0): TrackPoint {
  return {
    id: `point-${index}`,
    lat: -7.1,
    lon: 110.1,
    time: `2025-03-10T00:00:${String(index).padStart(2, '0')}Z`,
    distanceM,
    speedKmh,
    cleanedSpeedKmh: speedKmh,
    lateralG,
    origin: 'derived',
  }
}

describe('validatePhysicsConstraints', () => {
  it('flags acceleration and braking that exceed the motorcycle profile', () => {
    const points = validatePhysicsConstraints(
      [trackPoint(0, 20, 0), trackPoint(1, 60, 12), trackPoint(2, 10, 22)],
      defaultMotorcycleProfile,
    )

    expect(points[1].physicsAudit).toContain('physics-max-accel')
    expect(points[2].physicsAudit).toContain('physics-max-brake')
    expect(points[1].isAnomaly).toBe(true)
  })

  it('flags lateral G and distance-derived speed mismatch without mutating speed', () => {
    const points = validatePhysicsConstraints(
      [trackPoint(0, 80, 0), trackPoint(1, 80, 5, 0.9)],
      defaultMotorcycleProfile,
    )

    expect(points[1].physicsAudit).toEqual(
      expect.arrayContaining(['physics-distance-speed-mismatch', 'physics-lateral-g']),
    )
    expect(points[1].speedKmh).toBe(80)
  })

  it('does not flood synthetic reconstructed samples with anchor-level speed mismatch or accel anomalies', () => {
    const synthetic = {
      ...trackPoint(1, 80, 5, 0.9),
      accelerationG: -0.25,
      origin: 'estimated' as const,
    }
    const points = validatePhysicsConstraints([trackPoint(0, 20, 0), synthetic], defaultMotorcycleProfile)

    expect(points[1].physicsAudit).not.toContain('physics-distance-speed-mismatch')
    expect(points[1].physicsAudit).not.toContain('physics-max-accel')
    expect(points[1].accelerationG).toBe(-0.25)
    expect(points[1].physicsAudit).toContain('physics-lateral-g')
  })
})
