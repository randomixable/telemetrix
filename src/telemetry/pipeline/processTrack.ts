import type { MotorcycleProfile } from '../../motorcycles/motorcycleTypes'
import { defaultMotorcycleProfile } from '../../motorcycles/defaultProfiles'
import type { StoredTrack } from '../../types/telemetry'
import { detectStopEvents } from '../analysis/stops'
import { cleanSpeedWithMotorcycleConstraints } from '../clean/speed'
import { processLegacySpeeds } from '../clean/legacySpeed'
import { deriveKinematics } from '../derive/kinematics'
import { parseGpxPoints } from '../parse/gpx'
import { buildTrackQuality } from '../quality'
import { reconstructTrackDistanceV2 } from '../reconstruction/distance'
import { buildTrackSummary } from '../summary'
import { validatePhysicsConstraints } from '../validation/physics'

type DerivedTrackPoints = ReturnType<typeof deriveKinematics>

export type TrackProcessingProgress = {
  step: number
  total: number
  label: string
}

export type TrackProcessingProgressHandler = (progress: TrackProcessingProgress) => void

const PROCESSING_TOTAL_STEPS = 8

function reportProgress(onProgress: TrackProcessingProgressHandler | undefined, step: number, label: string) {
  onProgress?.({ step, total: PROCESSING_TOTAL_STEPS, label })
}

function applyLegacySpeedSmoothing(points: DerivedTrackPoints): DerivedTrackPoints {
  const rawSpeeds = points.map((point) => point.rawSpeedKmh ?? 0)
  const times = points.map((point) => new Date(point.time))
  const legacyResult = processLegacySpeeds(rawSpeeds, times)

  return points.map((point, index) => ({
    ...point,
    cleanedSpeedKmh: legacyResult.speeds[index] ?? point.rawSpeedKmh ?? 0,
    speedKmh: legacyResult.speeds[index] ?? point.rawSpeedKmh ?? 0,
    speedAudit: legacyResult.audits[index]?.reasons ?? [],
  }))
}

export function processGpxTrack(
  fileName: string,
  gpxText: string,
  rawFile?: Blob,
  motorcycle: MotorcycleProfile = defaultMotorcycleProfile,
  onProgress?: TrackProcessingProgressHandler,
): StoredTrack {
  reportProgress(onProgress, 1, 'Parsing GPX')
  const rawPoints = parseGpxPoints(fileName, gpxText)
  reportProgress(onProgress, 2, 'Deriving distance and speed')
  const derivedPoints = deriveKinematics(rawPoints)
  reportProgress(onProgress, 3, 'Cleaning speed')
  const legacySmoothedPoints = applyLegacySpeedSmoothing(derivedPoints)
  reportProgress(onProgress, 4, 'Applying motorcycle constraints')
  const points = validatePhysicsConstraints(cleanSpeedWithMotorcycleConstraints(legacySmoothedPoints, motorcycle), motorcycle)
  reportProgress(onProgress, 5, 'Reconstructing 5 Hz telemetry')
  const reconstruction = reconstructTrackDistanceV2(points, 5)
  reportProgress(onProgress, 6, 'Validating reconstructed telemetry')
  const validatedReconstruction = {
    ...reconstruction,
    points: validatePhysicsConstraints(reconstruction.points, motorcycle),
  }
  reportProgress(onProgress, 7, 'Detecting events')
  const events = detectStopEvents(points)
  const createdAt = new Date().toISOString()
  reportProgress(onProgress, 8, 'Building quality audit')

  return {
    id: crypto.randomUUID(),
    name: fileName.replace(/\.gpx$/i, ''),
    createdAt,
    source: 'gpx',
    sourceFileName: fileName,
    rawFile,
    points,
    reconstruction: validatedReconstruction,
    events,
    motorcycleId: motorcycle.id,
    quality: buildTrackQuality(points, validatedReconstruction.points),
    summary: buildTrackSummary(points, events),
  }
}
