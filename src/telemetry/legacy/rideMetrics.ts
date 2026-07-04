import type { TrackEvent, TrackPoint } from '../../types/telemetry'
import { calculateMaxGForce } from '../physics/gforce'

export type LegacyRideMetrics = {
  durationS: number
  movingTimeS: number
  pausedTimeS: number
  trafficStopTimeS: number
  totalElevationM?: number
  elevationGainM?: number
  averageSpeedKmh: number
  topSpeedKmh: number
  maxAccelG: number
  maxDecelG: number
  maxAccelPointIndex: number
  maxDecelPointIndex: number
}

function eventDuration(events: TrackEvent[], kind: TrackEvent['kind']) {
  return events.filter((event) => event.kind === kind).reduce((total, event) => total + event.durationS, 0)
}

function elevationMetrics(points: TrackPoint[]) {
  const elevations = points.map((point) => point.ele).filter((ele): ele is number => ele !== undefined)

  if (!elevations.length) {
    return {
      totalElevationM: undefined,
      elevationGainM: undefined,
    }
  }

  const elevationGainM = elevations.reduce((gain, ele, index) => {
    if (index === 0) return gain
    const diff = ele - elevations[index - 1]
    return diff > 0 ? gain + diff : gain
  }, 0)

  return {
    totalElevationM: Math.max(...elevations) - Math.min(...elevations),
    elevationGainM,
  }
}

function pointSpeedKmh(point: TrackPoint) {
  return point.cleanedSpeedKmh ?? point.speedKmh ?? point.rawSpeedKmh ?? 0
}

export function calculateLegacyRideMetrics(points: TrackPoint[], events: TrackEvent[]): LegacyRideMetrics | undefined {
  if (points.length < 2) return undefined

  const firstTime = Date.parse(points[0].time)
  const lastTime = Date.parse(points[points.length - 1].time)
  const durationS = Math.max(0, (lastTime - firstTime) / 1000)
  const distanceM = points[points.length - 1].distanceM ?? 0
  const pausedTimeS = eventDuration(events, 'pause')
  const trafficStopTimeS = eventDuration(events, 'traffic-stop')
  const movingTimeS = Math.max(0, durationS - pausedTimeS - trafficStopTimeS)
  const gForce = calculateMaxGForce(points)

  return {
    durationS,
    movingTimeS,
    pausedTimeS,
    trafficStopTimeS,
    ...elevationMetrics(points),
    averageSpeedKmh: movingTimeS > 0 ? (distanceM / movingTimeS) * 3.6 : 0,
    topSpeedKmh: Math.max(...points.map(pointSpeedKmh)),
    ...gForce,
  }
}
