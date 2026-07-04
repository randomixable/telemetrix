import Dexie, { type Table } from 'dexie'
import type { MotorcycleProfile } from '../motorcycles/motorcycleTypes'
import type { StoredTrack } from '../types/telemetry'

export class TelemetrixDatabase extends Dexie {
  tracks!: Table<StoredTrack, string>
  motorcycles!: Table<MotorcycleProfile, string>

  constructor() {
    super('telemetrix')

    this.version(1).stores({
      tracks: 'id, name, createdAt, source, motorcycleId',
      motorcycles: 'id, name, category',
    })
  }
}

export const db = new TelemetrixDatabase()
