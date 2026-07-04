import { describe, expect, it } from 'vitest'
import type { TrackPoint } from '../../types/telemetry'
import { detectStopEvents } from './stops'

function point(index: number, time: string, lat = -7.1, lon = 110.1): TrackPoint {
  return {
    id: `point-${index}`,
    lat,
    lon,
    time,
    origin: 'derived',
  }
}

describe('detectStopEvents', () => {
  it('detects legacy-compatible pause and traffic stop events', () => {
    const events = detectStopEvents([
      point(0, '2025-03-10T00:00:00Z'),
      point(1, '2025-03-10T00:00:20Z'),
      point(2, '2025-03-10T00:05:00Z'),
    ])

    expect(events.some((event) => event.kind === 'traffic-stop' && event.durationS === 20)).toBe(true)
    expect(events.some((event) => event.kind === 'pause' && event.durationS === 280)).toBe(true)
  })

  it('merges nearby traffic stops', () => {
    const events = detectStopEvents([
      point(0, '2025-03-10T00:00:00Z'),
      point(1, '2025-03-10T00:00:20Z'),
      point(2, '2025-03-10T00:00:50Z', -7.10001, 110.10001),
    ])

    const trafficStops = events.filter((event) => event.kind === 'traffic-stop')
    expect(trafficStops).toHaveLength(1)
    expect(trafficStops[0].durationS).toBe(50)
  })
})
