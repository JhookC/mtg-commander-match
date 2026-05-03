import type { NormalizedCard } from '../domain/card'

export interface FetchProgress {
  loaded: number
  total: number
}

/**
 * A flexible adapter contract. Add a new source by implementing this interface
 * and registering it in `registry.ts`. The match engine never touches a source
 * directly — it only consumes `fetchInStock()`.
 *
 * `onProgress` is optional: pages-based sources (like TopCard) call it as
 * pages complete; single-request sources call once at start and once at end.
 */
export interface CardSource {
  /** Unique, human-readable name. Shown in the UI. */
  name: string
  fetchInStock: (
    signal?: AbortSignal,
    onProgress?: (p: FetchProgress) => void,
  ) => Promise<NormalizedCard[]>
}
