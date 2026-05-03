/**
 * DeckList.tsx — Grid of commander decks with create button.
 *
 * Each card shows commander name + image. Click to open DeckEditor.
 * "Crear deck" opens DeckEditor in create mode.
 * TS 6.0 erasableSyntaxOnly: zero enum keywords.
 */

import { useState } from 'react'
import { Card } from '@heroui/react'
import { useDecks, useCards } from '../lib/collection-hooks'
import type { Deck } from '../domain/deck'
import { DeckEditor } from './DeckEditor'

export function DeckList() {
  const decks = useDecks()
  const cardsById = useCards()

  const [editDeckId, setEditDeckId] = useState<number | null>(null)
  const [createMode, setCreateMode] = useState(false)

  function handleOpenEdit(deckId: number) {
    setEditDeckId(deckId)
    setCreateMode(false)
  }

  function handleOpenCreate() {
    setEditDeckId(null)
    setCreateMode(true)
  }

  function handleClose() {
    setEditDeckId(null)
    setCreateMode(false)
  }

  const isEditorOpen = editDeckId !== null || createMode

  return (
    <div className="flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          {decks.length} {decks.length === 1 ? 'mazo' : 'mazos'}
        </p>
        <button
          type="button"
          onClick={handleOpenCreate}
          className="cursor-pointer rounded-md bg-zinc-900 dark:bg-zinc-100 px-3 py-2 text-sm font-medium text-white dark:text-zinc-900 hover:bg-zinc-800 dark:hover:bg-zinc-200 flex items-center gap-1.5"
        >
          <span aria-hidden>+</span>
          Crear deck
        </button>
      </div>

      {/* Empty state */}
      {decks.length === 0 ? (
        <div className="rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 p-8 text-center text-sm text-zinc-500 dark:text-zinc-400">
          No tenés mazos. Creá uno nuevo.
        </div>
      ) : (
        /* Deck grid */
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
          {decks.map((deck) => (
            <DeckCard
              key={deck.id}
              deck={deck}
              commanderImage={getCommanderImage(deck, cardsById)}
              commanderName={getCommanderName(deck, cardsById)}
              onClick={() => handleOpenEdit(deck.id!)}
            />
          ))}
        </div>
      )}

      {/* DeckEditor modal */}
      {isEditorOpen && (
        <DeckEditor
          deckId={editDeckId ?? undefined}
          isOpen={isEditorOpen}
          onClose={handleClose}
        />
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getCommanderImage(
  deck: Deck,
  cardsById: Map<string, import('../domain/collection').Card>,
): string | undefined {
  const commander = cardsById.get(deck.commanderId)
  return (
    commander?.image_uris?.art_crop ??
    commander?.image_uris?.small ??
    commander?.card_faces?.[0]?.image_uris?.art_crop
  )
}

function getCommanderName(
  deck: Deck,
  cardsById: Map<string, import('../domain/collection').Card>,
): string {
  return cardsById.get(deck.commanderId)?.name ?? 'Comandante desconocido'
}

// ---------------------------------------------------------------------------
// DeckCard sub-component
// ---------------------------------------------------------------------------

interface DeckCardProps {
  deck: Deck
  commanderImage: string | undefined
  commanderName: string
  onClick: () => void
}

function DeckCard({ deck, commanderImage, commanderName, onClick }: DeckCardProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="cursor-pointer text-left w-full rounded-xl overflow-hidden border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 hover:border-zinc-400 dark:hover:border-zinc-500 hover:shadow-md transition-all"
      aria-label={`Editar mazo: ${deck.name}`}
    >
      {/* Commander art */}
      {commanderImage ? (
        <img
          src={commanderImage}
          alt={commanderName}
          className="w-full h-28 object-cover bg-zinc-100 dark:bg-zinc-800"
          loading="lazy"
        />
      ) : (
        <div className="w-full h-28 bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-xs text-zinc-400 dark:text-zinc-600">
          Sin imagen
        </div>
      )}

      {/* Deck info */}
      <Card.Content className="p-2 flex flex-col gap-0.5">
        <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 truncate leading-tight">
          {deck.name}
        </p>
        <p className="text-xs text-zinc-500 dark:text-zinc-400 truncate leading-tight">
          {commanderName}
        </p>
      </Card.Content>
    </button>
  )
}
