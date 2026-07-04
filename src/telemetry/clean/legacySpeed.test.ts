import { describe, expect, it } from 'vitest'
import { filterAndSmoothSpeeds, medianAbsoluteDeviation, processLegacySpeeds, smoothSpeeds } from './legacySpeed'

describe('legacy speed cleaning', () => {
  it('calculates median absolute deviation', () => {
    expect(medianAbsoluteDeviation([10, 10, 20, 30, 100], 20)).toBe(10)
  })

  it('preserves low speed samples during smoothing', () => {
    expect(smoothSpeeds([0, 5, 10, 20, 25])).toEqual([0, 5, 10, 20, 25])
  })

  it('reduces isolated speed jumps with legacy-compatible filtering', () => {
    const times = [0, 1, 2, 3, 4].map((second) => new Date(`2025-03-10T00:00:0${second}Z`))
    const speeds = filterAndSmoothSpeeds([20, 22, 120, 24, 25], times)

    expect(Math.max(...speeds)).toBeLessThan(120)
  })

  it('returns audit reasons for cleaned speed samples', () => {
    const times = [0, 1, 2, 3, 4].map((second) => new Date(`2025-03-10T00:00:0${second}Z`))
    const result = processLegacySpeeds([20, 22, 120, 24, 25], times)

    expect(result.speeds).toHaveLength(5)
    expect(result.audits[2].reasons.length).toBeGreaterThan(0)
    expect(result.audits.some((audit) => audit.reasons.includes('legacy-accel-jump'))).toBe(true)
  })
})
