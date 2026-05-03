/**
 * DeckEditor.tsx — Modal for creating and editing commander decks.
 *
 * Three sections: deck info form, card list, token panel.
 * Singleton rule violations surfaced as error message.
 * Commander eligibility enforced: Legendary Creature or Legendary Planeswalker
 * or "can be your commander" in oracle text.
 * TS 6.0 erasableSyntaxOnly: zero enum keywords.
 */

import { useEffect, useRef, useState } from 'react'
import { Spinner } from '@heroui/react'
import { useCollection, SingletonViolationError } from '../lib/collection-context'
import { useDeck, useDeckCards, useCards, useTokensForDeck } from '../lib/collection-hooks'
import { searchCards } from '../providers/scryfall-cards'
import { TokenPanel } from './TokenPanel'
import type { Card } from '../domain/collection'
import type { DeckCard, DeckCategory } from '../domain/deck'
import { DECK_CATEGORIES } from '../domain/deck'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Props {
  /** When provided, editing existing deck. When undefined, creating new deck. */
  deckId?: number
  isOpen: boolean
  onClose: () => void
}

type ActiveTab = 'info' | 'cartas' | 'tokens'

const CATEGORY_LABELS: Record<DeckCategory, string> = {
  commander: 'Comandante',
  mainboard: 'Mazo principal',
  sideboard: 'Sideboard',
  maybeboard: 'Maybeboard',
}

// ---------------------------------------------------------------------------
// Commander eligibility check
// ---------------------------------------------------------------------------

function isCommanderEligible(card: Card): boolean {
  const isLegendary = card.type_line.includes('Legendary')
  const isCreature = card.type_line.includes('Creature')
  const isPlaneswalker = card.type_line.includes('Planeswalker')
  const canBeCommander = card.oracle_text?.includes('can be your commander') === true
  return (isLegendary && (isCreature || isPlaneswalker)) || canBeCommander
}

// ---------------------------------------------------------------------------
// Commander search sub-component
// ---------------------------------------------------------------------------

interface CommanderSearchProps {
  value: Card | null
  onChange: (card: Card | null) => void
  disabled?: boolean
}

function CommanderSearchInput({ value, onChange, disabled }: CommanderSearchProps) {
  const [query, setQuery] = useState(value?.name ?? '')
  const [results, setResults] = useState<Card[]>([])
  const [loading, setLoading] = useState(false)
  const [open, setOpen] = useState(false)

  const abortRef = useRef<AbortController | null>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    const trimmed = query.trim()
    if (!trimmed || trimmed === value?.name) return

    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(async () => {
      if (abortRef.current) abortRef.current.abort()
      const ctrl = new AbortController()
      abortRef.current = ctrl

      setLoading(true)
      try {
        const all = await searchCards(trimmed, ctrl.signal)
        if (!ctrl.signal.aborted) {
          // Filter to legendary creatures/planeswalkers
          const commanders = all.filter((c) => isCommanderEligible(c))
          setResults(commanders)
        }
      } catch {
        if (!abortRef.current?.signal.aborted) setResults([])
      } finally {
        if (!abortRef.current?.signal.aborted) setLoading(false)
      }
    }, 500)

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [query, value?.name])

  useEffect(() => () => { abortRef.current?.abort() }, [])

  function handleSelect(card: Card) {
    setQuery(card.name)
    setResults([])
    setOpen(false)
    onChange(card)
  }

  function handleClear() {
    setQuery('')
    setResults([])
    onChange(null)
  }

  return (
    <div className="relative">
      <div className="relative">
        <input
          type="text"
          value={query}
          onChange={(e) => {
            const v = e.target.value
            setQuery(v)
            setOpen(true)
            if (!v.trim()) setResults([])
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          placeholder="Buscar comandante (criatura legendaria)…"
          disabled={disabled}
          className="w-full rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100 outline-none focus:border-zinc-900 dark:focus:border-zinc-300 disabled:opacity-50"
        />
        {loading && (
          <div className="absolute right-2 top-1/2 -translate-y-1/2">
            <Spinner size="sm" />
          </div>
        )}
        {value && !loading && (
          <button
            type="button"
            onClick={handleClear}
            className="cursor-pointer absolute right-2 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300"
            aria-label="Limpiar comandante"
          >
            ✕
          </button>
        )}
      </div>

      {open && results.length > 0 && (
        <ul className="absolute left-0 right-0 z-10 mt-1 max-h-64 overflow-y-auto rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 shadow-lg">
          {results.map((card) => {
            const img = card.image_uris?.art_crop ?? card.image_uris?.small
            return (
              <li key={card.id}>
                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => handleSelect(card)}
                  className="cursor-pointer w-full flex items-center gap-3 px-3 py-2 text-left hover:bg-zinc-50 dark:hover:bg-zinc-800"
                >
                  {img ? (
                    <img src={img} alt="" className="h-10 w-14 flex-shrink-0 rounded object-cover" loading="lazy" />
                  ) : (
                    <div className="h-10 w-14 flex-shrink-0 rounded bg-zinc-200 dark:bg-zinc-700" />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100 truncate">{card.name}</p>
                    <p className="text-xs text-zinc-500 truncate">{card.type_line}</p>
                  </div>
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Card search for deck (re-uses same debounce pattern)
// ---------------------------------------------------------------------------

interface DeckCardSearchProps {
  deckId: number
  onAdd: (card: Card, category: DeckCategory) => Promise<void>
}

function DeckCardSearch({ onAdd }: DeckCardSearchProps) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<Card[]>([])
  const [loading, setLoading] = useState(false)
  const [open, setOpen] = useState(false)
  const [addingId, setAddingId] = useState<string | null>(null)
  const [addError, setAddError] = useState<string | null>(null)
  const [selectedCategory, setSelectedCategory] = useState<DeckCategory>('mainboard')

  const abortRef = useRef<AbortController | null>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    const trimmed = query.trim()
    if (!trimmed) return

    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(async () => {
      if (abortRef.current) abortRef.current.abort()
      const ctrl = new AbortController()
      abortRef.current = ctrl
      setLoading(true)
      try {
        const res = await searchCards(trimmed, ctrl.signal)
        if (!ctrl.signal.aborted) setResults(res)
      } catch {
        if (!abortRef.current?.signal.aborted) setResults([])
      } finally {
        if (!abortRef.current?.signal.aborted) setLoading(false)
      }
    }, 500)

    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
  }, [query])

  useEffect(() => () => { abortRef.current?.abort() }, [])

  async function handleAdd(card: Card) {
    setAddingId(card.id)
    setAddError(null)
    try {
      await onAdd(card, selectedCategory)
      setQuery('')
      setResults([])
      setOpen(false)
    } catch (err) {
      if (err instanceof SingletonViolationError) {
        setAddError(err.message)
      } else {
        setAddError(err instanceof Error ? err.message : 'Error al agregar carta.')
      }
    } finally {
      setAddingId(null)
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex gap-2">
        <div className="relative flex-1">
          <input
            type="text"
            value={query}
            onChange={(e) => {
              const v = e.target.value
              setQuery(v)
              setOpen(true)
              if (!v.trim()) setResults([])
            }}
            onFocus={() => setOpen(true)}
            onBlur={() => setTimeout(() => setOpen(false), 200)}
            placeholder="Agregar carta al mazo…"
            className="w-full rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100 outline-none focus:border-zinc-900 dark:focus:border-zinc-300"
          />
          {loading && (
            <div className="absolute right-2 top-1/2 -translate-y-1/2"><Spinner size="sm" /></div>
          )}
          {open && results.length > 0 && (
            <ul className="absolute left-0 right-0 z-20 mt-1 max-h-64 overflow-y-auto rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 shadow-lg">
              {results.map((card) => {
                const img = card.image_uris?.art_crop ?? card.image_uris?.small
                const isAdding = addingId === card.id
                return (
                  <li key={card.id} className="flex items-center gap-2 px-2 py-1.5 hover:bg-zinc-50 dark:hover:bg-zinc-800">
                    {img ? (
                      <img src={img} alt="" className="h-8 w-12 flex-shrink-0 rounded object-cover" loading="lazy" />
                    ) : (
                      <div className="h-8 w-12 flex-shrink-0 rounded bg-zinc-200 dark:bg-zinc-700" />
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="text-sm text-zinc-900 dark:text-zinc-100 truncate">{card.name}</p>
                      <p className="text-xs text-zinc-500 truncate">{card.set.toUpperCase()}</p>
                    </div>
                    <button
                      type="button"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => handleAdd(card)}
                      disabled={isAdding}
                      className="cursor-pointer flex-shrink-0 rounded-md bg-zinc-900 dark:bg-zinc-100 px-2 py-1 text-xs font-medium text-white dark:text-zinc-900 hover:bg-zinc-800 dark:hover:bg-zinc-200 disabled:opacity-50"
                    >
                      {isAdding ? <Spinner size="sm" color="current" /> : 'Agregar'}
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
        <select
          value={selectedCategory}
          onChange={(e) => setSelectedCategory(e.target.value as DeckCategory)}
          className="rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-2 py-2 text-sm text-zinc-900 dark:text-zinc-100 outline-none focus:border-zinc-900 dark:focus:border-zinc-300"
        >
          {DECK_CATEGORIES.filter((c) => c !== 'commander').map((c) => (
            <option key={c} value={c}>{CATEGORY_LABELS[c]}</option>
          ))}
        </select>
      </div>

      {addError && (
        <div className="rounded-lg border border-red-300 bg-red-50 dark:bg-red-950/40 dark:border-red-800 p-2 text-xs text-red-800 dark:text-red-200">
          {addError}
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Deck card list row
// ---------------------------------------------------------------------------

interface DeckCardRowProps {
  deckCard: DeckCard
  card: Card | undefined
  onRemove: (id: number) => void
  onSetQty: (id: number, qty: number) => void
}

function DeckCardRow({ deckCard, card, onRemove, onSetQty }: DeckCardRowProps) {
  const id = deckCard.id!

  return (
    <div className="flex items-center gap-2 py-1.5 border-b border-zinc-100 dark:border-zinc-800 last:border-0">
      <div className="min-w-0 flex-1">
        <p className="text-sm text-zinc-900 dark:text-zinc-100 truncate">
          {card?.name ?? deckCard.cardId}
        </p>
        <p className="text-xs text-zinc-500 dark:text-zinc-400 truncate">
          {CATEGORY_LABELS[deckCard.category]}
          {card && ` · ${card.set.toUpperCase()}`}
        </p>
      </div>

      {deckCard.category !== 'commander' && (
        <div className="flex items-center gap-1 flex-shrink-0">
          <button
            type="button"
            onClick={() => deckCard.quantity > 1 ? onSetQty(id, deckCard.quantity - 1) : onRemove(id)}
            className="cursor-pointer w-6 h-6 rounded border border-zinc-300 dark:border-zinc-600 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-700 text-sm leading-none"
            aria-label="Disminuir cantidad"
          >
            −
          </button>
          <span className="w-6 text-center text-sm tabular-nums text-zinc-900 dark:text-zinc-100">
            {deckCard.quantity}
          </span>
          <button
            type="button"
            onClick={() => onSetQty(id, deckCard.quantity + 1)}
            className="cursor-pointer w-6 h-6 rounded border border-zinc-300 dark:border-zinc-600 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-700 text-sm leading-none"
            aria-label="Aumentar cantidad"
          >
            +
          </button>
        </div>
      )}

      <button
        type="button"
        onClick={() => onRemove(id)}
        className="cursor-pointer rounded p-1 text-zinc-400 dark:text-zinc-500 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 leading-none flex-shrink-0"
        aria-label="Quitar del mazo"
      >
        ✕
      </button>
    </div>
  )
}

// ---------------------------------------------------------------------------
// DeckEditor modal
// ---------------------------------------------------------------------------

export function DeckEditor({ deckId, isOpen, onClose }: Props) {
  const { createDeck, updateDeck, deleteDeck, addCardToDeck, removeFromDeck } = useCollection()

  const existingDeck = useDeck(deckId ?? -1)
  const deckCards = useDeckCards(deckId ?? -1)
  const cardsById = useCards()
  // Only fetch tokens when a deckId exists (not in create mode)
  const tokens = useTokensForDeck(deckId ?? -1)

  const [activeTab, setActiveTab] = useState<ActiveTab>('info')

  // Form state
  const [deckName, setDeckName] = useState(existingDeck?.name ?? '')
  const [commander, setCommander] = useState<Card | null>(
    existingDeck ? (cardsById.get(existingDeck.commanderId) ?? null) : null,
  )

  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)

  // Keep form in sync with existingDeck (once loaded)
  const [initialized, setInitialized] = useState(false)
  if (!initialized && existingDeck) {
    setDeckName(existingDeck.name)
    const cmdCard = cardsById.get(existingDeck.commanderId) ?? null
    if (cmdCard) setCommander(cmdCard)
    setInitialized(true)
  }

  if (!isOpen) return null

  const commanderEligible = commander ? isCommanderEligible(commander) : true
  const canSave = deckName.trim().length > 0 && commander !== null && commanderEligible && !saving

  async function handleSave() {
    if (!commander || !canSave) return
    setSaving(true)
    setSaveError(null)
    try {
      if (deckId !== undefined) {
        await updateDeck(deckId, { name: deckName.trim() })
      } else {
        const newDeckId = await createDeck(deckName.trim(), commander.id)
        // Add commander as commander slot
        await addCardToDeck(newDeckId, commander, { category: 'commander', quantity: 1 })
      }
      onClose()
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Error al guardar el mazo.')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (!deckId || !confirm('¿Eliminar este mazo? Esta acción no se puede deshacer.')) return
    setDeleting(true)
    try {
      await deleteDeck(deckId)
      onClose()
    } catch {
      setDeleting(false)
    }
  }

  async function handleAddCard(card: Card, category: DeckCategory) {
    if (!deckId) return
    await addCardToDeck(deckId, card, { category, quantity: 1 })
  }

  async function handleRemoveDeckCard(id: number) {
    await removeFromDeck(id)
  }

  async function handleSetDeckCardQty(id: number, qty: number) {
    // For now we use addCardToDeck semantics — update quantity directly
    // We delegate to removeFromDeck if qty < 1 (handled in row component)
    if (qty < 1) {
      await removeFromDeck(id)
    } else {
      // Update quantity via Dexie directly is not exposed in api
      // Use context's removeFromDeck + re-add pattern is complex
      // Simplest: remove then re-add is wrong; we need a setDeckCardQty
      // The CollectionApi doesn't expose setDeckCardQty directly.
      // Workaround: call the db directly via a re-add at the new qty.
      // Since context doesn't expose this, we'll use the db singleton.
      const { db } = await import('../lib/collection-db')
      await db.deckCards.update(id, { quantity: qty })
    }
  }

  // Group deck cards by category
  const cardsByCategory = deckCards.reduce<Record<DeckCategory, DeckCard[]>>(
    (acc, dc) => {
      acc[dc.category] = [...(acc[dc.category] ?? []), dc]
      return acc
    },
    { commander: [], mainboard: [], sideboard: [], maybeboard: [] },
  )

  const totalCards = deckCards.reduce((sum, dc) => sum + dc.quantity, 0)

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden
      />

      {/* Modal */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label={deckId ? 'Editar mazo' : 'Crear mazo'}
        className="fixed inset-0 z-50 flex items-center justify-center p-4"
      >
        <div className="w-full max-w-2xl rounded-xl bg-white dark:bg-zinc-900 shadow-2xl border border-zinc-200 dark:border-zinc-700 flex flex-col max-h-[90vh] overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-zinc-200 dark:border-zinc-700 flex-shrink-0">
            <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
              {deckId ? 'Editar mazo' : 'Crear mazo'}
            </h2>
            <div className="flex items-center gap-2">
              {deckId && (
                <button
                  type="button"
                  onClick={handleDelete}
                  disabled={deleting}
                  className="cursor-pointer rounded-md px-2 py-1.5 text-sm font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 disabled:opacity-50"
                >
                  Eliminar
                </button>
              )}
              <button
                type="button"
                onClick={onClose}
                className="cursor-pointer rounded-md p-2 text-zinc-500 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                aria-label="Cerrar"
              >
                ✕
              </button>
            </div>
          </div>

          {/* Tab navigation */}
          <nav className="flex border-b border-zinc-200 dark:border-zinc-700 flex-shrink-0">
            {(
              [
                { key: 'info', label: 'Información' },
                { key: 'cartas', label: `Cartas${deckId ? ` (${totalCards})` : ''}` },
                ...(deckId ? [{ key: 'tokens', label: `Tokens${tokens.length ? ` (${tokens.length})` : ''}` }] : []),
              ] as { key: ActiveTab; label: string }[]
            ).map(({ key, label }) => (
              <button
                key={key}
                type="button"
                onClick={() => setActiveTab(key)}
                className={
                  'cursor-pointer px-4 py-2 text-sm font-medium border-b-2 transition-colors -mb-px ' +
                  (activeTab === key
                    ? 'border-zinc-900 dark:border-zinc-100 text-zinc-900 dark:text-zinc-100'
                    : 'border-transparent text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-300')
                }
              >
                {label}
              </button>
            ))}
          </nav>

          {/* Tab content */}
          <div className="flex-1 overflow-y-auto p-4">
            {/* Info tab */}
            {activeTab === 'info' && (
              <div className="flex flex-col gap-4">
                <div className="flex flex-col gap-1">
                  <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                    Nombre del mazo <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={deckName}
                    onChange={(e) => setDeckName(e.target.value)}
                    placeholder="Mi mazo commander…"
                    maxLength={100}
                    className="rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100 outline-none focus:border-zinc-900 dark:focus:border-zinc-300"
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                    Comandante <span className="text-red-500">*</span>
                  </label>
                  <CommanderSearchInput
                    value={commander}
                    onChange={setCommander}
                    disabled={!!deckId}
                  />
                  {commander && !commanderEligible && (
                    <p className="text-xs text-red-600 dark:text-red-400 mt-0.5">
                      Esta carta no puede ser comandante
                    </p>
                  )}
                  {commander && commanderEligible && (
                    <div className="mt-2 flex items-center gap-3 rounded-lg border border-zinc-200 dark:border-zinc-700 p-2">
                      {(commander.image_uris?.art_crop ?? commander.image_uris?.small) && (
                        <img
                          src={commander.image_uris?.art_crop ?? commander.image_uris?.small}
                          alt={commander.name}
                          className="w-16 h-12 rounded object-cover flex-shrink-0"
                        />
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100 truncate">
                          {commander.name}
                        </p>
                        <p className="text-xs text-zinc-500 dark:text-zinc-400 truncate">
                          {commander.type_line}
                        </p>
                      </div>
                    </div>
                  )}
                </div>

                {saveError && (
                  <div className="rounded-lg border border-red-300 bg-red-50 dark:bg-red-950/40 dark:border-red-800 p-3 text-sm text-red-800 dark:text-red-200">
                    {saveError}
                  </div>
                )}
              </div>
            )}

            {/* Cards tab */}
            {activeTab === 'cartas' && (
              <div className="flex flex-col gap-4">
                {deckId && (
                  <DeckCardSearch deckId={deckId} onAdd={handleAddCard} />
                )}
                {!deckId && (
                  <p className="text-sm text-zinc-500 dark:text-zinc-400">
                    Guarda el mazo primero para agregar cartas.
                  </p>
                )}

                {deckCards.length > 0 && (
                  <div className="flex flex-col gap-4">
                    {(DECK_CATEGORIES as readonly DeckCategory[]).map((cat) => {
                      const catCards = cardsByCategory[cat]
                      if (!catCards?.length) return null
                      return (
                        <section key={cat}>
                          <h4 className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400 mb-2">
                            {CATEGORY_LABELS[cat]} ({catCards.length})
                          </h4>
                          <div className="flex flex-col">
                            {catCards.map((dc) => (
                              <DeckCardRow
                                key={dc.id}
                                deckCard={dc}
                                card={cardsById.get(dc.cardId)}
                                onRemove={handleRemoveDeckCard}
                                onSetQty={handleSetDeckCardQty}
                              />
                            ))}
                          </div>
                        </section>
                      )
                    })}
                  </div>
                )}

                {deckCards.length === 0 && deckId && (
                  <p className="text-sm text-zinc-500 dark:text-zinc-400 text-center py-4">
                    Este mazo no tiene cartas todavía.
                  </p>
                )}
              </div>
            )}

            {/* Tokens tab */}
            {activeTab === 'tokens' && deckId && (
              <TokenPanel deckId={deckId} />
            )}
          </div>

          {/* Footer */}
          <div className="p-4 border-t border-zinc-200 dark:border-zinc-700 flex items-center justify-end gap-2 flex-shrink-0">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="cursor-pointer rounded-md border border-zinc-300 dark:border-zinc-600 px-4 py-2 text-sm font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 disabled:opacity-50"
            >
              {deckId ? 'Cerrar' : 'Cancelar'}
            </button>
            {(!deckId || activeTab === 'info') && (
              <button
                type="button"
                onClick={handleSave}
                disabled={!canSave}
                className="cursor-pointer rounded-md bg-zinc-900 dark:bg-zinc-100 px-4 py-2 text-sm font-medium text-white dark:text-zinc-900 hover:bg-zinc-800 dark:hover:bg-zinc-200 disabled:opacity-50 flex items-center gap-2"
              >
                {saving && <Spinner size="sm" color="current" />}
                Guardar
              </button>
            )}
          </div>
        </div>
      </div>
    </>
  )
}
