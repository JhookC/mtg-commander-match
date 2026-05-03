/**
 * CommanderMatchView.tsx — "Por comandante" search mode.
 *
 * Original MatchView flow extracted: pick a commander → resolve via Scryfall →
 * fetch EDHrec recommendations + store inventories → cross-match into MatchedCardGroup[].
 *
 * Wrapped by MatchView (which also hosts CardLookupView and the mode toggle).
 *
 * TS 6.0 erasableSyntaxOnly: zero enum keywords.
 */

import { useState, type ReactNode } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Spinner } from '@heroui/react'
import { CommanderSearch } from './CommanderSearch'
import { CommanderHeader } from './CommanderHeader'
import { MatchResults } from './MatchResults'
import { resolveCommander } from '../providers/scryfall'
import { findMatches } from '../engine/matchEngine'

interface Selection {
  name: string
  slug: string
}

interface Props {
  prefixSlot?: ReactNode
  inputValue: string
  onInputChange: (v: string) => void
}

export function CommanderMatchView({ prefixSlot, inputValue, onInputChange }: Props) {
  const [selected, setSelected] = useState<Selection | null>(null)

  const commanderQuery = useQuery({
    queryKey: ['commander', selected?.name],
    queryFn: ({ signal }) => resolveCommander(selected!.name, signal),
    enabled: !!selected,
    staleTime: Infinity,
  })

  const matchQuery = useQuery({
    queryKey: ['match', selected?.slug],
    queryFn: ({ signal }) => findMatches(selected!.slug, signal),
    enabled: !!selected,
  })

  const isWorking = commanderQuery.isFetching || matchQuery.isFetching
  const error = commanderQuery.error ?? matchQuery.error

  return (
    <div className="flex flex-col gap-6 w-full">
      <CommanderSearch
        onSelect={(name, slug) => setSelected({ name, slug })}
        selectedName={selected?.name ?? null}
        prefixSlot={prefixSlot}
        inputValue={inputValue}
        onInputChange={onInputChange}
      />

      {error && (
        <div className="rounded-lg border border-red-300 bg-red-50 dark:bg-red-950/40 dark:border-red-800 p-4 text-sm text-red-800 dark:text-red-200">
          {error instanceof Error ? error.message : 'Ocurrió un error.'}
        </div>
      )}

      {isWorking && !commanderQuery.data && (
        <div className="flex items-center gap-2 text-sm text-zinc-600 dark:text-zinc-400">
          <Spinner size="sm" /> Resolviendo comandante…
        </div>
      )}

      {commanderQuery.data && (
        <CommanderHeader commander={commanderQuery.data} />
      )}

      {isWorking && commanderQuery.data && !matchQuery.data && (
        <div className="flex items-center gap-2 text-sm text-zinc-600 dark:text-zinc-400">
          <Spinner size="sm" /> Buscando coincidencias en el inventario…
        </div>
      )}

      {matchQuery.data && <MatchResults result={matchQuery.data} />}
    </div>
  )
}
