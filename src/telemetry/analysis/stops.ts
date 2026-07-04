import type { TrackEvent, TrackPoint } from '../../types/telemetry'
import { calculateDistanceMeters } from '../physics/distance'

const PAUSE_THRESHOLD_MS = 3 * 60 * 1000
const TRAFFIC_LIGHT_MIN_MS = 10 * 1000
const TRAFFIC_LIGHT_MAX_MS = 2 * 60 * 1000
const STOP_DISTANCE_THRESHOLD_M = 15
const MERGE_DISTANCE_THRESHOLD_M = 20

type StopCandidate = TrackEvent

function timeDiffMs(previous: TrackPoint, current: TrackPoint) {
  return Date.parse(current.time) - Date.parse(previous.time)
}

function mergeTrafficStops(stops: StopCandidate[]) {
  const normalized: StopCandidate[] = []

  stops.forEach((stop) => {
    const nearbyStop = normalized.find(
      (candidate) => calculateDistanceMeters(candidate, stop) < MERGE_DISTANCE_THRESHOLD_M,
    )

    if (nearbyStop) {
      nearbyStop.durationS += stop.durationS
      return
    }

    normalized.push({ ...stop })
  })

  return normalized
}

export function detectStopEvents(points: TrackPoint[]): TrackEvent[] {
  const pauses: TrackEvent[] = []
  const trafficStops: TrackEvent[] = []

  for (let i = 1; i < points.length; i++) {
    const previous = points[i - 1]
    const current = points[i]
    const dtMs = timeDiffMs(previous, current)
    const distanceM = calculateDistanceMeters(previous, current)

    if (dtMs > PAUSE_THRESHOLD_MS) {
      pauses.push({
        id: `${current.id}-pause`,
        kind: 'pause',
        pointIndex: i,
        lat: current.lat,
        lon: current.lon,
        durationS: dtMs / 1000,
      })
    }

    if (dtMs >= TRAFFIC_LIGHT_MIN_MS && dtMs <= TRAFFIC_LIGHT_MAX_MS && distanceM < STOP_DISTANCE_THRESHOLD_M) {
      trafficStops.push({
        id: `${current.id}-traffic-stop`,
        kind: 'traffic-stop',
        pointIndex: i,
        lat: current.lat,
        lon: current.lon,
        durationS: dtMs / 1000,
      })
    }
  }

  return [...pauses, ...mergeTrafficStops(trafficStops)]
}
