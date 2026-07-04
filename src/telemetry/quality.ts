import type { TrackPoint, TrackQuality } from '../types/telemetry'

const TARGET_INTERVAL_S = 1
const GAP_THRESHOLD_S = 1.5

type ConfidenceLabel = TrackQuality['speedConfidence']

function percentile(sortedValues: number[], percentileValue: number) {
  if (!sortedValues.length) return undefined

  const index = Math.ceil((percentileValue / 100) * sortedValues.length) - 1
  return sortedValues[Math.min(Math.max(index, 0), sortedValues.length - 1)]
}

function countAuditReasons(points: TrackPoint[], predicate: (reason: string) => boolean) {
  return points.reduce<Record<string, number>>((counts, point) => {
    point.speedAudit?.filter(predicate).forEach((reason) => {
      counts[reason] = (counts[reason] ?? 0) + 1
    })

    return counts
  }, {})
}

function countPhysicsReasons(points: TrackPoint[]) {
  return points.reduce<Record<string, number>>((counts, point) => {
    point.physicsAudit?.forEach((reason) => {
      counts[reason] = (counts[reason] ?? 0) + 1
    })

    return counts
  }, {})
}

function confidenceFromScore(score: number): ConfidenceLabel {
  if (score >= 78) return 'high'
  if (score >= 48) return 'medium'
  return 'low'
}

function countReasonsMatching(counts: Record<string, number>, predicate: (reason: string) => boolean) {
  return Object.entries(counts).reduce((total, [reason, count]) => (predicate(reason) ? total + count : total), 0)
}

function buildConfidenceBreakdown({
  pointCount,
  timeCoveragePercent,
  gapCount,
  longestGapS,
  duplicatePoints,
  gpsJumps,
  physicsAuditCounts,
  validationPointCount,
}: {
  pointCount: number
  timeCoveragePercent?: number
  gapCount: number
  longestGapS?: number
  duplicatePoints: number
  gpsJumps: number
  physicsAuditCounts: Record<string, number>
  validationPointCount: number
}) {
  if (pointCount < 2) {
    return {
      routeShape: 'unknown' as const,
      speed: 'unknown' as const,
      acceleration: 'unknown' as const,
      reconstruction: 'unknown' as const,
    }
  }

  const duplicateRatio = duplicatePoints / pointCount
  const physicsRatio = validationPointCount ? countReasonsMatching(physicsAuditCounts, () => true) / validationPointCount : 0
  const speedPhysicsRatio = validationPointCount
    ? countReasonsMatching(
        physicsAuditCounts,
        (reason) => reason.includes('speed') || reason.includes('accel') || reason.includes('brake'),
      ) / validationPointCount
    : 0
  const accelPhysicsRatio = validationPointCount
    ? countReasonsMatching(
        physicsAuditCounts,
        (reason) => reason.includes('accel') || reason.includes('brake') || reason.includes('lateral-g'),
      ) / validationPointCount
    : 0
  const coveragePenalty = timeCoveragePercent === undefined ? 20 : Math.max(0, 100 - timeCoveragePercent) * 0.8
  const gapPenalty = Math.min(30, gapCount * 4 + Math.max(0, (longestGapS ?? 0) - 1.5) * 1.2)

  const routeShapeScore = 100 - coveragePenalty - gapPenalty - duplicateRatio * 140 - Math.min(25, gpsJumps * 4)
  const speedScore = 88 - gapPenalty * 0.6 - Math.min(38, speedPhysicsRatio * 260) - Math.min(25, gpsJumps * 5)
  const accelerationScore = 64 - gapPenalty * 0.8 - Math.min(44, accelPhysicsRatio * 320) - Math.min(12, physicsRatio * 80)
  const reconstructionScore = 92 - coveragePenalty * 0.55 - gapPenalty - Math.min(42, physicsRatio * 260)

  return {
    routeShape: confidenceFromScore(routeShapeScore),
    speed: confidenceFromScore(speedScore),
    acceleration: confidenceFromScore(accelerationScore),
    reconstruction: confidenceFromScore(reconstructionScore),
  }
}

export function buildTrackQuality(points: TrackPoint[], validationPoints: TrackPoint[] = points): TrackQuality {
  const intervals = points
    .slice(1)
    .map((point, index) => (Date.parse(point.time) - Date.parse(points[index].time)) / 1000)
    .filter((interval) => Number.isFinite(interval) && interval > 0)

  const medianInterval = intervals.length
    ? [...intervals].sort((a, b) => a - b)[Math.floor(intervals.length / 2)]
    : undefined
  const sortedIntervals = [...intervals].sort((a, b) => a - b)
  const p95IntervalS = percentile(sortedIntervals, 95)
  const maxIntervalS = sortedIntervals.at(-1)
  const firstTime = points[0] ? Date.parse(points[0].time) : undefined
  const lastTime = points.at(-1) ? Date.parse(points.at(-1)?.time ?? '') : undefined
  const durationS =
    firstTime !== undefined && lastTime !== undefined && Number.isFinite(firstTime) && Number.isFinite(lastTime)
      ? Math.max(0, (lastTime - firstTime) / 1000)
      : undefined
  const expectedPointCount1Hz = durationS !== undefined ? Math.floor(durationS / TARGET_INTERVAL_S) + 1 : undefined
  const actualPointCount = points.length
  const missingSeconds = intervals.reduce((missing, interval) => {
    if (interval <= TARGET_INTERVAL_S) return missing
    return missing + Math.max(0, Math.round(interval / TARGET_INTERVAL_S) - 1)
  }, 0)
  const gapIntervals = intervals.filter((interval) => interval > GAP_THRESHOLD_S)
  const gapCount = gapIntervals.length
  const longestGapS = gapIntervals.length ? Math.max(...gapIntervals) : undefined
  const timeCoveragePercent = expectedPointCount1Hz ? Math.min(100, (actualPointCount / expectedPointCount1Hz) * 100) : undefined
  const duplicatePoints = points.reduce((count, point, index) => {
    if (index === 0) return count
    const previous = points[index - 1]
    return previous.lat === point.lat && previous.lon === point.lon ? count + 1 : count
  }, 0)
  const maxSpeedKmh = Math.max(...points.map((point) => point.rawSpeedKmh ?? point.speedKmh ?? 0))
  const maxCleanedSpeedKmh = Math.max(...points.map((point) => point.cleanedSpeedKmh ?? point.speedKmh ?? 0))
  const anomalies = points.filter((point) => point.isAnomaly).length
  const validationAnomalies = validationPoints.filter((point) => point.isAnomaly).length
  const gpsJumps = points.filter((point) => (point.rawSpeedKmh ?? point.speedKmh ?? 0) > 180).length
  const gpsNoise = anomalies > 5 || duplicatePoints > points.length * 0.08 ? 'high' : anomalies > 0 ? 'medium' : 'low'
  const speedAuditCounts = countAuditReasons(validationPoints, () => true)
  const physicsAuditCounts = countPhysicsReasons(validationPoints)
  const finalAnomalyCounts = countAuditReasons(validationPoints, (reason) =>
    reason.startsWith('motorcycle-') || reason.startsWith('physics-'),
  )
  const processingAdjustmentCounts = countAuditReasons(points, (reason) => reason.startsWith('legacy-'))
  const confidenceBreakdown = buildConfidenceBreakdown({
    pointCount: points.length,
    timeCoveragePercent,
    gapCount,
    longestGapS,
    duplicatePoints,
    gpsJumps,
    physicsAuditCounts,
    validationPointCount: validationPoints.length,
  })

  return {
    samplingHz: medianInterval ? 1 / medianInterval : undefined,
    medianIntervalS: medianInterval,
    p95IntervalS,
    maxIntervalS,
    expectedPointCount1Hz,
    actualPointCount,
    timeCoveragePercent,
    missingSeconds,
    gapCount,
    longestGapS,
    duplicatePoints,
    gpsJumps,
    maxSpeedKmh,
    maxCleanedSpeedKmh,
    anomalies,
    gpsNoise,
    speedConfidence: confidenceBreakdown.speed,
    accelerationConfidence: confidenceBreakdown.acceleration,
    confidenceBreakdown,
    speedAuditCounts,
    physicsAuditCounts,
    finalAnomalyCounts,
    processingAdjustmentCounts,
    notes: [
      'Imported from consumer GPX. Advanced metrics should be treated as estimated.',
      ...(anomalies ? [`Flagged ${anomalies} measured anomaly sample(s).`] : []),
      ...(validationAnomalies > anomalies
        ? [`Flagged ${validationAnomalies - anomalies} additional reconstructed/validation anomaly sample(s).`]
        : []),
      ...(gpsJumps ? [`Detected ${gpsJumps} raw GPS speed jump(s).`] : []),
      ...(duplicatePoints ? [`Detected ${duplicatePoints} duplicate coordinate sample(s).`] : []),
      ...(gapCount ? [`Detected ${gapCount} GPS time gap(s); longest gap ${longestGapS?.toFixed(1)}s.`] : []),
    ],
  }
}
