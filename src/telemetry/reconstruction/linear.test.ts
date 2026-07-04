import { describe, expect, it } from 'vitest'
import type { TrackPoint } from '../../types/telemetry'
import { reconstructTrackLinear } from './linear'

function point(index: number, second: number, distanceM: number, speedKmh: number): TrackPoint {
  return {
    id: `point-${index}`,
    lat: -7.1,
    lon: 110.1 + index * 0.001,
    time: new Date(Date.UTC(2025, 2, 10, 0, 0, second)).toISOString(),
    distanceM,
    rawSpeedKmh: speedKmh,
    cleanedSpeedKmh: speedKmh,
    speedKmh,
    origin: 'derived',
  }
}

describe('reconstructTrackLinear', () => {
  it('resamples cleaned track points at 5 Hz without overwriting source points', () => {
    const reconstruction = reconstructTrackLinear([point(0, 0, 0, 50), point(1, 1, 10, 60)], 5)

    expect(reconstruction.sampleRateHz).toBe(5)
    expect(reconstruction.method).toBe('linear-v1')
    expect(reconstruction.points).toHaveLength(6)
    expect(reconstruction.points[0].origin).toBe('derived')
    expect(reconstruction.points[1].origin).toBe('estimated')
    expect(reconstruction.points[1].sourcePointIndexStart).toBe(0)
    expect(reconstruction.points[1].sourcePointIndexEnd).toBe(1)
    expect(reconstruction.points[1].confidence).toBeGreaterThan(0)
    expect(reconstruction.points.at(-1)?.speedKmh).toBe(60)
  })

  it('lowers reconstruction confidence across larger GPS time gaps', () => {
    const reconstruction = reconstructTrackLinear([point(0, 0, 0, 50), point(1, 8, 80, 60)], 5)
    const estimatedSamples = reconstruction.points.filter((sample) => sample.origin === 'estimated')

    expect(estimatedSamples.length).toBeGreaterThan(0)
    expect(estimatedSamples.every((sample) => (sample.confidence ?? 1) < 0.5)).toBe(true)
  })
})
