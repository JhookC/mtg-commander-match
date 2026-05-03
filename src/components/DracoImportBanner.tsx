import { useRef, useState, useEffect } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { useQueryClient } from '@tanstack/react-query'
import type { NormalizedCard } from '../domain/card'
import {
  saveDracoInventory,
  clearDracoInventory,
  getDracoMeta,
  type DracoInventory,
} from '../sources/draco/DracoSource'
import { DracoHelpModal } from './DracoHelpModal'

function formatCount(n: number): string {
  return n.toLocaleString('es-CO')
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('es-CO', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

function SourceCount({
  label,
  count,
}: {
  label: string
  count: number | undefined
}) {
  return (
    <span className="flex items-center gap-1.5">
      <span className="font-medium text-zinc-700 dark:text-zinc-300">{label}:</span>
      <span>
        {count !== undefined ? `${formatCount(count)} cartas` : '—'}
      </span>
    </span>
  )
}

function readCounts(
  queryClient: ReturnType<typeof useQueryClient>,
): { rohan: number | undefined; topcard: number | undefined } {
  const map = queryClient.getQueryData<Map<string, NormalizedCard[]>>(['allStockCatalogs'])
  return { rohan: map?.get('Rohan')?.length, topcard: map?.get('TopCard')?.length }
}

export function DracoImportBanner() {
  const fileRef = useRef<HTMLInputElement>(null)
  const queryClient = useQueryClient()
  const [helpOpen, setHelpOpen] = useState(false)

  const meta = useLiveQuery(() => getDracoMeta(), [])

  // Subscribe to the TanStack cache directly — `enabled: false` in useQuery
  // doesn't re-render on cache updates in v5. This does.
  const [liveCounts, setLiveCounts] = useState(() => readCounts(queryClient))
  useEffect(() => {
    return queryClient.getQueryCache().subscribe((event) => {
      if (event.query.queryHash === '["allStockCatalogs"]') {
        setLiveCounts(readCounts(queryClient))
      }
    })
  }, [queryClient])

  const { rohan: rohanCount, topcard: topcardCount } = liveCounts

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: ['allStockCatalogs'] })
    queryClient.invalidateQueries({ queryKey: ['cardLookup'] })
    queryClient.invalidateQueries({ queryKey: ['match'] })
  }

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    try {
      const text = await file.text()
      const parsed = JSON.parse(text) as DracoInventory
      if (!Array.isArray(parsed.cards)) throw new Error('Formato inválido')
      await saveDracoInventory(parsed)
      invalidate()
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Error desconocido'
      alert(`No se pudo importar: ${msg}`)
    } finally {
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  async function handleClear() {
    await clearDracoInventory()
    invalidate()
  }

  return (
    <>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-zinc-500 dark:text-zinc-400">
        <SourceCount label="Rohan" count={rohanCount} />
        <SourceCount label="TopCard" count={topcardCount} />

        {/* Draco — importable source with inline actions */}
        <span className="flex items-center gap-1.5">
          <span className="font-medium text-zinc-700 dark:text-zinc-300">Draco:</span>

          {meta ? (
            <>
              <span>
                {formatCount(meta.cardCount)} cartas · {formatDate(meta.exportedAt)}
              </span>
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="underline underline-offset-2 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors"
              >
                Reimportar
              </button>
              <button
                type="button"
                onClick={handleClear}
                className="underline underline-offset-2 hover:text-red-500 transition-colors"
              >
                Limpiar
              </button>
            </>
          ) : (
            <>
              <span className="text-amber-600 dark:text-amber-400">Sin inventario</span>
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="underline underline-offset-2 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors"
              >
                Importar JSON
              </button>
            </>
          )}

          <button
            type="button"
            onClick={() => setHelpOpen(true)}
            aria-label="Cómo usar Draco"
            className="inline-flex items-center justify-center size-4 rounded-full border border-zinc-400 dark:border-zinc-500 text-zinc-500 dark:text-zinc-400 hover:border-zinc-900 dark:hover:border-zinc-100 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors leading-none text-[10px] font-bold shrink-0"
          >
            ?
          </button>
        </span>

        <input
          ref={fileRef}
          type="file"
          accept=".json,application/json"
          className="sr-only"
          onChange={handleFile}
        />
      </div>

      <DracoHelpModal isOpen={helpOpen} onClose={() => setHelpOpen(false)} />
    </>
  )
}
