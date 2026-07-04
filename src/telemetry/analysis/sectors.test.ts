import { describe, expect, it } from 'vitest'
import type { StoredTrack, TrackPoint } from '../../types/telemetry'
import { buildDistanceSectors } from './sectors'

function point(index: number, distanceKm: number, speedKmh = 60): TrackPoint {
  return {
    id: `point-${index}`,
    lat: -7.1,
    lon: 110.1,
    time: new Date(Date.UTC(2025, 2, 10, 0, index, 0)).toISOString(),
    distanceM: distanceKm * 1000,
    speedKmh,
    cleanedSpeedKmh: speedKmh,
    ele: 100 + index,
    origin: 'derived',
  }
}

function track(points: TrackPoint[]): StoredTrack {
  return {
    id: 'track-1',
    name: 'Track 1',
    createdAt: '2025-03-10T00:00:00Z',
    source: 'gpx',
    sourceFileName: 'track.gpx',
    points,
    events: [{ id: 'stop-1', kind: 'traffic-stop', pointIndex: 2, lat: -7.1, lon: 110.1, durationS: 20 }],
    quality: {
      actualPointCount: points.length,
      gapCount: 0,
      duplicatePoints: 0,
      gpsJumps: 0,
      maxSpeedKmh: 60,
      maxCleanedSpeedKmh: 60,
      anomalies: 0,
      gpsNoise: 'low',
      speedConfidence: 'medium',
      accelerationConfidence: 'low',
      notes: [],
    },
    summary: {
      distanceKm: 12,
      durationS: 180,
      movingTimeS: 180,
      averageSpeedKmh: 240,
      topSpeedKmh: 60,
    },
  }
}

describe('buildDistanceSectors', () => {
  it('splits a track into configurable distance sectors', () => {
    const sectors = buildDistanceSectors(track([point(0, 0), point(1, 5), point(2, 10), point(3, 12)]), 5)

    expect(sectors).toHaveLength(3)
    expect(sectors[0].startDistanceKm).toBe(0)
    expect(sectors[0].endDistanceKm).toBe(5)
    expect(sectors[1].startDistanceKm).toBe(5)
    expect(sectors[1].endDistanceKm).toBe(10)
    expect(sectors[2].endDistanceKm).toBe(12)
  })

  it('counts stops and anomalies inside each sector', () => {
    const points = [point(0, 0), point(1, 5), { ...point(2, 10), isAnomaly: true }, point(3, 12)]
    const sectors = buildDistanceSectors(track(points), 10)

    expect(sectors).toHaveLength(2)
    expect(sectors[0].stopCount).toBe(1)
    expect(sectors[0].anomalyCount).toBe(1)
    expect(sectors[0].confidence).toBe('low')
  })
})
