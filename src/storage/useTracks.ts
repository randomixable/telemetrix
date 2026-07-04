import { useEffect, useState } from 'react'
import { listTracks } from './tracksRepository'
import type { StoredTrack } from '../types/telemetry'

export function useTracks(refreshKey = 0) {
  const [tracks, setTracks] = useState<StoredTrack[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    let isMounted = true

    async function loadTracks() {
      setIsLoading(true)
      const localTracks = await listTracks()
      if (isMounted) {
        setTracks(localTracks)
        setIsLoading(false)
      }
    }

    void loadTracks()

    return () => {
      isMounted = false
    }
  }, [refreshKey])

  return { tracks, isLoading }
}
