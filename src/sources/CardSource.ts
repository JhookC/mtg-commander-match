import type { NormalizedCard } from '../domain/card'

/**
 * A flexible adapter contract. Add a new source by implementing this interface
 * and registering it in `registry.ts`. The match engine never touches a source
 * directly — it only consumes `fetchInStock()`.
 */
export interface CardSource {
  /** Unique, human-readable name. Shown in the UI. */
  name: string
  /** Returns the full in-stock catalog already mapped to NormalizedCard. */
  fetchInStock: (signal?: AbortSignal) => Promise<NormalizedCard[]>
}
