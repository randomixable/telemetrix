import { describe, expect, it } from 'vitest'
import type { TrackEvent, TrackPoint } from '../../types/telemetry'
import { calculateLegacyRideMetrics } from './rideMetrics'

function point(index: number, speedKmh: number, ele = 100): TrackPoint {
  return {
    id: `point-${index}`,
    lat: -7.1,
    lon: 110.1,
    ele,
    time: `2025-03-10T00:00:${String(index).padStart(2, '0')}Z`,
    distanceM: index * 100,
    cleanedSpeedKmh: speedKmh,
    speedKmh,
    origin: 'derived',
  }
}

describe('calculateLegacyRideMetrics', () => {
  it('matches legacy summary semantics for moving time, elevation range, and G-force caps', () => {
    const events: TrackEvent[] = [
      {
        id: 'stop-1',
        kind: 'traffic-stop',
        pointIndex: 2,
        lat: -7.1,
        lon: 110.1,
        durationS: 2,
      },
    ]

    const metrics = calculateLegacyRideMetrics(
      [point(0, 0, 100), point(1, 40, 103), point(2, 20, 101), point(3, 0, 105)],
      events,
    )

    expect(metrics?.durationS).toBe(3)
    expect(metrics?.movingTimeS).toBe(1)
    expect(metrics?.trafficStopTimeS).toBe(2)
    expect(metrics?.totalElevationM).toBe(5)
    expect(metrics?.elevationGainM).toBe(7)
    expect(metrics?.topSpeedKmh).toBe(40)
    expect(metrics?.maxAccelG).toBe(0.5)
    expect(metrics?.maxDecelG).toBeGreaterThan(0)
  })
})
