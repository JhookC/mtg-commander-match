import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Spinner } from '@heroui/react'
import { CommanderSearch } from './components/CommanderSearch'
import { CommanderHeader } from './components/CommanderHeader'
import { MatchResults } from './components/MatchResults'
import { resolveCommander } from './providers/scryfall'
import { findMatches } from './engine/matchEngine'

interface Selection {
  name: string
  slug: string
}

function App() {
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
    <main className="min-h-svh bg-zinc-50 dark:bg-zinc-950 px-4 py-8">
      <div className="mx-auto max-w-7xl flex flex-col gap-6">
        <header>
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">
            MTG Commander Match
          </h1>
          <p className="text-sm text-zinc-600 dark:text-zinc-400 mt-1">
            Encuentra cartas disponibles que sirvan para tu comandante.
          </p>
        </header>

        <CommanderSearch
          onSelect={(name, slug) => setSelected({ name, slug })}
          selectedName={selected?.name ?? null}
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
    </main>
  )
}

export default App
