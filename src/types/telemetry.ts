export type TelemetrySource = 'gpx' | 'geojson'

export type MetricOrigin = 'measured' | 'derived' | 'estimated' | 'experimental'

export type TrackPoint = {
  id: string
  lat: number
  lon: number
  ele?: number
  time: string
  distanceM?: number
  speedKmh?: number
  rawSpeedKmh?: number
  cleanedSpeedKmh?: number
  accelerationG?: number
  headingDeg?: number
  curvature?: number
  lateralG?: number
  confidence?: number
  sourcePointIndexStart?: number
  sourcePointIndexEnd?: number
  isAnomaly?: boolean
  anomalyReason?: string
  speedAudit?: string[]
  physicsAudit?: string[]
  origin?: MetricOrigin
}

export type TelemetryDisplayMode = 'raw' | 'cleaned' | 'reconstructed'

export type TrackReconstruction = {
  sampleRateHz: number
  method: 'linear-v1' | 'distance-v2'
  points: TrackPoint[]
}

export type TrackQuality = {
  samplingHz?: number
  medianIntervalS?: number
  p95IntervalS?: number
  maxIntervalS?: number
  expectedPointCount1Hz?: number
  actualPointCount: number
  timeCoveragePercent?: number
  missingSeconds?: number
  gapCount: number
  longestGapS?: number
  duplicatePoints: number
  gpsJumps: number
  maxSpeedKmh: number
  maxCleanedSpeedKmh: number
  anomalies: number
  gpsNoise: 'unknown' | 'low' | 'medium' | 'high'
  speedConfidence: 'unknown' | 'low' | 'medium' | 'high'
  accelerationConfidence: 'unknown' | 'low' | 'medium' | 'high'
  confidenceBreakdown?: {
    routeShape: 'unknown' | 'low' | 'medium' | 'high'
    speed: 'unknown' | 'low' | 'medium' | 'high'
    acceleration: 'unknown' | 'low' | 'medium' | 'high'
    reconstruction: 'unknown' | 'low' | 'medium' | 'high'
  }
  speedAuditCounts?: Record<string, number>
  physicsAuditCounts?: Record<string, number>
  finalAnomalyCounts?: Record<string, number>
  processingAdjustmentCounts?: Record<string, number>
  notes: string[]
}

export type TrackSummary = {
  distanceKm: number
  durationS: number
  movingTimeS: number
  averageSpeedKmh: number
  topSpeedKmh: number
  startTime?: string
  finishTime?: string
  totalElevationM?: number
  elevationGainM?: number
  pauseCount?: number
  trafficStopCount?: number
  pausedTimeS?: number
  trafficStopTimeS?: number
  maxAccelG?: number
  maxDecelG?: number
  maxAccelPointIndex?: number
  maxDecelPointIndex?: number
}

export type TrackEventKind = 'pause' | 'traffic-stop'

export type TrackEvent = {
  id: string
  kind: TrackEventKind
  pointIndex: number
  lat: number
  lon: number
  durationS: number
}

export type TrackSector = {
  id: string
  index: number
  startDistanceKm: number
  endDistanceKm: number
  pointCount: number
  durationS: number
  movingTimeS: number
  averageSpeedKmh: number
  topSpeedKmh: number
  elevationGainM: number
  elevationLossM: number
  stopCount: number
  anomalyCount: number
  confidence: 'unknown' | 'low' | 'medium' | 'high'
}

export type StoredTrack = {
  id: string
  name: string
  createdAt: string
  source: TelemetrySource
  sourceFileName: string
  motorcycleId?: string
  rawFile?: Blob
  points: TrackPoint[]
  reconstruction?: TrackReconstruction
  events?: TrackEvent[]
  quality: TrackQuality
  summary?: TrackSummary
}
