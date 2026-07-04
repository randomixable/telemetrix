import type { StoredTrack, TelemetryDisplayMode, TrackPoint } from '../../types/telemetry'

export function getDisplayPoints(track: StoredTrack, mode: TelemetryDisplayMode): TrackPoint[] {
  if (mode === 'reconstructed' && track.reconstruction?.points.length) return track.reconstruction.points

  if (mode === 'raw') {
    return track.points.map((point) => ({
      ...point,
      speedKmh: point.rawSpeedKmh ?? point.speedKmh ?? 0,
    }))
  }

  return track.points.map((point) => ({
    ...point,
    speedKmh: point.cleanedSpeedKmh ?? point.speedKmh ?? point.rawSpeedKmh ?? 0,
  }))
}
