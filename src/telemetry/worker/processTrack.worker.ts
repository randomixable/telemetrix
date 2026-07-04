import { expose } from 'comlink'
import type { MotorcycleProfile } from '../../motorcycles/motorcycleTypes'
import { processGpxTrack, type TrackProcessingProgressHandler } from '../pipeline/processTrack'

export type ProcessGpxTrackInput = {
  fileName: string
  gpxText: string
  motorcycle: MotorcycleProfile
}

const telemetryWorkerApi = {
  processGpxTrack({ fileName, gpxText, motorcycle }: ProcessGpxTrackInput, onProgress?: TrackProcessingProgressHandler) {
    return processGpxTrack(fileName, gpxText, undefined, motorcycle, onProgress)
  },
}

export type TelemetryWorkerApi = typeof telemetryWorkerApi

expose(telemetryWorkerApi)
