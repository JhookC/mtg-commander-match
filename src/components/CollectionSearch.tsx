/**
 * CollectionSearch.tsx — Debounced Scryfall search for adding cards to collection.
 *
 * Debounce ≥ 500ms per Scryfall rate limit guidelines.
 * Uses AbortController to cancel in-flight requests on new keystrokes.
 * TS 6.0 erasableSyntaxOnly: zero enum keywords.
 */

import { useEffect, useRef, useState } from 'react'
import { Spinner } from '@heroui/react'
import { searchCards } from '../providers/scryfall-cards'
import { useCollection } from '../lib/collection-context'
import type { Card } from '../domain/collection'
import { FINISHES, CONDITIONS } from '../domain/collection'
import type { Finish, Condition } from '../domain/collection'

interface Props {
  /** Called after a card is successfully added to the collection. */
  onAdded?: (card: Card) => void
}

interface SearchState {
  results: Card[]
  loading: boolean
  error: string | null
}

interface AddForm {
  finish: Finish
  condition: Condition
  quantity: number
}

const FINISH_LABELS: Record<Finish, string> = {
  nonfoil: 'Sin foil',
  foil: 'Foil',
  etched: 'Grabado',
}

const CONDITION_LABELS: Record<Condition, string> = {
  M: 'Menta (M)',
  NM: 'Sin jugar (NM)',
  LP: 'Poco jugada (LP)',
  MP: 'Jugada (MP)',
  HP: 'Muy jugada (HP)',
  DMG: 'Dañada (DMG)',
}

export function CollectionSearch({ onAdded }: Props) {
  const { addCard } = useCollection()
  const [query, setQuery] = useState('')
  const [search, setSearch] = useState<SearchState>({ results: [], loading: false, error: null })
  const [selectedCard, setSelectedCard] = useState<Card | null>(null)
  const [addForm, setAddForm] = useState<AddForm>({ finish: 'nonfoil', condition: 'NM', quantity: 1 })
  const [adding, setAdding] = useState(false)
  const [addedMsg, setAddedMsg] = useState<string | null>(null)

  // Abort controller ref for cancelling in-flight requests
  const abortRef = useRef<AbortController | null>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    const trimmed = query.trim()

    if (!trimmed) return

    // Debounce ≥ 500ms
    if (debounceRef.current) clearTimeout(debounceRef.current)

    debounceRef.current = setTimeout(async () => {
      // Cancel previous in-flight request
      if (abortRef.current) abortRef.current.abort()
      const ctrl = new AbortController()
      abortRef.current = ctrl

      setSearch((s) => ({ ...s, loading: true, error: null }))

      try {
        const results = await searchCards(trimmed, ctrl.signal)
        if (!ctrl.signal.aborted) {
          setSearch({ results, loading: false, error: null })
        }
      } catch (err) {
        if (ctrl.signal.aborted) return
        const msg = err instanceof Error ? err.message : 'Error al buscar.'
        setSearch({ results: [], loading: false, error: msg })
      }
    }, 500)

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [query])

  // Cleanup abort on unmount
  useEffect(() => {
    return () => {
      abortRef.current?.abort()
    }
  }, [])

  function handleSelectCard(card: Card) {
    setSelectedCard(card)
    setAddForm({ finish: 'nonfoil', condition: 'NM', quantity: 1 })
    setAddedMsg(null)
  }

  function handleCancelAdd() {
    setSelectedCard(null)
    setAddedMsg(null)
  }

  async function handleConfirmAdd() {
    if (!selectedCard) return
    setAdding(true)
    try {
      await addCard(selectedCard, {
        finish: addForm.finish,
        condition: addForm.condition,
        quantity: addForm.quantity,
      })
      setAddedMsg(`"${selectedCard.name}" agregada a la colección.`)
      setSelectedCard(null)
      onAdded?.(selectedCard)
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Error al agregar carta.'
      setAddedMsg(msg)
    } finally {
      setAdding(false)
    }
  }

  function getCardImage(card: Card): string | undefined {
    return (
      card.image_uris?.art_crop ??
      card.image_uris?.small ??
      card.card_faces?.[0]?.image_uris?.art_crop
    )
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Search input */}
      <div className="relative">
        <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
          Buscar carta
        </label>
        <div className="relative">
          <input
            type="text"
            value={query}
            onChange={(e) => {
          const v = e.target.value
          setQuery(v)
          if (!v.trim()) setSearch({ results: [], loading: false, error: null })
        }}
            placeholder="Nombre de carta, e.g. Sol Ring…"
            className="w-full rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100 outline-none focus:border-zinc-900 dark:focus:border-zinc-300"
            aria-label="Buscar carta por nombre"
          />
          {search.loading && (
            <div className="absolute right-2 top-1/2 -translate-y-1/2">
              <Spinner size="sm" />
            </div>
          )}
        </div>
      </div>

      {/* Error */}
      {search.error && (
        <div className="rounded-lg border border-red-300 bg-red-50 dark:bg-red-950/40 dark:border-red-800 p-3 text-sm text-red-800 dark:text-red-200">
          {search.error}
        </div>
      )}

      {/* Added confirmation */}
      {addedMsg && (
        <div className="rounded-lg border border-emerald-300 bg-emerald-50 dark:bg-emerald-950/40 dark:border-emerald-800 p-3 text-sm text-emerald-800 dark:text-emerald-200">
          {addedMsg}
        </div>
      )}

      {/* Add form for selected card */}
      {selectedCard && (
        <div className="rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 p-4 flex flex-col gap-3">
          <div className="flex items-center gap-3">
            {getCardImage(selectedCard) && (
              <img
                src={getCardImage(selectedCard)}
                alt={selectedCard.name}
                className="w-16 h-12 rounded object-cover bg-zinc-100 dark:bg-zinc-800 flex-shrink-0"
              />
            )}
            <div className="min-w-0 flex-1">
              <p className="font-semibold text-sm text-zinc-900 dark:text-zinc-100 truncate">
                {selectedCard.name}
              </p>
              <p className="text-xs text-zinc-500 truncate">
                {selectedCard.set.toUpperCase()} · {selectedCard.type_line}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2">
            {/* Finish */}
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-zinc-600 dark:text-zinc-400">
                Acabado
              </label>
              <select
                value={addForm.finish}
                onChange={(e) => setAddForm((f) => ({ ...f, finish: e.target.value as Finish }))}
                className="rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-2 py-1.5 text-sm text-zinc-900 dark:text-zinc-100 outline-none focus:border-zinc-900 dark:focus:border-zinc-300"
              >
                {FINISHES.map((f) => (
                  <option key={f} value={f}>{FINISH_LABELS[f]}</option>
                ))}
              </select>
            </div>

            {/* Condition */}
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-zinc-600 dark:text-zinc-400">
                Condición
              </label>
              <select
                value={addForm.condition}
                onChange={(e) => setAddForm((f) => ({ ...f, condition: e.target.value as Condition }))}
                className="rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-2 py-1.5 text-sm text-zinc-900 dark:text-zinc-100 outline-none focus:border-zinc-900 dark:focus:border-zinc-300"
              >
                {CONDITIONS.map((c) => (
                  <option key={c} value={c}>{CONDITION_LABELS[c]}</option>
                ))}
              </select>
            </div>

            {/* Quantity */}
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-zinc-600 dark:text-zinc-400">
                Cantidad
              </label>
              <input
                type="number"
                min={1}
                value={addForm.quantity}
                onChange={(e) => {
                  const v = Math.max(1, parseInt(e.target.value, 10) || 1)
                  setAddForm((f) => ({ ...f, quantity: v }))
                }}
                className="rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-2 py-1.5 text-sm text-zinc-900 dark:text-zinc-100 outline-none focus:border-zinc-900 dark:focus:border-zinc-300"
              />
            </div>
          </div>

          <div className="flex gap-2 justify-end">
            <button
              type="button"
              onClick={handleCancelAdd}
              disabled={adding}
              className="cursor-pointer rounded-md border border-zinc-300 dark:border-zinc-600 px-3 py-1.5 text-sm font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleConfirmAdd}
              disabled={adding}
              className="cursor-pointer rounded-md bg-zinc-900 dark:bg-zinc-100 px-3 py-1.5 text-sm font-medium text-white dark:text-zinc-900 hover:bg-zinc-800 dark:hover:bg-zinc-200 disabled:opacity-50 flex items-center gap-2"
            >
              {adding && <Spinner size="sm" color="current" />}
              Agregar a colección
            </button>
          </div>
        </div>
      )}

      {/* Results list */}
      {!selectedCard && query.trim() && !search.loading && search.results.length === 0 && !search.error && (
        <p className="text-sm text-zinc-500 dark:text-zinc-400 text-center py-4">
          Sin resultados para "{query.trim()}"
        </p>
      )}

      {!selectedCard && search.results.length > 0 && (
        <ul className="flex flex-col gap-1 max-h-80 overflow-y-auto rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900">
          {search.results.map((card) => (
            <li key={card.id}>
              <button
                type="button"
                onClick={() => handleSelectCard(card)}
                className="cursor-pointer w-full flex items-center gap-3 px-3 py-2 text-left hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
              >
                {getCardImage(card) ? (
                  <img
                    src={getCardImage(card)}
                    alt=""
                    className="w-14 h-10 rounded object-cover bg-zinc-100 dark:bg-zinc-800 flex-shrink-0"
                    loading="lazy"
                  />
                ) : (
                  <div className="w-14 h-10 rounded bg-zinc-100 dark:bg-zinc-800 flex-shrink-0" />
                )}
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100 truncate">
                    {card.name}
                  </p>
                  <p className="text-xs text-zinc-500 truncate">
                    {card.set.toUpperCase()} · {card.type_line}
                    {card.prices?.usd && ` · USD ${card.prices.usd}`}
                  </p>
                </div>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
