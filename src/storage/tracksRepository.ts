import { db } from './db'
import type { StoredTrack } from '../types/telemetry'

export async function saveTrack(track: StoredTrack) {
  await db.tracks.put(track)
  return track
}

export function listTracks() {
  return db.tracks.orderBy('createdAt').reverse().toArray()
}

export function getTrack(trackId: string) {
  return db.tracks.get(trackId)
}

export function deleteTrack(trackId: string) {
  return db.tracks.delete(trackId)
}

export function clearTracks() {
  return db.tracks.clear()
}
