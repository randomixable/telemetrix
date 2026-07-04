import { create } from 'zustand'
import { defaultMotorcycleProfile } from '../motorcycles/defaultProfiles'
import type { SectorDistanceKm } from '../telemetry/analysis/sectors'
import type { TelemetryDisplayMode } from '../types/telemetry'

const activeTrackStorageKey = 'telemetrix.activeTrackId'
const sectorDistanceStorageKey = 'telemetrix.sectorDistanceKm'
const telemetryDisplayModeStorageKey = 'telemetrix.telemetryDisplayMode'

function readStoredActiveTrackId() {
  return typeof window === 'undefined' ? null : window.localStorage.getItem(activeTrackStorageKey)
}

function writeStoredActiveTrackId(trackId: string | null) {
  if (typeof window === 'undefined') return
  if (trackId) {
    window.localStorage.setItem(activeTrackStorageKey, trackId)
  } else {
    window.localStorage.removeItem(activeTrackStorageKey)
  }
}

function readStoredSectorDistanceKm(): SectorDistanceKm {
  if (typeof window === 'undefined') return 10
  const value = Number(window.localStorage.getItem(sectorDistanceStorageKey))
  return value === 5 || value === 10 || value === 15 || value === 20 || value === 25 ? value : 10
}

function writeStoredSectorDistanceKm(distanceKm: SectorDistanceKm) {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(sectorDistanceStorageKey, String(distanceKm))
}

function readStoredTelemetryDisplayMode(): TelemetryDisplayMode {
  if (typeof window === 'undefined') return 'cleaned'
  const value = window.localStorage.getItem(telemetryDisplayModeStorageKey)
  return value === 'raw' || value === 'cleaned' || value === 'reconstructed' ? value : 'cleaned'
}

function writeStoredTelemetryDisplayMode(mode: TelemetryDisplayMode) {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(telemetryDisplayModeStorageKey, mode)
}

type AppState = {
  activeTrackId: string | null
  activeMotorcycleId: string
  sectorDistanceKm: SectorDistanceKm
  telemetryDisplayMode: TelemetryDisplayMode
  setActiveTrackId: (trackId: string | null) => void
  setActiveMotorcycleId: (motorcycleId: string) => void
  setSectorDistanceKm: (distanceKm: SectorDistanceKm) => void
  setTelemetryDisplayMode: (mode: TelemetryDisplayMode) => void
}

export const useAppStore = create<AppState>((set) => ({
  activeTrackId: readStoredActiveTrackId(),
  activeMotorcycleId: defaultMotorcycleProfile.id,
  sectorDistanceKm: readStoredSectorDistanceKm(),
  telemetryDisplayMode: readStoredTelemetryDisplayMode(),
  setActiveTrackId: (trackId) => {
    writeStoredActiveTrackId(trackId)
    set({ activeTrackId: trackId })
  },
  setActiveMotorcycleId: (motorcycleId) => set({ activeMotorcycleId: motorcycleId }),
  setSectorDistanceKm: (distanceKm) => {
    writeStoredSectorDistanceKm(distanceKm)
    set({ sectorDistanceKm: distanceKm })
  },
  setTelemetryDisplayMode: (mode) => {
    writeStoredTelemetryDisplayMode(mode)
    set({ telemetryDisplayMode: mode })
  },
}))
