/**
 * CardSearch.tsx — Generic card name autocomplete (any card, not commander-restricted).
 *
 * Used by the "Carta específica" search mode in MatchView. Mirrors CommanderSearch
 * but searches Scryfall without the `is:commander` filter and emits only the card name.
 *
 * TS 6.0 erasableSyntaxOnly: zero enum keywords.
 */

import { useEffect, useState, type ReactNode } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Spinner } from '@heroui/react'
import { searchCards } from '../providers/scryfall'

interface Props {
  onSelect: (name: string) => void
  selectedName: string | null
  prefixSlot?: ReactNode
  inputValue: string
  onInputChange: (v: string) => void
}

export function CardSearch({ onSelect, selectedName, prefixSlot, inputValue, onInputChange }: Props) {
  const [debounced, setDebounced] = useState(inputValue)
  const [open, setOpen] = useState(false)

  useEffect(() => {
    const t = setTimeout(() => setDebounced(inputValue), 300)
    return () => clearTimeout(t)
  }, [inputValue])

  const { data, isFetching } = useQuery({
    queryKey: ['cardSearch', debounced],
    queryFn: ({ signal }) => searchCards(debounced, signal),
    enabled: debounced.length >= 2 && open,
    staleTime: 5 * 60_000,
  })

  function handleSelect(name: string) {
    onInputChange(name)
    setOpen(false)
    onSelect(name)
  }

  return (
    <div className="relative w-full">
      <div className="flex items-stretch w-full rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 focus-within:border-zinc-900 dark:focus-within:border-zinc-300 transition-colors">
        {prefixSlot}
        <div className="relative flex-1">
          <input
            type="text"
            value={inputValue}
            onChange={(e) => {
              onInputChange(e.target.value)
              setOpen(true)
            }}
            onFocus={() => setOpen(true)}
            onBlur={() => setTimeout(() => setOpen(false), 150)}
            placeholder="Sol Ring, Lightning Bolt…"
            aria-label="Buscar carta por nombre"
            className="w-full bg-transparent px-4 py-3 text-base text-zinc-900 dark:text-zinc-100 outline-none rounded-r-lg"
          />
          {isFetching && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2">
              <Spinner size="sm" />
            </div>
          )}
        </div>
      </div>
      {open && data && data.length > 0 && (
        <ul className="absolute left-0 right-0 z-10 mt-1 max-h-96 overflow-y-auto rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 shadow-lg">
          {data.map((s) => (
            <li key={s.name}>
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => handleSelect(s.name)}
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
