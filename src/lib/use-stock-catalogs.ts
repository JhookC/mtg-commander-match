import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import type { NormalizedCard } from '../domain/card'
import type { FetchProgress } from '../sources/CardSource'
import { sources } from '../sources/registry'
import { catalogProgressStore } from './catalog-progress'

export interface AggregateProgress {
  loaded: number
  total: number
  /** 0..1 */
  ratio: number
  bySource: Record<string, FetchProgress>
}

/**
 * Fetches all configured source catalogs once and returns a map keyed by
 * source name. TanStack Query caches the result so repeated reads share data.
 *
 * Also exposes `progress`, an aggregate of every source's fetchInStock
 * progress while the query is fetching. null when not running.
 */
export function useStockCatalogs(enabled: boolean) {
  const [progress, setProgress] = useState<AggregateProgress | null>(null)

  const query = useQuery({
    queryKey: ['allStockCatalogs'],
    queryFn: async ({ signal }) => {
      const bySource: Record<string, FetchProgress> = {}
      for (const s of sources) bySource[s.name] = { loaded: 0, total: 1 }
      const emit = () => {
        let loaded = 0
        let total = 0
        for (const k of Object.keys(bySource)) {
          loaded += bySource[k]!.loaded
          total += bySource[k]!.total
        }
        const next: AggregateProgress = {
          loaded,
          total,
          ratio: total > 0 ? loaded / total : 0,
          bySource: { ...bySource },
        }
        setProgress(next)
        catalogProgressStore.set(next)
      }
      emit()
      try {
        const results = await Promise.all(
          sources.map((s) =>
            s.fetchInStock(signal, (p) => {
              bySource[s.name] = p
              emit()
            }),
          ),
        )
        const map = new Map<string, NormalizedCard[]>()
        sources.forEach((s, i) => map.set(s.name, results[i] ?? []))
        return map
      } finally {
        setProgress(null)
        catalogProgressStore.set(null)
      }
    },
    enabled,
    staleTime: 30 * 60_000,
  })

  return { ...query, progress }
}
