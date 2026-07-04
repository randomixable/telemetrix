import { describe, expect, it } from 'vitest'
import type { TrackPoint } from '../types/telemetry'
import { buildTrackQuality } from './quality'

function point(index: number, speedAudit: string[] = [], isAnomaly = false): TrackPoint {
  return {
    id: `point-${index}`,
    lat: -7.1,
    lon: 110.1,
    time: `2025-03-10T00:00:${String(index).padStart(2, '0')}Z`,
    rawSpeedKmh: 60,
    cleanedSpeedKmh: 60,
    speedAudit,
    isAnomaly,
    origin: 'derived',
  }
}

function timedPoint(index: number, second: number): TrackPoint {
  return {
    ...point(index),
    lat: -7.1 + index * 0.001,
    lon: 110.1 + index * 0.001,
    time: `2025-03-10T00:00:${String(second).padStart(2, '0')}Z`,
  }
}

describe('buildTrackQuality', () => {
  it('separates final anomaly counts from processing adjustment counts', () => {
    const quality = buildTrackQuality([
      point(0),
      point(1, ['legacy-moving-average', 'motorcycle-speed-above-plausible'], true),
      point(2, ['legacy-moving-average', 'legacy-accel-jump']),
    ])

    expect(quality.anomalies).toBe(1)
    expect(quality.finalAnomalyCounts).toEqual({
      'motorcycle-speed-above-plausible': 1,
    })
    expect(quality.processingAdjustmentCounts).toEqual({
      'legacy-moving-average': 2,
      'legacy-accel-jump': 1,
    })
  })

  it('includes physics validation reasons in final anomaly counts', () => {
    const measured = [point(0), point(1)]
    const validation = [point(0), point(1, ['physics-lateral-g'], true)]
    validation[1].physicsAudit = ['physics-lateral-g']

    const quality = buildTrackQuality(measured, validation)

    expect(quality.finalAnomalyCounts).toEqual({
      'physics-lateral-g': 1,
    })
    expect(quality.physicsAuditCounts).toEqual({
      'physics-lateral-g': 1,
    })
    expect(quality.confidenceBreakdown?.acceleration).toBe('low')
  })

  it('builds separate confidence labels for route, speed, acceleration, and reconstruction', () => {
    const quality = buildTrackQuality([timedPoint(0, 0), timedPoint(1, 1), timedPoint(2, 2), timedPoint(3, 3)])

    expect(quality.confidenceBreakdown).toEqual({
      routeShape: 'high',
      speed: 'high',
      acceleration: 'medium',
      reconstruction: 'high',
    })
    expect(quality.speedConfidence).toBe('high')
    expect(quality.accelerationConfidence).toBe('medium')
  })

  it('audits time coverage and GPS gaps against an expected 1 Hz timeline', () => {
    const quality = buildTrackQuality([timedPoint(0, 0), timedPoint(1, 1), timedPoint(2, 5), timedPoint(3, 6)])

    expect(quality.actualPointCount).toBe(4)
    expect(quality.expectedPointCount1Hz).toBe(7)
    expect(quality.timeCoveragePercent).toBeCloseTo(57.14, 2)
    expect(quality.missingSeconds).toBe(3)
    expect(quality.gapCount).toBe(1)
    expect(quality.longestGapS).toBe(4)
    expect(quality.medianIntervalS).toBe(1)
    expect(quality.p95IntervalS).toBe(4)
    expect(quality.maxIntervalS).toBe(4)
  })
})
