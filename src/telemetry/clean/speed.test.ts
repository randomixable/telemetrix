import { describe, expect, it } from 'vitest'
import { defaultMotorcycleProfile } from '../../motorcycles/defaultProfiles'
import type { TrackPoint } from '../../types/telemetry'
import { cleanSpeedWithMotorcycleConstraints } from './speed'

function point(index: number, rawSpeedKmh: number, cleanedSpeedKmh: number): TrackPoint {
  return {
    id: `point-${index}`,
    lat: -7.1,
    lon: 110.1,
    time: `2025-03-10T00:00:${String(index).padStart(2, '0')}Z`,
    rawSpeedKmh,
    speedKmh: cleanedSpeedKmh,
    cleanedSpeedKmh,
    origin: 'derived',
  }
}

describe('cleanSpeedWithMotorcycleConstraints', () => {
  it('flags raw speeds above plausible motorcycle speed even after legacy smoothing', () => {
    const points = cleanSpeedWithMotorcycleConstraints(
      [point(0, 115, 115), point(1, 150, 117)],
      defaultMotorcycleProfile,
    )

    expect(points[1].isAnomaly).toBe(true)
    expect(points[1].anomalyReason).toContain('speed-above-plausible')
    expect(points[1].speedAudit).toContain('motorcycle-speed-above-plausible')
    expect(points[1].cleanedSpeedKmh).toBe(117)
  })
})
