import { describe, expect, it } from 'vitest'
import type { TrackPoint } from '../../types/telemetry'
import { calculateMaxGForce } from './gforce'

function point(index: number, speedKmh: number): TrackPoint {
  return {
    id: `point-${index}`,
    lat: -7.1,
    lon: 110.1,
    time: `2025-03-10T00:00:0${index}Z`,
    cleanedSpeedKmh: speedKmh,
    speedKmh,
    origin: 'derived',
  }
}

describe('calculateMaxGForce', () => {
  it('calculates capped acceleration and deceleration using cleaned speeds', () => {
    const result = calculateMaxGForce([point(0, 0), point(1, 40), point(2, 20), point(3, 0)])

    expect(result.maxAccelG).toBe(0.5)
    expect(result.maxDecelG).toBeGreaterThan(0)
    expect(result.maxAccelPointIndex).toBe(1)
    expect(result.maxDecelPointIndex).toBeGreaterThan(1)
  })
})
