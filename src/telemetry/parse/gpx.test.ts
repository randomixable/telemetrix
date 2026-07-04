import { describe, expect, it } from 'vitest'
import { parseGpxPoints } from './gpx'
import { processGpxTrack } from '../pipeline/processTrack'

describe('parseGpxTrack', () => {
  it('parses GPX into raw points before telemetry processing', () => {
    const points = parseGpxPoints(
      'raw.gpx',
      `<?xml version="1.0" encoding="UTF-8"?>
      <gpx version="1.1" creator="test">
        <trk><trkseg>
          <trkpt lat="-7.1" lon="110.1"><ele>100</ele><time>2025-03-10T00:00:00Z</time></trkpt>
        </trkseg></trk>
      </gpx>`,
    )

    expect(points).toEqual([
      {
        id: 'raw.gpx-0',
        lat: -7.1,
        lon: 110.1,
        ele: 100,
        time: '2025-03-10T00:00:00Z',
        origin: 'derived',
      },
    ])
  })

  it('parses GPX track points and derives summary metrics', () => {
    const track = processGpxTrack(
      'sample.gpx',
      `<?xml version="1.0" encoding="UTF-8"?>
      <gpx version="1.1" creator="test">
        <trk><trkseg>
          <trkpt lat="-7.1" lon="110.1"><ele>100</ele><time>2025-03-10T00:00:00Z</time></trkpt>
          <trkpt lat="-7.1001" lon="110.1001"><ele>101</ele><time>2025-03-10T00:00:01Z</time></trkpt>
        </trkseg></trk>
      </gpx>`,
    )

    expect(track.source).toBe('gpx')
    expect(track.points).toHaveLength(2)
    expect(track.summary?.distanceKm).toBeGreaterThan(0)
    expect(track.summary?.startTime).toBe('2025-03-10T00:00:00Z')
    expect(track.summary?.finishTime).toBe('2025-03-10T00:00:01Z')
    expect(track.summary?.totalElevationM).toBe(1)
    expect(track.reconstruction?.sampleRateHz).toBe(5)
    expect(track.reconstruction?.method).toBe('distance-v2')
    expect(track.reconstruction?.points.some((point) => point.origin === 'estimated')).toBe(true)
    expect(track.quality.samplingHz).toBe(1)
  })

  it('flags duplicate coordinates and possible GPS jumps', () => {
    const track = processGpxTrack(
      'noisy.gpx',
      `<?xml version="1.0" encoding="UTF-8"?>
      <gpx version="1.1" creator="test">
        <trk><trkseg>
          <trkpt lat="-7.1" lon="110.1"><time>2025-03-10T00:00:00Z</time></trkpt>
          <trkpt lat="-7.1" lon="110.1"><time>2025-03-10T00:00:01Z</time></trkpt>
          <trkpt lat="-7.2" lon="110.2"><time>2025-03-10T00:00:02Z</time></trkpt>
        </trkseg></trk>
      </gpx>`,
    )

    expect(track.quality.duplicatePoints).toBe(1)
    expect(track.quality.gpsJumps).toBeGreaterThan(0)
    expect(track.quality.anomalies).toBeGreaterThan(0)
    expect(track.quality.maxCleanedSpeedKmh).toBeLessThan(track.quality.maxSpeedKmh)
    expect(track.points.some((point) => point.isAnomaly)).toBe(true)
    expect(track.points.some((point) => point.cleanedSpeedKmh !== point.rawSpeedKmh)).toBe(true)
    expect(track.quality.gpsNoise).toBe('high')
  })
})
