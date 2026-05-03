import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Spinner } from '@heroui/react'
import { searchCommanders } from '../providers/scryfall'

interface Props {
  onSelect: (name: string, slug: string) => void
  selectedName: string | null
}

export function CommanderSearch({ onSelect, selectedName }: Props) {
  const [query, setQuery] = useState(selectedName ?? '')
  const [debounced, setDebounced] = useState('')
  const [open, setOpen] = useState(false)

  useEffect(() => {
    const t = setTimeout(() => setDebounced(query), 300)
    return () => clearTimeout(t)
  }, [query])

  const { data, isFetching } = useQuery({
    queryKey: ['commanderSearch', debounced],
    queryFn: ({ signal }) => searchCommanders(debounced, signal),
    enabled: debounced.length >= 2 && open,
    staleTime: 5 * 60_000,
  })

  function handleSelect(name: string, slug: string) {
    setQuery(name)
    setOpen(false)
    onSelect(name, slug)
  }

  return (
    <div className="relative w-full max-w-xl">
      <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
        Comandante
      </label>
      <div className="relative">
        <input
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value)
            setOpen(true)
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          placeholder="Atraxa, Praetors' Voice…"
          className="w-full rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100 outline-none focus:border-zinc-900 dark:focus:border-zinc-300"
        />
        {isFetching && (
          <div className="absolute right-2 top-1/2 -translate-y-1/2">
            <Spinner size="sm" />
          </div>
        )}
      </div>
      {open && data && data.length > 0 && (
        <ul className="absolute left-0 right-0 z-10 mt-1 max-h-96 overflow-y-auto rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 shadow-lg">
          {data.map((s) => (
            <li key={s.slug}>
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => handleSelect(s.name, s.slug)}
                className="cursor-pointer w-full flex items-center gap-3 px-3 py-2 text-left text-sm text-zinc-900 dark:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800"
              >
                {s.artUrl ? (
                  <img
                    src={s.artUrl}
                    alt=""
                    className="h-10 w-14 flex-shrink-0 rounded object-cover"
                    loading="lazy"
                  />
                ) : (
                  <div className="h-10 w-14 flex-shrink-0 rounded bg-zinc-200 dark:bg-zinc-800" />
                )}
                <span className="truncate">{s.name}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
