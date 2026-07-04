import { wrap } from 'comlink'
import type { Remote } from 'comlink'
import type { TelemetryWorkerApi } from './processTrack.worker'

export type TelemetryWorkerClient = {
  api: Remote<TelemetryWorkerApi>
  terminate: () => void
}

export function createTelemetryWorker(): TelemetryWorkerClient {
  const worker = new Worker(new URL('./processTrack.worker.ts', import.meta.url), { type: 'module' })

  return {
    api: wrap<TelemetryWorkerApi>(worker),
    terminate: () => worker.terminate(),
  }
}
