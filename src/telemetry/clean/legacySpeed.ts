export function medianAbsoluteDeviation(data: number[], median: number) {
  const deviations = data.map((value) => Math.abs(value - median)).sort((a, b) => a - b)
  return deviations[Math.floor(deviations.length / 2)] ?? 0
}

export type LegacySpeedAudit = {
  rawSpeedKmh: number
  filteredSpeedKmh: number
  cleanedSpeedKmh: number
  reasons: string[]
}

export type LegacySpeedProcessingResult = {
  speeds: number[]
  audits: LegacySpeedAudit[]
}

function calculateAcceleration(speeds: number[], times: Date[], index: number) {
  const dt1 = (times[index].getTime() - times[index - 1].getTime()) / 1000
  const dt2 =
    index + 1 < times.length && times[index + 1]
      ? (times[index + 1].getTime() - times[index].getTime()) / 1000
      : dt1

  const accel1 = dt1 > 0 ? (speeds[index] - speeds[index - 1]) / dt1 : 0
  const accel2 = index + 1 < speeds.length && dt2 > 0 ? (speeds[index + 1] - speeds[index]) / dt2 : accel1

  return { accel1, accel2 }
}

function createAudits(speeds: number[]): LegacySpeedAudit[] {
  return speeds.map((speed) => ({
    rawSpeedKmh: speed,
    filteredSpeedKmh: speed,
    cleanedSpeedKmh: speed,
    reasons: [],
  }))
}

function addReason(audits: LegacySpeedAudit[], index: number, reason: string) {
  if (!audits[index] || audits[index].reasons.includes(reason)) return
  audits[index].reasons.push(reason)
}

function handleOutliers(
  speeds: number[],
  times: Date[],
  maxAccel: number,
  maxDecel: number,
  maxJump: number,
  audits?: LegacySpeedAudit[],
) {
  const filteredSpeeds = [...speeds]

  for (let i = 1; i < speeds.length - 1; i++) {
    if (!times[i] || !times[i - 1]) continue

    const { accel1, accel2 } = calculateAcceleration(speeds, times, i)

    if (accel1 > maxAccel || accel1 < maxDecel || accel2 > maxAccel || accel2 < maxDecel) {
      const prevSpeed = filteredSpeeds[i - 1]
      filteredSpeeds[i] = Math.min(Math.max(prevSpeed - maxJump, speeds[i]), prevSpeed + maxJump)
      addReason(audits ?? [], i, 'legacy-accel-jump')
    }
  }

  audits?.forEach((audit, index) => {
    audit.filteredSpeedKmh = filteredSpeeds[index] ?? audit.filteredSpeedKmh
  })

  return filteredSpeeds
}

export function detectOutliers(
  speeds: number[],
  times: Date[],
  maxAccel = 4,
  maxDecel = -9.8,
  maxJump = 20,
  audits?: LegacySpeedAudit[],
) {
  if (!Array.isArray(speeds) || !Array.isArray(times) || speeds.length < 3 || times.length < 3) {
    return speeds || []
  }

  const medianSpeed = [...speeds].sort((a, b) => a - b)[Math.floor(speeds.length / 2)] ?? 0
  const mad = medianAbsoluteDeviation(speeds, medianSpeed)

  const filteredSpeeds = speeds.map((speed, index) => {
    if (mad > 0 && Math.abs(speed - medianSpeed) > 3 * mad) {
      addReason(audits ?? [], index, 'legacy-mad-outlier')
      return index > 0 ? speeds[index - 1] : speed
    }

    return speed
  })

  return handleOutliers(filteredSpeeds, times, maxAccel, maxDecel, maxJump, audits)
}

export function smoothSpeeds(speeds: number[], windowSize = 5, audits?: LegacySpeedAudit[]) {
  if (speeds.length < 2) return speeds

  const smoothed: number[] = []
  for (let i = 0; i < speeds.length; i++) {
    const start = Math.max(0, i - Math.floor(windowSize / 2))
    const end = Math.min(speeds.length - 1, i + Math.floor(windowSize / 2))

    let sum = 0
    let count = 0
    for (let j = start; j <= end; j++) {
      sum += speeds[j]
      count++
    }

    const avgSpeed = sum / count

    if (Math.abs(speeds[i] - avgSpeed) > 10) {
      smoothed.push(speeds[i])
    } else if (speeds[i] < 30) {
      smoothed.push(speeds[i])
    } else {
      smoothed.push(avgSpeed)
      if (Math.abs(avgSpeed - speeds[i]) > 0.01) addReason(audits ?? [], i, 'legacy-moving-average')
    }
  }

  audits?.forEach((audit, index) => {
    audit.cleanedSpeedKmh = smoothed[index] ?? audit.cleanedSpeedKmh
  })

  return smoothed
}

export function processLegacySpeeds(
  speeds: number[],
  times: Date[],
  maxAccel = 1.72,
  maxDecel = -9.8,
  stopThreshold = 2,
): LegacySpeedProcessingResult {
  const audits = createAudits(speeds)

  if (speeds.length < 3) {
    return { speeds, audits }
  }

  const filteredSpeeds = detectOutliers(speeds, times, maxAccel, maxDecel, 20, audits)

  for (let i = 1; i < speeds.length - 1; i++) {
    if (filteredSpeeds[i] < stopThreshold && filteredSpeeds[i - 1] < stopThreshold) {
      filteredSpeeds[i] = 0
      addReason(audits, i, 'legacy-stop-threshold')
    }
  }

  audits.forEach((audit, index) => {
    audit.filteredSpeedKmh = filteredSpeeds[index] ?? audit.filteredSpeedKmh
  })

  return {
    speeds: smoothSpeeds(filteredSpeeds, 5, audits),
    audits,
  }
}

export function filterAndSmoothSpeeds(
  speeds: number[],
  times: Date[],
  maxAccel = 1.72,
  maxDecel = -9.8,
  stopThreshold = 2,
) {
  return processLegacySpeeds(speeds, times, maxAccel, maxDecel, stopThreshold).speeds
}
