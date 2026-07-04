import type { TrackEvent, TrackPoint, TrackSummary } from '../types/telemetry'
import { calculateLegacyRideMetrics } from './legacy/rideMetrics'

export function buildTrackSummary(points: TrackPoint[], events: TrackEvent[]): TrackSummary | undefined {
  const metrics = calculateLegacyRideMetrics(points, events)
  if (!metrics) return undefined

  const distanceM = points[points.length - 1].distanceM ?? 0
  const pauseEvents = events.filter((event) => event.kind === 'pause')
  const trafficStopEvents = events.filter((event) => event.kind === 'traffic-stop')

  return {
    distanceKm: distanceM / 1000,
    durationS: metrics.durationS,
    movingTimeS: metrics.movingTimeS,
    averageSpeedKmh: metrics.averageSpeedKmh,
    topSpeedKmh: metrics.topSpeedKmh,
    startTime: points[0].time,
    finishTime: points[points.length - 1].time,
    totalElevationM: metrics.totalElevationM,
    elevationGainM: metrics.elevationGainM,
    pauseCount: pauseEvents.length,
    trafficStopCount: trafficStopEvents.length,
    pausedTimeS: metrics.pausedTimeS,
    trafficStopTimeS: metrics.trafficStopTimeS,
    maxAccelG: metrics.maxAccelG,
    maxDecelG: metrics.maxDecelG,
    maxAccelPointIndex: metrics.maxAccelPointIndex,
    maxDecelPointIndex: metrics.maxDecelPointIndex,
  }
}
