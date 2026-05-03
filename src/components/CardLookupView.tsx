/**
 * CardLookupView.tsx — "Carta específica" search mode.
 *
 * Flow: user picks a card name via CardSearch → findCardInStock fetches all stock
 * sources and filters for that card → MatchedCardItem renders the result with an
 * "En tu colección" chip when the card is also present locally.
 *
 * Collection ownership is computed via a live Dexie query (db.cards by name +
 * sum of matching collection entry quantities).
 *
 * TS 6.0 erasableSyntaxOnly: zero enum keywords.
 */

import { useState, type ReactNode } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useLiveQuery } from 'dexie-react-hooks'
import { Spinner } from '@heroui/react'
import { CardSearch } from './CardSearch'
import { MatchedCardItem } from './MatchedCardItem'
import { OutOfStockCardItem } from './OutOfStockCardItem'
import { findCardInStock } from '../engine/matchEngine'
import { resolveCard } from '../providers/scryfall'
import type { MatchedCardGroup } from '../domain/card'
import { db } from '../lib/collection-db'

interface Props {
  prefixSlot?: ReactNode
  inputValue: string
  onInputChange: (v: string) => void
}

function useCollectionQuantityByName(cardName: string | null): number {
  return (
    useLiveQuery(async (): Promise<number> => {
      if (!cardName) return 0
      const cards = await db.cards
        .where('name')
        .equalsIgnoreCase(cardName)
        .toArray()
      if (cards.length === 0) return 0
      const ids = cards.map((c) => c.id)
      const entries = await db.collection.where('cardId').anyOf(ids).toArray()
      return entries.reduce((sum, e) => sum + e.quantity, 0)
    }, [cardName]) ?? 0
  )
}

export function CardLookupView({ prefixSlot, inputValue, onInputChange }: Props) {
  const [selectedName, setSelectedName] = useState<string | null>(inputValue || null)

  const lookupQuery = useQuery({
    queryKey: ['cardLookup', selectedName],
    queryFn: ({ signal }) => findCardInStock(selectedName!, signal),
    enabled: !!selectedName,
    staleTime: 60_000,
  })

  // Only fetched when stock lookup returns no group — gives us the image + metadata
  // so we can still render the card in a "sin stock" state.
  const detailsQuery = useQuery({
    queryKey: ['cardDetails', selectedName],
    queryFn: ({ signal }) => resolveCard(selectedName!, signal),
    enabled: !!selectedName && lookupQuery.data?.group === null,
    staleTime: Infinity,
  })

  const ownedCount = useCollectionQuantityByName(selectedName)

  return (
    <div className="flex flex-col gap-6 w-full">
      <CardSearch
        onSelect={(name) => setSelectedName(name)}
        selectedName={selectedName}
        prefixSlot={prefixSlot}
        inputValue={inputValue}
        onInputChange={onInputChange}
      />

      {lookupQuery.error && (
        <div className="rounded-lg border border-red-300 bg-red-50 dark:bg-red-950/40 dark:border-red-800 p-4 text-sm text-red-800 dark:text-red-200">
          {lookupQuery.error instanceof Error
            ? lookupQuery.error.message
            : 'Ocurrió un error.'}
        </div>
      )}

      {(lookupQuery.isFetching || detailsQuery.isFetching) && (
        <div className="flex items-center gap-2 text-sm text-zinc-600 dark:text-zinc-400">
          <Spinner size="sm" /> Buscando en las tiendas…
        </div>
      )}

      {lookupQuery.data &&
        !lookupQuery.isFetching &&
        !detailsQuery.isFetching && (
          <LookupResultDisplay
            group={lookupQuery.data.group}
            sourcesUsed={lookupQuery.data.sourcesUsed}
            outOfStockDetails={
              lookupQuery.data.group === null ? detailsQuery.data ?? null : null
            }
            ownedCount={ownedCount}
          />
        )}
    </div>
  )
}

interface ResultProps {
  group: MatchedCardGroup | null
  sourcesUsed: string[]
  outOfStockDetails: import('../providers/scryfall').CardDetails | null
  ownedCount: number
}

function LookupResultDisplay({
  group,
  sourcesUsed,
  outOfStockDetails,
  ownedCount,
}: ResultProps) {
  if (!group) {
    if (!outOfStockDetails) return null
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
        <OutOfStockCardItem
          card={outOfStockDetails}
          collectionQuantity={ownedCount}
        />
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="text-sm text-zinc-600 dark:text-zinc-400">
        {group.variants.length}{' '}
        {group.variants.length === 1 ? 'variante disponible' : 'variantes disponibles'}{' '}
        · {sourcesUsed.join(', ')}
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
        <MatchedCardItem group={group} collectionQuantity={ownedCount} />
      </div>
    </div>
  )
}
