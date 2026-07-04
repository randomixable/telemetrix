import { describe, expect, it } from 'vitest'
import type { TrackPoint } from '../../types/telemetry'
import { reconstructTrackDistanceV2 } from './distance'

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

function jitterPoint(index: number, second: number, distanceM: number): TrackPoint {
  return {
    ...point(index, second, distanceM, 117),
    lat: -7.1 + (index % 2 === 0 ? 0.00001 : -0.00001),
    lon: 110.1 + index * 0.0001,
  }
}

describe('reconstructTrackDistanceV2', () => {
  it('resamples cleaned track points at 5 Hz using monotone cumulative distance', () => {
    const reconstruction = reconstructTrackDistanceV2([point(0, 0, 0, 50), point(1, 1, 10, 60)], 5)

    expect(reconstruction.sampleRateHz).toBe(5)
    expect(reconstruction.method).toBe('distance-v2')
    expect(reconstruction.points).toHaveLength(6)
    expect(reconstruction.points[0].origin).toBe('derived')
    expect(reconstruction.points[1].origin).toBe('estimated')
    expect(reconstruction.points[1].distanceM).toBe(2)
    expect(reconstruction.points.at(-1)?.distanceM).toBe(10)
  })

  it('prevents reconstructed distance from moving backward', () => {
    const reconstruction = reconstructTrackDistanceV2([point(0, 0, 20, 50), point(1, 1, 10, 60)], 5)
    const distances = reconstruction.points.map((sample) => sample.distanceM ?? 0)

    expect(distances.every((distance, index) => index === 0 || distance >= distances[index - 1])).toBe(true)
    expect(distances.at(-1)).toBe(20)
  })

  it('lowers confidence across larger GPS time gaps', () => {
    const reconstruction = reconstructTrackDistanceV2([point(0, 0, 0, 50), point(1, 8, 80, 60)], 5)
    const estimatedSamples = reconstruction.points.filter((sample) => sample.origin === 'estimated')

    expect(estimatedSamples.length).toBeGreaterThan(0)
    expect(estimatedSamples.every((sample) => (sample.confidence ?? 1) < 0.5)).toBe(true)
  })

  it('keeps high-speed straight jitter from producing impossible lateral G', () => {
    const sourcePoints = Array.from({ length: 12 }, (_, index) => jitterPoint(index, index, index * 10))
    const reconstruction = reconstructTrackDistanceV2(sourcePoints, 5)
    const maxLateralG = Math.max(...reconstruction.points.map((sample) => sample.lateralG ?? 0))

    expect(maxLateralG).toBeLessThan(0.75)
  })

  it('uses anchor interval acceleration for synthetic reconstructed samples', () => {
    const reconstruction = reconstructTrackDistanceV2([point(0, 0, 0, 80), point(1, 1, 20, 40)], 5)
    const syntheticSamples = reconstruction.points.filter((sample) => sample.origin === 'estimated')

    expect(syntheticSamples.length).toBeGreaterThan(0)
    expect(syntheticSamples.every((sample) => sample.accelerationG === syntheticSamples[0].accelerationG)).toBe(true)
    expect(syntheticSamples[0].accelerationG).toBeCloseTo(-1.133, 3)
  })
})
